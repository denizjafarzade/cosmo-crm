import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiLayers, FiBookOpen, FiFileText, FiDollarSign, FiSettings, FiActivity, FiMessageCircle, FiMenu, FiX, FiBarChart2, FiUserPlus, FiLogOut } from 'react-icons/fi';
import { FaChessKnight } from 'react-icons/fa';
import api, { getToken, setToken } from './api';
import Login from './pages/Login';
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
    { to: '/', icon: <FiHome />, label: 'Dashboard' },
    { to: '/students', icon: <FiUsers />, label: 'Students' },
    { to: '/groups', icon: <FiLayers />, label: 'Groups' },
    { to: '/lessons', icon: <FiBookOpen />, label: 'Lessons' },
    { to: '/homeworks', icon: <FiFileText />, label: 'Homeworks' },
    { to: '/payments', icon: <FiDollarSign />, label: 'Payments' },
    { to: '/registrations', icon: <FiUserPlus />, label: 'Registrations' },
  ];

  const nav2 = [
    { to: '/whatsapp', icon: <FiMessageCircle />, label: 'WhatsApp' },
    { to: '/activity', icon: <FiActivity />, label: 'Activity Log' },
    { to: '/reports', icon: <FiBarChart2 />, label: 'Reports' },
    { to: '/settings', icon: <FiSettings />, label: 'Settings' },
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
          <div className="sidebar-section">System</div>
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
        <button className="sidebar-logout" onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '0.5rem 1rem 1rem',
          padding: '0.5rem 0.75rem', background: 'none', border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 8, color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem',
        }}>
          <FiLogOut /> Sign out
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
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
