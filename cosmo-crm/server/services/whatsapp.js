// WhatsApp integration built on Baileys (WhatsApp's real multi-device protocol,
// no Chrome/puppeteer). Chosen because whatsapp-web.js's DOM scraping breaks on
// current WhatsApp Web and can't reliably list groups. Baileys exposes
// groupFetchAllParticipating() which returns every group's id + name directly.
//
// The module keeps the same public interface the rest of the app expects:
// init, getStatus, getClient, refreshGroups, sendMessage, sendFile,
// sendToNumber, sendFileToNumber, logSend, destroy, disconnect, randomDelay.

const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const AUTH_DIR = path.join(__dirname, '..', '..', '.baileys_auth');

let sock = null;
let starting = false;
// Every init() claims a generation. Events from an older socket are ignored, so
// an orphaned connection can never clobber the live one's state.
let generation = 0;
let reconnectTimer = null;
let reconnectAttempts = 0;
let qrDataUrl = null;
let status = 'disconnected'; // disconnected | qr | connecting | ready | error
let statusError = null;
let cachedGroups = [];
let lastGroupRefresh = 0;
let lastGroupError = null;

// Minimal logger with the pino-ish interface Baileys expects (avoids a pino dep).
const silentLogger = {
  level: 'silent',
  child() { return silentLogger; },
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
};

function logSend(type, target, targetName, message, sendStatus, error) {
  db.prepare(`INSERT INTO send_log (type, target, target_name, message, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(type, target, targetName, message?.substring(0, 500), sendStatus, error || null);
}

function randomDelay(minMs = 4000, maxMs = 9000) {
  return new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

// Normalize a chat id to a Baileys JID.
// Groups: ...@g.us (unchanged). Users: number@s.whatsapp.net (convert legacy @c.us).
function toJid(id) {
  if (!id) return id;
  if (id.endsWith('@g.us') || id.endsWith('@s.whatsapp.net')) return id;
  if (id.endsWith('@c.us')) return id.replace('@c.us', '@s.whatsapp.net');
  const digits = String(id).replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

// Fully release a socket: detach listeners first (so its own close event can't
// re-enter this module) and then close the underlying connection. Without this
// each disconnect leaks a live socket with its keep-alive timers and buffers.
function teardown(s) {
  if (!s) return;
  try { s.ev.removeAllListeners(); } catch (e) { /* already gone */ }
  try { s.end(undefined); } catch (e) { /* already closed */ }
  try { if (s.ws && typeof s.ws.close === 'function') s.ws.close(); } catch (e) { /* already closed */ }
}

// At most one pending reconnect, with backoff, so repeated close events cannot
// multiply into a reconnect storm.
function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 60000);
  reconnectAttempts++;
  console.log(`[WhatsApp] Reconnecting in ${Math.round(delay / 1000)}s`);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; init(); }, delay);
}

async function init() {
  if (sock || starting) return;
  starting = true;
  const myGen = ++generation;
  try {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch (e) { /* use bundled */ }

    const s = makeWASocket({
      auth: state,
      version,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: (Browsers && Browsers.appropriate) ? Browsers.appropriate('Chrome') : ['Cosmo CRM', 'Chrome', '1.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    sock = s;

    s.ev.on('creds.update', saveCreds);

    s.ev.on('connection.update', async (update) => {
      // Ignore anything from a socket we have already replaced.
      if (myGen !== generation) return;
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        status = 'qr';
        try { qrDataUrl = await qrcode.toDataURL(qr); } catch (e) {}
        console.log('[WhatsApp] QR code generated — scan in the dashboard');
      }
      if (connection === 'connecting' && status !== 'ready') {
        status = 'connecting';
        console.log('[WhatsApp] Connecting...');
      }
      if (connection === 'open') {
        status = 'ready';
        qrDataUrl = null;
        statusError = null;
        reconnectAttempts = 0; // healthy again — reset the backoff
        console.log('[WhatsApp] Ready');
        refreshGroups().catch(() => {});
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Connection closed (code=${code}, loggedOut=${loggedOut})`);
        // Release this socket completely before starting another one.
        teardown(s);
        if (sock === s) sock = null;
        if (loggedOut) {
          status = 'disconnected';
          reconnectAttempts = 0;
          try { if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
        } else {
          status = 'connecting';
        }
        scheduleReconnect();
      }
    });
  } catch (err) {
    console.error('[WhatsApp] Init error:', err.message);
    status = 'error';
    statusError = err.message;
    sock = null;
  } finally {
    starting = false;
  }
}

// Fetch every group the account participates in — id + name, directly from
// WhatsApp (no chat-list scraping, no lazy-load problem).
async function refreshGroups() {
  if (status !== 'ready' || !sock) return cachedGroups;
  lastGroupError = null;
  try {
    const map = await sock.groupFetchAllParticipating();
    const groups = Object.values(map || {}).map(g => ({ id: g.id, name: g.subject || g.id }));
    groups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    cachedGroups = groups;
    lastGroupRefresh = Date.now();
    console.log(`[WhatsApp] Fetched ${cachedGroups.length} groups`);
  } catch (e) {
    lastGroupError = e.message;
    console.error('[WhatsApp] Group fetch error:', e.message);
  }
  return cachedGroups;
}

// Human-like: show "typing" for a moment before sending.
async function simulateTyping(jid, text) {
  try {
    await sock.presenceSubscribe(jid).catch(() => {});
    await sock.sendPresenceUpdate('composing', jid);
    const len = (text || '').length;
    const typeMs = Math.min(9000, Math.max(1500, len * 60 + Math.random() * 1500));
    await new Promise(r => setTimeout(r, typeMs));
    await sock.sendPresenceUpdate('paused', jid);
  } catch (e) { /* best effort */ }
}

async function sendMessage(chatId, text) {
  if (status !== 'ready' || !sock) throw new Error('WhatsApp not connected');
  const jid = toJid(chatId);
  await randomDelay();
  await simulateTyping(jid, text);
  const msg = await sock.sendMessage(jid, { text: String(text) });
  return msg;
}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MIME = {
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain', '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
};

async function sendFile(chatId, filePath, caption) {
  if (status !== 'ready' || !sock) throw new Error('WhatsApp not connected');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const jid = toJid(chatId);
  await randomDelay(3000, 7000);
  await simulateTyping(jid, caption || '');
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  let content;
  if (IMAGE_EXT.includes(ext)) {
    content = { image: buffer, caption: caption || '' };
  } else if (ext === '.mp4') {
    content = { video: buffer, caption: caption || '' };
  } else {
    content = { document: buffer, fileName, mimetype: MIME[ext] || 'application/octet-stream', caption: caption || '' };
  }
  const msg = await sock.sendMessage(jid, content);
  return msg;
}

async function sendToNumber(number, text) {
  return sendMessage(toJid(number), text);
}

async function sendFileToNumber(number, filePath, caption) {
  return sendFile(toJid(number), filePath, caption);
}

function getStatus() {
  return {
    status, qr: qrDataUrl, groups: cachedGroups, lastGroupRefresh,
    error: statusError, isRefreshing: false, totalChats: 0, groupError: lastGroupError,
  };
}

function getClient() {
  return sock;
}

function destroy() {
  generation++; // invalidate the current socket's events
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  teardown(sock);
  sock = null;
  reconnectAttempts = 0;
  status = 'disconnected';
  qrDataUrl = null;
}

// Full logout: unlink device + clear saved session so the next init() shows a
// fresh QR.
async function disconnect() {
  cachedGroups = [];
  qrDataUrl = null;
  generation++; // stop the current socket's events from scheduling a reconnect
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  const s = sock;
  sock = null;
  reconnectAttempts = 0;
  try { if (s) await s.logout(); } catch (e) { /* may fail if not connected */ }
  teardown(s);
  status = 'disconnected';
  try { if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {
    console.error('[WhatsApp] Could not clear session:', e.message);
  }
  return { ok: true };
}

module.exports = { init, getStatus, getClient, refreshGroups, sendMessage, sendFile, sendToNumber, sendFileToNumber, logSend, destroy, disconnect, randomDelay };
