const cron = require('node-cron');
const db = require('../db');
const wa = require('./whatsapp');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value;
}

// ─── Human-behaviour send window ────────────────────────────────
// Only send automated messages during daytime hours (in the configured
// timezone). Anything triggered outside the window is deferred until it opens.
function withinSendWindow() {
  const tz = getSetting('timezone') || 'Asia/Baku';
  const startH = parseInt(getSetting('send_window_start') || '9', 10);
  const endH = parseInt(getSetting('send_window_end') || '21', 10);
  let hour;
  try {
    hour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()), 10) % 24;
  } catch (e) {
    hour = new Date().getHours();
  }
  return hour >= startH && hour < endH;
}

// ─── Auto-increment lessons ─────────────────────────────────────
// For groups with auto_increment_lessons, mark lesson done at scheduled time
function checkAutoLessons() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const schedules = db.prepare(`
    SELECT gs.*, g.id as gid, g.name as group_name, g.current_lesson_number, g.auto_increment_lessons
    FROM group_schedules gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.day_of_week = ? AND g.auto_increment_lessons = 1
  `).all(currentDay);

  for (const sched of schedules) {
    const [h, m] = sched.time.split(':').map(Number);
    if (currentMinutes !== h * 60 + m) continue;

    const idempKey = `autolesson-${sched.gid}-${now.toISOString().slice(0, 10)}-${sched.time}`;
    const existing = db.prepare('SELECT id FROM scheduled_sends WHERE idempotency_key = ?').get(idempKey);
    if (existing) continue;

    // One lesson per SLOT per day: only skip if this exact slot (same start time)
    // already has a lesson today. Different slots of the same group are separate
    // lessons.
    const slotDone = db.prepare(
      "SELECT 1 FROM lessons WHERE group_id = ? AND date(occurred_at) = date('now') AND slot_time = ? LIMIT 1"
    ).get(sched.gid, sched.time);
    if (slotDone) {
      db.prepare(`INSERT OR IGNORE INTO scheduled_sends (type, group_id, message, scheduled_at, sent, idempotency_key)
        VALUES ('auto-lesson', ?, 'Skipped — slot already has a lesson today', datetime('now'), 1, ?)`).run(sched.gid, idempKey);
      continue;
    }

    db.prepare(`INSERT INTO scheduled_sends (type, group_id, message, scheduled_at, sent, idempotency_key)
      VALUES ('auto-lesson', ?, 'Auto lesson increment', datetime('now'), 1, ?)`).run(sched.gid, idempKey);

    const newLesson = sched.current_lesson_number + 1;
    const isoNow = now.toISOString();
    const students = db.prepare('SELECT * FROM students WHERE group_id = ? AND active = 1').all(sched.gid);

    db.transaction(() => {
      db.prepare("UPDATE groups SET current_lesson_number = ?, updated_at = datetime('now') WHERE id = ?").run(newLesson, sched.gid);
      const stmtL = db.prepare('INSERT INTO lessons (group_id, student_id, lesson_number, occurred_at, slot_time) VALUES (?, ?, ?, ?, ?)');
      for (const s of students) stmtL.run(sched.gid, s.id, newLesson, isoNow, sched.time);
      // Derive counters from lesson rows (never increment) so they stay correct
      // no matter how attendance is later edited.
      for (const s of students) db.recomputeLessonsSincePayment(s.id);
      const cycle = parseInt(getSetting('payment_cycle_lessons') || '8', 10);
      db.prepare(`UPDATE students SET payment_status = 'due' WHERE group_id = ? AND active = 1 AND payment_status = 'paid' AND lessons_since_payment >= ?`)
        .run(sched.gid, cycle);
    })();

    // After the lesson's duration ends, send homework at a random human-like time.
    scheduleHomeworkAfterLesson(sched.gid, newLesson, sched.time);

    console.log(`[Scheduler] Auto-lesson #${newLesson} (${sched.time}) for ${sched.group_name}`);
  }
}

// ─── Homework auto-send ─────────────────────────────────────────
function scheduleHomeworkAfterLesson(groupId, lessonNumber, lessonTime) {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group || !group.homework_enabled) return;
  const hwNum = (group.homework_start_from || 1) + lessonNumber - 1;
  const hw = db.prepare('SELECT * FROM homeworks WHERE homework_number = ?').get(hwNum);
  if (!hw) return;
  const already = db.prepare('SELECT id FROM homework_sends WHERE homework_id = ? AND group_id = ?').get(hw.id, groupId);
  if (already) return;

  // Send after the lesson's duration ends, then at a random human-like time
  // (not a fixed offset): duration + a random 10–90 min. The send itself is also
  // gated to daytime hours inside sendHomework().
  const duration = group.lesson_duration_minutes || 60;
  const randomAfter = 10 + Math.random() * 80;
  const delayMs = (duration + randomAfter) * 60 * 1000;
  const sendAt = new Date(Date.now() + delayMs);

  console.log(`[Scheduler] Homework #${hwNum} for group ${groupId} (${duration}min lesson) scheduled ~${sendAt.toLocaleTimeString()}`);

  setTimeout(() => {
    sendHomework(groupId, hw.id, hwNum).catch(e => console.error('[Scheduler] Homework send error:', e.message));
  }, delayMs);
}

async function sendHomework(groupId, hwId, homeworkNumber) {
  const hw = db.prepare('SELECT * FROM homeworks WHERE id = ?').get(hwId);
  if (!hw) return;
  const already = db.prepare('SELECT id FROM homework_sends WHERE homework_id = ? AND group_id = ?').get(hwId, groupId);
  if (already) return;

  // Human behaviour: defer to the next daytime window instead of sending at night.
  if (!withinSendWindow()) {
    setTimeout(() => {
      sendHomework(groupId, hwId, homeworkNumber).catch(e => console.error('[Scheduler] Homework retry error:', e.message));
    }, 15 * 60 * 1000);
    return;
  }

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group?.whatsapp_group_id || wa.getStatus().status !== 'ready') {
    wa.logSend('homework', `group:${groupId}`, group?.name || '', `Homework #${homeworkNumber} — WhatsApp not connected`, 'failed', 'Not connected');
    return;
  }

  const chatId = group.whatsapp_group_id;

  try {
    if (hw.type === 'text') {
      const msg = hw.caption ? `${hw.caption}\n\n${hw.content}` : hw.content;
      await wa.sendMessage(chatId, `📚 Homework\n\n${msg}`);
    } else if (hw.type === 'link') {
      const msg = hw.caption ? `📚 Homework\n\n${hw.caption}\n${hw.content}` : `📚 Homework\n\n${hw.content}`;
      await wa.sendMessage(chatId, msg);
    } else {
      const cap = hw.caption || `📚 Homework: ${hw.original_name}`;
      await wa.sendFile(chatId, hw.file_path, cap);
    }

    // homework_sends has (homework_id, group_id, sent_at) — sent_at is NOT NULL.
    // Recording the send is what stops it being sent again, so it must not throw.
    db.prepare("INSERT OR IGNORE INTO homework_sends (homework_id, group_id, sent_at) VALUES (?, ?, datetime('now'))").run(hw.id, groupId);
    wa.logSend('homework', `group:${groupId}`, group.name, `Homework #${homeworkNumber} sent (${hw.type})`, 'success', null);
  } catch (e) {
    wa.logSend('homework', `group:${groupId}`, group.name, `Homework #${homeworkNumber} failed`, 'failed', e.message);
  }
}

// Also support manual trigger (from "lesson done" button)
function sendHomeworkForLesson(groupId, lessonNumber) {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group || !group.homework_enabled) return;
  // Map group lesson to global homework number
  const hwNum = (group.homework_start_from || 1) + lessonNumber - 1;
  const hw = db.prepare('SELECT * FROM homeworks WHERE homework_number = ?').get(hwNum);
  if (!hw) return;
  // Check if already sent to this group
  const already = db.prepare('SELECT id FROM homework_sends WHERE homework_id = ? AND group_id = ?').get(hw.id, groupId);
  if (already) return;
  // 1-3 min delay after manual lesson-done
  const delayMs = (1 + Math.random() * 2) * 60 * 1000;
  console.log(`[Scheduler] Manual lesson done — homework #${hwNum} for group ${groupId} in ~${Math.round(delayMs/1000)}s`);
  setTimeout(() => { sendHomework(groupId, hw.id, hwNum); }, delayMs);
}

// ─── Payment reminders ──────────────────────────────────────────
function checkPaymentReminders() {
  const cycle = parseInt(getSetting('payment_cycle_lessons') || '8', 10);
  const reminderDaysStr = getSetting('payment_reminder_days') || '3,7';
  const reminderDays = reminderDaysStr.split(',').map(Number);

  // Mark students as 'due' if they reached the cycle but are still 'paid'
  db.prepare(`UPDATE students SET payment_status = 'due', updated_at = datetime('now')
    WHERE active = 1 AND payment_status = 'paid' AND lessons_since_payment >= ?`).run(cycle);

  // Check delayed students — if delay period expired, set back to 'due' and send reminder
  const delayedExpired = db.prepare(`SELECT s.*, g.whatsapp_group_id, g.name as group_name
    FROM students s LEFT JOIN groups g ON s.group_id = g.id
    WHERE s.active = 1 AND s.payment_status = 'delayed' AND s.payment_delay_until <= datetime('now')`).all();
  for (const student of delayedExpired) {
    db.prepare("UPDATE students SET payment_status = 'due', payment_delay_until = NULL, updated_at = datetime('now') WHERE id = ?").run(student.id);
    sendPaymentReminder(student, 1);
  }

  // All students who need attention (due or overdue, NOT delayed)
  const dueStudents = db.prepare(`SELECT s.*, g.whatsapp_group_id, g.name as group_name
    FROM students s LEFT JOIN groups g ON s.group_id = g.id
    WHERE s.active = 1 AND s.lessons_since_payment >= ? AND s.payment_status IN ('due', 'overdue')`).all(cycle);

  for (const student of dueStudents) {
    const lastReminder = db.prepare('SELECT * FROM payment_reminders WHERE student_id = ? ORDER BY sent_at DESC LIMIT 1').get(student.id);
    const reminderCount = lastReminder?.reminder_number || 0;

    if (reminderCount >= reminderDays.length + 1) {
      if (student.payment_status !== 'overdue') {
        db.prepare("UPDATE students SET payment_status = 'overdue', updated_at = datetime('now') WHERE id = ?").run(student.id);
      }
      continue;
    }

    if (reminderCount === 0) {
      sendPaymentReminder(student, 1);
      continue;
    }

    if (lastReminder) {
      const daysSince = (Date.now() - new Date(lastReminder.sent_at).getTime()) / (1000 * 60 * 60 * 24);
      const nextDayThreshold = reminderDays[reminderCount - 1] || reminderDays[reminderDays.length - 1];
      if (daysSince >= nextDayThreshold) {
        sendPaymentReminder(student, reminderCount + 1);
      }
    }
  }
}

// Once a student is more than OVERDUE_WARN_AT lessons past their payment cycle
// with no reason recorded, warn that lessons will stop if it is not settled
// within the next two lessons. Sent once per overdue count.
const OVERDUE_WARN_AT = 2;
async function checkOverdueWarnings() {
  const cycle = parseInt(getSetting('payment_cycle_lessons') || '8', 10);
  const rows = db.prepare(`
    SELECT * FROM students
    WHERE active = 1
      AND lessons_since_payment > ?
      AND (payment_excuse_reason IS NULL OR payment_excuse_reason = '')
  `).all(cycle + OVERDUE_WARN_AT);

  for (const s of rows) {
    if (s.overdue_warned_at_lessons === s.lessons_since_payment) continue;
    const over = s.lessons_since_payment - cycle;
    const message =
      `⚠️ ${s.name} ${s.surname} — ödəniş gecikir\n\n` +
      `Ödənişsiz keçilən dərs sayı: ${over}.\n` +
      `Əgər növbəti 2 dərs ərzində ödəniş tamamlanmasa və ya keçərli bir səbəb bildirilməsə, ` +
      `dərsləriniz müvəqqəti dayandırılacaq.\n\nAnlayışınız üçün təşəkkür edirik.`;
    const target = s.parent_whatsapp || s.whatsapp_number;
    if (target && withinSendWindow() && wa.getStatus().status === 'ready') {
      try {
        await wa.sendToNumber(target, message);
        wa.logSend('payment', `student:${s.id}`, `${s.name} ${s.surname}`, message, 'success', null);
        db.prepare('UPDATE students SET overdue_warned_at_lessons = ? WHERE id = ?').run(s.lessons_since_payment, s.id);
      } catch (e) {
        wa.logSend('payment', `student:${s.id}`, `${s.name} ${s.surname}`, message, 'failed', e.message);
      }
    }
  }
}

// Called immediately after lesson-done
function checkPaymentForGroup(groupId) {
  const cycle = parseInt(getSetting('payment_cycle_lessons') || '8', 10);

  const students = db.prepare(`SELECT s.*, g.whatsapp_group_id, g.name as group_name
    FROM students s LEFT JOIN groups g ON s.group_id = g.id
    WHERE s.group_id = ? AND s.active = 1`).all(groupId);

  for (const student of students) {
    // Check if lessons_since_payment is exactly at a cycle boundary (8, 16, 24...)
    if (student.lessons_since_payment >= cycle && student.lessons_since_payment % cycle === 0) {
      // Mark as due if currently paid
      if (student.payment_status === 'paid') {
        db.prepare("UPDATE students SET payment_status = 'due', updated_at = datetime('now') WHERE id = ?").run(student.id);
      }
      // Send reminder if we haven't sent one for this exact lesson count
      const idempKey = `payment-${student.id}-lessons-${student.lessons_since_payment}`;
      const existing = db.prepare('SELECT id FROM scheduled_sends WHERE idempotency_key = ?').get(idempKey);
      if (!existing) {
        sendPaymentReminder(student, 1);
      }
    }
    // Also mark due if past cycle and still paid
    else if (student.lessons_since_payment >= cycle && student.payment_status === 'paid') {
      db.prepare("UPDATE students SET payment_status = 'due', updated_at = datetime('now') WHERE id = ?").run(student.id);
    }
  }
}

// Never rejects: callers fire-and-forget this from cron/route paths, where an
// unhandled rejection would otherwise take the process down.
async function sendPaymentReminder(student, reminderNumber) {
  try {
    await _sendPaymentReminder(student, reminderNumber);
  } catch (e) {
    console.error('[Scheduler] Payment reminder error:', e.message);
  }
}

async function _sendPaymentReminder(student, reminderNumber) {
  // Human behaviour: never message outside daytime hours; retry next cycle.
  if (!withinSendWindow()) return;
  const idempKey = `payment-${student.id}-${reminderNumber}-${new Date().toISOString().slice(0, 10)}`;
  const existing = db.prepare('SELECT id FROM scheduled_sends WHERE idempotency_key = ?').get(idempKey);
  if (existing) return;

  const paymentInstructions = getSetting('payment_instructions') || '';
  const instrBlock = paymentInstructions ? `\n\n${paymentInstructions}` : '';
  const amountText = student.payment_amount ? `\n💵 Amount: ${student.payment_amount} AZN` : '';
  const message = reminderNumber === 1
    ? `💰 Payment reminder for ${student.name} ${student.surname}: ${student.lessons_since_payment} lessons completed since last payment.${amountText}\n\nPlease arrange payment at your convenience.${instrBlock}`
    : `💰 Follow-up reminder (#${reminderNumber}) for ${student.name} ${student.surname}: Payment is still pending for ${student.lessons_since_payment} lessons.${amountText}${instrBlock}`;

  db.prepare(`INSERT INTO scheduled_sends (type, student_id, message, scheduled_at, sent, idempotency_key)
    VALUES ('payment', ?, ?, datetime('now'), 0, ?)`).run(student.id, message, idempKey);

  const target = student.parent_whatsapp || student.whatsapp_number;
  if (target && wa.getStatus().status === 'ready') {
    try {
      await wa.sendToNumber(target, message);
      db.prepare("UPDATE scheduled_sends SET sent = 1, sent_at = datetime('now') WHERE idempotency_key = ?").run(idempKey);
      wa.logSend('payment', `student:${student.id}`, `${student.name} ${student.surname}`, message, 'success', null);
    } catch (e) {
      db.prepare("UPDATE scheduled_sends SET error = ? WHERE idempotency_key = ?").run(e.message, idempKey);
      wa.logSend('payment', `student:${student.id}`, `${student.name} ${student.surname}`, message, 'failed', e.message);
    }
  }

  db.prepare("INSERT INTO payment_reminders (student_id, reminder_number, sent_at) VALUES (?, ?, datetime('now'))").run(student.id, reminderNumber);
}

// ─── Scheduled one-off sends ────────────────────────────────────
let processingSends = false;
async function processScheduledSends() {
  // Human behaviour: only during daytime, and one message at a time with a gap
  // between them (never a burst).
  if (processingSends || !withinSendWindow()) return;
  const pending = db.prepare(`SELECT * FROM scheduled_sends WHERE sent = 0 AND scheduled_at <= datetime('now') AND type IN ('homework', 'custom') ORDER BY scheduled_at`).all();
  if (!pending.length) return;

  processingSends = true;
  try {
    for (const item of pending) {
      if (wa.getStatus().status !== 'ready' || !withinSendWindow()) break;
      try {
        if (item.file_path) {
          await wa.sendFile(item.target_chat_id, item.file_path, item.message);
        } else {
          await wa.sendMessage(item.target_chat_id, item.message);
        }
        db.prepare("UPDATE scheduled_sends SET sent = 1, sent_at = datetime('now') WHERE id = ?").run(item.id);
        wa.logSend(item.type, item.target_chat_id, '', item.message, 'success', null);
      } catch (e) {
        db.prepare("UPDATE scheduled_sends SET error = ? WHERE id = ?").run(e.message, item.id);
        wa.logSend(item.type, item.target_chat_id, '', item.message, 'failed', e.message);
      }
      // Spread-out gap between consecutive sends (20–45s).
      await new Promise(r => setTimeout(r, 20000 + Math.random() * 25000));
    }
  } finally {
    processingSends = false;
  }
}

// ─── Weekly report ──────────────────────────────────────────────
function generateWeeklyReport() {
  const reportDay = parseInt(getSetting('weekly_report_day') || '1', 10);
  const reportTime = getSetting('weekly_report_time') || '09:00';
  const now = new Date();

  if (now.getDay() !== reportDay) return;
  const [rh, rm] = reportTime.split(':').map(Number);
  if (now.getHours() !== rh || now.getMinutes() !== rm) return;

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const wsStr = weekStart.toISOString();
  const idempKey = `weekly-${now.toISOString().slice(0, 10)}`;
  const existing = db.prepare('SELECT id FROM weekly_reports WHERE week_start = ?').get(now.toISOString().slice(0, 10));
  if (existing) return;

  const totalActive = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE active = 1").get().cnt;
  const payDue = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'due' AND active = 1").get().cnt;
  const payOverdue = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE payment_status = 'overdue' AND active = 1").get().cnt;
  const newStudents = db.prepare(`SELECT COUNT(*) as cnt FROM students WHERE created_at >= ?`).get(wsStr).cnt;
  const lessonsCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM lessons WHERE occurred_at >= ?`).get(wsStr).cnt;
  const excused = db.prepare(`SELECT COUNT(*) as cnt FROM lessons WHERE is_excused = 1 AND occurred_at >= ?`).get(wsStr).cnt;
  const hwSent = db.prepare(`SELECT COUNT(*) as cnt FROM send_log WHERE type = 'homework' AND status = 'success' AND created_at >= ?`).get(wsStr).cnt;

  const report = { totalActive, payDue, payOverdue, newStudents, lessonsCount, excused, hwSent };
  db.prepare(`INSERT INTO weekly_reports (report_json, week_start, created_at) VALUES (?, ?, datetime('now'))`)
    .run(JSON.stringify(report), now.toISOString().slice(0, 10));

  const message = `📊 *Weekly Report — Cosmo Chess Academy*
━━━━━━━━━━━━━━━━━━
👥 Active students: ${totalActive}
🆕 New this week: ${newStudents}
📖 Lessons held: ${lessonsCount}
🙋 Excused absences: ${excused}
📚 Homeworks sent: ${hwSent}
💰 Payment due: ${payDue}
🔴 Overdue: ${payOverdue}
━━━━━━━━━━━━━━━━━━`;

  const teacherNumber = getSetting('teacher_whatsapp');
  if (teacherNumber && wa.getStatus().status === 'ready') {
    (async () => {
      try {
        await wa.sendToNumber(teacherNumber, message);
        db.prepare("UPDATE weekly_reports SET sent = 1, sent_at = datetime('now') WHERE week_start = ?").run(now.toISOString().slice(0, 10));
        wa.logSend('report', `teacher`, 'Weekly Report', message, 'success', null);
      } catch (e) {
        wa.logSend('report', `teacher`, 'Weekly Report', message, 'failed', e.message);
      }
    })();
  }
}

// ─── Start all cron jobs ────────────────────────────────────────
function start() {
  // Every minute: check reminders, auto-lessons, scheduled sends
  // NOTE: async functions must be .catch()'d — a sync try/catch does not catch
  // their rejections, which would surface as unhandled rejections.
  cron.schedule('* * * * *', () => {
    try { checkAutoLessons(); } catch (e) { console.error('[Scheduler] Auto-lesson error:', e.message); }
    Promise.resolve().then(processScheduledSends).catch(e => console.error('[Scheduler] Scheduled send error:', e.message));
  });

  // Every 15 minutes: check payment reminders and escalations
  cron.schedule('*/15 * * * *', () => {
    Promise.resolve().then(checkPaymentReminders).catch(e => console.error('[Scheduler] Payment reminder error:', e.message));
    Promise.resolve().then(checkOverdueWarnings).catch(e => console.error('[Scheduler] Overdue warning error:', e.message));
  });

  // Nightly: refresh Lichess/Chess.com ratings for students with a linked account
  cron.schedule('30 3 * * *', () => {
    require('./chessRatings').refreshAllStudents()
      .then(n => console.log(`[Scheduler] Refreshed ratings for ${n} students`))
      .catch(e => console.error('[Scheduler] Ratings refresh error:', e.message));
  });

  // Every minute (for weekly report — checks day/time internally)
  cron.schedule('* * * * *', () => {
    try { generateWeeklyReport(); } catch (e) { console.error('[Scheduler] Report error:', e.message); }
  });

  // Run payment check once on startup
  try { checkPaymentReminders(); } catch (e) { console.error('[Scheduler] Initial payment check error:', e.message); }

  console.log('[Scheduler] All cron jobs started');
}

module.exports = { start, sendHomeworkForLesson, checkPaymentForGroup };
