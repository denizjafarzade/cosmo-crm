import React, { useState, useEffect } from 'react';
import { FiBarChart2 } from 'react-icons/fi';
import api from '../api';

export default function Reports() {
  const [reports, setReports] = useState([]);
  useEffect(() => { api.getWeeklyReports().then(setReports); }, []);

  return (
    <>
      <div className="page-header"><h1>Weekly Reports</h1></div>
      <div className="page-body">
        {reports.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty-state"><FiBarChart2 /><p>No reports yet. Reports are auto-generated weekly.</p></div></div></div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {reports.map(r => (
              <div className="card" key={r.id}>
                <div className="card-header"><h2>Week of {r.week_start}</h2>{r.sent ? <span className="badge green">Sent</span> : <span className="badge slate">Not sent</span>}</div>
                <div className="card-body">
                  <div className="stats-grid">
                    <div className="stat-card"><div className="stat-label">Active Students</div><div className="stat-value">{r.report.totalActive}</div></div>
                    <div className="stat-card"><div className="stat-label">New Students</div><div className="stat-value">{r.report.newStudents}</div></div>
                    <div className="stat-card"><div className="stat-label">Lessons</div><div className="stat-value">{r.report.lessonsCount}</div></div>
                    <div className="stat-card"><div className="stat-label">Excused</div><div className="stat-value">{r.report.excused}</div></div>
                    <div className="stat-card"><div className="stat-label">HW Sent</div><div className="stat-value">{r.report.hwSent}</div></div>
                    <div className="stat-card amber"><div className="stat-label">Pay Due</div><div className="stat-value">{r.report.payDue}</div></div>
                    <div className="stat-card red"><div className="stat-label">Overdue</div><div className="stat-value">{r.report.payOverdue}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
