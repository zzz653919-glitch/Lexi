const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client, answerFor, playAttempt } = require('./helpers');
const { localDate, addDays } = require('../../server/lib/util');

async function learner(s, email = 'l@example.com', extra = {}) {
  s.createUser({ email, ...extra });
  const c = new Client(s.base); await c.login(email); return c;
}
const flat = (path) => path.levels.flatMap((lv) => lv.units.flatMap((u) => u.lessons.map((l) => ({ ...l, level: lv.code }))));

test('the path locks later lessons and levels', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    const p = (await c.get('/api/path')).json;
    assert.deepStrictEqual(p.levels.map((l) => l.code), ['A1', 'A2', 'B1', 'B2', 'C1']);
    const lessons = flat(p);
    assert.strictEqual(lessons[0].state, 'available');
    assert.strictEqual(lessons[1].state, 'locked'); assert.strictEqual(lessons[1].lockReason.key, 'path.lock_lesson'); assert.ok(lessons[1].lockReason.params.title.includes('Greetings'));
    assert.strictEqual(p.levels[1].unlocked, false);
    assert.strictEqual(p.recommended.title, 'Greetings');
    const locked = await c.post(`/api/lessons/${lessons[1].id}/start`);
    assert.strictEqual(locked.status, 403, 'a locked lesson cannot be started');
    const unknown = await c.post('/api/lessons/99999/start'); assert.strictEqual(unknown.status, 404);
  } finally { await s.stop(); }
});

test('a lesson can be played to the end: server-side XP, progress, unlocking', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    const first = flat((await c.get('/api/path')).json)[0];
    let st = (await c.post(`/api/lessons/${first.id}/start`)).json;
    assert.strictEqual(st.status, 'in_progress'); assert.strictEqual(st.exercise.type, 'translation_choice');
    const json = JSON.stringify(st);
    assert.ok(!/is_correct|"answer"|correctAnswer/.test(json), 'the exercise payload never contains the answer');
    const { state, answered } = await playAttempt(c, st, s.db);
    assert.strictEqual(state.status, 'completed'); assert.strictEqual(answered, 12);
    const r = state.result;
    assert.strictEqual(r.correct, 12); assert.strictEqual(r.incorrect, 0); assert.strictEqual(r.accuracy, 100);
    assert.strictEqual(r.xp, 12 * 10 + 20 + 10, '10 XP per right answer + lesson bonus 20 + perfect bonus 10');
    const u = s.db.get('SELECT xp_total FROM users WHERE email = ?', 'l@example.com');
    assert.strictEqual(u.xp_total, 150, 'the stored total matches the transactions');
    assert.strictEqual(s.db.get('SELECT SUM(amount) n FROM xp_transactions').n, 150);
    const p2 = (await c.get('/api/path')).json;
    assert.strictEqual(flat(p2)[0].state, 'completed'); assert.strictEqual(flat(p2)[1].state, 'available', 'the next lesson unlocks');
    const dash = (await c.get('/api/dashboard')).json;
    assert.strictEqual(dash.today.xp, 150); assert.strictEqual(dash.streak.current, 1); assert.strictEqual(dash.lessons.done, 1);
    assert.ok(dash.achievements.length >= 3, 'achievements were earned');
  } finally { await s.stop(); }
});

test('double submissions never pay XP twice and are answered idempotently', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    const first = flat((await c.get('/api/path')).json)[0];
    const st = (await c.post(`/api/lessons/${first.id}/start`)).json;
    const body = { exerciseId: st.exercise.id, answer: answerFor(s.db, st) };
    const [a, b, d] = await Promise.all([c.post(`/api/attempts/${st.attemptId}/answer`, body), c.post(`/api/attempts/${st.attemptId}/answer`, body), c.post(`/api/attempts/${st.attemptId}/answer`, body)]);
    assert.ok([a, b, d].every((r) => r.status === 200), JSON.stringify([a.json, b.json, d.json]));
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exercise_responses').n, 1, 'one response stored');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM xp_transactions').n, 1, 'one payout');
    assert.strictEqual(s.db.get('SELECT xp_total FROM users WHERE email = ?', 'l@example.com').xp_total, 10);
    assert.strictEqual([a, b, d].filter((r) => r.json.feedback.replayed).length, 2, 'the repeats are flagged as replays');
    const again = await c.post(`/api/attempts/${st.attemptId}/answer`, body);
    assert.strictEqual(again.json.feedback.xp, 10, 'the stored feedback is returned unchanged');
    assert.strictEqual(s.db.get('SELECT xp_total FROM users WHERE email = ?', 'l@example.com').xp_total, 10);
    // answering an exercise that is not the current one is refused
    const bogus = await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: 999999, answer: 1 });
    assert.strictEqual(bogus.status, 409);
    // another learner cannot touch this attempt
    const other = await learner(s, 'other@example.com');
    assert.strictEqual((await other.post(`/api/attempts/${st.attemptId}/answer`, body)).status, 404);
    assert.strictEqual((await other.get(`/api/attempts/${st.attemptId}`)).status, 404);
  } finally { await s.stop(); }
});

test('wrong answers cost hearts, come back once and lower accuracy; progress survives a reload', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    const first = flat((await c.get('/api/path')).json)[0];
    let st = (await c.post(`/api/lessons/${first.id}/start`)).json;
    assert.strictEqual(st.hearts, 5);
    const r1 = await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: answerFor(s.db, st, true) });
    assert.strictEqual(r1.json.feedback.correct, false); assert.strictEqual(r1.json.feedback.xp, 0);
    assert.ok(r1.json.feedback.correctAnswer, 'the correct answer is shown after a mistake');
    assert.strictEqual(r1.json.state.hearts, 4);
    assert.strictEqual(r1.json.state.queueLength, 13, 'the missed exercise is queued once more');
    // "reload": a new start call resumes the very same attempt
    const resumed = (await c.post(`/api/lessons/${first.id}/start`)).json;
    assert.strictEqual(resumed.attemptId, st.attemptId); assert.strictEqual(resumed.position, 1);
    assert.strictEqual(resumed.exercise.id, r1.json.state.exercise.id);
    const done = await playAttempt(c, r1.json.state, s.db);
    assert.strictEqual(done.state.status, 'completed');
    const res = done.state.result;
    assert.strictEqual(res.incorrect, 1); assert.strictEqual(res.correct, 11); assert.strictEqual(res.accuracy, 92);
    assert.strictEqual(res.xp, 11 * 10 + 5 + 20, '11 right first time, 1 right retry (5), lesson bonus, no perfect bonus');
    assert.strictEqual(res.mistakes.length, 1);
    assert.ok(res.words.length >= 1, 'words to review are listed');
    assert.ok(s.db.get('SELECT COUNT(*) n FROM review_items').n >= 1, 'the missed word joined the review schedule');
    // the same lesson can be repeated: XP is paid again for the new attempt, progress keeps the best accuracy
    const again = (await c.post(`/api/lessons/${first.id}/start`)).json; assert.notStrictEqual(again.attemptId, st.attemptId);
    await playAttempt(c, again, s.db);
    const prog = s.db.get('SELECT * FROM user_progress'); assert.strictEqual(prog.completions, 2); assert.strictEqual(prog.best_accuracy, 100);
  } finally { await s.stop(); }
});

test('running out of hearts stops the lesson; hearts regenerate over time; nothing is completed', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    const first = flat((await c.get('/api/path')).json)[0];
    let st = (await c.post(`/api/lessons/${first.id}/start`)).json;
    let r;
    for (let i = 0; i < 5; i++) { r = await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: answerFor(s.db, st, true) }); st = r.json.state; }
    assert.strictEqual(st.status, 'out_of_hearts'); assert.strictEqual(st.result.outcome, 'out_of_hearts');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM user_progress').n, 0, 'an unfinished lesson is not marked complete');
    const blocked = await c.post(`/api/lessons/${first.id}/start`);
    assert.strictEqual(blocked.status, 403); assert.ok(blocked.json.nextHeartAt);
    // 31 minutes later one heart is back
    s.db.run('UPDATE users SET hearts_updated_at = ?', new Date(Date.now() - 31 * 60000).toISOString());
    const stats = (await c.get('/api/me/stats')).json; assert.strictEqual(stats.hearts.hearts, 1);
    const ok = await c.post(`/api/lessons/${first.id}/start`); assert.strictEqual(ok.status, 200);
  } finally { await s.stop(); }
});

test('the mistakes review contains only exercises that were answered wrongly', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    assert.strictEqual((await c.post('/api/practice/mistakes')).status, 409, 'nothing to review yet');
    const first = flat((await c.get('/api/path')).json)[0];
    const st = (await c.post(`/api/lessons/${first.id}/start`)).json;
    await playAttempt(c, st, s.db, { wrongAt: new Set([2, 5]) });
    const m = await c.post('/api/practice/mistakes'); assert.strictEqual(m.status, 200);
    assert.strictEqual(m.json.kind, 'mistakes'); assert.strictEqual(m.json.totalPlanned, 2);
    const missed = s.db.all('SELECT DISTINCT exercise_id FROM exercise_responses WHERE is_correct = 0 AND is_retry = 0').map((x) => x.exercise_id);
    const queue = JSON.parse(s.db.get('SELECT queue FROM lesson_attempts WHERE id = ?', m.json.attemptId).queue);
    assert.deepStrictEqual(queue.slice().sort(), missed.slice().sort());
    const xpBefore = s.db.get('SELECT xp_total FROM users WHERE email = ?', 'l@example.com').xp_total;
    const done = await playAttempt(c, m.json, s.db);
    assert.strictEqual(done.state.status, 'completed');
    assert.strictEqual(s.db.get('SELECT xp_total FROM users WHERE email = ?', 'l@example.com').xp_total - xpBefore, 2 * 5, 'mistakes review pays the smaller configured XP');
    assert.strictEqual(s.db.get('SELECT hearts FROM users').hearts <= 5, true);
    assert.strictEqual((await c.post('/api/practice/mistakes')).status, 409, 'corrected mistakes are gone');
  } finally { await s.stop(); }
});

test('administrator prerequisite and open rules change unlocking', async () => {
  const s = await startServer();
  try {
    const c = await learner(s);
    const lessons = flat((await c.get('/api/path')).json);
    // make the 3rd lesson "open" and the 2nd depend on the 3rd
    s.db.run("UPDATE lessons SET unlock_rule = 'open' WHERE id = ?", lessons[2].id);
    s.db.run("UPDATE lessons SET unlock_rule = 'prerequisite', prerequisite_lesson_id = ? WHERE id = ?", lessons[2].id, lessons[1].id);
    let p = flat((await c.get('/api/path')).json);
    assert.strictEqual(p[2].state, 'available'); assert.strictEqual(p[1].state, 'locked');
    const st = (await c.post(`/api/lessons/${lessons[2].id}/start`)).json;
    await playAttempt(c, st, s.db);
    p = flat((await c.get('/api/path')).json);
    assert.strictEqual(p[1].state, 'available', 'finishing the prerequisite opens the lesson');
  } finally { await s.stop(); }
});

test('the start level opens earlier levels; a level opens when the previous one is far enough along', async () => {
  const s = await startServer();
  try {
    const c = await learner(s, 'b1@example.com');
    await c.patch('/api/me', { startLevel: 'B1' });
    const p = (await c.get('/api/path')).json;
    assert.ok(p.levels.slice(0, 3).every((l) => l.unlocked), 'A1, A2 and B1 are open for a learner who starts at B1');
    assert.strictEqual(p.levels[3].unlocked, false);
    assert.strictEqual(flat(p).find((l) => l.level === 'B1').state, 'available');
    const c2 = await learner(s, 'a1@example.com');
    s.db.run("UPDATE levels SET unlock_threshold_pct = 50 WHERE code = 'A2'");
    // finish 3 of the 6 A1 lessons by marking progress directly
    const uid = s.db.get("SELECT id FROM users WHERE email = 'a1@example.com'").id;
    const a1 = flat((await c2.get('/api/path')).json).filter((l) => l.level === 'A1');
    for (const l of a1.slice(0, 3)) s.db.run('INSERT INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) VALUES (?,?,1,100,?,?)', uid, l.id, 'x', 'x');
    assert.strictEqual((await c2.get('/api/path')).json.levels[1].unlocked, true, '50% of A1 done opens A2');
  } finally { await s.stop(); }
});
