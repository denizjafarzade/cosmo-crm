import React, { useState, useEffect } from 'react';
import {
  FiCheckCircle, FiAlertTriangle, FiSend, FiSave, FiRefreshCw,
  FiCopy, FiCheck, FiMessageSquare, FiExternalLink,
} from 'react-icons/fi';
import { t, formatDateTime } from '../i18n';
import api from '../api';

// The official WhatsApp Cloud API panel: credentials, health, templates and
// the bot's live conversations. The Baileys tab next to it stays responsible
// for class group messages.

const QUALITY_COLOR = { GREEN: 'var(--green)', YELLOW: 'var(--amber)', RED: 'var(--red)' };

function Stat({ label, value, color, hint }) {
  return (
    <div style={{
      flex: '1 1 140px', minWidth: 0, background: 'var(--slate-50)',
      border: '1px solid var(--slate-200)', borderRadius: 10, padding: '0.7rem 0.9rem',
    }}>
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--slate-400)', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: color || 'var(--slate-700)', marginTop: 2, wordBreak: 'break-word' }}>
        {value ?? '—'}
      </div>
      {hint && <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Copyable({ value }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1800); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: 'var(--slate-100)', border: '1px solid var(--slate-200)',
        borderRadius: 6, padding: '4px 9px', fontSize: '0.78rem',
        fontFamily: 'ui-monospace, monospace', maxWidth: '100%',
      }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      {done ? <FiCheck style={{ color: 'var(--green)', flexShrink: 0 }} /> : <FiCopy style={{ flexShrink: 0, opacity: 0.6 }} />}
    </button>
  );
}

export default function WhatsAppCloud() {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [templates, setTemplates] = useState(null);
  const [convos, setConvos] = useState([]);
  const [thread, setThread] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [sending, setSending] = useState(false);

  const load = () => api.waCloudStatus().then(s => {
    setSt(s);
    setForm(f => f || {
      wa_cloud_phone_number_id: s.settings?.wa_cloud_phone_number_id || '',
      wa_cloud_waba_id: s.settings?.wa_cloud_waba_id || '',
      wa_cloud_token: '',
      wa_admin_numbers: s.settings?.wa_admin_numbers || '',
      wa_tpl_payment_reminder: s.settings?.wa_tpl_payment_reminder || '',
      wa_tpl_new_inquiry: s.settings?.wa_tpl_new_inquiry || '',
    });
  }).catch(() => {});

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);
  useEffect(() => { api.waCloudConversations().then(setConvos).catch(() => {}); }, [st?.counts?.inbound24h]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.waCloudSaveSettings(form);
      setForm(f => ({ ...f, wa_cloud_token: '' }));
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      load();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setSending(true); setTestResult(null);
    try {
      const r = await api.waCloudSend({ to: testTo, message: testMsg });
      setTestResult({ ok: true, text: `${t('wac.sent')} (${r.id})` });
      setTestMsg('');
    } catch (err) {
      setTestResult({ ok: false, text: err.message });
    }
    setSending(false);
  };

  const openThread = async (waId) => {
    setThread({ wa_id: waId, loading: true });
    try { setThread(await api.waCloudConversation(waId)); }
    catch { setThread(null); }
  };

  if (!st || !form) return <div className="page-body">{t('ui.loading')}…</div>;

  const webhookUrl = `${window.location.origin}/webhook/whatsapp`;
  const live = st.configured && st.ok;

  return (
    <div className="page-body">
      {/* ── connection ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {live
              ? <FiCheckCircle style={{ color: 'var(--green)' }} />
              : <FiAlertTriangle style={{ color: 'var(--amber)' }} />}
            {t('wac.title')}
          </h2>
          <button className="btn btn-outline btn-sm" onClick={load}><FiRefreshCw /> {t('ui.refresh')}</button>
        </div>
        <div className="card-body">
          {!st.configured ? (
            <div style={{ padding: '0.9rem 1rem', background: 'var(--amber-bg)', borderRadius: 8, color: 'var(--amber-text, #92400E)', fontSize: '0.88rem' }}>
              <strong>{t('wac.notConfigured')}</strong>
              <div style={{ marginTop: 4 }}>{t('wac.notConfiguredHint')}</div>
            </div>
          ) : !st.ok ? (
            <div style={{ padding: '0.9rem 1rem', background: 'var(--red-bg)', borderRadius: 8, color: 'var(--red)', fontSize: '0.88rem' }}>
              <strong>{t('wac.error')}:</strong> {st.error}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
              <Stat label={t('wac.number')} value={st.number} hint={st.name} />
              <Stat label={t('wac.quality')} value={st.quality} color={QUALITY_COLOR[st.quality]} />
              <Stat label={t('wac.tier')} value={(st.tier || '').replace('TIER_', '')} hint={t('wac.tierHint')} />
              <Stat label={t('wac.in24')} value={st.counts.inbound24h} />
              <Stat label={t('wac.out24')} value={st.counts.outbound24h}
                hint={st.counts.failed24h ? `${st.counts.failed24h} ${t('wac.failed')}` : ''}
                color={st.counts.failed24h ? 'var(--red)' : undefined} />
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <span style={{ color: st.appSecretSet ? 'var(--green)' : 'var(--red)' }}>
              {st.appSecretSet ? '●' : '○'} WA_APP_SECRET
            </span>
            <span style={{ color: st.verifyTokenSet ? 'var(--green)' : 'var(--red)' }}>
              {st.verifyTokenSet ? '●' : '○'} WA_VERIFY_TOKEN
            </span>
            <span style={{ color: st.tokenSet ? 'var(--green)' : 'var(--red)' }}>
              {st.tokenSet ? '●' : '○'} {t('wac.token')} {st.tokenHint}
            </span>
          </div>
        </div>
      </div>

      {/* ── webhook ────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h2>{t('wac.webhook')}</h2></div>
        <div className="card-body" style={{ fontSize: '0.88rem', color: 'var(--slate-600)' }}>
          <p style={{ marginTop: 0 }}>{t('wac.webhookHint')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <strong style={{ minWidth: 110 }}>Callback URL</strong>
            <Copyable value={webhookUrl} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ minWidth: 110 }}>Verify token</strong>
            <span style={{ fontSize: '0.82rem' }}>{t('wac.verifyTokenHint')}</span>
          </div>
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '0.84rem' }}>
            {t('wac.openMeta')} <FiExternalLink />
          </a>
        </div>
      </div>

      {/* ── credentials ────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h2>{t('wac.credentials')}</h2></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group">
                <label>Phone number ID</label>
                <input className="form-input" value={form.wa_cloud_phone_number_id}
                  onChange={e => setForm({ ...form, wa_cloud_phone_number_id: e.target.value })} placeholder="123456789012345" />
              </div>
              <div className="form-group">
                <label>WhatsApp Business Account ID</label>
                <input className="form-input" value={form.wa_cloud_waba_id}
                  onChange={e => setForm({ ...form, wa_cloud_waba_id: e.target.value })} placeholder="123456789012345" />
              </div>
            </div>
            <div className="form-group">
              <label>{t('wac.accessToken')}</label>
              <input className="form-input" type="password" value={form.wa_cloud_token}
                onChange={e => setForm({ ...form, wa_cloud_token: e.target.value })}
                placeholder={st.tokenSet ? t('wac.tokenKeep') : 'EAA…'} />
              <small style={{ color: 'var(--slate-400)' }}>{t('wac.tokenHelp')}</small>
            </div>
            <div className="form-group">
              <label>{t('wac.adminNumbers')}</label>
              <input className="form-input" value={form.wa_admin_numbers}
                onChange={e => setForm({ ...form, wa_admin_numbers: e.target.value })} placeholder="994703900007, 994501234567" />
              <small style={{ color: 'var(--slate-400)' }}>{t('wac.adminHelp')}</small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('wac.tplPayment')}</label>
                <input className="form-input" value={form.wa_tpl_payment_reminder}
                  onChange={e => setForm({ ...form, wa_tpl_payment_reminder: e.target.value })} placeholder="payment_reminder" />
              </div>
              <div className="form-group">
                <label>{t('wac.tplInquiry')}</label>
                <input className="form-input" value={form.wa_tpl_new_inquiry}
                  onChange={e => setForm({ ...form, wa_tpl_new_inquiry: e.target.value })} placeholder="new_inquiry" />
              </div>
            </div>
            <div style={{ padding: '0.7rem 0.9rem', background: 'var(--slate-50)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
              {t('wac.windowNote')}
            </div>
            <div className="form-actions" style={{ margin: 0 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <FiSave /> {saving ? '…' : saved ? t('ui.saved') : t('ui.save')}
              </button>
              <button className="btn btn-outline" type="button"
                onClick={() => api.waCloudTemplates().then(setTemplates).catch(e => alert(e.message))}>
                {t('wac.loadTemplates')}
              </button>
            </div>
          </form>

          {templates && (
            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.86rem', marginBottom: 8 }}>{t('wac.templates')} ({templates.length})</h4>
              {templates.length === 0 ? (
                <p style={{ fontSize: '0.84rem', color: 'var(--slate-400)' }}>{t('wac.noTemplates')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {templates.map(tp => (
                    <div key={`${tp.name}:${tp.language}`} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      padding: '0.45rem 0.7rem', background: 'var(--slate-50)', borderRadius: 7, fontSize: '0.82rem',
                    }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{tp.name}</span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--slate-400)' }}>{tp.language}</span>
                        <span className={`badge ${tp.status === 'APPROVED' ? 'green' : tp.status === 'REJECTED' ? 'red' : 'amber'}`}>
                          {tp.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── test send ──────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h2>{t('wac.testSend')}</h2></div>
        <div className="card-body">
          <form onSubmit={sendTest}>
            <div className="form-row">
              <div className="form-group">
                <label>{t('wac.to')}</label>
                <input className="form-input" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="994703900007" required />
              </div>
              <div className="form-group">
                <label>{t('wac.message')}</label>
                <input className="form-input" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Test" required />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={sending || !live}>
              <FiSend /> {sending ? '…' : t('wac.send')}
            </button>
            {!live && <small style={{ marginLeft: 10, color: 'var(--slate-400)' }}>{t('wac.configureFirst')}</small>}
          </form>
          {testResult && (
            <div style={{
              marginTop: '0.9rem', padding: '0.65rem 0.9rem', borderRadius: 8, fontSize: '0.85rem',
              background: testResult.ok ? 'var(--green-bg)' : 'var(--red-bg)',
              color: testResult.ok ? 'var(--green)' : 'var(--red)',
            }}>{testResult.text}</div>
          )}
        </div>
      </div>

      {/* ── conversations ──────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h2><FiMessageSquare style={{ marginRight: 6 }} />{t('wac.conversations')}</h2></div>
        <div className="card-body" style={{ padding: convos.length ? 0 : undefined }}>
          {!convos.length ? (
            <p style={{ color: 'var(--slate-400)', fontSize: '0.88rem', margin: 0 }}>{t('wac.noConversations')}</p>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {convos.map(c => (
                <button key={c.wa_id} onClick={() => openThread(c.wa_id)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none',
                    border: 'none', borderBottom: '1px solid var(--slate-100)', padding: '0.7rem 1.1rem',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: c.window_open ? 'var(--green)' : 'var(--slate-300)',
                  }} title={c.window_open ? t('wac.windowOpen') : t('wac.windowClosed')} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {c.student_name ? `${c.student_name} ${c.student_surname || ''}` : (c.profile_name || c.wa_id)}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--slate-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.last_message || '—'}
                    </span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)', flexShrink: 0 }}>
                    {c.role === 'admin' ? '👨‍🏫' : ''} {c.last_inbound_at ? formatDateTime(c.last_inbound_at) : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {thread && (
        <div className="modal-overlay" onClick={() => setThread(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{thread.wa_id} {thread.window_open ? '🟢' : '⚪'}</h3>
              <button className="modal-close" onClick={() => setThread(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {thread.loading ? t('ui.loading') : (thread.messages || []).map(m => (
                <div key={m.message_id} style={{
                  display: 'flex', justifyContent: m.inbound ? 'flex-start' : 'flex-end', marginBottom: 7,
                }}>
                  <div style={{
                    maxWidth: '78%', padding: '0.45rem 0.7rem', borderRadius: 10, fontSize: '0.84rem',
                    background: m.inbound ? 'var(--slate-100)' : 'var(--primary)',
                    color: m.inbound ? 'var(--slate-700)' : '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.body || `[${m.type}]`}
                    <div style={{ fontSize: '0.64rem', opacity: 0.65, marginTop: 3 }}>
                      {formatDateTime(m.at)}{!m.inbound && m.status ? ` · ${m.status}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
