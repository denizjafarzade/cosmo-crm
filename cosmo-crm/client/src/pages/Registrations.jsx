import React, { useState, useEffect } from 'react';
import { FiUserPlus, FiCheck, FiX, FiTrash2, FiMessageCircle, FiFilter } from 'react-icons/fi';
import api from '../api';

const STATUS_LABELS = { new: 'New', contacted: 'Contacted', enrolled: 'Enrolled', rejected: 'Rejected' };
const STATUS_BADGE = { new: 'blue', contacted: 'amber', enrolled: 'green', rejected: 'red' };

function timeAgo(iso) {
  if (!iso) return '';
  const utc = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z';
  const s = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Registrations() {
  const [regs, setRegs] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    const url = filter ? `/registrations?status=${filter}` : '/registrations';
    fetch(`/api${url}`).then(r => r.json()).then(setRegs);
  };

  useEffect(() => { load(); }, [filter]);

  const openDetail = (r) => { setSelected(r); setNotes(r.notes || ''); };

  const updateStatus = async (id, status) => {
    setSaving(true);
    await fetch(`/api/registrations/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    setSaving(false);
    setSelected(null);
    load();
  };

  const doDelete = async (id) => {
    await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const counts = regs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const allCount = regs.length;

  const filtered = filter ? regs.filter(r => r.status === filter) : regs;

  return (
    <>
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Delete Registration</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>Delete registration for <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => doDelete(confirmDelete.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{selected.name}</h3>
              <button className="modal-close" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div><div className="form-label">Phone</div><div style={{ fontWeight: 600 }}>{selected.phone}</div></div>
                <div><div className="form-label">Level</div><div>{selected.level || '—'}</div></div>
                <div><div className="form-label">FIDE Rating</div><div>{selected.fide_rating || '—'}</div></div>
                <div><div className="form-label">Received</div><div>{timeAgo(selected.created_at)}</div></div>
              </div>
              {selected.message && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="form-label">Message</div>
                  <p style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>{selected.message}</p>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Internal Notes</label>
                <textarea className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this inquiry..." />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div className="form-label" style={{ marginBottom: '0.5rem' }}>Update Status</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_LABELS).map(([s, label]) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${selected.status === s ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => updateStatus(selected.id, s)}
                      disabled={saving}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <a
                  href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FiMessageCircle /> WhatsApp
                </a>
                <button className="btn btn-danger" onClick={() => { setSelected(null); setConfirmDelete(selected); }}>
                  <FiTrash2 /> Delete
                </button>
                <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Registrations</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginTop: 2 }}>Inquiries from the landing page</p>
        </div>
      </div>

      <div className="page-body">
        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('')}>
            All {allCount > 0 && <span className="badge slate" style={{ marginLeft: 4 }}>{allCount}</span>}
          </button>
          {Object.entries(STATUS_LABELS).map(([s, label]) => (
            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
              {label} {counts[s] > 0 && <span className={`badge ${STATUS_BADGE[s]}`} style={{ marginLeft: 4 }}>{counts[s]}</span>}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <FiUserPlus style={{ fontSize: 32, marginBottom: 8 }} />
                <p>No {filter || ''} registrations yet.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Level</th>
                  <th>FIDE</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.phone}</td>
                    <td>{r.level || '—'}</td>
                    <td>{r.fide_rating || '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || 'slate'}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                    <td style={{ color: 'var(--slate-500)', fontSize: '0.85rem' }}>{timeAgo(r.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-outline" style={{ color: 'var(--red)' }} onClick={() => setConfirmDelete(r)}>
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
