#!/usr/bin/env node
/* Command line helpers:  migrate | seed | create-admin | backup | import-legacy-vocab */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const dbLib = require('./lib/db');
const A = require('./lib/auth');
const { now } = require('./lib/util');
const settingsLib = require('./lib/settings');

const dataDir = process.env.LEXI_DATA_DIR ? path.resolve(process.env.LEXI_DATA_DIR) : path.join(__dirname, '..', 'data');
/* DATABASE_URL (libsql://… for a hosted Turso database, or file:…) wins; otherwise a local file (LEXI_DB / LEXI_DATA_DIR) is used */
const dbTarget = process.env.DATABASE_URL || (process.env.LEXI_DB ? path.resolve(process.env.LEXI_DB) : path.join(dataDir, 'lexi.sqlite'));
const cmd = process.argv[2];

async function openDb() { const db = dbLib.open(dbTarget); const applied = await dbLib.migrate(db); return { db, applied }; }

function prompt(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(s.includes('\n') ? '\n' : ''); }; }
    rl.question(question, (a) => { rl.close(); resolve(a); });
  });
}

(async () => {
  if (cmd === 'migrate') {
    const { applied } = await openDb();
    console.log(applied.length ? 'Applied migrations: ' + applied.join(', ') : 'Database is up to date.');
  } else if (cmd === 'seed') {
    const { db } = await openDb();
    const r = await require('./seed').ensureSample(db);
    console.log(r.created ? `Sample content created (${r.exercises} exercises, ${r.vocabulary} words).` : 'Sample content already exists (or the database already has courses). Nothing changed.');
  } else if (cmd === 'create-admin') {
    /* The password is read from the ADMIN_PASSWORD environment variable or typed at a hidden prompt; it is never printed or stored in plain text. */
    const { db } = await openDb();
    const email = (process.env.ADMIN_EMAIL || await prompt('Administrator e-mail: ')).trim().toLowerCase();
    if (!A.validateEmail(email)) { console.error('That is not a valid e-mail address.'); process.exit(1); }
    const name = (process.env.ADMIN_NAME || 'Administrator').trim();
    const password = process.env.ADMIN_PASSWORD || await prompt('Password (min 8 characters, letters and a digit): ', true);
    const problem = A.passwordProblem(password);
    if (problem) { console.error(problem); process.exit(1); }
    const settings = settingsLib.make(db); await settings.refresh(true); const s = settings.all();
    const existing = await db.get('SELECT * FROM users WHERE email = ?', email);
    const t = now();
    if (existing) { await db.run("UPDATE users SET role = 'admin', status = 'active', password_hash = ? WHERE id = ?", A.hashPassword(password), existing.id); console.log(`Existing account ${email} is now an administrator and its password was replaced.`); }
    else { await db.run("INSERT INTO users (email, display_name, password_hash, role, hearts, hearts_updated_at, created_at) VALUES (?,?,?,'admin',?,?,?)", email, name, A.hashPassword(password), s.max_hearts, t, t); console.log(`Administrator ${email} created. Sign in at /admin/login`); }
    await db.run("INSERT INTO audit_log (admin_id, admin_email, action, entity, entity_id, details, created_at) VALUES (NULL, ?, 'admin.cli_create', 'user', ?, '{}', ?)", 'cli', email, t);
  } else if (cmd === 'backup') {
    const { db } = await openDb();
    const dir = path.join(__dirname, '..', 'backups'); fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (db.local) {
      const file = path.join(dir, `lexi-${stamp}.sqlite`);
      await db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      console.log('Backup written to ' + file);
    } else {
      // a hosted database: write every table to one JSON file (Turso also offers its own point-in-time backups)
      const dump = {};
      for (const { name } of await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'sessions'")) dump[name] = await db.all(`SELECT * FROM "${name}"`);
      const file = path.join(dir, `lexi-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify(dump), { mode: 0o600 });
      console.log('Backup written to ' + file + ' (all tables except sessions)');
    }
  } else if (cmd === 'import-legacy-vocab') {
    await require('./legacy-import').run((await openDb()).db);
  } else {
    console.log('Usage: node server/cli.js <migrate|seed|create-admin|backup|import-legacy-vocab>');
    process.exit(cmd ? 1 : 0);
  }
})().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
