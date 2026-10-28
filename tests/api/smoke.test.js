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
