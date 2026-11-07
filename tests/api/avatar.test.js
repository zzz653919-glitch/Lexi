const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client, playAttempt } = require('./helpers');
const AS = require('../../server/lib/avatar-spec');
const { ITEMS } = require('../../server/seed/avatar');
const TokensLib = require('../../server/lib/tokens');

async function learner(s, email, extra = {}) { const id = s.createUser({ email, ...extra }); const c = new Client(s.base); await c.login(email); c.uid = id; return c; }
const lessonsOf = (path) => path.levels.flatMap((lv) => lv.units.flatMap((u) => u.lessons));
async function finishNext(s, c) { const l = lessonsOf((await c.get('/api/path')).json).find((x) => x.state === 'available'); const st = (await c.post(`/api/lessons/${l.id}/start`)).json; await playAttempt(c, st, s.db); return l; }
const sumLedger = (s, uid) => s.db.get('SELECT COALESCE(SUM(amount), 0) n FROM token_transactions WHERE user_id = ?', uid).n;

test('avatar catalogue: 125 original items in every category, names in three languages, valid kinds and rarities', () => {
  assert.ok(ITEMS.length >= 100);
  const slugs = new Set(ITEMS.map((i) => i.slug)); assert.strictEqual(slugs.size, ITEMS.length, 'unique slugs');
  const cats = new Set(ITEMS.map((i) => AS.CATEGORY(i.kind))); assert.deepStrictEqual([...cats].sort(), ['accessory', 'clothing', 'pet', 'special']);
  for (const i of ITEMS) { assert.ok(i.en && i.uz && i.ru, i.slug); assert.ok(AS.KINDS.includes(i.kind) && AS.RARITIES.includes(i.rarity) && AS.SLOTS.includes(i.slot), i.slug); assert.ok(i.starter || i.earn || i.price > 0, i.slug + ' has a price'); assert.doesNotMatch(i.uz, /[oOgG][‘ʻ'`]|sh|ch/i, i.uz); }
  for (const k of ['tee', 'hoodie', 'jacket', 'shirt', 'pants', 'shorts', 'dress', 'shoes', 'costume', 'seasonal', 'glasses', 'sunglasses', 'hat', 'cap', 'headphones', 'backpack', 'watch', 'necklace', 'wings', 'mask', 'cat', 'dog', 'rabbit', 'fox', 'dragon', 'bird', 'dino', 'fantasy', 'animation', 'background', 'effect', 'style', 'collectible'])
    assert.ok(ITEMS.some((i) => i.kind === k), 'the shop has ' + k);
  for (const r of AS.RARITIES) assert.ok(ITEMS.some((i) => i.rarity === r), r);
  assert.ok(ITEMS.filter((i) => i.earn).length >= 4, 'pets that are earned');
});

test('avatar studio: starter items, create / change / switch / delete characters, validated on the server', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await learner(s, 'a@example.com');
    assert.strictEqual((await new Client(s.base).get('/api/avatar/bootstrap')).status, 401);
    const b = (await c.get('/api/avatar/bootstrap')).json;
    assert.strictEqual(b.avatars.length, 0); assert.strictEqual(b.wallet.balance, 0); assert.ok(b.items.length >= 100);
    assert.deepStrictEqual(b.items.filter((i) => i.owned).map((i) => i.slug).sort(), ['starter-jeans', 'starter-sneakers', 'starter-tee'], 'every account owns the starter clothes');
    assert.strictEqual(b.spec.styles.length, 6); assert.strictEqual(b.spec.max, 6);

    assert.strictEqual((await c.post('/api/avatar/avatars', { name: '' })).status, 400);
    assert.strictEqual((await c.post('/api/avatar/avatars', { name: 'Zed', style: 'pixel' })).status, 400, 'unknown style');
    assert.strictEqual((await c.post('/api/avatar/avatars', { name: 'Zed', look: { skin: 99 } })).status, 400, 'a face part out of range');
    assert.strictEqual((await c.post('/api/avatar/avatars', { name: 'Zed', equipped: { hat: 'hat-red' } })).status, 400, 'an item that is not owned');
    const made = (await c.post('/api/avatar/avatars', { name: '  Nova  ', style: 'fantasy', look: { shape: 2, skin: 5, hairStyle: 4, hairColor: 7, eyeStyle: 3, eyeColor: 2, brows: 1, mouth: 4 } }));
    assert.strictEqual(made.status, 201); const a1 = made.json.avatar;
    assert.strictEqual(a1.name, 'Nova'); assert.strictEqual(a1.style, 'fantasy'); assert.strictEqual(a1.look.hairColor, 7); assert.deepStrictEqual(Object.keys(a1.equipped).sort(), ['bottom', 'shoes', 'top']);
    assert.strictEqual((await c.get('/api/avatar/bootstrap')).json.activeId, a1.id, 'the first character is active');

    const a2 = (await c.post('/api/avatar/avatars', { name: 'Robo', style: 'robot' })).json.avatar;
    assert.strictEqual((await c.post(`/api/avatar/avatars/${a2.id}/activate`)).json.activeId, a2.id);
    assert.strictEqual((await c.put(`/api/avatar/avatars/${a1.id}`, { name: 'Nova Prime', favorite: true, petName: 'Mo', petPose: 'play' })).json.avatar.petName, 'Mo');
    assert.strictEqual((await c.put(`/api/avatar/avatars/${a1.id}`, { petPose: 'fly' })).status, 400);
    assert.strictEqual((await c.put(`/api/avatar/avatars/${a1.id}`, { equipped: { top: 'starter-jeans' } })).status, 400, 'an item must fit the slot');
    assert.strictEqual((await c.put(`/api/avatar/avatars/${a1.id}`, { equipped: { top: 'starter-tee' } })).status, 200);
    for (let i = 0; i < 4; i++) await c.post('/api/avatar/avatars', { name: 'C' + i });
    assert.strictEqual((await c.post('/api/avatar/avatars', { name: 'Seventh' })).status, 400, 'at most six characters');
    const other = await learner(s, 'b@example.com');
    assert.strictEqual((await other.put(`/api/avatar/avatars/${a1.id}`, { name: 'Hacked' })).status, 404, 'characters belong to their owner');
    assert.strictEqual((await other.del(`/api/avatar/avatars/${a1.id}`)).status, 404);
    const del = (await c.del(`/api/avatar/avatars/${a2.id}`)).json; assert.strictEqual(del.activeId, a1.id, 'another character becomes active');
    assert.ok((await c.get('/api/avatar/bootstrap')).json.badges.includes('stylist'), 'the stylist badge for three characters');
  } finally { await s.stop(); }
});

test('tokens: paid only after a real completion, once per achievement, saved in the ledger, separate from XP', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await learner(s, 't@example.com');
    assert.strictEqual((await c.get('/api/avatar/wallet')).json.wallet.balance, 0);
    const xp0 = (await c.get('/api/me/stats')).json.xpTotal;
    // a started but unfinished lesson pays nothing
    const l0 = lessonsOf((await c.get('/api/path')).json).find((x) => x.state === 'available');
    await c.post(`/api/lessons/${l0.id}/start`);
    assert.strictEqual((await c.get('/api/avatar/wallet')).json.wallet.balance, 0, 'nothing before completion');
    const l1 = await finishNext(s, c);
    let w = (await c.get('/api/avatar/wallet')).json;
    const lessonRow = w.items.find((x) => x.ref === 'lesson:' + l1.id);
    assert.ok(lessonRow && lessonRow.amount === 10 && lessonRow.reason === 'lesson', 'a lesson pays 10');
    assert.ok((await c.get('/api/me/stats')).json.xpTotal > xp0, 'XP still grows'); assert.strictEqual(w.wallet.balance, sumLedger(s, c.uid), 'the balance equals the ledger');
    // the same lesson again: no second payment
    const before = w.wallet.balance;
    const st = (await c.post(`/api/lessons/${l1.id}/start`)).json; await playAttempt(c, st, s.db);
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND ref = ?", c.uid, 'lesson:' + l1.id).n, 1, 'one row per achievement');
    assert.ok((await c.get('/api/avatar/wallet')).json.wallet.balance - before <= 15 * 6, 'only missions may add tokens');
    // the ledger refuses a repeated reference and a zero reward
    const T = TokensLib.make(s.appDb);
    const p1 = await T.earn(c.uid, { ref: 'unit-test:1', amount: 25, reason: 'admin' }), p2 = await T.earn(c.uid, { ref: 'unit-test:1', amount: 25, reason: 'admin' });
    assert.ok(p1.paid && !p2.paid); assert.strictEqual((await T.earn(c.uid, { ref: 'unit-test:2', amount: 0, reason: 'admin' })).paid, false);
    // unseen rewards are shown once
    const me = (await c.get('/api/me/stats')).json.tokens; assert.ok(me.unseen.length >= 1 && me.balance === (await c.get('/api/avatar/wallet')).json.wallet.balance);
    await c.post('/api/avatar/wallet/seen'); assert.strictEqual((await c.get('/api/me/stats')).json.tokens.unseen.length, 0);
    assert.strictEqual(sumLedger(s, c.uid), (await c.get('/api/avatar/wallet')).json.wallet.balance);
  } finally { await s.stop(); }
});

test('shop: the server checks balance, ownership, availability; no negative balance, no double purchase', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await learner(s, 'shop@example.com'); const T = TokensLib.make(s.appDb);
    const bal = async () => (await c.get('/api/avatar/wallet')).json.wallet.balance;
    assert.strictEqual((await c.post('/api/avatar/shop/tee-red/buy')).status, 400, 'no tokens');
    assert.strictEqual(await bal(), 0);
    assert.strictEqual((await c.post('/api/avatar/shop/nope/buy')).status, 404);
    assert.strictEqual((await c.post('/api/avatar/shop/pet-dragon-golden/buy')).status, 400, 'earned items cannot be bought');
    assert.strictEqual((await c.post('/api/avatar/shop/starter-tee/buy')).status, 400);
    await T.earn(c.uid, { ref: 'gift:1', amount: 100, reason: 'admin' });
    const price = ITEMS.find((i) => i.slug === 'tee-red').price;
    const ok = await c.post('/api/avatar/shop/tee-red/buy'); assert.strictEqual(ok.status, 200); assert.strictEqual(ok.json.wallet.balance, 100 - price);
    assert.strictEqual((await c.post('/api/avatar/shop/tee-red/buy')).status, 409, 'a second purchase is refused');
    assert.strictEqual(await bal(), 100 - price, 'and costs nothing');
    assert.strictEqual((await c.post('/api/avatar/shop/hat-gold/buy')).status, 400, 'too expensive');
    // two purchases at the same moment: only the one that fits is paid
    await T.earn(c.uid, { ref: 'gift:2', amount: 0 + 60, reason: 'admin' });
    const have = await bal(), p = ITEMS.find((i) => i.slug === 'tee-green').price, q = ITEMS.find((i) => i.slug === 'tee-yellow').price;
    const both = await Promise.all([c.post('/api/avatar/shop/tee-green/buy'), c.post('/api/avatar/shop/tee-yellow/buy')]);
    const paid = both.filter((r) => r.status === 200).length;
    assert.ok(paid >= 1 && (await bal()) >= 0 && (await bal()) === have - both.reduce((a, r, i) => a + (r.status === 200 ? [p, q][i] : 0), 0));
    assert.strictEqual(sumLedger(s, c.uid), await bal(), 'the ledger matches the balance');
    assert.ok(s.db.get('SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND amount < 0', c.uid).n >= 2);
    // owned items can be worn, and stay owned
    const a = (await c.post('/api/avatar/avatars', { name: 'Shopper', equipped: { top: 'tee-red' } })); assert.strictEqual(a.status, 201); assert.strictEqual(a.json.avatar.equipped.top, 'tee-red');
    assert.strictEqual((await c.put(`/api/avatar/avatars/${a.json.avatar.id}`, { equipped: { hat: 'hat-red' } })).status, 400, 'not owned');
    assert.ok((await c.get('/api/avatar/bootstrap')).json.badges.includes('first_purchase'));
    // disabling an item hides it from the shop but owners keep it
    const admin = await learner(s, 'adm@example.com', { role: 'admin' });
    const items = (await admin.get('/api/admin/avatar/items')).json.items, red = items.find((i) => i.slug === 'tee-red');
    assert.strictEqual((await admin.patch(`/api/admin/avatar/items/${red.id}`, { status: 'disabled' })).status, 200);
    assert.strictEqual((await c.post('/api/avatar/shop/tee-red/buy')).status, 404, 'disabled items cannot be bought');
    assert.ok((await c.get('/api/avatar/bootstrap')).json.items.find((i) => i.slug === 'tee-red').owned, 'the owner keeps it');
    assert.strictEqual((await admin.del(`/api/admin/avatar/items/${red.id}`)).status, 409, 'an owned item cannot be deleted');
  } finally { await s.stop(); }
});

test('daily missions pay once a day; earned pets arrive by learning; badges', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await learner(s, 'm@example.com'); const admin = await learner(s, 'adm@example.com', { role: 'admin' });
    const m0 = (await c.get('/api/avatar/missions')).json;
    assert.deepStrictEqual(m0.missions.map((x) => x.code), ['lessons', 'words', 'vocab_test', 'listening', 'speaking', 'streak']); assert.ok(m0.missions.every((x) => !x.done)); assert.strictEqual(m0.reward, 15);
    // make a pet earnable by 2 lessons, then learn
    const fox = (await admin.get('/api/admin/avatar/items')).json.items.find((i) => i.slug === 'pet-fox-ember');
    assert.strictEqual((await admin.patch(`/api/admin/avatar/items/${fox.id}`, { earn_rule: 'lessons:2' })).status, 200);
    assert.strictEqual((await admin.patch(`/api/admin/avatar/items/${fox.id}`, { earn_rule: 'lessons:zero' })).status, 400);
    assert.ok(!(await c.get('/api/avatar/bootstrap')).json.items.find((i) => i.slug === 'pet-fox-ember').owned);
    await finishNext(s, c); await finishNext(s, c);
    const m1 = (await c.get('/api/avatar/missions')).json;
    const mission = m1.missions.find((x) => x.code === 'lessons'); assert.ok(mission.done && mission.claimed, 'two lessons complete the mission');
    const w1 = (await c.get('/api/avatar/wallet')).json; assert.ok(w1.items.some((x) => x.reason === 'mission' && x.amount === 15), 'the mission paid 15 tokens');
    const n = s.db.get("SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND reason = 'mission'", c.uid).n;
    await c.get('/api/avatar/missions'); await c.get('/api/avatar/missions');
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND reason = 'mission'", c.uid).n, n, 'a mission is paid once per day');
    const b = (await c.get('/api/avatar/bootstrap')).json;
    assert.ok(b.items.find((i) => i.slug === 'pet-fox-ember').owned, 'the pet is earned, not bought'); assert.ok(b.badges.includes('first_mission'));
    assert.ok(s.db.get("SELECT source FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? AND i.slug = 'pet-fox-ember'", c.uid).source === 'reward');
  } finally { await s.stop(); }
});

test('admin avatar management: items, images, prices, rarity, token rewards, ledger, owners', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const admin = await learner(s, 'adm@example.com', { role: 'admin' }), editor = await learner(s, 'ed@example.com', { role: 'editor' }), user = await learner(s, 'u@example.com');
    assert.strictEqual((await user.get('/api/admin/avatar/items')).status, 403);
    assert.strictEqual((await editor.get('/api/admin/avatar/items')).status, 200, 'editors manage items');
    assert.strictEqual((await editor.get('/api/admin/avatar/rewards')).status, 403, 'only administrators set rewards');
    assert.strictEqual((await editor.get('/api/admin/avatar/transactions')).status, 403);
    // create / validate / edit / delete
    assert.strictEqual((await admin.post('/api/admin/avatar/items', { name_en: 'X', kind: 'tee', price: -5, rarity: 'common' })).status, 400);
    assert.strictEqual((await admin.post('/api/admin/avatar/items', { name_en: 'X', kind: 'sofa', price: 5, rarity: 'common' })).status, 400);
    assert.strictEqual((await admin.post('/api/admin/avatar/items', { name_en: 'X', kind: 'tee', price: 5, rarity: 'mythic' })).status, 400);
    const made = (await admin.post('/api/admin/avatar/items', { name_en: 'Lucky Cap', name_uz: 'Omadli beysbolka', name_ru: 'Счастливая кепка', kind: 'cap', price: 77, rarity: 'rare', art: { c: '#112233', c2: '#ffffff', p: 'solid' } }));
    assert.strictEqual(made.status, 201); assert.strictEqual(made.json.slot, 'hat'); assert.strictEqual(made.json.slug, 'lucky-cap'); assert.strictEqual(made.json.category, 'accessory');
    assert.strictEqual((await admin.post('/api/admin/avatar/items', { name_en: 'Lucky Cap', kind: 'cap', price: 1, rarity: 'common' })).json.slug, 'lucky-cap-2');
    assert.strictEqual((await admin.patch(`/api/admin/avatar/items/${made.json.id}`, { art: { c: 'red' } })).status, 400);
    assert.strictEqual((await admin.patch(`/api/admin/avatar/items/${made.json.id}`, { image_url: 'https://evil.example/x.png' })).status, 400);
    const edited = (await admin.patch(`/api/admin/avatar/items/${made.json.id}`, { price: 88, rarity: 'epic' })).json; assert.strictEqual(edited.price, 88); assert.strictEqual(edited.rarity, 'epic');
    assert.ok((await user.get('/api/avatar/bootstrap')).json.items.some((i) => i.slug === 'lucky-cap' && i.price === 88));
    const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(40)]);
    const up = await admin.req('POST', '/api/admin/avatar/upload', png, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'cap.png' } });
    assert.strictEqual(up.status, 201); assert.strictEqual((await admin.patch(`/api/admin/avatar/items/${made.json.id}`, { image_url: up.json.url })).json.image_url, up.json.url);
    assert.strictEqual((await admin.req('POST', '/api/admin/avatar/upload', Buffer.from('<svg/>'), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'x.svg' } })).status, 400, 'no SVG');
    assert.strictEqual((await admin.del(`/api/admin/avatar/items/${made.json.id}`)).status, 200);
    // token rewards are configurable and used at once
    assert.deepStrictEqual((await admin.get('/api/admin/avatar/rewards')).json.rewards, { token_lesson: 10, token_topic: 30, token_test: 20, token_mission: 15, token_streak7: 50, token_level: 100 });
    assert.strictEqual((await admin.put('/api/admin/avatar/rewards', { token_lesson: -1 })).status, 400);
    assert.strictEqual((await admin.put('/api/admin/avatar/rewards', { token_lesson: 7, token_mission: 0 })).json.rewards.token_lesson, 7);
    const l = await finishNext(s, user);
    assert.strictEqual(s.db.get("SELECT amount FROM token_transactions WHERE user_id = ? AND ref = ?", user.uid, 'lesson:' + l.id).amount, 7, 'the new reward is used');
    // ledger, owners, grant
    const tx = (await admin.get('/api/admin/avatar/transactions')).json; assert.ok(tx.total >= 1 && tx.items[0].email && tx.totals.earned >= 7);
    assert.strictEqual((await admin.get('/api/admin/avatar/transactions?email=nobody@nowhere')).json.total, 0);
    assert.strictEqual((await admin.post(`/api/admin/avatar/users/${user.uid}/grant`, { amount: 0 })).status, 400);
    assert.strictEqual((await admin.post(`/api/admin/avatar/users/${user.uid}/grant`, { amount: 500, note: 'prize' })).status, 200);
    await user.post('/api/avatar/shop/tee-red/buy');
    const det = (await admin.get(`/api/admin/avatar/users/${user.uid}`)).json; assert.ok(det.owned.some((o) => o.slug === 'tee-red' && o.source === 'shop') && det.wallet.earned >= 507 && det.transactions.length >= 3);
  } finally { await s.stop(); }
});

test('profile card and character level', async () => {
  const s = await startServer({ seedKids: true });
  try {
    const c = await learner(s, 'card@example.com');
    assert.strictEqual((await c.get('/api/avatar/card')).json.avatar, null);
    await c.post('/api/avatar/avatars', { name: 'Hero' });
    const k = (await c.get('/api/avatar/card')).json;
    assert.strictEqual(k.avatar.name, 'Hero'); assert.strictEqual(k.level.level, 1); assert.ok(k.outfit.length === 3 && k.pet === null); assert.strictEqual(k.tokens.balance, 0);
    assert.deepStrictEqual([AS.charLevel(0).level, AS.charLevel(40).level, AS.charLevel(160).level], [1, 2, 3]);
  } finally { await s.stop(); }
});
