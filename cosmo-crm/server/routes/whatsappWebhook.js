// Public webhook for the WhatsApp Cloud API.
//
// This router is mounted BEFORE requireAuth, because Meta calls it with no
// bearer token of ours. Its authentication is instead the SHA-256 signature
// Meta puts on every request, checked against the app secret — without that
// check anyone who learned the URL could drive the bot.
//
// Meta re-delivers a webhook until it receives a 200, so this answers 200
// immediately and does the work afterwards, de-duplicating by message id.

const { Router } = require('express');
const db = require('../db');
const wa = require('../services/whatsappCloud');
const bot = require('../services/botEngine');

const r = Router();

// --- handshake -----------------------------------------------------------
// Meta calls this once when the webhook URL is saved in the App dashboard.
r.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = wa.cfg().verifyToken;

  if (!expected) {
    console.error('[WA Webhook] WA_VERIFY_TOKEN is not set — cannot complete the handshake');
    return res.sendStatus(500);
  }
  if (mode === 'subscribe' && token === expected) {
    console.log('[WA Webhook] Verified by Meta');
    return res.status(200).send(challenge);
  }
  console.warn('[WA Webhook] Handshake rejected (token mismatch)');
  return res.sendStatus(403);
});

// --- events --------------------------------------------------------------
r.post('/', (req, res) => {
  const raw = req.rawBody;
  if (!raw) {
    console.error('[WA Webhook] No raw body captured — signature cannot be verified');
    return res.sendStatus(500);
  }

  const check = wa.verifySignature(raw, req.get('x-hub-signature-256'));
  if (!check.ok) {
    console.warn(`[WA Webhook] Rejected: ${check.reason}`);
    return res.sendStatus(403);
  }

  // Acknowledge first; Meta's delivery attempt should not wait on our work.
  res.sendStatus(200);
  setImmediate(() => process(req.body).catch(e => console.error('[WA Webhook] processing failed:', e)));
});

async function process(body) {
  if (!body || body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};

      // Delivery receipts: sent -> delivered -> read, or failed.
      for (const st of v.statuses || []) {
        db.prepare(`UPDATE wa_outbox SET status = ?, conversation_id = ?, pricing_category = ?,
            error_code = ?, error_title = ?, updated_at = datetime('now')
          WHERE message_id = ?`).run(
          st.status || null,
          st.conversation?.id || null,
          st.pricing?.category || null,
          st.errors?.[0]?.code ?? null,
          (st.errors?.[0]?.title || '').slice(0, 300) || null,
          st.id);
        if (st.status === 'failed') {
          console.error(`[WA Webhook] Delivery failed to ${st.recipient_id}:`,
            st.errors?.[0]?.title || 'unknown reason');
        }
      }

      const profileByWaId = {};
      for (const c of v.contacts || []) profileByWaId[c.wa_id] = c.profile?.name || '';

      for (const m of v.messages || []) {
        // Idempotency: a retry of a message we already handled is ignored.
        const seen = db.prepare('SELECT handled FROM wa_inbox WHERE message_id = ?').get(m.id);
        if (seen) continue;

        const { text, interactiveId, kind } = extract(m);
        db.prepare(`INSERT OR IGNORE INTO wa_inbox (message_id, wa_id, type, body, payload)
          VALUES (?, ?, ?, ?, ?)`)
          .run(m.id, m.from, kind, (text || interactiveId || '').slice(0, 1000), JSON.stringify(m).slice(0, 4000));

        try {
          await bot.handleMessage({
            waId: m.from,
            profileName: profileByWaId[m.from] || '',
            text,
            interactiveId,
            messageId: m.id,
          });
          db.prepare('UPDATE wa_inbox SET handled = 1 WHERE message_id = ?').run(m.id);
        } catch (e) {
          console.error(`[WA Webhook] Bot failed on ${m.id}:`, e);
          db.prepare('UPDATE wa_inbox SET handled = 1, error = ? WHERE message_id = ?')
            .run(String(e.message).slice(0, 300), m.id);
          // Tell the person something went wrong rather than leaving silence.
          wa.sendText(m.from, 'Üzr istəyirik, texniki problem oldu. Bir azdan yenidən cəhd edin.')
            .catch(() => {});
        }
      }
    }
  }
}

// Normalise the message shapes we act on into { text, interactiveId }.
function extract(m) {
  switch (m.type) {
    case 'text':
      return { text: m.text?.body || '', interactiveId: '', kind: 'text' };
    case 'interactive':
      return {
        text: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '',
        interactiveId: m.interactive?.button_reply?.id || m.interactive?.list_reply?.id || '',
        kind: 'interactive',
      };
    case 'button': // template quick-reply
      return { text: m.button?.text || '', interactiveId: m.button?.payload || '', kind: 'button' };
    default:
      // Images, audio, documents, location, contacts: acknowledged and logged,
      // but the bot answers with its menu rather than trying to interpret them.
      return { text: '', interactiveId: '', kind: m.type || 'unknown' };
  }
}

module.exports = r;
