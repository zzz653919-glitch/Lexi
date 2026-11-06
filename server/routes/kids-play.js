/* LEXIO KIDS, part 2 (learner side): profile and companion, mini games, stories, rewards, world, missions, drawings, progress and the parent area. */
const express = require('express');
const A = require('../lib/auth');
const K = require('../lib/kids');
const W = require('../lib/kids-world');
const { now, int, clamp, HttpError, bad, localDate, addDays, clean, shuffled } = require('../lib/util');

const ART = ['apple', 'cat', 'fish', 'ball', 'car', 'house', 'flower', 'teddy'];
const HEX = /^#[0-9a-fA-F]{6}$/;

module.exports = function kidsPlayRoutes({ db, auth, opts }) {
  const r = express.Router();
  const user = auth.requireUser;
  const need = (row) => { if (!row) throw new HttpError(404, 'err.not_found'); return row; };
  const wordLang = (req) => (req.user.translation_language === 'ru' ? 'ru' : 'uz');
  const pick = (o, base, lang) => (lang === 'ru' && o[base + '_ru']) || (lang === 'uz' && o[base + '_uz']) || o[base];
  const parentLimit = A.limiter(db, 'kidsparent', 10, 10 * 60000, opts.rateLimit);

  /* sync rewards after an activity and describe what changed (new rewards, missions) */
  async function after(req, extra = {}) {
    const s = await W.sync(db, req.user, req.lang);
    const m = await W.settleMissions(db, req.user);
    if (m.allDone) { const s2 = await W.sync(db, req.user, req.lang); s.fresh.push(...s2.fresh); s.stats = s2.stats; }
    return { newRewards: s.fresh, missions: m.missions, missionsDone: m.allDone, totalStars: s.stats.stars, ...extra };
  }
  const secondsOf = (b) => clamp(int(b.seconds, 0), 0, W.LIMITS.seconds);

  /* ---------- profile and the companion ---------- */
  const FREE = { character: W.CHARACTERS.filter((c) => !c[1]).map((c) => c[0]), accessory: [], background: ['sky'] };
  /* the profile is read by every Kids page: a few reads at once (no reward recalculation; earned rewards are remembered in kids_rewards) */
  async function profileBody(u) {
    const today = localDate(new Date(), u.timezone);
    const read = () => Promise.all([db.get('SELECT * FROM kids_profile WHERE user_id = ?', u.id), db.get('SELECT seconds FROM kids_days WHERE user_id = ? AND local_date = ?', u.id, today),
      db.all('SELECT kind, code FROM kids_rewards WHERE user_id = ?', u.id),
      db.get('SELECT (SELECT COALESCE(SUM(stars), 0) FROM kids_progress WHERE user_id = ?) + (SELECT COALESCE(SUM(stars), 0) FROM kids_games WHERE user_id = ?) + (SELECT COALESCE(SUM(stars), 0) FROM kids_story_progress WHERE user_id = ?) AS n', u.id, u.id, u.id),
      db.get(`SELECT 1 x FROM kids_days WHERE user_id = ? AND local_date = ? AND (${W.activeSql})`, u.id, today)]);
    let [p, day, rewards, stars, active] = await read();
    if (!p) { await W.ensureProfile(db, u.id); [p, day, rewards, stars, active] = await read(); }
    if (!rewards.length) { await W.sync(db, u, 'en'); rewards = await db.all('SELECT kind, code FROM kids_rewards WHERE user_id = ?', u.id); }   // first visit: the free rewards
    const has = (k, c) => FREE[k].includes(c) || rewards.some((r) => r.kind === k && r.code === c);
    return { stars: stars.n, character: p.character, accessory: p.accessory, background: p.background, sound: !!p.sound, narration: !!p.narration, age: p.age, mic: !!p.mic, reminders: !!p.reminders, reminderTime: p.reminder_time, dailyLimitMin: p.daily_limit_min,
      todaySeconds: day ? day.seconds : 0, limitReached: !!(p.daily_limit_min && day && day.seconds >= p.daily_limit_min * 60), pinSet: !!p.pin_hash, hasActivityToday: !!active,
      unlocked: { character: W.CHARACTERS.map((c) => c[0]).filter((c) => has('character', c)), accessory: W.ACCESSORIES.map((c) => c[0]).filter((c) => has('accessory', c)), background: W.BACKGROUNDS.map((c) => c[0]).filter((c) => has('background', c)) } };
  }
  r.get('/kids/profile', user, async (req, res) => res.json(await profileBody(req.user)));
  r.patch('/kids/profile', user, async (req, res) => {
    const b = req.body || {}, cur = await profileBody(req.user), set = {};
    for (const [k, list] of [['character', 'character'], ['accessory', 'accessory'], ['background', 'background']]) {
      if (b[k] === undefined) continue;
      const v = String(b[k]);
      if (k === 'accessory' && v === '') { set.accessory = ''; continue; }
      if (!cur.unlocked[list].includes(v)) throw bad('err.fix_fields', { [k]: 'val.kids_locked' });
      set[k] = v;
    }
    const keys = Object.keys(set);
    if (keys.length) await db.run(`UPDATE kids_profile SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE user_id = ?`, ...keys.map((k) => set[k]), now(), req.user.id);
    res.json(await profileBody(req.user));
  });

  /* ---------- cards for the games ---------- */
  r.get('/kids/cards', user, async (req, res) => {
    const lg = wordLang(req);
    const rows = await db.all(`SELECT w.*, c.slug cat, c.kind FROM kids_words w JOIN kids_categories c ON c.id = w.category_id WHERE w.status = 'published' AND c.status = 'published' ORDER BY c.position, w.position, w.id`);
    res.json({ cards: rows.map((w) => ({ id: w.id, cat: w.cat, kind: w.kind, en: w.en, tr: K.pickWord(w, lg), pic: w.pic, extra: w.extra, image: w.image_url, audio: w.audio_url })) });
  });

  /* ---------- mini games ---------- */
  r.get('/kids/games', user, async (req, res) => {
    const rows = new Map((await db.all('SELECT * FROM kids_games WHERE user_id = ?', req.user.id)).map((g) => [g.game, g]));
    res.json({ games: W.GAMES.map((g) => ({ code: g.code, emoji: g.emoji, color: g.color, stars: (rows.get(g.code) || {}).stars || 0, plays: (rows.get(g.code) || {}).plays || 0 })) });
  });
  r.post('/kids/games/:code/complete', user, async (req, res) => {
    const u = req.user, b = req.body || {}, game = W.GAMES.find((g) => g.code === req.params.code);
    if (!game) throw new HttpError(404, 'err.not_found');
    const total = int(b.total, 0), correct = int(b.correct, -1);
    if (total < 1 || total > K.MAX_QUESTIONS || correct < 0 || correct > total) throw bad('err.fix_fields');
    const pct = Math.round((100 * correct) / total), stars = K.starsFor(pct), t = now();
    const old = await db.get('SELECT stars FROM kids_games WHERE user_id = ? AND game = ?', u.id, game.code);
    const gained = Math.max(0, stars - (old ? old.stars : 0));
    let fresh = 0;
    await db.tx(async () => {
      await db.run(`INSERT INTO kids_games (user_id, game, stars, best_pct, plays, updated_at) VALUES (?,?,?,?,1,?)
        ON CONFLICT(user_id, game) DO UPDATE SET stars = MAX(stars, excluded.stars), best_pct = MAX(best_pct, excluded.best_pct), plays = plays + 1, updated_at = excluded.updated_at`, u.id, game.code, stars, pct, t);
      fresh = await W.learn(db, u.id, b.wordIds);
      await W.bump(db, u, { games: 1, quizzes: game.quiz ? 1 : 0, stars: gained, seconds: secondsOf(b), newwords: fresh });
    });
    res.json(await after(req, { game: game.code, stars, pct, gained, newWords: fresh }));
  });

  /* ---------- stories ---------- */
  const storyOf = (slug) => W.STORIES.find((s) => s.slug === slug);
  r.get('/kids/stories', user, async (req, res) => {
    const prog = new Map((await db.all('SELECT * FROM kids_story_progress WHERE user_id = ?', req.user.id)).map((p) => [p.slug, p]));
    res.json({ stories: W.STORIES.map((s) => ({ slug: s.slug, emoji: s.emoji, color: s.color, title: pick(s, '', req.lang) || s.en, pages: s.pages.length, stars: (prog.get(s.slug) || {}).stars || 0, reads: (prog.get(s.slug) || {}).reads || 0 })).map((s) => s) });
  });
  r.get('/kids/stories/:slug', user, async (req, res) => {
    const s = need(storyOf(req.params.slug)), lg = wordLang(req);
    const tr = (o) => (lg === 'ru' ? o.ru : o.uz) || o.uz;
    res.json({ slug: s.slug, emoji: s.emoji, color: s.color, title: s.en, titleTr: tr({ uz: s.uz, ru: s.ru }),
      pages: s.pages.map((p) => ({ scene: p.scene, en: p.en, tr: tr(p) })),
      questions: s.questions.map((q) => ({ prompt: q.en, tr: tr(q), answer: q.options[0], options: shuffled(q.options, Math.floor(Math.random() * 1e9)) })) });
  });
  r.post('/kids/stories/:slug/complete', user, async (req, res) => {
    const u = req.user, b = req.body || {}, s = need(storyOf(req.params.slug));
    const total = int(b.total, 0), correct = int(b.correct, -1);
    if (total < 1 || total > s.questions.length || correct < 0 || correct > total) throw bad('err.fix_fields');
    const pct = Math.round((100 * correct) / total), stars = K.starsFor(pct), t = now();
    const old = await db.get('SELECT stars FROM kids_story_progress WHERE user_id = ? AND slug = ?', u.id, s.slug);
    const gained = Math.max(0, stars - (old ? old.stars : 0));
    await db.tx(async () => {
      await db.run(`INSERT INTO kids_story_progress (user_id, slug, stars, best_pct, reads, updated_at) VALUES (?,?,?,?,1,?)
        ON CONFLICT(user_id, slug) DO UPDATE SET stars = MAX(stars, excluded.stars), best_pct = MAX(best_pct, excluded.best_pct), reads = reads + 1, updated_at = excluded.updated_at`, u.id, s.slug, stars, pct, t);
      await W.bump(db, u, { quizzes: 1, stars: gained, seconds: secondsOf(b) });
    });
    res.json(await after(req, { stars, pct, gained }));
  });

  /* ---------- rewards, the world, missions ---------- */
  r.get('/kids/rewards', user, async (req, res) => {
    const [s, rows] = await Promise.all([W.sync(db, req.user, req.lang), db.all('SELECT kind, code, earned_at FROM kids_rewards WHERE user_id = ?', req.user.id)]);
    const when = new Map(rows.map((x) => [x.kind + ':' + x.code, x.earned_at]));
    res.json({ stars: s.stats.stars, items: s.catalogue.filter((x) => x.kind !== 'decor' && x.kind !== 'place').map((x) => ({ kind: x.kind, code: x.code, emoji: x.emoji, name: x.name || null, image: x.image || '', need: x.need, earned: s.earned.has(x.kind + ':' + x.code), at: when.get(x.kind + ':' + x.code) || null })) });
  });
  r.get('/kids/world', user, async (req, res) => {
    const s = await W.sync(db, req.user, req.lang);
    const animals = s.catalogue.filter((x) => x.kind === 'animal' && s.earned.has('animal:' + x.code)).map((x) => ({ emoji: x.emoji, name: x.name, image: x.image || '' }));
    res.json({ stars: s.stats.stars, places: W.PLACES.map(([code, emoji, n], i) => {
      const unlocked = s.earned.has('place:' + code);
      const next = W.PLACES[i + 1];
      return { code, emoji, need: n, unlocked, decor: s.catalogue.filter((d) => d.kind === 'decor' && d.place === code).map((d) => ({ code: d.code, emoji: d.emoji, x: d.x, y: d.y, need: d.need.n, unlocked: s.earned.has('decor:' + d.code) })),
        animals: code === 'zoo' || code === 'forest' ? animals.filter((_, k) => (code === 'zoo' ? k % 2 === 0 : k % 2 === 1)) : [], nextNeed: next ? next[2] : null };
    }) });
  });
  r.get('/kids/missions', user, async (req, res) => {
    const today = localDate(new Date(), req.user.timezone);
    const row = await db.get('SELECT * FROM kids_days WHERE user_id = ? AND local_date = ?', req.user.id, today);
    res.json({ missions: W.missionsOf(row), bonus: !!(row && row.bonus) });
  });
  r.post('/kids/event', user, async (req, res) => {
    const u = req.user, b = req.body || {}, kind = String(b.kind || ''), n = clamp(int(b.n, 1), 1, W.LIMITS.events);
    if (!['listen', 'speak'].includes(kind)) throw bad('err.fix_fields');
    let fresh = 0;
    await db.tx(async () => {
      if (kind === 'listen') await W.bump(db, u, { listens: n });
      else { fresh = await W.learn(db, u.id, b.wordIds); await W.bump(db, u, { speaks: 1, newwords: fresh, seconds: secondsOf(b) }); }
    });
    res.json(await after(req, { newWords: fresh }));
  });

  /* ---------- drawings ---------- */
  r.get('/kids/art', user, async (req, res) => {
    const rows = new Map((await db.all('SELECT picture, fills FROM kids_art WHERE user_id = ?', req.user.id)).map((a) => [a.picture, a.fills]));
    res.json({ pictures: ART.map((p) => ({ code: p, colored: Object.keys(JSON.parse(rows.get(p) || '{}')).length })) });
  });
  r.get('/kids/art/:picture', user, async (req, res) => {
    if (!ART.includes(req.params.picture)) throw new HttpError(404, 'err.not_found');
    const row = await db.get('SELECT fills FROM kids_art WHERE user_id = ? AND picture = ?', req.user.id, req.params.picture);
    res.json({ fills: JSON.parse((row && row.fills) || '{}') });
  });
  r.put('/kids/art/:picture', user, async (req, res) => {
    if (!ART.includes(req.params.picture)) throw new HttpError(404, 'err.not_found');
    const raw = (req.body || {}).fills;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('err.fix_fields');
    const fills = {};
    for (const [k, v] of Object.entries(raw).slice(0, 24)) { if (!/^\d{1,2}$/.test(k) || !HEX.test(String(v))) throw bad('err.fix_fields'); fills[k] = String(v).toLowerCase(); }
    const old = await db.get('SELECT fills FROM kids_art WHERE user_id = ? AND picture = ?', req.user.id, req.params.picture);
    const before = Object.keys(JSON.parse((old && old.fills) || '{}')).length, count = Object.keys(fills).length;
    await db.run('INSERT INTO kids_art (user_id, picture, fills, updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id, picture) DO UPDATE SET fills = excluded.fills, updated_at = excluded.updated_at', req.user.id, req.params.picture, JSON.stringify(fills), now());
    // finishing a first colouring (3 or more areas) counts as one drawing
    if (before < 3 && count >= 3) await W.bump(db, req.user, { arts: 1, seconds: secondsOf(req.body) });
    res.json(await after(req, { colored: count }));
  });

  /* ---------- progress (for the child) and the parent area ---------- */
  async function progressBody(req) {
    const u = req.user, s = await W.sync(db, u, req.lang), st = s.stats;
    const lg = req.lang;
    const catRows = st.cats.filter((c) => c.n);
    const prog = st.prog;
    const knownBy = new Map(); for (const k of st.knownByCat) knownBy.set(k.slug, (knownBy.get(k.slug) || 0) + 1);
    const today = localDate(new Date(), u.timezone), days = new Map(st.days.map((d) => [d.local_date, d]));
    const categories = catRows.map((c) => {
      const sp = K.split(c.n), mine = prog.filter((p) => p.category_id === c.id && p.part <= sp.parts);
      return { slug: c.slug, title: K.pickTitle(c, lg), emoji: c.emoji, color: c.color, parts: sp.parts, partsDone: mine.filter((p) => p.stars > 0).length, stars: mine.reduce((a, p) => a + p.stars, 0), maxStars: sp.parts * 3, words: c.n, known: knownBy.get(c.slug) || 0,
        nextPart: (Array.from({ length: sp.parts }, (_, i) => i + 1).find((i) => !((mine.find((p) => p.part === i) || {}).stars >= 3))) || 1 };
    });
    const week = Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i - 6), d = days.get(date) || {}; return { date, today: date === today, lessons: d.lessons || 0, games: d.games || 0, stars: d.stars || 0, minutes: Math.round((d.seconds || 0) / 60) }; });
    const totalSeconds = st.days.reduce((a, d) => a + d.seconds, 0), weekSeconds = week.reduce((a, d) => a + d.minutes * 60, 0);
    return { s, body: { stars: st.stars, maxStars: st.maxStars, lessons: { done: st.lessons, total: st.partsTotal }, words: { known: st.wordsKnown, total: st.cats.reduce((a, c) => a + c.n, 0) }, games: { played: st.games.size, total: W.GAMES.length }, stories: { read: st.stories.size, total: W.STORIES.length },
      stickers: { earned: [...s.earned].filter((k) => k.startsWith('sticker:')).length, total: s.catalogue.filter((x) => x.kind === 'sticker').length }, streak: st.streak, week, categories,
      minutes: { today: Math.round(((days.get(today) || {}).seconds || 0) / 60), week: Math.round(weekSeconds / 60), total: Math.round(totalSeconds / 60) } } };
  }
  r.get('/kids/progress', user, async (req, res) => res.json((await progressBody(req)).body));

  const gate = (req, res, next) => (W.parentOk(req.session, req.get('x-parent-token')) ? next() : next(new HttpError(403, 'err.parent_required')));
  r.get('/kids/parent/challenge', user, async (req, res) => {
    const p = await W.ensureProfile(db, req.user.id);
    if (p.pin_hash) return res.json({ pin: true });
    const a = 11 + Math.floor(Math.random() * 9), b = 6 + Math.floor(Math.random() * 4);
    res.json({ pin: false, a, b, sig: W.challengeSig(req.session, a, b) });
  });
  r.post('/kids/parent/verify', user, async (req, res) => {
    if (!(await parentLimit.take(req.ip + ':' + req.user.id))) throw new HttpError(429, 'err.rate_requests');
    const b = req.body || {}, p = await W.ensureProfile(db, req.user.id);
    let ok = false;
    if (p.pin_hash) ok = /^\d{4}$/.test(String(b.pin || '')) && A.verifyPassword(String(b.pin), p.pin_hash);
    else { const a = int(b.a, 0), c = int(b.b, 0); ok = W.challengeSig(req.session, a, c) === String(b.sig || '') && int(b.answer, -1) === a + c; }
    if (!ok) throw bad('err.parent_wrong');
    res.json({ token: W.parentToken(req.session), minutes: 20 });
  });
  r.get('/kids/parent/summary', user, gate, async (req, res) => {
    const { body } = await progressBody(req);
    const settings = await profileBody(req.user);
    const recommended = body.categories.filter((c) => c.partsDone < c.parts || c.stars < c.maxStars).sort((a, b) => (a.partsDone / a.parts) - (b.partsDone / b.parts) || (a.stars / a.maxStars) - (b.stars / b.maxStars)).slice(0, 3)
      .map((c) => ({ slug: c.slug, part: c.nextPart, title: c.title, emoji: c.emoji, reason: c.partsDone < c.parts ? 'new' : 'practice' }));
    res.json({ ...body, recommended, settings: { sound: settings.sound, narration: settings.narration, age: settings.age, mic: settings.mic, reminders: settings.reminders, reminderTime: settings.reminderTime, dailyLimitMin: settings.dailyLimitMin, pinSet: settings.pinSet } });
  });
  r.patch('/kids/parent/settings', user, gate, async (req, res) => {
    const b = req.body || {}, set = {};
    for (const k of ['sound', 'narration', 'mic', 'reminders']) if (b[k] !== undefined) set[k] = b[k] ? 1 : 0;
    if (b.age !== undefined) { if (!['young', 'older'].includes(b.age)) throw bad('err.fix_fields', { age: 'val.kids_age' }); set.age = b.age; }
    if (b.reminderTime !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.reminderTime))) throw bad('err.fix_fields', { reminderTime: 'val.kids_time' }); set.reminder_time = b.reminderTime; }
    if (b.dailyLimitMin !== undefined) set.daily_limit_min = clamp(int(b.dailyLimitMin, 0), 0, 240);
    await W.ensureProfile(db, req.user.id);
    const keys = Object.keys(set);
    if (keys.length) await db.run(`UPDATE kids_profile SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE user_id = ?`, ...keys.map((k) => set[k]), now(), req.user.id);
    res.json(await profileBody(req.user));
  });
  r.post('/kids/parent/pin', user, gate, async (req, res) => {
    const pin = String((req.body || {}).pin || '');
    await W.ensureProfile(db, req.user.id);
    if (pin !== '' && !/^\d{4}$/.test(pin)) throw bad('err.fix_fields', { pin: 'val.kids_pin' });
    await db.run('UPDATE kids_profile SET pin_hash = ?, updated_at = ? WHERE user_id = ?', pin ? A.hashPassword(pin) : '', now(), req.user.id);
    res.json({ pinSet: !!pin });
  });
  return r;
};
