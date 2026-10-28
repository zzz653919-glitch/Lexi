const express = require('express');
const A = require('../lib/auth');
const { publicUser, validateProfile, AVATARS } = require('./auth');
const L10N = require('../lib/localize');
const { now, clean, int, clamp, HttpError, bad, escapeLike, weekStart, addDays } = require('../lib/util');

module.exports = function learnerRoutes({ db, settings, auth, core, attempts, review, i18n }) {
  const r = express.Router();
  r.use(auth.requireUser);

  /* ---------- profile ---------- */
  r.get('/me/profile', async (req, res) => res.json(await profile(req.user, req.lang)));
  async function profile(u, lang) {
    const user = await core.userById(u.id);
    const done = (await db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', u.id)).n;
    const course = await core.courseFor(user);
    return { user: publicUser(user), stats: { lessonsCompleted: done, streak: await core.streakInfo(user), hearts: core.heartState(user), achievements: (await db.get('SELECT COUNT(*) n FROM user_achievements WHERE user_id = ?', u.id)).n }, avatars: AVATARS,
      course: course ? { id: course.id, title: L10N.text(course, 'title', lang) } : null, courses: (await db.all("SELECT id, title, track, translations FROM courses WHERE status = 'published' ORDER BY position, id")).map((c) => ({ id: c.id, title: L10N.text(c, 'title', lang), track: c.track })) };
  }
  r.patch('/me', async (req, res) => {
    const b = req.body || {};
    const { errors, values } = validateProfile(b, settings, { partial: true });
    if (b.courseId !== undefined) {
      const c = await db.get("SELECT id FROM courses WHERE id = ? AND status = 'published'", Number(b.courseId));
      if (!c) errors.courseId = 'err.course_not_found'; else values.course_id = c.id;
    }
    if (Object.keys(errors).length) throw bad('err.fix_fields', errors);
    const keys = Object.keys(values);
    if (keys.length) await db.run(`UPDATE users SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => values[k]), req.user.id);
    res.json(await profile(req.user, req.lang));
  });
  r.post('/me/password', async (req, res) => {
    const b = req.body || {};
    if (!A.verifyPassword(String(b.currentPassword || ''), req.user.password_hash)) throw bad('err.current_password', { currentPassword: 'val.not_correct' });
    const pe = A.passwordProblem(b.newPassword);
    if (pe) throw bad(pe, { newPassword: pe });
    await db.tx(async () => { await db.run('UPDATE users SET password_hash = ? WHERE id = ?', A.hashPassword(b.newPassword), req.user.id); await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', req.user.id, req.session.token_hash); });
    res.json({ ok: true });
  });

  r.get('/me/stats', async (req, res) => {
    const user = await core.userById(req.user.id);
    res.json({ xpTotal: user.xp_total, streak: await core.streakInfo(user), hearts: core.heartState(user), today: await core.dayInfo(user), reviewDue: (await review.counts(user)).due });
  });

  /* ---------- path, dashboard ---------- */
  r.get('/path', async (req, res) => {
    const user = await core.userById(req.user.id);
    const course = await core.courseFor(user, Number(req.query.courseId) || null);
    if (!course) return res.json({ course: null, levels: [], recommended: null, totals: { lessons: 0, done: 0 } });
    res.json(await core.buildPath(user, course, req.lang));
  });
  r.get('/dashboard', async (req, res) => {
    const user = await core.userById(req.user.id);
    const s = settings.all();
    const course = await core.courseFor(user);
    const path = course ? await core.buildPath(user, course, req.lang) : null;
    const rec = path && path.recommended;
    let unit = null;
    if (path && rec) { for (const lv of path.levels) for (const u of lv.units) if (u.id === rec.unitId) unit = { id: u.id, title: u.title, total: u.total, done: u.done, level: lv.code }; }
    res.json({
      user: publicUser(user), course: course ? { id: course.id, title: L10N.text(course, 'title', req.lang) } : null, recommended: rec || null, unit,
      lessons: path ? path.totals : { lessons: 0, done: 0 },
      level: rec ? path.levels.find((l) => l.code === rec.level) && { code: rec.level, pct: path.levels.find((l) => l.code === rec.level).pct } : null,
      today: await core.dayInfo(user), streak: await core.streakInfo(user), hearts: core.heartState(user), week: await core.weekDays(user),
      achievements: (await core.achievementList(user.id)).filter((a) => a.earnedAt).sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1)).slice(0, 3),
      review: await review.counts(user), mistakesAvailable: await mistakesAvailable(user.id),
      leaderboardEnabled: s.leaderboard_enabled,
    });
  });
  const mistakesAvailable = async (userId) => (await attempts.mistakeIds(userId, 50)).length;

  /* ---------- lessons ---------- */
  r.post('/lessons/:id/start', async (req, res) => {
    try { res.json(await attempts.start(req.user, int(req.params.id), req.lang)); }
    catch (e) { if (e.extra) return res.status(e.status).json({ error: req.t(e.message, e.params), code: e.message, ...e.extra }); throw e; }
  });
  r.post('/practice/mistakes', async (req, res) => res.json(await attempts.startMistakes(req.user, req.lang)));
  r.get('/attempts/:id', async (req, res) => res.json(await attempts.getAttempt(req.user, int(req.params.id), req.lang)));
  r.post('/attempts/:id/answer', async (req, res) => res.json(await attempts.answer(req.user, int(req.params.id), req.body || {}, req.lang)));
  r.post('/attempts/:id/abandon', async (req, res) => res.json(await attempts.abandon(req.user, int(req.params.id))));

  /* ---------- vocabulary & review ---------- */
  r.get('/vocabulary', async (req, res) => {
    const user = await core.userById(req.user.id);
    const q = clean(req.query.q, 60), filter = ['all', 'due', 'difficult', 'new', 'learning'].includes(req.query.filter) ? req.query.filter : 'all';
    const page = Math.max(1, int(req.query.page, 1)), size = clamp(int(req.query.pageSize, 20), 5, 50);
    const course = await core.courseFor(user);
    const where = ["v.status = 'published'"], args = [];
    if (course) { where.push('(v.course_id = ? OR v.course_id IS NULL)'); args.push(course.id); }
    const tl = user.translation_language;
    if (q) { where.push(`(v.en LIKE ? ESCAPE '\\' OR ${L10N.vocabWordSql(tl)} LIKE ? ESCAPE '\\')`); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    if (req.query.level) { where.push('(v.cefr = ? OR lv.code = ?)'); args.push(String(req.query.level), String(req.query.level)); }
    if (req.query.unitId) { where.push('v.unit_id = ?'); args.push(int(req.query.unitId)); }
    if (filter === 'due') { where.push('ri.vocabulary_id IS NOT NULL AND ri.due_at <= ?'); args.push(now()); }
    if (filter === 'difficult') where.push('ri.is_difficult = 1');
    if (filter === 'new') where.push('ri.vocabulary_id IS NULL');
    if (filter === 'learning') where.push('ri.vocabulary_id IS NOT NULL');
    const from = 'FROM vocabulary v LEFT JOIN levels lv ON lv.id = v.level_id LEFT JOIN units un ON un.id = v.unit_id LEFT JOIN review_items ri ON ri.vocabulary_id = v.id AND ri.user_id = ?';
    const total = (await db.get(`SELECT COUNT(*) n ${from} WHERE ${where.join(' AND ')}`, user.id, ...args)).n;
    const rows = await db.all(`SELECT v.id, v.en, v.uz, v.translations, v.pos, v.example, v.example_uz, v.audio_url, COALESCE(NULLIF(v.cefr,''), lv.code, '') level, un.title unit, ri.box, ri.due_at, ri.is_difficult, ri.correct, ri.wrong
      ${from} WHERE ${where.join(' AND ')} ORDER BY lv.position, un.position, v.id LIMIT ? OFFSET ?`, user.id, ...args, size, (page - 1) * size);
    res.json({ total, page, pageSize: size, items: rows.map((v) => { const t = L10N.vocab(v, tl); return { id: v.id, en: v.en, translation: t.word, translationLanguage: t.language, pos: v.pos, example: v.example, example_translation: t.example, audio_url: v.audio_url, level: v.level, unit: v.unit, box: v.box, due_at: v.due_at, correct: v.correct, wrong: v.wrong, status: v.box === null ? 'new' : v.due_at <= now() ? 'due' : 'learning', difficult: !!v.is_difficult }; }) });
  });
  const safeJson = (s) => { try { return JSON.parse(s); } catch (_) { return {}; } };
  r.post('/vocabulary/:id/difficult', async (req, res) => res.json(await review.setDifficult(req.user, int(req.params.id), !!(req.body || {}).difficult)));
  r.post('/vocabulary/add-to-review', async (req, res) => {
    const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 200) : [];
    if (!ids.length) throw bad('err.choose_words');
    res.json(await review.addToReview(req.user, ids));
  });
  r.get('/review/summary', async (req, res) => res.json(await review.counts(req.user)));
  r.post('/review/session', async (req, res) => res.json(await review.session(req.user, req.body || {})));
  r.post('/review/answer', async (req, res) => res.json(await review.answer(req.user, req.body || {})));

  /* ---------- achievements, leaderboard ---------- */
  r.get('/achievements', async (req, res) => res.json({ items: await core.achievementList(req.user.id) }));
  r.get('/leaderboard', async (req, res) => {
    const s = settings.all();
    if (!s.leaderboard_enabled) return res.json({ enabled: false, items: [] });
    const since = weekStart(new Date().toISOString().slice(0, 10)) + 'T00:00:00.000Z';   // the week starts Monday 00:00 UTC for everyone
    const rows = await db.all(`SELECT u.id, u.display_name, u.avatar, COALESCE(SUM(x.amount),0) xp FROM users u LEFT JOIN xp_transactions x ON x.user_id = u.id AND x.created_at >= ?
      WHERE u.status = 'active' AND u.leaderboard_opt_in = 1 GROUP BY u.id HAVING xp > 0 ORDER BY xp DESC, u.id LIMIT 20`, since);
    const me = await core.userById(req.user.id);
    res.json({ enabled: true, weekStarts: since.slice(0, 10), optedIn: !!me.leaderboard_opt_in,
      items: rows.map((u, i) => ({ rank: i + 1, displayName: u.display_name, avatar: u.avatar, xp: u.xp, you: u.id === me.id })) });
  });

  return r;
};
