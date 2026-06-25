# Cosmo CRM — Self-Hosted Tutor Automation

A self-hosted CRM and WhatsApp automation system for private chess tutoring. Manages students, groups, lessons, homework delivery, payment tracking, and automated reminders — all through WhatsApp.

## Stack Choices & Why

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | **Node.js** | Same runtime as whatsapp-web.js — single process, no polyglot overhead |
| Server | **Express** | Minimal, battle-tested, easy to maintain for one person |
| Database | **SQLite (better-sqlite3)** | Zero setup, single file, WAL mode for concurrent reads, perfect for ~2GB VPS |
| Scheduler | **node-cron** | Lightweight, runs in-process, no external daemon needed |
| WhatsApp | **whatsapp-web.js + LocalAuth** | Links via QR code, persists session to disk, no Meta Business API needed |
| Frontend | **React + Vite** | Fast builds, good DX, served as static files by Express in production |

## Features

- **Student CRM** — CRUD with filters by level, group, payment status
- **Group management** — Weekly schedules, WA group linking, auto/manual lesson tracking
- **Homework playlist** — Upload all PDFs once; auto-sent sequentially as lessons complete
- **Payment tracking** — Auto-reminders after every N lessons, escalation, excused absence rule
- **Lesson reminders** — Sent automatically before each scheduled lesson
- **Weekly reports** — Auto-generated summary sent to teacher via WhatsApp
- **Activity log** — Every send (success/failure) logged and viewable in dashboard
- **WhatsApp panel** — QR display, connection status, group cache, test messaging

## Local Development

```bash
# Install
npm install
cd client && npm install && cd ..

# Seed sample data
node server/seed.js

# Run (server + client dev server)
npm run dev
```

- CRM dashboard: http://localhost:5173
- API: http://localhost:3001/api

## Production Deployment (Linux VPS)

### 1. System packages (for headless Chromium)

```bash
sudo apt-get update
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 \
  libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 \
  lsb-release xdg-utils wget libgbm-dev
```

### 2. Install & build

```bash
git clone <repo> cosmo-crm && cd cosmo-crm
npm install
cd client && npm install && npx vite build && cd ..
cp .env.example .env   # edit with your settings
node server/seed.js     # optional: seed sample data
```

### 3. Keep alive with PM2

```bash
npm install -g pm2
pm2 start server/index.js --name cosmo-crm
pm2 startup   # auto-start on reboot
pm2 save
```

### 4. First run — scan QR

Open `http://your-server-ip:3001` in a browser. Go to the WhatsApp page and scan the QR code with your phone. The session persists to `.wwebjs_auth/` — you only scan once.

## WhatsApp Operational Risk

**whatsapp-web.js is unofficial.** It automates a real WhatsApp account by running a headless browser that mimics WhatsApp Web. Meta does not endorse this and accounts could theoretically be flagged or banned.

### Defensive measures implemented:
- **Session persistence** (LocalAuth) — QR scanned once, session reused across restarts
- **Random delays** (2–7 seconds) between sends — mimics human behavior
- **No bulk blasts** — messages are spaced out, sent one at a time
- **No cold outreach** — only messages existing groups and saved contacts
- **No auto-replies** — never responds to unknown numbers
- **Headless Chromium flags** — `--no-sandbox`, `--disable-dev-shm-usage`, etc.
- **Idempotent sends** — every scheduled send has a unique key; restarts never double-send
- **Group cache** — avoids repeated `getChats()` calls which are slow and suspicious

### Risk mitigation tips:
- Don't send more than ~50 messages per day
- Avoid sending identical messages to many recipients
- Keep the account active with normal human usage too
- If the account gets a temp ban, stop automation for 24–48 hours

## Data Model

```
coaches → groups → students
                 → group_schedules (recurring weekly times)
                 → homeworks (ordered playlist of PDFs)
                 → lessons (timestamped log per student)
students → payments (confirmation history)
         → payment_reminders (escalation tracking)
scheduled_sends (idempotent queue for all timed sends)
send_log (audit trail of every message sent)
settings (key-value config store)
weekly_reports (auto-generated summaries)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |
| TIMEZONE | Asia/Baku | Timezone for scheduling |
| TEACHER_WHATSAPP | — | Teacher's WA number (for weekly reports) |
| PAYMENT_CYCLE_LESSONS | 8 | Lessons before payment reminder |
| PAYMENT_REMINDER_DAYS | 3,7 | Days between escalation reminders |
| DEFAULT_REMINDER_MINUTES | 60 | Default minutes before lesson reminder |
