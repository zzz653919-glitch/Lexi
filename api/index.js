/* Vercel entry point: the whole Express application runs as one serverless function (see vercel.json, which sends every request here).
   The database must be a hosted libSQL / Turso database: Vercel functions have no persistent disk. */
const url = process.env.DATABASE_URL;

if (!url) {
  module.exports = (req, res) => {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Server is not configured: set the DATABASE_URL (and DATABASE_AUTH_TOKEN) environment variables in the Vercel project settings. See docs/DEPLOYMENT.md.');
  };
} else {
  const { createApp } = require('../server/app');
  const publicUrl = process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
  const inst = createApp({
    databaseUrl: url, databaseAuthToken: process.env.DATABASE_AUTH_TOKEN,
    dataDir: '/tmp/lexi',            // only used for the (best-effort) password-reset outbox log
    trustProxy: true, publicUrl, seedSample: false,
  });
  module.exports = inst.app;
}
