const crypto = require('crypto');
const { Router } = require('express');
const db = require('../server/db');
const { getSetting, setSetting } = db;

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- Password hashing (scrypt$salt$hash) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Token secret (generated once, stored in settings) ---
function getSecret() {
  let secret = getSetting('auth_token_secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    setSetting('auth_token_secret', secret);
  }
  return secret;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(username) {
  const payload = base64url(JSON.stringify({ u: username, iat: Date.now() }));
  const sig = base64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const [payload, sig] = token.split('.');
  const expected = base64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (Date.now() - data.iat > TOKEN_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

// --- Middleware: protect /api except public endpoints ---
function isPublic(req) {
  // Public landing-page registration form submits here.
  if (req.method === 'POST' && req.path === '/registrations') return true;
  if (req.method === 'OPTIONS') return true;
  return false;
}

function requireAuth(req, res, next) {
  if (isPublic(req)) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Unauthorized' });
  req.user = data;
  next();
}

// --- Auth routes ---
const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = getSetting('auth_username') || 'admin';
  const storedHash = getSetting('auth_password_hash');
  if (
    typeof username === 'string' &&
    username === expectedUser &&
    verifyPassword(password || '', storedHash)
  ) {
    return res.json({ token: signToken(username), username });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ username: data.u });
});

module.exports = { router, requireAuth, hashPassword, verifyPassword, signToken, verifyToken };
