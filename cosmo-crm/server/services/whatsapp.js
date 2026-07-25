const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('../db');

let client = null;
let qrDataUrl = null;
let status = 'disconnected'; // disconnected | qr | connecting | ready | error
let statusError = null;
let cachedGroups = [];
let lastGroupRefresh = 0;
let isRefreshing = false;
let totalChats = 0;

function logSend(type, target, targetName, message, sendStatus, error) {
  db.prepare(`INSERT INTO send_log (type, target, target_name, message, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(type, target, targetName, message?.substring(0, 500), sendStatus, error || null);
}

function randomDelay(minMs = 2000, maxMs = 5000) {
  return new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

function init() {
  if (client) return;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '..', '..', '.wwebjs_auth') }),
    puppeteer: {
      headless: true,
      executablePath: process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
      ],
    },
  });

  client.on('qr', async (qr) => {
    status = 'qr';
    qrDataUrl = await qrcode.toDataURL(qr);
    console.log('[WhatsApp] QR code generated — scan in the dashboard');
  });

  client.on('loading_screen', () => {
    if (status !== 'ready') status = 'connecting';
    console.log('[WhatsApp] Loading...');
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated');
    if (status !== 'ready') status = 'connecting';
  });

  client.on('ready', () => {
    status = 'ready';
    qrDataUrl = null;
    console.log('[WhatsApp] Ready');
    // On a fresh connection the chat list is still syncing, so getChats() often
    // returns 0 groups. Retry with backoff until groups appear (or we give up).
    refreshGroupsWithRetry();
  });

  client.on('disconnected', (reason) => {
    status = 'disconnected';
    console.log('[WhatsApp] Disconnected:', reason);
    client = null;
    // Auto-reconnect after 10s
    setTimeout(() => init(), 10000);
  });

  client.on('auth_failure', (msg) => {
    status = 'disconnected';
    console.error('[WhatsApp] Auth failure:', msg);
  });

  client.initialize().catch(err => {
    console.error('[WhatsApp] Init error:', err.message);
    status = 'error';
    statusError = err.message;
    client = null;
  });
}

async function refreshGroups() {
  if (status !== 'ready' || isRefreshing) return cachedGroups;
  isRefreshing = true;
  cachedGroups = [];
  totalChats = 0;
  try {
    const chats = await client.getChats();
    totalChats = chats.length;
    for (const c of chats) {
      if (c.isGroup) {
        cachedGroups = [...cachedGroups, { id: c.id._serialized, name: c.name }];
      }
      // Yield to event loop so status polls can see partial results
      await new Promise(resolve => setImmediate(resolve));
    }
    lastGroupRefresh = Date.now();
    console.log(`[WhatsApp] Cached ${cachedGroups.length} groups`);
  } catch (e) {
    console.error('[WhatsApp] Group refresh error:', e.message);
  }
  isRefreshing = false;
  totalChats = 0;
  return cachedGroups;
}

// Retry group refresh after connecting: the chat list syncs asynchronously, so
// the first getChats() right after 'ready' frequently returns nothing.
async function refreshGroupsWithRetry(attempt = 0) {
  const MAX_ATTEMPTS = 8;
  const DELAY_MS = 5000;
  if (status !== 'ready') return;
  const groups = await refreshGroups();
  if (groups.length > 0 || attempt >= MAX_ATTEMPTS) {
    if (groups.length === 0) console.log('[WhatsApp] No groups found after retries — chats may still be syncing');
    return;
  }
  console.log(`[WhatsApp] 0 groups yet (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying in ${DELAY_MS / 1000}s`);
  setTimeout(() => refreshGroupsWithRetry(attempt + 1), DELAY_MS);
}

// Simulate a human typing in the chat before a message is sent, so activity
// looks organic rather than instant/bot-like.
async function simulateTyping(chatId, text) {
  try {
    const chat = await client.getChatById(chatId);
    await chat.sendStateTyping();
    // ~40 wpm reading/typing pace, clamped to a sane range.
    const len = (text || '').length;
    const typeMs = Math.min(9000, Math.max(1500, len * 60 + Math.random() * 1500));
    await new Promise(r => setTimeout(r, typeMs));
    await chat.clearState();
  } catch (e) {
    // Typing simulation is best-effort; never block the actual send.
  }
}

async function sendMessage(chatId, text) {
  if (status !== 'ready') throw new Error('WhatsApp not connected');
  await randomDelay(); // pause before "opening" the chat
  await simulateTyping(chatId, text);
  const msg = await client.sendMessage(chatId, text);
  try { const chat = await client.getChatById(chatId); await chat.sendSeen(); } catch {}
  return msg;
}

async function sendFile(chatId, filePath, caption) {
  if (status !== 'ready') throw new Error('WhatsApp not connected');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  await randomDelay(3000, 7000);
  await simulateTyping(chatId, caption || '');
  const media = MessageMedia.fromFilePath(filePath);
  const msg = await client.sendMessage(chatId, media, { caption: caption || '' });
  return msg;
}

async function sendToNumber(number, text) {
  // number is like 994501234567 (no +)
  const chatId = `${number}@c.us`;
  return sendMessage(chatId, text);
}

async function sendFileToNumber(number, filePath, caption) {
  const chatId = `${number}@c.us`;
  return sendFile(chatId, filePath, caption);
}

function getStatus() {
  return { status, qr: qrDataUrl, groups: cachedGroups, lastGroupRefresh, error: statusError, isRefreshing, totalChats };
}

function getClient() {
  return client;
}

function destroy() {
  if (client) {
    client.destroy();
    client = null;
    status = 'disconnected';
  }
}

// Full logout: unlink the device and clear the saved session so the next
// init() shows a fresh QR code (used by the "Disconnect" button).
async function disconnect() {
  cachedGroups = [];
  qrDataUrl = null;
  try {
    if (client) {
      try { await client.logout(); } catch (e) { /* may fail if not ready */ }
      try { await client.destroy(); } catch (e) {}
    }
  } finally {
    client = null;
    status = 'disconnected';
  }
  // Best-effort: remove the persisted auth session so it can't silently re-link.
  try {
    const authDir = path.join(__dirname, '..', '..', '.wwebjs_auth');
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
  } catch (e) {
    console.error('[WhatsApp] Could not clear auth session:', e.message);
  }
  return { ok: true };
}

module.exports = { init, getStatus, getClient, refreshGroups, sendMessage, sendFile, sendToNumber, sendFileToNumber, logSend, destroy, disconnect, randomDelay };
