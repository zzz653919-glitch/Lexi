const I18N = require('../../shared/i18n-core');
/* Site settings: defaults live here, overrides are stored in the settings table (edited in the admin panel). */
const DEFAULTS = {
  site_name: 'Lexi Learn',
  tagline: '',
  brand_color: '#147a54',
  default_language: 'uz',
  default_translation_language: 'uz',
  supported_languages: ['uz', 'ru', 'en'],
  available_levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS'],
  default_daily_goal_xp: 30,
  xp_per_correct: 10,
  xp_per_retry: 5,
  xp_lesson_bonus: 20,
  xp_perfect_bonus: 10,
  xp_per_review: 2,
  xp_review_daily_cap: 40,
  xp_per_mistake_review: 5,
  hearts_enabled: true,
  max_hearts: 5,
  heart_regen_minutes: 30,
  leaderboard_enabled: true,
  registration_open: true,
  maintenance_mode: false,
  maintenance_message: '',
};

const SCHEMA = {
  site_name: { t: 'str', max: 60, min: 1 },
  tagline: { t: 'str', max: 140 },
  brand_color: { t: 'color' },
  default_language: { t: 'lang' },
  default_translation_language: { t: 'translang' },
  supported_languages: { t: 'langs' },
  available_levels: { t: 'list', max: 12 },
  default_daily_goal_xp: { t: 'int', min: 5, max: 500 },
  xp_per_correct: { t: 'int', min: 0, max: 100 },
  xp_per_retry: { t: 'int', min: 0, max: 100 },
  xp_lesson_bonus: { t: 'int', min: 0, max: 500 },
  xp_perfect_bonus: { t: 'int', min: 0, max: 500 },
  xp_per_review: { t: 'int', min: 0, max: 50 },
  xp_review_daily_cap: { t: 'int', min: 0, max: 1000 },
  xp_per_mistake_review: { t: 'int', min: 0, max: 100 },
  hearts_enabled: { t: 'bool' },
  max_hearts: { t: 'int', min: 1, max: 20 },
  heart_regen_minutes: { t: 'int', min: 1, max: 1440 },
  leaderboard_enabled: { t: 'bool' },
  registration_open: { t: 'bool' },
  maintenance_mode: { t: 'bool' },
  maintenance_message: { t: 'str', max: 300 },
};

function make(db) {
  let cache = null;
  const load = () => {
    const out = { ...DEFAULTS };
    for (const r of db.all('SELECT key, value FROM settings')) { if (r.key in DEFAULTS) { try { out[r.key] = JSON.parse(r.value); } catch (_) { /* keep default */ } } }
    return out;
  };
  const all = () => (cache = cache || load());
  /* validates a partial update; returns { values } or { errors } */
  function validate(input) {
    const values = {}, errors = {};
    for (const [k, v] of Object.entries(input || {})) {
      const s = SCHEMA[k];
      if (!s) { errors[k] = 'val.unknown_setting'; continue; }
      if (s.t === 'str') { const x = String(v == null ? '' : v).trim(); if (x.length < (s.min || 0) || x.length > s.max) errors[k] = { key: 'val.setting_text', params: { min: s.min || 0, max: s.max } }; else values[k] = x; }
      else if (s.t === 'int') { const n = Number(v); if (!Number.isInteger(n) || n < s.min || n > s.max) errors[k] = { key: 'val.setting_int', params: { min: s.min, max: s.max } }; else values[k] = n; }
      else if (s.t === 'bool') { if (typeof v !== 'boolean') errors[k] = 'val.boolean'; else values[k] = v; }
      else if (s.t === 'color') { if (!/^#[0-9a-fA-F]{6}$/.test(String(v))) errors[k] = 'val.setting_color'; else values[k] = String(v).toLowerCase(); }
      else if (s.t === 'lang') { if (!I18N.isSupported(v)) errors[k] = 'val.language'; else values[k] = v; }
      else if (s.t === 'translang') { if (!['uz', 'ru'].includes(v)) errors[k] = 'val.translation_language'; else values[k] = v; }
      else if (s.t === 'langs') { const arr = Array.isArray(v) ? Array.from(new Set(v)) : null; if (!arr || !arr.length || arr.some((x) => !I18N.isSupported(x))) errors[k] = 'val.languages_list'; else values[k] = arr; }
      else if (s.t === 'list') {
        const arr = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : null;
        if (!arr || !arr.length || arr.length > s.max || arr.some((x) => !/^[A-Za-z0-9 _-]{1,20}$/.test(x))) errors[k] = 'val.setting_list'; else values[k] = Array.from(new Set(arr));
      }
    }
    // the default interface language must be one of the offered languages
    const sup = values.supported_languages || all().supported_languages, def = values.default_language || all().default_language;
    if (!errors.default_language && !errors.supported_languages && !sup.includes(def)) errors[values.default_language ? 'default_language' : 'supported_languages'] = 'val.default_language_unsupported';
    return Object.keys(errors).length ? { errors } : { values };
  }
  function update(values) {
    db.tx(() => { for (const [k, v] of Object.entries(values)) db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, JSON.stringify(v)); });
    cache = null;
  }
  return { all, validate, update, DEFAULTS };
}

module.exports = { make, DEFAULTS, SCHEMA };
