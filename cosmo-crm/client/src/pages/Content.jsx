import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiUpload, FiImage, FiFileText, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../api';
import { t } from '../i18n';

const CATEGORIES = ['training', 'tournaments', 'awards', 'camps'];
const EMPTY_G = { category: 'training', title: '', caption: '', image_path: '', alt: '', active: true };
const EMPTY_N = { title: '', category: '', date: new Date().toISOString().slice(0, 10), excerpt: '', image_path: '', image_alt: '', body: '', related_gallery_filter: '', published: true };

// Shared image picker: uploads immediately and stores the returned path.
function ImageField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.uploadContentImage(fd);
      if (res && res.path) onChange(res.path);
      else setError(res?.error || t('content.uploadFailed'));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{
          width: 96, height: 72, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          border: '1px solid var(--slate-200)', background: 'var(--slate-50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <FiImage style={{ color: 'var(--slate-300)', fontSize: 22 }} />}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <FiUpload /> {busy ? t('content.uploading') : t('content.chooseImage')}
            <input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} disabled={busy} />
          </label>
          {value && (
            <button type="button" className="btn btn-sm btn-outline" style={{ marginLeft: 6, color: 'var(--red)' }}
              onClick={() => onChange('')}>{t('common.remove')}</button>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', marginTop: 4, wordBreak: 'break-all' }}>
            {value || t('content.noImage')}
          </div>
          {error && <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: 4 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Content() {
  const [tab, setTab] = useState('gallery');
  const [gallery, setGallery] = useState([]);
  const [news, setNews] = useState([]);
  const [gForm, setGForm] = useState(null);   // null | {…}
  const [nForm, setNForm] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, item }

  const load = useCallback(() => {
    api.getGallery().then(r => setGallery(Array.isArray(r) ? r : [])).catch(() => setGallery([]));
    api.getNews().then(r => setNews(Array.isArray(r) ? r : [])).catch(() => setNews([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveGallery = async (e) => {
    e.preventDefault();
    const data = { ...gForm };
    if (data.id) await api.updateGalleryItem(data.id, data);
    else await api.createGalleryItem(data);
    setGForm(null); load();
  };

  const saveNews = async (e) => {
    e.preventDefault();
    const data = { ...nForm };
    if (data.id) await api.updateNews(data.id, data);
    else await api.createNews(data);
    setNForm(null); load();
  };

  const doDelete = async () => {
    if (confirm.kind === 'gallery') await api.deleteGalleryItem(confirm.item.id);
    else await api.deleteNews(confirm.item.id);
    setConfirm(null); load();
  };

  const toggleGallery = async (g) => { await api.updateGalleryItem(g.id, { active: !g.active }); load(); };
  const toggleNews = async (n) => { await api.updateNews(n.id, { published: !n.published }); load(); };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('nav.content')}</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginTop: 2 }}>{t('content.subtitle')}</p>
        </div>
        {tab === 'gallery'
          ? <button className="btn btn-primary" onClick={() => setGForm({ ...EMPTY_G })}><FiPlus /> {t('content.newPhoto')}</button>
          : <button className="btn btn-primary" onClick={() => setNForm({ ...EMPTY_N })}><FiPlus /> {t('content.newArticle')}</button>}
      </div>

      <div className="page-body">
        <div className="filters-bar" style={{ gap: 8 }}>
          <button className={`btn btn-sm ${tab === 'gallery' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('gallery')}>
            <FiImage /> {t('content.gallery')} <span className="badge slate" style={{ marginLeft: 4 }}>{gallery.length}</span>
          </button>
          <button className={`btn btn-sm ${tab === 'news' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('news')}>
            <FiFileText /> {t('content.news')} <span className="badge slate" style={{ marginLeft: 4 }}>{news.length}</span>
          </button>
        </div>

        {tab === 'gallery' ? (
          gallery.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty-state"><p>{t('content.noPhotos')}</p></div></div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
              {gallery.map(g => (
                <div key={g.id} className="card" style={{ opacity: g.active ? 1 : 0.55 }}>
                  <div style={{ aspectRatio: '4/3', background: 'var(--slate-100)', overflow: 'hidden', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
                    {g.image_path
                      ? <img src={g.image_path} alt={g.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-300)' }}><FiImage size={26} /></div>}
                  </div>
                  <div className="card-body" style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{g.title || <em style={{ color: 'var(--slate-400)' }}>{t('content.untitled')}</em>}</div>
                    <span className="badge blue" style={{ fontSize: '0.65rem', marginTop: 4 }}>{g.category}</span>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-outline btn-icon" onClick={() => setGForm({ ...g, active: !!g.active })} title={t('common.edit')}><FiEdit2 /></button>
                      <button className="btn btn-sm btn-outline btn-icon" onClick={() => toggleGallery(g)} title={g.active ? t('content.hide') : t('content.show')}>
                        {g.active ? <FiEye /> : <FiEyeOff />}
                      </button>
                      <button className="btn btn-sm btn-red btn-icon" onClick={() => setConfirm({ kind: 'gallery', item: g })} title={t('common.delete')}><FiTrash2 /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          news.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty-state"><p>{t('content.noArticles')}</p></div></div></div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t('content.title')}</th><th>{t('content.category')}</th><th>{t('content.date')}</th><th>{t('content.status')}</th><th></th></tr></thead>
                  <tbody>
                    {news.map(n => (
                      <tr key={n.id} style={{ opacity: n.published ? 1 : 0.55 }}>
                        <td>
                          <strong>{n.title}</strong>
                          <br /><span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>/{n.slug}</span>
                        </td>
                        <td>{n.category || '—'}</td>
                        <td>{n.date || '—'}</td>
                        <td>{n.published ? <span className="badge green">{t('content.published')}</span> : <span className="badge slate">{t('content.hidden')}</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button className="btn btn-sm btn-outline btn-icon" onClick={() => setNForm({ ...n, published: !!n.published })} title={t('common.edit')}><FiEdit2 /></button>
                            <button className="btn btn-sm btn-outline btn-icon" onClick={() => toggleNews(n)} title={n.published ? t('content.hide') : t('content.show')}>
                              {n.published ? <FiEye /> : <FiEyeOff />}
                            </button>
                            <button className="btn btn-sm btn-red btn-icon" onClick={() => setConfirm({ kind: 'news', item: n })} title={t('common.delete')}><FiTrash2 /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {gForm && (
        <div className="modal-overlay" onClick={() => setGForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{gForm.id ? t('content.editPhoto') : t('content.newPhoto')}</h3>
              <button className="modal-close" onClick={() => setGForm(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveGallery}>
                <div className="form-group">
                  <label>{t('content.image')}</label>
                  <ImageField value={gForm.image_path} onChange={v => setGForm(f => ({ ...f, image_path: v }))} />
                </div>
                <div className="form-row">
                  <div className="form-group"><label>{t('content.title')}</label><input className="form-input" value={gForm.title} onChange={e => setGForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div className="form-group">
                    <label>{t('content.category')}</label>
                    <select className="form-input" value={gForm.category} onChange={e => setGForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>{t('content.caption')}</label><textarea className="form-input" value={gForm.caption} onChange={e => setGForm(f => ({ ...f, caption: e.target.value }))} /></div>
                <div className="form-group"><label>{t('content.altText')}</label><input className="form-input" value={gForm.alt} onChange={e => setGForm(f => ({ ...f, alt: e.target.value }))} /></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!gForm.active} onChange={e => setGForm(f => ({ ...f, active: e.target.checked }))} />
                  <label style={{ margin: 0 }}>{t('content.showOnSite')}</label>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setGForm(null)}>{t('common.cancel')}</button>
                  <button className="btn btn-primary" type="submit">{t('common.save')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {nForm && (
        <div className="modal-overlay" onClick={() => setNForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>{nForm.id ? t('content.editArticle') : t('content.newArticle')}</h3>
              <button className="modal-close" onClick={() => setNForm(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveNews}>
                <div className="form-group"><label>{t('content.title')} *</label><input className="form-input" required value={nForm.title} onChange={e => setNForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="form-row">
                  <div className="form-group"><label>{t('content.category')}</label><input className="form-input" value={nForm.category} onChange={e => setNForm(f => ({ ...f, category: e.target.value }))} placeholder="Tournament" /></div>
                  <div className="form-group"><label>{t('content.date')}</label><input className="form-input" type="date" value={nForm.date || ''} onChange={e => setNForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div className="form-group">
                  <label>{t('content.image')}</label>
                  <ImageField value={nForm.image_path} onChange={v => setNForm(f => ({ ...f, image_path: v }))} />
                </div>
                <div className="form-group"><label>{t('content.excerpt')}</label><textarea className="form-input" value={nForm.excerpt} onChange={e => setNForm(f => ({ ...f, excerpt: e.target.value }))} /></div>
                <div className="form-group">
                  <label>{t('content.body')}</label>
                  <textarea className="form-input" style={{ minHeight: 160, fontFamily: 'monospace', fontSize: '0.8rem' }}
                    value={nForm.body} onChange={e => setNForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="<p>Paragraph…</p>" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>{t('content.bodyHint')}</span>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!nForm.published} onChange={e => setNForm(f => ({ ...f, published: e.target.checked }))} />
                  <label style={{ margin: 0 }}>{t('content.publish')}</label>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setNForm(null)}>{t('common.cancel')}</button>
                  <button className="btn btn-primary" type="submit">{t('common.save')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3>{t('common.delete')}</h3><button className="modal-close" onClick={() => setConfirm(null)}><FiX /></button></div>
            <div className="modal-body">
              <p>{t('content.deleteConfirm')} <strong>{confirm.item.title || confirm.item.slug}</strong>?</p>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
                <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={doDelete}>{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
