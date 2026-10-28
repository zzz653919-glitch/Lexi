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
const dbPath = process.env.LEXI_DB ? path.resolve(process.env.LEXI_DB) : path.join(dataDir, 'lexi.sqlite');
const cmd = process.argv[2];

function openDb() { const db = dbLib.open(dbPath); const applied = dbLib.migrate(db); return { db, applied }; }

function prompt(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(s.includes('\n') ? '\n' : ''); }; }
    rl.question(question, (a) => { rl.close(); resolve(a); });
  });
}

(async () => {
  if (cmd === 'migrate') {
    const { applied } = openDb();
    console.log(applied.length ? 'Applied migrations: ' + applied.join(', ') : 'Database is up to date.');
  } else if (cmd === 'seed') {
    const { db } = openDb();
    const r = require('./seed').ensureSample(db);
    console.log(r.created ? `Sample content created (${r.exercises} exercises, ${r.vocabulary} words).` : 'Sample content already exists (or the database already has courses). Nothing changed.');
  } else if (cmd === 'create-admin') {
    /* The password is read from the ADMIN_PASSWORD environment variable or typed at a hidden prompt; it is never printed or stored in plain text. */
    const { db } = openDb();
    const email = (process.env.ADMIN_EMAIL || await prompt('Administrator e-mail: ')).trim().toLowerCase();
    if (!A.validateEmail(email)) { console.error('That is not a valid e-mail address.'); process.exit(1); }
    const name = (process.env.ADMIN_NAME || 'Administrator').trim();
    const password = process.env.ADMIN_PASSWORD || await prompt('Password (min 8 characters, letters and a digit): ', true);
    const problem = A.passwordProblem(password);
    if (problem) { console.error(problem); process.exit(1); }
    const s = settingsLib.make(db).all();
    const existing = db.get('SELECT * FROM users WHERE email = ?', email);
    const t = now();
    if (existing) { db.run("UPDATE users SET role = 'admin', status = 'active', password_hash = ? WHERE id = ?", A.hashPassword(password), existing.id); console.log(`Existing account ${email} is now an administrator and its password was replaced.`); }
    else { db.run("INSERT INTO users (email, display_name, password_hash, role, hearts, hearts_updated_at, created_at) VALUES (?,?,?,'admin',?,?,?)", email, name, A.hashPassword(password), s.max_hearts, t, t); console.log(`Administrator ${email} created. Sign in at /admin/login`); }
    db.run("INSERT INTO audit_log (admin_id, admin_email, action, entity, entity_id, details, created_at) VALUES (NULL, ?, 'admin.cli_create', 'user', ?, '{}', ?)", 'cli', email, t);
  } else if (cmd === 'backup') {
    const { db } = openDb();
    const dir = path.join(__dirname, '..', 'backups'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `lexi-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    console.log('Backup written to ' + file);
  } else if (cmd === 'import-legacy-vocab') {
    require('./legacy-import').run(openDb().db);
  } else {
    console.log('Usage: node server/cli.js <migrate|seed|create-admin|backup|import-legacy-vocab>');
    process.exit(cmd ? 1 : 0);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
