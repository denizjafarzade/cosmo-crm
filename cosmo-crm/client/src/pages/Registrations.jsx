import React, { useState, useEffect } from 'react';
import { FiUserPlus, FiCheck, FiX, FiTrash2, FiMessageCircle, FiFilter } from 'react-icons/fi';
import { t } from '../i18n';
import api from '../api';

const STATUS_LABELS = () => ({ new: t('st.new'), contacted: t('st.contacted'), enrolled: t('st.enrolled'), rejected: t('st.rejected') });
const SECTORS = { az: 'Azerbaijani', ru: 'Russian', en: 'English', tr: 'Turkish' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Compact per-mode rating pills for the grid: platform + username on top,
// then Blitz / Rapid with their rating and games played.
function ratingCell(r) {
  if (!r.chess_username) return <span style={{ color: 'var(--slate-300)' }}>—</span>;
  const pill = (label, rating, games) => (
    <div style={{
      background: 'var(--slate-50)', border: '1px solid var(--slate-200)',
      borderRadius: 7, padding: '2px 7px', textAlign: 'center', minWidth: 54,
    }}>
      <div style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--slate-400)' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.2, color: rating != null ? 'var(--primary)' : 'var(--slate-300)' }}>{rating ?? '—'}</div>
      <div style={{ fontSize: '0.58rem', color: 'var(--slate-400)' }}>{games != null ? `${games} ${t('students.games')}` : '—'}</div>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginBottom: 3 }}>
        {r.chess_platform === 'lichess' ? 'Lichess' : 'Chess.com'} · {r.chess_username}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {pill(t('students.blitz'), r.blitz_rating, r.blitz_games)}
        {pill(t('students.rapid'), r.rapid_rating, r.rapid_games)}
      </div>
    </div>
  );
}

function ratingsText(r) {
  if (!r.chess_username) return '—';
  const platform = r.chess_platform === 'lichess' ? 'Lichess' : 'Chess.com';
  const part = (label, rating, games) =>
    `${label} ${rating ?? '—'}${games != null ? ` (${games})` : ''}`;
  return `${platform} ${r.chess_username} · ${part('Blitz', r.blitz_rating, r.blitz_games)} · ${part('Rapid', r.rapid_rating, r.rapid_games)}`;
}

// Applicant's preferred windows, parsed from "<dayIndex>|<HH:MM-HH:MM>".
function wantedWindows(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map(s => {
    const [d, slot] = String(s).split('|');
    const [from, to] = String(slot || '').split('-');
    return { day: Number(d), from, to };
  }).filter(w => w.from && w.to);
}

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// A group slot fits when it starts inside one of the applicant's windows.
function slotMatches(slot, windows) {
  const start = toMin(slot.time);
  return windows.some(w => w.day === slot.day_of_week && start >= toMin(w.from) && start < toMin(w.to));
}

// Stored as JSON array of "<dayIndex>|<HH:MM-HH:MM>".
function availabilityList(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map(s => {
    const [d, slot] = String(s).split('|');
    return `${DAY_NAMES[Number(d)] ?? '?'} ${slot ?? ''}`.trim();
  });
}
const STATUS_BADGE = { new: 'blue', contacted: 'amber', enrolled: 'green', rejected: 'red' };

function timeAgo(iso) {
  if (!iso) return '';
  const utc = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z';
  const s = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Registrations() {
  const [regs, setRegs] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [groups, setGroups] = useState([]);
  const [enroll, setEnroll] = useState(null); // { reg, mode, group_id, newGroup }
  const [enrollError, setEnrollError] = useState('');
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, time: '16:00' });

  const doEnroll = async () => {
    setSaving(true);
    setEnrollError('');
    try {
      const payload = enroll.mode === 'existing'
        ? { group_id: enroll.group_id }
        : { new_group: enroll.newGroup };
      if (enroll.mode === 'existing' && !enroll.group_id) throw new Error(t('reg.pickGroup'));
      if (enroll.mode === 'new' && !enroll.newGroup.name.trim()) throw new Error(t('reg.groupNameRequired'));
      await api.enrollRegistration(enroll.reg.id, payload);
      setEnroll(null);
      setSelected(null);
      load();
    } catch (e) {
      setEnrollError(e.message || 'Failed');
    }
    setSaving(false);
  };

  const addSlot = () => setEnroll(en => ({
    ...en, newGroup: { ...en.newGroup, schedules: [...en.newGroup.schedules, { ...newSlot }] },
  }));
  const removeSlot = (i) => setEnroll(en => ({
    ...en, newGroup: { ...en.newGroup, schedules: en.newGroup.schedules.filter((_, j) => j !== i) },
  }));

  const load = () => {
    api.getRegistrations(filter || undefined)
      .then(rows => setRegs(Array.isArray(rows) ? rows : []))
      .catch(() => setRegs([]));
  };

  useEffect(() => { load(); }, [filter]);

  const openDetail = (r) => { setSelected(r); setNotes(r.notes || ''); setNoteSaved(false); setNoteError(''); };

  // Enrolling is not just a status change — it creates the student and places
  // them in a group, so it opens its own dialog.
  const updateStatus = async (id, status) => {
    if (status === 'enrolled') {
      const reg = selected;
      api.getGroups().then(g => setGroups(Array.isArray(g) ? g : [])).catch(() => setGroups([]));
      // Close the detail dialog first — two stacked overlays left this one behind.
      setSelected(null);
      setEnroll({ reg, mode: 'existing', group_id: '', newGroup: { name: '', lesson_duration_minutes: 60, homework_start_from: 1, schedules: [] } });
      return;
    }
    setSaving(true);
    try {
      await api.updateRegistration(id, { status, notes });
      setSelected(null);
      load();
    } catch (e) {
      setNoteError(e.message || 'Could not save');
    }
    setSaving(false);
  };

  // Notes have their own save so they can be kept without touching the status
  // or closing the dialog.
  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    setNoteError('');
    try {
      await api.updateRegistration(selected.id, { notes });
      setNoteSaved(true);
      setSelected(s => (s ? { ...s, notes } : s));
      setRegs(rs => rs.map(r => (r.id === selected.id ? { ...r, notes } : r)));
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (e) {
      setNoteError(e.message || 'Could not save');
    }
    setSaving(false);
  };

  const doDelete = async (id) => {
    await api.deleteRegistration(id);
    setConfirmDelete(null);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const counts = regs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const allCount = regs.length;

  const filtered = filter ? regs.filter(r => r.status === filter) : regs;

  return (
    <>
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>{t('ui.delete_registration')}</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>Delete registration for <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>{t('ui.cancel')}</button>
                <button className="btn btn-danger" onClick={() => doDelete(confirmDelete.id)}>{t('ui.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {enroll && (() => { const wanted = wantedWindows(enroll.reg.availability); return (
        <div className="modal-overlay" onClick={() => setEnroll(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{t('reg.enrollTitle')} — {enroll.reg.name}</h3>
              <button className="modal-close" onClick={() => setEnroll(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                {t('reg.enrollHint')}
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                <button className={`btn btn-sm ${enroll.mode === 'existing' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setEnroll(en => ({ ...en, mode: 'existing' }))}>{t('reg.existingGroup')}</button>
                <button className={`btn btn-sm ${enroll.mode === 'new' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setEnroll(en => ({ ...en, mode: 'new' }))}>{t('reg.newGroup')}</button>
              </div>

              {enroll.mode === 'existing' ? (
                <div className="form-group">
                  <label className="form-label">{t('students.group')}</label>
                  {wanted.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginBottom: 8 }}>
                      {t('reg.prefers')}: {wanted.map((w, i) => (
                        <span key={i} className="badge slate" style={{ marginRight: 4, fontSize: '0.68rem' }}>
                          {DAY_NAMES[w.day]} {w.from}–{w.to}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {groups.map(g => {
                      const slots = g.schedules || [];
                      const matches = slots.filter(s => slotMatches(s, wanted)).length;
                      const chosen = String(enroll.group_id) === String(g.id);
                      return (
                        <button key={g.id} type="button"
                          onClick={() => setEnroll(en => ({ ...en, group_id: String(g.id) }))}
                          style={{
                            textAlign: 'left', cursor: 'pointer', font: 'inherit',
                            padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)',
                            border: `1.5px solid ${chosen ? 'var(--primary)' : matches ? 'var(--green)' : 'var(--slate-200)'}`,
                            background: chosen ? 'var(--primary-bg)' : matches ? 'var(--green-bg)' : 'var(--white)',
                          }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {g.name}
                            {matches > 0 && <span className="badge green" style={{ marginLeft: 6, fontSize: '0.65rem' }}>{matches} {t('reg.matching')}</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: 2 }}>
                            {g.student_count} · {t('dashboard.lesson')} #{g.current_lesson_number}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                            {slots.length === 0
                              ? <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>{t('reg.noSchedule')}</span>
                              : slots.map((s, i) => {
                                  const fits = slotMatches(s, wanted);
                                  return (
                                    <span key={i} className={`badge ${fits ? 'green' : 'slate'}`} style={{ fontSize: '0.68rem' }}>
                                      {DAY_NAMES[s.day_of_week]} {s.time}
                                    </span>
                                  );
                                })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{t('reg.groupName')} *</label>
                      <input className="form-input" value={enroll.newGroup.name}
                        onChange={e => setEnroll(en => ({ ...en, newGroup: { ...en.newGroup, name: e.target.value } }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('reg.duration')}</label>
                      <input className="form-input" type="number" min="15" step="5" value={enroll.newGroup.lesson_duration_minutes}
                        onChange={e => setEnroll(en => ({ ...en, newGroup: { ...en.newGroup, lesson_duration_minutes: parseInt(e.target.value) || 60 } }))} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('reg.schedule')}</label>
                    {enroll.newGroup.schedules.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginBottom: 6 }}>{t('reg.noSlots')}</div>
                    )}
                    {enroll.newGroup.schedules.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="badge blue">{DAY_NAMES[s.day_of_week]}</span>
                        <span>{s.time}</span>
                        <button className="btn btn-sm btn-icon" style={{ marginLeft: 'auto', color: 'var(--red)' }}
                          onClick={() => removeSlot(i)}><FiTrash2 /></button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <select className="form-input" style={{ width: 'auto' }} value={newSlot.day_of_week}
                        onChange={e => setNewSlot(s => ({ ...s, day_of_week: parseInt(e.target.value) }))}>
                        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      <input className="form-input" type="time" style={{ width: 'auto' }} value={newSlot.time}
                        onChange={e => setNewSlot(s => ({ ...s, time: e.target.value }))} />
                      <button className="btn btn-sm btn-outline" onClick={addSlot}>{t('reg.addSlot')}</button>
                    </div>
                  </div>
                </>
              )}

              {enrollError && <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 8 }}>{enrollError}</div>}
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setEnroll(null)}>{t('common.cancel')}</button>
                <button className="btn btn-primary" onClick={doEnroll} disabled={saving}>
                  {saving ? '…' : t('reg.enrollAction')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ); })()}

      {selected && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{selected.name}</h3>
              <button className="modal-close" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div><div className="form-label">{t('ui.phone')}</div><div style={{ fontWeight: 600 }}>{selected.phone}</div></div>
                <div><div className="form-label">{t('ui.level')}</div><div>{selected.level || '—'}</div></div>
                <div><div className="form-label">{t('ui.date_of_birth')}</div><div>{selected.birth_date || '—'}</div></div>
                <div><div className="form-label">{t('ui.sector')}</div><div>{SECTORS[selected.sector] || '—'}</div></div>
                <div><div className="form-label">{t('ui.online_ratings')}</div><div>{ratingsText(selected)}</div></div>
                <div><div className="form-label">{t('ui.fide_rating')}</div><div>{selected.fide_rating || '—'}</div></div>
                <div><div className="form-label">{t('ui.received')}</div><div>{timeAgo(selected.created_at)}</div></div>
              </div>
              {availabilityList(selected.availability).length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="form-label">{t('ui.available')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {availabilityList(selected.availability).map((a, i) => (
                      <span key={i} className="badge blue" style={{ fontSize: '0.7rem' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.message && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="form-label">{t('ui.message')}</div>
                  <p style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>{selected.message}</p>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">{t('ui.internal_notes')}</label>
                <textarea
                  className="form-control" rows={3} value={notes}
                  onChange={e => { setNotes(e.target.value); setNoteSaved(false); setNoteError(''); }}
                  placeholder="Add notes about this inquiry..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <button
                    type="button" className="btn btn-sm btn-primary"
                    onClick={saveNotes}
                    disabled={saving || notes === (selected.notes || '')}
                  >
                    {saving ? 'Saving…' : 'Save notes'}
                  </button>
                  {noteSaved && <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>✓ Saved</span>}
                  {noteError && <span style={{ fontSize: '0.8rem', color: 'var(--red)' }}>{noteError}</span>}
                  {!noteSaved && !noteError && notes !== (selected.notes || '') && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--slate-400)' }}>{t('ui.unsaved_changes')}</span>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div className="form-label" style={{ marginBottom: '0.5rem' }}>{t('ui.update_status')}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_LABELS()).map(([s, label]) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${selected.status === s ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => updateStatus(selected.id, s)}
                      disabled={saving}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <a
                  href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FiMessageCircle /> WhatsApp
                </a>
                <button className="btn btn-danger" onClick={() => { setSelected(null); setConfirmDelete(selected); }}>
                  <FiTrash2 /> {t('ui.delete')}
                </button>
                <button className="btn btn-outline" onClick={() => setSelected(null)}>{t('ui.close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>{t('registrations.title')}</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginTop: 2 }}>{t('reg.subtitle')}</p>
        </div>
      </div>

      <div className="page-body">
        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('')}>
            All {allCount > 0 && <span className="badge slate" style={{ marginLeft: 4 }}>{allCount}</span>}
          </button>
          {Object.entries(STATUS_LABELS).map(([s, label]) => (
            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
              {label} {counts[s] > 0 && <span className={`badge ${STATUS_BADGE[s]}`} style={{ marginLeft: 4 }}>{counts[s]}</span>}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <FiUserPlus style={{ fontSize: 32, marginBottom: 8 }} />
                <p>No {filter || ''} registrations yet.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('students.name')}</th>
                  <th>{t('reg.phone')}</th>
                  <th>{t('students.level')}</th>
                  <th>{t('students.onlineRatings')}</th>
                  <th>{t('students.fide')}</th>
                  <th>{t('content.status')}</th>
                  <th>{t('reg.received')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.phone}</td>
                    <td>{r.level || '—'}</td>
                    <td>{ratingCell(r)}</td>
                    <td>{r.fide_rating || '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || 'slate'}`}>{STATUS_LABELS()[r.status] || r.status}</span></td>
                    <td style={{ color: 'var(--slate-500)', fontSize: '0.85rem' }}>{timeAgo(r.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-outline" style={{ color: 'var(--red)' }} onClick={() => setConfirmDelete(r)}>
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
