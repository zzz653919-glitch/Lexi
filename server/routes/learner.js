const express = require('express');
const A = require('../lib/auth');
const { publicUser, validateProfile, AVATARS } = require('./auth');
const L10N = require('../lib/localize');
const IELTS = require('../lib/ielts');
const { now, clean, int, clamp, HttpError, bad, escapeLike, weekStart, addDays } = require('../lib/util');

module.exports = function learnerRoutes({ db, settings, auth, core, attempts, review, i18n, learning, daily: dailySummary, roadmap, tokens, avatar }) {
  const r = express.Router();
  r.use(auth.requireUser);

  /* ---------- profile ---------- */
  r.get('/me/profile', async (req, res) => res.json(await profile(req.user, req.lang)));
  async function profile(u, lang) {
    // the reads run together: one network trip each on a hosted database
    const [user, done, ach, courses] = await Promise.all([core.userById(u.id), db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', u.id), db.get('SELECT COUNT(*) n FROM user_achievements WHERE user_id = ?', u.id),
      db.all("SELECT id, title, track, translations FROM courses WHERE status = 'published' ORDER BY position, id")]);
    const [course, streak] = await Promise.all([core.courseFor(user), core.streakInfo(user)]);
    return { user: publicUser(user), stats: { lessonsCompleted: done.n, streak, hearts: core.heartState(user), achievements: ach.n }, avatars: AVATARS,
      course: course ? { id: course.id, title: L10N.text(course, 'title', lang) } : null, courses: courses.map((c) => ({ id: c.id, title: L10N.text(c, 'title', lang), track: c.track })) };
  }
  r.patch('/me', async (req, res) => {
    const b = req.body || {};
    const { errors, values } = validateProfile(b, settings, { partial: true });
    if (b.courseId !== undefined) {
      const c = await db.get("SELECT id FROM courses WHERE id = ? AND status = 'published'", Number(b.courseId));
      if (!c) errors.courseId = 'err.course_not_found'; else values.course_id = c.id;
    }
    if (Object.keys(errors).length) throw bad('err.fix_fields', errors);
    if (values.start_level !== undefined) { await learning.setLevel(req.user.id, b.startLevel, 'manual', { note: 'chosen in the profile' }); delete values.start_level; }
    const keys = Object.keys(values);
    if (keys.length) await db.run(`UPDATE users SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => values[k]), req.user.id);
    res.json(await profile(req.user, req.lang));
  });
  r.post('/me/password', async (req, res) => {
    const b = req.body || {};
    if (!(req.session && req.session.recovery) && !A.verifyPassword(String(b.currentPassword || ''), req.user.password_hash)) throw bad('err.current_password', { currentPassword: 'val.not_correct' });
    const pe = A.passwordProblem(b.newPassword);
    if (pe) throw bad(pe, { newPassword: pe });
    await db.tx(async () => { await db.run('UPDATE users SET password_hash = ? WHERE id = ?', A.hashPassword(b.newPassword), req.user.id); await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', req.user.id, req.session.token_hash); });
    res.json({ ok: true });
  });

  r.get('/me/stats', async (req, res) => {
    const user = req.user;   // the chips of every page: the reads run together
    await avatar.maybeSync(user).catch(() => {});   // missions finished by reviewing words etc. are paid here (at most once a minute per account)
    const [streak, today, rc, wal, fresh] = await Promise.all([core.streakInfo(user), core.dayInfo(user), review.counts(user), tokens.wallet(user.id), tokens.unseen(user.id)]);
    res.json({ xpTotal: user.xp_total, streak, hearts: core.heartState(user), today, reviewDue: rc.due, tokens: { balance: wal.balance, earned: wal.earned, unseen: fresh } });
  });

  /* ---------- path, dashboard ---------- */
  r.get('/path', async (req, res) => {
    const user = await core.userById(req.user.id);
    const course = await core.courseFor(user, Number(req.query.courseId) || null);
    if (!course) return res.json({ course: null, levels: [], recommended: null, totals: { lessons: 0, done: 0 } });
    const want = String(req.query.level || '');
    res.json(await core.buildPath(user, course, req.lang, { detail: want === 'all' ? null : /^[A-Z0-9]{2,8}$/.test(want) ? want : 'selected' }));
  });
  /* ---------- the selected level: list, switch (progress is kept), lessons of one level only ---------- */
  const levelRow = (lv) => ({ code: lv.code, title: lv.title, selected: !!lv.selected, unlocked: lv.unlocked, comingSoon: !!lv.comingSoon, hasLessons: lv.total > 0, total: lv.total, done: lv.done, pct: lv.pct });
  async function levelPath(req) {
    const user = await core.userById(req.user.id);
    const course = await core.courseFor(user);
    return { user, course, path: course ? await core.buildPath(user, course, req.lang) : null };
  }
  const knownLevel = (path, code) => { const lv = path && path.levels.find((l) => l.code === String(code || '')); if (!lv) throw bad('err.fix_fields', { level: 'val.level_unknown' }); return lv; };
  r.get('/levels', async (req, res) => {
    const { path } = await levelPath(req);
    res.json(path ? { selectedLevel: path.selectedLevel, levels: path.levels.map(levelRow) } : { selectedLevel: null, levels: [] });
  });
  r.put('/me/selected-level', async (req, res) => {
    const { path } = await levelPath(req);
    const lv = knownLevel(path, (req.body || {}).level);
    await learning.selectLevel(req.user.id, lv.code);
    const user = await core.userById(req.user.id);
    const fresh = await core.buildPath(user, await core.courseFor(user), req.lang);
    res.json({ selectedLevel: fresh.selectedLevel, level: levelRow(fresh.levels.find((l) => l.code === lv.code)), empty: fresh.selectedEmpty, recommended: fresh.recommended });
  });
  r.get('/levels/:code/lessons', async (req, res) => {
    const { path } = await levelPath(req);
    const lv = knownLevel(path, req.params.code);
    const lessons = lv.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unitId: u.id, unit: u.title, level: lv.code })));
    res.json({ level: levelRow(lv), empty: !lessons.length, message: lessons.length ? null : { key: 'path.level_empty', params: { level: lv.code } }, items: lessons });
  });
  r.get('/dashboard', async (req, res) => {
    const user = req.user;   // loaded for this request already
    const s = settings.all();
    const course = await core.courseFor(user);
    const path = course ? await core.buildPath(user, course, req.lang, { detail: 'selected' }) : null;
    const rec = path && path.recommended;
    let unit = null;
    if (path && rec) { for (const lv of path.levels) for (const u of lv.units) if (u.id === rec.unitId) unit = { id: u.id, title: u.title, total: u.total, done: u.done, level: lv.code }; }
    const [today, streak, week, achievements, reviewCounts, mistakes, daily, learningInfo, rm] = await Promise.all([core.dayInfo(user), core.streakInfo(user), core.weekDays(user), core.achievementList(user.id), review.counts(user), mistakesAvailable(user.id), dailySummary.summary(user), learning.brief(user, true), roadmap.summary(user, path)]);
    res.json({
      user: publicUser(user), course: course ? { id: course.id, title: L10N.text(course, 'title', req.lang) } : null, recommended: rec || null, unit,
      lessons: path ? path.totals : { lessons: 0, done: 0 },
      selectedLevel: path ? path.selectedLevel : null, selectedEmpty: path ? path.selectedEmpty : false, levelLessons: path ? path.selectedTotals : { lessons: 0, done: 0 },
      levels: path ? path.levels.map(levelRow) : [],
      level: path && path.levels.find((l) => l.code === path.selectedLevel) ? { code: path.selectedLevel, pct: path.levels.find((l) => l.code === path.selectedLevel).pct } : null,
      today, streak, hearts: core.heartState(user), week,
      achievements: achievements.filter((a) => a.earnedAt).sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1)).slice(0, 3),
      review: reviewCounts, mistakesAvailable: mistakes,
      leaderboardEnabled: s.leaderboard_enabled,
      daily, learning: learningInfo, roadmap: rm,
    });
  });
  const mistakesAvailable = async (userId) => (await attempts.mistakeIds(userId, 50)).length;

  /* ---------- IELTS preparation: the last level of the roadmap, shown with its own estimates ---------- */
  r.get('/ielts', async (req, res) => {
    const course = await db.get("SELECT * FROM courses WHERE slug = 'lexio-roadmap' AND status = 'published'");
    if (!course) return res.json({ course: null });
    const user = await core.userById(req.user.id);
    const path = await core.buildPath(user, course, req.lang);
    const level = path.levels.find((l) => l.code === 'IELTS');
    if (!level) return res.json({ course: null });
    const rows = await db.all('SELECT l.skill, MAX(x.band) best FROM exam_results x JOIN lessons l ON l.id = x.lesson_id WHERE x.user_id = ? AND x.band IS NOT NULL GROUP BY l.skill', user.id);
    const best = Object.fromEntries(rows.map((x) => [x.skill, x.best]));
    res.json({ course: { id: course.id, title: level.title, description: level.description }, unlocked: level.unlocked, comingSoon: !!level.comingSoon, lockReason: level.lockReason || null, units: level.units, totals: { lessons: level.total, done: level.done },
      bands: { listening: best.listening || null, reading: best.reading || null, overall: IELTS.overall([best.listening, best.reading]) } });
  });

  /* ---------- lessons ---------- */
  r.post('/lessons/:id/start', async (req, res) => {
    // a client that says which level it is showing must be showing the level of the lesson
    const want = (req.body || {}).level;
    if (want) {
      const row = await db.get('SELECT lv.code FROM lessons l JOIN levels lv ON lv.id = l.level_id WHERE l.id = ?', int(req.params.id));
      if (row && row.code !== String(want)) throw new HttpError(409, 'err.lesson_other_level', { level: row.code });
    }
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
    if (req.query.level) {
      const known = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'IELTS'];
      if (!known.includes(String(req.query.level))) throw bad('err.fix_fields', { level: 'val.level_unknown' });
    }
    if (req.query.level) { where.push('(v.cefr = ? OR lv.code = ?)'); args.push(String(req.query.level), String(req.query.level)); }
    if (['word', 'collocation', 'phrasal_verb', 'idiom', 'academic'].includes(req.query.kind)) { where.push('v.kind = ?'); args.push(req.query.kind); }
    if (req.query.unitId) { where.push('v.unit_id = ?'); args.push(int(req.query.unitId)); }
    if (filter === 'due') { where.push('ri.vocabulary_id IS NOT NULL AND ri.due_at <= ?'); args.push(now()); }
    if (filter === 'difficult') where.push('ri.is_difficult = 1');
    if (filter === 'new') where.push('ri.vocabulary_id IS NULL');
    if (filter === 'learning') where.push('ri.vocabulary_id IS NOT NULL');
    const from = 'FROM vocabulary v LEFT JOIN levels lv ON lv.id = v.level_id LEFT JOIN units un ON un.id = v.unit_id LEFT JOIN review_items ri ON ri.vocabulary_id = v.id AND ri.user_id = ?';
    const total = (await db.get(`SELECT COUNT(*) n ${from} WHERE ${where.join(' AND ')}`, user.id, ...args)).n;
    const rows = await db.all(`SELECT v.id, v.en, v.uz, v.translations, v.pos, v.example, v.example_uz, v.audio_url, v.ipa, v.synonyms, v.kind, v.topic, COALESCE(NULLIF(v.cefr,''), lv.code, '') level, un.title unit, ri.box, ri.due_at, ri.is_difficult, ri.correct, ri.wrong
      ${from} WHERE ${where.join(' AND ')} ORDER BY lv.position, un.position, v.id LIMIT ? OFFSET ?`, user.id, ...args, size, (page - 1) * size);
    res.json({ total, page, pageSize: size, items: rows.map((v) => { const t = L10N.vocab(v, tl); return { id: v.id, en: v.en, translation: t.word, translationLanguage: t.language, pos: v.pos, example: v.example, example_translation: t.example, audio_url: v.audio_url, ipa: v.ipa, synonyms: v.synonyms, kind: v.kind, topic: v.topic, level: v.level, unit: v.unit, box: v.box, due_at: v.due_at, correct: v.correct, wrong: v.wrong, status: v.box === null ? 'new' : v.due_at <= now() ? 'due' : 'learning', difficult: !!v.is_difficult }; }) });
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
    /* the learners' characters (opted-in people only): the active one, with the pictures of what it wears */
    const ids = rows.map((u) => u.id), chars = new Map();
    if (ids.length) {
      const q = ids.map(() => '?').join(',');
      const [avs, states, totals] = await Promise.all([db.all(`SELECT * FROM avatars WHERE user_id IN (${q}) ORDER BY id`, ...ids), db.all(`SELECT user_id, active_avatar_id FROM avatar_state WHERE user_id IN (${q})`, ...ids), db.all(`SELECT id, xp_total FROM users WHERE id IN (${q})`, ...ids)]);
      const active = new Map(states.map((x) => [x.user_id, x.active_avatar_id])), xpOf = new Map(totals.map((x) => [x.id, x.xp_total]));
      const pickOne = new Map(); for (const a of avs) { if (!pickOne.has(a.user_id) || a.id === active.get(a.user_id)) pickOne.set(a.user_id, a); }
      const parse = (x, d) => { try { return JSON.parse(x || ''); } catch (_) { return d; } };
      const slugs = [...new Set([...pickOne.values()].flatMap((a) => Object.values(parse(a.equipped, {}))))];
      const items = slugs.length ? await db.all(`SELECT slug, slot, kind, art, image_url FROM avatar_items WHERE slug IN (${slugs.map(() => '?').join(',')})`, ...slugs) : [];
      const bySlug = new Map(items.map((i) => [i.slug, { slot: i.slot, kind: i.kind, art: parse(i.art, {}), image: i.image_url || '' }]));
      for (const [uid, a] of pickOne) {
        const eq = {}; for (const [slot, slug] of Object.entries(parse(a.equipped, {}))) if (bySlug.has(slug)) eq[slot] = bySlug.get(slug);
        chars.set(uid, { name: a.name, style: ['cartoon', 'modern', 'fantasy', 'animal', 'robot'].includes(a.style) ? a.style : 'cartoon', look: parse(a.look, {}), equipped: eq, petName: a.pet_name || '', petPose: a.pet_pose || 'sit', xpTotal: xpOf.get(uid) || 0 });
      }
    }
    res.json({ enabled: true, weekStarts: since.slice(0, 10), optedIn: !!me.leaderboard_opt_in,
      items: rows.map((u, i) => { const c = chars.get(u.id); return { rank: i + 1, displayName: u.display_name, avatar: u.avatar, xp: u.xp, you: u.id === me.id, character: c ? { name: c.name, style: c.style, look: c.look, equipped: c.equipped, petName: c.petName, petPose: c.petPose, level: require('../lib/avatar-spec').charLevel(c.xpTotal).level } : null }; }) });
  });

  return r;
};
