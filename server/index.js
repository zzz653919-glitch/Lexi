const path = require('node:path');
const { createApp } = require('./app');
const seed = require('./seed');

/* Production defaults: hosting platforms set PORT (and usually NODE_ENV=production) and put an HTTPS proxy in front of the app.
   Everything can be overridden with environment variables (see docs/DEPLOYMENT.md). */
const production = process.env.NODE_ENV === 'production' || !!process.env.PORT;
const flag = (name, dflt) => (process.env[name] === undefined ? dflt : process.env[name] === '1');
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
const dataDir = process.env.LEXI_DATA_DIR ? path.resolve(process.env.LEXI_DATA_DIR) : path.join(__dirname, '..', 'data');
const dbPath = process.env.LEXI_DB ? path.resolve(process.env.LEXI_DB) : path.join(dataDir, 'lexi.sqlite');
const inst = createApp({ dbPath, dataDir, secureCookies: flag('COOKIE_SECURE', false), trustProxy: flag('TRUST_PROXY', production), publicUrl: process.env.PUBLIC_URL || '' });
if (process.env.LEXI_NO_SEED !== '1') { const r = seed.ensureSample(inst.db); if (r.created) console.log(`Sample course created (${r.exercises} exercises, ${r.vocabulary} words). Edit or remove it in the admin panel.`); }
const users = inst.db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin'").n;
const server = inst.app.listen(port, host, () => {
  console.log(`Lexi Learn is running at http://${host}:${port} (database: ${dbPath})`);
  if (!users) console.log('No administrator exists yet. Create one with:  npm run create-admin  (or set ADMIN_EMAIL / ADMIN_PASSWORD and run it once)');
});
const stop = () => server.close(() => { inst.close(); process.exit(0); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
