/* A small SYNCHRONOUS handle on the same SQLite file the server uses (node:sqlite), so tests can seed rows and assert on the
   database without awaiting. The application itself only uses the asynchronous libSQL layer. */
const { DatabaseSync } = require('node:sqlite');

function open(file) {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  return {
    raw,
    get: (sql, ...p) => { const r = raw.prepare(sql).get(...p); return r ? { ...r } : undefined; },
    all: (sql, ...p) => raw.prepare(sql).all(...p).map((r) => ({ ...r })),
    run: (sql, ...p) => { const r = raw.prepare(sql).run(...p); return { changes: Number(r.changes), id: Number(r.lastInsertRowid) }; },
    exec: (sql) => raw.exec(sql),
    close: () => raw.close(),
  };
}
module.exports = { open };
