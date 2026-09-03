// One-off maintenance script: clears operational stats while keeping
// students and groups intact. Run with `node server/reset-stats.js`
// from the cosmo-crm/ directory. Takes a timestamped backup of the
// database file first.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'cosmo.db');
const BACKUP_PATH = DB_PATH.replace(/\.db$/, `.backup-${Date.now()}.db`);

fs.copyFileSync(DB_PATH, BACKUP_PATH);
console.log('Backup written to', BACKUP_PATH);

const db = new Database(DB_PATH);

const tx = db.transaction(() => {
  db.prepare('DELETE FROM payments').run();
  db.prepare('DELETE FROM lessons').run();
  db.prepare('DELETE FROM lesson_cancellations').run();
  db.prepare('DELETE FROM payment_reminders').run();
  db.prepare('DELETE FROM send_log').run();
  db.prepare('DELETE FROM registrations').run();

  db.prepare(`
    UPDATE students SET
      lessons_since_payment = 0,
      lessons_adjustment = 0,
      payment_status = 'paid',
      payment_excuse_reason = NULL,
      overdue_warned_at_lessons = NULL,
      payment_delay_until = NULL,
      suspended_until_lesson = NULL,
      updated_at = datetime('now')
  `).run();

  db.prepare(`UPDATE groups SET current_lesson_number = 0, updated_at = datetime('now')`).run();

  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN
    ('payments','lessons','lesson_cancellations','payment_reminders','send_log','registrations')`).run();
});

tx();

console.log('Reset complete. Students and groups were left untouched (names, contacts, ratings, schedules, coach assignments).');
db.close();
