// Fetches blitz/rapid ratings for a player's online chess account.
//
// Both endpoints are public read-only APIs and need no key:
//   Lichess:   https://lichess.org/api/user/<name>       -> perfs.{blitz,rapid}.rating
//   Chess.com: https://api.chess.com/pub/player/<name>/stats -> chess_{blitz,rapid}.last.rating
const db = require('../db');

const TIMEOUT_MS = 10000;

// Chess.com's edge sometimes answers every path with an HTML 404 when it is
// throttling or blocking the caller. Treating that as "account not found" would
// wrongly tell a user their username is wrong, so only a JSON 404 counts as
// not-found; anything non-JSON is reported as an upstream failure.
async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'CosmoChessAcademy/1.0 (+https://cosmo.talentigo.net)',
        'Accept': 'application/json',
      },
    });
    const type = res.headers.get('content-type') || '';
    const isJson = type.includes('json');
    if (res.status === 404) {
      if (isJson) return { notFound: true };
      throw new Error('upstream refused the request (404 without JSON) — likely rate-limited');
    }
    if (res.status === 429) throw new Error('rate limited by the provider');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!isJson) throw new Error('unexpected non-JSON response');
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
    username: data.username || username,
    blitz: perfs.blitz ? perfs.blitz.rating : null,
    rapid: perfs.rapid ? perfs.rapid.rating : null,
    blitzGames: perfs.blitz ? perfs.blitz.games : null,
    rapidGames: perfs.rapid ? perfs.rapid.games : null,
  };
}

// Chess.com reports wins/losses/draws rather than a total, so sum them.
function ccGames(section) {
  if (!section || !section.record) return null;
  const r = section.record;
  const total = (r.win || 0) + (r.loss || 0) + (r.draw || 0);
  return total || null;
}

async function fetchChessCom(username) {
  const name = encodeURIComponent(username.toLowerCase());
  const { notFound, data } = await getJson(`https://api.chess.com/pub/player/${name}/stats`);
  if (notFound || !data) return null;
  return {
    username,
    blitz: data.chess_blitz && data.chess_blitz.last ? data.chess_blitz.last.rating : null,
    rapid: data.chess_rapid && data.chess_rapid.last ? data.chess_rapid.last.rating : null,
    blitzGames: ccGames(data.chess_blitz),
    rapidGames: ccGames(data.chess_rapid),
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
      `UPDATE ${table} SET blitz_rating = ?, rapid_rating = ?, blitz_games = ?, rapid_games = ?, ratings_updated_at = datetime('now') WHERE id = ?`
    ).run(r.blitz ?? null, r.rapid ?? null, r.blitzGames ?? null, r.rapidGames ?? null, id);
    console.log(`[Ratings] ${platform}/${username}: blitz=${r.blitz ?? '-'} (${r.blitzGames ?? 0}g) rapid=${r.rapid ?? '-'} (${r.rapidGames ?? 0}g)`);
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
