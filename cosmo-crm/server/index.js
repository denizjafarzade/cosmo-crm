const express = require('express');
const cors = require('cors');
const path = require('path');

// Never let an async error from the WhatsApp/puppeteer stack crash the whole
// server (which would 502 the site). Log and keep running.
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', (reason && reason.stack) || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', (err && err.stack) || err);
});
// If the process ever does go down, record why — a silent exit is what surfaces
// to users as a 502 Bad Gateway from nginx.
process.on('exit', (code) => console.error(`[Process] Exiting with code ${code} at ${new Date().toISOString()}`));
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => { console.error(`[Process] Received ${sig}`); process.exit(0); });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Auth (login is public; everything else under /api requires a valid token)
const { router: authRouter, requireAuth } = require('./auth');
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

// API routes
app.use('/api/coaches', require('./routes/coaches'));
app.use('/api/students', require('./routes/students'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/homeworks', require('./routes/homeworks'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/registrations', require('./routes/registrations'));

// Public pages
const publicDir = path.join(__dirname, '..', 'public');
app.use('/img', express.static(path.join(publicDir, 'img')));
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/news', (req, res) => res.sendFile(path.join(publicDir, 'news.html')));
app.get('/news-article', (req, res) => res.sendFile(path.join(publicDir, 'news-article.html')));
app.get('/news-data.js', (req, res) => res.sendFile(path.join(publicDir, 'news-data.js')));

// CRM dashboard at /crm (React SPA — static assets then SPA fallback)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use('/crm', express.static(clientDist, { index: false }));
app.get(/^\/crm(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Any error thrown in a route lands here as JSON instead of a dead connection.
app.use((err, req, res, next) => {
  console.error(`[Server] Error on ${req.method} ${req.originalUrl}:`, (err && err.stack) || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: (err && err.message) || 'Internal error' });
});

const server = app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);

  // Initialize WhatsApp — must never take the HTTP server down with it.
  try {
    const wa = require('./services/whatsapp');
    Promise.resolve(wa.init()).catch(e => console.error('[Server] WhatsApp init failed:', e.message));
  } catch (e) {
    console.error('[Server] WhatsApp init failed:', e.message);
  }

  // Start scheduler
  try {
    require('./services/scheduler').start();
  } catch (e) {
    console.error('[Server] Scheduler start failed:', e.message);
  }
});

server.on('error', (e) => console.error('[Server] Listen error:', e.message));
