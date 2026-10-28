/* Password hashing (scrypt), sessions (random token, only its SHA-256 is stored), CSRF and simple rate limiting. */
const crypto = require('node:crypto');
const { now, randomToken, sha256, HttpError } = require('./util');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_DAYS = 30;
const COOKIE = 'lexi_sid';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}
function verifyPassword(password, stored) {
  try {
    const [alg, N, r, p, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(hash, 'base64');
    const got = crypto.scryptSync(password, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(got, want);
  } catch (_) { return false; }
}
const DUMMY_HASH = hashPassword('not-a-real-password');   // compared against when the e-mail is unknown, so timing does not reveal accounts

function validateEmail(email) { return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'val.password_short';
  if (pw.length > 200) return 'val.password_long';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'val.password_mix';
  return '';
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); });
  return out;
}

function make(db, { secureCookies = false } = {}) {
  async function createSession(userId, req) {
    const token = randomToken(32), csrf = randomToken(24);
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    await db.run('INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)', sha256(token), userId, csrf, now(), expires, String(req.ip || '').slice(0, 64), String(req.get('user-agent') || '').slice(0, 200));
    return { token, csrf, expires };
  }
  /* Secure when forced by COOKIE_SECURE=1 or when the request itself arrived over HTTPS (behind a proxy this needs trust proxy) */
  const cookieFlags = (res) => `; Path=/; HttpOnly; SameSite=Lax${secureCookies || (res.req && res.req.secure) ? '; Secure' : ''}`;
  function setCookie(res, token) { res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}${cookieFlags(res)}; Max-Age=${SESSION_DAYS * 86400}`); }
  function clearCookie(res) { res.append('Set-Cookie', `${COOKIE}=${cookieFlags(res)}; Max-Age=0`); }

  // attaches req.user / req.session when the cookie holds a valid session of an active account
  async function attach(req, res, next) {
    req.user = null; req.session = null;
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) {
      const s = await db.get('SELECT * FROM sessions WHERE token_hash = ?', sha256(token));
      if (s && s.expires_at > now()) {
        const u = await db.get('SELECT * FROM users WHERE id = ?', s.user_id);
        if (u && u.status === 'active') { req.user = u; req.session = s; }
      }
    }
    next();
  }
  const destroySession = async (req) => { if (req.session) await db.run('DELETE FROM sessions WHERE token_hash = ?', req.session.token_hash); };

  /* CSRF defence for every state-changing /api request: JSON (or raw upload) content type, same-origin Origin header, and for
     signed-in users the per-session token in X-CSRF-Token. The session cookie is also SameSite=Lax. */
  function csrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) { let host = ''; try { host = new URL(origin).host; } catch (_) { /* invalid */ } if (host !== req.get('host')) return next(new HttpError(403, 'err.cross_origin')); }
    if (req.session && req.get('x-csrf-token') !== req.session.csrf_token) return next(new HttpError(403, 'err.csrf'));
    next();
  }

  const requireUser = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'err.sign_in_required')));
  const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'err.sign_in_required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'err.forbidden'));
    next();
  };

  return { createSession, setCookie, clearCookie, attach, destroySession, csrf, requireUser, requireRole };
}

/* fixed-window counter keyed by string; `limit` hits per `windowMs`. Stored in the database so the limit holds across serverless
   instances and restarts. take() resolves to false once the limit is exceeded. */
function limiter(db, name, limit, windowMs, enabled = true) {
  return {
    async take(key) {
      if (!enabled) return true;
      const k = name + ':' + key, t = Date.now();
      const row = await db.get('SELECT n, reset_at FROM rate_limits WHERE key = ?', k);
      if (!row || row.reset_at < t) { await db.run('INSERT INTO rate_limits (key, n, reset_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET n = 1, reset_at = excluded.reset_at', k, 1, t + windowMs); return true; }
      await db.run('UPDATE rate_limits SET n = n + 1 WHERE key = ?', k);
      return row.n + 1 <= limit;
    },
    async clear(key) { if (enabled) await db.run('DELETE FROM rate_limits WHERE key = ?', name + ':' + key); },
  };
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, validateEmail, passwordProblem, make, limiter, COOKIE };
