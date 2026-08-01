import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiDollarSign, FiX, FiCalendar, FiRefreshCw, FiUserX } from 'react-icons/fi';
import api from '../api';
import AttendanceCalendar from './AttendanceCalendar';

// Level keys stored in the database. 'beginner', 'intermediate', 'advanced' are the
// original values kept as-is for backward compatibility with existing student records.
const LEVELS = ['new_to_chess', 'beginner', 'intermediate', 'advanced', 'expert', 'not_sure'];
const LEVEL_LABELS = {
  new_to_chess: 'New to Chess',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
  not_sure: 'Not Sure',
};
const levelLabel = (level) => LEVEL_LABELS[level] || level;
const EMPTY = { name: '', surname: '', whatsapp_number: '', parent_whatsapp: '', level: 'beginner', fide_rating: '', coach_id: '', group_id: '', notes: '', birth_date: '', sector: '', chess_platform: '', chess_username: '' };
const SECTORS = { az: 'Azerbaijani', ru: 'Russian', en: 'English', tr: 'Turkish' };
const PAYMENT_CYCLE = 8;

// How far past the payment cycle a student is, and how severe that is.
//  - overdue > 4 with no recorded reason -> red (offer to remove from the list)
//  - overdue > 0 -> orange
function paymentSeverity(s) {
  const over = (s.lessons_since_payment || 0) - PAYMENT_CYCLE;
  if (over <= 0) return { level: 'ok', over: 0 };
  const hasReason = !!(s.payment_excuse_reason && s.payment_excuse_reason.trim());
  if (over > 4 && !hasReason) return { level: 'critical', over, hasReason };
  return { level: 'late', over, hasReason };
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [filters, setFilters] = useState({ level: '', group_id: '', payment_status: '' });
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'pay'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', notes: '' });
  const [historyStudent, setHistoryStudent] = useState(null); // { student, payments }
  const [calendarStudent, setCalendarStudent] = useState(null);
  const [reasonFor, setReasonFor] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [removeFor, setRemoveFor] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (filters.level) params.level = filters.level;
    if (filters.group_id) params.group_id = filters.group_id;
    if (filters.payment_status) params.payment_status = filters.payment_status;
    api.getStudents(params).then(setStudents);
  }, [filters]);

  useEffect(() => { load(); api.getGroups().then(setGroups); api.getCoaches().then(setCoaches); }, [load]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setModal('add'); };
  const openEdit = (s) => { setForm({ name: s.name, surname: s.surname, whatsapp_number: s.whatsapp_number || '', parent_whatsapp: s.parent_whatsapp || '', level: s.level, fide_rating: s.fide_rating ?? '', coach_id: s.coach_id || '', group_id: s.group_id || '', notes: s.notes || '', birth_date: s.birth_date || '', sector: s.sector || '', chess_platform: s.chess_platform || '', chess_username: s.chess_username || '' }); setEditId(s.id); setModal('edit'); };
  const openPay = (s) => { setEditId(s.id); setPayForm({ amount: '', notes: '' }); setModal('pay'); };
  const openHistory = async (s) => {
    setHistoryStudent({ student: s, payments: null });
    const payments = await api.getPayments({ student_id: s.id });
    setHistoryStudent({ student: s, payments });
  };

  const save = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      coach_id: form.coach_id || null,
      group_id: form.group_id || null,
      fide_rating: form.fide_rating === '' ? null : Number(form.fide_rating),
    };
    if (editId) await api.updateStudent(editId, data);
    else await api.createStudent(data);
    setModal(null);
    load();
  };

  const confirmPay = async (e) => {
    e.preventDefault();
    await api.confirmPayment(editId, payForm);
    setModal(null);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Deactivate this student?')) return;
    await api.deleteStudent(id);
    load();
  };

  const paymentBadge = (s) => {
    const sev = paymentSeverity(s);
    if (sev.level === 'critical') return <span className="badge red">{sev.over} lessons overdue</span>;
    if (sev.level === 'late') return (
      <span className="badge amber" title={sev.hasReason ? `Reason: ${s.payment_excuse_reason}` : undefined}>
        {sev.over} late{sev.hasReason ? ' · reason noted' : ''}
      </span>
    );
    if (s.payment_status === 'paid') return <span className="badge green">Paid</span>;
    return <span className="badge amber">Due ({s.lessons_since_payment})</span>;
  };

  const ratingCell = (s) => {
    if (!s.chess_username) return <span style={{ color: 'var(--slate-300)' }}>—</span>;
    return (
      <div style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
        <div style={{ color: 'var(--slate-400)' }}>
          {s.chess_platform === 'lichess' ? 'Lichess' : 'Chess.com'} · {s.chess_username}
        </div>
        <div>
          <strong>B</strong> {s.blitz_rating ?? '—'} &nbsp; <strong>R</strong> {s.rapid_rating ?? '—'}
        </div>
      </div>
    );
  };

  const openReason = (s) => { setReasonFor(s); setReasonText(s.payment_excuse_reason || ''); };

  const saveReason = async () => {
    await api.setPaymentReason(reasonFor.id, reasonText);
    setReasonFor(null);
    load();
  };

  const doRemove = async () => {
    await api.deleteStudent(removeFor.id);
    setRemoveFor(null);
    load();
  };

  const doRefreshRatings = async (s) => {
    setRefreshingId(s.id);
    try { await api.refreshRatings(s.id); load(); }
    catch (e) { alert(e.message); }
    setRefreshingId(null);
  };

  return (
    <>
      <div className="page-header">
        <h1>Students</h1>
        <button className="btn btn-primary" onClick={openAdd}><FiPlus /> Add Student</button>
      </div>
      <div className="page-body">
        <div className="filters-bar">
          <select className="form-input" value={filters.level} onChange={e => setFilters(f => ({ ...f, level: e.target.value }))}>
            <option value="">All Levels</option>
            {LEVELS.map(l => <option key={l} value={l}>{levelLabel(l)}</option>)}
          </select>
          <select className="form-input" value={filters.group_id} onChange={e => setFilters(f => ({ ...f, group_id: e.target.value }))}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="form-input" value={filters.payment_status} onChange={e => setFilters(f => ({ ...f, payment_status: e.target.value }))}>
            <option value="">All Payment</option>
            <option value="paid">Paid</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
          </select>
          <span style={{ color: 'var(--slate-400)', fontSize: '0.85rem' }}>{students.length} students</span>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th>Online Ratings</th>
                  <th>FIDE</th>
                  <th>Group</th>
                  <th>Payment</th>
                  <th>Lessons</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const sev = paymentSeverity(s);
                  return (
                  <tr key={s.id} style={
                    sev.level === 'critical' ? { background: 'var(--red-bg)' }
                    : sev.level === 'late' ? { background: 'var(--amber-bg)' }
                    : undefined
                  }>
                    <td>
                      <button type="button" className="link-btn" onClick={() => openHistory(s)} title="View payment records" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--primary, #4f46e5)' }}>
                        <strong>{s.name} {s.surname}</strong>
                      </button>
                      <br /><span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{s.whatsapp_number}</span>
                    </td>
                    <td><span className="badge blue">{levelLabel(s.level)}</span></td>
                    <td>{ratingCell(s)}</td>
                    <td>{s.fide_rating != null ? s.fide_rating : '—'}</td>
                    <td>{s.group_name || '—'}</td>
                    <td>
                      {paymentBadge(s)}
                      {sev.level !== 'ok' && (
                        <>
                          <br />
                          <button className="btn btn-sm btn-outline" style={{ marginTop: 4, fontSize: '0.7rem' }} onClick={() => openReason(s)}>
                            {sev.hasReason ? 'Edit reason' : 'Add reason'}
                          </button>
                        </>
                      )}
                    </td>
                    <td>{s.lessons_since_payment}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-outline btn-icon" onClick={() => setCalendarStudent(s)} title="Attendance calendar"><FiCalendar /></button>
                        <button className="btn btn-sm btn-outline btn-icon" onClick={() => openEdit(s)} title="Edit"><FiEdit2 /></button>
                        {s.chess_username && (
                          <button className="btn btn-sm btn-outline btn-icon" disabled={refreshingId === s.id} onClick={() => doRefreshRatings(s)} title="Refresh online ratings"><FiRefreshCw /></button>
                        )}
                        <button className="btn btn-sm btn-green btn-icon" onClick={() => openPay(s)} title="Confirm Payment"><FiDollarSign /></button>
                        {sev.level === 'critical' ? (
                          <button className="btn btn-sm btn-red" onClick={() => setRemoveFor(s)} title="Remove from student list"><FiUserX /> Remove</button>
                        ) : (
                          <button className="btn btn-sm btn-red btn-icon" onClick={() => remove(s.id)} title="Deactivate"><FiTrash2 /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editId ? 'Edit' : 'Add'} Student</h3><button className="modal-close" onClick={() => setModal(null)}><FiX /></button></div>
            <div className="modal-body">
              <form onSubmit={save}>
                <div className="form-row">
                  <div className="form-group"><label>Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                  <div className="form-group"><label>Surname</label><input className="form-input" value={form.surname} onChange={e => setForm(f => ({ ...f, surname: e.target.value }))} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>WhatsApp #</label><input className="form-input" value={form.whatsapp_number} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))} placeholder="994501234567" /></div>
                  <div className="form-group"><label>Parent WhatsApp</label><input className="form-input" value={form.parent_whatsapp} onChange={e => setForm(f => ({ ...f, parent_whatsapp: e.target.value }))} placeholder="994501234567" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Level</label><select className="form-input" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>{LEVELS.map(l => <option key={l} value={l}>{levelLabel(l)}</option>)}</select></div>
                  <div className="form-group"><label>Group</label><select className="form-input" value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}><option value="">None</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Date of Birth</label><input className="form-input" type="date" value={form.birth_date || ''} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} /></div>
                  <div className="form-group">
                    <label>Sector</label>
                    <select className="form-input" value={form.sector || ''} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                      <option value="">—</option>
                      {Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Chess Platform</label>
                    <select className="form-input" value={form.chess_platform || ''} onChange={e => setForm(f => ({ ...f, chess_platform: e.target.value }))}>
                      <option value="">None</option>
                      <option value="lichess">Lichess.org</option>
                      <option value="chesscom">Chess.com</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Username</label>
                    <input className="form-input" value={form.chess_username || ''} disabled={!form.chess_platform}
                      onChange={e => setForm(f => ({ ...f, chess_username: e.target.value }))} placeholder="blitz & rapid pulled automatically" />
                  </div>
                </div>
                <div className="form-group">
                  <label>FIDE Rating</label>
                  <input className="form-input" type="number" value={form.fide_rating} onChange={e => setForm(f => ({ ...f, fide_rating: e.target.value }))} placeholder="Empty = no official FIDE rating" />
                </div>
                <div className="form-group"><label>Coach</label><select className="form-input" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}><option value="">None</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="form-group"><label>Notes</label><textarea className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <div className="form-actions"><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" type="submit">{editId ? 'Update' : 'Add'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {reasonFor && (
        <div className="modal-overlay" onClick={() => setReasonFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Late payment reason — {reasonFor.name} {reasonFor.surname}</h3>
              <button className="modal-close" onClick={() => setReasonFor(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                With a reason recorded, this student stays orange instead of escalating to red,
                and the automatic “lessons will be stopped” warning is not sent.
              </p>
              <div className="form-group">
                <label>Reason</label>
                <textarea className="form-input" value={reasonText} onChange={e => setReasonText(e.target.value)}
                  placeholder="e.g. agreed to pay after the exam period" />
              </div>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setReasonFor(null)}>Cancel</button>
                {reasonFor.payment_excuse_reason && (
                  <button className="btn btn-outline" style={{ color: 'var(--red)' }} onClick={() => { setReasonText(''); api.setPaymentReason(reasonFor.id, '').then(() => { setReasonFor(null); load(); }); }}>Clear</button>
                )}
                <button className="btn btn-primary" onClick={saveReason}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {removeFor && (
        <div className="modal-overlay" onClick={() => setRemoveFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Remove student?</h3>
              <button className="modal-close" onClick={() => setRemoveFor(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{removeFor.name} {removeFor.surname}</strong> is{' '}
                <strong>{paymentSeverity(removeFor).over} lessons</strong> past the payment cycle with no reason recorded.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
                Removing takes them off the student list (their records are kept). You can add a reason instead if the delay is agreed.
              </p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setRemoveFor(null)}>Cancel</button>
                <button className="btn btn-outline" onClick={() => { const s = removeFor; setRemoveFor(null); openReason(s); }}>Add reason instead</button>
                <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={doRemove}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {calendarStudent && (
        <AttendanceCalendar student={calendarStudent} onClose={() => setCalendarStudent(null)} />
      )}

      {historyStudent && (
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Payment Records — {historyStudent.student.name} {historyStudent.student.surname}</h3>
              <button className="modal-close" onClick={() => setHistoryStudent(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12 }}>
                {paymentBadge(historyStudent.student)}{' '}
                <span style={{ fontSize: '0.85rem', color: 'var(--slate-400)' }}>
                  {historyStudent.student.lessons_since_payment} lessons since last payment
                </span>
              </div>
              {historyStudent.payments === null ? (
                <p style={{ color: 'var(--slate-400)' }}>Loading…</p>
              ) : historyStudent.payments.length === 0 ? (
                <p style={{ color: 'var(--slate-400)' }}>No payment records yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Amount</th><th>Lessons</th><th>Notes</th></tr></thead>
                    <tbody>
                      {historyStudent.payments.map(p => (
                        <tr key={p.id}>
                          <td>{(p.confirmed_at || '').slice(0, 10)}</td>
                          <td>{p.amount != null ? p.amount : '—'}</td>
                          <td>{p.lessons_covered != null ? p.lessons_covered : '—'}</td>
                          <td>{p.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modal === 'pay' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Payment</h3><button className="modal-close" onClick={() => setModal(null)}><FiX /></button></div>
            <div className="modal-body">
              <form onSubmit={confirmPay}>
                <div className="form-group"><label>Amount (optional)</label><input className="form-input" type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div className="form-group"><label>Notes</label><textarea className="form-input" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <div className="form-actions"><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" type="submit">Confirm Paid</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
