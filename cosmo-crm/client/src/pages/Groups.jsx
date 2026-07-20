import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiX, FiUsers, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import api from '../api';

const EMPTY = { name: '', whatsapp_group_id: '', whatsapp_group_name: '', coach_id: '', auto_increment_lessons: true, reminder_minutes_before: 60, reminder_target: 'group', homework_start_from: 1 };

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  const load = () => { api.getGroups().then(setGroups); api.getCoaches().then(setCoaches); };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    await api.createGroup({ ...form, coach_id: form.coach_id || null });
    setModal(false);
    load();
  };

  const remove = async (id) => {
    await api.deleteGroup(id);
    setConfirmDelete(null);
    load();
  };

  return (
    <>
      <div className="page-header">
        <h1>Groups</h1>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}><FiPlus /> New Group</button>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {groups.map(g => (
            <Link to={`/groups/${g.id}`} key={g.id} className="card" style={{ textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.15s' }}>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>{g.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                    <FiUsers style={{ marginRight: 4 }} />{g.student_count} students &middot; Lesson #{g.current_lesson_number}
                  </div>
                  {g.coach_name && <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: 2 }}>Coach: {g.coach_name}</div>}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {g.auto_increment_lessons ? <span className="badge green">Auto</span> : <span className="badge slate">Manual</span>}
                    <span className="badge blue">HW from #{g.homework_start_from || 1}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btn-sm btn-icon"
                    style={{ color: 'var(--red)' }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({ id: g.id, name: g.name }); }}
                    title="Delete group"
                  ><FiTrash2 /></button>
                  <FiChevronRight style={{ color: 'var(--slate-300)', fontSize: '1.2rem' }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Delete Group</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>"{confirmDelete.name}"</strong>? Students will be unassigned.</p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={() => remove(confirmDelete.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New group modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>New Group</h3><button className="modal-close" onClick={() => setModal(false)}><FiX /></button></div>
            <div className="modal-body">
              <form onSubmit={save}>
                <div className="form-group"><label>Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="form-group"><label>WA Group ID</label><input className="form-input" value={form.whatsapp_group_id} onChange={e => setForm(f => ({ ...f, whatsapp_group_id: e.target.value }))} placeholder="...@g.us" /></div>
                <div className="form-group"><label>Coach</label><select className="form-input" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}><option value="">None</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="form-group">
                  <label>Start from Homework #</label>
                  <input className="form-input" type="number" min="1" value={form.homework_start_from} onChange={e => setForm(f => ({ ...f, homework_start_from: parseInt(e.target.value) || 1 }))} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>This group's lesson 1 will get homework #{form.homework_start_from}, lesson 2 → #{(form.homework_start_from || 1) + 1}, etc.</span>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.auto_increment_lessons} onChange={e => setForm(f => ({ ...f, auto_increment_lessons: e.target.checked }))} />
                  <label style={{ margin: 0 }}>Auto-increment lessons on schedule</label>
                </div>
                <div className="form-actions"><button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" type="submit">Create</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
