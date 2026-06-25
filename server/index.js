const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API routes
app.use('/api/coaches', require('./routes/coaches'));
app.use('/api/students', require('./routes/students'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/homeworks', require('./routes/homeworks'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Public landing page at / (must be before CRM static mount)
const publicDir = path.join(__dirname, '..', 'public');
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// CRM dashboard at /crm (React SPA — static assets then SPA fallback)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use('/crm', express.static(clientDist, { index: false }));
app.get(/^\/crm(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);

  // Initialize WhatsApp
  const wa = require('./services/whatsapp');
  wa.init();

  // Start scheduler
  const scheduler = require('./services/scheduler');
  scheduler.start();
});
