const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/weekly', (req, res) => {
  const rows = db.prepare('SELECT * FROM weekly_reports ORDER BY created_at DESC LIMIT 10').all();
  res.json(rows.map(r => ({ ...r, report: JSON.parse(r.report_json) })));
});

r.get('/dashboard', (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE active = 1").get().cnt;
  const paymentSummary = {
    paid: db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'paid' AND active = 1").get().cnt,
    due: db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'due' AND active = 1").get().cnt,
    overdue: db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'overdue' AND active = 1").get().cnt,
  };
  const totalGroups = db.prepare("SELECT COUNT(*) as cnt FROM groups").get().cnt;
  const lessonsThisWeek = db.prepare(`SELECT COUNT(DISTINCT l.id) as cnt FROM lessons l WHERE l.occurred_at >= datetime('now', '-7 days')`).get().cnt;
  const recentSends = db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT 10").all();
  const newStudentsThisWeek = db.prepare(`SELECT COUNT(*) as cnt FROM students WHERE created_at >= datetime('now', '-7 days')`).get().cnt;
  const homeworksSentThisWeek = db.prepare(`SELECT COUNT(*) as cnt FROM send_log WHERE type = 'homework' AND status = 'success' AND created_at >= datetime('now', '-7 days')`).get().cnt;

  res.json({
    total_students: totalStudents,
    total_groups: totalGroups,
    payment: paymentSummary,
    lessons_this_week: lessonsThisWeek,
    new_students_this_week: newStudentsThisWeek,
    homeworks_sent_this_week: homeworksSentThisWeek,
    recent_activity: recentSends,
  });
});

module.exports = r;
