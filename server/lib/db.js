/* Database access. Two interchangeable back ends behind one asynchronous API:
     * a local SQLite file (node:sqlite, built into Node 22) – development, tests, and servers with a persistent disk;
     * a hosted libSQL / Turso database (libsql://…, https://…) over HTTP – serverless hosts such as Vercel, which have no disk.
   Every query is a bound-parameter statement.  db.tx(fn) runs fn in one write transaction; db.get/all/run calls made while fn runs
   (directly or deeper in the call chain) automatically use that transaction, so code does not pass a handle around. */
const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const URL_RE = /^(libsql|https?|wss?|file):/i;

/* a path, ':memory:' or a URL -> a URL */
function toUrl(target) {
  if (URL_RE.test(target)) return target;
  if (target === ':memory:') return 'file::memory:';
  return 'file:' + path.resolve(target);
}
const plain = (row) => { const o = {}; for (const k of Object.keys(row)) o[k] = row[k]; return o; };

/* ---------- local file ---------- */
function localBackend(url) {
  const { DatabaseSync } = require('node:sqlite');
  const file = url === 'file::memory:' ? ':memory:' : url.replace(/^file:(\/\/)?/, '');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  return {
    local: true,
    serialized: true,   // one connection: while a transaction is open, other work must wait for it
    async get(sql, args) { const r = stmt(sql).get(...args); return r ? { ...r } : undefined; },
    async all(sql, args) { return stmt(sql).all(...args).map((r) => ({ ...r })); },
    async run(sql, args) { const r = stmt(sql).run(...args); return { changes: Number(r.changes), id: Number(r.lastInsertRowid) }; },
    async exec(sql) { raw.exec(sql); },
    async begin() { raw.exec('BEGIN IMMEDIATE'); return {}; },
    async commit() { raw.exec('COMMIT'); },
    async rollback() { raw.exec('ROLLBACK'); },
    async batch(statements) { raw.exec('BEGIN IMMEDIATE'); try { for (const s of statements) stmt(s.sql).run(...s.args); raw.exec('COMMIT'); } catch (e) { try { raw.exec('ROLLBACK'); } catch (_) { /* already */ } throw e; } },
    async close() { raw.close(); },
  };
}

/* ---------- hosted libSQL / Turso over HTTP (no native module) ---------- */
function remoteBackend(url, authToken) {
  const { createClient } = require('@libsql/client/web');
  const client = createClient({ url, authToken });
  const on = (ctx) => ctx || client;
  return {
    local: false,
    serialized: false,
    async get(sql, args, ctx) { const r = (await on(ctx).execute({ sql, args })).rows[0]; return r ? plain(r) : undefined; },
    async all(sql, args, ctx) { return (await on(ctx).execute({ sql, args })).rows.map(plain); },
    async run(sql, args, ctx) { const r = await on(ctx).execute({ sql, args }); return { changes: r.rowsAffected, id: Number(r.lastInsertRowid || 0) }; },
    async exec(sql, ctx) { await on(ctx).executeMultiple(sql); },
    async begin() { return client.transaction('write'); },
    async commit(ctx) { await ctx.commit(); ctx.close(); },
    async rollback(ctx) { try { await ctx.rollback(); } finally { ctx.close(); } },
    async batch(statements) { await client.batch(statements, 'write'); },
    async close() { client.close(); },
  };
}

function open(target, { authToken = process.env.DATABASE_AUTH_TOKEN } = {}) {
  const url = toUrl(target);
  const be = url.startsWith('file:') ? localBackend(url) : remoteBackend(url, authToken);
  const als = new AsyncLocalStorage();
  /* Transactions run one at a time inside this process. With a single local connection everything else waits for an open
     transaction; with a hosted database only other transactions wait (the server isolates the rest). */
  let lock = Promise.resolve(), holders = 0;
  const gate = async () => { if (be.serialized && !als.getStore()) while (holders > 0) await lock.catch(() => {}); };

  const db = {
    url, local: be.local,
    get: async (sql, ...p) => { await gate(); return be.get(sql, p, als.getStore()); },
    all: async (sql, ...p) => { await gate(); return be.all(sql, p, als.getStore()); },
    run: async (sql, ...p) => { await gate(); return be.run(sql, p, als.getStore()); },
    /* several statements separated by semicolons (schema changes) */
    exec: async (sql) => { await gate(); return be.exec(sql, als.getStore()); },
    tx(fn) {
      if (als.getStore()) return fn(db);   // nested: join the outer transaction
      const run = async () => {
        const t = await be.begin();
        try { const r = await als.run(t, () => fn(db)); await be.commit(t); return r; }
        catch (e) { try { await be.rollback(t); } catch (_) { /* already rolled back */ } throw e; }
      };
      holders++;
      const mine = lock.catch(() => {}).then(run);
      lock = mine.catch(() => {});
      return mine.finally(() => { holders--; });
    },
    /* a list of { sql, args } that runs atomically (used for migrations) */
    batch: async (statements) => { await gate(); return be.batch(statements); },
    close: async () => be.close(),
  };
  return db;
}

/* splits a migration file into statements (the files contain only plain DDL/DML, no triggers) */
const statementsOf = (sql) => sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);

/* Applies every migrations/NNN_name.sql that has not been applied yet; each file is applied atomically.
   Safe when several server instances start at once: a loser of the race finds the migration recorded and moves on. */
async function migrate(db) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((await db.all('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const stmts = statementsOf(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).map((sql) => ({ sql, args: [] }));
    stmts.push({ sql: 'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', args: [f, new Date().toISOString()] });
    try { await db.batch(stmts); applied.push(f); }
    catch (e) { if (!(await db.get('SELECT 1 x FROM schema_migrations WHERE name = ?', f))) throw e; }
  }
  return applied;
}

module.exports = { open, migrate, toUrl };
