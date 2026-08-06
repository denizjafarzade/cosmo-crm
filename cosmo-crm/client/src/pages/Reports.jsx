import React, { useState, useEffect } from 'react';
import { FiBarChart2 } from 'react-icons/fi';
import { t } from '../i18n';
import api from '../api';

export default function Reports() {
  const [reports, setReports] = useState([]);
  useEffect(() => { api.getWeeklyReports().then(setReports); }, []);

  return (
    <>
      <div className="page-header"><h1>{t('reports.title')}</h1></div>
      <div className="page-body">
        {reports.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty-state"><FiBarChart2 /><p>{t('ui.no_reports_yet_reports_are_auto_genera')}</p></div></div></div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {reports.map(r => (
              <div className="card" key={r.id}>
                <div className="card-header"><h2>Week of {r.week_start}</h2>{r.sent ? <span className="badge green">{t('ui.sent')}</span> : <span className="badge slate">{t('ui.not_sent')}</span>}</div>
                <div className="card-body">
                  <div className="stats-grid">
                    <div className="stat-card"><div className="stat-label">{t('ui.active_students')}</div><div className="stat-value">{r.report.totalActive}</div></div>
                    <div className="stat-card"><div className="stat-label">{t('ui.new_students')}</div><div className="stat-value">{r.report.newStudents}</div></div>
                    <div className="stat-card"><div className="stat-label">{t('ui.lessons')}</div><div className="stat-value">{r.report.lessonsCount}</div></div>
                    <div className="stat-card"><div className="stat-label">{t('ui.excused')}</div><div className="stat-value">{r.report.excused}</div></div>
                    <div className="stat-card"><div className="stat-label">{t('ui.hw_sent')}</div><div className="stat-value">{r.report.hwSent}</div></div>
                    <div className="stat-card amber"><div className="stat-label">{t('ui.pay_due')}</div><div className="stat-value">{r.report.payDue}</div></div>
                    <div className="stat-card red"><div className="stat-label">{t('ui.overdue')}</div><div className="stat-value">{r.report.payOverdue}</div></div>
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
