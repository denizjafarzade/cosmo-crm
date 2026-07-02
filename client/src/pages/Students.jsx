import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiDollarSign, FiX } from 'react-icons/fi';
import api from '../api';

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
const EMPTY = { name: '', surname: '', whatsapp_number: '', parent_whatsapp: '', level: 'beginner', fide_rating: '', coach_id: '', group_id: '', notes: '' };

export default function Students() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [filters, setFilters] = useState({ level: '', group_id: '', payment_status: '' });
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'pay'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', notes: '' });

  const load = useCallback(() => {
    const params = {};
    if (filters.level) params.level = filters.level;
    if (filters.group_id) params.group_id = filters.group_id;
    if (filters.payment_status) params.payment_status = filters.payment_status;
    api.getStudents(params).then(setStudents);
  }, [filters]);

  useEffect(() => { load(); api.getGroups().then(setGroups); api.getCoaches().then(setCoaches); }, [load]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setModal('add'); };
  const openEdit = (s) => { setForm({ name: s.name, surname: s.surname, whatsapp_number: s.whatsapp_number || '', parent_whatsapp: s.parent_whatsapp || '', level: s.level, fide_rating: s.fide_rating ?? '', coach_id: s.coach_id || '', group_id: s.group_id || '', notes: s.notes || '' }); setEditId(s.id); setModal('edit'); };
  const openPay = (s) => { setEditId(s.id); setPayForm({ amount: '', notes: '' }); setModal('pay'); };

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
    if (s.payment_status === 'paid') return <span className="badge green">Paid</span>;
    if (s.payment_status === 'due') return <span className="badge amber">Due ({s.lessons_since_payment})</span>;
    return <span className="badge red">Overdue ({s.lessons_since_payment})</span>;
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
                  <th>FIDE Rating</th>
                  <th>Group</th>
                  <th>Payment</th>
                  <th>Lessons</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name} {s.surname}</strong><br /><span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{s.whatsapp_number}</span></td>
                    <td><span className="badge blue">{levelLabel(s.level)}</span></td>
                    <td>{s.fide_rating != null ? s.fide_rating : 'No rating'}</td>
                    <td>{s.group_name || '—'}</td>
                    <td>{paymentBadge(s)}</td>
                    <td>{s.lessons_since_payment}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline btn-icon" onClick={() => openEdit(s)} title="Edit"><FiEdit2 /></button>
                        <button className="btn btn-sm btn-green btn-icon" onClick={() => openPay(s)} title="Confirm Payment"><FiDollarSign /></button>
                        <button className="btn btn-sm btn-red btn-icon" onClick={() => remove(s.id)} title="Deactivate"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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
