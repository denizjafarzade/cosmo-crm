const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  const { level, group_id, coach_id, payment_status, active } = req.query;
  let sql = `SELECT s.*, g.name as group_name, c.name as coach_name
    FROM students s
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN coaches c ON s.coach_id = c.id WHERE 1=1`;
  const params = [];

  if (level) { sql += ' AND s.level = ?'; params.push(level); }
  if (group_id) { sql += ' AND s.group_id = ?'; params.push(group_id); }
  if (coach_id) { sql += ' AND s.coach_id = ?'; params.push(coach_id); }
  if (payment_status) { sql += ' AND s.payment_status = ?'; params.push(payment_status); }
  if (active !== undefined) { sql += ' AND s.active = ?'; params.push(active === 'true' ? 1 : 0); }
  else { sql += ' AND s.active = 1'; }

  sql += ' ORDER BY s.name, s.surname';
  res.json(db.prepare(sql).all(...params));
});

r.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT s.*, g.name as group_name, c.name as coach_name
    FROM students s
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN coaches c ON s.coach_id = c.id
    WHERE s.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Normalizes a fide_rating input into a number or null. Empty string/undefined/null => null.
function parseFideRating(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

r.post('/', (req, res) => {
  const { name, surname, whatsapp_number, parent_whatsapp, level, fide_rating, coach_id, group_id, notes,
    birth_date, sector, chess_platform, chess_username } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare(`INSERT INTO students (name, surname, whatsapp_number, parent_whatsapp, level, fide_rating, coach_id, group_id, notes, birth_date, sector, chess_platform, chess_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, surname || '', whatsapp_number || null, parent_whatsapp || null, level || 'beginner', parseFideRating(fide_rating), coach_id || null, group_id || null, notes || '',
    birth_date || null, sector || null, chess_platform || null, chess_username || null);
  if (chess_platform && chess_username) {
    require('../services/chessRatings').updateRatingsFor('students', result.lastInsertRowid, chess_platform, chess_username).catch(() => {});
  }
  res.status(201).json({ id: result.lastInsertRowid });
});

// Re-fetch a student's online ratings on demand.
r.post('/:id/refresh-ratings', async (req, res) => {
  const s = db.prepare('SELECT chess_platform, chess_username FROM students WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (!s.chess_username) return res.status(400).json({ error: 'No chess account linked for this student' });
  const r2 = await require('../services/chessRatings').updateRatingsFor('students', req.params.id, s.chess_platform, s.chess_username);
  if (!r2) return res.status(404).json({ error: `Account "${s.chess_username}" not found on ${s.chess_platform}` });
  res.json({ ok: true, ...r2 });
});

// Adopt a registration's details (including fetched ratings) onto a student.
r.get('/:id/ratings', (req, res) => {
  const s = db.prepare('SELECT chess_platform, chess_username, blitz_rating, rapid_rating, blitz_games, rapid_games, ratings_updated_at FROM students WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

// Only the fields actually present in the body are updated. This matters
// because COALESCE cannot distinguish "not sent" from "set to null" — which
// previously made it impossible to clear group_id (i.e. remove a student from a
// group) or coach_id.
const NULLABLE_TEXT = ['whatsapp_number', 'parent_whatsapp', 'notes', 'birth_date', 'sector', 'chess_platform', 'chess_username'];
const PLAIN_TEXT = ['name', 'surname', 'level'];
const NULLABLE_IDS = ['coach_id', 'group_id'];

r.put('/:id', (req, res) => {
  const body = req.body || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const sets = [];
  const params = [];
  const add = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

  for (const k of PLAIN_TEXT) if (has(k) && body[k] != null) add(k, body[k]);
  for (const k of NULLABLE_TEXT) if (has(k)) add(k, body[k] === '' || body[k] == null ? null : body[k]);
  // An empty string or null here means "unassign".
  for (const k of NULLABLE_IDS) if (has(k)) add(k, body[k] === '' || body[k] == null ? null : Number(body[k]));
  if (has('fide_rating')) add('fide_rating', parseFideRating(body.fide_rating));
  if (has('active')) add('active', body.active ? 1 : 0);

  if (!sets.length) return res.json({ ok: true, updated: 0 });

  const before = db.prepare('SELECT chess_platform, chess_username FROM students WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Not found' });

  sets.push("updated_at = datetime('now')");
  params.push(req.params.id);
  const info = db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  // Re-fetch ratings when the linked account changed.
  const newUser = has('chess_username') ? body.chess_username : before.chess_username;
  const newPlatform = has('chess_platform') ? body.chess_platform : before.chess_platform;
  if (newUser && (newUser !== before.chess_username || newPlatform !== before.chess_platform)) {
    require('../services/chessRatings').updateRatingsFor('students', req.params.id, newPlatform, newUser).catch(() => {});
  }
  res.json({ ok: true, updated: info.changes });
});

r.delete('/:id', (req, res) => {
  db.prepare('UPDATE students SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Mark excused absence
r.post('/:id/excuse', (req, res) => {
  const { lesson_id } = req.body;
  const studentId = req.params.id;
  const limitStr = db.prepare("SELECT value FROM settings WHERE key = 'excused_absence_limit_per_month'").get();
  const limit = parseInt(limitStr?.value || '1', 10);

  // Count excused absences this month for this student
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const count = db.prepare(`SELECT COUNT(*) as cnt FROM lessons WHERE student_id = ? AND is_excused = 1 AND counts_toward_payment = 0 AND occurred_at >= ?`)
    .get(studentId, monthStart.toISOString());

  if (count.cnt >= limit) {
    return res.json({ ok: true, warning: 'Monthly excuse limit reached. This absence counts toward payment.' });
  }

  if (lesson_id) {
    db.prepare('UPDATE lessons SET is_excused = 1, counts_toward_payment = 0, absent = 1 WHERE id = ? AND student_id = ?').run(lesson_id, studentId);
    db.recomputeLessonsSincePayment(studentId);
  }

  res.json({ ok: true });
});

// Manually nudge a student's lesson count. Stored as an adjustment on top of
// the counted lessons so a later recompute keeps it.
r.post('/:id/adjust-lessons', (req, res) => {
  const delta = Number(req.body.delta);
  if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'delta must be a non-zero number' });
  const s = db.prepare('SELECT lessons_since_payment, COALESCE(lessons_adjustment, 0) AS adj FROM students WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  // Never let the visible count go below zero.
  const applied = s.lessons_since_payment + delta < 0 ? -s.lessons_since_payment : delta;
  db.prepare("UPDATE students SET lessons_adjustment = ?, updated_at = datetime('now') WHERE id = ?")
    .run(s.adj + applied, req.params.id);
  const total = db.recomputeLessonsSincePayment(req.params.id);
  res.json({ ok: true, lessons_since_payment: total });
});

// Record (or clear) a reason for a late payment. A reason stops the student
// being escalated to red and suppresses the automatic warning message.
r.post('/:id/payment-reason', (req, res) => {
  const { reason } = req.body;
  const text = (reason || '').trim();
  db.prepare("UPDATE students SET payment_excuse_reason = ?, updated_at = datetime('now') WHERE id = ?")
    .run(text || null, req.params.id);
  res.json({ ok: true, payment_excuse_reason: text || null });
});

// Confirm payment
r.post('/:id/pay', (req, res) => {
  const { amount, notes } = req.body;
  const studentId = req.params.id;
  const student = db.prepare('SELECT lessons_since_payment FROM students WHERE id = ?').get(studentId);
  if (!student) return res.status(404).json({ error: 'Not found' });

  db.prepare(`INSERT INTO payments (student_id, amount, lessons_covered, confirmed_at, notes) VALUES (?, ?, ?, datetime('now'), ?)`)
    .run(studentId, amount || 0, student.lessons_since_payment, notes || '');
  db.prepare(`UPDATE students SET lessons_since_payment = 0, lessons_adjustment = 0, payment_status = 'paid', payment_excuse_reason = NULL, overdue_warned_at_lessons = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(studentId);
  // Clear pending reminders
  db.prepare('DELETE FROM payment_reminders WHERE student_id = ?').run(studentId);

  res.json({ ok: true });
});

module.exports = r;
