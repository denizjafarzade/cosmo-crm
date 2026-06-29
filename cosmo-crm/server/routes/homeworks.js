const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'homeworks');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

const r = Router();

function nextNumber() {
  const row = db.prepare('SELECT MAX(homework_number) as mx FROM homeworks').get();
  return (row?.mx || 0) + 1;
}

// Get all homeworks (global list)
r.get('/', (req, res) => {
  const homeworks = db.prepare('SELECT * FROM homeworks ORDER BY homework_number').all();
  res.json(homeworks);
});

// Get homeworks with send status for a specific group
r.get('/for-group/:groupId', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const homeworks = db.prepare('SELECT * FROM homeworks ORDER BY homework_number').all();
  const sends = db.prepare('SELECT homework_id, sent_at FROM homework_sends WHERE group_id = ?').all(req.params.groupId);
  const sentMap = {};
  for (const s of sends) sentMap[s.homework_id] = s.sent_at;

  // This group's next homework number: homework_start_from + current_lesson_number
  const nextHwNum = group.homework_start_from + group.current_lesson_number;

  const result = homeworks.map(hw => ({
    ...hw,
    sent_to_group: !!sentMap[hw.id],
    sent_at: sentMap[hw.id] || null,
    is_next: hw.homework_number === nextHwNum,
    group_lesson: hw.homework_number >= group.homework_start_from
      ? hw.homework_number - group.homework_start_from + 1
      : null,
  }));

  res.json({ homeworks: result, homework_start_from: group.homework_start_from, current_lesson: group.current_lesson_number, next_homework: nextHwNum });
});

// Add text or link homework
r.post('/add', (req, res) => {
  const { type, content, caption } = req.body;
  if (!type || !content) return res.status(400).json({ error: 'Type and content required' });
  const num = nextNumber();
  db.prepare('INSERT INTO homeworks (homework_number, type, content, caption) VALUES (?, ?, ?, ?)')
    .run(num, type, content, caption || '');
  res.status(201).json({ ok: true, homework_number: num });
});

// Upload file/image homeworks (multiple)
r.post('/upload', upload.array('files', 50), (req, res) => {
  const caption = req.body.caption || '';
  let num = nextNumber();
  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const stmt = db.prepare('INSERT INTO homeworks (homework_number, type, filename, original_name, file_path, caption) VALUES (?, ?, ?, ?, ?, ?)');

  db.transaction(() => {
    for (const file of req.files) {
      const type = isImage(file.originalname) ? 'image' : 'file';
      stmt.run(num, type, file.filename, file.originalname, file.path, caption);
      num++;
    }
  })();

  res.status(201).json({ ok: true, count: req.files.length });
});

// Reorder homeworks (must be before /:id)
r.put('/reorder', (req, res) => {
  const { order } = req.body;
  const stmt = db.prepare('UPDATE homeworks SET homework_number = ? WHERE id = ?');
  db.transaction(() => {
    order.forEach((id, i) => stmt.run(i + 1, id));
  })();
  res.json({ ok: true });
});

// Update a homework
r.put('/:id', (req, res) => {
  const { content, caption } = req.body;
  db.prepare('UPDATE homeworks SET content = COALESCE(?, content), caption = COALESCE(?, caption) WHERE id = ?')
    .run(content, caption, req.params.id);
  res.json({ ok: true });
});

// Delete a homework
r.delete('/:id', (req, res) => {
  const hw = db.prepare('SELECT * FROM homeworks WHERE id = ?').get(req.params.id);
  if (hw && hw.file_path && fs.existsSync(hw.file_path)) {
    try { fs.unlinkSync(hw.file_path); } catch (e) { /* ignore */ }
  }
  db.prepare('DELETE FROM homeworks WHERE id = ?').run(req.params.id);
  // Re-number remaining homeworks
  const remaining = db.prepare('SELECT id FROM homeworks ORDER BY homework_number').all();
  const stmt = db.prepare('UPDATE homeworks SET homework_number = ? WHERE id = ?');
  db.transaction(() => {
    remaining.forEach((r, i) => stmt.run(i + 1, r.id));
  })();
  res.json({ ok: true });
});

module.exports = r;
