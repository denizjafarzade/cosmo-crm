import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiX, FiUsers, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import { t } from '../i18n';
import api from '../api';

const EMPTY = { name: '', whatsapp_group_id: '', whatsapp_group_name: '', coach_id: '', auto_increment_lessons: true, reminder_minutes_before: 60, reminder_target: 'group', homework_start_from: 1, lesson_duration_minutes: 60 };

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
        <h1>{t('groups.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}><FiPlus /> {t('groups.new')}</button>
      </div>
      <div className="page-body">
        <div className="card-grid">
          {groups.map(g => (
            <Link to={`/groups/${g.id}`} key={g.id} className="card" style={{ textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.15s' }}>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>{g.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                    <FiUsers style={{ marginRight: 4 }} />{g.student_count} &middot; {t('dashboard.lesson')} #{g.current_lesson_number}
                  </div>
                  {g.coach_name && <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: 2 }}>{t('ui.coach')}: {g.coach_name}</div>}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {g.auto_increment_lessons ? <span className="badge green">{t('ui.auto')}</span> : <span className="badge slate">{t('ui.manual')}</span>}
                    <span className="badge blue">{t('grp.hwFrom')}{g.homework_start_from || 1}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btn-sm btn-icon"
                    style={{ color: 'var(--red)' }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({ id: g.id, name: g.name }); }}
                    title={t('ui.delete_group')}
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
              <h3>{t('ui.delete_group')}</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>{t('grp.deleteConfirm')} <strong>"{confirmDelete.name}"</strong></p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>{t('ui.cancel')}</button>
                <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={() => remove(confirmDelete.id)}>{t('ui.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New group modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('ui.new_group')}</h3><button className="modal-close" onClick={() => setModal(false)}><FiX /></button></div>
            <div className="modal-body">
              <form onSubmit={save}>
                <div className="form-group"><label>{t('ui.name_required')}</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="form-group"><label>{t('ui.wa_group_id')}</label><input className="form-input" value={form.whatsapp_group_id} onChange={e => setForm(f => ({ ...f, whatsapp_group_id: e.target.value }))} placeholder="...@g.us" /></div>
                <div className="form-group"><label>{t('ui.coach')}</label><select className="form-input" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}><option value="">{t('ui.none')}</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('ui.start_from_homework')}</label>
                    <input className="form-input" type="number" min="1" value={form.homework_start_from} onChange={e => setForm(f => ({ ...f, homework_start_from: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div className="form-group">
                    <label>{t('ui.lesson_duration_min')}</label>
                    <input className="form-input" type="number" min="15" step="5" value={form.lesson_duration_minutes} onChange={e => setForm(f => ({ ...f, lesson_duration_minutes: parseInt(e.target.value) || 60 }))} />
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)', display: 'block', marginTop: -6, marginBottom: 8 }}>{t('grp.durationHint')}</span>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.auto_increment_lessons} onChange={e => setForm(f => ({ ...f, auto_increment_lessons: e.target.checked }))} />
                  <label style={{ margin: 0 }}>{t('ui.auto_increment_lessons_on_schedule')}</label>
                </div>
                <div className="form-actions"><button type="button" className="btn btn-outline" onClick={() => setModal(false)}>{t('ui.cancel')}</button><button className="btn btn-primary" type="submit">{t('ui.create')}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
