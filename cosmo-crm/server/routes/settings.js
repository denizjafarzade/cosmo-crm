const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

r.put('/', (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const [k, v] of Object.entries(req.body)) {
      stmt.run(k, String(v));
    }
  })();
  res.json({ ok: true });
});

r.get('/send-log', (req, res) => {
  const { limit, type } = req.query;
  let sql = 'SELECT * FROM send_log WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 50);
  res.json(db.prepare(sql).all(...params));
});

module.exports = r;
