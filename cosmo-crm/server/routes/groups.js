const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  const groups = db.prepare(`SELECT g.*, c.name as coach_name,
    (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) as student_count
    FROM groups g LEFT JOIN coaches c ON g.coach_id = c.id ORDER BY g.name`).all();
  res.json(groups);
});

r.get('/:id', (req, res) => {
  const group = db.prepare(`SELECT g.*, c.name as coach_name FROM groups g LEFT JOIN coaches c ON g.coach_id = c.id WHERE g.id = ?`).get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  group.students = db.prepare('SELECT * FROM students WHERE group_id = ? AND active = 1 ORDER BY name').all(req.params.id);
  group.schedules = db.prepare('SELECT * FROM group_schedules WHERE group_id = ? ORDER BY day_of_week, time').all(req.params.id);
  // Get homeworks mapped for this group
  const allHw = db.prepare('SELECT * FROM homeworks ORDER BY homework_number').all();
  const sends = db.prepare('SELECT homework_id, sent_at FROM homework_sends WHERE group_id = ?').all(req.params.id);
  const sentMap = {};
  for (const s of sends) sentMap[s.homework_id] = s.sent_at;
  const nextHwNum = group.homework_start_from + group.current_lesson_number;
  group.homeworks = allHw.map(hw => ({
    ...hw,
    sent_to_group: !!sentMap[hw.id],
    sent_at: sentMap[hw.id] || null,
    is_next: hw.homework_number === nextHwNum,
    group_lesson: hw.homework_number >= group.homework_start_from ? hw.homework_number - group.homework_start_from + 1 : null,
  })).filter(hw => hw.group_lesson !== null);
  res.json(group);
});

r.post('/', (req, res) => {
  const { name, whatsapp_group_id, whatsapp_group_name, coach_id, auto_increment_lessons, reminder_minutes_before, reminder_target, homework_start_from } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare(`INSERT INTO groups (name, whatsapp_group_id, whatsapp_group_name, coach_id, auto_increment_lessons, reminder_minutes_before, reminder_target, homework_start_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(name, whatsapp_group_id || '', whatsapp_group_name || '', coach_id || null, auto_increment_lessons ? 1 : 0, reminder_minutes_before || 60, reminder_target || 'group', homework_start_from || 1);
  res.status(201).json({ id: result.lastInsertRowid });
});

r.put('/:id', (req, res) => {
  const { name, whatsapp_group_id, whatsapp_group_name, coach_id, auto_increment_lessons, reminder_minutes_before, reminder_target, current_lesson_number, homework_start_from, homework_enabled } = req.body;
  db.prepare(`UPDATE groups SET
    name = COALESCE(?, name),
    whatsapp_group_id = COALESCE(?, whatsapp_group_id),
    whatsapp_group_name = COALESCE(?, whatsapp_group_name),
    coach_id = COALESCE(?, coach_id),
    auto_increment_lessons = COALESCE(?, auto_increment_lessons),
    reminder_minutes_before = COALESCE(?, reminder_minutes_before),
    reminder_target = COALESCE(?, reminder_target),
    current_lesson_number = COALESCE(?, current_lesson_number),
    homework_start_from = COALESCE(?, homework_start_from),
    homework_enabled = COALESCE(?, homework_enabled),
    updated_at = datetime('now')
    WHERE id = ?`).run(name, whatsapp_group_id, whatsapp_group_name, coach_id,
      auto_increment_lessons !== undefined ? (auto_increment_lessons ? 1 : 0) : null,
      reminder_minutes_before, reminder_target, current_lesson_number, homework_start_from,
      homework_enabled !== undefined ? (homework_enabled ? 1 : 0) : null, req.params.id);
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Schedules
r.put('/:id/schedules', (req, res) => {
  const { schedules } = req.body; // [{day_of_week, time}]
  const groupId = req.params.id;
  db.transaction(() => {
    db.prepare('DELETE FROM group_schedules WHERE group_id = ?').run(groupId);
    const stmt = db.prepare('INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (?, ?, ?)');
    for (const s of (schedules || [])) {
      stmt.run(groupId, s.day_of_week, s.time);
    }
  })();
  res.json({ ok: true });
});

// Mark lesson done (manual)
r.post('/:id/lesson-done', (req, res) => {
  const groupId = req.params.id;
  // absentIds: array of student IDs who were absent (everyone else is present)
  const absentIds = new Set((req.body.absentIds || []).map(Number));

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Not found' });

  const newLesson = group.current_lesson_number + 1;
  const now = new Date().toISOString();
  const students = db.prepare('SELECT * FROM students WHERE group_id = ? AND active = 1').all(groupId);

  db.transaction(() => {
    db.prepare('UPDATE groups SET current_lesson_number = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newLesson, groupId);
    const stmtLesson = db.prepare('INSERT INTO lessons (group_id, student_id, lesson_number, occurred_at, is_excused, counts_toward_payment) VALUES (?, ?, ?, ?, ?, ?)');
    const stmtStudent = db.prepare(`UPDATE students SET lessons_since_payment = lessons_since_payment + 1, updated_at = datetime('now') WHERE id = ?`);
    for (const s of students) {
      const suspended = s.suspended_until_lesson != null && newLesson <= s.suspended_until_lesson;
      const absent = absentIds.has(s.id);
      const excused = absent || suspended;
      stmtLesson.run(groupId, s.id, newLesson, now, excused ? 1 : 0, excused ? 0 : 1);
      if (!excused) stmtStudent.run(s.id);
    }
    const cycleLessons = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'payment_cycle_lessons'").get()?.value || '8', 10);
    db.prepare(`UPDATE students SET payment_status = 'due' WHERE group_id = ? AND active = 1 AND payment_status = 'paid' AND lessons_since_payment >= ?`)
      .run(groupId, cycleLessons);
  })();

  const { sendHomeworkForLesson, checkPaymentForGroup } = require('../services/scheduler');
  sendHomeworkForLesson(groupId, newLesson);
  checkPaymentForGroup(groupId);

  res.json({ ok: true, lesson_number: newLesson });
});

// Suspend a student for N lessons
r.post('/:id/suspend-student', (req, res) => {
  const groupId = req.params.id;
  const { student_id, lessons } = req.body;
  if (!student_id || !lessons || lessons < 1) return res.status(400).json({ error: 'student_id and lessons (≥1) required' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const suspendUntil = group.current_lesson_number + Number(lessons);
  db.prepare(`UPDATE students SET suspended_until_lesson = ?, updated_at = datetime('now') WHERE id = ? AND group_id = ?`)
    .run(suspendUntil, student_id, groupId);

  res.json({ ok: true, suspended_until_lesson: suspendUntil });
});

// Unsuspend a student
r.post('/:id/unsuspend-student', (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  db.prepare(`UPDATE students SET suspended_until_lesson = NULL, updated_at = datetime('now') WHERE id = ? AND group_id = ?`)
    .run(student_id, req.params.id);
  res.json({ ok: true });
});

module.exports = r;
