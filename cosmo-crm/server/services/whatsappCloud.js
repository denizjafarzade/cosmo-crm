// WhatsApp Cloud API client (the official, verified channel).
//
// This sits alongside services/whatsapp.js (Baileys). The split is deliberate:
//   - Cloud API  -> 1:1 conversations: registrations, parent notifications,
//                   payment reminders, and the coach's own control bot.
//   - Baileys    -> class group messages (homework), because the official
//                   Groups API caps a group at 8 participants and cannot see
//                   groups that already exist in the WhatsApp Business app.
//
// Two Meta rules shape everything below:
//   1. Free-form replies are only allowed within 24h of the person's last
//      message. Outside that window Meta requires a pre-approved template.
//      sendSmart() picks the right one automatically.
//   2. Messaging limits count only messages sent OUTSIDE that 24h window, so
//      answering people who wrote to us first is effectively unmetered.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const GRAPH_VERSION = 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Meta allows 80 messages/sec on a normal number (20 on a coexistence number).
// We stay far below that: this academy sends tens of messages a day, and a
// gentle pace also keeps the quality rating healthy.
const MAX_PER_SECOND = 8;
const MAX_ATTEMPTS = 4;

function cfg() {
  return {
    phoneNumberId: db.getSetting('wa_cloud_phone_number_id') || process.env.WA_PHONE_NUMBER_ID || '',
    wabaId: db.getSetting('wa_cloud_waba_id') || process.env.WA_WABA_ID || '',
    token: db.getSetting('wa_cloud_token') || process.env.WA_ACCESS_TOKEN || '',
    appSecret: process.env.WA_APP_SECRET || '',
    verifyToken: process.env.WA_VERIFY_TOKEN || '',
    lang: db.getSetting('wa_cloud_template_lang') || 'az',
  };
}

function isConfigured() {
  const c = cfg();
  return !!(c.phoneNumberId && c.token);
}

// --- phone numbers -------------------------------------------------------
// Meta addresses people by "wa_id": digits only, country code included, no +.
function toWaId(raw) {
  let n = String(raw || '').replace(/[^\d]/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  // Local Azerbaijani forms: 0XXXXXXXXX / XXXXXXXXX -> 994XXXXXXXXX
  if (n.length === 10 && n.startsWith('0')) n = '994' + n.slice(1);
  else if (n.length === 9) n = '994' + n;
  return n;
}

// --- outbound queue ------------------------------------------------------
const queue = [];
let draining = false;

function enqueue(job) {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject });
    drain();
  });
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const { job, resolve, reject } = queue.shift();
      try { resolve(await job()); }
      catch (e) { reject(e); }
      await new Promise(r => setTimeout(r, Math.ceil(1000 / MAX_PER_SECOND)));
    }
  } finally {
    draining = false;
  }
}

// --- the one call that actually talks to Meta ----------------------------
async function post(body, { kind = 'text', preview = '' } = {}) {
  const c = cfg();
  if (!c.phoneNumberId || !c.token) throw new Error('WhatsApp Cloud API is not configured');

  const url = `${GRAPH}/${c.phoneNumberId}/messages`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res, json;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      json = await res.json().catch(() => ({}));
    } catch (e) {
      // Network-level failure: worth retrying.
      lastError = e;
      if (attempt < MAX_ATTEMPTS) { await backoff(attempt); continue; }
      throw e;
    }

    if (res.ok && json.messages && json.messages[0]) {
      const id = json.messages[0].id;
      db.prepare(`INSERT OR REPLACE INTO wa_outbox (message_id, wa_id, kind, body, status)
        VALUES (?, ?, ?, ?, 'accepted')`).run(id, body.to, kind, preview.slice(0, 500));
      touchOutbound(body.to);
      return { ok: true, id };
    }

    const err = json.error || {};
    const code = err.code;
    // 130429 = throughput, 131056 = pair rate limit, 4/80007 = app rate limit.
    const retryable = res.status >= 500 || [130429, 131056, 4, 80007].includes(code);
    lastError = new Error(`${err.message || res.statusText} (code ${code ?? res.status})`);
    lastError.code = code;
    lastError.details = err;

    if (retryable && attempt < MAX_ATTEMPTS) { await backoff(attempt); continue; }

    db.prepare(`INSERT INTO wa_outbox (message_id, wa_id, kind, body, status, error_code, error_title)
      VALUES (?, ?, ?, ?, 'failed', ?, ?)`)
      .run(`failed:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        body.to, kind, preview.slice(0, 500), code ?? res.status, (err.message || res.statusText || '').slice(0, 300));
    throw lastError;
  }
  throw lastError;
}

const backoff = (attempt) => new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 15000)));

function touchOutbound(waId) {
  db.prepare(`INSERT INTO wa_contacts (wa_id, last_outbound_at) VALUES (?, datetime('now'))
    ON CONFLICT(wa_id) DO UPDATE SET last_outbound_at = datetime('now'), updated_at = datetime('now')`).run(waId);
}

// --- message builders ----------------------------------------------------
function sendText(to, text, { preview_url = false } = {}) {
  const waId = toWaId(to);
  return enqueue(() => post(
    { messaging_product: 'whatsapp', to: waId, type: 'text', text: { body: text, preview_url } },
    { kind: 'text', preview: text }
  ));
}

// Up to 3 reply buttons; anything more has to be a list.
function sendButtons(to, text, buttons, { header, footer } = {}) {
  const waId = toWaId(to);
  const interactive = {
    type: 'button',
    body: { text },
    action: {
      buttons: buttons.slice(0, 3).map(b => ({
        type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) },
      })),
    },
  };
  if (header) interactive.header = { type: 'text', text: header.slice(0, 60) };
  if (footer) interactive.footer = { text: footer.slice(0, 60) };
  return enqueue(() => post(
    { messaging_product: 'whatsapp', to: waId, type: 'interactive', interactive },
    { kind: 'buttons', preview: text }
  ));
}

// Up to 10 rows across sections — the menu backbone of the coach's bot.
function sendList(to, { body, button = 'Seç', header, footer, sections }) {
  const waId = toWaId(to);
  const interactive = {
    type: 'list',
    body: { text: body },
    action: {
      button: button.slice(0, 20),
      sections: sections.map(s => ({
        title: (s.title || '').slice(0, 24),
        rows: s.rows.slice(0, 10).map(r => ({
          id: r.id,
          title: r.title.slice(0, 24),
          ...(r.description ? { description: r.description.slice(0, 72) } : {}),
        })),
      })),
    },
  };
  if (header) interactive.header = { type: 'text', text: header.slice(0, 60) };
  if (footer) interactive.footer = { text: footer.slice(0, 60) };
  return enqueue(() => post(
    { messaging_product: 'whatsapp', to: waId, type: 'interactive', interactive },
    { kind: 'list', preview: body }
  ));
}

// Templates are the only thing deliverable outside the 24h window.
function sendTemplate(to, name, { lang, bodyParams = [], headerParams = [], buttonParams = [] } = {}) {
  const waId = toWaId(to);
  const components = [];
  if (headerParams.length) {
    components.push({ type: 'header', parameters: headerParams.map(t => ({ type: 'text', text: String(t) })) });
  }
  if (bodyParams.length) {
    components.push({ type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: String(t) })) });
  }
  buttonParams.forEach((p, i) => {
    components.push({ type: 'button', sub_type: 'url', index: String(i), parameters: [{ type: 'text', text: String(p) }] });
  });
  return enqueue(() => post({
    messaging_product: 'whatsapp', to: waId, type: 'template',
    template: { name, language: { code: lang || cfg().lang }, ...(components.length ? { components } : {}) },
  }, { kind: `template:${name}`, preview: bodyParams.join(' | ') }));
}

// Free-form inside the window, approved template outside it. Callers that
// notify people (payment reminders, schedule changes) should use this rather
// than sendText, so a message never silently fails at 24h + 1 minute.
async function sendSmart(to, { text, template }) {
  const waId = toWaId(to);
  if (db.withinServiceWindow(waId)) return sendText(waId, text);
  if (!template) {
    const e = new Error('Outside the 24-hour window and no template was given');
    e.code = 'NO_TEMPLATE';
    throw e;
  }
  return sendTemplate(waId, template.name, template);
}

async function sendDocument(to, filePath, caption = '') {
  const waId = toWaId(to);
  const mediaId = await uploadMedia(filePath);
  return enqueue(() => post({
    messaging_product: 'whatsapp', to: waId, type: 'document',
    document: { id: mediaId, caption, filename: path.basename(filePath) },
  }, { kind: 'document', preview: caption || path.basename(filePath) }));
}

async function uploadMedia(filePath) {
  const c = cfg();
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  const res = await fetch(`${GRAPH}/${c.phoneNumberId}/media`, {
    method: 'POST', headers: { Authorization: `Bearer ${c.token}` }, body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) throw new Error(`Media upload failed: ${json.error?.message || res.statusText}`);
  return json.id;
}

// Marking a message read is what makes the bot feel responsive, and it is
// free — it does not count as a message.
function markRead(messageId) {
  return enqueue(() => (async () => {
    const c = cfg();
    await fetch(`${GRAPH}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
    }).catch(() => {});
    return { ok: true };
  })());
}

// --- webhook security ----------------------------------------------------
// Meta signs every webhook with the app secret. Without this check anyone who
// learns the URL could drive the bot, so an unverified payload is dropped.
function verifySignature(rawBody, signatureHeader) {
  const { appSecret } = cfg();
  if (!appSecret) return { ok: false, reason: 'WA_APP_SECRET is not set' };
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, reason: 'missing signature header' };
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true };
}

// --- account introspection (shown in the CRM) ----------------------------
async function getAccountInfo() {
  const c = cfg();
  if (!c.phoneNumberId || !c.token) return { configured: false };
  try {
    const res = await fetch(
      `${GRAPH}/${c.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status,platform_type,throughput`,
      { headers: { Authorization: `Bearer ${c.token}` } }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { configured: true, ok: false, error: json.error?.message || res.statusText };
    return {
      configured: true, ok: true,
      number: json.display_phone_number,
      name: json.verified_name,
      quality: json.quality_rating,
      tier: json.messaging_limit_tier,
      platform: json.platform_type,
      throughput: json.throughput?.level,
    };
  } catch (e) {
    return { configured: true, ok: false, error: e.message };
  }
}

async function listTemplates() {
  const c = cfg();
  if (!c.wabaId || !c.token) return [];
  const res = await fetch(`${GRAPH}/${c.wabaId}/message_templates?limit=100&fields=name,status,language,category`,
    { headers: { Authorization: `Bearer ${c.token}` } });
  const json = await res.json().catch(() => ({}));
  return json.data || [];
}

module.exports = {
  isConfigured, cfg, toWaId,
  sendText, sendButtons, sendList, sendTemplate, sendSmart, sendDocument, markRead,
  verifySignature, getAccountInfo, listTemplates,
};
