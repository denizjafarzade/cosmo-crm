import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiPlus, FiTrash2, FiX, FiChevronRight, FiPause, FiPlay } from 'react-icons/fi';
import api from '../api';

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header"><h3>Confirm</h3><button className="modal-close" onClick={onCancel}><FiX /></button></div>
        <div className="modal-body">
          <p>{message}</p>
          <div className="form-actions">
            <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" onClick={onConfirm}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [newSched, setNewSched] = useState({ day_of_week: 1, time: '16:00' });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [allStudents, setAllStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }
  const [suspendModal, setSuspendModal] = useState(null); // { student }
  const [suspendLessons, setSuspendLessons] = useState(4);
  const [absentModal, setAbsentModal] = useState(null); // { student }

  const load = useCallback(() => {
    api.getGroup(id).then(g => {
      setGroup(g);
      setSchedules(g.schedules || []);
      setEditForm({ name: g.name, whatsapp_group_id: g.whatsapp_group_id, auto_increment_lessons: !!g.auto_increment_lessons, reminder_minutes_before: g.reminder_minutes_before, reminder_target: g.reminder_target });
    });
  }, [id]);

  useEffect(() => { load(); api.getStudents({}).then(setAllStudents); }, [load]);

  const markDone = () => {
    setConfirm({ message: 'Mark lesson done for all students in this group?', onConfirm: async () => { setConfirm(null); await api.markLessonDone(id); load(); } });
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

  const assignStudent = async (studentId) => {
    await api.updateStudent(studentId, { group_id: parseInt(id) });
    setStudentSearch('');
    setShowStudentDropdown(false);
    load();
    api.getStudents({}).then(setAllStudents);
  };

  const removeStudent = (studentId) => {
    setConfirm({ message: 'Remove student from this group?', onConfirm: async () => { setConfirm(null); await api.updateStudent(studentId, { group_id: null }); load(); api.getStudents({}).then(setAllStudents); } });
  };

  const openSuspend = (student) => { setSuspendLessons(4); setSuspendModal(student); };

  const doSuspend = async () => {
    await api.suspendStudent(id, suspendModal.id, suspendLessons);
    setSuspendModal(null);
    load();
  };

  const doUnsuspend = async (studentId) => {
    await api.unsuspendStudent(id, studentId);
    load();
  };

  const recordAbsence = async (opts) => {
    await api.recordAbsence(id, absentModal.id, opts);
    setAbsentModal(null);
    load();
  };

  const filteredStudents = allStudents
    .filter(s => !s.group_id || String(s.group_id) !== String(id))
    .filter(s => {
      if (!studentSearch) return true;
      const q = studentSearch.toLowerCase();
      return `${s.name} ${s.surname}`.toLowerCase().includes(q) ||
        (s.whatsapp_number && s.whatsapp_number.includes(q));
    });

  if (!group) return <div className="page-body"><p>Loading...</p></div>;

  return (
    <>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      {suspendModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Suspend Lessons — {suspendModal.name} {suspendModal.surname}</h3>
              <button className="modal-close" onClick={() => setSuspendModal(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
                The student will be automatically skipped (excused) for the next <strong>{suspendLessons}</strong> lesson{suspendLessons !== 1 ? 's' : ''} of this group. Lessons will not count toward their payment cycle. They resume automatically after.
              </p>
              <div className="form-group">
                <label className="form-label">Number of lessons to suspend</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={52}
                  value={suspendLessons}
                  onChange={e => setSuspendLessons(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <div className="form-hint">
                  Will resume automatically after lesson #{group.current_lesson_number + suspendLessons} of this group.
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setSuspendModal(null)}>Cancel</button>
                <button className="btn btn-amber" onClick={doSuspend}><FiPause /> Suspend {suspendLessons} lesson{suspendLessons !== 1 ? 's' : ''}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {absentModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Absence — {absentModal.name} {absentModal.surname}</h3>
              <button className="modal-close" onClick={() => setAbsentModal(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
                Recording for <strong>lesson #{group.current_lesson_number}</strong>. Everyone is counted present automatically —
                only mark the students who were absent.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn btn-amber" onClick={() => recordAbsence({ present: false, excused: true })}>
                  Allowed absence <span style={{ opacity: 0.8, fontWeight: 400 }}>— excused, does NOT count toward payment</span>
                </button>
                <button className="btn btn-red" onClick={() => recordAbsence({ present: false, excused: false })}>
                  Not allowed <span style={{ opacity: 0.8, fontWeight: 400 }}>— unexcused, still counts toward payment</span>
                </button>
                {absentModal.current_lesson_absent === 1 && (
                  <button className="btn btn-green" onClick={() => recordAbsence({ present: true })}>
                    <FiCheck /> Mark present (undo absence)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
                  <p><strong>Reminder:</strong> {group.reminder_minutes_before} min before → {group.reminder_target}</p>
                  <p><strong>Homework starts from:</strong> #{group.homework_start_from || 1}</p>
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
            {/* Add student with search */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                className="form-input"
                placeholder="Search student by name or number to add..."
                value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setShowStudentDropdown(true); }}
                onFocus={() => setShowStudentDropdown(true)}
              />
              {showStudentDropdown && studentSearch && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--white)', border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ padding: '0.6rem 0.75rem', color: 'var(--slate-400)', fontSize: '0.85rem' }}>No students found</div>
                  ) : filteredStudents.slice(0, 10).map(s => (
                    <div
                      key={s.id}
                      onClick={() => assignStudent(s.id)}
                      style={{
                        padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                        borderBottom: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--slate-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <span><strong>{s.name} {s.surname}</strong> <span style={{ color: 'var(--slate-400)' }}>{s.whatsapp_number}</span></span>
                      {s.group_name && <span className="badge slate" style={{ fontSize: '0.65rem' }}>{s.group_name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {group.students?.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Level</th><th>Payment</th><th>Lessons</th><th>Attendance</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {group.students.map(s => {
                      const isSuspended = s.suspended_until_lesson != null && group.current_lesson_number < s.suspended_until_lesson;
                      const lessonsLeft = isSuspended ? s.suspended_until_lesson - group.current_lesson_number : 0;
                      return (
                        <tr key={s.id} style={isSuspended ? { background: 'var(--amber-bg)' } : {}}>
                          <td>
                            <strong>{s.name} {s.surname}</strong>
                            <br /><span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{s.whatsapp_number}</span>
                          </td>
                          <td><span className="badge blue">{s.level}</span></td>
                          <td><span className={`badge ${s.payment_status === 'paid' ? 'green' : s.payment_status === 'due' ? 'amber' : 'red'}`}>{s.payment_status}</span></td>
                          <td>{s.lessons_since_payment}</td>
                          <td>
                            {group.current_lesson_number < 1 ? (
                              <span className="badge slate">No lesson yet</span>
                            ) : s.current_lesson_absent === 1 ? (
                              <button
                                className={`badge ${s.current_lesson_excused === 1 ? 'amber' : 'red'}`}
                                style={{ cursor: 'pointer', border: 'none' }}
                                onClick={() => setAbsentModal(s)}
                                title="Change attendance"
                              >{s.current_lesson_excused === 1 ? 'Absent (allowed)' : 'Absent (not allowed)'}</button>
                            ) : (
                              <button className="btn btn-sm btn-outline" onClick={() => setAbsentModal(s)} title={`Mark absent for lesson #${group.current_lesson_number}`}>
                                Present · mark absent
                              </button>
                            )}
                          </td>
                          <td>
                            {isSuspended
                              ? <span className="badge amber"><FiPause style={{ marginRight: 3 }} />{lessonsLeft} lesson{lessonsLeft !== 1 ? 's' : ''} left</span>
                              : <span className="badge green"><FiPlay style={{ marginRight: 3 }} />Active</span>
                            }
                          </td>
                          <td style={{ display: 'flex', gap: 4 }}>
                            {isSuspended
                              ? <button className="btn btn-sm btn-outline" style={{ color: 'var(--green)' }} onClick={() => doUnsuspend(s.id)} title="Resume now"><FiPlay /></button>
                              : <button className="btn btn-sm btn-outline" style={{ color: 'var(--amber)' }} onClick={() => openSuspend(s)} title="Suspend lessons"><FiPause /></button>
                            }
                            <button className="btn btn-sm btn-icon" style={{ color: 'var(--red)' }} onClick={() => removeStudent(s.id)} title="Remove from group"><FiTrash2 /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>No students assigned yet. Use the dropdown above to add students.</p></div>}
          </div>
        </div>

        {/* Homeworks */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2>Homeworks</h2>
              {group.homework_enabled ? <span className="badge green">Active</span> : <span className="badge red">Disabled</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className={`btn btn-sm ${group.homework_enabled ? 'btn-red' : 'btn-green'}`} onClick={async () => { await api.updateGroup(id, { homework_enabled: !group.homework_enabled }); load(); }}>
                {group.homework_enabled ? 'Disable' : 'Enable'}
              </button>
              <Link to="/homeworks" className="btn btn-sm btn-primary">Manage <FiChevronRight /></Link>
            </div>
          </div>
          <div className="card-body">
            {!group.homework_enabled && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'var(--red-bg)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--red)', marginBottom: '0.75rem' }}>
                Homework auto-send is disabled for this group.
              </div>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>
              Starts from Homework #{group.homework_start_from || 1} · Lesson {group.current_lesson_number} completed
            </div>
            {group.homeworks?.length ? (
              <ul className="hw-list">
                {group.homeworks.map(hw => (
                  <li key={hw.id} className={`hw-item ${hw.sent_to_group ? 'sent' : ''}`} style={hw.is_next && !hw.sent_to_group ? { border: '1px solid var(--primary)', background: '#EEF2FF' } : {}}>
                    <span className="hw-num" style={hw.is_next && !hw.sent_to_group ? { background: 'var(--primary)' } : {}}>{hw.group_lesson}</span>
                    <span className="hw-name">
                      <span className={`badge ${hw.type === 'file' ? 'blue' : hw.type === 'image' ? 'green' : hw.type === 'link' ? 'slate' : 'amber'}`} style={{ fontSize: '0.65rem', marginRight: 6 }}>{hw.type}</span>
                      {hw.type === 'text' ? hw.content?.substring(0, 50) : hw.type === 'link' ? hw.content : (hw.original_name || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}
                    </span>
                    {hw.sent_to_group ? <span className="badge green">Sent</span> : hw.is_next ? <span className="badge blue">Next</span> : <span className="badge slate">Queued</span>}
                  </li>
                ))}
              </ul>
            ) : <div className="empty-state"><p>No homeworks mapped. <Link to="/homeworks">Add them here</Link></p></div>}
          </div>
        </div>
      </div>
    </>
  );
}
