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
  const lessonsThisMonth = db.prepare(`SELECT COUNT(DISTINCT l.id) as cnt FROM lessons l WHERE l.occurred_at >= datetime('now', '-30 days')`).get().cnt;
  const recentSends = db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT 15").all();
  const newStudentsThisWeek = db.prepare(`SELECT COUNT(*) as cnt FROM students WHERE created_at >= datetime('now', '-7 days')`).get().cnt;
  const newStudentsThisMonth = db.prepare(`SELECT COUNT(*) as cnt FROM students WHERE created_at >= datetime('now', '-30 days')`).get().cnt;
  const homeworksSentThisWeek = db.prepare(`SELECT COUNT(*) as cnt FROM send_log WHERE type = 'homework' AND status = 'success' AND created_at >= datetime('now', '-7 days')`).get().cnt;
  const newRegistrations = db.prepare("SELECT COUNT(*) as cnt FROM registrations WHERE status = 'new'").get().cnt;

  // Attendance stats (last 30 days)
  const attendanceTotal = db.prepare(`SELECT COUNT(*) as cnt FROM lessons WHERE occurred_at >= datetime('now', '-30 days')`).get().cnt;
  const attendancePresent = db.prepare(`SELECT COUNT(*) as cnt FROM lessons WHERE occurred_at >= datetime('now', '-30 days') AND is_excused = 0`).get().cnt;
  const attendanceRate = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;

  // Top groups by lesson count
  const topGroups = db.prepare(`
    SELECT g.name, g.current_lesson_number,
           (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) as student_count
    FROM groups g
    ORDER BY g.current_lesson_number DESC
    LIMIT 5
  `).all();

  // Full weekly timetable (all days)
  const todaySchedule = db.prepare(`
    SELECT gs.time, gs.day_of_week, g.id as group_id, g.name as group_name,
           g.current_lesson_number, g.auto_increment_lessons,
           (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) as student_count,
           c.name as coach_name
    FROM group_schedules gs
    JOIN groups g ON gs.group_id = g.id
    LEFT JOIN coaches c ON g.coach_id = c.id
    ORDER BY gs.day_of_week, gs.time
  `).all();

  res.json({
    total_students: totalStudents,
    total_groups: totalGroups,
    payment: paymentSummary,
    lessons_this_week: lessonsThisWeek,
    lessons_this_month: lessonsThisMonth,
    new_students_this_week: newStudentsThisWeek,
    new_students_this_month: newStudentsThisMonth,
    homeworks_sent_this_week: homeworksSentThisWeek,
    new_registrations: newRegistrations,
    attendance_rate: attendanceRate,
    top_groups: topGroups,
    recent_activity: recentSends,
    today_schedule: todaySchedule,
  });
});

module.exports = r;
