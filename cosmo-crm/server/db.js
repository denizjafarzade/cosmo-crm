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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL DEFAULT '',
    whatsapp_number TEXT,
    parent_whatsapp TEXT,
    level TEXT CHECK(level IN ('new_to_chess','beginner','intermediate','advanced','expert','not_sure')) DEFAULT 'beginner',
    fide_rating INTEGER,
    coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    lessons_since_payment INTEGER DEFAULT 0,
    payment_status TEXT CHECK(payment_status IN ('paid','due','overdue')) DEFAULT 'paid',
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
    homework_number INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'file',
    content TEXT,
    caption TEXT DEFAULT '',
    filename TEXT,
    original_name TEXT,
    file_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS homework_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sent_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
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
  CREATE INDEX IF NOT EXISTS idx_scheduled_sends_time ON scheduled_sends(scheduled_at, sent);
  CREATE INDEX IF NOT EXISTS idx_send_log_created ON send_log(created_at);
`);

// --- Migration: widen students.level CHECK constraint and add fide_rating column ---
// Needed for databases created before the "New to Chess / Expert / Not Sure" levels
// and the FIDE Rating field were introduced. SQLite can't ALTER a CHECK constraint,
// so the table is rebuilt when an old schema is detected.
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

const studentsTableDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='students'").get();
const needsLevelMigration = studentsTableDef && !studentsTableDef.sql.includes("'expert'");

if (needsLevelMigration) {
  const hadFideRating = columnExists('students', 'fide_rating');
  const migrate = db.transaction(() => {
    db.exec('ALTER TABLE students RENAME TO students_old');
    db.exec(`
      CREATE TABLE students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        surname TEXT NOT NULL DEFAULT '',
        whatsapp_number TEXT,
        parent_whatsapp TEXT,
        level TEXT CHECK(level IN ('new_to_chess','beginner','intermediate','advanced','expert','not_sure')) DEFAULT 'beginner',
        fide_rating INTEGER,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
        group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        lessons_since_payment INTEGER DEFAULT 0,
        payment_status TEXT CHECK(payment_status IN ('paid','due','overdue')) DEFAULT 'paid',
        notes TEXT DEFAULT '',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO students (id, name, surname, whatsapp_number, parent_whatsapp, level, fide_rating, coach_id, group_id, lessons_since_payment, payment_status, notes, active, created_at, updated_at)
      SELECT id, name, surname, whatsapp_number, parent_whatsapp, level, ${hadFideRating ? 'fide_rating' : 'NULL'}, coach_id, group_id, lessons_since_payment, payment_status, notes, active, created_at, updated_at
      FROM students_old
    `);
    db.exec('DROP TABLE students_old');
  });
  migrate();
} else if (!columnExists('students', 'fide_rating')) {
  db.exec('ALTER TABLE students ADD COLUMN fide_rating INTEGER');
}

// Indexes on students reference the table by name and survive a rebuild fine,
// but recreate them defensively in case this is the first run after migration.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id);
  CREATE INDEX IF NOT EXISTS idx_students_coach ON students(coach_id);
  CREATE INDEX IF NOT EXISTS idx_students_payment ON students(payment_status);
`);

// --- Migration: rebuild homeworks table if it uses the old schema ---
const hwTableDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='homeworks'").get();
if (hwTableDef && hwTableDef.sql.includes('group_id INTEGER NOT NULL')) {
  db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS homeworks');
    db.exec(`
      CREATE TABLE homeworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        homework_number INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'file',
        content TEXT,
        caption TEXT DEFAULT '',
        filename TEXT,
        original_name TEXT,
        file_path TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  })();
}

if (!columnExists('homework_sends', 'id') && !db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='homework_sends'").get()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS homework_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      sent_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(homework_id, group_id)
    )
  `);
}

// --- Migrations: add missing columns to existing tables ---
if (!columnExists('groups', 'homework_start_from')) {
  db.exec('ALTER TABLE groups ADD COLUMN homework_start_from INTEGER DEFAULT 1');
}
if (!columnExists('groups', 'homework_enabled')) {
  db.exec('ALTER TABLE groups ADD COLUMN homework_enabled INTEGER DEFAULT 1');
}
if (!columnExists('students', 'payment_delay_until')) {
  db.exec('ALTER TABLE students ADD COLUMN payment_delay_until TEXT');
}
if (!columnExists('students', 'suspended_until_lesson')) {
  db.exec('ALTER TABLE students ADD COLUMN suspended_until_lesson INTEGER DEFAULT NULL');
}

// --- Registrations table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    level TEXT,
    fide_rating INTEGER,
    message TEXT DEFAULT '',
    status TEXT CHECK(status IN ('new','contacted','enrolled','rejected')) DEFAULT 'new',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);
if (!columnExists('registrations', 'status')) {
  db.exec("ALTER TABLE registrations ADD COLUMN status TEXT DEFAULT 'new'");
}

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
  // CRM login. Password stored as a salted scrypt hash (scrypt$salt$hash), never plaintext.
  auth_username: process.env.AUTH_USERNAME || 'abdullashabanov',
  auth_password_hash: process.env.AUTH_PASSWORD_HASH || 'scrypt$94b739374428aef6b0b16ca5278e458a$69e1e47703974fb65e065e1265bfbbb5c8db28159920cc642670c65cd16eebde99fb4ee69e1973ab2f5c35ab15a5237e5e8fc56d2c21a8a7faada2f393985f90',
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
