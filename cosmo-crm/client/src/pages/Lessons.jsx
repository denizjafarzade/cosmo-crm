import React, { useState, useEffect } from 'react';
import { FiBookOpen } from 'react-icons/fi';
import { formatDate, t } from '../i18n';
import api from '../api';

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState({});

  useEffect(() => {
    api.getGroups().then(setGroups);
    api.getLessonStats().then(setStats);
  }, []);

  useEffect(() => {
    const params = { limit: '100' };
    if (filter) params.group_id = filter;
    api.getLessons(params).then(setLessons);
  }, [filter]);

  return (
    <>
      <div className="page-header"><h1>{t('lessons.title')}</h1></div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">{t('ui.total_lessons')}</div><div className="stat-value">{stats.total || 0}</div></div>
          <div className="stat-card primary"><div className="stat-label">{t('ui.this_week')}</div><div className="stat-value">{stats.this_week || 0}</div></div>
          <div className="stat-card amber"><div className="stat-label">{t('ui.excused_week')}</div><div className="stat-value">{stats.excused_this_week || 0}</div></div>
        </div>

        <div className="filters-bar">
          <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">{t('ui.all_groups')}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ui.date')}</th><th>{t('ui.group')}</th><th>{t('ui.student')}</th><th>{t('ui.lesson')}</th><th>{t('ui.status')}</th></tr></thead>
              <tbody>
                {lessons.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><FiBookOpen /><p>{t('ui.no_lessons_recorded')}</p></div></td></tr>
                ) : lessons.map(l => (
                  <tr key={l.id}>
                    <td>{formatDate(l.occurred_at)}</td>
                    <td>{l.group_name}</td>
                    <td>{l.student_name}</td>
                    <td>#{l.lesson_number}</td>
                    <td>
                      {l.is_excused ? <span className="badge amber">{t('ui.excused')}</span> : <span className="badge green">{t('ui.attended')}</span>}
                      {!l.counts_toward_payment && <span className="badge slate" style={{ marginLeft: 4 }}>{t('ui.skipped')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
