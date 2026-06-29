import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiLayers, FiBookOpen, FiDollarSign, FiPlus } from 'react-icons/fi';
import api from '../api';

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.dashboard().then(setData); }, []);

  if (!data) return <div className="page-body"><p>Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/students" className="btn btn-primary"><FiPlus /> Add Student</Link>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-label"><FiUsers style={{ marginRight: 4 }} /> Students</div>
            <div className="stat-value">{data.total_students}</div>
            <div className="stat-sub">{data.new_students_this_week} new this week</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><FiLayers style={{ marginRight: 4 }} /> Groups</div>
            <div className="stat-value">{data.total_groups}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label"><FiDollarSign style={{ marginRight: 4 }} /> Paid</div>
            <div className="stat-value">{data.payment.paid}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Payment Due</div>
            <div className="stat-value">{data.payment.due}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Overdue</div>
            <div className="stat-value">{data.payment.overdue}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><FiBookOpen style={{ marginRight: 4 }} /> Lessons (week)</div>
            <div className="stat-value">{data.lessons_this_week}</div>
            <div className="stat-sub">{data.homeworks_sent_this_week} HWs sent</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Recent Activity</h2><Link to="/activity" className="btn btn-sm btn-outline">View All</Link></div>
          <div className="card-body">
            {data.recent_activity.length === 0 ? (
              <div className="empty-state"><p>No recent activity</p></div>
            ) : (
              <ul className="activity-list">
                {data.recent_activity.map(a => (
                  <li key={a.id} className="activity-item">
                    <span className={`activity-dot ${a.status}`} />
                    <div className="activity-text">
                      <span className={`badge ${a.type === 'reminder' ? 'blue' : a.type === 'homework' ? 'green' : a.type === 'payment' ? 'amber' : 'slate'}`} style={{ marginRight: 6 }}>{a.type}</span>
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
