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
let lastGroupError = null;

function logSend(type, target, targetName, message, sendStatus, error) {
  db.prepare(`INSERT INTO send_log (type, target, target_name, message, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(type, target, targetName, message?.substring(0, 500), sendStatus, error || null);
}

function randomDelay(minMs = 4000, maxMs = 9000) {
  return new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

// Pinning an older WhatsApp Web build is OPT-IN only: forcing an old version can
// make WhatsApp reject the session (LOGOUT). Set WA_WEB_VERSION to experiment;
// by default we use the library's own version for a stable connection.
const WA_WEB_VERSION = process.env.WA_WEB_VERSION || null;

function init() {
  if (client) return;
  if (WA_WEB_VERSION) console.log(`[WhatsApp] Using pinned web version ${WA_WEB_VERSION}`);

  const clientOptions = {
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
  };

  if (WA_WEB_VERSION) {
    clientOptions.webVersionCache = {
      type: 'remote',
      remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${WA_WEB_VERSION}.html`,
    };
  }

  client = new Client(clientOptions);

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
    // v1.34 does an internal page reload right after 'ready'; calling getChats()
    // immediately hits a detached frame. Wait for the page to settle first, then
    // retry with backoff until the chat list has synced.
    setTimeout(() => refreshGroupsWithRetry(), 10000);
  });

  client.on('disconnected', async (reason) => {
    status = 'disconnected';
    console.log('[WhatsApp] Disconnected:', reason);
    // Tear the old client/browser down before reconnecting, otherwise the library
    // re-injects into a destroyed page and throws an uncaught error.
    const old = client;
    client = null;
    try { if (old) await old.destroy(); } catch (e) { /* ignore */ }
    // On LOGOUT the saved session is invalid — clear it so a fresh QR is shown.
    if (reason === 'LOGOUT') {
      try {
        const authDir = path.join(__dirname, '..', '..', '.wwebjs_auth');
        if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
      } catch (e) { console.error('[WhatsApp] Could not clear session:', e.message); }
    }
    setTimeout(() => init(), 12000);
  });

  client.on('auth_failure', (msg) => {
    status = 'disconnected';
    console.error('[WhatsApp] Auth failure:', msg);
  });

  // Fallback group discovery: getChats() is broken on current WhatsApp Web, so
  // learn group ids/names from messages as they arrive. Any group that has recent
  // activity will show up in the list without needing getChats().
  const learnFromMessage = async (msg) => {
    try {
      // A message in a group can carry the group id in from (incoming), to
      // (your own outgoing message), or id.remote — check all of them.
      const candidates = [msg && msg.from, msg && msg.to, msg && msg.id && msg.id.remote];
      const groupId = candidates.find(x => typeof x === 'string' && x.endsWith('@g.us'));
      if (!groupId) return;
      if (cachedGroups.some(g => g.id === groupId)) return;
      let name = groupId;
      try { const chat = await msg.getChat(); name = chat?.name || name; } catch (e) {}
      cachedGroups = [...cachedGroups, { id: groupId, name }];
      lastGroupRefresh = Date.now();
      console.log(`[WhatsApp] Learned group from message: ${name} (${groupId})`);
    } catch (e) { /* ignore */ }
  };
  client.on('message', learnFromMessage);
  client.on('message_create', learnFromMessage);

  client.initialize().catch(err => {
    console.error('[WhatsApp] Init error:', err.message);
    status = 'error';
    statusError = err.message;
    client = null;
  });
}

// Force WhatsApp Web to load the full chat list. The list is virtualized and
// lazy-loaded, so only chats scrolled into view get created in the store. We
// scroll the chat pane to the bottom repeatedly until it stops growing, which
// populates the store with every conversation (models persist even after the
// DOM row unmounts).
async function forceLoadAllChats() {
  const page = client.pupPage;
  if (!page) return;
  try {
    const info = await page.evaluate(async () => {
      const pane = document.querySelector('#pane-side')
        || document.querySelector('div[aria-label="Chat list"]')
        || document.querySelector('[data-testid="chat-list"]');
      if (!pane) return { error: 'chat pane not found' };
      let lastHeight = -1;
      let stable = 0;
      for (let i = 0; i < 60; i++) {
        pane.scrollTop = pane.scrollHeight;
        await new Promise(r => setTimeout(r, 350));
        if (pane.scrollHeight === lastHeight) {
          stable++;
          if (stable >= 3) break; // height unchanged 3x → reached the end
        } else {
          stable = 0;
          lastHeight = pane.scrollHeight;
        }
      }
      pane.scrollTop = 0;
      return { done: true };
    });
    if (info && info.error) console.warn(`[WhatsApp] forceLoadAllChats: ${info.error}`);
    else console.log('[WhatsApp] Chat list fully scrolled to load all conversations');
  } catch (e) {
    console.warn('[WhatsApp] forceLoadAllChats failed:', e.message);
  }
}

// Fallback: read groups straight from WhatsApp Web's in-page Store. Used when
// client.getChats() throws a minified error (library/WA-Web version mismatch).
async function getGroupsViaStore() {
  const page = client.pupPage;
  if (!page) throw new Error('no puppeteer page');
  const result = await page.evaluate(() => {
    // Locate the Chat collection across the store layouts different builds use.
    function findChatCollection() {
      const w = window;
      const candidates = [
        w.Store && w.Store.Chat,
        w.WWebJS && w.WWebJS.Store && w.WWebJS.Store.Chat,
        w.Store && w.Store.Chats,
      ];
      for (const c of candidates) {
        if (c && (typeof c.getModelsArray === 'function' || Array.isArray(c.models) || Array.isArray(c._models))) return c;
      }
      // Last resort: some builds expose a modules map with a Chat collection.
      return null;
    }
    try {
      const chatMod = findChatCollection();
      if (!chatMod) return { error: 'Chat collection not found', keys: Object.keys(window.Store || {}).slice(0, 40) };
      const models = typeof chatMod.getModelsArray === 'function'
        ? chatMod.getModelsArray()
        : (chatMod.models || chatMod._models || []);
      const out = [];
      let total = 0;
      for (const c of models) {
        total++;
        // Read only id + a name field; avoid full serialize (which throws on new WA Web).
        let id = '';
        try { id = (c && c.id && (c.id._serialized || (c.id.toString && c.id.toString()))) || ''; } catch (e) { continue; }
        if (!id.endsWith('@g.us')) continue;
        let name = id;
        try {
          name = c.formattedTitle || c.name
            || (c.groupMetadata && c.groupMetadata.subject)
            || (c.contact && (c.contact.name || c.contact.pushname))
            || id;
        } catch (e) { /* keep id */ }
        out.push({ id, name });
      }
      return { groups: out, total };
    } catch (e) {
      return { error: String((e && e.message) || e) };
    }
  });
  if (result && result.error) {
    throw new Error('store: ' + result.error + (result.keys ? ' [Store keys: ' + result.keys.join(',') + ']' : ''));
  }
  if (result && typeof result.total === 'number') console.log(`[WhatsApp] Store: ${result.total} chat models, ${result.groups.length} groups`);
  return (result && result.groups) || [];
}

async function refreshGroups() {
  if (status !== 'ready' || isRefreshing) return cachedGroups;
  isRefreshing = true;
  lastGroupError = null;
  totalChats = 0;
  try {
    let collected = [];
    try {
      // Primary path: the library's own chat list, raced against a timeout.
      const chats = await Promise.race([
        client.getChats(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('getChats() timed out after 60s')), 60000)),
      ]);
      totalChats = chats.length;
      for (const c of chats) {
        const serialized = c.id?._serialized || '';
        if (c.isGroup || serialized.endsWith('@g.us')) {
          collected.push({ id: serialized, name: c.name || c.formattedTitle || serialized });
        }
        await new Promise(resolve => setImmediate(resolve));
      }
      console.log(`[WhatsApp] getChats: scanned ${totalChats} chats, ${collected.length} groups`);
    } catch (primaryErr) {
      // Fallback path: force the full chat list to load, then read groups
      // directly from the page Store.
      console.warn(`[WhatsApp] getChats() failed (${primaryErr.message}), force-loading chats + Store fallback`);
      await forceLoadAllChats();
      collected = await getGroupsViaStore();
      console.log(`[WhatsApp] Store fallback: ${collected.length} groups`);
    }
    // Merge with anything already discovered (e.g. from messages) so a partial
    // read never drops known groups. New data wins for the name.
    const byId = new Map(cachedGroups.map(g => [g.id, g]));
    for (const g of collected) byId.set(g.id, g);
    cachedGroups = Array.from(byId.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    lastGroupRefresh = Date.now();
  } catch (e) {
    lastGroupError = e.message;
    console.error('[WhatsApp] Group refresh error:', e.message);
  }
  isRefreshing = false;
  totalChats = 0;
  return cachedGroups;
}

// Retry group refresh after connecting: the chat list syncs asynchronously, so
// the first getChats() right after 'ready' frequently returns nothing.
async function refreshGroupsWithRetry(attempt = 0) {
  const MAX_ATTEMPTS = 12;
  const DELAY_MS = 8000;
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
  return { status, qr: qrDataUrl, groups: cachedGroups, lastGroupRefresh, error: statusError, isRefreshing, totalChats, groupError: lastGroupError };
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
