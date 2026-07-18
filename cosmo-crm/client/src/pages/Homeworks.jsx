import React, { useState, useEffect, useRef } from 'react';
import { FiFileText, FiPlus, FiTrash2, FiUpload, FiLink, FiType, FiImage, FiX, FiFile, FiArrowUp, FiArrowDown, FiMenu } from 'react-icons/fi';
import api from '../api';

const TYPE_ICONS = { file: <FiFile />, image: <FiImage />, text: <FiType />, link: <FiLink /> };
const TYPE_COLORS = { file: 'blue', image: 'green', text: 'amber', link: 'slate' };

export default function Homeworks() {
  const [homeworks, setHomeworks] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ content: '', caption: '' });
  const [groups, setGroups] = useState([]);
  const [previewGroup, setPreviewGroup] = useState(null);
  const [groupView, setGroupView] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const load = () => api.getHomeworks().then(setHomeworks);
  useEffect(() => { load(); api.getGroups().then(setGroups); }, []);

  useEffect(() => {
    if (previewGroup) api.getHomeworksForGroup(previewGroup).then(setGroupView);
    else setGroupView(null);
  }, [previewGroup, homeworks]);

  const addTextOrLink = async (e) => {
    e.preventDefault();
    await api.addHomework({ type: modal, content: form.content, caption: form.caption });
    setModal(null);
    setForm({ content: '', caption: '' });
    load();
  };

  const uploadFiles = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    await api.uploadHomeworks(fd);
    load();
    e.target.value = '';
  };

  const deleteHw = (id) => setConfirmDelete(id);
  const confirmDeleteHw = async () => {
    await api.deleteHomework(confirmDelete);
    setConfirmDelete(null);
    load();
  };

  const renumber = (items) => items.map((h, i) => ({ ...h, homework_number: i + 1 }));

  const move = async (idx, dir) => {
    const items = [...homeworks];
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    [items[idx], items[target]] = [items[target], items[idx]];
    setHomeworks(renumber(items));
    await api.reorderHomeworks(items.map(h => h.id));
  };

  // Drag and drop
  const onDragStart = (idx) => { dragItem.current = idx; };
  const onDragEnter = (idx) => { dragOver.current = idx; };
  const onDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    const items = [...homeworks];
    const dragged = items.splice(dragItem.current, 1)[0];
    items.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    setHomeworks(renumber(items));
    await api.reorderHomeworks(items.map(h => h.id));
  };

  const subtitle = (hw) => {
    if (hw.type === 'text') return hw.content?.substring(0, 80) + (hw.content?.length > 80 ? '…' : '');
    if (hw.type === 'link') return hw.content;
    // Strip timestamp prefix and extension from filename
    const name = hw.original_name || hw.filename || '';
    return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  };

  const typeLabel = (t) => {
    if (t === 'file') return 'Document';
    if (t === 'image') return 'Image';
    if (t === 'text') return 'Text message';
    if (t === 'link') return 'Link';
    return t;
  };

  return (
    <>
      <div className="page-header"><h1>Homework Curriculum</h1></div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid #DBEAFE' }}>
          <div className="card-body" style={{ background: '#EFF6FF', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
            <strong style={{ color: 'var(--primary)' }}>How it works:</strong> Build one ordered homework list. Each group has a "start from homework #" setting. After each lesson (1 hour), the matching homework auto-sends to WhatsApp 1–3 min later. Drag items to reorder.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            <FiUpload /> Upload Files
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp" multiple onChange={uploadFiles} style={{ display: 'none' }} />
          </label>
          <button className="btn btn-outline" onClick={() => { setForm({ content: '', caption: '' }); setModal('text'); }}>
            <FiType /> Add Text
          </button>
          <button className="btn btn-outline" onClick={() => { setForm({ content: '', caption: '' }); setModal('link'); }}>
            <FiLink /> Add Link
          </button>
          <span style={{ color: 'var(--slate-400)', fontSize: '0.85rem', alignSelf: 'center', marginLeft: 'auto' }}>{homeworks.length} homeworks</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: previewGroup ? '1fr 320px' : '1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h2>All Homeworks</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>Preview:</span>
                <select className="form-input" style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={previewGroup || ''} onChange={e => setPreviewGroup(e.target.value || null)}>
                  <option value="">None</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} (from #{g.homework_start_from || 1})</option>)}
                </select>
              </div>
            </div>
            <div className="card-body" style={{ padding: homeworks.length ? '0.75rem' : undefined }}>
              {homeworks.length === 0 ? (
                <div className="empty-state" style={{ padding: '2.5rem' }}>
                  <FiFileText style={{ fontSize: '2.5rem', marginBottom: 8 }} />
                  <p>No homeworks yet. Upload files, add text, or paste links above.</p>
                </div>
              ) : (
                <div>
                  {homeworks.map((hw, idx) => {
                    const groupInfo = groupView?.homeworks?.find(h => h.id === hw.id);
                    const isSent = groupInfo?.sent_to_group;
                    const isNext = groupInfo?.is_next;
                    return (
                      <div
                        key={hw.id}
                        draggable
                        onDragStart={() => onDragStart(idx)}
                        onDragEnter={() => onDragEnter(idx)}
                        onDragEnd={onDragEnd}
                        onDragOver={e => e.preventDefault()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.7rem 0.75rem', marginBottom: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: isNext ? '2px solid var(--primary)' : '1px solid var(--slate-200)',
                          background: isSent ? 'var(--green-bg)' : isNext ? '#EEF2FF' : 'var(--white)',
                          cursor: 'grab', transition: 'box-shadow 0.15s',
                        }}
                      >
                        {/* Drag handle */}
                        <FiMenu style={{ color: 'var(--slate-300)', flexShrink: 0, cursor: 'grab' }} />

                        {/* Number */}
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: isSent ? 'var(--green)' : isNext ? 'var(--primary)' : 'var(--slate-700)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 700,
                        }}>{hw.homework_number}</div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {subtitle(hw)}
                            {isNext && !isSent && <span className="badge blue" style={{ fontSize: '0.65rem' }}>NEXT</span>}
                            {isSent && <span className="badge green" style={{ fontSize: '0.65rem' }}>SENT</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                            <span className={`badge ${TYPE_COLORS[hw.type]}`} style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {TYPE_ICONS[hw.type]} {typeLabel(hw.type)}
                            </span>
                          </div>
                          {hw.caption && <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: 2 }}>"{hw.caption}"</div>}
                          {isSent && groupInfo.sent_at && <div style={{ fontSize: '0.7rem', color: 'var(--green)', marginTop: 2 }}>Sent {new Date(groupInfo.sent_at).toLocaleString()}</div>}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button className="btn btn-sm btn-icon btn-outline" onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up"><FiArrowUp /></button>
                          <button className="btn btn-sm btn-icon btn-outline" onClick={() => move(idx, 1)} disabled={idx === homeworks.length - 1} title="Move down"><FiArrowDown /></button>
                          <button className="btn btn-sm btn-icon" style={{ color: 'var(--red)' }} onClick={() => deleteHw(hw.id)} title="Delete"><FiTrash2 /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {previewGroup && groupView && (
            <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '1rem' }}>
              <div className="card-header"><h2>Group Mapping</h2></div>
              <div className="card-body" style={{ fontSize: '0.85rem' }}>
                <p style={{ marginBottom: 6 }}><strong>Starts from:</strong> Homework #{groupView.homework_start_from}</p>
                <p style={{ marginBottom: 6 }}><strong>Current lesson:</strong> #{groupView.current_lesson}</p>
                <p style={{ marginBottom: 12 }}><strong>Next homework:</strong> #{groupView.next_homework}</p>
                <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 12 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Lesson → Homework</div>
                  {groupView.homeworks.filter(h => h.group_lesson).slice(0, 20).map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.8rem', borderBottom: '1px solid var(--slate-100)' }}>
                      <span>Lesson {h.group_lesson}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Homework {h.homework_number}
                        {h.sent_to_group && <span style={{ color: 'var(--green)' }}>✓</span>}
                        {h.is_next && <span className="badge blue" style={{ fontSize: '0.6rem' }}>next</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3>Delete Homework</h3><button className="modal-close" onClick={() => setConfirmDelete(null)}><FiX /></button></div>
            <div className="modal-body">
              <p>Are you sure you want to delete this homework? Numbers will re-adjust.</p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={confirmDeleteHw}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'text' ? 'Add Text Homework' : 'Add Link Homework'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={addTextOrLink}>
                <div className="form-group">
                  <label>{modal === 'text' ? 'Message *' : 'URL *'}</label>
                  {modal === 'text' ? (
                    <textarea className="form-input" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write the homework instructions..." required style={{ minHeight: 120 }} />
                  ) : (
                    <input className="form-input" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="https://lichess.org/training/..." required />
                  )}
                </div>
                <div className="form-group">
                  <label>Caption (optional — sent along with the homework)</label>
                  <input className="form-input" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder={modal === 'text' ? 'e.g. Practice these positions' : 'e.g. Solve these 10 puzzles'} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" type="submit"><FiPlus /> Add as Homework {homeworks.length + 1}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
