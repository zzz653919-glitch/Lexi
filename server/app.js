require('./lib/async-routes');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const dbLib = require('./lib/db');
const settingsLib = require('./lib/settings');
const authLib = require('./lib/auth');
const coreLib = require('./lib/core');
const attemptsLib = require('./lib/attempts');
const reviewLib = require('./lib/review');
const learningLib = require('./lib/learning');
const assessmentLib = require('./lib/assessment');
const dailyLib = require('./lib/daily');
const i18nLib = require('./lib/i18n');
const coreI18n = require('../shared/i18n-core');
const seed = require('./seed');
const { now, HttpError } = require('./lib/util');

const PUBLIC = path.join(__dirname, '..', 'public');

function createApp(options = {}) {
  const opts = {
    dbPath: path.join(__dirname, '..', 'data', 'lexi.sqlite'), dataDir: path.join(__dirname, '..', 'data'),
    rateLimit: true, quiet: false, secureCookies: false, publicUrl: '', trustProxy: false, seedSample: false, settingsTtl: 15000, ...options,
  };
  const db = dbLib.open(opts.databaseUrl || opts.dbPath, { authToken: opts.databaseAuthToken });
  const settings = settingsLib.make(db, { ttl: opts.settingsTtl });
  const auth = authLib.make(db, { secureCookies: opts.secureCookies });
  const i18n = i18nLib.make(db, settings, { ttl: opts.settingsTtl });
  const core = coreLib.make(db, settings);
  const learning = learningLib.make(db, settings);
  const attempts = attemptsLib.make(db, settings, core, learning);
  const review = reviewLib.make(db, settings, core, learning);
  const assessment = assessmentLib.make(db, settings, learning);
  const daily = dailyLib.make(db, settings, core, review, learning);
  const audit = async (req, action, entity, entityId, details) => db.run('INSERT INTO audit_log (admin_id, admin_email, action, entity, entity_id, details, created_at) VALUES (?,?,?,?,?,?,?)', req.user.id, req.user.email, action, entity, String(entityId == null ? '' : entityId), JSON.stringify(details || {}).slice(0, 2000), now());
  const ctx = { db, settings, auth, core, attempts, review, audit, opts, i18n, learning, assessment, daily };

  /* One-time start-up work, done lazily on the first request that needs the database (so a serverless cold start or a database that is
     briefly unreachable does not crash the process): schema migrations, optional sample content, first read of settings and texts. */
  let ready = null, seeded = null, lastInitError = null;
  const init = () => {
    if (!ready) ready = (async () => {
      await dbLib.migrate(db);
      if (opts.seedSample) seeded = await seed.ensureSample(db);
      // built-in test content is optional: if it cannot be written right now the site still opens (it is retried on the next start)
      try { await seed.ensureAssessmentContent(db); } catch (e) { if (!opts.quiet) console.error('[seed] placement content:', e.message); }
      await Promise.all([settings.refresh(true), i18n.refresh(true)]);
    })().then(() => { lastInitError = null; }, (e) => { ready = null; lastInitError = e; throw e; });
    return ready;
  };
  const dbReady = async (req, res, next) => { await init(); await Promise.all([settings.refresh(), i18n.refresh()]); next(); };

  const app = express();
  app.disable('x-powered-by');
  if (opts.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });

  /* health check for hosting platforms and uptime monitors (no authentication, no data) */
  app.get('/healthz', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { await db.get('SELECT 1 x'); } catch (e) { return res.status(503).json({ ok: false }); }
    if (req.query.full === '1') {   // diagnostics for the site owner: does the schema and start-up work? (never prints secrets)
      const started = Date.now();
      try { await init(); res.json({ ok: true, ready: true, ms: Date.now() - started }); }
      catch (e) { res.status(503).json({ ok: false, ready: false, ms: Date.now() - started, error: String(e && e.message || e).replace(/libsql:\/\/\S+/g, '[database]').slice(0, 300) }); }
      return;
    }
    res.json({ ok: true });
  });
  app.use(['/api', '/admin', '/uploads'], dbReady);

  /* ---------- uploaded audio (public, fixed content type from the database) ---------- */
  app.get('/shared/i18n-core.js', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.type('application/javascript').sendFile(path.join(__dirname, '..', 'shared', 'i18n-core.js')); });
  app.get('/uploads/:id', async (req, res) => {
    const u = /^[A-Za-z0-9_-]{6,40}$/.test(req.params.id) ? await db.get('SELECT * FROM uploads WHERE id = ?', req.params.id) : null;
    if (!u) return res.status(404).end();
    let body = u.data ? Buffer.from(u.data, 'base64') : null;
    if (!body) { const file = path.join(opts.dataDir, 'uploads', u.id); if (fs.existsSync(file)) body = fs.readFileSync(file); }   // files stored by earlier versions
    if (!body) return res.status(404).end();
    res.setHeader('Content-Type', u.mime); res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(body);
  });

  /* ---------- API ---------- */
  const api = express.Router();
  api.use('/admin', express.json({ limit: '4mb' }));
  api.use(express.json({ limit: '100kb' }));
  api.use(auth.attach);
  api.use((req, res, next) => { req.lang = i18n.languageFor(req); req.t = (key, params) => i18n.tr(req.lang, key, params); next(); });
  api.use(auth.csrf);
  api.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  const languages = () => coreI18n.LANGUAGES.filter((l) => settings.all().supported_languages.includes(l.code)).map(({ code, name, flag, label }) => ({ code, name, flag, label }));
  api.get('/public/config', (req, res) => {
    const s = settings.all();
    res.json({ siteName: s.site_name, tagline: s.tagline, brandColor: s.brand_color, registrationOpen: s.registration_open, languages: languages(), defaultLanguage: i18n.defaultLanguage(), defaultTranslationLanguage: s.default_translation_language, maintenance: s.maintenance_mode ? (s.maintenance_message || req.t('msg.maintenance')) : null });
  });
  /* the interface texts of one language (administrator overrides applied); missing texts are filled from English */
  api.get('/i18n/:lang', (req, res, next) => {
    const lang = String(req.params.lang).toLowerCase();
    if (!coreI18n.isSupported(lang)) return next(new HttpError(404, 'err.not_found'));
    const d = i18n.dicts();
    const body = { lang, messages: d[lang], fallback: lang === coreI18n.FALLBACK ? {} : d[coreI18n.FALLBACK] };
    res.setHeader('Cache-Control', 'no-cache');
    res.json(body);
  });
  // maintenance mode: only staff (and the sign-in endpoints they need) get through
  api.use((req, res, next) => {
    if (!settings.all().maintenance_mode) return next();
    if (req.user && ['admin', 'editor'].includes(req.user.role)) return next();
    if (/^\/auth\/(login|logout|me)$/.test(req.path)) return next();
    next(HttpError.raw(503, settings.all().maintenance_message || req.t('msg.maintenance')));
  });
  api.use('/auth', require('./routes/auth')(ctx));
  api.use('/admin', require('./routes/admin-content')(ctx));
  api.use('/admin', require('./routes/admin-assessment')(ctx));
  api.use('/admin', require('./routes/admin-manage')(ctx));
  api.use('/admin', require('./routes/admin-i18n')(ctx));
  api.use('/', require('./routes/learning')(ctx));
  api.use('/', require('./routes/learner')(ctx));
  api.use((req, res, next) => next(new HttpError(404, 'err.not_found')));
  app.use('/api', api);

  /* ---------- admin panel: the app and its assets are only served to signed-in staff ---------- */
  const staffOnly = (req, res, next) => {
    if (req.user && ['admin', 'editor'].includes(req.user.role)) return next();
    if (req.path.startsWith('/assets/')) return res.status(404).end();
    res.redirect('/admin/login');
  };
  const sessionOnly = [auth.attach];
  /* Serverless hosts transpile .js files that are bundled with a function, which would break the browser (ES module) code of the admin
     panel. The build therefore packs the admin files into server/generated/admin-bundle.json (base64, never transpiled); when that
     file exists the admin panel is served from it, otherwise straight from public/. */
  let bundle = null;
  try { bundle = require('./generated/admin-bundle.json'); } catch (_) { /* served from disk */ }
  const sendAdmin = (res, rel) => {
    if (!bundle) return res.sendFile(path.join(PUBLIC, rel));
    const f = bundle[rel];
    if (!f) return res.status(404).end();
    return res.type(f.type).send(Buffer.from(f.data, 'base64'));
  };
  app.get('/admin/login', sessionOnly, (req, res) => { res.setHeader('Cache-Control', 'no-store'); sendAdmin(res, 'admin-login.html'); });
  app.use('/admin', sessionOnly, staffOnly, (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); },
    (req, res, next) => { if (bundle && req.method === 'GET' && bundle['admin' + req.path]) return sendAdmin(res, 'admin' + req.path); next(); },
    express.static(path.join(PUBLIC, 'admin'), { index: false, redirect: false, fallthrough: true }),
    (req, res) => sendAdmin(res, 'admin/index.html'));

  /* ---------- learner app ---------- */
  app.use(express.static(PUBLIC, { index: false, redirect: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  /* client-side routes of the single-page app: opening one directly (or reloading it) serves the app shell;
     any other path still gets the shell (so the app can show its own "page not found" screen) but with a real 404 status */
  const CLIENT_ROUTES = /^\/(?:login|register|forgot|reset|learn|welcome|placement|results|daily\/[^/]+|attempt\/[^/]+|practice|vocabulary|review|leaderboard|achievements|profile)?\/?$/;
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res, next) => {
    if (path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.status(CLIENT_ROUTES.test(req.path) ? 200 : 404).sendFile(path.join(PUBLIC, 'index.html'));
  });

  app.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    if (res.headersSent) return;
    const lang = req.lang || i18n.languageFor(req), T = (m, p) => i18n.msg(lang, m, p);
    const fieldsOf = (f) => (f ? Object.fromEntries(Object.entries(f).map(([k, v]) => [k, T(v)])) : undefined);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.translated ? err.message : T(err.message, err.params), code: err.translated ? undefined : err.message, fields: fieldsOf(err.fields), ...(err.status === 503 ? { maintenance: true } : {}) });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: T('err.too_large'), code: 'err.too_large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: T('err.invalid_json'), code: 'err.invalid_json' });
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint/.test(String(err.message))) return res.status(409).json({ error: T('err.already_exists'), code: 'err.already_exists' });
    const id = Math.random().toString(36).slice(2, 10);
    if (!opts.quiet) console.error(`[error ${id}]`, err);
    res.status(500).json({ error: T('err.server_error', { ref: id }), code: 'err.server_error' });
  });

  return { app, db, settings, core, i18n, learning, assessment, daily, init, seeded: () => seeded, close: () => db.close(), opts };
}

module.exports = { createApp };
