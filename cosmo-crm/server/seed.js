const db = require('./db');

console.log('Seeding database...');

const seed = db.transaction(() => {
  // Coach
  db.prepare('DELETE FROM coaches').run();
  db.prepare(`INSERT INTO coaches (id, name, whatsapp_number) VALUES (1, 'Abdulla Shabanov', '994501234567')`).run();

  // Groups
  db.prepare('DELETE FROM groups').run();
  db.prepare(`INSERT INTO groups (id, name, whatsapp_group_id, whatsapp_group_name, coach_id, current_lesson_number, auto_increment_lessons, reminder_minutes_before)
    VALUES (1, 'Beginners A', '', 'Cosmo Chess - Beginners A', 1, 5, 0, 60)`).run();
  db.prepare(`INSERT INTO groups (id, name, whatsapp_group_id, whatsapp_group_name, coach_id, current_lesson_number, auto_increment_lessons, reminder_minutes_before)
    VALUES (2, 'Intermediate B', '', 'Cosmo Chess - Intermediate B', 1, 12, 1, 60)`).run();
  db.prepare(`INSERT INTO groups (id, name, whatsapp_group_id, whatsapp_group_name, coach_id, current_lesson_number, auto_increment_lessons, reminder_minutes_before)
    VALUES (3, 'Advanced C', '', 'Cosmo Chess - Advanced C', 1, 20, 0, 90)`).run();

  // Schedules
  db.prepare('DELETE FROM group_schedules').run();
  // Beginners A: Mon & Wed 16:00
  db.prepare(`INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (1, 1, '16:00')`).run();
  db.prepare(`INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (1, 3, '16:00')`).run();
  // Intermediate B: Tue & Thu 17:00
  db.prepare(`INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (2, 2, '17:00')`).run();
  db.prepare(`INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (2, 4, '17:00')`).run();
  // Advanced C: Sat 10:00
  db.prepare(`INSERT INTO group_schedules (group_id, day_of_week, time) VALUES (3, 6, '10:00')`).run();

  // Students
  db.prepare('DELETE FROM students').run();
  const students = [
    [1, 'Ali', 'Mammadov', '994501111111', '994509991111', 'beginner', 1, 1, 3, 'paid'],
    [2, 'Sara', 'Aliyeva', '994502222222', '994509992222', 'beginner', 1, 1, 5, 'due'],
    [3, 'Tural', 'Hasanov', '994503333333', '994509993333', 'intermediate', 1, 2, 0, 'paid'],
    [4, 'Leyla', 'Huseynova', '994504444444', '994509994444', 'intermediate', 1, 2, 7, 'due'],
    [5, 'Murad', 'Karimov', '994505555555', '994509995555', 'advanced', 1, 3, 2, 'paid'],
    [6, 'Nigar', 'Sultanova', '994506666666', '994509996666', 'beginner', 1, 1, 9, 'overdue'],
    [7, 'Elvin', 'Jabbarov', '994507777777', '994509997777', 'intermediate', 1, 2, 4, 'paid'],
    [8, 'Aydan', 'Rzayeva', '994508888888', '994509998888', 'advanced', 1, 3, 1, 'paid'],
  ];
  const stmtS = db.prepare(`INSERT INTO students (id, name, surname, whatsapp_number, parent_whatsapp, level, coach_id, group_id, lessons_since_payment, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const s of students) stmtS.run(...s);

  // Sample lessons
  db.prepare('DELETE FROM lessons').run();
  const stmtL = db.prepare(`INSERT INTO lessons (group_id, student_id, lesson_number, occurred_at, is_excused, counts_toward_payment) VALUES (?, ?, ?, ?, ?, ?)`);
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (5 - i) * 3);
    const dateStr = d.toISOString();
    stmtL.run(1, 1, i, dateStr, 0, 1);
    stmtL.run(1, 2, i, dateStr, 0, 1);
    stmtL.run(1, 6, i, dateStr, i === 3 ? 1 : 0, i === 3 ? 0 : 1);
  }

  // Send log samples
  db.prepare('DELETE FROM send_log').run();
  const stmtLog = db.prepare(`INSERT INTO send_log (type, target, target_name, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const d1 = new Date(now); d1.setHours(d1.getHours() - 2);
  const d2 = new Date(now); d2.setDate(d2.getDate() - 1);
  stmtLog.run('reminder', 'group:1', 'Beginners A', 'Lesson reminder: Today at 16:00', 'success', d1.toISOString());
  stmtLog.run('homework', 'group:1', 'Beginners A', 'Homework #5 sent', 'success', d2.toISOString());
  stmtLog.run('payment', 'student:6', 'Nigar Sultanova', 'Payment reminder: 9 lessons since last payment', 'success', d2.toISOString());
});

seed();
console.log('Seed complete.');
