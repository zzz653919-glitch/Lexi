const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client } = require('./helpers');
const { CATEGORIES, parseWords } = require('../../server/seed/kids');
const K = require('../../server/lib/kids');

test('kids content: 14 categories, every card has a picture and translations, no duplicate pictures, Uzbek in the new alphabet', () => {
  assert.strictEqual(CATEGORIES.length, 14);
  assert.deepStrictEqual(CATEGORIES.map((c) => c.slug), ['alphabet', 'animals', 'colors', 'numbers', 'fruits', 'family', 'body', 'food', 'toys', 'vehicles', 'clothes', 'nature', 'everyday', 'sentences']);
  for (const c of CATEGORIES) {
    const w = parseWords(c.words);
    assert.ok(w.length >= 9, c.slug + ' has enough cards');
    const pics = w.map((x) => x.pic);
    assert.strictEqual(new Set(pics).size, pics.length, c.slug + ': pictures are distinguishable');
    for (const x of w) {
      assert.ok(x.en && x.uz && x.ru && x.pic, `${c.slug}/${x.en}: English, Uzbek, Russian and a picture`);
      for (const t of [x.uz, c.uz]) assert.doesNotMatch(t, /[oOgG][‘ʻ'`]|sh|ch/i, `${c.slug}/${x.en}: new Uzbek alphabet`);
    }
    if (c.kind === 'letters') { assert.strictEqual(w.length, 26); assert.deepStrictEqual(w.map((x) => x.en).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'); assert.ok(w.every((x) => x.extra.toUpperCase().startsWith(x.en) || x.en === 'X' || x.en === 'K')); }
    if (c.kind === 'numbers') assert.deepStrictEqual(w.map((x) => x.extra), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  }
});
test('kids lesson parts and stars', () => {
  assert.deepStrictEqual(K.split(26), { parts: 3, size: 9 });
  assert.deepStrictEqual(K.split(10), { parts: 1, size: 10 });
  assert.deepStrictEqual(K.split(12), { parts: 2, size: 6 });
  assert.deepStrictEqual([100, 90, 89, 60, 59, 0].map(K.starsFor), [3, 3, 2, 2, 1, 1]);
});

test('kids mode: choosing it, content, progress kept apart from the standard course, badges, daily activity', async () => {
  const s = await startServer({ seedKids: true });
  try {
    s.createUser({ email: 'kid@example.com' });
    const c = new Client(s.base); await c.login('kid@example.com');
    assert.strictEqual((await c.get('/api/auth/me')).json.user.mode, 'standard');
    assert.strictEqual((await c.post('/api/me/mode', { mode: 'baby' })).status, 400);
    const m = await c.post('/api/me/mode', { mode: 'kids' });
    assert.strictEqual(m.status, 200); assert.strictEqual(m.json.user.mode, 'kids');
    assert.strictEqual((await c.get('/api/auth/me')).json.user.mode, 'kids', 'the mode is saved on the account');
    const xpBefore = (await c.get('/api/auth/me')).json.user.xpTotal;

    const ov = (await c.get('/api/kids/overview')).json;
    assert.strictEqual(ov.categories.length, 14); assert.strictEqual(ov.stars, 0); assert.strictEqual(ov.lessonsDone, 0);
    assert.strictEqual(ov.next.slug, 'alphabet'); assert.strictEqual(ov.next.part, 1);
    assert.strictEqual(ov.categories[0].parts.length, 3);
    assert.strictEqual(ov.week.length, 7); assert.ok(ov.badges.every((b) => !b.earned));

    const a = (await c.get('/api/kids/categories/alphabet')).json;
    assert.strictEqual(a.cards.length, 26); assert.strictEqual(a.category.parts, 3);
    assert.deepStrictEqual([...new Set(a.cards.map((x) => x.part))], [1, 2, 3]);
    assert.strictEqual(a.cards[0].en, 'A'); assert.strictEqual(a.cards[0].extra, 'Apple'); assert.strictEqual(a.cards[0].tr, 'olma');
    assert.strictEqual((await c.get('/api/kids/categories/nope')).status, 404);

    assert.strictEqual((await c.post('/api/kids/categories/alphabet/complete', { part: 9, correct: 1, total: 2 })).status, 400);
    assert.strictEqual((await c.post('/api/kids/categories/alphabet/complete', { part: 1, correct: 5, total: 2 })).status, 400);
    const r1 = (await c.post('/api/kids/categories/alphabet/complete', { part: 1, correct: 7, total: 10 })).json;
    assert.strictEqual(r1.stars, 2); assert.strictEqual(r1.gained, 2); assert.strictEqual(r1.totalStars, 2);
    assert.deepStrictEqual(r1.newBadges.map((b) => b.code), ['first_lesson']);
    const r2 = (await c.post('/api/kids/categories/alphabet/complete', { part: 1, correct: 3, total: 10 })).json;
    assert.strictEqual(r2.stars, 1); assert.strictEqual(r2.gained, 0); assert.strictEqual(r2.totalStars, 2, 'a worse retry never lowers the stars');
    const r3 = (await c.post('/api/kids/categories/alphabet/complete', { part: 1, correct: 10, total: 10 })).json;
    assert.strictEqual(r3.gained, 1); assert.strictEqual(r3.totalStars, 3); assert.ok(r3.newBadges.some((b) => b.code === 'three_stars'));

    const ov2 = (await c.get('/api/kids/overview')).json;
    assert.strictEqual(ov2.stars, 3); assert.strictEqual(ov2.lessonsDone, 1); assert.strictEqual(ov2.next.part, 2, 'the next lesson is the next part');
    assert.strictEqual(ov2.today.lessons, 3); assert.strictEqual(ov2.today.stars, 3); assert.strictEqual(ov2.streak, 1);
    assert.ok(ov2.badges.find((b) => b.code === 'first_lesson').earned);
    assert.strictEqual((await c.get('/api/auth/me')).json.user.xpTotal, xpBefore, 'kids progress does not touch the standard XP');
    assert.strictEqual((await c.post('/api/me/mode', { mode: 'standard' })).json.user.mode, 'standard');
    assert.strictEqual((await c.get('/api/kids/overview')).json.stars, 3, 'kids progress is kept when the mode changes back');

    assert.strictEqual((await new Client(s.base).get('/api/kids/overview')).status, 401);
  } finally { await s.stop(); }
});

test('kids administration: categories, cards, questions, uploads, permissions, and what learners see', async () => {
  const s = await startServer({ seedKids: true });
  try {
    s.createUser({ email: 'ed@example.com', role: 'editor' }); s.createUser({ email: 'l@example.com' });
    const ed = new Client(s.base); await ed.login('ed@example.com');
    const l = new Client(s.base); await l.login('l@example.com');
    assert.strictEqual((await l.get('/api/admin/kids/categories')).status, 403);
    const list = (await ed.get('/api/admin/kids/categories')).json.items;
    assert.strictEqual(list.length, 14); assert.ok(list.every((x) => x.words >= 9));

    const bad1 = await ed.post('/api/admin/kids/categories', { title_en: '' });
    assert.strictEqual(bad1.status, 400);
    const cat = (await ed.post('/api/admin/kids/categories', { title_en: 'Birds', title_uz: 'Quşlar', emoji: '🐦', color: '#00aa88', status: 'published' })).json;
    assert.strictEqual(cat.slug, 'birds');
    assert.strictEqual((await ed.post('/api/admin/kids/categories', { title_en: 'Birds' })).json.slug, 'birds-2');
    assert.strictEqual((await ed.patch('/api/admin/kids/categories/' + cat.id, { color: 'red' })).status, 400);
    assert.strictEqual((await l.get('/api/kids/categories/birds')).status, 404, 'a category without cards is not shown');

    assert.strictEqual((await ed.post(`/api/admin/kids/categories/${cat.id}/words`, { en: 'Owl', uz: 'boyqoş' })).status, 400, 'a picture is required');
    const owl = (await ed.post(`/api/admin/kids/categories/${cat.id}/words`, { en: 'Owl', uz: 'boyqoş', pic: '🦉' })).json;
    await ed.post(`/api/admin/kids/categories/${cat.id}/words`, { en: 'Parrot', uz: 'to‘ti', pic: '🦜' });
    await ed.post(`/api/admin/kids/categories/${cat.id}/words`, { en: 'Eagle', uz: 'burgut', pic: '🦅', status: 'draft' });
    const q = (await ed.post(`/api/admin/kids/categories/${cat.id}/questions`, { prompt: 'Which bird says hoo?', pic: '🌙', correct: 'Owl', wrong1: 'Parrot' })).json;
    const seen = (await l.get('/api/kids/categories/birds')).json;
    assert.deepStrictEqual(seen.cards.map((x) => x.en), ['Owl', 'Parrot'], 'drafts are hidden from children');
    assert.strictEqual(seen.questions.length, 1); assert.strictEqual(seen.questions[0].correct, 'Owl');
    assert.ok((await l.get('/api/kids/overview')).json.categories.some((x) => x.slug === 'birds'));

    // images and audio
    const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(40)]);
    const up = await ed.req('POST', '/api/admin/kids/upload', png, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'owl.png' } });
    assert.strictEqual(up.status, 201); assert.match(up.json.url, /^\/uploads\//); assert.strictEqual(up.json.kind, 'image');
    const bogus = await ed.req('POST', '/api/admin/kids/upload', Buffer.from('<svg onload=alert(1)>'), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'x.svg' } });
    assert.strictEqual(bogus.status, 400, 'SVG is not accepted');
    const fake = await ed.req('POST', '/api/admin/kids/upload', Buffer.from('not a png'), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'x.png' } });
    assert.strictEqual(fake.status, 400, 'the file signature must match');
    assert.strictEqual((await ed.patch('/api/admin/kids/words/' + owl.id, { image_url: 'https://evil.example/x.png' })).status, 400, 'only our own uploads can be used');
    assert.strictEqual((await ed.patch('/api/admin/kids/words/' + owl.id, { image_url: up.json.url })).status, 200);
    const img = await fetch(s.base + up.json.url);
    assert.strictEqual(img.headers.get('content-type'), 'image/png'); assert.strictEqual(img.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual((await l.get('/api/kids/categories/birds')).json.cards[0].image, up.json.url);

    assert.strictEqual((await ed.patch('/api/admin/kids/questions/' + q.id, { status: 'draft' })).status, 200);
    assert.strictEqual((await l.get('/api/kids/categories/birds')).json.questions.length, 0);
    assert.strictEqual((await ed.del('/api/admin/kids/words/' + owl.id)).status, 200);
    assert.strictEqual((await ed.del('/api/admin/kids/categories/' + cat.id)).status, 200);
    assert.strictEqual((await l.get('/api/kids/categories/birds')).status, 404);
  } finally { await s.stop(); }
});
