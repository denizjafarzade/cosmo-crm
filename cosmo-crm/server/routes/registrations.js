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
  const { name, phone, level, fide_rating, message, birth_date, sector, availability, chess_platform, chess_username, ratings } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  // availability arrives as an array of "<dayIndex>|<HH:MM-HH:MM>" slots.
  const availabilityJson = Array.isArray(availability) ? JSON.stringify(availability) : (availability || null);
  const result = db.prepare(`
    INSERT INTO registrations (name, phone, level, fide_rating, message, birth_date, sector, availability, chess_platform, chess_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, phone, level || '', fide_rating || null, message || '',
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

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM registrations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = r;
