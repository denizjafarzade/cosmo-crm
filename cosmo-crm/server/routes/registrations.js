const { Router } = require('express');
const db = require('../db');
const r = Router();

r.post('/', (req, res) => {
  const { name, phone, level, fide_rating, message } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  const result = db.prepare(`
    INSERT INTO registrations (name, phone, level, fide_rating, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone, level || '', fide_rating || null, message || '');
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
