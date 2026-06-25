const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM coaches ORDER BY id').all());
});

r.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM coaches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

r.post('/', (req, res) => {
  const { name, whatsapp_number } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO coaches (name, whatsapp_number) VALUES (?, ?)').run(name, whatsapp_number || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

r.put('/:id', (req, res) => {
  const { name, whatsapp_number } = req.body;
  db.prepare(`UPDATE coaches SET name = COALESCE(?, name), whatsapp_number = COALESCE(?, whatsapp_number), updated_at = datetime('now') WHERE id = ?`)
    .run(name, whatsapp_number, req.params.id);
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM coaches WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = r;
