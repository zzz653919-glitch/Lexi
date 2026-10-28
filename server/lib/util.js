const crypto = require('node:crypto');

const now = () => new Date().toISOString();
const clean = (v, max = 500) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanMultiline = (v, max = 5000) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const int = (v, def = 0) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : def; };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* `message` is a translation key (e.g. "err.not_found"); the error handler translates it into the request's language.
   fields: { fieldName: key | { key, params } }.  HttpError.raw() carries an already translated text. */
class HttpError extends Error {
  constructor(status, message, fields, params) { super(message); this.status = status; this.fields = fields || null; this.params = params || null; this.translated = false; }
  static raw(status, text, fields) { const e = new HttpError(status, text, fields); e.translated = true; return e; }
}
const bad = (message, fields, params) => new HttpError(400, message, fields, params);

// deterministic PRNG so a reloaded lesson shows the same shuffled order
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(arr, seed) {
  const r = rng(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* local calendar date (YYYY-MM-DD) of an instant in an IANA time zone; falls back to UTC for an unknown zone */
function localDate(date, tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
  catch (_) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
}
const validTimezone = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (_) { return false; } };
function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// Monday of the week containing the given local date
function weekStart(dateStr) { const d = new Date(dateStr + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; return addDays(dateStr, -dow); }

function escapeLike(s) { return String(s).replace(/[\\%_]/g, (m) => '\\' + m); }

module.exports = { now, clean, cleanMultiline, int, clamp, randomToken, sha256, HttpError, bad, rng, shuffled, localDate, validTimezone, addDays, weekStart, escapeLike };
