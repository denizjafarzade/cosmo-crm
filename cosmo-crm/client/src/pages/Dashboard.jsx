import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiLayers, FiBookOpen, FiDollarSign, FiPlus, FiCheck,
  FiClock, FiX, FiTrendingUp, FiUserPlus, FiPercent, FiAlertCircle,
  FiActivity, FiMessageCircle
} from 'react-icons/fi';
import api from '../api';
import { t, formatDate } from '../i18n';

function timeAgo(iso) {
  if (!iso) return '';
  const utc = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z';
  const s = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const DAYS = () => [0,1,2,3,4,5,6].map(i => t(`day.long.${i}`));
const SHORT_DAYS = () => [0,1,2,3,4,5,6].map(i => t(`day.short.${i}`));
const todayDow = new Date().getDay();

function AttendanceModal({ schedule, onClose, onDone }) {
  const [students, setStudents] = useState([]);
  // state per student: 'present' | 'excused' | 'unexcused'
  const [marks, setMarks] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getGroup(schedule.group_id).then(g => {
      const list = g.students || [];
      setStudents(list);
      // Pre-fill from today's already-recorded attendance (so re-opening shows it).
      const init = {};
      for (const s of list) {
        if (s.current_lesson_absent === 1) init[s.id] = s.current_lesson_excused === 1 ? 'excused' : 'unexcused';
        else init[s.id] = 'present';
      }
      setMarks(init);
    });
  }, [schedule.group_id]);

  const setMark = (id, val) => setMarks(m => ({ ...m, [id]: val }));

  const submit = async () => {
    setSubmitting(true);
    const absences = students
      .filter(s => marks[s.id] && marks[s.id] !== 'present')
      .map(s => ({ student_id: s.id, excused: marks[s.id] === 'excused' }));
    await api.takeAttendance(schedule.group_id, absences, schedule.time);
    setSubmitting(false);
    onDone(schedule);
  };

  const absentCount = students.filter(s => marks[s.id] && marks[s.id] !== 'present').length;

  const Btn = ({ active, color, onClick, children }) => (
    <button type="button" onClick={onClick}
      style={{
        padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: 6, cursor: 'pointer',
        border: `1.5px solid ${active ? color : 'var(--slate-200)'}`,
        background: active ? color : 'transparent', color: active ? '#fff' : 'var(--slate-500)',
      }}>{children}</button>
  );

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>{t('dashboard.attendance')} — {schedule.group_name}</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
            {schedule.time} · {t('dashboard.attendanceHint')}
          </p>
          {students.length === 0 ? (
            <p style={{ color: 'var(--slate-400)', fontSize: '0.9rem' }}>{t('ui.no_students_in_this_group')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {students.map(s => {
                const isSuspended = s.suspended_until_lesson != null &&
                  (schedule.current_lesson_number + 1) <= s.suspended_until_lesson;
                const mark = marks[s.id] || 'present';
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${mark === 'present' ? 'var(--green)' : mark === 'excused' ? 'var(--amber)' : 'var(--red)'}`,
                    background: mark === 'present' ? 'var(--green-bg)' : mark === 'excused' ? 'var(--amber-bg)' : 'var(--red-bg)',
                    opacity: isSuspended ? 0.7 : 1,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name} {s.surname}</div>
                      {isSuspended && <div style={{ fontSize: '0.72rem', color: 'var(--amber)' }}>{t('ui.suspended')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn active={mark === 'present'} color="var(--green)" onClick={() => setMark(s.id, 'present')}>{t('dashboard.present')}</Btn>
                      <Btn active={mark === 'excused'} color="var(--amber)" onClick={() => setMark(s.id, 'excused')}>{t('dashboard.absentAllowed')}</Btn>
                      <Btn active={mark === 'unexcused'} color="var(--red)" onClick={() => setMark(s.id, 'unexcused')}>{t('dashboard.notAllowed')}</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
              {students.length - absentCount} {t('dashboard.presentCount')} · {absentCount} {t('dashboard.absentCount')}
            </span>
            <div className="form-actions" style={{ margin: 0 }}>
              <button className="btn btn-outline" onClick={onClose}>{t('ui.cancel')}</button>
              <button className="btn btn-primary" onClick={submit} disabled={submitting || students.length === 0}>
                <FiCheck /> {submitting ? '…' : t('dashboard.saveAttendance')}
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
  const [selectedDay, setSelectedDay] = useState(todayDow);
  const [now, setNow] = useState(new Date());
  const [cancelFor, setCancelFor] = useState(null); // { scope:'slot'|'day', slot, reason }

  const load = () => api.dashboard().then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  // "Done" is derived from the data (a lesson exists for that group today), so it
  // survives navigating away and back — no stale in-memory flag.
  const isMarked = (s) => !!s.marked_today;

  const onAttendanceDone = () => {
    setAttendanceFor(null);
    load();
  };

  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const doCancel = async () => {
    const { scope, slot, reason } = cancelFor;
    if (scope === 'day') await api.cancelDay({ date: todayIso(), reason });
    else await api.cancelLesson(slot.group_id, { slot_time: slot.time, date: todayIso(), reason });
    setCancelFor(null);
    load();
  };

  const restore = async (s) => {
    await api.restoreLesson(s.group_id, { slot_time: s.time, date: todayIso() });
    load();
  };

  const isToday0 = (dow) => dow === todayDow;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isTimePassed = (time) => {
    const [h, m] = time.split(':').map(Number);
    return nowMinutes >= h * 60 + m;
  };
  // The lesson is "finished" once its start time + duration has elapsed.
  const isDurationOver = (s) => {
    const [h, m] = s.time.split(':').map(Number);
    return nowMinutes >= h * 60 + m + (s.duration || 60);
  };

  if (!data) return (
    <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center', color: 'var(--slate-400)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p>{t('ui.loading_dashboard')}</p>
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
  const todayDone = todaySchedule.filter(isMarked).length;

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

      {cancelFor && (
        <div className="modal-overlay" onClick={() => setCancelFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{cancelFor.scope === 'day' ? t('dashboard.cancelDayTitle') : t('dashboard.cancelLessonTitle')}</h3>
              <button className="modal-close" onClick={() => setCancelFor(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
                {cancelFor.scope === 'day'
                  ? t('dashboard.cancelDayHint')
                  : `${cancelFor.slot.group_name} · ${cancelFor.slot.time} — ${t('dashboard.cancelLessonHint')}`}
              </p>
              <div className="form-group">
                <label className="form-label">{t('dashboard.cancelReason')}</label>
                <input className="form-input" value={cancelFor.reason}
                  onChange={e => setCancelFor(c => ({ ...c, reason: e.target.value }))}
                  placeholder={t('dashboard.cancelReasonHint')} />
              </div>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setCancelFor(null)}>{t('common.cancel')}</button>
                {cancelFor.scope === 'slot' && (
                  <button className="btn btn-outline" onClick={() => setCancelFor(c => ({ ...c, scope: 'day' }))}>
                    {t('dashboard.cancelAllToday')}
                  </button>
                )}
                <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={doCancel}>
                  {cancelFor.scope === 'day' ? t('dashboard.cancelAllToday') : t('dashboard.cancelConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p>{DAYS()[todayDow]}, {formatDate(now)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" style={{ color: 'var(--red)' }}
            onClick={() => setCancelFor({ scope: 'day', slot: null, reason: '' })}>
            {t('dashboard.cancelAllToday')}
          </button>
          <Link to="/students" className="btn btn-primary"><FiPlus /> {t('students.add')}</Link>
        </div>
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
                {todayDone === todayTotal ? t('dash.allDone') : `${t('dash.todayProgress')}: ${todayDone}/${todayTotal} ${t('dash.lessonsMarked')}`}
              </strong>
              <div style={{ marginTop: 4 }}>
                <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: todayDone === todayTotal ? 'var(--green)' : 'var(--primary)', width: `${todayTotal > 0 ? (todayDone / todayTotal) * 100 : 0}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            </div>
            {data.new_registrations > 0 && (
              <Link to="/registrations" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', background: 'var(--white)', padding: '0.3rem 0.7rem', borderRadius: 20, border: '1.5px solid var(--primary)' }}>
                <FiUserPlus /> {data.new_registrations} {data.new_registrations > 1 ? t('dash.newInquiries') : t('dash.newInquiry')}
              </Link>
            )}
          </div>
        )}

        {/* Main stats */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-label"><FiUsers style={{ marginRight: 4 }} />{t('ui.students')}</div>
            <div className="stat-value">{data.total_students}</div>
            <div className="stat-sub">+{data.new_students_this_week} {t('dash.thisWeek')} · +{data.new_students_this_month} {t('dash.thisMonth')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><FiLayers style={{ marginRight: 4 }} />{t('ui.groups')}</div>
            <div className="stat-value">{data.total_groups}</div>
            <div className="stat-sub">{daysWithClasses.length} {t('dash.activeDays')}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label"><FiBookOpen style={{ marginRight: 4 }} />{t('ui.lessons')}</div>
            <div className="stat-value">{data.lessons_this_week}</div>
            <div className="stat-sub">{data.lessons_this_month} {t('dash.thisMonth')} · {data.homeworks_sent_this_week} {t('dash.hwSent')}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label"><FiPercent style={{ marginRight: 4 }} />{t('ui.attendance')}</div>
            <div className="stat-value">{data.attendance_rate}%</div>
            <div className="stat-sub">{t('dash.last30')}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label"><FiDollarSign style={{ marginRight: 4 }} />{t('ui.paid')}</div>
            <div className="stat-value">{data.payment.paid}</div>
            <div className="stat-sub">{paidPct}% {t('dash.ofStudents')}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label"><FiAlertCircle style={{ marginRight: 4 }} />{t('ui.payment_due')}</div>
            <div className="stat-value">{data.payment.due + data.payment.overdue}</div>
            <div className="stat-sub">{data.payment.due} {t('dash.due')} · {data.payment.overdue} {t('dash.overdue')}</div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="dash-grid">

          {/* Weekly Timetable */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiClock style={{ color: 'var(--primary)' }} />
                <h2>{t('dashboard.timetable')}</h2>
              </div>
              <span className="badge slate">{(data.today_schedule || []).length} {t('dash.totalSlots')}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {SHORT_DAYS().map((day, dow) => (
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
                    const cancelled = isToday0(selectedDay) && !!s.cancelled_today;
                    const done = isMarked(s);
                    const isToday = selectedDay === todayDow;
                    const started = isTimePassed(s.time);
                    const finished = isToday && isDurationOver(s) && !cancelled;
                    // Once the duration is over the slot is locked (disabled green)
                    // so it can't be clicked by mistake. During the lesson it's
                    // active and attendance can be taken/edited.
                    const locked = finished;
                    const active = isToday && started && !finished && !cancelled;
                    const green = (done || finished) && !cancelled;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${cancelled ? 'var(--red)' : green ? 'var(--green)' : active ? 'var(--primary)' : 'var(--slate-200)'}`,
                        background: cancelled ? 'var(--red-bg)' : green ? 'var(--green-bg)' : active ? 'var(--primary-bg)' : 'var(--white)',
                        opacity: locked || cancelled ? 0.75 : 1,
                      }}>
                        <div style={{
                          minWidth: 52, fontWeight: 800, fontSize: '0.9rem',
                          textDecoration: cancelled ? 'line-through' : 'none',
                          color: cancelled ? 'var(--red)' : green ? 'var(--green)' : active ? 'var(--primary)' : 'var(--slate-400)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>{s.time}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.group_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: 1 }}>
                            {s.student_count} · {t('dashboard.lesson')} #{s.slot_lesson_number ?? (s.current_lesson_number + 1)} · {s.duration || 60}min
                            {s.coach_name && ` · ${s.coach_name}`}
                          </div>
                        </div>
                        {cancelled ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="badge red" title={s.cancel_reason || ''}>{t('dashboard.cancelled')}</span>
                            <button className="btn btn-sm btn-outline" onClick={() => restore(s)}>{t('dashboard.restore')}</button>
                          </div>
                        ) : locked ? (
                          <span className="badge green" style={{ opacity: 0.85 }}><FiCheck /> {t('dashboard.done')}</span>
                        ) : active ? (
                          done ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className="badge green"><FiCheck /> {t('dashboard.marked')}</span>
                              <button className="btn btn-sm btn-outline" onClick={() => setAttendanceFor(s)}>{t('common.edit')}</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button className="btn btn-sm btn-primary" onClick={() => setAttendanceFor(s)}>
                                <FiCheck /> {t('dashboard.attendance')}
                              </button>
                              <button className="btn btn-sm btn-outline" style={{ color: 'var(--red)' }}
                                onClick={() => setCancelFor({ scope: 'slot', slot: s, reason: '' })}>{t('dashboard.cancel')}</button>
                            </div>
                          )
                        ) : isToday ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="badge slate"><FiClock /> {s.time}</span>
                            <button className="btn btn-sm btn-outline" style={{ color: 'var(--red)' }}
                              onClick={() => setCancelFor({ scope: 'slot', slot: s, reason: '' })}>{t('dashboard.cancel')}</button>
                          </div>
                        ) : (
                          <span className="badge slate">{SHORT_DAYS()[selectedDay]}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <FiClock />
                  <p>{t('dashboard.noClasses')} {DAYS()[selectedDay]}.<br /><Link to="/groups">{t('dash.setupSchedules')} →</Link></p>
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
                  <h2>{t('dashboard.paymentStatus')}</h2>
                </div>
                <Link to="/payments" className="btn btn-sm btn-outline">{t('ui.view_all')}</Link>
              </div>
              <div className="card-body" style={{ paddingTop: '1rem' }}>
                {[
                  { label: t('students.paid'), value: data.payment.paid, color: 'var(--green)', pct: payTotal > 0 ? (data.payment.paid / payTotal) * 100 : 0 },
                  { label: t('students.due'), value: data.payment.due, color: 'var(--amber)', pct: payTotal > 0 ? (data.payment.due / payTotal) * 100 : 0 },
                  { label: t('students.overdue'), value: data.payment.overdue, color: 'var(--red)', pct: payTotal > 0 ? (data.payment.overdue / payTotal) * 100 : 0 },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ color: 'var(--slate-600)' }}>{row.label}</span>
                      <span style={{ color: row.color }}>{row.value} {t('students.count')}</span>
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
                    <h2>{t('dashboard.topGroups')}</h2>
                  </div>
                </div>
                <div style={{ padding: '0.5rem 0' }}>
                  {data.top_groups.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 1.25rem', borderBottom: i < data.top_groups.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? 'var(--primary)' : 'var(--slate-200)', color: i === 0 ? '#fff' : 'var(--slate-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>{g.student_count} {t('students.count')}</div>
                      </div>
                      <span className="badge slate">{t('dashboard.lesson')} {g.current_lesson_number}</span>
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
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{data.new_registrations} {data.new_registrations > 1 ? t('dash.newInquiries') : t('dash.newInquiry')}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>{t('dash.fromLanding')}</div>
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
              <h2>{t('dashboard.recentActivity')}</h2>
            </div>
            <Link to="/activity" className="btn btn-sm btn-outline">{t('ui.view_all')}</Link>
          </div>
          <div className="card-body">
            {data.recent_activity.length === 0 ? (
              <div className="empty-state"><p>{t('ui.no_recent_activity')}</p></div>
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
