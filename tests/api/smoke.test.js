const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client } = require('./helpers');

test('server boots, registers a learner and returns the path', async () => {
  const s = await startServer();
  try {
    const c = new Client(s.base);
    let r = await c.post('/api/auth/register', { email: 'a@example.com', password: 'Passw0rd1', displayName: 'Anna', timezone: 'Asia/Tashkent' });
    assert.strictEqual(r.status, 201, r.text);
    r = await c.get('/api/path');
    assert.strictEqual(r.status, 200, r.text);
    assert.ok(r.json.levels.length >= 5);
    console.log(JSON.stringify(r.json.recommended));
    r = await c.get('/api/dashboard'); assert.strictEqual(r.status, 200, r.text);
  } finally { await s.stop(); }
});

test('hosting: health check, client routes served on direct access, unknown pages get a real 404', async () => {
  const { startServer, Client } = require('./helpers');
  const s = await startServer();
  try {
    const c = new Client(s.base);
    assert.strictEqual((await c.get('/healthz')).json.ok, true);
    for (const u of ['/', '/login', '/register', '/learn', '/attempt/3', '/vocabulary', '/profile']) { const r = await c.get(u); assert.strictEqual(r.status, 200, u); assert.match(r.text, /<div id="app"/, u); }
    assert.strictEqual((await c.get('/no/such/page')).status, 404);
    assert.strictEqual((await c.get('/missing.js')).status, 404);
    const admin = await c.get('/admin'); assert.strictEqual(admin.status, 302, 'the admin panel is not public');
    assert.strictEqual((await c.get('/admin/assets/admin.js')).status, 404, 'admin assets are not public');
  } finally { await s.stop(); }
});
