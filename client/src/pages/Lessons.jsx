import React, { useState, useEffect } from 'react';
import { FiBookOpen } from 'react-icons/fi';
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
      <div className="page-header"><h1>Lessons</h1></div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Total Lessons</div><div className="stat-value">{stats.total || 0}</div></div>
          <div className="stat-card primary"><div className="stat-label">This Week</div><div className="stat-value">{stats.this_week || 0}</div></div>
          <div className="stat-card amber"><div className="stat-label">Excused (week)</div><div className="stat-value">{stats.excused_this_week || 0}</div></div>
        </div>

        <div className="filters-bar">
          <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Group</th><th>Student</th><th>Lesson #</th><th>Status</th></tr></thead>
              <tbody>
                {lessons.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><FiBookOpen /><p>No lessons recorded</p></div></td></tr>
                ) : lessons.map(l => (
                  <tr key={l.id}>
                    <td>{new Date(l.occurred_at).toLocaleDateString()}</td>
                    <td>{l.group_name}</td>
                    <td>{l.student_name}</td>
                    <td>#{l.lesson_number}</td>
                    <td>
                      {l.is_excused ? <span className="badge amber">Excused</span> : <span className="badge green">Attended</span>}
                      {!l.counts_toward_payment && <span className="badge slate" style={{ marginLeft: 4 }}>Skipped</span>}
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
