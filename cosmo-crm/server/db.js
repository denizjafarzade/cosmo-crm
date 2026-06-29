const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'cosmo.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    whatsapp_number TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    whatsapp_group_id TEXT,
    whatsapp_group_name TEXT,
    coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
    current_lesson_number INTEGER DEFAULT 0,
    auto_increment_lessons INTEGER DEFAULT 0,
    reminder_minutes_before INTEGER DEFAULT 60,
    reminder_target TEXT DEFAULT 'group',
    homework_start_from INTEGER DEFAULT 1,
    homework_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL DEFAULT '',
    whatsapp_number TEXT,
    parent_whatsapp TEXT,
    level TEXT CHECK(level IN ('beginner','intermediate','advanced')) DEFAULT 'beginner',
    coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    lessons_since_payment INTEGER DEFAULT 0,
    payment_status TEXT CHECK(payment_status IN ('paid','due','overdue','delayed')) DEFAULT 'paid',
    payment_amount REAL DEFAULT 0,
    payment_delay_until TEXT,
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    time TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    lesson_number INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    is_excused INTEGER DEFAULT 0,
    counts_toward_payment INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS homeworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_number INTEGER NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'file' CHECK(type IN ('file','image','text','link')),
    content TEXT DEFAULT '',
    filename TEXT,
    original_name TEXT,
    file_path TEXT,
    caption TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS homework_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    lesson_number INTEGER NOT NULL,
    sent_at TEXT DEFAULT (datetime('now')),
    UNIQUE(homework_id, group_id)
  );

  CREATE TABLE IF NOT EXISTS scheduled_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    target_chat_id TEXT,
    message TEXT,
    file_path TEXT,
    scheduled_at TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    sent_at TEXT,
    error TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reminder_number INTEGER DEFAULT 1,
    sent_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount REAL,
    lessons_covered INTEGER,
    confirmed_at TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS send_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    target TEXT,
    target_name TEXT,
    message TEXT,
    status TEXT CHECK(status IN ('success','failed','pending')) DEFAULT 'pending',
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_json TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    sent_at TEXT,
    week_start TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id);
  CREATE INDEX IF NOT EXISTS idx_students_coach ON students(coach_id);
  CREATE INDEX IF NOT EXISTS idx_students_payment ON students(payment_status);
  CREATE INDEX IF NOT EXISTS idx_lessons_group ON lessons(group_id);
  CREATE INDEX IF NOT EXISTS idx_lessons_student ON lessons(student_id);
  CREATE INDEX IF NOT EXISTS idx_homeworks_number ON homeworks(homework_number);
  CREATE INDEX IF NOT EXISTS idx_homework_sends_group ON homework_sends(group_id);
  CREATE INDEX IF NOT EXISTS idx_scheduled_sends_time ON scheduled_sends(scheduled_at, sent);
  CREATE INDEX IF NOT EXISTS idx_send_log_created ON send_log(created_at);
`);

// Insert default settings if not present
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
const defaults = {
  timezone: process.env.TIMEZONE || 'Asia/Baku',
  teacher_whatsapp: process.env.TEACHER_WHATSAPP || '',
  payment_cycle_lessons: process.env.PAYMENT_CYCLE_LESSONS || '8',
  payment_reminder_days: process.env.PAYMENT_REMINDER_DAYS || '3,7',
  default_reminder_minutes: process.env.DEFAULT_REMINDER_MINUTES || '60',
  weekly_report_day: '1',
  weekly_report_time: '09:00',
  excused_absence_limit_per_month: '1',
  payment_instructions: 'Please transfer to:\nDeniz\nBank: ...\nIBAN: ...\nAmount: ... AZN',
};

const insertDefaults = db.transaction(() => {
  for (const [k, v] of Object.entries(defaults)) {
    insertSetting.run(k, v);
  }
});
insertDefaults();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

module.exports = db;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
