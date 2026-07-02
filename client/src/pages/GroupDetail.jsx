import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import api from '../api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [newSched, setNewSched] = useState({ day_of_week: 1, time: '16:00' });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(() => {
    api.getGroup(id).then(g => {
      setGroup(g);
      setSchedules(g.schedules || []);
      setEditForm({ name: g.name, whatsapp_group_id: g.whatsapp_group_id, auto_increment_lessons: !!g.auto_increment_lessons, reminder_minutes_before: g.reminder_minutes_before, reminder_target: g.reminder_target });
    });
  }, [id]);

  useEffect(load, [load]);

  const markDone = async () => {
    if (!window.confirm('Mark lesson done for all students in this group?')) return;
    await api.markLessonDone(id);
    load();
  };

  const saveSchedules = async () => {
    await api.updateSchedules(id, schedules);
    load();
  };

  const addSchedule = () => {
    setSchedules(s => [...s, { ...newSched }]);
  };

  const removeSchedule = (i) => setSchedules(s => s.filter((_, j) => j !== i));

  const saveGroup = async (e) => {
    e.preventDefault();
    await api.updateGroup(id, editForm);
    setEditing(false);
    load();
  };

  const uploadHw = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    await api.uploadHomeworks(id, fd);
    load();
    e.target.value = '';
  };

  const deleteHw = async (hwId) => {
    if (!window.confirm('Delete this homework?')) return;
    await api.deleteHomework(hwId);
    load();
  };

  if (!group) return <div className="page-body"><p>Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/groups" className="btn btn-sm btn-outline btn-icon"><FiArrowLeft /></Link>
          <h1>{group.name}</h1>
          <span className="badge blue">Lesson #{group.current_lesson_number}</span>
        </div>
        <button className="btn btn-green" onClick={markDone}><FiCheck /> Lesson Done</button>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Group Info */}
          <div className="card">
            <div className="card-header"><h2>Group Settings</h2><button className="btn btn-sm btn-outline" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button></div>
            <div className="card-body">
              {editing ? (
                <form onSubmit={saveGroup}>
                  <div className="form-group"><label>Name</label><input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="form-group"><label>WA Group ID</label><input className="form-input" value={editForm.whatsapp_group_id} onChange={e => setEditForm(f => ({ ...f, whatsapp_group_id: e.target.value }))} /></div>
                  <div className="form-group"><label>Reminder (min)</label><input className="form-input" type="number" value={editForm.reminder_minutes_before} onChange={e => setEditForm(f => ({ ...f, reminder_minutes_before: e.target.value }))} /></div>
                  <div className="form-group"><label>Reminder Target</label><select className="form-input" value={editForm.reminder_target} onChange={e => setEditForm(f => ({ ...f, reminder_target: e.target.value }))}><option value="group">Group</option><option value="parents">Parents</option></select></div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={editForm.auto_increment_lessons} onChange={e => setEditForm(f => ({ ...f, auto_increment_lessons: e.target.checked }))} />
                    <label style={{ margin: 0 }}>Auto-increment on schedule</label>
                  </div>
                  <div className="form-actions"><button className="btn btn-primary" type="submit">Save</button></div>
                </form>
              ) : (
                <div style={{ fontSize: '0.9rem' }}>
                  <p><strong>WA ID:</strong> {group.whatsapp_group_id || 'Not linked'}</p>
                  <p><strong>Coach:</strong> {group.coach_name || 'None'}</p>
                  <p><strong>Mode:</strong> {group.auto_increment_lessons ? 'Auto' : 'Manual'}</p>
                  <p><strong>Reminder:</strong> {group.reminder_minutes_before} min before &rarr; {group.reminder_target}</p>
                </div>
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="card">
            <div className="card-header"><h2>Weekly Schedule</h2><button className="btn btn-sm btn-primary" onClick={saveSchedules}>Save</button></div>
            <div className="card-body">
              {schedules.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="badge blue">{DAYS[s.day_of_week]}</span>
                  <span>{s.time}</span>
                  <button className="btn btn-sm btn-icon" style={{ marginLeft: 'auto', color: 'var(--red)' }} onClick={() => removeSchedule(i)}><FiTrash2 /></button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <select className="form-input" style={{ width: 'auto' }} value={newSched.day_of_week} onChange={e => setNewSched(s => ({ ...s, day_of_week: parseInt(e.target.value) }))}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input className="form-input" type="time" style={{ width: 'auto' }} value={newSched.time} onChange={e => setNewSched(s => ({ ...s, time: e.target.value }))} />
                <button className="btn btn-sm btn-outline" onClick={addSchedule}><FiPlus /> Add</button>
              </div>
            </div>
          </div>
        </div>

        {/* Students */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header"><h2>Students ({group.students?.length || 0})</h2></div>
          <div className="card-body">
            {group.students?.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Level</th><th>Payment</th><th>Lessons</th></tr></thead>
                  <tbody>
                    {group.students.map(s => (
                      <tr key={s.id}>
                        <td>{s.name} {s.surname}</td>
                        <td><span className="badge blue">{s.level}</span></td>
                        <td><span className={`badge ${s.payment_status === 'paid' ? 'green' : s.payment_status === 'due' ? 'amber' : 'red'}`}>{s.payment_status}</span></td>
                        <td>{s.lessons_since_payment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>No students assigned</p></div>}
          </div>
        </div>

        {/* Homeworks */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2>Homework Playlist</h2>
            <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer' }}>
              <FiUpload /> Upload PDFs
              <input type="file" accept=".pdf" multiple onChange={uploadHw} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="card-body">
            {group.homeworks?.length ? (
              <ul className="hw-list">
                {group.homeworks.map(hw => (
                  <li key={hw.id} className={`hw-item ${hw.sent ? 'sent' : ''}`}>
                    <span className="hw-num">{hw.lesson_number}</span>
                    <span className="hw-name">{hw.original_name}</span>
                    {hw.sent ? <span className="badge green">Sent</span> : <span className="badge slate">Pending</span>}
                    <div className="hw-actions">
                      <button className="btn btn-sm btn-icon" style={{ color: 'var(--red)' }} onClick={() => deleteHw(hw.id)}><FiTrash2 /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <div className="empty-state"><p>No homeworks uploaded. Upload PDFs in order — they'll be sent automatically as lessons complete.</p></div>}
          </div>
        </div>
      </div>
    </>
  );
}
