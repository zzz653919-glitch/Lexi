const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client } = require('./helpers');
const X = require('../../server/lib/exercises');

async function learner(s, email, level = 'A1') {
  const id = s.createUser({ email });
  s.db.run('UPDATE users SET cefr_level = ?, start_level = ? WHERE id = ?', level, ['A0', 'C2'].includes(level) ? (level === 'A0' ? 'A1' : 'C1') : level, id);
  const c = new Client(s.base); await c.login(email);
  return { c, id };
}
/* the correct answer of a daily item, read from the stored attempt (the browser never gets it) */
function dailyAnswer(s, state, wrong) {
  const a = s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', state.attemptId);
  const item = JSON.parse(a.queue)[state.position];
  if (item.type === 'card') return true;
  if (item.type === 'choice') return wrong ? item.options.find((o) => o.id !== item.correctId).id : item.correctId;
  if (item.type === 'order') { const ids = X.tokensOf(item.sentence).map((_, i) => i); return wrong ? ids.reverse() : ids; }
  return wrong ? 'qqqzzz' : X.alternatives(item.accepted)[0];
}
async function playDaily(s, c, { wrong = () => false } = {}) {
  let st = (await c.post('/api/daily/start')).json, n = 0;
  const seen = [];
  while (st.status === 'in_progress') {
    seen.push(st.exercise.type);
    const r = await c.post(`/api/daily/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: dailyAnswer(s, st, wrong(n++)) });
    assert.strictEqual(r.status, 200, r.text);
    st = r.json.state; if (r.json.celebrate) st.celebrate = r.json.celebrate;
    assert.ok(n < 80);
  }
  return { st, seen };
}

test('daily lesson: built for the level, mixes all phases, never sends answers, completes with XP once per day', async () => {
  const s = await startServer();
  try {
    const { c, id } = await learner(s, 'd1@example.com', 'A1');
    const first = (await c.post('/api/daily/start')).json;
    assert.strictEqual(first.kind, 'daily'); assert.ok(first.exercise);
    assert.ok(!/accepted|correctId|"ok"|is_correct/.test(JSON.stringify(first)), 'no answers in the payload');
    assert.strictEqual((await c.post('/api/daily/start')).json.attemptId, first.attemptId, 'resumes the open lesson');
    assert.strictEqual((await c.get('/api/daily/attempts/' + first.attemptId)).json.exercise.id, first.exercise.id);
    // the ordinary lesson endpoints cannot touch it
    assert.strictEqual((await c.get('/api/attempts/' + first.attemptId)).status, 404);
    const queue = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', first.attemptId).queue);
    const kinds = new Set(queue.map((i) => i.kind));
    for (const k of ['new', 'grammar', 'reading', 'quiz']) assert.ok(kinds.has(k), 'phase ' + k);
    assert.ok(queue.filter((i) => i.type !== 'card').length >= 12 && queue.length <= 40);
    assert.ok(queue.filter((i) => i.level).every((i) => i.level === 'A1' || i.kind === 'review'), 'items are for the learner level');
    const before = s.db.get('SELECT xp_total FROM users WHERE id = ?', id).xp_total;
    const { st } = await playDaily(s, c);
    assert.strictEqual(st.status, 'completed'); assert.strictEqual(st.result.accuracy, 100);
    const after = s.db.get('SELECT xp_total FROM users WHERE id = ?', id).xp_total;
    assert.ok(after > before);
    const dash = (await c.get('/api/dashboard')).json;
    assert.strictEqual(dash.daily.completedToday, true); assert.strictEqual(dash.learning.level, 'A1');
    // the second lesson of the day pays no second daily bonus
    const bonus = () => s.db.all("SELECT * FROM xp_transactions WHERE user_id = ? AND reason = 'daily_bonus'", id).length;
    await playDaily(s, c);
    assert.strictEqual(bonus(), 1);
    assert.ok(dash.streak.current >= 1, 'the daily lesson counts for the streak');
  } finally { await s.stop(); }
});

test('daily lesson: spaced repetition (taught words are scheduled, due words come back, wrong ones reset) and no re-teaching', async () => {
  const s = await startServer();
  try {
    const { c, id } = await learner(s, 'd2@example.com', 'A1');
    const first = await playDaily(s, c, { wrong: (n) => n === 3 });
    assert.strictEqual(first.st.status, 'completed');
    const newWords = JSON.parse(s.db.get("SELECT queue FROM lesson_attempts WHERE user_id = ? AND variant = 'daily' ORDER BY id LIMIT 1", id).queue).filter((i) => i.kind === 'new' && i.type === 'card').map((i) => i.vocabId);
    assert.ok(newWords.length >= 2);
    for (const v of newWords) assert.ok(s.db.get('SELECT 1 x FROM review_items WHERE user_id = ? AND vocabulary_id = ?', id, v), 'taught word is in the review schedule');
    // nothing is due yet, so the next lesson has no review phase and teaches different words
    const second = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', (await c.post('/api/daily/start')).json.attemptId).queue);
    const taught2 = second.filter((i) => i.kind === 'new' && i.type === 'card').map((i) => i.vocabId);
    assert.ok(taught2.every((v) => !newWords.includes(v)), 'already taught words are not taught again');
    // make a word due: it appears as a review item next time
    await c.post(`/api/daily/attempts/${(await c.get('/api/dashboard')).json.daily.inProgress.attemptId}/abandon`);
    s.db.run('UPDATE review_items SET due_at = ? WHERE user_id = ? AND vocabulary_id = ?', new Date(Date.now() - 1000).toISOString(), id, newWords[0]);
    const third = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', (await c.post('/api/daily/start')).json.attemptId).queue);
    assert.ok(third.some((i) => i.kind === 'review' && i.vocabId === newWords[0]));
    // grammar the learner has seen is rotated
    const g1 = JSON.parse(s.db.get("SELECT queue FROM lesson_attempts WHERE user_id = ? AND variant = 'daily' ORDER BY id LIMIT 1", id).queue).find((i) => i.kind === 'grammar').grammarId;
    assert.ok(s.db.get('SELECT seen FROM user_grammar WHERE user_id = ? AND grammar_id = ?', id, g1).seen >= 1);
    // wrong answers were recorded as skill evidence
    assert.ok(s.db.get("SELECT COUNT(*) n FROM skill_evidence WHERE user_id = ? AND source = 'daily' AND correct = 0", id).n >= 1);
  } finally { await s.stop(); }
});

test('daily lesson: lengths follow the profile setting; works for Pre-A1 and C2 learners; an unknown length is refused', async () => {
  const s = await startServer();
  try {
    for (const lvl of ['A0', 'C2']) {
      const { c } = await learner(s, `d-${lvl}@example.com`, lvl);
      const q = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', (await c.post('/api/daily/start')).json.attemptId).queue);
      assert.ok(q.filter((i) => i.type !== 'card').length >= 8, lvl);
    }
    const { c } = await learner(s, 'len@example.com', 'B1');
    assert.strictEqual((await c.patch('/api/me', { lessonLength: 'huge' })).status, 400);
    assert.strictEqual((await c.patch('/api/me', { lessonLength: 'short' })).status, 200);
    const short = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', (await c.post('/api/daily/start')).json.attemptId).queue).filter((i) => i.type !== 'card').length;
    await c.post(`/api/daily/attempts/${(await c.get('/api/daily/summary')).json.inProgress.attemptId}/abandon`);
    await c.patch('/api/me', { lessonLength: 'long' });
    const long = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', (await c.post('/api/daily/start')).json.attemptId).queue).filter((i) => i.type !== 'card').length;
    assert.ok(long > short, `${long} > ${short}`);
  } finally { await s.stop(); }
});

test('level adjustment: good results over enough lessons and days raise the level; thresholds, manual level and sparse data hold it back', async () => {
  const s = await startServer({ seedSample: false });
  try {
    const { c, id } = await learner(s, 'up@example.com', 'A2');
    const setPast = (days) => s.db.run('UPDATE users SET level_changed_at = ? WHERE id = ?', new Date(Date.now() - days * 86400000).toISOString(), id);
    const evidence = (n, ok, lvl = 'A2') => { for (let i = 0; i < n; i++) s.db.run("INSERT INTO skill_evidence (user_id, skill, level, correct, source, created_at) VALUES (?,?,?,?,?,?)", id, 'grammar', lvl, ok ? 1 : 0, 'lesson', new Date().toISOString()); };
    const lessons = (n) => { for (let i = 0; i < n; i++) s.db.run("INSERT INTO lesson_attempts (user_id, kind, variant, status, queue, started_at) VALUES (?,?,?,?,?,?)", id, 'lesson', 'daily', 'completed', '[]', new Date().toISOString()); };
    const run = () => s.learning.maybeLevelUp(id);
    setPast(30); evidence(10, true); lessons(10);
    assert.strictEqual(await run(), null, 'too little evidence: not enough answers');
    evidence(40, true);
    setPast(2);
    assert.strictEqual(await run(), null, 'not enough days at the level');
    setPast(30);
    s.db.run('DELETE FROM lesson_attempts WHERE user_id = ?', id);
    assert.strictEqual(await run(), null, 'not enough completed lessons');
    lessons(5);
    const up = await run();
    assert.deepStrictEqual(up, { from: 'A2', to: 'B1' });
    const u = s.db.get('SELECT cefr_level, level_source, start_level FROM users WHERE id = ?', id);
    assert.deepStrictEqual([u.cefr_level, u.level_source, u.start_level], ['B1', 'auto', 'B1']);
    assert.strictEqual((await c.get('/api/me/level')).json.history[0].source, 'auto');
    // a level change restarts the observation window
    assert.strictEqual(await run(), null);
    // weak results never lower the level automatically but recommend a retest
    s.db.run("DELETE FROM skill_evidence WHERE user_id = ?", id);
    setPast(30); evidence(25, false, 'B1');
    s.db.run("INSERT INTO assessments (user_id, status, started_at, completed_at, result_level) VALUES (?,?,?,?,?)", id, 'completed', new Date().toISOString(), new Date().toISOString(), 'B1');
    assert.strictEqual(await run(), null);
    assert.strictEqual(s.db.get('SELECT cefr_level FROM users WHERE id = ?', id).cefr_level, 'B1');
    const lv = (await c.get('/api/me/level')).json;
    assert.strictEqual(lv.recommendation.reassess, true); assert.strictEqual(lv.recommendation.reason, 'struggling');
    // an old test also recommends a retest
    s.db.run("DELETE FROM skill_evidence WHERE user_id = ?", id);
    s.db.run("UPDATE assessments SET completed_at = ? WHERE user_id = ?", new Date(Date.now() - 200 * 86400000).toISOString(), id);
    assert.strictEqual((await c.get('/api/me/level')).json.recommendation.reason, 'old');
    // automatic raising can be switched off in the settings
    s.createUser({ email: 'a@example.com', role: 'admin' }); const a = new Client(s.base); await a.login('a@example.com');
    await a.put('/api/admin/settings', { adapt_enabled: false });
    setPast(30); evidence(50, true); lessons(6);
    assert.strictEqual(await run(), null, 'disabled');
  } finally { await s.stop(); }
});

test('skill evidence from ordinary lessons and reviews updates the learner\'s skills', async () => {
  const s = await startServer();
  try {
    const { c, id } = await learner(s, 'ev@example.com', 'A1');
    const { playAttempt } = require('./helpers');
    const path = (await c.get('/api/path')).json;
    const lessonId = path.recommended.lessonId;
    const start = (await c.post(`/api/lessons/${lessonId}/start`)).json;
    await playAttempt(c, start, s.db, { wrongAt: new Set([1, 2, 3]) });
    const ev = s.db.all("SELECT skill, correct FROM skill_evidence WHERE user_id = ? AND source = 'lesson'", id);
    assert.ok(ev.length >= 8 && ev.some((e) => !e.correct) && ev.some((e) => e.correct));
    const skills = (await c.get('/api/me/level')).json.skills;
    assert.ok(skills.every((x) => ['vocabulary', 'grammar', 'reading', 'listening'].includes(x.skill)));
    assert.ok(skills.some((x) => x.samples > 0));
  } finally { await s.stop(); }
});

test('existing functionality is unaffected: lessons, review and profile still work for learners without a placement test', async () => {
  const s = await startServer();
  try {
    const { c } = await learner(s, 'old@example.com', 'A1');
    assert.ok((await c.get('/api/path')).json.levels.length >= 5);
    assert.strictEqual((await c.get('/api/me/profile')).status, 200);
    assert.strictEqual((await c.patch('/api/me', { startLevel: 'B2' })).status, 200);
    const lv = (await c.get('/api/me/level')).json;
    assert.strictEqual(lv.level, 'B2'); assert.strictEqual(lv.source, 'manual');
    assert.strictEqual((await c.patch('/api/me', { startLevel: 'Nope' })).status, 400);
    assert.strictEqual((await c.get('/api/review/summary')).status, 200);
  } finally { await s.stop(); }
});
