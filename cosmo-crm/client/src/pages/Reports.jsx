import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiDollarSign } from 'react-icons/fi';
import { t } from '../i18n';
import api from '../api';

const MONTH_LABEL = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

function MonthlyRevenue() {
  const [months, setMonths] = useState(null);
  useEffect(() => { api.getMonthlyRevenue(12).then(setMonths); }, []);

  if (!months) return null;
  const max = Math.max(1, ...months.map(m => m.total));
  const total = months.reduce((s, m) => s + m.total, 0);
  const avg = total / months.length;
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const change = prev && prev.total > 0 ? Math.round(((last.total - prev.total) / prev.total) * 100) : null;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-header">
        <h2><FiDollarSign style={{ marginRight: 6 }} />{t('reports.monthlyRevenue')}</h2>
      </div>
      <div className="card-body">
        <p style={{ color: 'var(--slate-400)', fontSize: '0.85rem', marginTop: 0 }}>{t('reports.monthlyRevenueDesc')}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginTop: '1rem', marginBottom: '0.5rem' }}>
          {months.map(m => {
            const isCurrent = m === last;
            const h = Math.max(3, Math.round((m.total / max) * 130));
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: isCurrent ? 'var(--primary)' : 'var(--slate-500)', marginBottom: 4 }}>
                  {m.total > 0 ? Math.round(m.total) : ''}
                </div>
                <div
                  title={`${m.month}: ${m.total} AZN (${m.count} payments)`}
                  style={{
                    width: '100%', height: h, borderRadius: '4px 4px 0 0',
                    background: isCurrent ? 'var(--primary)' : 'var(--slate-200)',
                  }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginTop: 4 }}>{MONTH_LABEL(m.month)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--slate-100)' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>{t('reports.totalPeriod')}</div>
            <div style={{ fontWeight: 700 }}>{Math.round(total)} AZN</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>{t('reports.avgPerMonth')}</div>
            <div style={{ fontWeight: 700 }}>{Math.round(avg)} AZN</div>
          </div>
          {change != null && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>{t('dash.vsLastMonth')}</div>
              <div style={{ fontWeight: 700, color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState([]);
  useEffect(() => { api.getWeeklyReports().then(setReports); }, []);

  return (
    <>
      <div className="page-header"><h1>{t('reports.title')}</h1></div>
      <div className="page-body">
        <MonthlyRevenue />
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
