/* A hosted database (Turso) costs a network trip per query, so the number of queries a page needs decides how fast it feels.
   These limits keep the busiest endpoints from growing back into a long chain of queries. */
const test = require('node:test');
const assert = require('node:assert');
const dbLib = require('../../server/lib/db');
const orig = dbLib.open; let queries = 0;
dbLib.open = (...a) => { const db = orig(...a); for (const m of ['get', 'all', 'run', 'batch']) { const f = db[m].bind(db); db[m] = (...x) => { queries++; return f(...x); }; } return db; };
const { startServer, Client } = require('./helpers');

test('busy endpoints use few database queries', async () => {
  const s = await startServer({ seedKids: true, settingsTtl: 30000 });
  try {
    s.createUser({ email: 'p@example.com' });
    const c = new Client(s.base);
    const count = async (url, n) => { await c.get(url); queries = 0; const r = await c.get(url); assert.strictEqual(r.status, 200, url); assert.ok(queries <= n, `${url} used ${queries} queries (limit ${n})`); return queries; };
    await c.login('p@example.com'); await c.post('/api/me/mode', { mode: 'kids' });
    queries = 0; await c.get('/api/public/config'); assert.strictEqual(queries, 0, 'the public settings need no query');
    queries = 0; await c.get('/api/i18n/uz'); assert.strictEqual(queries, 0, 'the interface texts need no query');
    await count('/api/auth/me', 1);                // session and account in one query
    await count('/api/me/stats', 5);
    await count('/api/kids/profile', 6);           // read by every Kids page
    await count('/api/kids/overview', 11);
    await count('/api/kids/progress', 11);
    await count('/api/kids/world', 11);
    await count('/api/kids/cards', 2);
    await count('/api/kids/categories/animals', 5);
    await count('/api/dashboard', 32);
    await count('/api/me/profile', 8);
    await count('/api/me/level', 9);
  } finally { await s.stop(); }
});
