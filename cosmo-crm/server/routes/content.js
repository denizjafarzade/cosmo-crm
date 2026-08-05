// Landing-page content (gallery + news) managed from the CRM.
// The public site still loads /news-data.js; that file is generated from these
// tables (see buildNewsDataJs), so the site's own code needs no changes.
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'content');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_RE = /\.(jpe?g|png|gif|webp|svg|avif)$/i;
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, IMAGE_RE.test(file.originalname)),
});

const r = Router();

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

// ─── Image upload (shared by gallery and news) ──────────────────
r.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An image file is required (jpg, png, gif, webp, svg, avif; max 8MB)' });
  res.json({ ok: true, path: `/uploads/content/${req.file.filename}` });
});

// ─── Gallery ────────────────────────────────────────────────────
r.get('/gallery', (req, res) => {
  res.json(db.prepare('SELECT * FROM gallery_items ORDER BY sort_order, id').all());
});

r.post('/gallery', (req, res) => {
  const { category, title, caption, image_path, alt, active } = req.body;
  const max = db.prepare('SELECT MAX(sort_order) AS m FROM gallery_items').get();
  const info = db.prepare(`INSERT INTO gallery_items (item_key, category, title, caption, image_path, alt, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    `g${Date.now()}`, category || 'training', title || '', caption || '',
    image_path || null, alt || '', (max?.m || 0) + 1, active === false ? 0 : 1);
  res.status(201).json({ id: info.lastInsertRowid });
});

r.put('/gallery/:id', (req, res) => {
  const { category, title, caption, image_path, alt, active, sort_order } = req.body;
  db.prepare(`UPDATE gallery_items SET
    category = COALESCE(?, category), title = COALESCE(?, title),
    caption = COALESCE(?, caption), image_path = COALESCE(?, image_path),
    alt = COALESCE(?, alt), active = COALESCE(?, active), sort_order = COALESCE(?, sort_order),
    updated_at = datetime('now') WHERE id = ?`)
    .run(category ?? null, title ?? null, caption ?? null, image_path ?? null, alt ?? null,
      active === undefined ? null : (active ? 1 : 0), sort_order ?? null, req.params.id);
  res.json({ ok: true });
});

r.delete('/gallery/:id', (req, res) => {
  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── News ───────────────────────────────────────────────────────
r.get('/news', (req, res) => {
  res.json(db.prepare('SELECT * FROM news_articles ORDER BY sort_order, date DESC, id DESC').all());
});

r.post('/news', (req, res) => {
  const { slug, category, date, title, excerpt, image_path, image_alt, body, related_gallery_filter, published } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  let s = slugify(slug || title) || `article-${Date.now()}`;
  if (db.prepare('SELECT 1 FROM news_articles WHERE slug = ?').get(s)) s = `${s}-${Date.now()}`;
  const max = db.prepare('SELECT MAX(sort_order) AS m FROM news_articles').get();
  const info = db.prepare(`INSERT INTO news_articles
    (slug, category, date, title, excerpt, image_path, image_alt, body, related_gallery_filter, published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    s, category || '', date || new Date().toISOString().slice(0, 10), title,
    excerpt || '', image_path || null, image_alt || '', body || '',
    related_gallery_filter || null, published === false ? 0 : 1, (max?.m || 0) + 1);
  res.status(201).json({ id: info.lastInsertRowid, slug: s });
});

r.put('/news/:id', (req, res) => {
  const { category, date, title, excerpt, image_path, image_alt, body, related_gallery_filter, published, sort_order } = req.body;
  db.prepare(`UPDATE news_articles SET
    category = COALESCE(?, category), date = COALESCE(?, date), title = COALESCE(?, title),
    excerpt = COALESCE(?, excerpt), image_path = COALESCE(?, image_path),
    image_alt = COALESCE(?, image_alt), body = COALESCE(?, body),
    related_gallery_filter = COALESCE(?, related_gallery_filter),
    published = COALESCE(?, published), sort_order = COALESCE(?, sort_order),
    updated_at = datetime('now') WHERE id = ?`)
    .run(category ?? null, date ?? null, title ?? null, excerpt ?? null, image_path ?? null,
      image_alt ?? null, body ?? null, related_gallery_filter ?? null,
      published === undefined ? null : (published ? 1 : 0), sort_order ?? null, req.params.id);
  res.json({ ok: true });
});

r.delete('/news/:id', (req, res) => {
  db.prepare('DELETE FROM news_articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = r;

// ─── Public news-data.js generation ─────────────────────────────
// Mirrors the shape the landing page already expects: var NEWS = [...]; var GALLERY = [...];
function buildNewsDataJs() {
  const news = db.prepare('SELECT * FROM news_articles WHERE published = 1 ORDER BY sort_order, date DESC, id DESC').all();
  const gallery = db.prepare('SELECT * FROM gallery_items WHERE active = 1 ORDER BY sort_order, id').all();

  const NEWS = news.map(n => ({
    slug: n.slug,
    category: n.category || '',
    date: n.date || '',
    title: n.title || '',
    excerpt: n.excerpt || '',
    image: n.image_path || '',
    imageAlt: n.image_alt || '',
    relatedGalleryFilter: n.related_gallery_filter || undefined,
    body: n.body || '',
  }));

  const GALLERY = gallery.map(g => ({
    id: g.item_key || `g${g.id}`,
    category: g.category || 'training',
    title: g.title || '',
    caption: g.caption || '',
    image: g.image_path || '',
    alt: g.alt || g.title || '',
  }));

  return `// Generated from the CRM — edit gallery and news in the CRM, not this file.\n`
    + `var NEWS = ${JSON.stringify(NEWS, null, 2)};\n\n`
    + `var GALLERY = ${JSON.stringify(GALLERY, null, 2)};\n`;
}

function hasManagedContent() {
  const n = db.prepare('SELECT COUNT(*) AS c FROM news_articles').get().c;
  const g = db.prepare('SELECT COUNT(*) AS c FROM gallery_items').get().c;
  return n > 0 || g > 0;
}

// One-off import of the bundled demo file into the DB, so existing gallery and
// news content becomes editable in the CRM instead of being lost. Runs only
// while both tables are still empty.
function importStaticContentOnce() {
  if (hasManagedContent()) return { imported: false, reason: 'content already present' };
  const file = path.join(__dirname, '..', '..', 'public', 'news-data.js');
  if (!fs.existsSync(file)) return { imported: false, reason: 'no news-data.js' };

  let NEWS = [], GALLERY = [];
  try {
    const vm = require('vm');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { timeout: 3000 });
    NEWS = Array.isArray(sandbox.NEWS) ? sandbox.NEWS : [];
    GALLERY = Array.isArray(sandbox.GALLERY) ? sandbox.GALLERY : [];
  } catch (e) {
    console.error('[Content] Could not parse news-data.js:', e.message);
    return { imported: false, reason: e.message };
  }

  const insG = db.prepare(`INSERT OR IGNORE INTO gallery_items
    (item_key, category, title, caption, image_path, alt, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
  const insN = db.prepare(`INSERT OR IGNORE INTO news_articles
    (slug, category, date, title, excerpt, image_path, image_alt, body, related_gallery_filter, published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);

  db.transaction(() => {
    GALLERY.forEach((g, i) => insG.run(g.id || `g${i + 1}`, g.category || 'training', g.title || '',
      g.caption || '', g.image || null, g.alt || g.title || '', i + 1));
    NEWS.forEach((n, i) => insN.run(n.slug || `article-${i + 1}`, n.category || '', n.date || '',
      n.title || '', n.excerpt || '', n.image || null, n.imageAlt || '', n.body || '',
      n.relatedGalleryFilter || null, i + 1));
  })();

  console.log(`[Content] Imported ${GALLERY.length} gallery items and ${NEWS.length} articles into the CRM`);
  return { imported: true, gallery: GALLERY.length, news: NEWS.length };
}

// Manual re-import (only works while the tables are empty).
r.post('/import-demo', (req, res) => res.json(importStaticContentOnce()));

module.exports.buildNewsDataJs = buildNewsDataJs;
module.exports.hasManagedContent = hasManagedContent;
module.exports.importStaticContentOnce = importStaticContentOnce;
