import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiLayers, FiBookOpen, FiFileText, FiDollarSign, FiSettings, FiActivity, FiMessageCircle, FiMenu, FiX, FiBarChart2, FiUserPlus, FiLogOut, FiImage } from 'react-icons/fi';
import { FaChessKnight } from 'react-icons/fa';
import api, { getToken, setToken } from './api';
import { t, useLang, setLang, getLang, LANGUAGES } from './i18n';
import Login from './pages/Login';
import Content from './pages/Content';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Lessons from './pages/Lessons';
import Homeworks from './pages/Homeworks';
import Payments from './pages/Payments';
import WhatsAppPage from './pages/WhatsAppPage';
import SettingsPage from './pages/SettingsPage';
import ActivityLog from './pages/ActivityLog';
import Reports from './pages/Reports';
import Registrations from './pages/Registrations';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [waStatus, setWaStatus] = useState({ status: 'disconnected' });
  const [authed, setAuthed] = useState(!!getToken());
  const location = useLocation();
  useLang(); // re-render the whole shell when the language changes

  useEffect(() => { setSidebarOpen(false); }, [location]);

  useEffect(() => {
    if (!authed) return;
    const poll = () => api.waStatus().then(setWaStatus).catch(() => {});
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [authed]);

  const logout = () => { setToken(null); setAuthed(false); };

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const nav = [
    { to: '/', icon: <FiHome />, label: t('nav.dashboard') },
    { to: '/students', icon: <FiUsers />, label: t('nav.students') },
    { to: '/groups', icon: <FiLayers />, label: t('nav.groups') },
    { to: '/lessons', icon: <FiBookOpen />, label: t('nav.lessons') },
    { to: '/homeworks', icon: <FiFileText />, label: t('nav.homeworks') },
    { to: '/payments', icon: <FiDollarSign />, label: t('nav.payments') },
    { to: '/registrations', icon: <FiUserPlus />, label: t('nav.registrations') },
    { to: '/content', icon: <FiImage />, label: t('nav.content') },
  ];

  const nav2 = [
    { to: '/whatsapp', icon: <FiMessageCircle />, label: t('nav.whatsapp') },
    { to: '/activity', icon: <FiActivity />, label: t('nav.activity') },
    { to: '/reports', icon: <FiBarChart2 />, label: t('nav.reports') },
    { to: '/settings', icon: <FiSettings />, label: t('nav.settings') },
  ];

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <FaChessKnight />
          <span>Cosmo CRM</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
              {n.icon}{n.label}
            </NavLink>
          ))}
          <div className="sidebar-section">{t('nav.system')}</div>
          {nav2.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => isActive ? 'active' : ''}>
              {n.icon}{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-wa-status">
          <span className={`status-dot ${waStatus.status}`} />
          <span>WhatsApp: {waStatus.status}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '0.5rem 1rem 0' }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} style={{
              flex: 1, padding: '0.35rem 0.4rem', borderRadius: 7, cursor: 'pointer',
              font: 'inherit', fontSize: '0.75rem', fontWeight: getLang() === l.code ? 700 : 500,
              border: '1px solid var(--border, #e2e8f0)',
              background: getLang() === l.code ? 'var(--primary, #4f46e5)' : 'transparent',
              color: getLang() === l.code ? '#fff' : 'inherit',
            }}>{l.label}</button>
          ))}
        </div>
        <button className="sidebar-logout" onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '0.5rem 1rem 1rem',
          padding: '0.5rem 0.75rem', background: 'none', border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 8, color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem',
        }}>
          <FiLogOut /> {t('nav.signOut')}
        </button>
      </aside>
      <div className="main-content">
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          <span style={{ fontWeight: 600 }}>Cosmo CRM</span>
          <span className={`status-dot ${waStatus.status}`} />
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/:id" element={<GroupDetail />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/homeworks" element={<Homeworks />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/registrations" element={<Registrations />} />
          <Route path="/content" element={<Content />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
