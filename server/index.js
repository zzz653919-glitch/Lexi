const path = require('node:path');
const { createApp } = require('./app');

/* Production defaults: hosting platforms set PORT (and usually NODE_ENV=production) and put an HTTPS proxy in front of the app.
   Everything can be overridden with environment variables (see docs/DEPLOYMENT.md). */
const production = process.env.NODE_ENV === 'production' || !!process.env.PORT;
const flag = (name, dflt) => (process.env[name] === undefined ? dflt : process.env[name] === '1');
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
const dataDir = process.env.LEXI_DATA_DIR ? path.resolve(process.env.LEXI_DATA_DIR) : path.join(__dirname, '..', 'data');
const dbPath = process.env.LEXI_DB ? path.resolve(process.env.LEXI_DB) : path.join(dataDir, 'lexi.sqlite');
const inst = createApp({
  dbPath, dataDir, databaseUrl: process.env.DATABASE_URL, databaseAuthToken: process.env.DATABASE_AUTH_TOKEN,
  secureCookies: flag('COOKIE_SECURE', false), trustProxy: flag('TRUST_PROXY', production), publicUrl: process.env.PUBLIC_URL || '',
  seedSample: process.env.LEXI_NO_SEED !== '1',
});

(async () => {
  await inst.init();   // migrations (and the sample course on a fresh database)
  const seeded = inst.seeded();
  if (seeded && seeded.created) console.log(`Sample course created (${seeded.exercises} exercises, ${seeded.vocabulary} words). Edit or remove it in the admin panel.`);
  const admins = (await inst.db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin'")).n;
  const server = inst.app.listen(port, host, () => {
    console.log(`Lexi Learn is running at http://${host}:${port} (database: ${inst.db.url.replace(/\/\/[^@/]*@/, '//')})`);
    if (!admins) console.log('No administrator exists yet. Create one with:  npm run create-admin  (or set ADMIN_EMAIL / ADMIN_PASSWORD and run it once)');
  });
  const stop = () => server.close(async () => { await inst.close(); process.exit(0); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error('Could not start:', e.message); process.exit(1); });
