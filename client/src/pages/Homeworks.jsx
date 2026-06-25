import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiChevronRight } from 'react-icons/fi';
import api from '../api';

export default function Homeworks() {
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [homeworks, setHomeworks] = useState([]);

  useEffect(() => { api.getGroups().then(setGroups); }, []);

  useEffect(() => {
    if (selected) api.getHomeworks(selected).then(setHomeworks);
    else setHomeworks([]);
  }, [selected]);

  return (
    <>
      <div className="page-header"><h1>Homeworks</h1></div>
      <div className="page-body">
        <p style={{ color: 'var(--slate-500)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Upload homework PDFs in order per group. They auto-send when each lesson completes.
          Manage uploads in <strong>Group Detail</strong> page.
        </p>

        <div className="filters-bar">
          <select className="form-input" value={selected || ''} onChange={e => setSelected(e.target.value || null)}>
            <option value="">Select a group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} (Lesson #{g.current_lesson_number})</option>)}
          </select>
          {selected && <Link to={`/groups/${selected}`} className="btn btn-sm btn-primary">Manage Group <FiChevronRight /></Link>}
        </div>

        {selected && (
          <div className="card">
            <div className="card-header"><h2>Homework Playlist</h2></div>
            <div className="card-body">
              {homeworks.length === 0 ? (
                <div className="empty-state"><FiFileText /><p>No homeworks uploaded for this group</p></div>
              ) : (
                <ul className="hw-list">
                  {homeworks.map(hw => (
                    <li key={hw.id} className={`hw-item ${hw.sent ? 'sent' : ''}`}>
                      <span className="hw-num">{hw.lesson_number}</span>
                      <span className="hw-name">{hw.original_name}</span>
                      {hw.sent ? (
                        <span className="badge green">Sent {hw.sent_at ? new Date(hw.sent_at).toLocaleDateString() : ''}</span>
                      ) : (
                        <span className="badge slate">Pending</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
