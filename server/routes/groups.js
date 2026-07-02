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
  group.homeworks = db.prepare('SELECT * FROM homeworks WHERE group_id = ? ORDER BY order_index').all(req.params.id);
  res.json(group);
});

r.post('/', (req, res) => {
  const { name, whatsapp_group_id, whatsapp_group_name, coach_id, auto_increment_lessons, reminder_minutes_before, reminder_target } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare(`INSERT INTO groups (name, whatsapp_group_id, whatsapp_group_name, coach_id, auto_increment_lessons, reminder_minutes_before, reminder_target)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(name, whatsapp_group_id || '', whatsapp_group_name || '', coach_id || null, auto_increment_lessons ? 1 : 0, reminder_minutes_before || 60, reminder_target || 'group');
  res.status(201).json({ id: result.lastInsertRowid });
});

r.put('/:id', (req, res) => {
  const { name, whatsapp_group_id, whatsapp_group_name, coach_id, auto_increment_lessons, reminder_minutes_before, reminder_target, current_lesson_number } = req.body;
  db.prepare(`UPDATE groups SET
    name = COALESCE(?, name),
    whatsapp_group_id = COALESCE(?, whatsapp_group_id),
    whatsapp_group_name = COALESCE(?, whatsapp_group_name),
    coach_id = COALESCE(?, coach_id),
    auto_increment_lessons = COALESCE(?, auto_increment_lessons),
    reminder_minutes_before = COALESCE(?, reminder_minutes_before),
    reminder_target = COALESCE(?, reminder_target),
    current_lesson_number = COALESCE(?, current_lesson_number),
    updated_at = datetime('now')
    WHERE id = ?`).run(name, whatsapp_group_id, whatsapp_group_name, coach_id,
      auto_increment_lessons !== undefined ? (auto_increment_lessons ? 1 : 0) : null,
      reminder_minutes_before, reminder_target, current_lesson_number, req.params.id);
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
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Not found' });

  const newLesson = group.current_lesson_number + 1;
  const now = new Date().toISOString();
  const students = db.prepare('SELECT * FROM students WHERE group_id = ? AND active = 1').all(groupId);

  db.transaction(() => {
    db.prepare('UPDATE groups SET current_lesson_number = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newLesson, groupId);
    const stmtLesson = db.prepare('INSERT INTO lessons (group_id, student_id, lesson_number, occurred_at) VALUES (?, ?, ?, ?)');
    const stmtStudent = db.prepare(`UPDATE students SET lessons_since_payment = lessons_since_payment + 1, updated_at = datetime('now') WHERE id = ?`);
    for (const s of students) {
      stmtLesson.run(groupId, s.id, newLesson, now);
      stmtStudent.run(s.id);
    }
    // Update payment statuses
    const cycleLessons = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'payment_cycle_lessons'").get()?.value || '8', 10);
    db.prepare(`UPDATE students SET payment_status = 'due' WHERE group_id = ? AND active = 1 AND payment_status = 'paid' AND lessons_since_payment >= ?`)
      .run(groupId, cycleLessons);
  })();

  res.json({ ok: true, lesson_number: newLesson });
});

module.exports = r;
