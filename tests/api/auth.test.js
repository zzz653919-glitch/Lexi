const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, Client } = require('./helpers');

test('registration validates input on the server', async () => {
  const s = await startServer();
  try {
    const c = new Client(s.base);
    let r = await c.post('/api/auth/register', { email: 'nope', password: 'short', displayName: '<' });
    assert.strictEqual(r.status, 400);
    assert.ok(r.json.fields.email && r.json.fields.password && r.json.fields.displayName, JSON.stringify(r.json));
    r = await c.post('/api/auth/register', { email: 'ok@example.com', password: 'onlyletters', displayName: 'Okay' });
    assert.ok(r.json.fields.password, 'a password needs a digit');
    r = await c.post('/api/auth/register', { email: 'ok@example.com', password: 'Passw0rd1', displayName: 'Okay', timezone: 'Mars/Base' });
    assert.ok(r.json.fields.timezone, 'unknown time zone rejected');
    r = await c.post('/api/auth/register', { email: 'ok@example.com', password: 'Passw0rd1', displayName: 'Okay', role: 'admin' });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.json.user.role, 'learner', 'a user can never grant themselves the admin role');
    r = await new Client(s.base).post('/api/auth/register', { email: 'OK@example.com', password: 'Passw0rd1', displayName: 'Dupe' });
    assert.strictEqual(r.status, 400); assert.ok(r.json.fields.email, 'duplicate e-mail (case-insensitive) rejected');
  } finally { await s.stop(); }
});

test('passwords are hashed, sessions are httpOnly and logout ends the session', async () => {
  const s = await startServer();
  try {
    const c = new Client(s.base);
    const reg = await fetch(s.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'h@example.com', password: 'Passw0rd1', displayName: 'Hash' }) });
    const cookie = reg.headers.getSetCookie().join(';');
    assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
    const row = s.db.get("SELECT password_hash FROM users WHERE email = 'h@example.com'");
    assert.ok(row.password_hash.startsWith('scrypt$') && !row.password_hash.includes('Passw0rd1'), 'stored as a salted scrypt hash');
    const sess = s.db.get('SELECT token_hash FROM sessions');
    assert.ok(sess.token_hash.length === 64 && !cookie.includes(sess.token_hash), 'only the hash of the session token is stored');
    await c.login('h@example.com', 'Passw0rd1');
    assert.strictEqual((await c.get('/api/me/stats')).status, 200);
    await c.post('/api/auth/logout');
    assert.strictEqual((await c.get('/api/me/stats')).status, 401);
  } finally { await s.stop(); }
});

test('login failures are generic; suspended accounts are blocked', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'a@example.com' });
    const c = new Client(s.base);
    const bad1 = await c.post('/api/auth/login', { email: 'a@example.com', password: 'wrong-pass1' });
    const bad2 = await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'wrong-pass1' });
    assert.strictEqual(bad1.status, 401); assert.strictEqual(bad2.status, 401);
    assert.strictEqual(bad1.json.error, bad2.json.error, 'same message whether or not the account exists');
    await c.login('a@example.com');
    s.db.run("UPDATE users SET status = 'suspended' WHERE email = 'a@example.com'");
    assert.strictEqual((await c.get('/api/me/stats')).status, 401, 'an existing session stops working when the account is suspended');
    const r = await new Client(s.base).post('/api/auth/login', { email: 'a@example.com', password: 'Passw0rd!x' });
    assert.strictEqual(r.status, 403);
  } finally { await s.stop(); }
});

test('CSRF: writes need the session token and a same-origin Origin', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'c@example.com' });
    const c = new Client(s.base); await c.login('c@example.com');
    const noToken = await fetch(s.base + '/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: c.cookie }, body: JSON.stringify({ displayName: 'Hacked' }) });
    assert.strictEqual(noToken.status, 403);
    const badOrigin = await fetch(s.base + '/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: c.cookie, 'X-CSRF-Token': c.csrf, Origin: 'https://evil.example' }, body: JSON.stringify({ displayName: 'Hacked' }) });
    assert.strictEqual(badOrigin.status, 403);
    const loginCsrf = await fetch(s.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ email: 'c@example.com', password: 'Passw0rd!x' }) });
    assert.strictEqual(loginCsrf.status, 403, 'cross-site login is blocked too');
    assert.strictEqual((await c.patch('/api/me', { displayName: 'Fine Name' })).status, 200);
  } finally { await s.stop(); }
});

test('password recovery: token works once, expires, and signs out other sessions', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'r@example.com' });
    const other = new Client(s.base); await other.login('r@example.com');
    const c = new Client(s.base);
    const none = await c.post('/api/auth/forgot', { email: 'ghost@example.com' });
    assert.strictEqual(none.status, 200, 'same answer for unknown addresses');
    assert.strictEqual((await c.post('/api/auth/forgot', { email: 'r@example.com' })).status, 200);
    const log = fs.readFileSync(path.join(s.dir, 'outbox', 'password-resets.log'), 'utf8');
    const token = /reset\?token=([\w-]+)/.exec(log)[1];
    assert.strictEqual((await c.post('/api/auth/reset', { token, password: 'short' })).status, 400);
    assert.strictEqual((await c.post('/api/auth/reset', { token, password: 'NewPassw0rd' })).status, 200);
    assert.strictEqual((await c.post('/api/auth/reset', { token, password: 'Another1Pass' })).status, 400, 'the link works only once');
    assert.strictEqual((await other.get('/api/me/stats')).status, 401, 'old sessions are signed out');
    await new Client(s.base).login('r@example.com', 'NewPassw0rd');
    // an expired link is refused
    await c.post('/api/auth/forgot', { email: 'r@example.com' });
    const t3 = /reset\?token=([\w-]+)\s*$/.exec(fs.readFileSync(path.join(s.dir, 'outbox', 'password-resets.log'), 'utf8'))[1];
    s.db.run("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00.000Z'");
    assert.strictEqual((await c.post('/api/auth/reset', { token: t3, password: 'Expired1Pass' })).status, 400, 'expired link refused');
    const t2 = 'x'.repeat(40);
    assert.strictEqual((await c.post('/api/auth/reset', { token: t2, password: 'NewPassw0rd' })).status, 400);
  } finally { await s.stop(); }
});

test('login and registration are rate limited', async () => {
  const s = await startServer({ rateLimit: true });
  try {
    s.createUser({ email: 'l@example.com' });
    const c = new Client(s.base);
    let last;
    for (let i = 0; i < 9; i++) last = await c.post('/api/auth/login', { email: 'l@example.com', password: 'wrong-pass1' });
    assert.strictEqual(last.status, 429);
    const ok = await new Client(s.base).post('/api/auth/login', { email: 'l@example.com', password: 'Passw0rd!x' });
    assert.strictEqual(ok.status, 429, 'even the right password is refused while locked out');
  } finally { await s.stop(); }
});

test('profile updates are validated and the password can be changed', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'p@example.com' });
    const c = new Client(s.base); await c.login('p@example.com');
    let r = await c.patch('/api/me', { dailyGoalXp: 3 }); assert.strictEqual(r.status, 400);
    r = await c.patch('/api/me', { displayName: 'New Name', dailyGoalXp: 50, avatar: 'moon', timezone: 'Asia/Tashkent', leaderboardOptIn: true });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.json.user.displayName, 'New Name'); assert.strictEqual(r.json.user.dailyGoalXp, 50);
    assert.strictEqual((await c.patch('/api/me', { avatar: 'evil.png' })).status, 400);
    r = await c.post('/api/me/password', { currentPassword: 'nope', newPassword: 'NewPassw0rd' }); assert.strictEqual(r.status, 400);
    r = await c.post('/api/me/password', { currentPassword: 'Passw0rd!x', newPassword: 'NewPassw0rd' }); assert.strictEqual(r.status, 200);
    await new Client(s.base).login('p@example.com', 'NewPassw0rd');
    assert.ok(!JSON.stringify((await c.get('/api/me/profile')).json).includes('password'), 'no password data is exposed');
  } finally { await s.stop(); }
});
