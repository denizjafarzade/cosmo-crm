import React, { useState, useEffect } from 'react';
import { FiDollarSign } from 'react-icons/fi';
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
      <div className="page-header"><h1>Payments</h1></div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card green"><div className="stat-label">Paid</div><div className="stat-value">{summary.paid}</div></div>
          <div className="stat-card amber"><div className="stat-label">Due</div><div className="stat-value">{summary.due}</div></div>
          <div className="stat-card red"><div className="stat-label">Overdue</div><div className="stat-value">{summary.overdue}</div></div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <button className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('history')}>Payment History</button>
          <button className={`btn btn-sm ${tab === 'reminders' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('reminders')}>Reminders Sent</button>
        </div>

        <div className="card">
          <div className="table-wrap">
            {tab === 'history' ? (
              <table>
                <thead><tr><th>Date</th><th>Student</th><th>Lessons</th><th>Amount</th><th>Notes</th></tr></thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><FiDollarSign /><p>No payment history</p></div></td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id}>
                      <td>{new Date(p.confirmed_at).toLocaleDateString()}</td>
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
                <thead><tr><th>Date</th><th>Student</th><th>Reminder #</th></tr></thead>
                <tbody>
                  {reminders.length === 0 ? (
                    <tr><td colSpan={3}><div className="empty-state"><p>No reminders sent</p></div></td></tr>
                  ) : reminders.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.sent_at).toLocaleDateString()}</td>
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
