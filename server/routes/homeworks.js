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
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files allowed'));
}});

const r = Router();

// Get all homeworks for a group
r.get('/group/:groupId', (req, res) => {
  const rows = db.prepare('SELECT * FROM homeworks WHERE group_id = ? ORDER BY order_index').all(req.params.groupId);
  res.json(rows);
});

// Upload multiple homeworks for a group (bulk)
r.post('/group/:groupId/upload', upload.array('files', 50), (req, res) => {
  const groupId = req.params.groupId;
  const maxOrder = db.prepare('SELECT MAX(order_index) as mx FROM homeworks WHERE group_id = ?').get(groupId);
  let idx = (maxOrder?.mx || 0) + 1;
  const stmt = db.prepare(`INSERT INTO homeworks (group_id, lesson_number, filename, original_name, file_path, order_index) VALUES (?, ?, ?, ?, ?, ?)`);

  db.transaction(() => {
    for (const file of req.files) {
      stmt.run(groupId, idx, file.filename, file.originalname, file.path, idx);
      idx++;
    }
  })();

  res.status(201).json({ ok: true, count: req.files.length });
});

// Reorder homeworks
r.put('/group/:groupId/reorder', (req, res) => {
  const { order } = req.body; // array of homework ids in desired order
  const stmt = db.prepare('UPDATE homeworks SET order_index = ?, lesson_number = ? WHERE id = ? AND group_id = ?');
  db.transaction(() => {
    order.forEach((id, i) => {
      stmt.run(i + 1, i + 1, id, req.params.groupId);
    });
  })();
  res.json({ ok: true });
});

// Delete a homework
r.delete('/:id', (req, res) => {
  const hw = db.prepare('SELECT * FROM homeworks WHERE id = ?').get(req.params.id);
  if (hw && fs.existsSync(hw.file_path)) {
    try { fs.unlinkSync(hw.file_path); } catch (e) { /* ignore */ }
  }
  db.prepare('DELETE FROM homeworks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Schedule a one-off homework send
r.post('/schedule-send', (req, res) => {
  const { group_id, file_path, message, scheduled_at } = req.body;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const key = `hw-oneoff-${group_id}-${scheduled_at}`;
  db.prepare(`INSERT OR IGNORE INTO scheduled_sends (type, group_id, target_chat_id, message, file_path, scheduled_at, idempotency_key)
    VALUES ('homework', ?, ?, ?, ?, ?, ?)`).run(group_id, group.whatsapp_group_id, message || 'Homework', file_path, scheduled_at, key);
  res.status(201).json({ ok: true });
});

module.exports = r;
