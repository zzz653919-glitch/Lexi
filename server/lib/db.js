/* SQLite access (node:sqlite, built into Node 22). Every query is a prepared statement with bound parameters. */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  let depth = 0;
  const db = {
    raw,
    get: (sql, ...p) => { const r = stmt(sql).get(...p); return r ? { ...r } : undefined; },
    all: (sql, ...p) => stmt(sql).all(...p).map((r) => ({ ...r })),
    run: (sql, ...p) => { const r = stmt(sql).run(...p); return { changes: Number(r.changes), id: Number(r.lastInsertRowid) }; },
    exec: (sql) => raw.exec(sql),
    /* runs fn inside one write transaction (BEGIN IMMEDIATE serialises concurrent writers); nested calls join the outer one */
    tx(fn) {
      if (depth > 0) return fn(db);
      raw.exec('BEGIN IMMEDIATE');
      depth++;
      try { const r = fn(db); raw.exec('COMMIT'); return r; } catch (e) { try { raw.exec('ROLLBACK'); } catch (_) { /* already rolled back */ } throw e; } finally { depth--; }
    },
    close: () => raw.close(),
  };
  return db;
}

/* Applies every migrations/NNN_name.sql that has not been applied yet, each in its own transaction. */
function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set(db.all('SELECT name FROM schema_migrations').map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    db.tx(() => { db.exec(sql); db.run('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', f, new Date().toISOString()); });
    applied.push(f);
  }
  return applied;
}

module.exports = { open, migrate };
