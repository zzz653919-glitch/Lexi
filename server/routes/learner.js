const express = require('express');
const A = require('../lib/auth');
const { publicUser, validateProfile, AVATARS } = require('./auth');
const { now, clean, int, clamp, HttpError, bad, escapeLike, weekStart, addDays } = require('../lib/util');

module.exports = function learnerRoutes({ db, settings, auth, core, attempts, review }) {
  const r = express.Router();
  r.use(auth.requireUser);

  /* ---------- profile ---------- */
  r.get('/me/profile', (req, res) => res.json(profile(req.user)));
  function profile(u) {
    const user = core.userById(u.id);
    const done = db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', u.id).n;
    const course = core.courseFor(user);
    return { user: publicUser(user), stats: { lessonsCompleted: done, streak: core.streakInfo(user), hearts: core.heartState(user), achievements: db.get('SELECT COUNT(*) n FROM user_achievements WHERE user_id = ?', u.id).n }, avatars: AVATARS,
      course: course ? { id: course.id, title: course.title } : null, courses: db.all("SELECT id, title, track FROM courses WHERE status = 'published' ORDER BY position, id") };
  }
  r.patch('/me', (req, res) => {
    const b = req.body || {};
    const { errors, values } = validateProfile(b, settings, { partial: true });
    if (b.courseId !== undefined) {
      const c = db.get("SELECT id FROM courses WHERE id = ? AND status = 'published'", Number(b.courseId));
      if (!c) errors.courseId = 'Course not found.'; else values.course_id = c.id;
    }
    if (Object.keys(errors).length) throw bad('Please fix the highlighted fields.', errors);
    const keys = Object.keys(values);
    if (keys.length) db.run(`UPDATE users SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => values[k]), req.user.id);
    res.json(profile(req.user));
  });
  r.post('/me/password', (req, res) => {
    const b = req.body || {};
    if (!A.verifyPassword(String(b.currentPassword || ''), req.user.password_hash)) throw bad('Your current password is not correct.', { currentPassword: 'Not correct.' });
    const pe = A.passwordProblem(b.newPassword);
    if (pe) throw bad(pe, { newPassword: pe });
    db.tx(() => { db.run('UPDATE users SET password_hash = ? WHERE id = ?', A.hashPassword(b.newPassword), req.user.id); db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', req.user.id, req.session.token_hash); });
    res.json({ ok: true });
  });

  r.get('/me/stats', (req, res) => {
    const user = core.userById(req.user.id);
    res.json({ xpTotal: user.xp_total, streak: core.streakInfo(user), hearts: core.heartState(user), today: core.dayInfo(user), reviewDue: review.counts(user).due });
  });

  /* ---------- path, dashboard ---------- */
  r.get('/path', (req, res) => {
    const user = core.userById(req.user.id);
    const course = core.courseFor(user, Number(req.query.courseId) || null);
    if (!course) return res.json({ course: null, levels: [], recommended: null, totals: { lessons: 0, done: 0 } });
    res.json(core.buildPath(user, course));
  });
  r.get('/dashboard', (req, res) => {
    const user = core.userById(req.user.id);
    const s = settings.all();
    const course = core.courseFor(user);
    const path = course ? core.buildPath(user, course) : null;
    const rec = path && path.recommended;
    let unit = null;
    if (path && rec) { for (const lv of path.levels) for (const u of lv.units) if (u.id === rec.unitId) unit = { id: u.id, title: u.title, total: u.total, done: u.done, level: lv.code }; }
    res.json({
      user: publicUser(user), course: course ? { id: course.id, title: course.title } : null, recommended: rec || null, unit,
      lessons: path ? path.totals : { lessons: 0, done: 0 },
      level: rec ? path.levels.find((l) => l.code === rec.level) && { code: rec.level, pct: path.levels.find((l) => l.code === rec.level).pct } : null,
      today: core.dayInfo(user), streak: core.streakInfo(user), hearts: core.heartState(user), week: core.weekDays(user),
      achievements: core.achievementList(user.id).filter((a) => a.earnedAt).sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1)).slice(0, 3),
      review: review.counts(user), mistakesAvailable: mistakesAvailable(user.id),
      leaderboardEnabled: s.leaderboard_enabled,
    });
  });
  const mistakesAvailable = (userId) => attempts.mistakeIds(userId, 50).length;

  /* ---------- lessons ---------- */
  r.post('/lessons/:id/start', (req, res) => {
    try { res.json(attempts.start(req.user, int(req.params.id))); }
    catch (e) { if (e.extra) return res.status(e.status).json({ error: e.message, ...e.extra }); throw e; }
  });
  r.post('/practice/mistakes', (req, res) => res.json(attempts.startMistakes(req.user)));
  r.get('/attempts/:id', (req, res) => res.json(attempts.getAttempt(req.user, int(req.params.id))));
  r.post('/attempts/:id/answer', (req, res) => res.json(attempts.answer(req.user, int(req.params.id), req.body || {})));
  r.post('/attempts/:id/abandon', (req, res) => res.json(attempts.abandon(req.user, int(req.params.id))));

  /* ---------- vocabulary & review ---------- */
  r.get('/vocabulary', (req, res) => {
    const user = core.userById(req.user.id);
    const q = clean(req.query.q, 60), filter = ['all', 'due', 'difficult', 'new', 'learning'].includes(req.query.filter) ? req.query.filter : 'all';
    const page = Math.max(1, int(req.query.page, 1)), size = clamp(int(req.query.pageSize, 20), 5, 50);
    const course = core.courseFor(user);
    const where = ["v.status = 'published'"], args = [];
    if (course) { where.push('(v.course_id = ? OR v.course_id IS NULL)'); args.push(course.id); }
    if (q) { where.push("(v.en LIKE ? ESCAPE '\\' OR v.uz LIKE ? ESCAPE '\\')"); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    if (req.query.level) { where.push('(v.cefr = ? OR lv.code = ?)'); args.push(String(req.query.level), String(req.query.level)); }
    if (req.query.unitId) { where.push('v.unit_id = ?'); args.push(int(req.query.unitId)); }
    if (filter === 'due') { where.push('ri.vocabulary_id IS NOT NULL AND ri.due_at <= ?'); args.push(now()); }
    if (filter === 'difficult') where.push('ri.is_difficult = 1');
    if (filter === 'new') where.push('ri.vocabulary_id IS NULL');
    if (filter === 'learning') where.push('ri.vocabulary_id IS NOT NULL');
    const from = 'FROM vocabulary v LEFT JOIN levels lv ON lv.id = v.level_id LEFT JOIN units un ON un.id = v.unit_id LEFT JOIN review_items ri ON ri.vocabulary_id = v.id AND ri.user_id = ?';
    const total = db.get(`SELECT COUNT(*) n ${from} WHERE ${where.join(' AND ')}`, user.id, ...args).n;
    const rows = db.all(`SELECT v.id, v.en, v.uz, v.translations, v.pos, v.example, v.example_uz, v.audio_url, COALESCE(NULLIF(v.cefr,''), lv.code, '') level, un.title unit, ri.box, ri.due_at, ri.is_difficult, ri.correct, ri.wrong
      ${from} WHERE ${where.join(' AND ')} ORDER BY lv.position, un.position, v.id LIMIT ? OFFSET ?`, user.id, ...args, size, (page - 1) * size);
    res.json({ total, page, pageSize: size, items: rows.map((v) => ({ ...v, translations: safeJson(v.translations), status: v.box === null ? 'new' : v.due_at <= now() ? 'due' : 'learning', difficult: !!v.is_difficult, is_difficult: undefined })) });
  });
  const safeJson = (s) => { try { return JSON.parse(s); } catch (_) { return {}; } };
  r.post('/vocabulary/:id/difficult', (req, res) => res.json(review.setDifficult(req.user, int(req.params.id), !!(req.body || {}).difficult)));
  r.post('/vocabulary/add-to-review', (req, res) => {
    const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 200) : [];
    if (!ids.length) throw bad('Choose at least one word.');
    res.json(review.addToReview(req.user, ids));
  });
  r.get('/review/summary', (req, res) => res.json(review.counts(req.user)));
  r.post('/review/session', (req, res) => res.json(review.session(req.user, req.body || {})));
  r.post('/review/answer', (req, res) => res.json(review.answer(req.user, req.body || {})));

  /* ---------- achievements, leaderboard ---------- */
  r.get('/achievements', (req, res) => res.json({ items: core.achievementList(req.user.id) }));
  r.get('/leaderboard', (req, res) => {
    const s = settings.all();
    if (!s.leaderboard_enabled) return res.json({ enabled: false, items: [] });
    const since = weekStart(new Date().toISOString().slice(0, 10)) + 'T00:00:00.000Z';   // the week starts Monday 00:00 UTC for everyone
    const rows = db.all(`SELECT u.id, u.display_name, u.avatar, COALESCE(SUM(x.amount),0) xp FROM users u LEFT JOIN xp_transactions x ON x.user_id = u.id AND x.created_at >= ?
      WHERE u.status = 'active' AND u.leaderboard_opt_in = 1 GROUP BY u.id HAVING xp > 0 ORDER BY xp DESC, u.id LIMIT 20`, since);
    const me = core.userById(req.user.id);
    res.json({ enabled: true, weekStarts: since.slice(0, 10), optedIn: !!me.leaderboard_opt_in,
      items: rows.map((u, i) => ({ rank: i + 1, displayName: u.display_name, avatar: u.avatar, xp: u.xp, you: u.id === me.id })) });
  });

  return r;
};
