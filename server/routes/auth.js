const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../lib/auth');
const { now, clean, HttpError, bad, randomToken, sha256, validTimezone } = require('../lib/util');

const AVATARS = ['sprout', 'sun', 'moon', 'wave', 'leaf', 'star', 'bolt', 'cloud'];
const NAME_RE = /^[\p{L}\p{N} .'_-]{2,30}$/u;
const LV = require('../lib/levels');
const { pathLevel } = require('../lib/learning');
const LENGTHS = ['short', 'normal', 'long'];
const TRANSLATION_LANGUAGES = ['uz', 'ru'];
const LEARNING_LANGUAGES = ['en'];

const publicUser = (u) => ({
  id: u.id, email: u.email, displayName: u.display_name, role: u.role, avatar: u.avatar, timezone: u.timezone, uiLanguage: u.ui_language, translationLanguage: u.translation_language, learningLanguage: u.learning_language,
  courseId: u.course_id, startLevel: u.start_level, cefrLevel: u.cefr_level || null, levelSource: u.level_source, onboarded: !!u.onboarded, lessonLength: u.lesson_length || 'normal', dailyGoalXp: u.daily_goal_xp, xpTotal: u.xp_total, leaderboardOptIn: !!u.leaderboard_opt_in, createdAt: u.created_at,
});

function validateProfile(input, settings, { partial }) {
  const errors = {}, v = {};
  const has = (k) => input[k] !== undefined;
  if (!partial || has('displayName')) { const n = clean(input.displayName, 60); if (!NAME_RE.test(n)) errors.displayName = 'val.display_name'; else v.display_name = n; }
  if (has('avatar')) { if (!AVATARS.includes(input.avatar)) errors.avatar = 'val.avatar'; else v.avatar = input.avatar; }
  if (has('timezone')) { if (typeof input.timezone !== 'string' || !validTimezone(input.timezone)) errors.timezone = 'val.timezone'; else v.timezone = input.timezone; }
  if (has('dailyGoalXp')) { const n = Number(input.dailyGoalXp); if (!Number.isInteger(n) || n < 5 || n > 500) errors.dailyGoalXp = 'val.daily_goal'; else v.daily_goal_xp = n; }
  if (has('uiLanguage')) { if (!settings.all().supported_languages.includes(input.uiLanguage)) errors.uiLanguage = 'val.language'; else v.ui_language = input.uiLanguage; }
  // the language translations are shown in (Uzbek or Russian) and the language being learned are independent of the interface language
  if (has('translationLanguage')) { if (!TRANSLATION_LANGUAGES.includes(input.translationLanguage)) errors.translationLanguage = 'val.translation_language'; else v.translation_language = input.translationLanguage; }
  if (has('learningLanguage')) { if (!LEARNING_LANGUAGES.includes(input.learningLanguage)) errors.learningLanguage = 'val.learning_language'; else v.learning_language = input.learningLanguage; }
  if (has('startLevel')) { if (!LV.valid(input.startLevel)) errors.startLevel = 'val.start_level'; else v.start_level = input.startLevel; }
  if (has('lessonLength')) { if (!LENGTHS.includes(input.lessonLength)) errors.lessonLength = 'val.lesson_length'; else v.lesson_length = input.lessonLength; }
  if (has('leaderboardOptIn')) { if (typeof input.leaderboardOptIn !== 'boolean') errors.leaderboardOptIn = 'val.boolean'; else v.leaderboard_opt_in = input.leaderboardOptIn ? 1 : 0; }
  return { errors, values: v };
}

module.exports = function authRoutes({ db, settings, auth, core, opts }) {
  const r = express.Router();
  const loginLimit = A.limiter(db, 'login', 8, 10 * 60000, opts.rateLimit);
  const regLimit = A.limiter(db, 'signup', 20, 3600000, opts.rateLimit);
  const forgotLimit = A.limiter(db, 'forgot', 5, 3600000, opts.rateLimit);
  const outbox = path.join(opts.dataDir, 'outbox');

  const meBody = (req) => ({ user: req.user ? publicUser(req.user) : null, csrfToken: req.session ? req.session.csrf_token : null });

  r.get('/me', async (req, res) => res.json(meBody(req)));

  r.post('/register', async (req, res) => {
    const s = settings.all();
    if (!s.registration_open) throw new HttpError(403, 'err.registration_closed');
    if (!(await regLimit.take(req.ip))) throw new HttpError(429, 'err.rate_signups');
    const b = req.body || {};
    const errors = {};
    const email = clean(b.email, 254).toLowerCase();
    if (!A.validateEmail(email)) errors.email = 'val.email';
    const pwErr = A.passwordProblem(b.password);
    if (pwErr) errors.password = pwErr;
    const p = validateProfile({ displayName: b.displayName, timezone: b.timezone, startLevel: b.startLevel || 'A1', dailyGoalXp: b.dailyGoalXp === undefined ? s.default_daily_goal_xp : b.dailyGoalXp, uiLanguage: b.uiLanguage || req.lang, translationLanguage: b.translationLanguage || (b.uiLanguage === 'ru' || (!b.uiLanguage && req.lang === 'ru') ? 'ru' : s.default_translation_language), avatar: b.avatar || 'sprout' }, settings, { partial: false });
    Object.assign(errors, p.errors);
    if (Object.keys(errors).length) throw bad('err.fix_fields', errors);
    if (await db.get('SELECT 1 x FROM users WHERE email = ?', email)) throw bad('err.fix_fields', { email: 'val.email_taken' });
    const v = p.values;
    const chosenLevel = b.startLevel !== undefined && b.startLevel !== null && b.startLevel !== '';   // an explicit level skips the welcome screen
    const course = await core.courseFor({ course_id: null });
    const t = now();
    // new accounts are always plain learners; roles can only be changed by an administrator
    const id = (await db.run('INSERT INTO users (email, display_name, password_hash, role, avatar, timezone, ui_language, translation_language, course_id, start_level, daily_goal_xp, hearts, hearts_updated_at, created_at, last_active_at, cefr_level, level_source, level_changed_at, onboarded) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      email, v.display_name, A.hashPassword(b.password), 'learner', v.avatar, v.timezone || 'UTC', v.ui_language, v.translation_language, course ? course.id : null, pathLevel(v.start_level), v.daily_goal_xp, s.max_hearts, t, t, t, chosenLevel ? v.start_level : null, chosenLevel ? 'manual' : 'default', chosenLevel ? t : null, chosenLevel ? 1 : 0)).id;
    const sess = await auth.createSession(id, req);
    auth.setCookie(res, sess.token);
    req.user = await core.userById(id); req.session = { csrf_token: sess.csrf };
    res.status(201).json(meBody(req));
  });

  r.post('/login', async (req, res) => {
    const email = clean((req.body || {}).email, 254).toLowerCase(), password = (req.body || {}).password;
    const key = req.ip + '|' + email;
    if (!(await loginLimit.take(key))) throw new HttpError(429, 'err.rate_login');
    const u = A.validateEmail(email) ? await db.get('SELECT * FROM users WHERE email = ?', email) : null;
    const ok = A.verifyPassword(typeof password === 'string' ? password : '', u ? u.password_hash : A.DUMMY_HASH);
    if (!u || !ok) throw new HttpError(401, 'err.login_failed');
    if (u.status !== 'active') throw new HttpError(403, 'err.account_suspended');
    await loginLimit.clear(key);
    if (req.session) await auth.destroySession(req);
    const sess = await auth.createSession(u.id, req);
    auth.setCookie(res, sess.token);
    await db.run('UPDATE users SET last_active_at = ? WHERE id = ?', now(), u.id);
    req.user = u; req.session = { csrf_token: sess.csrf };
    res.json(meBody(req));
  });

  r.post('/logout', async (req, res) => { await auth.destroySession(req); auth.clearCookie(res); res.json({ ok: true }); });

  // Password recovery. No e-mail server is configured by default: the reset link is written to data/outbox/ and the server log.
  r.post('/forgot', async (req, res) => {
    if (!(await forgotLimit.take(req.ip))) throw new HttpError(429, 'err.rate_requests');
    const email = clean((req.body || {}).email, 254).toLowerCase();
    const u = A.validateEmail(email) ? await db.get("SELECT * FROM users WHERE email = ? AND status = 'active'", email) : null;
    if (u) {
      const token = randomToken(32);
      await db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), u.id, new Date(Date.now() + 3600000).toISOString());
      const link = `${opts.publicUrl || (req.protocol + '://' + req.get('host'))}/reset?token=${token}`;
      if (opts.mailer) opts.mailer({ to: u.email, link });
      else { try { fs.mkdirSync(outbox, { recursive: true }); fs.appendFileSync(path.join(outbox, 'password-resets.log'), `${now()}  ${u.email}  ${link}\n`, { mode: 0o600 }); } catch (_) { /* ignore */ } if (!opts.quiet) console.log(`[password reset] ${u.email}: ${link}`); }
    }
    res.json({ ok: true, message: req.t('msg.reset_prepared') });
  });

  r.post('/reset', async (req, res) => {
    const b = req.body || {};
    const pwErr = A.passwordProblem(b.password);
    if (pwErr) throw bad(pwErr, { password: pwErr });
    const row = await db.get('SELECT * FROM password_resets WHERE token_hash = ?', sha256(String(b.token || '')));
    if (!row || row.used_at || row.expires_at < now()) throw bad('err.reset_invalid');
    await db.tx(async () => {
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', A.hashPassword(b.password), row.user_id);
      await db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', now(), row.token_hash);
      await db.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);   // sign out everywhere
    });
    res.json({ ok: true });
  });

  return r;
};
module.exports.publicUser = publicUser;
module.exports.validateProfile = validateProfile;
module.exports.AVATARS = AVATARS;
