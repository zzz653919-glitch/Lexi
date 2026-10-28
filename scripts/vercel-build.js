#!/usr/bin/env node
/* Vercel build step:
   1. prepares the hosted database (schema migrations; the sample course on a fresh database unless LEXI_NO_SEED=1);
   2. copies the static files to vercel-static/ (served by the CDN). The admin panel and the app shell are deliberately NOT copied:
      they are served by the function, which only gives the admin panel to signed-in staff and gives unknown pages a real 404. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

(async () => {
  if (process.env.DATABASE_URL) {
    const dbLib = require('../server/lib/db');
    const db = dbLib.open(process.env.DATABASE_URL);
    try {
      const applied = await dbLib.migrate(db);
      console.log(applied.length ? 'Applied migrations: ' + applied.join(', ') : 'Database schema is up to date.');
      if (process.env.LEXI_NO_SEED !== '1') {
        const r = await require('../server/seed').ensureSample(db);
        console.log(r.created ? `Sample content created (${r.exercises} exercises, ${r.vocabulary} words).` : 'Sample content already present.');
      }
    } finally { await db.close(); }
  } else {
    console.warn('DATABASE_URL is not set: the database was not prepared. Set it in the Vercel project settings (Production and Preview).');
  }

  const out = path.join(root, 'vercel-static');
  fs.rmSync(out, { recursive: true, force: true });
  const skip = new Set(['admin', 'admin-login.html', 'index.html'].map((n) => path.join(root, 'public', n)));
  fs.cpSync(path.join(root, 'public'), out, { recursive: true, filter: (src) => !skip.has(src) });
  console.log('Static files copied to vercel-static/');
})().catch((e) => { console.error('Build failed:', e.message); process.exit(1); });
