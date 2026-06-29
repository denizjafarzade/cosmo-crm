import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiSend, FiWifi, FiWifiOff, FiAlertTriangle } from 'react-icons/fi';
import api from '../api';

export default function WhatsAppPage() {
  const [wa, setWa] = useState({ status: 'disconnected', qr: null, groups: [], error: null });
  const [testChat, setTestChat] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const load = () => api.waStatus().then(setWa).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, []);

  const refresh = async () => { await api.waRefreshGroups(); load(); };

  const reconnect = async () => {
    setReconnecting(true);
    try {
      await fetch('/api/whatsapp/reconnect', { method: 'POST' });
    } catch (e) {}
    setTimeout(() => { load(); setReconnecting(false); }, 3000);
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setSending(true);
    try { await api.waSendTest({ chat_id: testChat, message: testMsg }); alert('Sent!'); }
    catch (err) { alert('Failed: ' + err.message); }
    setSending(false);
  };

  const statusConfig = {
    ready: { color: 'var(--green)', bg: 'var(--green-bg)', icon: <FiWifi />, label: 'Connected' },
    connecting: { color: 'var(--amber)', bg: 'var(--amber-bg)', icon: <FiRefreshCw />, label: 'Connecting...' },
    qr: { color: 'var(--amber)', bg: 'var(--amber-bg)', icon: <FiRefreshCw />, label: 'Scan QR Code' },
    disconnected: { color: 'var(--red)', bg: 'var(--red-bg)', icon: <FiWifiOff />, label: 'Disconnected' },
    error: { color: 'var(--red)', bg: 'var(--red-bg)', icon: <FiAlertTriangle />, label: 'Error' },
  };
  const sc = statusConfig[wa.status] || statusConfig.disconnected;

  return (
    <>
      <div className="page-header">
        <h1>WhatsApp Connection</h1>
        <button className="btn btn-outline" onClick={reconnect} disabled={reconnecting}>
          <FiRefreshCw /> {reconnecting ? 'Reconnecting...' : 'Reconnect'}
        </button>
      </div>
      <div className="page-body">
        {/* Status banner */}
        <div className="card" style={{ marginBottom: '1.5rem', border: `1px solid ${sc.color}20` }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: sc.bg, borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '1.5rem', color: sc.color }}>{sc.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: sc.color }}>{sc.label}</div>
              {wa.status === 'ready' && <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>WhatsApp is linked and ready to send messages</div>}
              {wa.status === 'disconnected' && <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Click "Reconnect" to start the WhatsApp client and generate a QR code</div>}
              {wa.status === 'error' && <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
                {wa.error || 'Failed to start WhatsApp client'}
                <br /><strong>Note:</strong> This requires Chromium/Chrome installed on the server. On Linux: <code>sudo apt install chromium-browser</code>
              </div>}
              {wa.status === 'qr' && <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Open WhatsApp on your phone → Settings → Linked Devices → Scan the QR code below</div>}
              {wa.status === 'connecting' && <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Establishing connection, please wait...</div>}
            </div>
            {wa.groups?.length > 0 && <span className="badge green">{wa.groups.length} groups cached</span>}
          </div>
        </div>

        {/* QR Code */}
        {wa.status === 'qr' && wa.qr && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', padding: '2.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Scan with WhatsApp</h3>
              <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device
              </p>
              <img src={wa.qr} alt="QR Code" style={{ maxWidth: 280, borderRadius: 12, border: '1px solid var(--slate-200)', padding: 12, background: 'white' }} />
              <p style={{ color: 'var(--slate-400)', fontSize: '0.8rem', marginTop: '1rem' }}>QR refreshes automatically. Keep this page open while scanning.</p>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Groups */}
          <div className="card">
            <div className="card-header">
              <h2>WhatsApp Groups</h2>
              <button className="btn btn-sm btn-outline" onClick={refresh} disabled={wa.status !== 'ready'}><FiRefreshCw /> Refresh</button>
            </div>
            <div className="card-body">
              {wa.groups?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Group ID</th><th></th></tr></thead>
                    <tbody>
                      {wa.groups.map(g => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 500 }}>{g.name}</td>
                          <td><code style={{ fontSize: '0.7rem', color: 'var(--slate-400)', background: 'var(--slate-100)', padding: '2px 6px', borderRadius: 4 }}>{g.id}</code></td>
                          <td><button className="btn btn-sm btn-outline" onClick={() => { setTestChat(g.id); }}>Use</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <FiWifiOff style={{ fontSize: '2rem', marginBottom: 8 }} />
                  <p>{wa.status === 'ready' ? 'Click "Refresh" to load your WhatsApp groups' : 'Connect WhatsApp first to see your groups'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Test send */}
          <div className="card">
            <div className="card-header"><h2>Send Test Message</h2></div>
            <div className="card-body">
              {wa.status !== 'ready' ? (
                <div className="empty-state">
                  <FiSend style={{ fontSize: '2rem', marginBottom: 8 }} />
                  <p>Connect WhatsApp first to send messages</p>
                </div>
              ) : (
                <form onSubmit={sendTest}>
                  <div className="form-group">
                    <label>Chat ID</label>
                    <input className="form-input" value={testChat} onChange={e => setTestChat(e.target.value)} placeholder="120363...@g.us or 994...@c.us" required />
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>Click "Use" on a group to fill this, or paste a number like 994501234567@c.us</span>
                  </div>
                  <div className="form-group">
                    <label>Message</label>
                    <textarea className="form-input" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Hello from Cosmo CRM!" required />
                  </div>
                  <button className="btn btn-primary" disabled={sending} type="submit"><FiSend /> {sending ? 'Sending...' : 'Send'}</button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Setup instructions */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header"><h2>Setup Guide</h2></div>
          <div className="card-body" style={{ fontSize: '0.9rem', color: 'var(--slate-600)' }}>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>Install Chromium</strong> on your server (required for whatsapp-web.js):<br />
                <code style={{ background: 'var(--slate-100)', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem' }}>sudo apt install -y chromium-browser</code>
              </li>
              <li><strong>Start the server</strong> — the WhatsApp client will initialize automatically and generate a QR code.</li>
              <li><strong>Scan the QR code</strong> from your phone: WhatsApp → Linked Devices → Link a Device.</li>
              <li><strong>Session is persisted</strong> — after the first scan, reconnections are automatic. No need to re-scan unless you unlink the device.</li>
              <li><strong>Refresh groups</strong> to cache your WhatsApp groups, then link them to CRM groups in the Groups page.</li>
            </ol>
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#FEF3C7', borderRadius: 8, fontSize: '0.85rem', color: '#92400E' }}>
              <strong>⚠️ Important:</strong> whatsapp-web.js is unofficial. Your WhatsApp account could be flagged if you send too many messages too fast. This system uses randomized delays (2–7 seconds) between sends and never does bulk blasts.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
