const { Router } = require('express');
const db = require('../db');
const r = Router();

// Public lookup used by the landing-page form to preview a player's ratings as
// soon as they type their account name. Cached and rate-limited because it is
// unauthenticated and calls third-party APIs.
const lookupCache = new Map(); // key -> { at, data }
const LOOKUP_TTL_MS = 10 * 60 * 1000;
const hits = new Map();        // ip -> { windowStart, count }
const LOOKUP_LIMIT = 20;       // per IP per minute

function rateLimited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > 60000) { hits.set(ip, { windowStart: now, count: 1 }); return false; }
  h.count++;
  return h.count > LOOKUP_LIMIT;
}

r.get('/chess-rating', async (req, res) => {
  const platform = String(req.query.platform || '').toLowerCase();
  const username = String(req.query.username || '').trim();
  if (!platform || !username) return res.status(400).json({ error: 'platform and username are required' });
  if (!['lichess', 'chesscom'].includes(platform)) return res.status(400).json({ error: 'unknown platform' });
  if (username.length > 40) return res.status(400).json({ error: 'username too long' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many lookups, please wait a moment' });

  const key = `${platform}:${username.toLowerCase()}`;
  const cached = lookupCache.get(key);
  if (cached && Date.now() - cached.at < LOOKUP_TTL_MS) return res.json(cached.data);

  try {
    const r2 = await require('../services/chessRatings').fetchRatings(platform, username);
    if (!r2) return res.status(404).json({ error: 'not_found' });
    const payload = { ok: true, platform, ...r2 };
    lookupCache.set(key, { at: Date.now(), data: payload });
    // Keep the cache from growing without bound.
    if (lookupCache.size > 500) lookupCache.delete(lookupCache.keys().next().value);
    res.json(payload);
  } catch (e) {
    // Distinct from not_found: the provider was unreachable/limited, so the
    // form must not claim the username is wrong.
    console.error(`[Ratings] lookup ${platform}/${username} failed:`, e.message);
    res.status(502).json({ error: 'lookup_failed' });
  }
});

r.post('/', (req, res) => {
  const { name, surname, phone, level, fide_rating, message, birth_date, sector, availability, chess_platform, chess_username, ratings } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  // availability arrives as an array of "<dayIndex>|<HH:MM-HH:MM>" slots.
  const availabilityJson = Array.isArray(availability) ? JSON.stringify(availability) : (availability || null);
  const result = db.prepare(`
    INSERT INTO registrations (name, surname, phone, level, fide_rating, message, birth_date, sector, availability, chess_platform, chess_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, surname || '', phone, level || '', fide_rating || null, message || '',
    birth_date || null, sector || null, availabilityJson, chess_platform || null, chess_username || null);

  // The form already previewed the ratings, so store those immediately; only
  // fall back to a fresh lookup if it didn't have them.
  if (chess_platform && chess_username) {
    const preview = ratings && typeof ratings === 'object' ? ratings : null;
    if (preview) {
      db.prepare(`UPDATE registrations SET blitz_rating = ?, rapid_rating = ?, blitz_games = ?, rapid_games = ?, ratings_updated_at = datetime('now') WHERE id = ?`)
        .run(preview.blitz ?? null, preview.rapid ?? null, preview.blitzGames ?? null, preview.rapidGames ?? null, result.lastInsertRowid);
    } else {
      require('../services/chessRatings')
        .updateRatingsFor('registrations', result.lastInsertRowid, chess_platform, chess_username)
        .catch(() => {});
    }
  }
  res.status(201).json({ id: result.lastInsertRowid, ok: true });
});

r.get('/', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM registrations';
  const params = [];
  if (status) { query += ' WHERE status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  res.json(db.prepare(query).all(...params));
});

r.put('/:id', (req, res) => {
  const { status, notes } = req.body;
  db.prepare(`UPDATE registrations SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`)
    .run(status || null, notes !== undefined ? notes : null, req.params.id);
  res.json({ ok: true });
});

// Turn an inquiry into a student: either into an existing group, or into a new
// group created here with its weekly schedule. Everything already collected on
// the form (birth date, preferred language, level, chess account and ratings)
// is carried over so nothing has to be retyped.
r.post('/:id/enroll', (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Inquiry not found' });

  const { group_id, new_group } = req.body || {};
  if (!group_id && !new_group) return res.status(400).json({ error: 'Choose a group or provide a new one' });

  // Map the public form's level wording onto the students table's values.
  const LEVELS = {
    'new to chess': 'new_to_chess', 'beginner': 'beginner', 'intermediate': 'intermediate',
    'advanced': 'advanced', 'expert': 'expert', 'not sure': 'not_sure',
  };
  const level = LEVELS[String(reg.level || '').toLowerCase()] || 'beginner';
  // Surname is its own field on the form now; fall back to splitting the name
  // for inquiries captured before that change.
  const parts = String(reg.name || '').trim().split(/\s+/);
  const name = parts[0] || reg.name;
  const surname = (reg.surname && reg.surname.trim()) || parts.slice(1).join(' ');

  let groupId = group_id ? Number(group_id) : null;
  let createdGroup = null;
  let studentId;

  const run = db.transaction(() => {
    if (!groupId) {
      const g = new_group;
      if (!g.name) throw new Error('New group needs a name');
      const info = db.prepare(`INSERT INTO groups (name, coach_id, auto_increment_lessons, homework_start_from, lesson_duration_minutes)
        VALUES (?, ?, 1, ?, ?)`).run(g.name, g.coach_id || null, parseInt(g.homework_start_from) || 1, parseInt(g.lesson_duration_minutes) || 60);
      groupId = info.lastInsertRowid;
      const stmt = db.prepare('INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (?, ?, ?)');
      for (const s of (g.schedules || [])) {
        if (s && s.time != null && s.day_of_week != null) stmt.run(groupId, Number(s.day_of_week), String(s.time));
      }
      createdGroup = { id: groupId, name: g.name };
    }

    const ins = db.prepare(`INSERT INTO students
      (name, surname, whatsapp_number, level, fide_rating, group_id, birth_date, sector,
       chess_platform, chess_username, blitz_rating, rapid_rating, blitz_games, rapid_games, ratings_updated_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name || reg.name, surname, reg.phone || null, level, reg.fide_rating ?? null, groupId,
        reg.birth_date || null, reg.sector || null, reg.chess_platform || null, reg.chess_username || null,
        reg.blitz_rating ?? null, reg.rapid_rating ?? null, reg.blitz_games ?? null, reg.rapid_games ?? null,
        reg.ratings_updated_at || null, reg.notes || '');
    studentId = ins.lastInsertRowid;

    db.prepare("UPDATE registrations SET status = 'enrolled', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  });

  try {
    run();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ ok: true, student_id: studentId, group_id: groupId, created_group: createdGroup });
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM registrations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = r;
