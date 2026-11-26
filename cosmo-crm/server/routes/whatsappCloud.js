// CRM-facing management of the official WhatsApp Cloud API channel.
// Mounted under /api, so every route here already requires a CRM token.

const { Router } = require('express');
const db = require('../db');
const wa = require('../services/whatsappCloud');
const bot = require('../services/botEngine');

const r = Router();

// Credentials live in settings so they can be rotated from the CRM without a
// redeploy. The token is never sent back to the browser in full.
const SETTING_KEYS = [
  'wa_cloud_phone_number_id',
  'wa_cloud_waba_id',
  'wa_cloud_token',
  'wa_cloud_template_lang',
  'wa_admin_numbers',
  'wa_tpl_payment_reminder',
  'wa_tpl_new_inquiry',
  'wa_tpl_lesson_reminder',
];

r.get('/status', async (req, res) => {
  const info = await wa.getAccountInfo();
  const token = db.getSetting('wa_cloud_token') || '';
  res.json({
    ...info,
    // Webhook secrets stay in the environment; report only whether they exist.
    appSecretSet: !!process.env.WA_APP_SECRET,
    verifyTokenSet: !!process.env.WA_VERIFY_TOKEN,
    tokenSet: !!token,
    tokenHint: token ? `…${token.slice(-6)}` : '',
    adminNumbers: bot.adminNumbers(),
    settings: SETTING_KEYS.reduce((o, k) => {
      o[k] = k === 'wa_cloud_token' ? undefined : (db.getSetting(k) || '');
      return o;
    }, {}),
    counts: {
      contacts: db.prepare('SELECT COUNT(*) c FROM wa_contacts').get().c,
      inbound24h: db.prepare("SELECT COUNT(*) c FROM wa_inbox WHERE datetime(received_at) > datetime('now','-1 day')").get().c,
      outbound24h: db.prepare("SELECT COUNT(*) c FROM wa_outbox WHERE datetime(sent_at) > datetime('now','-1 day')").get().c,
      failed24h: db.prepare("SELECT COUNT(*) c FROM wa_outbox WHERE status = 'failed' AND datetime(sent_at) > datetime('now','-1 day')").get().c,
    },
  });
});

r.put('/settings', (req, res) => {
  const body = req.body || {};
  for (const key of SETTING_KEYS) {
    if (body[key] === undefined) continue;
    let value = String(body[key]).trim();
    if (key === 'wa_admin_numbers') {
      value = value.split(',').map(s => wa.toWaId(s)).filter(Boolean).join(',');
    }
    // An empty token means "leave the stored one alone", so it isn't wiped by
    // a form that never received it in the first place.
    if (key === 'wa_cloud_token' && !value) continue;
    db.setSetting(key, value);
  }
  res.json({ ok: true });
});

r.get('/templates', async (req, res) => {
  try {
    res.json(await wa.listTemplates());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Send a one-off message, used both for "test the connection" and for the
// coach replying to a parent from inside the CRM.
r.post('/send', async (req, res) => {
  const { to, message, template, params } = req.body || {};
  if (!to) return res.status(400).json({ error: 'to is required' });
  try {
    if (template) {
      const out = await wa.sendTemplate(to, template, { bodyParams: params || [] });
      return res.json(out);
    }
    if (!message) return res.status(400).json({ error: 'message or template is required' });
    const out = await wa.sendSmart(to, { text: message, template: null });
    res.json(out);
  } catch (e) {
    res.status(e.code === 'NO_TEMPLATE' ? 409 : 502).json({ error: e.message, code: e.code });
  }
});

// Recent conversation history, so the CRM can show the bot's traffic.
r.get('/conversations', (req, res) => {
  const rows = db.prepare(`
    SELECT c.wa_id, c.profile_name, c.role, c.last_inbound_at, c.last_outbound_at,
           s.name AS student_name, s.surname AS student_surname,
           (SELECT body FROM wa_inbox i WHERE i.wa_id = c.wa_id ORDER BY received_at DESC LIMIT 1) AS last_message,
           (julianday('now') - julianday(c.last_inbound_at)) * 24 < 24 AS window_open
    FROM wa_contacts c LEFT JOIN students s ON s.id = c.student_id
    ORDER BY COALESCE(c.last_inbound_at, c.created_at) DESC LIMIT 100`).all();
  res.json(rows);
});

r.get('/conversations/:waId', (req, res) => {
  const waId = wa.toWaId(req.params.waId);
  const inbound = db.prepare(
    'SELECT message_id, type, body, received_at AS at, 1 AS inbound FROM wa_inbox WHERE wa_id = ?'
  ).all(waId);
  const outbound = db.prepare(
    'SELECT message_id, kind AS type, body, sent_at AS at, 0 AS inbound, status FROM wa_outbox WHERE wa_id = ?'
  ).all(waId);
  const all = [...inbound, ...outbound].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  res.json({ wa_id: waId, window_open: db.withinServiceWindow(waId), messages: all.slice(-200) });
});

module.exports = r;
