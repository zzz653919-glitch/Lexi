/* Server side of the translation system: loads /locales/*.json, merges the administrator's overrides (database) and translates
   messages for the language of the request. The same engine (shared/i18n-core.js) runs in the browser. */
const fs = require('node:fs');
const path = require('node:path');
const core = require('../../shared/i18n-core');
const { now } = require('./util');

const LOCALES_DIR = path.join(__dirname, '..', '..', 'locales');
const MAX_VALUE = 600;

function readFiles() {
  const out = {};
  for (const l of core.LANGUAGES) {
    try { out[l.code] = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, l.code + '.json'), 'utf8')); } catch (_) { out[l.code] = {}; }
  }
  return out;
}

function make(db, settings, { ttl = 2000 } = {}) {
  let base = readFiles();
  let overrides = {}, merged = {}, loadedAt = 0, loading = null;
  const build = () => {
    merged = {};
    for (const l of core.LANGUAGES) { overrides[l.code] = overrides[l.code] || {}; merged[l.code] = { ...base[l.code], ...overrides[l.code] }; }
  };
  build();
  const load = async () => {
    const fresh = {};
    for (const l of core.LANGUAGES) fresh[l.code] = {};
    for (const r of await db.all('SELECT lang, key, value FROM translation_overrides')) { try { if (fresh[r.lang]) fresh[r.lang][r.key] = JSON.parse(r.value); } catch (_) { /* skip */ } }
    overrides = fresh; build(); loadedAt = Date.now();
  };
  /* the administrator's edits are read once per request (cached for `ttl` ms), the dictionaries are then used synchronously */
  const refresh = async (force = false) => {
    if (!force && loadedAt && Date.now() - loadedAt < ttl) return;
    if (!loading) loading = load().finally(() => { loading = null; });
    return loading;
  };
  const dicts = () => merged;
  const reload = () => { base = readFiles(); build(); };

  const defaultLanguage = () => { const d = settings.all().default_language; return core.isSupported(d) ? d : core.DEFAULT_LANGUAGE; };
  /* language of a request: the explicit header sent by the browser, else the signed-in user's saved language, else the site default */
  function languageFor(req) {
    const h = String((req.headers && req.headers['x-lang']) || '').toLowerCase();
    if (core.isSupported(h)) return h;
    if (req.user && core.isSupported(req.user.ui_language)) return req.user.ui_language;
    return defaultLanguage();
  }
  const tr = (lang, key, params) => core.translate(dicts(), lang, key, params);
  /* translates a message that is a key, {key, params}, or an already translated text (unknown keys are returned unchanged) */
  function msg(lang, m, params) {
    if (m && typeof m === 'object' && m.key) return tr(lang, m.key, m.params || params);
    return tr(lang, m, params);
  }

  /* ---------- administration helpers ---------- */
  const flatten = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).filter((x) => typeof x === 'string') : []);
  /* completeness of every language against English (the reference): keys that have no text of their own count as missing */
  function completeness() {
    const d = dicts(), en = d.en, keys = Object.keys(en);
    return core.LANGUAGES.map((l) => {
      const own = d[l.code];
      const missing = keys.filter((k) => !has(own[k]));
      const extra = Object.keys(own).filter((k) => !(k in en));
      return { code: l.code, name: l.name, total: keys.length, translated: keys.length - missing.length, missing: missing.length, extra: extra.length, percent: keys.length ? Math.round(100 * (keys.length - missing.length) / keys.length) : 100, overrides: Object.keys(overrides[l.code]).length };
    });
  }
  const has = (v) => (typeof v === 'string' ? v.trim() !== '' : v && typeof v === 'object' && Object.values(v).some((x) => typeof x === 'string' && x.trim() !== ''));
  const missingKeys = (lang) => Object.keys(dicts().en).filter((k) => !has(dicts()[lang][k]));

  /* validates a new text for (lang, key) before it is published; returns [] when fine, else an array of {key, params} problems */
  function validate(lang, key, value) {
    const errs = [];
    if (!core.isSupported(lang)) return [{ key: 'val.language' }];
    const ref = base.en[key] !== undefined ? base.en[key] : undefined;
    if (ref === undefined) return [{ key: 'val.i18n_unknown_key' }];
    const refIsPlural = typeof ref === 'object';
    const check = (text, label) => {
      if (typeof text !== 'string' || !text.trim()) errs.push({ key: 'val.i18n_empty' });
      else {
        if (text.length > MAX_VALUE) errs.push({ key: 'val.i18n_too_long', params: { max: MAX_VALUE } });
        if (/[<>]/.test(text)) errs.push({ key: 'val.i18n_no_markup' });
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) errs.push({ key: 'val.i18n_control_chars' });
        if (/�/.test(text)) errs.push({ key: 'val.i18n_bad_encoding' });
        const want = core.placeholdersOf(label === 'other' || !refIsPlural ? flatten(ref).join(' ') : flatten(ref).join(' '));
        const got = core.placeholdersOf(text);
        const miss = want.filter((p) => !got.includes(p)), extra = got.filter((p) => !want.includes(p));
        if (miss.length || extra.length) errs.push({ key: 'val.i18n_placeholders', params: { expected: want.map((p) => `{${p}}`).join(' ') || '—' } });
      }
    };
    if (refIsPlural) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ key: 'val.i18n_plural_object' }];
      const cats = core.PLURAL_CATEGORIES[lang];
      for (const c of Object.keys(value)) if (!cats.includes(c)) errs.push({ key: 'val.i18n_plural_category', params: { category: c } });
      if (!('other' in value)) errs.push({ key: 'val.i18n_plural_other' });
      for (const c of cats) if (c in value) check(value[c], c);
    } else check(value, 'other');
    return Array.from(new Map(errs.map((e) => [e.key + JSON.stringify(e.params || {}), e])).values());
  }
  async function setOverride(lang, key, value, userId) {
    await db.run('INSERT INTO translation_overrides (lang, key, value, updated_by, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(lang, key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at', lang, key, JSON.stringify(value), userId || null, now());
    await refresh(true);
  }
  async function removeOverride(lang, key) { const r = await db.run('DELETE FROM translation_overrides WHERE lang = ? AND key = ?', lang, key); await refresh(true); return r.changes; }
  /* the entries of one language for the admin editor */
  function entries(lang, { filter = 'all', q = '', prefix = '' } = {}) {
    const d = dicts(); const out = [];
    const needle = String(q || '').toLowerCase();
    for (const key of Object.keys(d.en)) {
      const own = base[lang][key], ov = overrides[lang][key], eff = ov !== undefined ? ov : own;
      const missing = !has(eff);
      if (filter === 'missing' && !missing) continue;
      if (filter === 'overridden' && ov === undefined) continue;
      if (prefix && !key.startsWith(prefix)) continue;
      if (needle && !(key.toLowerCase().includes(needle) || flatten(d.en[key]).join(' ').toLowerCase().includes(needle) || flatten(eff).join(' ').toLowerCase().includes(needle))) continue;
      out.push({ key, en: d.en[key], file: own === undefined ? null : own, value: eff === undefined ? null : eff, overridden: ov !== undefined, missing, plural: typeof d.en[key] === 'object' });
    }
    return out;
  }
  const groups = () => Array.from(new Set(Object.keys(base.en).map((k) => k.split('.')[0]))).sort();
  return { refresh, dicts, tr, msg, languageFor, defaultLanguage, completeness, missingKeys, validate, setOverride, removeOverride, entries, groups, reload, core };
}

module.exports = { make, LOCALES_DIR };
