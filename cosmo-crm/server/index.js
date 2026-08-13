const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// libsignal (bundled inside Baileys) writes decryption noise straight to the
// console: "Bad MAC" session errors and full SessionEntry dumps containing key
// buffers. Baileys handles them internally — they only bloat server.log and
// bury the lines that matter. Drop exactly those, nothing else.
{
  const NOISE = /^(Closing session:|Session error:|Removing old closed session:|SessionEntry |Failed to decrypt)/;
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      if (typeof args[0] === 'string' && NOISE.test(args[0])) return;
      original(...args);
    };
  }
}

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

// SIGHUP is delivered when the launching terminal/SSH session goes away.
// `nohup` protects against it by setting the signal to "ignore", but registering
// ANY handler replaces that disposition — so handling it here and exiting would
// kill the server the moment the operator closes their SSH session. Log and stay
// up instead; only SIGTERM/SIGINT (a deliberate stop) end the process.
process.on('SIGHUP', () => console.error('[Process] SIGHUP received (terminal closed) — staying up'));
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { console.error(`[Process] Received ${sig} — shutting down`); process.exit(0); });
}

// Periodic heartbeat so a slow memory climb is visible in server.log before the
// kernel OOM-killer steps in (which nginx surfaces as 502).
setInterval(() => {
  const m = process.memoryUsage();
  const mb = (v) => Math.round(v / 1048576);
  console.log(`[Health] uptime=${Math.round(process.uptime() / 60)}min rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB`);
}, 30 * 60 * 1000).unref();

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
app.use('/api/content', require('./routes/content'));

// Public pages
const publicDir = path.join(__dirname, '..', 'public');
app.use('/img', express.static(path.join(publicDir, 'img')));
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/news', (req, res) => res.sendFile(path.join(publicDir, 'news.html')));
app.get('/news-article', (req, res) => res.sendFile(path.join(publicDir, 'news-article.html')));
// Serve gallery/news from the CRM once any content has been added there;
// otherwise fall back to the bundled demo file.
app.get('/news-data.js', (req, res) => {
  try {
    const content = require('./routes/content');
    if (content.hasManagedContent()) {
      res.type('application/javascript').set('Cache-Control', 'no-cache');
      return res.send(content.buildNewsDataJs());
    }
  } catch (e) {
    console.error('[Server] news-data.js generation failed:', e.message);
  }
  res.sendFile(path.join(publicDir, 'news-data.js'));
});

// CRM dashboard at /crm (React SPA — static assets then SPA fallback)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
// Build assets carry a content hash, so they can be cached hard. The SPA shell
// must NOT be cached: a stale index.html points at asset filenames that no
// longer exist after a rebuild, which the browser shows as a blank white page.
app.use('/crm', express.static(clientDist, {
  index: false,
  setHeaders: (res, filePath) => {
    if (/\.(js|css|woff2?|png|jpe?g|svg|gif|webp|avif)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
app.get(/^\/crm(?:\/.*)?$/, (req, res) => {
  const shell = path.join(clientDist, 'index.html');
  if (!fs.existsSync(shell)) {
    return res.status(503).type('html').send(
      '<h1>CRM not built</h1><p>Run <code>cd client &amp;&amp; npm run build</code> on the server, then restart.</p>'
    );
  }
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(shell);
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

  // Make the bundled gallery/news content editable in the CRM on first boot.
  try {
    require('./routes/content').importStaticContentOnce();
  } catch (e) {
    console.error('[Server] Content import failed:', e.message);
  }

  // Start scheduler
  try {
    require('./services/scheduler').start();
  } catch (e) {
    console.error('[Server] Scheduler start failed:', e.message);
  }
});

server.on('error', (e) => console.error('[Server] Listen error:', e.message));
