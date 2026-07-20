import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiDownload } from 'react-icons/fi';
import api from '../api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AttendanceCalendar({ student, onClose }) {
  const [lessons, setLessons] = useState(null);
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  useEffect(() => {
    api.getLessons({ student_id: student.id }).then(setLessons).catch(() => setLessons([]));
  }, [student.id]);

  // Map date-string -> { attended, excused, unexcused }
  const dayMap = useMemo(() => {
    const map = {};
    for (const l of lessons || []) {
      const day = (l.occurred_at || '').slice(0, 10);
      if (!day) continue;
      if (!map[day]) map[day] = { attended: false, excused: false, unexcused: false };
      if (l.absent) {
        if (l.is_excused) map[day].excused = true;
        else map[day].unexcused = true;
      } else {
        map[day].attended = true;
      }
    }
    return map;
  }, [lessons]);

  const changeMonth = (delta) => {
    setView(v => {
      let m = v.month + delta, y = v.year;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  // Build the grid: leading blanks (Mon-first), then days.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7; // Mon=0
    const arr = [];
    for (let i = 0; i < leading; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [view]);

  const monthLabel = `${MONTHS[view.month]} ${view.year}`;
  const attendedCount = useMemo(() => {
    const prefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}-`;
    return Object.entries(dayMap).filter(([k, v]) => k.startsWith(prefix) && v.attended).length;
  }, [dayMap, view]);

  const download = () => {
    const scale = 2;
    const W = 700, H = 560;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // Background
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // Header
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 26px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${student.name} ${student.surname} — Attendance`, 40, 50);
    ctx.fillStyle = '#475569';
    ctx.font = '600 18px Arial';
    ctx.fillText(monthLabel, 40, 82);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#16a34a';
    ctx.fillText(`${attendedCount} lessons`, W - 40, 82);
    ctx.textAlign = 'center';

    const gridX = 40, gridY = 110, cellW = (W - 80) / 7, cellH = 62;
    // Weekday headers
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Arial';
    WEEKDAYS.forEach((wd, i) => ctx.fillText(wd.toUpperCase(), gridX + cellW * i + cellW / 2, gridY - 10));
    // Cells
    let row = 0, col = 0;
    for (const cell of cells) {
      const cx = gridX + col * cellW + cellW / 2;
      const cy = gridY + row * cellH + cellH / 2;
      if (cell != null) {
        const key = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
        const info = dayMap[key];
        if (info && info.attended) {
          ctx.beginPath();
          ctx.arc(cx, cy - 4, 20, 0, Math.PI * 2);
          ctx.fillStyle = '#22c55e';
          ctx.fill();
          ctx.fillStyle = '#ffffff';
        } else if (info && info.unexcused) {
          ctx.beginPath();
          ctx.arc(cx, cy - 4, 20, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.fillStyle = '#ffffff';
        } else if (info && info.excused) {
          ctx.beginPath();
          ctx.arc(cx, cy - 4, 20, 0, Math.PI * 2);
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#f59e0b';
        } else {
          ctx.fillStyle = '#334155';
        }
        ctx.font = '600 16px Arial';
        ctx.fillText(String(cell), cx, cy);
      }
      col++;
      if (col === 7) { col = 0; row++; }
    }
    // Legend
    const ly = gridY + (row + 1) * cellH + 10;
    ctx.textAlign = 'left';
    ctx.beginPath(); ctx.arc(gridX + 10, ly, 8, 0, Math.PI * 2); ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.fillStyle = '#475569'; ctx.font = '13px Arial';
    ctx.fillText('Lesson attended', gridX + 26, ly + 4);
    ctx.beginPath(); ctx.arc(gridX + 190, ly, 8, 0, Math.PI * 2); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.fillText('Excused absence', gridX + 206, ly + 4);
    ctx.beginPath(); ctx.arc(gridX + 360, ly, 8, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillText('Unexcused', gridX + 376, ly + 4);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${student.name}_${student.surname}_attendance_${view.year}-${String(view.month + 1).padStart(2, '0')}.png`;
    a.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Attendance — {student.name} {student.surname}</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button className="btn btn-sm btn-outline btn-icon" onClick={() => changeMonth(-1)}><FiChevronLeft /></button>
            <div style={{ fontWeight: 600 }}>
              {monthLabel}
              <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--green, #16a34a)' }}>{attendedCount} lessons</span>
            </div>
            <button className="btn btn-sm btn-outline btn-icon" onClick={() => changeMonth(1)}><FiChevronRight /></button>
          </div>

          {lessons === null ? (
            <p style={{ color: 'var(--slate-400)' }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                {WEEKDAYS.map(wd => (
                  <div key={wd} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--slate-400)', padding: '4px 0' }}>{wd}</div>
                ))}
                {cells.map((cell, i) => {
                  if (cell == null) return <div key={i} />;
                  const key = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
                  const info = dayMap[key];
                  const attended = info && info.attended;
                  const excused = info && info.excused && !attended;
                  const unexcused = info && info.unexcused && !attended && !excused;
                  return (
                    <div key={i} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.85rem', fontWeight: attended ? 700 : 500,
                        background: attended ? '#22c55e' : unexcused ? '#ef4444' : 'transparent',
                        color: attended || unexcused ? '#fff' : excused ? '#f59e0b' : 'var(--text, #334155)',
                        border: excused ? '2px solid #f59e0b' : 'none',
                      }}>{cell}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: '0.78rem', color: 'var(--slate-400)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Attended
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #f59e0b', display: 'inline-block' }} /> Excused
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Unexcused
                </span>
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={download}><FiDownload /> Download image</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
