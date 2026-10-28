const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const dbLib = require('./lib/db');
const settingsLib = require('./lib/settings');
const authLib = require('./lib/auth');
const coreLib = require('./lib/core');
const attemptsLib = require('./lib/attempts');
const reviewLib = require('./lib/review');
const i18nLib = require('./lib/i18n');
const coreI18n = require('../shared/i18n-core');
const { now, HttpError } = require('./lib/util');

const PUBLIC = path.join(__dirname, '..', 'public');

function createApp(options = {}) {
  const opts = {
    dbPath: path.join(__dirname, '..', 'data', 'lexi.sqlite'), dataDir: path.join(__dirname, '..', 'data'),
    rateLimit: true, quiet: false, secureCookies: false, publicUrl: '', trustProxy: false, ...options,
  };
  const db = dbLib.open(opts.dbPath);
  dbLib.migrate(db);
  const settings = settingsLib.make(db);
  const auth = authLib.make(db, { secureCookies: opts.secureCookies });
  const i18n = i18nLib.make(db, settings);
  const core = coreLib.make(db, settings);
  const attempts = attemptsLib.make(db, settings, core);
  const review = reviewLib.make(db, settings, core);
  const audit = (req, action, entity, entityId, details) => db.run('INSERT INTO audit_log (admin_id, admin_email, action, entity, entity_id, details, created_at) VALUES (?,?,?,?,?,?,?)', req.user.id, req.user.email, action, entity, String(entityId == null ? '' : entityId), JSON.stringify(details || {}).slice(0, 2000), now());
  const ctx = { db, settings, auth, core, attempts, review, audit, opts, i18n };

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

  /* ---------- uploaded audio (public, fixed content type from the database) ---------- */
  app.get('/shared/i18n-core.js', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.type('application/javascript').sendFile(path.join(__dirname, '..', 'shared', 'i18n-core.js')); });
  app.get('/uploads/:id', (req, res) => {
    const u = /^[A-Za-z0-9_-]{6,40}$/.test(req.params.id) ? db.get('SELECT * FROM uploads WHERE id = ?', req.params.id) : null;
    const file = u && path.join(opts.dataDir, 'uploads', u.id);
    if (!u || !fs.existsSync(file)) return res.status(404).end();
    res.setHeader('Content-Type', u.mime); res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(file);
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
  api.use('/admin', require('./routes/admin-manage')(ctx));
  api.use('/admin', require('./routes/admin-i18n')(ctx));
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
  app.get('/admin/login', sessionOnly, (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(path.join(PUBLIC, 'admin-login.html')); });
  app.use('/admin', sessionOnly, staffOnly, (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); },
    express.static(path.join(PUBLIC, 'admin'), { index: false, redirect: false, fallthrough: true }),
    (req, res) => res.sendFile(path.join(PUBLIC, 'admin', 'index.html')));

  /* ---------- learner app ---------- */
  app.use(express.static(PUBLIC, { index: false, redirect: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res, next) => {
    if (path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC, 'index.html'));
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

  return { app, db, settings, core, i18n, close: () => db.close(), opts };
}

module.exports = { createApp };
