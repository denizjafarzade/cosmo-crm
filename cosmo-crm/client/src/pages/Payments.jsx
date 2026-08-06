import React, { useState, useEffect } from 'react';
import { FiDollarSign } from 'react-icons/fi';
import { formatDate, t } from '../i18n';
import api from '../api';

export default function Payments() {
  const [summary, setSummary] = useState({ paid: 0, due: 0, overdue: 0 });
  const [payments, setPayments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [tab, setTab] = useState('history');

  useEffect(() => {
    api.getPaymentSummary().then(setSummary);
    api.getPayments({}).then(setPayments);
    api.getPaymentReminders().then(setReminders);
  }, []);

  return (
    <>
      <div className="page-header"><h1>{t('payments.title')}</h1></div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card green"><div className="stat-label">{t('ui.paid')}</div><div className="stat-value">{summary.paid}</div></div>
          <div className="stat-card amber"><div className="stat-label">Due</div><div className="stat-value">{summary.due}</div></div>
          <div className="stat-card red"><div className="stat-label">{t('ui.overdue')}</div><div className="stat-value">{summary.overdue}</div></div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <button className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('history')}>{t('ui.payment_history')}</button>
          <button className={`btn btn-sm ${tab === 'reminders' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('reminders')}>{t('ui.reminders_sent')}</button>
        </div>

        <div className="card">
          <div className="table-wrap">
            {tab === 'history' ? (
              <table>
                <thead><tr><th>{t('ui.date')}</th><th>{t('ui.student')}</th><th>{t('ui.lessons')}</th><th>{t('ui.amount')}</th><th>{t('ui.notes')}</th></tr></thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><FiDollarSign /><p>{t('ui.no_payment_history')}</p></div></td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id}>
                      <td>{formatDate(p.confirmed_at)}</td>
                      <td>{p.student_name}</td>
                      <td>{p.lessons_covered}</td>
                      <td>{p.amount || '—'}</td>
                      <td>{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead><tr><th>{t('ui.date')}</th><th>{t('ui.student')}</th><th>{t('ui.reminder')}</th></tr></thead>
                <tbody>
                  {reminders.length === 0 ? (
                    <tr><td colSpan={3}><div className="empty-state"><p>{t('ui.no_reminders_sent')}</p></div></td></tr>
                  ) : reminders.map(r => (
                    <tr key={r.id}>
                      <td>{formatDate(r.sent_at)}</td>
                      <td>{r.student_name}</td>
                      <td><span className="badge amber">#{r.reminder_number}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
