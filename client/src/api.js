const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    body: opts.body ? (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function upload(path, formData) {
  return fetch(`${BASE}${path}`, { method: 'POST', body: formData }).then(r => r.json());
}

const api = {
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

  // Groups
  getGroups: () => request('/groups'),
  getGroup: (id) => request(`/groups/${id}`),
  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  updateSchedules: (id, schedules) => request(`/groups/${id}/schedules`, { method: 'PUT', body: { schedules } }),
  markLessonDone: (id) => request(`/groups/${id}/lesson-done`, { method: 'POST' }),

  // Lessons
  getLessons: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lessons?${q}`);
  },
  getLessonStats: () => request('/lessons/stats'),

  // Homeworks
  getHomeworks: (groupId) => request(`/homeworks/group/${groupId}`),
  uploadHomeworks: (groupId, formData) => upload(`/homeworks/group/${groupId}/upload`, formData),
  reorderHomeworks: (groupId, order) => request(`/homeworks/group/${groupId}/reorder`, { method: 'PUT', body: { order } }),
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

  // Reports
  getWeeklyReports: () => request('/reports/weekly'),

  // WhatsApp
  waStatus: () => request('/whatsapp/status'),
  waRefreshGroups: () => request('/whatsapp/refresh-groups', { method: 'POST' }),
  waSendTest: (data) => request('/whatsapp/send-test', { method: 'POST', body: data }),
};

export default api;
