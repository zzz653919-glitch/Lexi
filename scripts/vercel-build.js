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

  // the admin panel is packed into a JSON file that the function serves to signed-in staff (see server/app.js)
  const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const bundle = {};
  const add = (abs, rel) => { bundle[rel] = { type: types[path.extname(abs)] || 'application/octet-stream', data: fs.readFileSync(abs).toString('base64') }; };
  const walkDir = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const abs = path.join(dir, e.name), r = rel + '/' + e.name; if (e.isDirectory()) walkDir(abs, r); else add(abs, r); } };
  walkDir(path.join(root, 'public', 'admin'), 'admin');
  add(path.join(root, 'public', 'admin-login.html'), 'admin-login.html');
  fs.mkdirSync(path.join(root, 'server', 'generated'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'generated', 'admin-bundle.json'), JSON.stringify(bundle));
  console.log(`Admin panel packed (${Object.keys(bundle).length} files).`);
})().catch((e) => { console.error('Build failed:', e.message); process.exit(1); });
