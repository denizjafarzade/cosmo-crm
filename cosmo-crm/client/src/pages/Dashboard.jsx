import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiLayers, FiBookOpen, FiDollarSign, FiPlus, FiCheck,
  FiClock, FiX, FiTrendingUp, FiUserPlus, FiPercent, FiAlertCircle,
  FiActivity, FiMessageCircle
} from 'react-icons/fi';
import api from '../api';

function timeAgo(iso) {
  if (!iso) return '';
  const utc = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z';
  const s = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayDow = new Date().getDay();

function AttendanceModal({ schedule, onClose, onDone }) {
  const [students, setStudents] = useState([]);
  const [absentIds, setAbsentIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getGroup(schedule.group_id).then(g => setStudents(g.students || []));
  }, [schedule.group_id]);

  const toggle = (id) => setAbsentIds(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const submit = async () => {
    setSubmitting(true);
    await api.markLessonDone(schedule.group_id, [...absentIds]);
    setSubmitting(false);
    onDone(schedule);
  };

  const presentCount = students.length - absentIds.size;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Attendance — {schedule.group_name}</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
            Lesson #{schedule.current_lesson_number + 1} · {schedule.time} · Click to toggle absent
          </p>
          {students.length === 0 ? (
            <p style={{ color: 'var(--slate-400)', fontSize: '0.9rem' }}>No students in this group.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {students.map(s => {
                const isSuspended = s.suspended_until_lesson != null &&
                  (schedule.current_lesson_number + 1) <= s.suspended_until_lesson;
                const absent = absentIds.has(s.id);
                return (
                  <div key={s.id}
                    onClick={() => !isSuspended && toggle(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)',
                      cursor: isSuspended ? 'default' : 'pointer',
                      border: `1.5px solid ${isSuspended ? 'var(--amber)' : absent ? 'var(--red)' : 'var(--green)'}`,
                      background: isSuspended ? 'var(--amber-bg)' : absent ? 'var(--red-bg)' : 'var(--green-bg)',
                      transition: 'all 0.15s',
                      opacity: isSuspended ? 0.8 : 1,
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSuspended ? 'var(--amber)' : absent ? 'var(--red)' : 'var(--green)'}`,
                      background: isSuspended ? 'var(--amber)' : absent ? 'transparent' : 'var(--green)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {!absent && !isSuspended && <FiCheck style={{ color: '#fff', fontSize: 13 }} />}
                      {isSuspended && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>⏸</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name} {s.surname}</div>
                      {s.whatsapp_number && <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{s.whatsapp_number}</div>}
                    </div>
                    <span className={`badge ${isSuspended ? 'amber' : absent ? 'red' : 'green'}`}>
                      {isSuspended ? 'Suspended' : absent ? 'Absent' : 'Present'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
              {presentCount} present · {absentIds.size} absent
            </span>
            <div className="form-actions" style={{ margin: 0 }}>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={submitting || students.length === 0}>
                <FiCheck /> {submitting ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [markedToday, setMarkedToday] = useState({});
  const [selectedDay, setSelectedDay] = useState(todayDow);
  const [now, setNow] = useState(new Date());

  const load = () => api.dashboard().then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  const slotKey = (s) => `${s.group_id}_${s.time}`;

  const onAttendanceDone = (schedule) => {
    setMarkedToday(m => ({ ...m, [slotKey(schedule)]: true }));
    setAttendanceFor(null);
    load();
  };

  const isTimePassed = (time) => {
    const [h, m] = time.split(':').map(Number);
    return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  };

  if (!data) return (
    <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center', color: 'var(--slate-400)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p>Loading dashboard...</p>
      </div>
    </div>
  );

  const scheduleByDay = {};
  (data.today_schedule || []).forEach(s => {
    const d = s.day_of_week;
    if (!scheduleByDay[d]) scheduleByDay[d] = [];
    scheduleByDay[d].push(s);
  });

  const daysWithClasses = Object.keys(scheduleByDay).map(Number);
  const selectedSchedule = scheduleByDay[selectedDay] || [];
  const todaySchedule = scheduleByDay[todayDow] || [];
  const todayTotal = todaySchedule.length;
  const todayDone = todaySchedule.filter(s => markedToday[slotKey(s)]).length;

  const payTotal = data.payment.paid + data.payment.due + data.payment.overdue;
  const paidPct = payTotal > 0 ? Math.round((data.payment.paid / payTotal) * 100) : 0;

  const activityTypes = { reminder: 'blue', homework: 'green', payment: 'amber', report: 'primary' };

  return (
    <>
      {attendanceFor && (
        <AttendanceModal
          schedule={attendanceFor}
          onClose={() => setAttendanceFor(null)}
          onDone={onAttendanceDone}
        />
      )}

      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{DAYS[todayDow]}, {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/students" className="btn btn-primary"><FiPlus /> Add Student</Link>
      </div>

      <div className="page-body">

        {/* Today's progress banner */}
        {todayTotal > 0 && (
          <div style={{
            background: todayDone === todayTotal ? 'var(--green-bg)' : 'var(--primary-bg)',
            border: `1.5px solid ${todayDone === todayTotal ? 'var(--green)' : 'var(--primary)'}`,
            borderRadius: 'var(--radius)', padding: '0.85rem 1.25rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <FiActivity style={{ color: todayDone === todayTotal ? 'var(--green)' : 'var(--primary)', fontSize: 18, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ color: todayDone === todayTotal ? 'var(--green)' : 'var(--primary)' }}>
                {todayDone === todayTotal ? 'All done for today!' : `Today: ${todayDone}/${todayTotal} lessons marked`}
              </strong>
              <div style={{ marginTop: 4 }}>
                <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: todayDone === todayTotal ? 'var(--green)' : 'var(--primary)', width: `${todayTotal > 0 ? (todayDone / todayTotal) * 100 : 0}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            </div>
            {data.new_registrations > 0 && (
              <Link to="/registrations" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', background: 'var(--white)', padding: '0.3rem 0.7rem', borderRadius: 20, border: '1.5px solid var(--primary)' }}>
                <FiUserPlus /> {data.new_registrations} new inquiry{data.new_registrations > 1 ? 's' : ''}
              </Link>
            )}
          </div>
        )}

        {/* Main stats */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-label"><FiUsers style={{ marginRight: 4 }} />Students</div>
            <div className="stat-value">{data.total_students}</div>
            <div className="stat-sub">+{data.new_students_this_week} this week · +{data.new_students_this_month} this month</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><FiLayers style={{ marginRight: 4 }} />Groups</div>
            <div className="stat-value">{data.total_groups}</div>
            <div className="stat-sub">{daysWithClasses.length} active day{daysWithClasses.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label"><FiBookOpen style={{ marginRight: 4 }} />Lessons</div>
            <div className="stat-value">{data.lessons_this_week}</div>
            <div className="stat-sub">{data.lessons_this_month} this month · {data.homeworks_sent_this_week} HW sent</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label"><FiPercent style={{ marginRight: 4 }} />Attendance</div>
            <div className="stat-value">{data.attendance_rate}%</div>
            <div className="stat-sub">Last 30 days</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label"><FiDollarSign style={{ marginRight: 4 }} />Paid</div>
            <div className="stat-value">{data.payment.paid}</div>
            <div className="stat-sub">{paidPct}% of students</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label"><FiAlertCircle style={{ marginRight: 4 }} />Payment Due</div>
            <div className="stat-value">{data.payment.due + data.payment.overdue}</div>
            <div className="stat-sub">{data.payment.due} due · {data.payment.overdue} overdue</div>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>

          {/* Weekly Timetable */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiClock style={{ color: 'var(--primary)' }} />
                <h2>Weekly Timetable</h2>
              </div>
              <span className="badge slate">{(data.today_schedule || []).length} total slots</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {SHORT_DAYS.map((day, dow) => (
                  <button key={dow} onClick={() => setSelectedDay(dow)}
                    className={`btn btn-sm ${selectedDay === dow ? 'btn-primary' : 'btn-outline'}`}
                    style={{ position: 'relative', minWidth: 42 }}>
                    {day}
                    {dow === todayDow && <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, background: 'var(--green)', borderRadius: '50%', border: '1.5px solid var(--white)' }} />}
                    {daysWithClasses.includes(dow) && dow !== selectedDay && (
                      <span style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, background: 'var(--primary)', borderRadius: '50%' }} />
                    )}
                  </button>
                ))}
              </div>

              {selectedSchedule.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedSchedule.map((s, i) => {
                    const done = markedToday[slotKey(s)];
                    const isToday = selectedDay === todayDow;
                    const timePassed = isTimePassed(s.time);
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${done ? 'var(--green)' : isToday && timePassed ? 'var(--primary)' : 'var(--slate-200)'}`,
                        background: done ? 'var(--green-bg)' : isToday && timePassed ? 'var(--primary-bg)' : 'var(--white)',
                      }}>
                        <div style={{
                          minWidth: 52, fontWeight: 800, fontSize: '0.9rem',
                          color: done ? 'var(--green)' : timePassed && isToday ? 'var(--primary)' : 'var(--slate-400)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>{s.time}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.group_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: 1 }}>
                            {s.student_count} student{s.student_count !== 1 ? 's' : ''} · Lesson #{s.current_lesson_number + 1}
                            {s.coach_name && ` · ${s.coach_name}`}
                          </div>
                        </div>
                        {done ? (
                          <span className="badge green"><FiCheck /> Done</span>
                        ) : isToday && timePassed ? (
                          <button className="btn btn-sm btn-primary" onClick={() => setAttendanceFor(s)}>
                            <FiCheck /> Attendance
                          </button>
                        ) : isToday ? (
                          <span className="badge slate"><FiClock /> {s.time}</span>
                        ) : (
                          <span className="badge slate">{DAYS[selectedDay].slice(0, 3)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <FiClock />
                  <p>No classes on {DAYS[selectedDay]}.<br /><Link to="/groups">Set up group schedules →</Link></p>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Payment breakdown */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiDollarSign style={{ color: 'var(--green)' }} />
                  <h2>Payment Status</h2>
                </div>
                <Link to="/payments" className="btn btn-sm btn-outline">View All</Link>
              </div>
              <div className="card-body" style={{ paddingTop: '1rem' }}>
                {[
                  { label: 'Paid', value: data.payment.paid, color: 'var(--green)', pct: payTotal > 0 ? (data.payment.paid / payTotal) * 100 : 0 },
                  { label: 'Due', value: data.payment.due, color: 'var(--amber)', pct: payTotal > 0 ? (data.payment.due / payTotal) * 100 : 0 },
                  { label: 'Overdue', value: data.payment.overdue, color: 'var(--red)', pct: payTotal > 0 ? (data.payment.overdue / payTotal) * 100 : 0 },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ color: 'var(--slate-600)' }}>{row.label}</span>
                      <span style={{ color: row.color }}>{row.value} students</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${row.pct}%`, background: row.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Groups */}
            {(data.top_groups || []).length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiTrendingUp style={{ color: 'var(--primary)' }} />
                    <h2>Top Groups</h2>
                  </div>
                </div>
                <div style={{ padding: '0.5rem 0' }}>
                  {data.top_groups.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 1.25rem', borderBottom: i < data.top_groups.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? 'var(--primary)' : 'var(--slate-200)', color: i === 0 ? '#fff' : 'var(--slate-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>{g.student_count} students</div>
                      </div>
                      <span className="badge slate">Lesson {g.current_lesson_number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New registrations shortcut */}
            {data.new_registrations > 0 && (
              <Link to="/registrations" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ background: 'var(--primary-bg)', border: '1.5px solid var(--primary)', cursor: 'pointer' }}>
                  <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FiUserPlus style={{ color: 'var(--primary)', fontSize: 20 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{data.new_registrations} New Inquir{data.new_registrations > 1 ? 'ies' : 'y'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>From landing page · Click to review</div>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiMessageCircle style={{ color: 'var(--slate-500)' }} />
              <h2>Recent Activity</h2>
            </div>
            <Link to="/activity" className="btn btn-sm btn-outline">View All</Link>
          </div>
          <div className="card-body">
            {data.recent_activity.length === 0 ? (
              <div className="empty-state"><p>No recent activity</p></div>
            ) : (
              <ul className="activity-list">
                {data.recent_activity.map(a => (
                  <li key={a.id} className="activity-item">
                    <span className={`activity-dot ${a.status}`} />
                    <div className="activity-text">
                      <span className={`badge ${activityTypes[a.type] || 'slate'}`} style={{ marginRight: 6 }}>{a.type}</span>
                      {a.target_name && <strong>{a.target_name} — </strong>}
                      {a.message}
                    </div>
                    <span className="activity-time">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
