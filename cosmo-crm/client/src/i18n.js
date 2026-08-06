// CRM localisation (English / Russian) and shared date-time formatting.
// All times are rendered on a 24-hour clock regardless of browser locale.
import { useSyncExternalStore } from 'react';

const KEY = 'cosmo_crm_lang';

const EN = {
  'nav.dashboard': 'Dashboard',
  'nav.students': 'Students',
  'nav.groups': 'Groups',
  'nav.lessons': 'Lessons',
  'nav.homeworks': 'Homeworks',
  'nav.payments': 'Payments',
  'nav.registrations': 'Registrations',
  'nav.content': 'Site Content',
  'nav.whatsapp': 'WhatsApp',
  'nav.activity': 'Activity Log',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.system': 'System',
  'nav.signOut': 'Sign out',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.remove': 'Remove',
  'common.add': 'Add',
  'common.close': 'Close',
  'common.loading': 'Loading…',
  'common.language': 'Language',

  'content.subtitle': 'Gallery photos and news shown on the public site',
  'content.gallery': 'Gallery',
  'content.news': 'News',
  'content.newPhoto': 'New Photo',
  'content.newArticle': 'New Article',
  'content.editPhoto': 'Edit Photo',
  'content.editArticle': 'Edit Article',
  'content.noPhotos': 'No gallery photos yet.',
  'content.noArticles': 'No articles yet.',
  'content.untitled': 'Untitled',
  'content.image': 'Image',
  'content.title': 'Title',
  'content.category': 'Category',
  'content.caption': 'Caption',
  'content.altText': 'Alt text (for accessibility)',
  'content.date': 'Date',
  'content.status': 'Status',
  'content.excerpt': 'Excerpt',
  'content.body': 'Body',
  'content.bodyHint': 'Basic HTML is allowed, e.g. <p>…</p>',
  'content.publish': 'Publish on the site',
  'content.published': 'Published',
  'content.hidden': 'Hidden',
  'content.show': 'Show on site',
  'content.hide': 'Hide from site',
  'content.showOnSite': 'Show on the site',
  'content.chooseImage': 'Choose image',
  'content.uploading': 'Uploading…',
  'content.uploadFailed': 'Upload failed',
  'content.noImage': 'No image selected',
  'content.deleteConfirm': 'Delete',

  'students.title': 'Students',
  'students.add': 'Add Student',
  'students.edit': 'Edit Student',
  'students.name': 'Name',
  'students.surname': 'Surname',
  'students.level': 'Level',
  'students.group': 'Group',
  'students.coach': 'Coach',
  'students.payment': 'Payment',
  'students.lessons': 'Lessons',
  'students.actions': 'Actions',
  'students.onlineRatings': 'Online Ratings',
  'students.fide': 'FIDE',
  'students.blitz': 'Blitz',
  'students.rapid': 'Rapid',
  'students.games': 'games',
  'students.notes': 'Notes',
  'students.allLevels': 'All Levels',
  'students.allGroups': 'All Groups',
  'students.allPayment': 'All Payment',
  'students.count': 'students',
  'students.paid': 'Paid',
  'students.due': 'Due',
  'students.overdue': 'Overdue',
  'students.lessonsOverdue': 'lessons overdue',
  'students.late': 'late',
  'students.reasonNoted': 'reason noted',
  'students.addReason': 'Add reason',
  'students.editReason': 'Edit reason',
  'students.removeFromList': 'Remove',
  'students.attendanceCalendar': 'Attendance calendar',
  'students.refreshRatings': 'Refresh online ratings',
  'students.confirmPayment': 'Confirm Payment',
  'students.deactivate': 'Deactivate',
  'students.birthDate': 'Date of Birth',
  'students.sector': 'Sector',
  'students.platform': 'Chess Platform',
  'students.username': 'Username',
  'students.paymentRecords': 'Payment Records',
  'students.noPayments': 'No payment records yet.',
  'students.amount': 'Amount',

  'dashboard.title': 'Dashboard',
  'dashboard.lesson': 'Lesson',
  'dashboard.timetable': 'Weekly Timetable',
  'dashboard.paymentStatus': 'Payment Status',
  'dashboard.topGroups': 'Top Groups',
  'dashboard.recentActivity': 'Recent Activity',
  'dashboard.attendance': 'Attendance',
  'dashboard.done': 'Done',
  'dashboard.marked': 'Marked',
  'dashboard.present': 'Present',
  'dashboard.absentAllowed': 'Absent · allowed',
  'dashboard.notAllowed': 'Not allowed',
  'dashboard.saveAttendance': 'Save Attendance',
  'dashboard.viewAll': 'View All',
  'dashboard.noClasses': 'No classes on',

  'groups.title': 'Groups',
  'groups.new': 'New Group',
  'payments.title': 'Payments',
  'lessons.title': 'Lessons',
  'homeworks.title': 'Homeworks',
  'registrations.title': 'Registrations',
  'reports.title': 'Reports',
  'settings.title': 'Settings',
  'activity.title': 'Activity Log',
  'whatsapp.title': 'WhatsApp Connection',
};

const RU = {
  'nav.dashboard': 'Панель',
  'nav.students': 'Ученики',
  'nav.groups': 'Группы',
  'nav.lessons': 'Уроки',
  'nav.homeworks': 'Домашние задания',
  'nav.payments': 'Платежи',
  'nav.registrations': 'Заявки',
  'nav.content': 'Контент сайта',
  'nav.whatsapp': 'WhatsApp',
  'nav.activity': 'Журнал',
  'nav.reports': 'Отчёты',
  'nav.settings': 'Настройки',
  'nav.system': 'Система',
  'nav.signOut': 'Выйти',

  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.delete': 'Удалить',
  'common.edit': 'Изменить',
  'common.remove': 'Убрать',
  'common.add': 'Добавить',
  'common.close': 'Закрыть',
  'common.loading': 'Загрузка…',
  'common.language': 'Язык',

  'content.subtitle': 'Фотографии галереи и новости на публичном сайте',
  'content.gallery': 'Галерея',
  'content.news': 'Новости',
  'content.newPhoto': 'Новое фото',
  'content.newArticle': 'Новая статья',
  'content.editPhoto': 'Изменить фото',
  'content.editArticle': 'Изменить статью',
  'content.noPhotos': 'Фотографий пока нет.',
  'content.noArticles': 'Статей пока нет.',
  'content.untitled': 'Без названия',
  'content.image': 'Изображение',
  'content.title': 'Заголовок',
  'content.category': 'Категория',
  'content.caption': 'Подпись',
  'content.altText': 'Альт-текст (доступность)',
  'content.date': 'Дата',
  'content.status': 'Статус',
  'content.excerpt': 'Краткое описание',
  'content.body': 'Текст',
  'content.bodyHint': 'Допускается простой HTML, например <p>…</p>',
  'content.publish': 'Опубликовать на сайте',
  'content.published': 'Опубликовано',
  'content.hidden': 'Скрыто',
  'content.show': 'Показать на сайте',
  'content.hide': 'Скрыть с сайта',
  'content.showOnSite': 'Показывать на сайте',
  'content.chooseImage': 'Выбрать изображение',
  'content.uploading': 'Загрузка…',
  'content.uploadFailed': 'Ошибка загрузки',
  'content.noImage': 'Изображение не выбрано',
  'content.deleteConfirm': 'Удалить',

  'students.title': 'Ученики',
  'students.add': 'Добавить ученика',
  'students.edit': 'Изменить ученика',
  'students.name': 'Имя',
  'students.surname': 'Фамилия',
  'students.level': 'Уровень',
  'students.group': 'Группа',
  'students.coach': 'Тренер',
  'students.payment': 'Оплата',
  'students.lessons': 'Уроки',
  'students.actions': 'Действия',
  'students.onlineRatings': 'Онлайн-рейтинги',
  'students.fide': 'FIDE',
  'students.blitz': 'Блиц',
  'students.rapid': 'Рапид',
  'students.games': 'партий',
  'students.notes': 'Заметки',
  'students.allLevels': 'Все уровни',
  'students.allGroups': 'Все группы',
  'students.allPayment': 'Все статусы',
  'students.count': 'учеников',
  'students.paid': 'Оплачено',
  'students.due': 'К оплате',
  'students.overdue': 'Просрочено',
  'students.lessonsOverdue': 'уроков просрочено',
  'students.late': 'с задержкой',
  'students.reasonNoted': 'причина указана',
  'students.addReason': 'Указать причину',
  'students.editReason': 'Изменить причину',
  'students.removeFromList': 'Удалить',
  'students.attendanceCalendar': 'Календарь посещаемости',
  'students.refreshRatings': 'Обновить рейтинги',
  'students.confirmPayment': 'Подтвердить оплату',
  'students.deactivate': 'Деактивировать',
  'students.birthDate': 'Дата рождения',
  'students.sector': 'Сектор',
  'students.platform': 'Платформа',
  'students.username': 'Имя пользователя',
  'students.paymentRecords': 'История платежей',
  'students.noPayments': 'Платежей пока нет.',
  'students.amount': 'Сумма',

  'dashboard.title': 'Панель',
  'dashboard.lesson': 'Урок',
  'dashboard.timetable': 'Недельное расписание',
  'dashboard.paymentStatus': 'Статус оплат',
  'dashboard.topGroups': 'Лучшие группы',
  'dashboard.recentActivity': 'Последние действия',
  'dashboard.attendance': 'Посещаемость',
  'dashboard.done': 'Готово',
  'dashboard.marked': 'Отмечено',
  'dashboard.present': 'Присутствует',
  'dashboard.absentAllowed': 'Отсутствует · разрешено',
  'dashboard.notAllowed': 'Не разрешено',
  'dashboard.saveAttendance': 'Сохранить',
  'dashboard.viewAll': 'Все',
  'dashboard.noClasses': 'Нет занятий:',

  'groups.title': 'Группы',
  'groups.new': 'Новая группа',
  'payments.title': 'Платежи',
  'lessons.title': 'Уроки',
  'homeworks.title': 'Домашние задания',
  'registrations.title': 'Заявки',
  'reports.title': 'Отчёты',
  'settings.title': 'Настройки',
  'activity.title': 'Журнал',
  'whatsapp.title': 'Подключение WhatsApp',
};

const DICTS = { en: EN, ru: RU };
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

// Russian is the default for this academy; the switcher stores any override.
const DEFAULT_LANG = 'ru';
let current = (() => {
  try { return localStorage.getItem(KEY) || DEFAULT_LANG; } catch { return DEFAULT_LANG; }
})();

const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function getLang() { return current; }

export function setLang(lang) {
  if (!DICTS[lang] || lang === current) return;
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  listeners.forEach(fn => fn());
}

// Falls back to English, then to the key itself, so a missing string is still
// readable rather than blank.
export function t(key) {
  const dict = DICTS[current] || EN;
  return dict[key] ?? EN[key] ?? key;
}

// Re-renders components when the language changes.
export function useLang() {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

// ─── Date/time helpers — always 24-hour ─────────────────────────
const LOCALES = { en: 'en-GB', ru: 'ru-RU' };
const locale = () => LOCALES[current] || 'en-GB';

function toDate(value) {
  if (!value) return null;
  // SQLite datetimes ('YYYY-MM-DD HH:MM:SS') are UTC but lack a zone marker.
  const iso = typeof value === 'string' && !value.endsWith('Z') && value.includes(' ')
    ? value.replace(' ', 'T') + 'Z'
    : value;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

export function formatTime(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
