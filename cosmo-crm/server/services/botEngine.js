// The bot's brain: turns an inbound WhatsApp message into CRM actions.
//
// Two audiences share one number:
//   - the coach (a number listed in wa_admin_numbers) gets a full control
//     menu: inquiries, today's lessons, attendance, payments, students;
//   - everyone else gets the enrolment flow and their own child's status.
//
// Conversations are stateful (wa_state), because WhatsApp has no "form" —
// a registration is a sequence of questions whose answers accumulate in
// wa_state.data until the last step writes one row to `registrations`.

const db = require('../db');
const wa = require('./whatsappCloud');

const T = {
  unknownCmd: 'Bu əmri tanımadım. Menyu üçün *menyu* yazın.',
  menuTitle: 'Nə etmək istəyirsiniz?',
  cancelled: 'Ləğv edildi.',
  none: 'Heç nə yoxdur.',
  err: 'Xəta baş verdi. Yenidən cəhd edin və ya CRM-dən baxın.',
};

const LEVELS = {
  '1': { key: 'Beginner', label: 'Yeni başlayan' },
  '2': { key: 'Intermediate', label: 'Orta' },
  '3': { key: 'Advanced', label: 'İrəli' },
  '4': { key: 'Not sure', label: 'Bilmirəm' },
};

// --- contacts & roles ----------------------------------------------------
function adminNumbers() {
  const raw = db.getSetting('wa_admin_numbers') || process.env.WA_ADMIN_NUMBERS || '';
  return raw.split(',').map(s => wa.toWaId(s)).filter(Boolean);
}

function isAdmin(waId) {
  return adminNumbers().includes(wa.toWaId(waId));
}

function touchContact(waId, profileName) {
  const role = isAdmin(waId) ? 'admin' : undefined;
  db.prepare(`INSERT INTO wa_contacts (wa_id, profile_name, role, last_inbound_at)
    VALUES (?, ?, COALESCE(?, 'unknown'), datetime('now'))
    ON CONFLICT(wa_id) DO UPDATE SET
      last_inbound_at = datetime('now'),
      profile_name = COALESCE(NULLIF(excluded.profile_name, ''), wa_contacts.profile_name),
      role = COALESCE(?, wa_contacts.role),
      updated_at = datetime('now')`).run(waId, profileName || '', role, role);
}

// --- conversation state --------------------------------------------------
function getState(waId) {
  const row = db.prepare(`SELECT * FROM wa_state WHERE wa_id = ?
    AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`).get(waId);
  if (!row) return null;
  try { return { ...row, data: JSON.parse(row.data) }; }
  catch { return { ...row, data: {} }; }
}

function setState(waId, flow, step, data = {}) {
  db.prepare(`INSERT INTO wa_state (wa_id, flow, step, data, expires_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', '+2 hours'), datetime('now'))
    ON CONFLICT(wa_id) DO UPDATE SET flow = excluded.flow, step = excluded.step,
      data = excluded.data, expires_at = excluded.expires_at, updated_at = datetime('now')`)
    .run(waId, flow, step, JSON.stringify(data));
}

function clearState(waId) {
  db.prepare('DELETE FROM wa_state WHERE wa_id = ?').run(waId);
}

// --- small helpers -------------------------------------------------------
const DAYS = ['Bazar', 'B.e', 'Ç.a', 'Çərşənbə', 'C.a', 'Cümə', 'Şənbə'];
const cycle = () => parseInt(db.getSetting('payment_cycle_lessons') || '8', 10);
const fullName = (s) => `${s.name}${s.surname ? ' ' + s.surname : ''}`;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// =========================================================================
// ADMIN
// =========================================================================
async function adminMenu(waId) {
  const newRegs = db.prepare("SELECT COUNT(*) c FROM registrations WHERE status = 'new'").get().c;
  const overdue = db.prepare(
    'SELECT COUNT(*) c FROM students WHERE active = 1 AND lessons_since_payment > ?'
  ).get(cycle()).c;
  const todayCount = db.prepare(`SELECT COUNT(*) c FROM group_schedules WHERE day_of_week = ?`)
    .get(new Date().getDay()).c;

  return wa.sendList(waId, {
    header: 'Cosmo Chess CRM',
    body: T.menuTitle,
    button: 'Menyu',
    sections: [{
      title: 'İdarəetmə',
      rows: [
        { id: 'menu:regs', title: `Müraciətlər (${newRegs})`, description: 'Yeni qeydiyyat müraciətləri' },
        { id: 'menu:today', title: `Bugünkü dərslər (${todayCount})`, description: 'Davamiyyət və ləğv' },
        { id: 'menu:payments', title: `Ödənişlər (${overdue})`, description: 'Gecikmiş ödənişlər' },
        { id: 'menu:students', title: 'Şagird axtar', description: 'Ad ilə axtarış' },
        { id: 'menu:groups', title: 'Qruplar', description: 'Cədvəl və tərkib' },
        { id: 'menu:report', title: 'Hesabat', description: 'Həftəlik xülasə' },
      ],
    }],
  });
}

async function adminRegistrations(waId) {
  const regs = db.prepare(
    "SELECT * FROM registrations WHERE status = 'new' ORDER BY created_at DESC LIMIT 9"
  ).all();
  if (!regs.length) return wa.sendText(waId, '✅ Yeni müraciət yoxdur.');

  return wa.sendList(waId, {
    header: `Yeni müraciətlər (${regs.length})`,
    body: 'Baxmaq üçün birini seçin:',
    button: 'Siyahı',
    sections: [{
      title: 'Müraciətlər',
      rows: regs.map(r => ({
        id: `reg:${r.id}`,
        title: `${r.name}${r.surname ? ' ' + r.surname : ''}`.slice(0, 24),
        description: `${r.phone || '—'} · ${r.level || 'səviyyə yox'}`,
      })),
    }],
  });
}

async function adminRegistrationDetail(waId, regId) {
  const r = db.prepare('SELECT * FROM registrations WHERE id = ?').get(regId);
  if (!r) return wa.sendText(waId, 'Müraciət tapılmadı.');

  let avail = '—';
  try {
    const parsed = JSON.parse(r.availability || '[]');
    if (Array.isArray(parsed) && parsed.length) {
      avail = parsed.map(s => {
        const [d, range] = String(s).split('|');
        return `${DAYS[Number(d)] || d} ${range || ''}`.trim();
      }).join(', ');
    }
  } catch { /* availability may be a plain string on older rows */ }

  const ratings = r.blitz_rating || r.rapid_rating
    ? `\n♟ Reytinq: blitz ${r.blitz_rating ?? '—'}, rapid ${r.rapid_rating ?? '—'}`
    : '';

  const text =
    `*${r.name}${r.surname ? ' ' + r.surname : ''}*\n` +
    `📞 ${r.phone || '—'}\n` +
    `🎂 ${r.birth_date || '—'}\n` +
    `📊 Səviyyə: ${r.level || '—'}\n` +
    `🗣 Dil: ${r.sector || '—'}\n` +
    `🕒 Uyğun vaxt: ${avail}` +
    ratings +
    (r.message ? `\n💬 ${r.message}` : '');

  await wa.sendText(waId, text);
  return wa.sendButtons(waId, 'Bu müraciətlə nə edək?', [
    { id: `reg_enroll:${r.id}`, title: 'Qrupa yaz' },
    { id: `reg_contacted:${r.id}`, title: 'Əlaqə saxlandı' },
    { id: `reg_reject:${r.id}`, title: 'Rədd et' },
  ]);
}

async function adminEnrollPick(waId, regId) {
  const groups = db.prepare(`SELECT g.*, (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) AS cnt
    FROM groups g ORDER BY g.name LIMIT 9`).all();
  if (!groups.length) return wa.sendText(waId, 'Hələ qrup yoxdur. Əvvəlcə CRM-də qrup yaradın.');

  const schedules = db.prepare('SELECT group_id, day_of_week, time FROM group_schedules').all();
  const byGroup = schedules.reduce((m, s) => {
    (m[s.group_id] ||= []).push(`${DAYS[s.day_of_week]} ${s.time}`);
    return m;
  }, {});

  return wa.sendList(waId, {
    header: 'Qrup seçin',
    body: 'Şagird hansı qrupa yazılsın?',
    button: 'Qruplar',
    sections: [{
      title: 'Qruplar',
      rows: groups.map(g => ({
        id: `enroll:${regId}:${g.id}`,
        title: `${g.name} (${g.cnt})`.slice(0, 24),
        description: (byGroup[g.id] || []).join(', ') || 'cədvəl yoxdur',
      })),
    }],
  });
}

function doEnroll(regId, groupId) {
  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(regId);
  if (!reg) throw new Error('Müraciət tapılmadı');

  const LEVEL_MAP = {
    'new to chess': 'new_to_chess', beginner: 'beginner', intermediate: 'intermediate',
    advanced: 'advanced', expert: 'expert', 'not sure': 'not_sure',
  };
  const level = LEVEL_MAP[String(reg.level || '').toLowerCase()] || 'beginner';
  const parts = String(reg.name || '').trim().split(/\s+/);
  const name = parts[0] || reg.name;
  const surname = (reg.surname && reg.surname.trim()) || parts.slice(1).join(' ');

  const run = db.transaction(() => {
    const ins = db.prepare(`INSERT INTO students
      (name, surname, whatsapp_number, level, fide_rating, group_id, birth_date, sector,
       chess_platform, chess_username, blitz_rating, rapid_rating, blitz_games, rapid_games,
       ratings_updated_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name, surname, reg.phone || null, level, reg.fide_rating ?? null, groupId,
        reg.birth_date || null, reg.sector || null, reg.chess_platform || null,
        reg.chess_username || null, reg.blitz_rating ?? null, reg.rapid_rating ?? null,
        reg.blitz_games ?? null, reg.rapid_games ?? null, reg.ratings_updated_at || null,
        reg.notes || '');
    db.prepare("UPDATE registrations SET status = 'enrolled', updated_at = datetime('now') WHERE id = ?")
      .run(regId);
    // Link the applicant's WhatsApp number to the new student so their later
    // messages are recognised instead of starting a fresh enrolment.
    const waId = wa.toWaId(reg.phone);
    if (waId) {
      db.prepare(`INSERT INTO wa_contacts (wa_id, student_id, role) VALUES (?, ?, 'parent')
        ON CONFLICT(wa_id) DO UPDATE SET student_id = excluded.student_id,
          role = CASE WHEN wa_contacts.role = 'admin' THEN 'admin' ELSE 'parent' END,
          updated_at = datetime('now')`).run(waId, ins.lastInsertRowid);
    }
    return ins.lastInsertRowid;
  });
  return run();
}

async function adminToday(waId) {
  const dow = new Date().getDay();
  const slots = db.prepare(`SELECT gs.*, g.name AS group_name, g.id AS gid,
      (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) AS cnt
    FROM group_schedules gs JOIN groups g ON g.id = gs.group_id
    WHERE gs.day_of_week = ? ORDER BY gs.time`).all(dow);
  if (!slots.length) return wa.sendText(waId, `📅 Bu gün (${DAYS[dow]}) dərs yoxdur.`);

  const cancelled = db.prepare(
    `SELECT group_id, slot_time FROM lesson_cancellations WHERE date = ?`
  ).all(todayIso());
  const isCancelled = (gid, time) =>
    cancelled.some(c => c.group_id === gid && (!c.slot_time || c.slot_time === time));

  return wa.sendList(waId, {
    header: `Bugünkü dərslər — ${DAYS[dow]}`,
    body: 'Davamiyyət üçün dərsi seçin:',
    button: 'Dərslər',
    sections: [{
      title: 'Cədvəl',
      rows: slots.map(s => ({
        id: `slot:${s.gid}:${s.time}`,
        title: `${s.time} ${s.group_name}`.slice(0, 24),
        description: isCancelled(s.gid, s.time) ? 'LƏĞV EDİLİB' : `${s.cnt} şagird`,
      })),
    }],
  });
}

async function adminSlot(waId, groupId, time) {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!g) return wa.sendText(waId, 'Qrup tapılmadı.');
  const students = db.prepare(
    'SELECT * FROM students WHERE group_id = ? AND active = 1 ORDER BY name'
  ).all(groupId);

  setState(waId, 'attendance', 'collect', { groupId: Number(groupId), time, absent: [] });

  const list = students.map((s, i) => `${i + 1}. ${fullName(s)}`).join('\n');
  await wa.sendText(waId,
    `*${g.name}* — ${time}\n\n${list || 'Şagird yoxdur'}\n\n` +
    `Qayıb olanların nömrələrini yazın (məs: *2 5*).\n` +
    `Hamı iştirak edibsə *hamı* yazın.\n` +
    `Dərsi ləğv etmək üçün *ləğv* yazın.`);
  return { ok: true };
}

async function handleAttendanceInput(waId, state, text) {
  const { groupId, time } = state.data;
  const students = db.prepare(
    'SELECT * FROM students WHERE group_id = ? AND active = 1 ORDER BY name'
  ).all(groupId);
  const t = text.trim().toLowerCase();

  if (t === 'ləğv' || t === 'legv' || t === 'cancel') {
    db.prepare(`INSERT INTO lesson_cancellations (group_id, slot_time, date, reason, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))`).run(groupId, time, todayIso(), 'WhatsApp bot');
    clearState(waId);
    return wa.sendText(waId, `🚫 ${time} dərsi ləğv edildi. Bu dərs heç kimin sayğacına yazılmayacaq.`);
  }

  let absentIdx = [];
  if (t !== 'hamı' && t !== 'hami' && t !== 'all') {
    absentIdx = t.split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= students.length);
    if (!absentIdx.length) {
      return wa.sendText(waId, 'Anlamadım. Nömrələri boşluqla yazın (məs: *2 5*), yaxud *hamı* / *ləğv*.');
    }
  }

  const absentees = absentIdx.map(i => students[i - 1]);
  setState(waId, 'attendance', 'excuse', { ...state.data, absent: absentees.map(s => s.id) });

  if (!absentees.length) {
    return finishAttendance(waId, { ...state.data, absent: [] }, false);
  }
  return wa.sendButtons(waId,
    `Qayıb: ${absentees.map(fullName).join(', ')}\n\nSəbəb üzrlüdür?`,
    [
      { id: 'att_excused:1', title: 'Bəli, üzrlü' },
      { id: 'att_excused:0', title: 'Xeyr' },
    ]);
}

// Attendance mirrors the CRM rule: everyone is present by default, a lesson is
// recorded for each attendee, and an absence is never counted toward payment.
function finishAttendance(waId, data, excused) {
  const { groupId, time, absent = [] } = data;
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  const students = db.prepare(
    'SELECT * FROM students WHERE group_id = ? AND active = 1'
  ).all(groupId);

  const lessonNo = (g.current_lesson_number || 0) + 1;
  const run = db.transaction(() => {
    let inserted = 0;
    for (const s of students) {
      const isAbsent = absent.includes(s.id);
      const already = db.prepare(`SELECT 1 FROM lessons WHERE student_id = ? AND group_id = ?
        AND date(occurred_at) = date('now') AND slot_time = ?`).get(s.id, groupId, time);
      if (already) continue;
      db.prepare(`INSERT INTO lessons
        (group_id, student_id, lesson_number, occurred_at, is_excused, counts_toward_payment, absent, slot_time)
        VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)`)
        .run(groupId, s.id, lessonNo, isAbsent && excused ? 1 : 0, isAbsent ? 0 : 1, isAbsent ? 1 : 0, time);
      db.recomputeLessonsSincePayment(s.id);
      inserted++;
    }
    // Only advance the group's lesson counter when this slot actually produced
    // new rows; re-opening an already-recorded slot must not bump it again.
    if (inserted > 0) {
      db.prepare("UPDATE groups SET current_lesson_number = ?, updated_at = datetime('now') WHERE id = ?")
        .run(lessonNo, groupId);
    }
    return inserted;
  });
  const inserted = run();
  clearState(waId);

  if (inserted === 0) {
    return wa.sendText(waId,
      `ℹ️ *${g.name}* ${time} dərsi bu gün artıq qeyd olunub — dəyişiklik edilmədi.\n` +
      `Düzəliş lazımdırsa CRM-dən edin.`);
  }

  const present = students.length - absent.length;
  return wa.sendText(waId,
    `✅ Dərs #${lessonNo} yazıldı — *${g.name}* ${time}\n` +
    `İştirak: ${present} · Qayıb: ${absent.length}${absent.length ? (excused ? ' (üzrlü)' : ' (üzrsüz)') : ''}`);
}

async function adminPayments(waId) {
  const c = cycle();
  const due = db.prepare(`SELECT s.*, g.name AS group_name FROM students s
    LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.active = 1 AND s.lessons_since_payment > ?
    ORDER BY s.lessons_since_payment DESC LIMIT 9`).all(c);
  if (!due.length) return wa.sendText(waId, '✅ Gecikmiş ödəniş yoxdur.');

  return wa.sendList(waId, {
    header: `Gecikmiş ödənişlər (${due.length})`,
    body: `${c} dərsdən çox keçib:`,
    button: 'Siyahı',
    sections: [{
      title: 'Şagirdlər',
      rows: due.map(s => ({
        id: `stu:${s.id}`,
        title: fullName(s).slice(0, 24),
        description: `${s.lessons_since_payment} dərs · ${s.group_name || 'qrupsuz'}`,
      })),
    }],
  });
}

async function adminStudentCard(waId, studentId) {
  const s = db.prepare(`SELECT s.*, g.name AS group_name FROM students s
    LEFT JOIN groups g ON g.id = s.group_id WHERE s.id = ?`).get(studentId);
  if (!s) return wa.sendText(waId, 'Şagird tapılmadı.');

  const lastPay = db.prepare(
    'SELECT amount, confirmed_at FROM payments WHERE student_id = ? ORDER BY confirmed_at DESC LIMIT 1'
  ).get(studentId);
  const attended = db.prepare(
    'SELECT COUNT(*) c FROM lessons WHERE student_id = ? AND absent = 0'
  ).get(studentId).c;

  await wa.sendText(waId,
    `*${fullName(s)}*\n` +
    `👥 ${s.group_name || 'qrupsuz'}\n` +
    `📞 ${s.whatsapp_number || '—'}${s.parent_whatsapp ? ` (valideyn: ${s.parent_whatsapp})` : ''}\n` +
    `📚 Ödənişdən sonra: *${s.lessons_since_payment}* / ${cycle()} dərs\n` +
    `✅ Ümumi iştirak: ${attended}\n` +
    `💳 Son ödəniş: ${lastPay ? `${lastPay.amount} AZN · ${lastPay.confirmed_at.slice(0, 10)}` : '—'}`);

  return wa.sendButtons(waId, 'Nə edək?', [
    { id: `pay:${s.id}`, title: 'Ödəniş təsdiqlə' },
    { id: `remind:${s.id}`, title: 'Xatırlatma göndər' },
    { id: `adj:${s.id}`, title: 'Dərs sayı ±' },
  ]);
}

async function adminGroups(waId) {
  const groups = db.prepare(`SELECT g.*, c.name AS coach,
      (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) AS cnt
    FROM groups g LEFT JOIN coaches c ON c.id = g.coach_id ORDER BY g.name`).all();
  if (!groups.length) return wa.sendText(waId, 'Qrup yoxdur.');

  const scheds = db.prepare('SELECT group_id, day_of_week, time FROM group_schedules ORDER BY day_of_week, time').all();
  const lines = groups.map(g => {
    const s = scheds.filter(x => x.group_id === g.id).map(x => `${DAYS[x.day_of_week]} ${x.time}`).join(', ');
    return `*${g.name}* — ${g.cnt} şagird · dərs #${g.current_lesson_number || 0}\n   ${s || 'cədvəl yoxdur'}`;
  });
  return wa.sendText(waId, `👥 *Qruplar*\n\n${lines.join('\n\n')}`);
}

async function adminReport(waId) {
  const c = cycle();
  const stats = {
    students: db.prepare('SELECT COUNT(*) c FROM students WHERE active = 1').get().c,
    groups: db.prepare('SELECT COUNT(*) c FROM groups').get().c,
    week: db.prepare("SELECT COUNT(*) c FROM lessons WHERE absent = 0 AND date(occurred_at) >= date('now','-7 days')").get().c,
    absent: db.prepare("SELECT COUNT(*) c FROM lessons WHERE absent = 1 AND date(occurred_at) >= date('now','-7 days')").get().c,
    revenue: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE date(confirmed_at) >= date('now','-30 days')").get().s,
    overdue: db.prepare('SELECT COUNT(*) c FROM students WHERE active = 1 AND lessons_since_payment > ?').get(c).c,
    newRegs: db.prepare("SELECT COUNT(*) c FROM registrations WHERE date(created_at) >= date('now','-7 days')").get().c,
  };
  return wa.sendText(waId,
    `📊 *Həftəlik hesabat*\n\n` +
    `👧 Aktiv şagird: ${stats.students}\n` +
    `👥 Qrup: ${stats.groups}\n` +
    `📚 Keçilən dərs (7 gün): ${stats.week}\n` +
    `🚫 Qayıb (7 gün): ${stats.absent}\n` +
    `🆕 Yeni müraciət (7 gün): ${stats.newRegs}\n` +
    `⚠️ Gecikmiş ödəniş: ${stats.overdue}\n` +
    `💰 Gəlir (30 gün): ${stats.revenue} AZN`);
}

// =========================================================================
// PARENTS / APPLICANTS
// =========================================================================
async function publicWelcome(waId, contact) {
  if (contact && contact.student_id) {
    return wa.sendButtons(waId,
      'Xoş gəldiniz! 👋\nNə öyrənmək istəyirsiniz?',
      [
        { id: 'p:status', title: 'Dərs vəziyyəti' },
        { id: 'p:schedule', title: 'Cədvəl' },
        { id: 'p:contact', title: 'Müəllimlə əlaqə' },
      ], { header: 'Cosmo Chess Academy' });
  }
  return wa.sendButtons(waId,
    'Cosmo Chess Academy-yə xoş gəldiniz! ♟\n\nŞahmat dərslərinə yazılmaq üçün bir neçə sual verəcəyəm.',
    [
      { id: 'p:register', title: 'Qeydiyyatdan keç' },
      { id: 'p:info', title: 'Məlumat al' },
      { id: 'p:contact', title: 'Müəllimlə əlaqə' },
    ], { header: 'Cosmo Chess Academy' });
}

async function startRegistration(waId) {
  setState(waId, 'register', 'name', {});
  return wa.sendText(waId, 'Əla! 📝\n\n1/5 — Şagirdin *adını* yazın:');
}

async function handleRegistration(waId, state, text) {
  const d = { ...state.data };
  const val = text.trim();

  switch (state.step) {
    case 'name':
      if (val.length < 2) return wa.sendText(waId, 'Zəhmət olmasa adı düzgün yazın:');
      d.name = val;
      setState(waId, 'register', 'surname', d);
      return wa.sendText(waId, '2/5 — *Soyadını* yazın:');

    case 'surname':
      d.surname = val;
      setState(waId, 'register', 'birth', d);
      return wa.sendText(waId, '3/5 — *Doğum tarixini* yazın (GG.AA.İİİİ):');

    case 'birth': {
      const m = val.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
      if (!m) return wa.sendText(waId, 'Format düzgün deyil. Məsələn: *15.03.2014*');
      d.birth_date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      setState(waId, 'register', 'level', d);
      return wa.sendButtons(waId, '4/5 — Şahmat *səviyyəsi*:', [
        { id: 'lvl:1', title: 'Yeni başlayan' },
        { id: 'lvl:2', title: 'Orta' },
        { id: 'lvl:3', title: 'İrəli' },
      ]);
    }

    case 'level':
      // Typed instead of tapping a button.
      if (LEVELS[val]) { d.level = LEVELS[val].key; }
      else d.level = val;
      setState(waId, 'register', 'time', d);
      return wa.sendText(waId, '5/5 — Hansı *günlər və saatlar* uyğundur?\n(məs: B.e və Çərşənbə 16:00-18:00)');

    case 'time':
      d.availability = val;
      return finishRegistration(waId, d);

    default:
      clearState(waId);
      return publicWelcome(waId, null);
  }
}

async function finishRegistration(waId, d) {
  const info = db.prepare(`INSERT INTO registrations
    (name, surname, phone, level, birth_date, availability, message, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`)
    .run(d.name, d.surname || '', waId, d.level || '', d.birth_date || null,
      d.availability || '', 'WhatsApp bot vasitəsilə');

  db.prepare(`UPDATE wa_contacts SET registration_id = ?, role = 'parent', updated_at = datetime('now')
    WHERE wa_id = ?`).run(info.lastInsertRowid, waId);
  clearState(waId);

  await wa.sendText(waId,
    `✅ *Müraciətiniz qeydə alındı!*\n\n` +
    `👧 ${d.name} ${d.surname || ''}\n` +
    `🎂 ${d.birth_date || '—'}\n` +
    `📊 ${d.level || '—'}\n` +
    `🕒 ${d.availability || '—'}\n\n` +
    `Müəllimimiz tezliklə sizinlə əlaqə saxlayacaq. Təşəkkürlər! ♟`);

  // Tell the coach straight away — but only inside their 24h window; outside
  // it this needs an approved template, so a failure here must not break the
  // applicant's confirmation above.
  for (const admin of adminNumbers()) {
    try {
      await wa.sendSmart(admin, {
        text: `🆕 *Yeni müraciət*\n\n${d.name} ${d.surname || ''}\n📞 ${waId}\n📊 ${d.level || '—'}\n🕒 ${d.availability || '—'}\n\nBaxmaq üçün *müraciətlər* yazın.`,
        template: db.getSetting('wa_tpl_new_inquiry')
          ? { name: db.getSetting('wa_tpl_new_inquiry'), bodyParams: [`${d.name} ${d.surname || ''}`, waId] }
          : null,
      });
    } catch (e) {
      console.error('[Bot] Could not notify admin of a new inquiry:', e.message);
    }
  }
  return { ok: true };
}

async function parentStatus(waId, contact) {
  const s = db.prepare(`SELECT s.*, g.name AS group_name FROM students s
    LEFT JOIN groups g ON g.id = s.group_id WHERE s.id = ?`).get(contact.student_id);
  if (!s) return wa.sendText(waId, 'Məlumat tapılmadı. Müəllimlə əlaqə saxlayın.');

  const c = cycle();
  const left = Math.max(0, c - (s.lessons_since_payment || 0));
  const attended = db.prepare('SELECT COUNT(*) c FROM lessons WHERE student_id = ? AND absent = 0').get(s.id).c;

  return wa.sendText(waId,
    `♟ *${fullName(s)}*\n\n` +
    `👥 Qrup: ${s.group_name || '—'}\n` +
    `📚 Keçilən dərs: ${attended}\n` +
    `💳 Cari dövrədə: ${s.lessons_since_payment}/${c}\n` +
    (left > 0 ? `⏳ Ödənişə ${left} dərs qalıb` : `⚠️ Ödəniş vaxtı çatıb`));
}

async function parentSchedule(waId, contact) {
  const s = db.prepare('SELECT group_id FROM students WHERE id = ?').get(contact.student_id);
  if (!s || !s.group_id) return wa.sendText(waId, 'Qrup təyin olunmayıb. Müəllimlə əlaqə saxlayın.');
  const rows = db.prepare(
    'SELECT day_of_week, time FROM group_schedules WHERE group_id = ? ORDER BY day_of_week, time'
  ).all(s.group_id);
  if (!rows.length) return wa.sendText(waId, 'Cədvəl hələ təyin olunmayıb.');
  return wa.sendText(waId,
    `📅 *Dərs cədvəli*\n\n${rows.map(r => `• ${DAYS[r.day_of_week]} — ${r.time}`).join('\n')}`);
}

// =========================================================================
// ROUTER
// =========================================================================
async function handleMessage({ waId, profileName, text, interactiveId, messageId }) {
  touchContact(waId, profileName);
  if (messageId) wa.markRead(messageId).catch(() => {});

  const contact = db.prepare('SELECT * FROM wa_contacts WHERE wa_id = ?').get(waId);
  if (contact && contact.blocked) return { ok: true, skipped: 'blocked' };

  const admin = isAdmin(waId);
  const id = interactiveId || '';
  const t = (text || '').trim().toLowerCase();

  // Universal escape hatch.
  if (['stop', 'ləğv et', 'legv et', 'imtina'].includes(t)) {
    clearState(waId);
    return wa.sendText(waId, T.cancelled);
  }

  // --- interactive taps --------------------------------------------------
  if (id) {
    // Payload ids are "key:arg1:arg2", but arg2 can itself contain a colon —
    // a slot time is "12:40" — so only the first two separators are split on
    // and the remainder is kept whole.
    const sep = id.indexOf(':');
    const key = sep === -1 ? id : id.slice(0, sep);
    const rest = sep === -1 ? '' : id.slice(sep + 1);
    const sep2 = rest.indexOf(':');
    const a = sep2 === -1 ? rest : rest.slice(0, sep2);
    const b = sep2 === -1 ? '' : rest.slice(sep2 + 1);
    try {
      if (admin) {
        switch (key) {
          case 'menu':
            if (a === 'regs') return adminRegistrations(waId);
            if (a === 'today') return adminToday(waId);
            if (a === 'payments') return adminPayments(waId);
            if (a === 'groups') return adminGroups(waId);
            if (a === 'report') return adminReport(waId);
            if (a === 'students') {
              setState(waId, 'search', 'name', {});
              return wa.sendText(waId, 'Şagirdin adını yazın:');
            }
            break;
          case 'reg': return adminRegistrationDetail(waId, a);
          case 'reg_enroll': return adminEnrollPick(waId, a);
          case 'reg_contacted':
            db.prepare("UPDATE registrations SET status='contacted', updated_at=datetime('now') WHERE id=?").run(a);
            return wa.sendText(waId, '✅ "Əlaqə saxlandı" kimi işarələndi.');
          case 'reg_reject':
            db.prepare("UPDATE registrations SET status='rejected', updated_at=datetime('now') WHERE id=?").run(a);
            return wa.sendText(waId, '🚫 Müraciət rədd edildi.');
          case 'enroll': {
            const sid = doEnroll(a, b);
            const s = db.prepare('SELECT * FROM students WHERE id = ?').get(sid);
            const g = db.prepare('SELECT name FROM groups WHERE id = ?').get(b);
            return wa.sendText(waId, `✅ *${fullName(s)}* → *${g.name}* qrupuna yazıldı.`);
          }
          case 'slot': return adminSlot(waId, a, b);
          case 'att_excused': {
            const st = getState(waId);
            if (!st || st.flow !== 'attendance') return wa.sendText(waId, 'Davamiyyət sessiyası bitib. *bugün* yazın.');
            return finishAttendance(waId, st.data, a === '1');
          }
          case 'stu': return adminStudentCard(waId, a);
          case 'pay':
            setState(waId, 'payment', 'amount', { studentId: Number(a) });
            return wa.sendText(waId, 'Ödəniş məbləğini yazın (AZN):');
          case 'adj':
            setState(waId, 'adjust', 'delta', { studentId: Number(a) });
            return wa.sendText(waId, 'Neçə dərs əlavə/çıxılsın? (məs: *-1* və ya *2*)');
          case 'remind': {
            const s = db.prepare('SELECT * FROM students WHERE id = ?').get(a);
            const target = wa.toWaId(s.parent_whatsapp || s.whatsapp_number);
            if (!target) return wa.sendText(waId, 'Bu şagirdin nömrəsi yoxdur.');
            try {
              await wa.sendSmart(target, {
                text: `Hörmətli valideyn,\n\n${fullName(s)} üçün ${s.lessons_since_payment} dərs keçilib və ödəniş vaxtı çatıb.\n\nCosmo Chess Academy ♟`,
                template: db.getSetting('wa_tpl_payment_reminder')
                  ? { name: db.getSetting('wa_tpl_payment_reminder'), bodyParams: [fullName(s), String(s.lessons_since_payment)] }
                  : null,
              });
              return wa.sendText(waId, `✅ Xatırlatma göndərildi: ${target}`);
            } catch (e) {
              return wa.sendText(waId, e.code === 'NO_TEMPLATE'
                ? '⚠️ 24 saatlıq pəncərə bağlıdır və təsdiqlənmiş şablon təyin edilməyib. CRM → Parametrlərdən şablon adını yazın.'
                : `⚠️ Göndərilmədi: ${e.message}`);
            }
          }
        }
      }
      // Public taps
      switch (key) {
        case 'p':
          if (a === 'register') return startRegistration(waId);
          if (a === 'status') return contact?.student_id ? parentStatus(waId, contact) : publicWelcome(waId, contact);
          if (a === 'schedule') return contact?.student_id ? parentSchedule(waId, contact) : publicWelcome(waId, contact);
          if (a === 'info') return wa.sendText(waId,
            `♟ *Cosmo Chess Academy*\n\nUşaq, yeniyetmə və böyüklər üçün fərdi şahmat təlimi — yeni başlayanlardan turnir oyunçularına qədər.\n\n` +
            `📍 Bakı\n🌐 cosmochess.az\n\nQeydiyyat üçün *qeydiyyat* yazın.`);
          if (a === 'contact') {
            const n = adminNumbers()[0];
            return wa.sendText(waId, `👨‍🏫 Müəllim: Abdulla Şabanov\n📞 ${n ? '+' + n : 'cosmochess.az'}\n\nMesajınızı yazın, müəllimə çatdıracağam.`);
          }
          break;
        case 'lvl': {
          const st = getState(waId);
          if (st && st.flow === 'register') {
            return handleRegistration(waId, { ...st, step: 'level' }, a);
          }
          break;
        }
      }
    } catch (e) {
      console.error('[Bot] interactive handler failed:', e);
      return wa.sendText(waId, T.err);
    }
  }

  // --- stateful flows ----------------------------------------------------
  const state = getState(waId);
  if (state) {
    try {
      if (state.flow === 'register') return handleRegistration(waId, state, text || '');
      if (admin && state.flow === 'attendance' && state.step === 'collect') {
        return handleAttendanceInput(waId, state, text || '');
      }
      if (admin && state.flow === 'payment') {
        const amount = parseFloat(String(text).replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) return wa.sendText(waId, 'Məbləği rəqəmlə yazın (məs: *150*):');
        const sid = state.data.studentId;
        db.prepare(`INSERT INTO payments (student_id, amount, lessons_covered, confirmed_at, notes)
          VALUES (?, ?, ?, datetime('now'), 'WhatsApp bot')`).run(sid, amount, cycle());
        db.prepare("UPDATE students SET lessons_adjustment = 0, payment_status = 'paid', updated_at = datetime('now') WHERE id = ?").run(sid);
        const total = db.recomputeLessonsSincePayment(sid);
        clearState(waId);
        const s = db.prepare('SELECT * FROM students WHERE id = ?').get(sid);
        return wa.sendText(waId, `✅ Ödəniş qeydə alındı: *${fullName(s)}* — ${amount} AZN\nSayğac sıfırlandı (${total}).`);
      }
      if (admin && state.flow === 'adjust') {
        const delta = parseInt(String(text).trim(), 10);
        if (!Number.isFinite(delta) || delta === 0) return wa.sendText(waId, 'Sıfırdan fərqli tam ədəd yazın (məs: *-1*):');
        const sid = state.data.studentId;
        const cur = db.prepare('SELECT lessons_since_payment, COALESCE(lessons_adjustment,0) adj FROM students WHERE id = ?').get(sid);
        const applied = cur.lessons_since_payment + delta < 0 ? -cur.lessons_since_payment : delta;
        db.prepare("UPDATE students SET lessons_adjustment = ?, updated_at = datetime('now') WHERE id = ?")
          .run(cur.adj + applied, sid);
        const total = db.recomputeLessonsSincePayment(sid);
        clearState(waId);
        return wa.sendText(waId, `✅ Dərs sayı yeniləndi: *${total}*`);
      }
      if (admin && state.flow === 'search') {
        const q = `%${String(text).trim()}%`;
        const found = db.prepare(`SELECT * FROM students WHERE active = 1
          AND (name LIKE ? OR surname LIKE ?) ORDER BY name LIMIT 9`).all(q, q);
        clearState(waId);
        if (!found.length) return wa.sendText(waId, 'Şagird tapılmadı.');
        if (found.length === 1) return adminStudentCard(waId, found[0].id);
        return wa.sendList(waId, {
          header: 'Nəticələr', body: 'Şagirdi seçin:', button: 'Siyahı',
          sections: [{ title: 'Şagirdlər', rows: found.map(s => ({ id: `stu:${s.id}`, title: fullName(s).slice(0, 24), description: `${s.lessons_since_payment} dərs` })) }],
        });
      }
    } catch (e) {
      console.error('[Bot] flow handler failed:', e);
      clearState(waId);
      return wa.sendText(waId, T.err);
    }
  }

  // --- plain text commands ----------------------------------------------
  if (admin) {
    if (['menyu', 'menu', 'start', 'salam'].includes(t)) return adminMenu(waId);
    if (['müraciətlər', 'muracietler', 'reg'].includes(t)) return adminRegistrations(waId);
    if (['bugün', 'bugun', 'dərslər', 'dersler'].includes(t)) return adminToday(waId);
    if (['ödənişlər', 'odenisler', 'borc'].includes(t)) return adminPayments(waId);
    if (['qruplar', 'gruplar'].includes(t)) return adminGroups(waId);
    if (['hesabat', 'report'].includes(t)) return adminReport(waId);
    if (t.startsWith('axtar ')) {
      const q = `%${text.slice(6).trim()}%`;
      const found = db.prepare(`SELECT * FROM students WHERE active = 1
        AND (name LIKE ? OR surname LIKE ?) ORDER BY name LIMIT 9`).all(q, q);
      if (!found.length) return wa.sendText(waId, 'Şagird tapılmadı.');
      if (found.length === 1) return adminStudentCard(waId, found[0].id);
      return wa.sendList(waId, {
        header: 'Nəticələr', body: 'Şagirdi seçin:', button: 'Siyahı',
        sections: [{ title: 'Şagirdlər', rows: found.map(s => ({ id: `stu:${s.id}`, title: fullName(s).slice(0, 24), description: `${s.lessons_since_payment} dərs` })) }],
      });
    }
    return adminMenu(waId);
  }

  if (['qeydiyyat', 'register', 'yazılmaq'].includes(t)) return startRegistration(waId);
  if (['vəziyyət', 'veziyyet', 'status'].includes(t) && contact?.student_id) return parentStatus(waId, contact);
  if (['cədvəl', 'cedvel'].includes(t) && contact?.student_id) return parentSchedule(waId, contact);

  // Anything else from a parent: greet, and pass the text on to the coach so
  // a real question never disappears into the bot.
  if (text && text.length > 3 && contact?.student_id) {
    for (const admin2 of adminNumbers()) {
      wa.sendSmart(admin2, {
        text: `💬 *${contact.profile_name || waId}* yazdı:\n\n${text}`,
        template: null,
      }).catch(() => {});
    }
  }
  return publicWelcome(waId, contact);
}

module.exports = { handleMessage, isAdmin, adminNumbers, touchContact };
