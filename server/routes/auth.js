const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../lib/auth');
const { now, clean, HttpError, bad, randomToken, sha256, validTimezone } = require('../lib/util');

const AVATARS = ['sprout', 'sun', 'moon', 'wave', 'leaf', 'star', 'bolt', 'cloud'];
const NAME_RE = /^[\p{L}\p{N} .'_-]{2,30}$/u;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const publicUser = (u) => ({
  id: u.id, email: u.email, displayName: u.display_name, role: u.role, avatar: u.avatar, timezone: u.timezone, uiLanguage: u.ui_language,
  courseId: u.course_id, startLevel: u.start_level, dailyGoalXp: u.daily_goal_xp, xpTotal: u.xp_total, leaderboardOptIn: !!u.leaderboard_opt_in, createdAt: u.created_at,
});

function validateProfile(input, settings, { partial }) {
  const errors = {}, v = {};
  const has = (k) => input[k] !== undefined;
  if (!partial || has('displayName')) { const n = clean(input.displayName, 60); if (!NAME_RE.test(n)) errors.displayName = 'Use 2-30 letters, digits, spaces or . _ - \''; else v.display_name = n; }
  if (has('avatar')) { if (!AVATARS.includes(input.avatar)) errors.avatar = 'Choose one of the avatars.'; else v.avatar = input.avatar; }
  if (has('timezone')) { if (typeof input.timezone !== 'string' || !validTimezone(input.timezone)) errors.timezone = 'Unknown time zone.'; else v.timezone = input.timezone; }
  if (has('dailyGoalXp')) { const n = Number(input.dailyGoalXp); if (!Number.isInteger(n) || n < 5 || n > 500) errors.dailyGoalXp = 'Choose a goal from 5 to 500 XP.'; else v.daily_goal_xp = n; }
  if (has('uiLanguage')) { if (!settings.all().supported_languages.includes(input.uiLanguage)) errors.uiLanguage = 'Unsupported language.'; else v.ui_language = input.uiLanguage; }
  if (has('startLevel')) { if (!LEVELS.includes(input.startLevel)) errors.startLevel = 'Choose A1, A2, B1, B2 or C1.'; else v.start_level = input.startLevel; }
  if (has('leaderboardOptIn')) { if (typeof input.leaderboardOptIn !== 'boolean') errors.leaderboardOptIn = 'Must be true or false.'; else v.leaderboard_opt_in = input.leaderboardOptIn ? 1 : 0; }
  return { errors, values: v };
}

module.exports = function authRoutes({ db, settings, auth, core, opts }) {
  const r = express.Router();
  const loginLimit = A.limiter(8, 10 * 60000, opts.rateLimit);
  const regLimit = A.limiter(20, 3600000, opts.rateLimit);
  const forgotLimit = A.limiter(5, 3600000, opts.rateLimit);
  const outbox = path.join(opts.dataDir, 'outbox');

  const meBody = (req) => ({ user: req.user ? publicUser(req.user) : null, csrfToken: req.session ? req.session.csrf_token : null });

  r.get('/me', (req, res) => res.json(meBody(req)));

  r.post('/register', (req, res) => {
    const s = settings.all();
    if (!s.registration_open) throw new HttpError(403, 'Registration is closed right now.');
    if (!regLimit.take(req.ip)) throw new HttpError(429, 'Too many sign-ups from this address. Try again later.');
    const b = req.body || {};
    const errors = {};
    const email = clean(b.email, 254).toLowerCase();
    if (!A.validateEmail(email)) errors.email = 'Enter a valid e-mail address.';
    const pwErr = A.passwordProblem(b.password);
    if (pwErr) errors.password = pwErr;
    const p = validateProfile({ displayName: b.displayName, timezone: b.timezone, startLevel: b.startLevel || 'A1', dailyGoalXp: b.dailyGoalXp === undefined ? s.default_daily_goal_xp : b.dailyGoalXp, uiLanguage: b.uiLanguage || s.default_translation_language, avatar: b.avatar || 'sprout' }, settings, { partial: false });
    Object.assign(errors, p.errors);
    if (Object.keys(errors).length) throw bad('Please fix the highlighted fields.', errors);
    if (db.get('SELECT 1 x FROM users WHERE email = ?', email)) throw bad('Please fix the highlighted fields.', { email: 'An account with this e-mail already exists.' });
    const v = p.values;
    const course = core.courseFor({ course_id: null });
    const t = now();
    // new accounts are always plain learners; roles can only be changed by an administrator
    const id = db.run('INSERT INTO users (email, display_name, password_hash, role, avatar, timezone, ui_language, course_id, start_level, daily_goal_xp, hearts, hearts_updated_at, created_at, last_active_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      email, v.display_name, A.hashPassword(b.password), 'learner', v.avatar, v.timezone || 'UTC', v.ui_language, course ? course.id : null, v.start_level, v.daily_goal_xp, s.max_hearts, t, t, t).id;
    const sess = auth.createSession(id, req);
    auth.setCookie(res, sess.token);
    req.user = core.userById(id); req.session = { csrf_token: sess.csrf };
    res.status(201).json(meBody(req));
  });

  r.post('/login', (req, res) => {
    const email = clean((req.body || {}).email, 254).toLowerCase(), password = (req.body || {}).password;
    const key = req.ip + '|' + email;
    if (!loginLimit.take(key)) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
    const u = A.validateEmail(email) ? db.get('SELECT * FROM users WHERE email = ?', email) : null;
    const ok = A.verifyPassword(typeof password === 'string' ? password : '', u ? u.password_hash : A.DUMMY_HASH);
    if (!u || !ok) throw new HttpError(401, 'E-mail or password is not correct.');
    if (u.status !== 'active') throw new HttpError(403, 'This account has been suspended. Contact the administrator.');
    loginLimit.clear(key);
    if (req.session) auth.destroySession(req);
    const sess = auth.createSession(u.id, req);
    auth.setCookie(res, sess.token);
    db.run('UPDATE users SET last_active_at = ? WHERE id = ?', now(), u.id);
    req.user = u; req.session = { csrf_token: sess.csrf };
    res.json(meBody(req));
  });

  r.post('/logout', (req, res) => { auth.destroySession(req); auth.clearCookie(res); res.json({ ok: true }); });

  // Password recovery. No e-mail server is configured by default: the reset link is written to data/outbox/ and the server log.
  r.post('/forgot', (req, res) => {
    if (!forgotLimit.take(req.ip)) throw new HttpError(429, 'Too many requests. Try again later.');
    const email = clean((req.body || {}).email, 254).toLowerCase();
    const u = A.validateEmail(email) ? db.get("SELECT * FROM users WHERE email = ? AND status = 'active'", email) : null;
    if (u) {
      const token = randomToken(32);
      db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), u.id, new Date(Date.now() + 3600000).toISOString());
      const link = `${opts.publicUrl || (req.protocol + '://' + req.get('host'))}/reset?token=${token}`;
      if (opts.mailer) opts.mailer({ to: u.email, link });
      else { try { fs.mkdirSync(outbox, { recursive: true }); fs.appendFileSync(path.join(outbox, 'password-resets.log'), `${now()}  ${u.email}  ${link}\n`, { mode: 0o600 }); } catch (_) { /* ignore */ } if (!opts.quiet) console.log(`[password reset] ${u.email}: ${link}`); }
    }
    res.json({ ok: true, message: 'If that address has an account, a reset link has been prepared.' });
  });

  r.post('/reset', (req, res) => {
    const b = req.body || {};
    const pwErr = A.passwordProblem(b.password);
    if (pwErr) throw bad(pwErr, { password: pwErr });
    const row = db.get('SELECT * FROM password_resets WHERE token_hash = ?', sha256(String(b.token || '')));
    if (!row || row.used_at || row.expires_at < now()) throw bad('This reset link is invalid or has expired.');
    db.tx(() => {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', A.hashPassword(b.password), row.user_id);
      db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', now(), row.token_hash);
      db.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);   // sign out everywhere
    });
    res.json({ ok: true });
  });

  return r;
};
module.exports.publicUser = publicUser;
module.exports.validateProfile = validateProfile;
module.exports.AVATARS = AVATARS;
