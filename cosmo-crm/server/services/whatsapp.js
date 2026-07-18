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
    refreshGroups();
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

async function sendMessage(chatId, text) {
  if (status !== 'ready') throw new Error('WhatsApp not connected');
  await randomDelay();
  const msg = await client.sendMessage(chatId, text);
  return msg;
}

async function sendFile(chatId, filePath, caption) {
  if (status !== 'ready') throw new Error('WhatsApp not connected');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  await randomDelay(3000, 7000);
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

module.exports = { init, getStatus, getClient, refreshGroups, sendMessage, sendFile, sendToNumber, sendFileToNumber, logSend, destroy, randomDelay };
