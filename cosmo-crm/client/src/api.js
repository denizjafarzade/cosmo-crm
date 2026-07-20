const BASE = '/api';
const TOKEN_KEY = 'cosmo_crm_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function handleUnauthorized() {
  setToken(null);
  // Force back to the login gate.
  if (typeof window !== 'undefined') window.location.reload();
}

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers },
    ...opts,
    body: opts.body ? (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function upload(path, formData) {
  return fetch(`${BASE}${path}`, { method: 'POST', body: formData, headers: authHeaders() }).then(r => {
    if (r.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    return r.json();
  });
}

const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),

  // Dashboard
  dashboard: () => request('/reports/dashboard'),

  // Coaches
  getCoaches: () => request('/coaches'),
  createCoach: (data) => request('/coaches', { method: 'POST', body: data }),
  updateCoach: (id, data) => request(`/coaches/${id}`, { method: 'PUT', body: data }),
  deleteCoach: (id) => request(`/coaches/${id}`, { method: 'DELETE' }),

  // Students
  getStudents: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students?${q}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) => request('/students', { method: 'POST', body: data }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PUT', body: data }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  excuseStudent: (id, lessonId) => request(`/students/${id}/excuse`, { method: 'POST', body: { lesson_id: lessonId } }),
  confirmPayment: (id, data) => request(`/students/${id}/pay`, { method: 'POST', body: data }),
  delayPayment: (id, days) => request(`/students/${id}/delay`, { method: 'POST', body: { days } }),

  // Groups
  getGroups: () => request('/groups'),
  getGroup: (id) => request(`/groups/${id}`),
  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  updateSchedules: (id, schedules) => request(`/groups/${id}/schedules`, { method: 'PUT', body: { schedules } }),
  markLessonDone: (id, absentIds = []) => request(`/groups/${id}/lesson-done`, { method: 'POST', body: { absentIds } }),
  suspendStudent: (groupId, studentId, lessons) => request(`/groups/${groupId}/suspend-student`, { method: 'POST', body: { student_id: studentId, lessons } }),
  unsuspendStudent: (groupId, studentId) => request(`/groups/${groupId}/unsuspend-student`, { method: 'POST', body: { student_id: studentId } }),

  // Lessons
  getLessons: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lessons?${q}`);
  },
  getLessonStats: () => request('/lessons/stats'),

  // Homeworks (global list)
  getHomeworks: () => request('/homeworks'),
  getHomeworksForGroup: (groupId) => request(`/homeworks/for-group/${groupId}`),
  uploadHomeworks: (formData) => upload('/homeworks/upload', formData),
  addHomework: (data) => request('/homeworks/add', { method: 'POST', body: data }),
  updateHomework: (id, data) => request(`/homeworks/${id}`, { method: 'PUT', body: data }),
  reorderHomeworks: (order) => request('/homeworks/reorder', { method: 'PUT', body: { order } }),
  deleteHomework: (id) => request(`/homeworks/${id}`, { method: 'DELETE' }),
  scheduleHomework: (data) => request('/homeworks/schedule-send', { method: 'POST', body: data }),

  // Payments
  getPayments: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/payments?${q}`);
  },
  getPaymentSummary: () => request('/payments/summary'),
  getPaymentReminders: () => request('/payments/reminders'),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),
  getSendLog: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/settings/send-log?${q}`);
  },

  // Registrations
  getRegistrations: (status) => request(`/registrations${status ? `?status=${status}` : ''}`),
  updateRegistration: (id, data) => request(`/registrations/${id}`, { method: 'PUT', body: data }),
  deleteRegistration: (id) => request(`/registrations/${id}`, { method: 'DELETE' }),

  // Reports
  getWeeklyReports: () => request('/reports/weekly'),

  // WhatsApp
  waStatus: () => request('/whatsapp/status'),
  waRefreshGroups: () => request('/whatsapp/refresh-groups', { method: 'POST' }),
  waSendTest: (data) => request('/whatsapp/send-test', { method: 'POST', body: data }),
};

export default api;
