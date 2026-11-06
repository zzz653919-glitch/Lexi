/* LEXIO KIDS, learner side: overview (dashboard), lesson content, results (stars, badges), and the account's learning mode. */
const express = require('express');
const K = require('../lib/kids');
const { now, int, clamp, HttpError, bad, localDate, addDays } = require('../lib/util');
const { publicUser } = require('./auth');

module.exports = function kidsRoutes({ db, auth }) {
  const r = express.Router();
  const user = auth.requireUser;
  const need = (row) => { if (!row) throw new HttpError(404, 'err.not_found'); return row; };
  const lang = (req) => (req.user.translation_language === 'ru' ? 'ru' : 'uz');

  /* the learning mode of the account: 'standard' (placement test / levels) or 'kids' */
  r.post('/me/mode', user, async (req, res) => {
    const mode = String((req.body || {}).mode || '');
    if (!['standard', 'kids'].includes(mode)) throw bad('err.fix_fields', { mode: 'val.mode' });
    // choosing Kids needs no placement test or level, so the welcome screen is not forced afterwards
    await db.run('UPDATE users SET mode = ?, onboarded = CASE WHEN ? = ? THEN 1 ELSE onboarded END WHERE id = ?', mode, mode, 'kids', req.user.id);
    res.json({ user: publicUser(await db.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
  });

  const published = (sql) => `${sql} AND status = 'published'`;
  async function catalogue(userId) {
    const cats = await db.all(published('SELECT * FROM kids_categories WHERE 1=1') + ' ORDER BY position, id');
    const counts = new Map((await db.all("SELECT category_id, COUNT(*) n FROM kids_words WHERE status = 'published' GROUP BY category_id")).map((x) => [x.category_id, x.n]));
    const prog = await db.all('SELECT * FROM kids_progress WHERE user_id = ?', userId);
    return cats.filter((c) => counts.get(c.id)).map((c) => {
      const n = counts.get(c.id), sp = K.split(n);
      const mine = prog.filter((p) => p.category_id === c.id && p.part <= sp.parts);
      const parts = Array.from({ length: sp.parts }, (_, i) => ({ part: i + 1, stars: (mine.find((p) => p.part === i + 1) || {}).stars || 0 }));
      return { c, n, ...sp, parts, stars: parts.reduce((a, p) => a + p.stars, 0), done: parts.every((p) => p.stars > 0) };
    });
  }
  async function streakOf(u) {
    const days = new Map((await db.all('SELECT local_date, lessons FROM kids_days WHERE user_id = ?', u.id)).map((d) => [d.local_date, d.lessons]));
    let d = localDate(new Date(), u.timezone); if (!days.get(d)) d = addDays(d, -1);
    let n = 0; while (days.get(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  async function badgeContext(u, cat) {
    const done = {}; for (const x of cat) done[x.c.slug] = x.done;
    return { stars: cat.reduce((a, x) => a + x.stars, 0), lessonsDone: cat.reduce((a, x) => a + x.parts.filter((p) => p.stars > 0).length, 0), threeStar: cat.reduce((a, x) => a + x.parts.filter((p) => p.stars === 3).length, 0),
      done, allDone: cat.length > 0 && cat.every((x) => x.done), streak: await streakOf(u) };
  }

  r.get('/kids/overview', user, async (req, res) => {
    const u = req.user, L = req.lang;
    const cat = await catalogue(u.id);
    const ctx = await badgeContext(u, cat);
    const today = localDate(new Date(), u.timezone);
    const days = new Map((await db.all('SELECT * FROM kids_days WHERE user_id = ?', u.id)).map((d) => [d.local_date, d]));
    const week = Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i - 6), d = days.get(date) || {}; return { date, lessons: d.lessons || 0, stars: d.stars || 0, today: date === today }; });
    const earned = new Map((await db.all('SELECT * FROM kids_badges WHERE user_id = ?', u.id)).map((b) => [b.code, b.earned_at]));
    // next lesson: the first part that has never been finished; otherwise the weakest part to improve
    let next = null;
    for (const x of cat) { const p = x.parts.find((q) => q.stars === 0); if (p) { next = { slug: x.c.slug, part: p.part, title: K.pickTitle(x.c, L), emoji: x.c.emoji, color: x.c.color }; break; } }
    if (!next) { let low = null; for (const x of cat) for (const p of x.parts) if (p.stars < 3 && (!low || p.stars < low.p.stars)) low = { x, p }; if (low) next = { slug: low.x.c.slug, part: low.p.part, title: K.pickTitle(low.x.c, L), emoji: low.x.c.emoji, color: low.x.c.color }; }
    res.json({
      name: u.display_name, stars: ctx.stars, maxStars: cat.reduce((a, x) => a + x.parts.length * 3, 0), lessonsDone: ctx.lessonsDone, lessonsTotal: cat.reduce((a, x) => a + x.parts.length, 0), streak: ctx.streak,
      today: week[6], week, next,
      categories: cat.map((x) => ({ slug: x.c.slug, title: K.pickTitle(x.c, L), emoji: x.c.emoji, color: x.c.color, kind: x.c.kind, words: x.n, parts: x.parts, stars: x.stars, maxStars: x.parts.length * 3, done: x.done })),
      badges: K.BADGES.map((b) => ({ code: b.code, emoji: b.emoji, earned: earned.has(b.code), at: earned.get(b.code) || null })),
    });
  });

  /* the cards of one category (all parts) + administrator-written quiz questions */
  r.get('/kids/categories/:slug', user, async (req, res) => {
    const c = need(await db.get("SELECT * FROM kids_categories WHERE slug = ? AND status = 'published'", String(req.params.slug)));
    const words = await db.all("SELECT * FROM kids_words WHERE category_id = ? AND status = 'published' ORDER BY position, id", c.id);
    if (!words.length) throw new HttpError(404, 'err.not_found');
    const sp = K.split(words.length), lg = lang(req);
    const prog = await db.all('SELECT part, stars FROM kids_progress WHERE user_id = ? AND category_id = ?', req.user.id, c.id);
    const questions = (await db.all("SELECT * FROM kids_questions WHERE category_id = ? AND status = 'published' ORDER BY position, id", c.id)).map((q) => ({
      id: q.id, prompt: (lg === 'ru' && q.prompt_ru) || (lg === 'uz' && q.prompt_uz) || q.prompt, pic: q.pic, image: q.image_url, audio: q.audio_url, correct: q.correct, wrong: [q.wrong1, q.wrong2, q.wrong3].filter(Boolean) }));
    res.json({
      category: { slug: c.slug, title: K.pickTitle(c, req.lang), emoji: c.emoji, color: c.color, kind: c.kind, parts: sp.parts, size: sp.size },
      cards: words.map((w, i) => ({ id: w.id, part: Math.floor(i / sp.size) + 1, en: w.en, tr: K.pickWord(w, lg), pic: w.pic, extra: w.extra, image: w.image_url, audio: w.audio_url })),
      questions, progress: Array.from({ length: sp.parts }, (_, i) => ({ part: i + 1, stars: (prog.find((p) => p.part === i + 1) || {}).stars || 0 })),
    });
  });

  r.post('/kids/categories/:slug/complete', user, async (req, res) => {
    const u = req.user, b = req.body || {};
    const c = need(await db.get("SELECT * FROM kids_categories WHERE slug = ? AND status = 'published'", String(req.params.slug)));
    const n = (await db.get("SELECT COUNT(*) n FROM kids_words WHERE category_id = ? AND status = 'published'", c.id)).n;
    const sp = K.split(n), part = int(b.part, 1), total = int(b.total, 0), correct = int(b.correct, -1);
    if (part < 1 || part > sp.parts || total < 1 || total > K.MAX_QUESTIONS || correct < 0 || correct > total) throw bad('err.fix_fields');
    const pct = Math.round((100 * correct) / total), stars = K.starsFor(pct), t = now(), today = localDate(new Date(), u.timezone);
    const old = await db.get('SELECT stars, best_pct FROM kids_progress WHERE user_id = ? AND category_id = ? AND part = ?', u.id, c.id, part);
    const gained = Math.max(0, stars - (old ? old.stars : 0));
    await db.tx(async () => {
      await db.run(`INSERT INTO kids_progress (user_id, category_id, part, stars, best_pct, attempts, updated_at) VALUES (?,?,?,?,?,1,?)
        ON CONFLICT(user_id, category_id, part) DO UPDATE SET stars = MAX(stars, excluded.stars), best_pct = MAX(best_pct, excluded.best_pct), attempts = attempts + 1, updated_at = excluded.updated_at`, u.id, c.id, part, stars, pct, t);
      await db.run('INSERT INTO kids_days (user_id, local_date, lessons, stars) VALUES (?,?,1,?) ON CONFLICT(user_id, local_date) DO UPDATE SET lessons = lessons + 1, stars = stars + excluded.stars', u.id, today, gained);
    });
    const cat = await catalogue(u.id), ctx = await badgeContext(u, cat);
    const have = new Set((await db.all('SELECT code FROM kids_badges WHERE user_id = ?', u.id)).map((x) => x.code));
    const fresh = K.BADGES.filter((x) => !have.has(x.code) && x.test(ctx));
    for (const x of fresh) await db.run('INSERT OR IGNORE INTO kids_badges (user_id, code, earned_at) VALUES (?,?,?)', u.id, x.code, t);
    const me = cat.find((x) => x.c.id === c.id);
    res.json({ stars, pct, gained, totalStars: ctx.stars, categoryDone: !!(me && me.done), newBadges: fresh.map((x) => ({ code: x.code, emoji: x.emoji })) });
  });
  return r;
};
