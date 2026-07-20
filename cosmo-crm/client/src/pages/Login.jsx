import React, { useState } from 'react';
import { FaChessKnight } from 'react-icons/fa';
import api, { setToken } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, username: u } = await api.login(username.trim(), password);
      setToken(token);
      onLogin(u);
    } catch (err) {
      setError('Invalid username or password');
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--slate-100, #f1f5f9)', padding: '1rem',
    }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380, padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 6, fontSize: '1.4rem', fontWeight: 700 }}>
          <FaChessKnight style={{ color: 'var(--primary, #4f46e5)' }} />
          <span>Cosmo CRM</span>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Sign in to continue
        </p>
        <div className="form-group">
          <label>Username</label>
          <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} autoFocus required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && <div style={{ color: 'var(--red, #dc2626)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
