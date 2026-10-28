const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { startServer, Client, playAttempt } = require('./helpers');
const { createApp } = require('../../server/app');
const seed = require('../../server/seed');

test('security headers on pages and API', async () => {
  const s = await startServer();
  try {
    for (const url of ['/', '/api/public/config', '/login']) {
      const r = await fetch(s.base + url);
      assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff', url); assert.strictEqual(r.headers.get('x-frame-options'), 'DENY', url);
      const csp = r.headers.get('content-security-policy'); assert.ok(csp.includes("script-src 'self'") && !/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp) && csp.includes("frame-ancestors 'none'"), url);
      assert.strictEqual(r.headers.get('x-powered-by'), null);
    }
    assert.strictEqual((await fetch(s.base + '/api/public/config')).headers.get('cache-control'), 'no-store');
  } finally { await s.stop(); }
});

test('errors never leak internals; malformed and oversized input is handled', async () => {
  const s = await startServer({});
  try {
    const bad = await fetch(s.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email": ' });
    assert.strictEqual(bad.status, 400); const j = await bad.json(); assert.ok(!/at |node_modules|SyntaxError/.test(JSON.stringify(j)), JSON.stringify(j));
    const big = await fetch(s.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(300000) }) });
    assert.strictEqual(big.status, 413);
    assert.strictEqual((await fetch(s.base + '/api/nope')).status, 401, 'unknown API paths do not reveal anything to anonymous visitors');
    const c = new Client(s.base); s.createUser({ email: 'u@example.com' }); await c.login('u@example.com');
    const unk = await c.get('/api/does-not-exist'); assert.strictEqual(unk.status, 404); assert.strictEqual(unk.json.error, 'Not found.');
    const inj = await new Client(s.base).post('/api/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" }); assert.strictEqual(inj.status, 401);
    assert.strictEqual((await c.post('/api/lessons/abc/start')).status, 404);
    assert.strictEqual((await c.post('/api/attempts/1e9/answer', { exerciseId: 1, answer: 1 })).status, 404);
    // an internal failure returns a reference, not a stack trace
    s.db.raw.exec('DROP TABLE xp_transactions');
    const path0 = (await c.get('/api/path')).json; const st = (await c.post(`/api/lessons/${path0.levels[0].units[0].lessons[0].id}/start`)).json;
    const boom = await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: s.db.get('SELECT id FROM exercise_options WHERE exercise_id = ? AND is_correct = 1', st.exercise.id).id });
    assert.strictEqual(boom.status, 500); assert.match(boom.json.error, /ref [a-z0-9]+/); assert.ok(!/xp_transactions|sqlite|at /i.test(boom.text), boom.text);
  } finally { await s.stop(); }
});

test('data survives an application restart; migrations are repeatable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-restart-'));
  const dbPath = path.join(dir, 'lexi.sqlite');
  const boot = async () => { const inst = createApp({ dbPath, dataDir: dir, rateLimit: false, quiet: true }); seed.ensureSample(inst.db); const server = await new Promise((r) => { const sv = inst.app.listen(0, '127.0.0.1', () => r(sv)); }); return { inst, server, base: 'http://127.0.0.1:' + server.address().port }; };
  const stop = async (x) => { await new Promise((r) => x.server.close(r)); x.inst.close(); };
  try {
    let x = await boot();
    const c = new Client(x.base);
    await c.post('/api/auth/register', { email: 'p@example.com', password: 'Passw0rd1', displayName: 'Persist' });
    const path0 = (await c.get('/api/path')).json; const st = (await c.post(`/api/lessons/${path0.levels[0].units[0].lessons[0].id}/start`)).json;
    await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: x.inst.db.get('SELECT id FROM exercise_options WHERE exercise_id = ? AND is_correct = 1', st.exercise.id).id });
    const courses = x.inst.db.get('SELECT COUNT(*) n FROM courses').n, exercises = x.inst.db.get('SELECT COUNT(*) n FROM exercises').n;
    await stop(x);
    x = await boot();   // "restart"
    assert.strictEqual(x.inst.db.get('SELECT COUNT(*) n FROM courses').n, courses, 'the sample course is not duplicated'); assert.strictEqual(x.inst.db.get('SELECT COUNT(*) n FROM exercises').n, exercises);
    const again = new Client(x.base); assert.strictEqual((await again.get('/api/me/stats')).status, 401, 'cookies of another client are not shared');
    await again.login('p@example.com', 'Passw0rd1');
    const dash = (await again.get('/api/dashboard')).json; assert.strictEqual(dash.today.xp, 10); assert.strictEqual(dash.user.xpTotal, 10);
    const resumed = (await again.post(`/api/lessons/${path0.levels[0].units[0].lessons[0].id}/start`)).json; assert.strictEqual(resumed.attemptId, st.attemptId); assert.strictEqual(resumed.position, 1, 'the lesson resumes where it stopped');
    assert.deepStrictEqual(require('../../server/lib/db').migrate(x.inst.db), [], 'no migration runs twice');
    assert.strictEqual(x.inst.db.get('SELECT COUNT(*) n FROM schema_migrations').n, 1);
    await stop(x);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('command line: create-admin (environment password), seed, backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-cli-'));
  const env = { ...process.env, LEXI_DB: path.join(dir, 'cli.sqlite'), ADMIN_EMAIL: 'root@example.com', ADMIN_PASSWORD: 'Sup3rSecret!' };
  const run = (...a) => execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', '..', 'server', 'cli.js'), ...a], { env, encoding: 'utf8', cwd: path.join(__dirname, '..', '..') });
  try {
    assert.match(run('migrate'), /Applied migrations/);
    assert.match(run('create-admin'), /Administrator root@example.com created/);
    const { open } = require('../../server/lib/db'); const A = require('../../server/lib/auth');
    const db = open(path.join(dir, 'cli.sqlite'));
    const u = db.get("SELECT * FROM users WHERE email = 'root@example.com'");
    assert.strictEqual(u.role, 'admin'); assert.ok(A.verifyPassword('Sup3rSecret!', u.password_hash)); assert.ok(!u.password_hash.includes('Sup3rSecret'));
    assert.strictEqual(db.get("SELECT COUNT(*) n FROM audit_log WHERE action = 'admin.cli_create'").n, 1); db.close();
    assert.match(run('seed'), /Sample content created/); assert.match(run('seed'), /already exists/);
    const out = run('backup'); assert.match(out, /Backup written/);
    assert.throws(() => execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', '..', 'server', 'cli.js'), 'create-admin'], { env: { ...env, ADMIN_PASSWORD: 'weak' }, stdio: 'pipe' }), /./);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); const b = path.join(__dirname, '..', '..', 'backups'); if (fs.existsSync(b)) fs.readdirSync(b).filter((f) => f.startsWith('lexi-')).forEach((f) => fs.rmSync(path.join(b, f))); }
});

test('the legacy v1 app is not reachable from the new site', async () => {
  const s = await startServer();
  try {
    for (const url of ['/legacy/lexi-v1/index.html', '/index.html', '/js/lesson-engine.js', '/css/lesson.css.bak', '/server/app.js', '/data/lexi.sqlite', '/package.json', '/../package.json']) {
      const r = await fetch(s.base + url);
      assert.ok(r.status === 404 || (r.headers.get('content-type') || '').includes('text/html'), `${url} -> ${r.status} ${r.headers.get('content-type')}`);
      if (r.status === 200) assert.ok((await r.text()).includes('id="app"'), `${url} serves only the app shell`);
    }
    const idx = await (await fetch(s.base + '/')).text();
    assert.ok(!/Lug.at|Mening lug|sessiya/i.test(idx), 'no old-site markup');
  } finally { await s.stop(); }
});
