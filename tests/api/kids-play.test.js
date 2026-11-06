const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { startServer, Client } = require('./helpers');
const W = require('../../server/lib/kids-world');
const { STORIES } = require('../../server/seed/kids/stories');

async function kid(s, email = 'k@example.com') { s.createUser({ email }); const c = new Client(s.base); await c.login(email); await c.post('/api/me/mode', { mode: 'kids' }); return c; }

test('kids content: six stories with translations, questions and scenes', () => {
  assert.deepStrictEqual(STORIES.map((s) => s.slug), ['bunny', 'zoo', 'garden', 'school', 'puppy', 'moon']);
  for (const st of STORIES) {
    assert.ok(st.pages.length >= 6 && st.questions.length >= 2);
    for (const p of st.pages) { assert.ok(p.en && p.uz && p.ru && p.scene[0] && p.scene[1].length, st.slug); assert.ok(p.en.split(' ').length <= 10, 'simple sentences: ' + p.en); assert.doesNotMatch(p.uz, /[oOgG][‘ʻ'`]|sh|ch/i, p.uz); }
    for (const q of st.questions) { assert.strictEqual(q.options.length, 3); assert.doesNotMatch(q.uz, /[oOgG][‘ʻ'`]|sh|ch/i, q.uz); }
  }
  assert.strictEqual(W.GAMES.length, 8); assert.strictEqual(W.PLACES.length, 6); assert.strictEqual(W.MISSIONS.length, 5);
});

test('kids: companion, rewards that are earned (never bought), world, missions, games, stories', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await kid(s);
    const p = (await c.get('/api/kids/profile')).json;
    assert.strictEqual(p.character, 'lion'); assert.deepStrictEqual(p.unlocked.character.sort(), ['bunny', 'fox', 'lion']); assert.strictEqual(p.sound, true); assert.strictEqual(p.mic, false, 'the microphone is off by default'); assert.strictEqual(p.reminders, false);
    assert.strictEqual((await c.patch('/api/kids/profile', { character: 'robot' })).status, 400, 'locked characters cannot be chosen');
    assert.strictEqual((await c.patch('/api/kids/profile', { accessory: 'crown' })).status, 400);
    assert.strictEqual((await c.patch('/api/kids/profile', { character: 'fox' })).json.character, 'fox');
    assert.strictEqual((await c.get('/api/kids/overview')).json.character, 'fox');

    const cards = (await c.get('/api/kids/cards')).json.cards;
    assert.strictEqual(cards.length, 159); assert.ok(cards.every((x) => x.en && x.pic));

    // missions: nothing yet
    let m = (await c.get('/api/kids/missions')).json;
    assert.deepStrictEqual(m.missions.map((x) => x.code), ['words', 'lesson', 'game', 'listen', 'quiz']); assert.ok(m.missions.every((x) => x.have === 0 && !x.done));
    assert.strictEqual((await c.post('/api/kids/games/nope/complete', { correct: 1, total: 1 })).status, 404);
    assert.strictEqual((await c.post('/api/kids/games/memory/complete', { correct: 9, total: 3 })).status, 400);

    // a game: stars, new words, a sticker and the "play a game" mission
    const ids = cards.slice(0, 4).map((x) => x.id);
    const g = (await c.post('/api/kids/games/memory/complete', { correct: 4, total: 4, wordIds: ids, seconds: 90 })).json;
    assert.strictEqual(g.stars, 3); assert.strictEqual(g.gained, 3); assert.strictEqual(g.newWords, 4);
    assert.ok(g.newRewards.some((x) => x.kind === 'sticker' && x.code === 'game_memory'), 'first play earns a sticker');
    assert.ok(g.missions.find((x) => x.code === 'game').done); assert.strictEqual(g.missions.find((x) => x.code === 'words').have, 4);
    const again = (await c.post('/api/kids/games/memory/complete', { correct: 4, total: 4, wordIds: ids })).json;
    assert.strictEqual(again.newWords, 0, 'a word is new only once'); assert.strictEqual(again.gained, 0); assert.ok(!again.newRewards.some((x) => x.code === 'game_memory'));

    // listening, a lesson, a story (the mini quiz) → all five missions → sticker
    await c.post('/api/kids/event', { kind: 'listen', n: 3 });
    const l = (await c.post('/api/kids/categories/animals/complete', { part: 1, correct: 9, total: 10, seconds: 120 })).json;
    assert.ok(l.missions.find((x) => x.code === 'lesson').done); assert.ok(l.missions.find((x) => x.code === 'words').done, '5+ new words today');
    const sp = (await c.get('/api/kids/stories/bunny')).json;
    assert.strictEqual(sp.pages.length, 6); assert.strictEqual(sp.questions.length, 2); assert.ok(sp.questions[0].options.includes(sp.questions[0].answer)); assert.ok(sp.pages[0].tr);
    assert.strictEqual((await c.get('/api/kids/stories/none')).status, 404);
    assert.strictEqual((await c.post('/api/kids/stories/bunny/complete', { correct: 3, total: 3 })).status, 400, 'more answers than questions');
    const st = (await c.post('/api/kids/stories/bunny/complete', { correct: 2, total: 2, seconds: 100 })).json;
    assert.strictEqual(st.stars, 3); assert.ok(st.newRewards.some((x) => x.code === 'story_bunny')); assert.strictEqual(st.missionsDone, true);
    assert.ok(st.newRewards.some((x) => x.code === 'missions'), 'all five missions give the missions sticker');
    assert.ok(l.newRewards.some((x) => x.kind === 'animal'), 'finishing the animals lesson makes its animals collectible');

    // rewards, the album, accessories and the world grow with earned stars only
    const rw = (await c.get('/api/kids/rewards')).json;
    assert.ok(rw.stars >= 9); assert.ok(rw.items.find((x) => x.code === 'game_memory').earned); assert.ok(!rw.items.find((x) => x.code === 'story_zoo').earned);
    assert.ok(rw.items.filter((x) => x.kind === 'animal').length === 12); assert.ok(rw.items.filter((x) => x.kind === 'animal' && x.earned).length >= 4);
    assert.ok(rw.items.find((x) => x.kind === 'accessory' && x.code === 'hat').earned, 'hat at 5 stars');
    assert.strictEqual((await c.patch('/api/kids/profile', { accessory: 'hat', background: 'meadow' })).json.accessory, 'hat');
    const world = (await c.get('/api/kids/world')).json;
    assert.deepStrictEqual(world.places.map((x) => x.code), ['house', 'garden', 'zoo', 'playground', 'space', 'forest']);
    assert.ok(world.places[0].unlocked && world.places[1].unlocked, 'house and garden are open at 5+ stars'); assert.ok(!world.places[5].unlocked);
    assert.ok(world.places[2].decor.length === 3);
    assert.ok(rw.items.every((x) => !('price' in x)), 'nothing can be bought');

    // overview and progress
    const ov = (await c.get('/api/kids/overview')).json;
    assert.ok(ov.stars >= 9 && ov.maxStars > 54); assert.ok(ov.missions.every((x) => x.done)); assert.strictEqual(ov.missionsBonus, true);
    const pr = (await c.get('/api/kids/progress')).json;
    assert.ok(pr.words.known >= 10); assert.strictEqual(pr.games.played, 1); assert.strictEqual(pr.stories.read, 1); assert.ok(pr.minutes.today >= 5); assert.strictEqual(pr.week.length, 7); assert.strictEqual(pr.categories.length, 14);
    assert.strictEqual((await new Client(s.base).get('/api/kids/progress')).status, 401);
  } finally { await s.stop(); }
});

test('kids: drawings are saved and count once; speaking practice is recorded', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await kid(s);
    assert.strictEqual((await c.get('/api/kids/art/nope')).status, 404);
    assert.strictEqual((await c.put('/api/kids/art/cat', { fills: { 0: 'red' } })).status, 400);
    assert.strictEqual((await c.put('/api/kids/art/cat', { fills: { abc: '#ff0000' } })).status, 400);
    assert.strictEqual((await c.put('/api/kids/art/cat', { fills: { 0: '#ff0000', 1: '#00ff00' } })).json.colored, 2);
    const done = (await c.put('/api/kids/art/cat', { fills: { 0: '#ff0000', 1: '#00ff00', 2: '#0000ff' } })).json;
    assert.ok(done.newRewards.some((x) => x.code === 'artist'));
    assert.deepStrictEqual((await c.get('/api/kids/art/cat')).json.fills, { 0: '#ff0000', 1: '#00ff00', 2: '#0000ff' });
    assert.strictEqual((await c.get('/api/kids/art')).json.pictures.find((x) => x.code === 'cat').colored, 3);
    assert.ok(!(await c.put('/api/kids/art/cat', { fills: { 0: '#ff0000', 1: '#00ff00', 2: '#0000ff', 3: '#123456' } })).json.newRewards.length, 'only the first finished drawing is rewarded');
    const cards = (await c.get('/api/kids/cards')).json.cards;
    const sp = (await c.post('/api/kids/event', { kind: 'speak', wordIds: cards.slice(0, 3).map((x) => x.id), seconds: 60 })).json;
    assert.ok(sp.newRewards.some((x) => x.code === 'speaker')); assert.strictEqual(sp.newWords, 3);
    assert.strictEqual((await c.post('/api/kids/event', { kind: 'hack' })).status, 400);
  } finally { await s.stop(); }
});

test('kids: the parent area needs a grown-up sum (or PIN), then shows progress and controls settings', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await kid(s);
    assert.strictEqual((await c.get('/api/kids/parent/summary')).status, 403, 'closed without verification');
    assert.strictEqual((await c.get('/api/kids/parent/summary', { headers: { 'X-Parent-Token': '9999999999999.abc' } })).status, 403);
    const ch = (await c.get('/api/kids/parent/challenge')).json;
    assert.strictEqual(ch.pin, false);
    assert.strictEqual((await c.post('/api/kids/parent/verify', { a: ch.a, b: ch.b, sig: ch.sig, answer: ch.a + ch.b + 1 })).status, 400, 'a wrong answer');
    assert.strictEqual((await c.post('/api/kids/parent/verify', { a: 1, b: 1, sig: 'x', answer: 2 })).status, 400, 'a made-up question');
    const v = await c.post('/api/kids/parent/verify', { a: ch.a, b: ch.b, sig: ch.sig, answer: ch.a + ch.b });
    assert.strictEqual(v.status, 200); const H = { headers: { 'X-Parent-Token': v.json.token } };
    await c.post('/api/kids/categories/colors/complete', { part: 1, correct: 6, total: 10, seconds: 600 });
    const sum = (await c.get('/api/kids/parent/summary', H)).json;
    assert.strictEqual(sum.lessons.done, 1); assert.ok(sum.words.known >= 10); assert.strictEqual(sum.minutes.total, 10); assert.strictEqual(sum.categories.length, 14);
    assert.ok(sum.recommended.length === 3 && sum.recommended.every((x) => x.slug && x.part)); assert.strictEqual(sum.settings.mic, false); assert.strictEqual(sum.settings.age, 'older');
    assert.strictEqual((await c.patch('/api/kids/parent/settings', { age: 'baby' }, H)).status, 400);
    assert.strictEqual((await c.patch('/api/kids/parent/settings', { reminderTime: '25:99' }, H)).status, 400);
    const set = (await c.patch('/api/kids/parent/settings', { age: 'young', sound: false, mic: true, reminders: true, reminderTime: '18:30', dailyLimitMin: 5 }, H)).json;
    assert.strictEqual(set.age, 'young'); assert.strictEqual(set.sound, false); assert.strictEqual(set.mic, true); assert.strictEqual(set.dailyLimitMin, 5); assert.strictEqual(set.limitReached, true, '10 minutes played, 5 allowed');
    assert.strictEqual((await c.patch('/api/kids/parent/settings', { sound: true })).status, 403, 'settings are protected too');
    // a PIN replaces the sum
    assert.strictEqual((await c.post('/api/kids/parent/pin', { pin: '12' }, H)).status, 400);
    assert.strictEqual((await c.post('/api/kids/parent/pin', { pin: '4321' }, H)).json.pinSet, true);
    assert.strictEqual((await c.get('/api/kids/parent/challenge')).json.pin, true);
    assert.strictEqual((await c.post('/api/kids/parent/verify', { pin: '1111' })).status, 400);
    assert.strictEqual((await c.post('/api/kids/parent/verify', { pin: '4321' })).status, 200);
    // another account cannot use this token
    const other = await kid(s, 'o@example.com');
    assert.strictEqual((await other.get('/api/kids/parent/summary', H)).status, 403);
  } finally { await s.stop(); }
});
