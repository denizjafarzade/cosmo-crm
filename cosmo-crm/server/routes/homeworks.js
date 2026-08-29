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

// Each group owns its own homework queue, numbered from 1 — lesson N sends
// that group's homework #N. No shared list, no per-group start offset.
function nextNumber(groupId) {
  const row = db.prepare('SELECT MAX(homework_number) as mx FROM homeworks WHERE group_id = ?').get(groupId);
  return (row?.mx || 0) + 1;
}

function renumber(groupId) {
  const remaining = db.prepare('SELECT id FROM homeworks WHERE group_id = ? ORDER BY homework_number').all(groupId);
  const stmt = db.prepare('UPDATE homeworks SET homework_number = ? WHERE id = ?');
  db.transaction(() => { remaining.forEach((row, i) => stmt.run(i + 1, row.id)); })();
}

// Get a group's homework queue, with send status against that group.
r.get('/group/:groupId', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const homeworks = db.prepare('SELECT * FROM homeworks WHERE group_id = ? ORDER BY homework_number').all(req.params.groupId);
  const sends = db.prepare('SELECT homework_id, sent_at FROM homework_sends WHERE group_id = ?').all(req.params.groupId);
  const sentMap = {};
  for (const s of sends) sentMap[s.homework_id] = s.sent_at;

  const nextHwNum = group.current_lesson_number + 1;
  const result = homeworks.map(hw => ({
    ...hw,
    sent_to_group: !!sentMap[hw.id],
    sent_at: sentMap[hw.id] || null,
    is_next: hw.homework_number === nextHwNum,
  }));

  res.json({ homeworks: result, current_lesson: group.current_lesson_number, next_homework: nextHwNum });
});

// Add a text or link homework to a group's queue.
r.post('/group/:groupId/add', (req, res) => {
  const groupId = req.params.groupId;
  const { type, content, caption } = req.body;
  if (!type || !content) return res.status(400).json({ error: 'Type and content required' });
  const num = nextNumber(groupId);
  db.prepare('INSERT INTO homeworks (group_id, homework_number, type, content, caption) VALUES (?, ?, ?, ?, ?)')
    .run(groupId, num, type, content, caption || '');
  res.status(201).json({ ok: true, homework_number: num });
});

// Upload file/image homeworks (multiple) to a group's queue.
r.post('/group/:groupId/upload', upload.array('files', 50), (req, res) => {
  const groupId = req.params.groupId;
  const caption = req.body.caption || '';
  let num = nextNumber(groupId);
  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const stmt = db.prepare('INSERT INTO homeworks (group_id, homework_number, type, filename, original_name, file_path, caption) VALUES (?, ?, ?, ?, ?, ?, ?)');

  db.transaction(() => {
    for (const file of req.files) {
      const type = isImage(file.originalname) ? 'image' : 'file';
      stmt.run(groupId, num, type, file.filename, file.originalname, file.path, caption);
      num++;
    }
  })();

  res.status(201).json({ ok: true, count: req.files.length });
});

// Reorder a group's queue (must be before /:id).
r.put('/group/:groupId/reorder', (req, res) => {
  const { order } = req.body;
  const stmt = db.prepare('UPDATE homeworks SET homework_number = ? WHERE id = ? AND group_id = ?');
  db.transaction(() => {
    order.forEach((id, i) => stmt.run(i + 1, id, req.params.groupId));
  })();
  res.json({ ok: true });
});

// Update a homework's content/caption.
r.put('/:id', (req, res) => {
  const { content, caption } = req.body;
  db.prepare('UPDATE homeworks SET content = COALESCE(?, content), caption = COALESCE(?, caption) WHERE id = ?')
    .run(content, caption, req.params.id);
  res.json({ ok: true });
});

// Delete a homework and renumber the rest of its own group's queue.
r.delete('/:id', (req, res) => {
  const hw = db.prepare('SELECT * FROM homeworks WHERE id = ?').get(req.params.id);
  if (!hw) return res.json({ ok: true });
  if (hw.file_path && fs.existsSync(hw.file_path)) {
    try { fs.unlinkSync(hw.file_path); } catch (e) { /* ignore */ }
  }
  db.prepare('DELETE FROM homeworks WHERE id = ?').run(req.params.id);
  if (hw.group_id) renumber(hw.group_id);
  res.json({ ok: true });
});

module.exports = r;
