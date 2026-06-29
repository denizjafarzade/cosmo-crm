const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  const { group_id, student_id, limit } = req.query;
  let sql = `SELECT l.*, s.name || ' ' || s.surname as student_name, g.name as group_name
    FROM lessons l
    LEFT JOIN students s ON l.student_id = s.id
    LEFT JOIN groups g ON l.group_id = g.id WHERE 1=1`;
  const params = [];
  if (group_id) { sql += ' AND l.group_id = ?'; params.push(group_id); }
  if (student_id) { sql += ' AND l.student_id = ?'; params.push(student_id); }
  sql += ' ORDER BY l.occurred_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

r.get('/stats', (req, res) => {
  const totalLessons = db.prepare('SELECT COUNT(DISTINCT lesson_number || group_id) as cnt FROM lessons').get();
  const thisWeek = db.prepare(`SELECT COUNT(DISTINCT lesson_number || group_id) as cnt FROM lessons WHERE occurred_at >= datetime('now', '-7 days')`).get();
  const excusedThisWeek = db.prepare(`SELECT COUNT(*) as cnt FROM lessons WHERE is_excused = 1 AND occurred_at >= datetime('now', '-7 days')`).get();
  res.json({
    total: totalLessons.cnt,
    this_week: thisWeek.cnt,
    excused_this_week: excusedThisWeek.cnt,
  });
});

module.exports = r;
