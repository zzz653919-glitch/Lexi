const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const Module = require('node:module');
const dbLib = require('../../server/lib/db');

/* A stand-in for @libsql/client/web (the HTTP client used for a hosted Turso database), backed by a local SQLite file, so the
   remote code path of the database layer (client.execute / transaction / batch / executeMultiple) is exercised without a network. */
function fakeLibsql(file) {
  const raw = new DatabaseSync(file); raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const result = (sql, args) => {
    const st = raw.prepare(sql);
    if (/^\s*(select|pragma|with)/i.test(sql)) return { rows: st.all(...args), rowsAffected: 0, lastInsertRowid: undefined };
    const r = st.run(...args); return { rows: [], rowsAffected: Number(r.changes), lastInsertRowid: BigInt(r.lastInsertRowid) };
  };
  const exec = async ({ sql, args = [] }) => result(sql, args);
  return {
    execute: exec,
    executeMultiple: async (sql) => raw.exec(sql),
    batch: async (stmts) => { raw.exec('BEGIN'); try { for (const s of stmts) result(s.sql, s.args); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
    transaction: async () => { raw.exec('BEGIN IMMEDIATE'); return { execute: exec, commit: async () => raw.exec('COMMIT'), rollback: async () => raw.exec('ROLLBACK'), close() {} }; },
    close() { raw.close(); },
  };
}
function openRemoteLike(file) {
  const id = require.resolve('@libsql/client/web');
  const saved = require.cache[id];
  require.cache[id] = { id, filename: id, loaded: true, exports: { createClient: () => fakeLibsql(file) }, children: [], paths: [] };
  try { return dbLib.open('libsql://example.invalid', { authToken: 'x' }); } finally { if (saved) require.cache[id] = saved; else delete require.cache[id]; }
}
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-db-')), 'x.sqlite');
const backends = { 'local file': (f) => dbLib.open(f), 'hosted (libSQL over HTTP, simulated)': (f) => openRemoteLike(f) };

for (const [name, make] of Object.entries(backends)) {
  test(`database layer – ${name}: queries, transactions, isolation`, async () => {
    const f = tmp(); const db = make(f);
    try {
      await dbLib.migrate(db);
      assert.deepStrictEqual(await dbLib.migrate(db), [], 'migrations are repeatable');
      const r = await db.run("INSERT INTO settings (key, value) VALUES ('a', '1')");
      assert.strictEqual(r.changes, 1); assert.ok(typeof r.id === 'number');
      assert.deepStrictEqual(await db.get("SELECT key, value FROM settings WHERE key = 'a'"), { key: 'a', value: '1' });
      assert.strictEqual(await db.get("SELECT 1 FROM settings WHERE key = 'nope'"), undefined);
      assert.deepStrictEqual((await db.all('SELECT key FROM settings ORDER BY key')).map((x) => x.key), ['a']);
      // commit, rollback and nesting
      await db.tx(async () => { await db.run("INSERT INTO settings (key, value) VALUES ('b', '1')"); await db.tx(async () => { await db.run("INSERT INTO settings (key, value) VALUES ('c', '1')"); }); });
      await assert.rejects(db.tx(async () => { await db.run("INSERT INTO settings (key, value) VALUES ('d', '1')"); throw new Error('boom'); }), /boom/);
      assert.deepStrictEqual((await db.all('SELECT key FROM settings ORDER BY key')).map((x) => x.key), ['a', 'b', 'c'], 'a failed transaction leaves nothing behind');
      // many concurrent read-modify-write transactions must not lose updates
      await db.run("INSERT INTO settings (key, value) VALUES ('n', '0')");
      await Promise.all(Array.from({ length: 40 }, () => db.tx(async () => { const cur = Number((await db.get("SELECT value FROM settings WHERE key = 'n'")).value); await new Promise((res) => setTimeout(res, 1)); await db.run("UPDATE settings SET value = ? WHERE key = 'n'", String(cur + 1)); })));
      assert.strictEqual((await db.get("SELECT value FROM settings WHERE key = 'n'")).value, '40');
      // (the simulated hosted database shares one connection, so this check is only meaningful for the local file)
      if (db.local) {
      // a plain write made during someone else's transaction is not swallowed by it, and a rolled-back transaction does not leak it
      const slow = db.tx(async () => { await db.run("INSERT INTO settings (key, value) VALUES ('t1', '1')"); await new Promise((res) => setTimeout(res, 30)); throw new Error('undo'); }).catch(() => {});
      await new Promise((res) => setTimeout(res, 5));
      await db.run("INSERT INTO settings (key, value) VALUES ('plain', '1')");
      await slow;
      assert.ok(await db.get("SELECT 1 x FROM settings WHERE key = 'plain'"), 'the plain write survived');
      assert.strictEqual(await db.get("SELECT 1 x FROM settings WHERE key = 't1'"), undefined, 'the rolled-back write did not');
      }
      await assert.rejects(db.batch([{ sql: "INSERT INTO settings (key, value) VALUES ('x1', '1')", args: [] }, { sql: 'INSERT INTO nope VALUES (1)', args: [] }]));
      assert.strictEqual(await db.get("SELECT 1 x FROM settings WHERE key = 'x1'"), undefined, 'batches are atomic');
    } finally { await db.close(); }
  });
}

test('rate limiter is stored in the database and honours its window', async () => {
  const A = require('../../server/lib/auth');
  const f = tmp(); const db = dbLib.open(f);
  try {
    await dbLib.migrate(db);
    const l = A.limiter(db, 'login', 3, 60000, true);
    assert.deepStrictEqual([await l.take('k'), await l.take('k'), await l.take('k'), await l.take('k')], [true, true, true, false]);
    assert.strictEqual(await l.take('other'), true, 'keys are independent');
    await l.clear('k'); assert.strictEqual(await l.take('k'), true);
    await db.run("UPDATE rate_limits SET reset_at = 1");
    assert.strictEqual(await l.take('other'), true, 'an expired window starts over');
  } finally { await db.close(); }
});

test('uploaded audio is stored in the database and served from there', async () => {
  const { startServer, Client } = require('./helpers');
  const s = await startServer();
  try {
    s.createUser({ email: 'ad@x.com', role: 'admin' }); const c = new Client(s.base); await c.login('ad@x.com');
    const mp3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]), Buffer.alloc(200, 1)]);
    const up = await c.req('POST', '/api/admin/uploads', mp3, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'a.mp3' } });
    assert.strictEqual(up.status, 201, up.text);
    const row = s.db.get('SELECT data, size FROM uploads LIMIT 1'); assert.ok(row.data && row.size === mp3.length);
    assert.ok(!fs.existsSync(path.join(s.dir, 'uploads')), 'nothing is written to the disk');
    const res = await fetch(s.base + up.json.url); assert.strictEqual(res.status, 200); assert.strictEqual(res.headers.get('content-type'), 'audio/mpeg');
    assert.deepStrictEqual(Buffer.from(await res.arrayBuffer()), mp3);
  } finally { await s.stop(); }
});
