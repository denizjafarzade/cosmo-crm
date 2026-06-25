import React, { useState, useEffect } from 'react';
import { FiSave } from 'react-icons/fi';
import api from '../api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.getSettings().then(setSettings); }, []);

  const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const save = async () => {
    await api.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <button className="btn btn-primary" onClick={save}><FiSave /> {saved ? 'Saved!' : 'Save'}</button>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header"><h2>General</h2></div>
            <div className="card-body">
              <div className="form-group"><label>Timezone</label><input className="form-input" value={settings.timezone || ''} onChange={e => update('timezone', e.target.value)} /></div>
              <div className="form-group"><label>Teacher WhatsApp #</label><input className="form-input" value={settings.teacher_whatsapp || ''} onChange={e => update('teacher_whatsapp', e.target.value)} placeholder="994501234567" /></div>
              <div className="form-group"><label>Default Reminder (min before)</label><input className="form-input" type="number" value={settings.default_reminder_minutes || ''} onChange={e => update('default_reminder_minutes', e.target.value)} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Payments</h2></div>
            <div className="card-body">
              <div className="form-group"><label>Payment Cycle (lessons)</label><input className="form-input" type="number" value={settings.payment_cycle_lessons || ''} onChange={e => update('payment_cycle_lessons', e.target.value)} /></div>
              <div className="form-group"><label>Escalation Days (comma-separated)</label><input className="form-input" value={settings.payment_reminder_days || ''} onChange={e => update('payment_reminder_days', e.target.value)} placeholder="3,7" /></div>
              <div className="form-group"><label>Excused Absences / Month</label><input className="form-input" type="number" value={settings.excused_absence_limit_per_month || ''} onChange={e => update('excused_absence_limit_per_month', e.target.value)} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Weekly Report</h2></div>
            <div className="card-body">
              <div className="form-group"><label>Report Day</label>
                <select className="form-input" value={settings.weekly_report_day || '1'} onChange={e => update('weekly_report_day', e.target.value)}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Report Time</label><input className="form-input" type="time" value={settings.weekly_report_time || '09:00'} onChange={e => update('weekly_report_time', e.target.value)} /></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
