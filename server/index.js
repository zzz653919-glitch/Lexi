const { createApp } = require('./app');
const seed = require('./seed');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const inst = createApp({ secureCookies: process.env.COOKIE_SECURE === '1', trustProxy: process.env.TRUST_PROXY === '1', publicUrl: process.env.PUBLIC_URL || '' });
if (process.env.LEXI_NO_SEED !== '1') { const r = seed.ensureSample(inst.db); if (r.created) console.log(`Sample course created (${r.exercises} exercises, ${r.vocabulary} words). Edit or remove it in the admin panel.`); }
const users = inst.db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin'").n;
const server = inst.app.listen(port, host, () => {
  console.log(`Lexi Learn is running at http://${host}:${port}`);
  if (!users) console.log('No administrator exists yet. Create one with:  npm run create-admin');
});
const stop = () => server.close(() => { inst.close(); process.exit(0); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
