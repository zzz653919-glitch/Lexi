const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client } = require('./helpers');

const CODES = ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS'];
async function learner(s, email) { s.createUser({ email }); const c = new Client(s.base); await c.login(email); return c; }
const lessonsOf = (p, code) => p.levels.find((l) => l.code === code).units.flatMap((u) => u.lessons);

test('every lesson has a level id equal to the level of its unit', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM lessons WHERE level_id IS NULL').n, 0);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.level_id IS NOT u.level_id').n, 0);
  } finally { await s.stop(); }
});

test('selecting each level A1..C1 and IELTS shows only that level\'s lessons and recommends from it', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'lv@example.com');
    for (const code of CODES) {
      const put = await c.put('/api/me/selected-level', { level: code });
      assert.strictEqual(put.status, 200, code);
      assert.strictEqual(put.json.selectedLevel, code);
      assert.strictEqual(put.json.recommended.level, code, code + ' recommendation stays inside the level');
      const p = (await c.get('/api/path')).json;
      assert.strictEqual(p.selectedLevel, code);
      assert.strictEqual(p.recommended.level, code);
      assert.ok(p.levels.find((l) => l.code === code).unlocked, code + ' is open once selected');
      const dash = (await c.get('/api/dashboard')).json;
      assert.strictEqual(dash.selectedLevel, code); assert.strictEqual(dash.recommended.level, code); assert.strictEqual(dash.level.code, code);
      const list = (await c.get('/api/levels/' + code + '/lessons')).json;
      assert.ok(list.items.length > 0 && list.items.every((l) => l.level === code), code + ' lists only its own lessons');
      const ids = new Set(list.items.map((l) => l.id));
      for (const other of CODES.filter((x) => x !== code)) assert.ok(lessonsOf(p, other).every((l) => !ids.has(l.id)), 'no lesson of ' + code + ' inside ' + other);
      assert.strictEqual((await c.get('/api/auth/me')).json.user.selectedLevel, code, 'saved on the account');
    }
  } finally { await s.stop(); }
});

test('the selected level survives a new login, and switching keeps progress', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'keep@example.com');
    await c.put('/api/me/selected-level', { level: 'B1' });
    const first = (await c.get('/api/path')).json.recommended;
    assert.strictEqual((await c.post('/api/lessons/' + first.lessonId + '/start', { level: 'B1' })).status, 200);
    s.db.run('INSERT INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) SELECT id, ?, 1, 90, ?, ? FROM users WHERE email = ?', first.lessonId, '2026-01-01', '2026-01-01', 'keep@example.com');
    const again = new Client(s.base); await again.login('keep@example.com');
    assert.strictEqual((await again.get('/api/path')).json.selectedLevel, 'B1', 'restored after login');
    await again.put('/api/me/selected-level', { level: 'A1' });
    await again.put('/api/me/selected-level', { level: 'B1' });
    const p = (await again.get('/api/path')).json;
    assert.strictEqual(lessonsOf(p, 'B1').find((l) => l.id === first.lessonId).state, 'completed', 'progress is kept');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM user_progress').n, 1);
  } finally { await s.stop(); }
});

test('the API validates the level and refuses a lesson of another level', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'val@example.com');
    assert.strictEqual((await c.put('/api/me/selected-level', { level: 'Z9' })).status, 400);
    assert.strictEqual((await c.put('/api/me/selected-level', {})).status, 400);
    assert.strictEqual((await c.get('/api/levels/Z9/lessons')).status, 400);
    assert.strictEqual((await c.get('/api/vocabulary?level=Z9')).status, 400);
    const rec = (await c.get('/api/path')).json.recommended;
    assert.strictEqual((await c.post('/api/lessons/' + rec.lessonId + '/start', { level: 'B1' })).status, 409);
    const v = (await c.get('/api/vocabulary?level=A1')).json;
    assert.ok(v.items.every((w) => w.level === 'A1'));
  } finally { await s.stop(); }
});

test('a level without lessons says so and never falls back to A1', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'empty@example.com');
    s.db.run("UPDATE lessons SET status = 'draft' WHERE level_id = (SELECT id FROM levels WHERE code = 'C1')");
    const put = await c.put('/api/me/selected-level', { level: 'C1' });
    assert.strictEqual(put.status, 200); assert.strictEqual(put.json.recommended, null); assert.strictEqual(put.json.empty, true);
    const p = (await c.get('/api/path')).json;
    assert.strictEqual(p.recommended, null); assert.strictEqual(p.selectedEmpty, true);
    const list = (await c.get('/api/levels/C1/lessons')).json;
    assert.strictEqual(list.empty, true); assert.strictEqual(list.message.key, 'path.level_empty');
    assert.strictEqual((await c.get('/api/dashboard')).json.recommended, null);
  } finally { await s.stop(); }
});

test('a profile level choice and a registration choice both become the selected level', async () => {
  const s = await startServer({ seedRoadmap: true });
  try {
    const c = await learner(s, 'prof@example.com');
    await c.patch('/api/me', { startLevel: 'B2' });
    assert.strictEqual((await c.get('/api/path')).json.recommended.level, 'B2');
    const r = new Client(s.base);
    const reg = await r.post('/api/auth/register', { email: 'reg@example.com', password: 'Password123!', displayName: 'Reg', startLevel: 'B1' });
    assert.ok(reg.status < 300, JSON.stringify(reg.json));
    assert.strictEqual((await r.get('/api/path')).json.recommended.level, 'B1');
  } finally { await s.stop(); }
});
