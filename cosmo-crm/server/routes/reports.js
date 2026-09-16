const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/weekly', (req, res) => {
  const rows = db.prepare('SELECT * FROM weekly_reports ORDER BY created_at DESC LIMIT 10').all();
  res.json(rows.map(r => ({ ...r, report: JSON.parse(r.report_json) })));
});

// Revenue per calendar month, oldest first, so the CRM can chart/compare
// income month over month rather than just this-month-vs-last-month.
r.get('/revenue-monthly', (req, res) => {
  const months = Math.min(parseInt(req.query.months, 10) || 12, 36);
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', confirmed_at) as month, COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt
    FROM payments
    WHERE confirmed_at >= datetime('now', 'start of month', '-' || ? || ' months')
    GROUP BY month
    ORDER BY month ASC
  `).all(months - 1);

  // Fill in any month with no payments as a 0 bar, so gaps don't look like
  // missing data on the chart.
  const byMonth = new Map(rows.map(r => [r.month, r]));
  const out = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const row = byMonth.get(key);
    out.push({ month: key, total: row ? row.total : 0, count: row ? row.cnt : 0 });
  }
  res.json(out);
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

  // Revenue actually collected this month (confirmed payments, not what's
  // merely "due"), plus last month's total so the dashboard can show whether
  // it's tracking up or down.
  const revenueThisMonth = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM payments WHERE confirmed_at >= datetime('now', 'start of month')`
  ).get();
  const revenueLastMonth = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments
     WHERE confirmed_at >= datetime('now', 'start of month', '-1 month') AND confirmed_at < datetime('now', 'start of month')`
  ).get();

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
           g.current_lesson_number, g.auto_increment_lessons, g.lesson_duration_minutes as duration,
           (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) as student_count,
           (SELECT COUNT(*) FROM lessons l WHERE l.group_id = g.id AND date(l.occurred_at) = date('now') AND l.slot_time = gs.time) > 0 as marked_today,
           -- The lesson number actually recorded for THIS slot today. Without it
           -- every slot of a group would display the same "next" number.
           (SELECT MAX(l.lesson_number) FROM lessons l WHERE l.group_id = g.id AND date(l.occurred_at) = date('now') AND l.slot_time = gs.time) as slot_lesson_number,
           (SELECT COUNT(*) FROM lesson_cancellations c WHERE c.group_id = g.id AND c.date = date('now') AND (c.slot_time IS NULL OR c.slot_time = gs.time)) > 0 as cancelled_today,
           (SELECT c.reason FROM lesson_cancellations c WHERE c.group_id = g.id AND c.date = date('now') AND (c.slot_time IS NULL OR c.slot_time = gs.time) LIMIT 1) as cancel_reason,
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
    revenue_this_month: revenueThisMonth.total,
    payments_this_month: revenueThisMonth.cnt,
    revenue_last_month: revenueLastMonth.total,
    attendance_rate: attendanceRate,
    top_groups: topGroups,
    recent_activity: recentSends,
    today_schedule: todaySchedule,
  });
});

module.exports = r;
