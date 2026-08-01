// Fetches blitz/rapid ratings for a player's online chess account.
//
// Both endpoints are public read-only APIs and need no key:
//   Lichess:   https://lichess.org/api/user/<name>       -> perfs.{blitz,rapid}.rating
//   Chess.com: https://api.chess.com/pub/player/<name>/stats -> chess_{blitz,rapid}.last.rating
const db = require('../db');

const TIMEOUT_MS = 10000;

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CosmoChessAcademy-CRM/1.0' },
    });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLichess(username) {
  const { notFound, data } = await getJson(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
  if (notFound || !data || data.closed) return null;
  const perfs = data.perfs || {};
  return {
    blitz: perfs.blitz && !perfs.blitz.prov ? perfs.blitz.rating : (perfs.blitz ? perfs.blitz.rating : null),
    rapid: perfs.rapid ? perfs.rapid.rating : null,
  };
}

async function fetchChessCom(username) {
  const { notFound, data } = await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/stats`);
  if (notFound || !data) return null;
  return {
    blitz: data.chess_blitz && data.chess_blitz.last ? data.chess_blitz.last.rating : null,
    rapid: data.chess_rapid && data.chess_rapid.last ? data.chess_rapid.last.rating : null,
  };
}

// Returns { blitz, rapid } or null when the account can't be found.
async function fetchRatings(platform, username) {
  if (!platform || !username) return null;
  const p = String(platform).toLowerCase();
  if (p === 'lichess') return fetchLichess(username);
  if (p === 'chesscom' || p === 'chess.com') return fetchChessCom(username);
  throw new Error(`Unknown platform: ${platform}`);
}

// Fetch and persist ratings onto a registrations/students row. Never throws —
// a failed lookup must not break registration or the CRM.
async function updateRatingsFor(table, id, platform, username) {
  if (!['registrations', 'students'].includes(table)) throw new Error('bad table');
  try {
    const r = await fetchRatings(platform, username);
    if (!r) {
      console.warn(`[Ratings] ${platform}/${username}: account not found`);
      return null;
    }
    db.prepare(
      `UPDATE ${table} SET blitz_rating = ?, rapid_rating = ?, ratings_updated_at = datetime('now') WHERE id = ?`
    ).run(r.blitz ?? null, r.rapid ?? null, id);
    console.log(`[Ratings] ${platform}/${username}: blitz=${r.blitz ?? '-'} rapid=${r.rapid ?? '-'}`);
    return r;
  } catch (e) {
    console.error(`[Ratings] ${platform}/${username} failed:`, e.message);
    return null;
  }
}

// Refresh every student that has an account linked (used by the daily cron).
async function refreshAllStudents() {
  const rows = db.prepare(
    "SELECT id, chess_platform, chess_username FROM students WHERE active = 1 AND chess_username IS NOT NULL AND chess_username != ''"
  ).all();
  for (const s of rows) {
    await updateRatingsFor('students', s.id, s.chess_platform, s.chess_username);
    // Be polite to the public APIs.
    await new Promise(r => setTimeout(r, 1500));
  }
  return rows.length;
}

module.exports = { fetchRatings, updateRatingsFor, refreshAllStudents };
