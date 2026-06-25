const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  const { student_id } = req.query;
  let sql = `SELECT p.*, s.name || ' ' || s.surname as student_name
    FROM payments p LEFT JOIN students s ON p.student_id = s.id WHERE 1=1`;
  const params = [];
  if (student_id) { sql += ' AND p.student_id = ?'; params.push(student_id); }
  sql += ' ORDER BY p.confirmed_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

r.get('/summary', (req, res) => {
  const paid = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'paid' AND active = 1").get();
  const due = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'due' AND active = 1").get();
  const overdue = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'overdue' AND active = 1").get();
  res.json({ paid: paid.cnt, due: due.cnt, overdue: overdue.cnt });
});

r.get('/reminders', (req, res) => {
  const rows = db.prepare(`SELECT pr.*, s.name || ' ' || s.surname as student_name
    FROM payment_reminders pr LEFT JOIN students s ON pr.student_id = s.id ORDER BY pr.sent_at DESC LIMIT 50`).all();
  res.json(rows);
});

module.exports = r;
