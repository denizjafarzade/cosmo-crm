const { Router } = require('express');
const db = require('../db');
const r = Router();

r.post('/', (req, res) => {
  const { name, phone, level, fide_rating, message, birth_date, sector, availability, chess_platform, chess_username } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  // availability arrives as an array of "<dayIndex>|<HH:MM-HH:MM>" slots.
  const availabilityJson = Array.isArray(availability) ? JSON.stringify(availability) : (availability || null);
  const result = db.prepare(`
    INSERT INTO registrations (name, phone, level, fide_rating, message, birth_date, sector, availability, chess_platform, chess_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, phone, level || '', fide_rating || null, message || '',
    birth_date || null, sector || null, availabilityJson, chess_platform || null, chess_username || null);

  // Look up the player's online ratings in the background — the form must not
  // wait on a third-party API.
  if (chess_platform && chess_username) {
    require('../services/chessRatings')
      .updateRatingsFor('registrations', result.lastInsertRowid, chess_platform, chess_username)
      .catch(() => {});
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
