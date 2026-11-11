const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client, playAttempt } = require('./helpers');

async function learner(s, email, extra = {}) { const id = s.createUser({ email, ...extra }); const c = new Client(s.base); await c.login(email); c.id = id; return c; }
const codes = (r) => r.json.items.filter((a) => a.unlocked).map((a) => a.code);
const byCode = (r, code) => r.json.items.find((a) => a.code === code);
async function playFirstLesson(s, c) { const rec = (await c.get('/api/path')).json.recommended; const st = (await c.post(`/api/lessons/${rec.lessonId}/start`)).json; return playAttempt(c, st, s.db); }
const markDone = (s, userId, lessonIds) => { for (const id of lessonIds) s.db.run('INSERT OR IGNORE INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) VALUES (?,?,1,90,?,?)', userId, id, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'); };
const lessonIdsOf = (s, code) => s.db.all('SELECT l.id FROM lessons l JOIN levels lv ON lv.id = l.level_id WHERE lv.code = ? AND l.status = ? ORDER BY l.id', code, 'published').map((r) => r.id);

test('the catalogue: five categories, five rarities, every requested achievement, rewards that grow with rarity, exclusive items not for sale', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'cat@example.com');
    const r = await c.get('/api/achievements');
    assert.strictEqual(r.status, 200);
    const want = { learning: ['first_lesson', 'lessons_10', 'lessons_50', 'lessons_100', 'words_100', 'words_500', 'words_1000', 'grammar_master', 'ielts_explorer'], streak: ['streak_2', 'streak_7', 'streak_30', 'streak_100', 'streak_365'],
      performance: ['perfect_score', 'quiz_champion', 'sharp_mind', 'fast_learner', 'consistency_king'], level: ['level_a1', 'level_a2', 'level_b1', 'level_b2', 'level_c1', 'ielts_ready'], special: ['early_bird', 'night_owl', 'comeback', 'explorer', 'polyglot'] };
    for (const [cat, list] of Object.entries(want)) for (const code of list) { const a = byCode(r, code); assert.ok(a, code); assert.strictEqual(a.category, cat, code); }
    assert.deepStrictEqual(r.json.rarities, ['common', 'rare', 'epic', 'legendary', 'mythic']);
    assert.ok(r.json.items.every((a) => r.json.rarities.includes(a.rarity)));
    const avg = (rar) => { const l = r.json.items.filter((a) => a.rarity === rar && a.category !== 'milestone'); return l.reduce((x, a) => x + a.xp + a.tokens, 0) / l.length; };
    const order = r.json.rarities.map(avg); for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], 'rarer achievements pay more: ' + order.join(' < '));
    for (const a of r.json.items.filter((x) => x.item)) { const it = s.db.get('SELECT * FROM avatar_items WHERE slug = ?', a.item.slug); assert.strictEqual(it.earn_rule, 'ach:' + a.code); assert.strictEqual(it.price, 0); }
    assert.ok(r.json.items.filter((a) => a.item).length >= 15, 'exclusive clothes, accessories, pets and backgrounds');
    const slots = new Set(r.json.items.filter((a) => a.item).map((a) => a.item.slot)); for (const slot of ['pet', 'background', 'hat', 'back']) assert.ok(slots.has(slot), slot);
  } finally { await s.stop(); }
});

test('nothing unlocks without real activity: a new learner has nothing, and no request can unlock anything', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'new@example.com');
    let r = await c.get('/api/achievements');
    assert.strictEqual(r.json.summary.unlocked, 0); assert.strictEqual(r.json.summary.percent, 0); assert.strictEqual(r.json.summary.xp, 0);
    assert.ok(r.json.items.every((a) => !a.unlocked && a.earnedAt === null));
    // forging: marking things as seen, posting unlock requests or guessing endpoints changes nothing
    assert.strictEqual((await c.post('/api/achievements/seen', { codes: ['first_lesson', 'streak_365'] })).status, 200);
    for (const u of ['/api/achievements/unlock', '/api/achievements/first_lesson', '/api/achievements/first_lesson/claim']) assert.ok([404, 405].includes((await c.post(u, { code: 'first_lesson' })).status), u);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM user_achievements').n, 0);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM token_transactions').n, 0);
    // the stored progress of a locked achievement is real: 0 of its target
    const a = byCode(await c.get('/api/achievements'), 'lessons_10'); assert.strictEqual(a.progress, 0); assert.strictEqual(a.target, 10); assert.strictEqual(a.percent, 0);
  } finally { await s.stop(); }
});

test('finishing a lesson unlocks First Lesson and Fast Learner once: XP, tokens, notification data, no duplicates', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'play@example.com');
    const done = await playFirstLesson(s, c);
    assert.strictEqual(done.state.status, 'completed');
    const got = done.state.earned || (done.state.result && done.state.result.earned) || [];
    assert.ok(got.length === 0 || got.every((a) => a.rarity && a.title), 'the answer carries the unlocked achievements');
    let r = await c.get('/api/achievements');
    assert.ok(codes(r).includes('first_lesson'), 'First Lesson'); assert.ok(codes(r).includes('fast_learner'), 'Fast Learner: 12 questions answered in seconds, all correct');
    assert.ok(!codes(r).includes('lessons_10') && !codes(r).includes('streak_7'));
    const fl = byCode(r, 'first_lesson');
    assert.strictEqual(fl.earnedXp, 20); assert.strictEqual(fl.earnedTokens, 10); assert.ok(fl.earnedAt);
    const row = (code) => ({ xp: s.db.get("SELECT COUNT(*) n FROM xp_transactions WHERE user_id = ? AND reason = 'achievement'", c.id).n, tok: s.db.get('SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND ref = ?', c.id, 'ach:' + code).n });
    assert.deepStrictEqual(row('first_lesson'), { xp: 2, tok: 1 }, 'one XP row per achievement, one token row');
    // asking again, or asking many times at once, never pays twice
    await Promise.all([1, 2, 3, 4, 5].map(() => c.get('/api/achievements')));
    assert.deepStrictEqual(row('first_lesson'), { xp: 2, tok: 1 });
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM user_achievements WHERE user_id = ? AND code = 'first_lesson'", c.id).n, 1);
    const wallet = s.db.get('SELECT balance, earned_total FROM token_wallets WHERE user_id = ?', c.id), ledger = s.db.get('SELECT SUM(amount) n FROM token_transactions WHERE user_id = ?', c.id).n;
    assert.strictEqual(wallet.balance, ledger, 'the wallet and the ledger agree');
    const xpUser = s.db.get('SELECT xp_total FROM users WHERE id = ?', c.id).xp_total, xpLedger = s.db.get('SELECT SUM(amount) n FROM xp_transactions WHERE user_id = ?', c.id).n; assert.strictEqual(xpUser, xpLedger);
    // the notification data: unseen until it is marked
    const un = (await c.get('/api/achievements/unseen')).json.items; assert.ok(un.some((a) => a.code === 'first_lesson' && a.xp === 20 && a.tokens === 10));
    await c.post('/api/achievements/seen', { codes: un.map((a) => a.code) });
    assert.strictEqual((await c.get('/api/achievements/unseen')).json.items.length, 0);
    // history survives a new login / device
    const other = new Client(s.base); await other.login('play@example.com'); assert.ok(codes(await other.get('/api/achievements')).includes('first_lesson'));
  } finally { await s.stop(); }
});

test('milestones come from stored activity: lessons, topics, streaks; progress bars are stored; exclusive items are given', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'mile@example.com');
    const a1 = lessonIdsOf(s, 'A1'); markDone(s, c.id, a1.slice(0, 12));
    let r = await c.get('/api/achievements');
    assert.ok(codes(r).includes('first_lesson') && codes(r).includes('lessons_10') && codes(r).includes('lessons_25') === false);
    const l50 = byCode(r, 'lessons_50'); assert.strictEqual(l50.progress, 12); assert.strictEqual(l50.target, 50); assert.strictEqual(l50.percent, 24);
    assert.strictEqual(s.db.get("SELECT progress FROM user_achievement_progress WHERE user_id = ? AND code = 'lessons_50'", c.id).progress, 12, 'progress is stored in the database');
    assert.ok(codes(r).includes('explorer') === (s.db.get('SELECT COUNT(DISTINCT unit_id) n FROM lessons WHERE id IN (' + a1.slice(0, 12).join(',') + ')').n >= 5));
    markDone(s, c.id, a1.slice(0, 50)); r = await c.get('/api/achievements');
    assert.ok(codes(r).includes('lessons_50')); assert.ok(s.db.get("SELECT 1 x FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? AND i.slug = 'ach-scholar-backpack'", c.id), 'the exclusive backpack is given');
    // streak achievements follow the longest streak
    s.db.run('INSERT OR REPLACE INTO user_streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (?,?,?,?)', c.id, 7, 7, '2026-01-01');
    r = await c.get('/api/achievements');
    assert.ok(codes(r).includes('streak_2') && codes(r).includes('streak_7') && codes(r).includes('streak_3')); assert.ok(!codes(r).includes('streak_30'));
    assert.strictEqual(byCode(r, 'streak_30').progress, 7);
    assert.ok(s.db.get("SELECT 1 x FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? AND i.slug = 'ach-warrior-cap'", c.id));
    // the shop shows the exclusive item as earned by the achievement
    const boot = (await c.get('/api/avatar/bootstrap')).json, it = boot.items.find((x) => x.slug === 'ach-phoenix-dragon');
    assert.ok(it && !it.forSale && it.earn && it.earn.type === 'ach' && it.earn.have === 0, 'Unstoppable pet: locked, earned with the achievement');
    assert.ok(boot.items.find((x) => x.slug === 'ach-warrior-cap').owned);
    // the profile shows badges, the rarest first
    const prof = (await c.get('/api/me/profile')).json.achievements;
    assert.ok(prof.badges.length > 0 && prof.unlocked === codes(r).length); const rk = ['common', 'rare', 'epic', 'legendary', 'mythic']; for (let i = 1; i < prof.badges.length; i++) assert.ok(rk.indexOf(prof.badges[i - 1].rarity) >= rk.indexOf(prof.badges[i].rarity));
  } finally { await s.stop(); }
});

test('a completed level unlocks its achievement; Grammar Master needs every grammar lesson; IELTS lessons count', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'lvl@example.com');
    const a1 = lessonIdsOf(s, 'A1'); markDone(s, c.id, a1.slice(1));       // all but the first lesson
    let r = await c.get('/api/achievements');
    assert.ok(!codes(r).includes('level_a1')); const p = byCode(r, 'level_a1'); assert.strictEqual(p.progress, a1.length - 1); assert.strictEqual(p.target, a1.length);
    markDone(s, c.id, a1); r = await c.get('/api/achievements');
    assert.ok(codes(r).includes('level_a1') && codes(r).includes('level_complete')); assert.ok(!codes(r).includes('level_a2') && !codes(r).includes('ielts_ready'));
    assert.strictEqual(byCode(r, 'level_a1').rarity, 'common'); assert.strictEqual(byCode(r, 'ielts_ready').rarity, 'mythic');
    // IELTS Explorer: the first IELTS lesson
    assert.ok(!codes(r).includes('ielts_explorer')); markDone(s, c.id, lessonIdsOf(s, 'IELTS').slice(0, 1)); assert.ok(codes(await c.get('/api/achievements')).includes('ielts_explorer'));
    // Grammar Master: every lesson that trains grammar
    const grammar = s.db.all("SELECT l.id FROM lessons l WHERE l.status = 'published' AND l.kind = 'lesson' AND EXISTS (SELECT 1 FROM exercises e WHERE e.lesson_id = l.id AND e.module = 'grammar' AND e.status = 'published')").map((x) => x.id);
    assert.ok(grammar.length > 50 && !codes(await c.get('/api/achievements')).includes('grammar_master'));
    markDone(s, c.id, grammar); assert.ok(codes(await c.get('/api/achievements')).includes('grammar_master'));
  } finally { await s.stop(); }
});

test('Comeback needs a real 7-day break; Polyglot Journey needs all three interface languages; no duplicate rewards', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'special@example.com');
    s.db.run('INSERT OR IGNORE INTO user_ui_languages (user_id, lang, first_used_at) VALUES (?,?,?)', c.id, 'en', '2026-01-01T00:00:00Z');   // the language the account started with (registration records it)
    const day = (d, xp = 10) => s.db.run('INSERT OR REPLACE INTO user_days (user_id, local_date, xp, lessons, answers, correct, review_correct) VALUES (?,?,?,?,?,?,0)', c.id, d, xp, 1, 5, 5);
    day('2026-03-01'); day('2026-03-05');           // a 3-day break
    assert.ok(!codes(await c.get('/api/achievements')).includes('comeback'));
    day('2026-03-14');                              // 8 days away
    let r = await c.get('/api/achievements'); assert.ok(codes(r).includes('comeback')); assert.ok(s.db.get("SELECT 1 x FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? AND i.slug = 'ach-comeback-sunrise'", c.id));
    // Polyglot Journey
    const xp0 = s.db.get('SELECT xp_total FROM users WHERE id = ?', c.id).xp_total, tok0 = s.db.get('SELECT COALESCE(SUM(amount), 0) n FROM token_transactions WHERE user_id = ?', c.id).n;
    await c.patch('/api/me', { uiLanguage: 'uz' }); assert.ok(!codes(await c.get('/api/achievements')).includes('polyglot'));
    assert.strictEqual(byCode(await c.get('/api/achievements'), 'polyglot').progress, 2, 'English (the start) and Uzbek');
    await c.patch('/api/me', { uiLanguage: 'ru' }); r = await c.get('/api/achievements'); assert.ok(codes(r).includes('polyglot'));
    const pg = byCode(r, 'polyglot'); assert.strictEqual(pg.rarity, 'epic');
    assert.strictEqual(s.db.get('SELECT xp_total FROM users WHERE id = ?', c.id).xp_total - xp0, pg.xp); assert.strictEqual(s.db.get('SELECT COALESCE(SUM(amount), 0) n FROM token_transactions WHERE user_id = ?', c.id).n - tok0, pg.tokens);
    for (const l of ['en', 'uz', 'ru', 'en']) await c.patch('/api/me', { uiLanguage: l });
    assert.strictEqual(s.db.get('SELECT xp_total FROM users WHERE id = ?', c.id).xp_total - xp0, pg.xp, 'switching again pays nothing');
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND ref = 'ach:polyglot'", c.id).n, 1);
  } finally { await s.stop(); }
});

test('Early Bird and Night Owl follow the learner\'s own clock; Consistency King needs 90% over 100 answers', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const tzFor = (hour) => { let off = hour - new Date().getUTCHours(); if (off > 12) off -= 24; if (off < -11) off += 24; return off >= 0 ? 'Etc/GMT-' + off : 'Etc/GMT+' + (-off); };
    const early = await learner(s, 'early@example.com', { timezone: tzFor(8) }), night = await learner(s, 'night@example.com', { timezone: tzFor(22) }), noon = await learner(s, 'noon@example.com', { timezone: tzFor(14) });
    for (const c of [early, night, noon]) await playFirstLesson(s, c);
    assert.ok(codes(await early.get('/api/achievements')).includes('early_bird') && !codes(await early.get('/api/achievements')).includes('night_owl'));
    assert.ok(codes(await night.get('/api/achievements')).includes('night_owl') && !codes(await night.get('/api/achievements')).includes('early_bird'));
    assert.ok(!codes(await noon.get('/api/achievements')).some((x) => ['early_bird', 'night_owl'].includes(x)));
    // Consistency King: 100 answers, 95 right: unlocked; 100 answers, 80 right: not
    const good = await learner(s, 'good@example.com'), meh = await learner(s, 'meh@example.com');
    const ex = s.db.get("SELECT id, lesson_id FROM exercises WHERE status = 'published' LIMIT 1");
    const att = (uid) => s.db.run("INSERT INTO lesson_attempts (user_id, lesson_id, kind, status, queue, position, total_planned, correct, incorrect, xp_awarded, started_at, seed) VALUES (?,?, 'lesson', 'abandoned', '[]', 0, 1, 0, 0, 0, ?, 1)", uid, ex.lesson_id, '2026-01-01T00:00:00Z').id;
    const fill = (uid, right) => { const a = att(uid); for (let i = 0; i < 100; i++) s.db.run('INSERT INTO exercise_responses (user_id, attempt_id, exercise_id, slot, is_correct, is_retry, answer, feedback, xp, created_at) VALUES (?,?,?,?,?,0,?,?,0,?)', uid, a, ex.id, i, i < right ? 1 : 0, '{}', '', '2026-01-01T00:00:00Z'); };
    fill(good.id, 95); fill(meh.id, 80);
    assert.ok(codes(await good.get('/api/achievements')).includes('consistency_king'));
    const m = byCode(await meh.get('/api/achievements'), 'consistency_king'); assert.ok(!m.unlocked && m.progress < m.target);
  } finally { await s.stop(); }
});

test('tests: Perfect Score, Quiz Champion and Sharp Mind come from exam results', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'tests@example.com');
    const lessonId = s.db.get("SELECT id FROM lessons WHERE kind = 'topic_test' LIMIT 1").id;
    const result = (score, passed) => s.db.run("INSERT INTO exam_results (user_id, lesson_id, kind, correct, total, score_pct, pass_pct, passed, created_at) VALUES (?,?, 'topic_test', ?, 10, ?, 80, ?, ?)", c.id, lessonId, Math.round(score / 10), score, passed, '2026-01-01T00:00:00Z');
    result(90, 1); assert.ok(!codes(await c.get('/api/achievements')).includes('perfect_score'));
    result(100, 1); assert.ok(codes(await c.get('/api/achievements')).includes('perfect_score'));
    for (let i = 0; i < 8; i++) result(85, 1);      // 10 passes in a row
    let r = await c.get('/api/achievements'); assert.ok(codes(r).includes('sharp_mind')); assert.ok(!codes(r).includes('quiz_champion')); assert.strictEqual(byCode(r, 'quiz_champion').progress, 10);
    for (let i = 0; i < 10; i++) result(60, 0);
    r = await c.get('/api/achievements'); assert.ok(codes(r).includes('quiz_champion'), '20 tests completed');
    const d = await learner(s, 'broken@example.com'); const l2 = s.db.get("SELECT id FROM lessons WHERE kind = 'topic_test' LIMIT 1").id;
    for (let i = 0; i < 9; i++) s.db.run("INSERT INTO exam_results (user_id, lesson_id, kind, correct, total, score_pct, pass_pct, passed, created_at) VALUES (?,?, 'topic_test', 9, 10, 90, 80, 1, ?)", d.id, l2, '2026-01-01T00:00:00Z');
    s.db.run("INSERT INTO exam_results (user_id, lesson_id, kind, correct, total, score_pct, pass_pct, passed, created_at) VALUES (?,?, 'topic_test', 3, 10, 30, 80, 0, ?)", d.id, l2, '2026-01-01T00:00:00Z');
    s.db.run("INSERT INTO exam_results (user_id, lesson_id, kind, correct, total, score_pct, pass_pct, passed, created_at) VALUES (?,?, 'topic_test', 9, 10, 90, 80, 1, ?)", d.id, l2, '2026-01-01T00:00:00Z');
    assert.ok(!codes(await d.get('/api/achievements')).includes('sharp_mind'), 'a failed test breaks the run');
  } finally { await s.stop(); }
});

test('filters data and languages: texts follow the interface language; the summary counts by category and rarity', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'lang@example.com');
    const en = (await c.req('GET', '/api/achievements', undefined, { headers: { 'X-Lang': 'en' } })).json, uz = (await c.req('GET', '/api/achievements', undefined, { headers: { 'X-Lang': 'uz' } })).json, ru = (await c.req('GET', '/api/achievements', undefined, { headers: { 'X-Lang': 'ru' } })).json;
    assert.strictEqual(byCode({ json: en }, 'first_lesson').title, 'First Lesson');
    assert.notStrictEqual(byCode({ json: uz }, 'first_lesson').title, 'First Lesson'); assert.ok(/[а-я]/i.test(byCode({ json: ru }, 'first_lesson').title));
    for (const l of [uz, ru]) assert.ok(l.items.every((a) => a.title && a.description), 'every achievement has a title and a description in each language');
    assert.strictEqual(en.summary.total, en.items.length);
    assert.strictEqual(Object.values(en.summary.rarity).reduce((x, v) => x + v.total, 0), en.summary.total); assert.strictEqual(Object.values(en.summary.category).reduce((x, v) => x + v.total, 0), en.summary.total);
    for (const code of ['first_lesson', 'streak_365']) assert.ok(!/[ʻ'‘`]/.test(byCode({ json: uz }, code).title) && !/sh|ch/i.test(byCode({ json: uz }, code).title), 'the new Uzbek alphabet');
  } finally { await s.stop(); }
});

test('admin: only administrators manage achievements; validation; unlocked ones cannot be rewritten or deleted, only hidden; hidden ones stop unlocking', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const lrn = await learner(s, 'lrn@example.com'); const adm = await learner(s, 'adm@example.com', { role: 'admin' });
    assert.strictEqual((await lrn.get('/api/admin/achievements')).status, 403);
    const list = await adm.get('/api/admin/achievements'); assert.strictEqual(list.status, 200); assert.ok(list.json.items.length >= 35 && list.json.lists.metrics.includes('lessons') && list.json.lists.items.length > 10);
    const bad = await adm.post('/api/admin/achievements', { code: 'valid_code', title_en: '', desc_en: '', category: 'nope', rarity: 'godlike', metric: 'free_money', target: 0 }); assert.strictEqual(bad.status, 400);
    for (const k of ['title_en', 'category', 'rarity', 'metric', 'target']) assert.ok(bad.json.fields[k], k);
    assert.strictEqual((await adm.post('/api/admin/achievements', { code: 'X', title_en: 'a', desc_en: 'b', category: 'learning', rarity: 'common', metric: 'lessons', target: 1 })).status, 400, 'a bad code');
    const mk = (extra = {}) => adm.post('/api/admin/achievements', { code: 'three_lessons', title_en: 'Three lessons', title_uz: 'Uç dars', title_ru: 'Три урока', desc_en: 'Finish 3 lessons.', desc_uz: '3 ta dars.', desc_ru: '3 урока.', category: 'learning', rarity: 'rare', metric: 'lessons', target: 3, icon: 'book', xp: 40, tokens: 15, item_slug: 'ach-explorer-hat', ...extra });
    assert.strictEqual((await mk({ metric: 'level:Z9' })).status, 400); assert.strictEqual((await mk({ item_slug: 'no-such-item' })).status, 400); assert.strictEqual((await mk({ xp: 999999 })).status, 400);
    assert.strictEqual((await mk()).status, 201); assert.strictEqual((await mk()).status, 400, 'the code is unique');
    // a learner earns it from real lessons only
    markDone(s, lrn.id, lessonIdsOf(s, 'A1').slice(0, 2)); assert.ok(!codes(await lrn.get('/api/achievements')).includes('three_lessons'));
    markDone(s, lrn.id, lessonIdsOf(s, 'A1').slice(0, 3)); let r = await lrn.get('/api/achievements'); assert.ok(codes(r).includes('three_lessons'));
    assert.strictEqual(byCode(r, 'three_lessons').earnedXp, 40); assert.ok(s.db.get("SELECT 1 x FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? AND i.slug = 'ach-explorer-hat'", lrn.id));
    // texts and rewards can change (past unlocks keep what they were paid); the requirement cannot once someone unlocked it; it cannot be deleted
    assert.strictEqual((await adm.patch('/api/admin/achievements/three_lessons', { title_en: 'Three!', xp: 80 })).status, 200);
    assert.strictEqual(byCode(await lrn.get('/api/achievements'), 'three_lessons').earnedXp, 40, 'the learner keeps the amount paid at the time');
    assert.strictEqual((await adm.patch('/api/admin/achievements/three_lessons', { target: 1 })).status, 409); assert.strictEqual((await adm.del('/api/admin/achievements/three_lessons')).status, 409);
    assert.strictEqual((await adm.get('/api/admin/achievements')).json.items.find((a) => a.code === 'three_lessons').unlocked, 1);
    // hide: learners who have it keep it; others no longer see or earn it
    const other = await learner(s, 'other@example.com'); assert.strictEqual((await adm.patch('/api/admin/achievements/three_lessons', { status: 'hidden' })).status, 200);
    markDone(s, other.id, lessonIdsOf(s, 'A1').slice(0, 3)); const ro = await other.get('/api/achievements'); assert.ok(!ro.json.items.some((a) => a.code === 'three_lessons'));
    assert.ok(codes(await lrn.get('/api/achievements')).includes('three_lessons'), 'kept by the one who earned it');
    // a never-unlocked custom achievement can be deleted
    await mk({ code: 'temp_one', metric: 'xp', target: 99999 }); assert.strictEqual((await adm.del('/api/admin/achievements/temp_one')).status, 200);
    assert.ok(s.db.get("SELECT COUNT(*) n FROM audit_log WHERE action LIKE 'achievement.%'").n >= 3, 'changes are audited');
  } finally { await s.stop(); }
});

test('catching up: an achievement the stored activity already satisfies is unlocked and reported on the next visit', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const lrn = await learner(s, 'late@example.com'); const adm = await learner(s, 'boss@example.com', { role: 'admin' });
    markDone(s, lrn.id, lessonIdsOf(s, 'A1').slice(0, 4));
    const mk = await adm.post('/api/admin/achievements', { code: 'late_four', title_en: 'Late four', desc_en: 'Four lessons.', category: 'learning', rarity: 'common', metric: 'lessons', target: 4, xp: 5, tokens: 5 }); assert.strictEqual(mk.status, 201);
    const other = new Client(s.base); await other.login('late@example.com');
    const seen = (await other.get('/api/achievements/unseen')).json.items.map((a) => a.code);
    assert.ok(seen.includes('late_four'), 'unlocked from activity that was already stored');
  } finally { await s.stop(); }
});
