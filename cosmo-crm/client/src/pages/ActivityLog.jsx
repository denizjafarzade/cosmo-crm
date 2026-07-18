import React, { useState, useEffect } from 'react';
import api from '../api';

function timeAgo(iso) {
  if (!iso) return '';
  const utc = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z';
  const s = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(utc).toLocaleDateString();
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [type, setType] = useState('');

  useEffect(() => {
    api.getSendLog({ limit: '100', ...(type ? { type } : {}) }).then(setLogs);
  }, [type]);

  return (
    <>
      <div className="page-header"><h1>Activity Log</h1></div>
      <div className="page-body">
        <div className="filters-bar">
          {['', 'reminder', 'homework', 'payment', 'report', 'test'].map(t => (
            <button key={t} className={`btn btn-sm ${type === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType(t)}>
              {t || 'All'}
            </button>
          ))}
        </div>
        <div className="card">
          <div className="card-body">
            <ul className="activity-list">
              {logs.map(l => (
                <li key={l.id} className="activity-item">
                  <span className={`activity-dot ${l.status}`} />
                  <div className="activity-text">
                    <span className={`badge ${l.type === 'reminder' ? 'blue' : l.type === 'homework' ? 'green' : l.type === 'payment' ? 'amber' : 'slate'}`} style={{ marginRight: 6 }}>{l.type}</span>
                    {l.target_name && <strong>{l.target_name} — </strong>}
                    {l.message}
                    {l.error && <span style={{ color: 'var(--red)', fontSize: '0.8rem', display: 'block' }}>{l.error}</span>}
                  </div>
                  <span className="activity-time">{timeAgo(l.created_at)}</span>
                </li>
              ))}
              {logs.length === 0 && <div className="empty-state"><p>No activity logged</p></div>}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
