const { Router } = require('express');
const db = require('../db');
const r = Router();

r.get('/', (req, res) => {
  const { level, group_id, coach_id, payment_status, active } = req.query;
  let sql = `SELECT s.*, g.name as group_name, c.name as coach_name
    FROM students s
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN coaches c ON s.coach_id = c.id WHERE 1=1`;
  const params = [];

  if (level) { sql += ' AND s.level = ?'; params.push(level); }
  if (group_id) { sql += ' AND s.group_id = ?'; params.push(group_id); }
  if (coach_id) { sql += ' AND s.coach_id = ?'; params.push(coach_id); }
  if (payment_status) { sql += ' AND s.payment_status = ?'; params.push(payment_status); }
  if (active !== undefined) { sql += ' AND s.active = ?'; params.push(active === 'true' ? 1 : 0); }
  else { sql += ' AND s.active = 1'; }

  sql += ' ORDER BY s.name, s.surname';
  res.json(db.prepare(sql).all(...params));
});

r.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT s.*, g.name as group_name, c.name as coach_name
    FROM students s
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN coaches c ON s.coach_id = c.id
    WHERE s.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

r.post('/', (req, res) => {
  const { name, surname, whatsapp_number, parent_whatsapp, level, coach_id, group_id, notes, payment_amount } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare(`INSERT INTO students (name, surname, whatsapp_number, parent_whatsapp, level, coach_id, group_id, notes, payment_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, surname || '', whatsapp_number || null, parent_whatsapp || null, level || 'beginner', coach_id || null, group_id || null, notes || '', payment_amount || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

r.put('/:id', (req, res) => {
  const body = req.body;
  // Build dynamic SET clause — supports explicit null for group_id/coach_id
  const fields = [];
  const values = [];
  const allowed = ['name', 'surname', 'whatsapp_number', 'parent_whatsapp', 'level', 'notes', 'payment_amount'];
  for (const f of allowed) {
    if (f in body) { fields.push(`${f} = ?`); values.push(body[f]); }
  }
  // Nullable foreign keys — allow explicit null
  for (const f of ['coach_id', 'group_id']) {
    if (f in body) { fields.push(`${f} = ?`); values.push(body[f]); }
  }
  if ('active' in body) { fields.push('active = ?'); values.push(body.active ? 1 : 0); }
  if (fields.length === 0) return res.json({ ok: true });
  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  db.prepare('UPDATE students SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Mark excused absence
r.post('/:id/excuse', (req, res) => {
  const { lesson_id } = req.body;
  const studentId = req.params.id;
  const limitStr = db.prepare("SELECT value FROM settings WHERE key = 'excused_absence_limit_per_month'").get();
  const limit = parseInt(limitStr?.value || '1', 10);

  // Count excused absences this month for this student
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const count = db.prepare(`SELECT COUNT(*) as cnt FROM lessons WHERE student_id = ? AND is_excused = 1 AND counts_toward_payment = 0 AND occurred_at >= ?`)
    .get(studentId, monthStart.toISOString());

  if (count.cnt >= limit) {
    return res.json({ ok: true, warning: 'Monthly excuse limit reached. This absence counts toward payment.' });
  }

  if (lesson_id) {
    db.prepare('UPDATE lessons SET is_excused = 1, counts_toward_payment = 0 WHERE id = ? AND student_id = ?').run(lesson_id, studentId);
    // Decrement lessons_since_payment
    db.prepare('UPDATE students SET lessons_since_payment = MAX(0, lessons_since_payment - 1), updated_at = datetime(\'now\') WHERE id = ?').run(studentId);
  }

  res.json({ ok: true });
});

// Confirm payment
r.post('/:id/pay', (req, res) => {
  const { amount, notes } = req.body;
  const studentId = req.params.id;
  const student = db.prepare('SELECT lessons_since_payment FROM students WHERE id = ?').get(studentId);
  if (!student) return res.status(404).json({ error: 'Not found' });
  const cycle = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'payment_cycle_lessons'").get()?.value || '8', 10);
  const remaining = Math.max(0, student.lessons_since_payment - cycle);

  db.prepare(`INSERT INTO payments (student_id, amount, lessons_covered, confirmed_at, notes) VALUES (?, ?, ?, datetime('now'), ?)`)
    .run(studentId, amount || 0, cycle, notes || '');
  db.prepare(`UPDATE students SET lessons_since_payment = ?, payment_status = ?, payment_delay_until = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(remaining, remaining >= cycle ? 'due' : 'paid', studentId);
  db.prepare('DELETE FROM payment_reminders WHERE student_id = ?').run(studentId);

  res.json({ ok: true });
});

// Delay payment — student asked for X more days
r.post('/:id/delay', (req, res) => {
  const { days } = req.body;
  if (!days || days < 1) return res.status(400).json({ error: 'Days required (minimum 1)' });
  const studentId = req.params.id;
  const delayUntil = new Date();
  delayUntil.setDate(delayUntil.getDate() + parseInt(days));
  db.prepare(`UPDATE students SET payment_status = 'delayed', payment_delay_until = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(delayUntil.toISOString(), studentId);
  // Clear existing reminders so they don't keep firing
  db.prepare('DELETE FROM payment_reminders WHERE student_id = ?').run(studentId);
  res.json({ ok: true, delay_until: delayUntil.toISOString() });
});

module.exports = r;
