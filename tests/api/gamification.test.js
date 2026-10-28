const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client, answerFor, playAttempt } = require('./helpers');
const { localDate, addDays } = require('../../server/lib/util');

async function learner(s, email, extra = {}) { const id = s.createUser({ email, ...extra }); const c = new Client(s.base); await c.login(email); c.uid = id; return c; }
const lessonsOf = (path) => path.levels.flatMap((lv) => lv.units.flatMap((u) => u.lessons));
async function finishNext(s, c) {
  const l = lessonsOf((await c.get('/api/path')).json).find((x) => x.state === 'available');
  const st = (await c.post(`/api/lessons/${l.id}/start`)).json;
  return (await playAttempt(c, st, s.db)).state;
}

test('streak: counts consecutive local days, resets after a gap, never double counts a day', async () => {
  const s = await startServer();
  try {
    const c = await learner(s, 'st@example.com');
    const today = localDate(new Date(), 'UTC');
    await finishNext(s, c);
    let st = s.db.get('SELECT * FROM user_streaks WHERE user_id = ?', c.uid);
    assert.strictEqual(st.current_streak, 1); assert.strictEqual(st.last_active_date, today);
    // a second lesson on the same day does not change the streak
    await finishNext(s, c);
    assert.strictEqual(s.db.get('SELECT current_streak FROM user_streaks WHERE user_id = ?', c.uid).current_streak, 1);
    // yesterday's activity + today -> 2
    s.db.run('UPDATE user_streaks SET last_active_date = ?, current_streak = 4 WHERE user_id = ?', addDays(today, -1), c.uid);
    await finishNext(s, c);
    st = s.db.get('SELECT * FROM user_streaks WHERE user_id = ?', c.uid); assert.strictEqual(st.current_streak, 5); assert.strictEqual(st.longest_streak, 5);
    // a gap of two days resets it (and the dashboard already shows 0 before the next lesson)
    s.db.run('UPDATE user_streaks SET last_active_date = ? WHERE user_id = ?', addDays(today, -2), c.uid);
    assert.strictEqual((await c.get('/api/dashboard')).json.streak.current, 0, 'a broken streak is shown as 0');
    await finishNext(s, c);
    st = s.db.get('SELECT * FROM user_streaks WHERE user_id = ?', c.uid); assert.strictEqual(st.current_streak, 1); assert.strictEqual(st.longest_streak, 5, 'the longest streak is kept');
  } finally { await s.stop(); }
});

test('days follow the learner’s own time zone', async () => {
  const s = await startServer();
  try {
    const east = await learner(s, 'east@example.com', { timezone: 'Pacific/Kiritimati' });
    const west = await learner(s, 'west@example.com', { timezone: 'Pacific/Pago_Pago' });
    await finishNext(s, east); await finishNext(s, west);
    const e = s.db.get('SELECT local_date FROM user_days WHERE user_id = ?', east.uid).local_date, w = s.db.get('SELECT local_date FROM user_days WHERE user_id = ?', west.uid).local_date;
    assert.strictEqual(e, localDate(new Date(), 'Pacific/Kiritimati')); assert.strictEqual(w, localDate(new Date(), 'Pacific/Pago_Pago'));
    assert.notStrictEqual(e, w, 'UTC+14 and UTC-11 are always on different calendar days');
    assert.strictEqual(s.db.get('SELECT last_active_date d FROM user_streaks WHERE user_id = ?', east.uid).d, e);
  } finally { await s.stop(); }
});

test('uncompleted activity earns no completion bonus and no streak day', async () => {
  const s = await startServer();
  try {
    const c = await learner(s, 'half@example.com');
    const l = lessonsOf((await c.get('/api/path')).json)[0];
    let st = (await c.post(`/api/lessons/${l.id}/start`)).json;
    for (let i = 0; i < 5; i++) { const r = await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: answerFor(s.db, st) }); st = r.json.state; }
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM user_streaks').n, 0, 'no streak without a finished lesson');
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM xp_transactions WHERE reason IN ('lesson_complete','perfect_bonus')").n, 0);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM user_progress').n, 0);
    assert.strictEqual((await c.get('/api/dashboard')).json.today.xp, 50, 'per-answer XP is earned, bonuses are not');
  } finally { await s.stop(); }
});

test('daily goal and achievements are calculated from real records', async () => {
  const s = await startServer();
  try {
    const c = await learner(s, 'goal@example.com');
    await c.patch('/api/me', { dailyGoalXp: 40 });
    const d0 = (await c.get('/api/dashboard')).json; assert.strictEqual(d0.today.goalMet, false); assert.strictEqual(d0.achievements.length, 0);
    await finishNext(s, c);
    const d1 = (await c.get('/api/dashboard')).json; assert.strictEqual(d1.today.goalMet, true); assert.strictEqual(d1.today.xp, 150);
    const a = (await c.get('/api/achievements')).json.items; const got = a.filter((x) => x.earnedAt).map((x) => x.code);
    for (const code of ['first_lesson', 'perfect_lesson', 'xp_100', 'daily_goal']) assert.ok(got.includes(code), code);
    assert.ok(!got.includes('xp_500') && !got.includes('streak_7'));
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM user_achievements WHERE code = 'first_lesson'").n, 1, 'earned once');
    await finishNext(s, c);
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM user_achievements WHERE code = 'first_lesson'").n, 1);
  } finally { await s.stop(); }
});

test('leaderboard: opt-in only, no private data, weekly XP order', async () => {
  const s = await startServer();
  try {
    const a = await learner(s, 'a@example.com', { name: 'Alice' }), b = await learner(s, 'b@example.com', { name: 'Bob' }), hidden = await learner(s, 'h@example.com', { name: 'Hidden' });
    await finishNext(s, a); await finishNext(s, b); await finishNext(s, hidden);
    await finishNext(s, a); // Alice earns more
    await a.patch('/api/me', { leaderboardOptIn: true }); await b.patch('/api/me', { leaderboardOptIn: true });
    const lb = (await b.get('/api/leaderboard')).json;
    assert.deepStrictEqual(lb.items.map((x) => x.displayName), ['Alice', 'Bob']);
    assert.ok(lb.items[0].xp > lb.items[1].xp); assert.ok(lb.items.find((x) => x.displayName === 'Bob').you);
    const text = JSON.stringify(lb);
    assert.ok(!text.includes('@example.com') && !text.includes('Hidden') && !/"id"/.test(text), 'no e-mail addresses, ids or opted-out users');
    await b.patch('/api/me', { leaderboardOptIn: false });
    assert.deepStrictEqual((await a.get('/api/leaderboard')).json.items.map((x) => x.displayName), ['Alice'], 'leaving the leaderboard removes the learner');
    s.settings.update({ leaderboard_enabled: false });
    assert.strictEqual((await a.get('/api/leaderboard')).json.enabled, false, 'an administrator can turn it off');
  } finally { await s.stop(); }
});

test('vocabulary review: schedule, difficult words, server-side XP rules', async () => {
  const s = await startServer();
  try {
    const c = await learner(s, 'rev@example.com');
    assert.strictEqual((await c.get('/api/review/summary')).json.total, 0);
    await finishNext(s, c);       // the lesson's 6 words join the schedule, due tomorrow
    assert.strictEqual((await c.get('/api/review/summary')).json.total, 6);
    assert.strictEqual((await c.get('/api/review/summary')).json.due, 0, 'nothing is due until tomorrow');
    assert.strictEqual((await c.post('/api/review/session', { mode: 'choice' })).json.cards.length, 0);
    s.db.run("UPDATE review_items SET due_at = '2000-01-01T00:00:00.000Z'");
    const sess = (await c.post('/api/review/session', { mode: 'choice', size: 6 })).json;
    assert.strictEqual(sess.cards.length, 6);
    const card = sess.cards[0], v = s.db.get('SELECT * FROM vocabulary WHERE id = ?', card.vocabularyId);
    assert.ok(card.options.length >= 2 && !JSON.stringify(card).includes('"correct"'));
    const want = card.direction === 'uz-en' ? v.en : v.uz;
    const xp0 = s.db.get('SELECT xp_total n FROM users').n;
    let r = (await c.post('/api/review/answer', { vocabularyId: v.id, mode: 'choice', direction: card.direction, answer: want })).json;
    assert.ok(r.correct && r.xp === 2); assert.strictEqual(s.db.get('SELECT xp_total n FROM users').n, xp0 + 2);
    let item = s.db.get('SELECT * FROM review_items WHERE vocabulary_id = ?', v.id); assert.strictEqual(item.box, 1); assert.ok(item.due_at > new Date().toISOString());
    // the same word cannot pay again (it is not due any more)
    r = (await c.post('/api/review/answer', { vocabularyId: v.id, mode: 'choice', direction: card.direction, answer: want })).json; assert.strictEqual(r.xp, 0);
    // flashcards are self-graded: they move the schedule but never pay XP
    const v2 = s.db.get('SELECT * FROM vocabulary WHERE id = ?', sess.cards[1].vocabularyId);
    r = (await c.post('/api/review/answer', { vocabularyId: v2.id, mode: 'flashcards', answer: true })).json; assert.strictEqual(r.xp, 0); assert.ok(r.correct);
    // two wrong answers make a word "difficult" and it is asked first
    const v3 = s.db.get('SELECT * FROM vocabulary WHERE id = ?', sess.cards[2].vocabularyId);
    for (let i = 0; i < 2; i++) await c.post('/api/review/answer', { vocabularyId: v3.id, mode: 'typed', direction: 'en-uz', answer: 'qqq' });
    item = s.db.get('SELECT * FROM review_items WHERE vocabulary_id = ?', v3.id); assert.strictEqual(item.is_difficult, 1); assert.strictEqual(item.lapses, 2); assert.strictEqual(item.box, 0);
    s.db.run("UPDATE review_items SET due_at = '2000-01-01T00:00:00.000Z'");
    assert.strictEqual((await c.post('/api/review/session', { mode: 'typed', size: 3 })).json.cards[0].vocabularyId, v3.id, 'difficult words come first');
    // manual flag
    assert.strictEqual((await c.post(`/api/vocabulary/${v2.id}/difficult`, { difficult: true })).json.difficult >= 2, true);
    const list = (await c.get('/api/vocabulary?filter=difficult')).json; assert.ok(list.items.every((w) => w.difficult));
    assert.strictEqual((await c.post('/api/review/answer', { vocabularyId: 999999, mode: 'typed', answer: 'x' })).status, 404);
  } finally { await s.stop(); }
});

test('review XP is capped per day', async () => {
  const s = await startServer();
  try {
    s.settings.update({ xp_review_daily_cap: 4 });
    const c = await learner(s, 'cap@example.com');
    await finishNext(s, c);
    s.db.run("UPDATE review_items SET due_at = '2000-01-01T00:00:00.000Z'");
    let total = 0;
    for (const w of s.db.all('SELECT v.* FROM vocabulary v JOIN review_items r ON r.vocabulary_id = v.id')) {
      const r = await c.post('/api/review/answer', { vocabularyId: w.id, mode: 'typed', direction: 'en-uz', answer: w.uz.split(/[;,\/]/)[0] }); total += r.json.xp;
    }
    assert.strictEqual(total, 4);
  } finally { await s.stop(); }
});

test('vocabulary list is searchable, paginated and filterable', async () => {
  const s = await startServer();
  try {
    const c = await learner(s, 'v@example.com');
    const all = (await c.get('/api/vocabulary?pageSize=10')).json;
    assert.ok(all.total >= 60 && all.items.length === 10);
    const q = (await c.get('/api/vocabulary?q=hello')).json; assert.ok(q.items.some((w) => w.en === 'hello'));
    assert.strictEqual((await c.get('/api/vocabulary?q=%25')).json.total, 0, 'wildcards are escaped, not interpreted');
    assert.strictEqual((await c.get("/api/vocabulary?q=' OR 1=1 --")).json.total, 0);
    assert.ok((await c.get('/api/vocabulary?filter=new')).json.total > 0);
  } finally { await s.stop(); }
});
