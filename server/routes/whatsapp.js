const { Router } = require('express');
const wa = require('../services/whatsapp');
const r = Router();

r.get('/status', (req, res) => {
  res.json(wa.getStatus());
});

r.post('/refresh-groups', async (req, res) => {
  try {
    const groups = await wa.refreshGroups();
    res.json({ ok: true, groups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.post('/send-test', async (req, res) => {
  const { chat_id, message } = req.body;
  try {
    await wa.sendMessage(chat_id, message || 'Test message from Cosmo CRM');
    wa.logSend('test', chat_id, '', message || 'Test', 'success', null);
    res.json({ ok: true });
  } catch (e) {
    wa.logSend('test', chat_id, '', message || 'Test', 'failed', e.message);
    res.status(500).json({ error: e.message });
  }
});

r.post('/reconnect', (req, res) => {
  wa.destroy();
  setTimeout(() => wa.init(), 1000);
  res.json({ ok: true, message: 'Reconnecting...' });
});

module.exports = r;
