const I18N = require('../../shared/i18n-core');
const LV = require('./levels');
/* Site settings: defaults live here, overrides are stored in the settings table (edited in the admin panel). */
const DEFAULTS = {
  site_name: 'Lexi Learn',
  tagline: '',
  brand_color: '#147a54',
  default_language: 'uz',
  default_translation_language: 'uz',
  supported_languages: ['uz', 'ru', 'en'],
  available_levels: ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'IELTS'],
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
  // placement test (adaptive): how long it runs, how precise it must be, where the level boundaries lie on the ability scale 0-6
  placement_min_questions: 20,
  placement_max_questions: 35,
  placement_precision: 42,            // stop early when the uncertainty of the estimate is at most this / 100 (levels)
  placement_min_per_skill: 3,         // every core skill (vocabulary, grammar, reading) needs at least this many answers
  placement_start_level: 'A1',
  placement_cutoffs: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],   // ability needed for A1, A2, B1, B2, C1, C2
  placement_valid_days: 90,           // after this long a reassessment is recommended
  // continuous level adjustment
  adapt_enabled: true,
  adapt_min_answers: 40,
  adapt_up_accuracy: 88,
  adapt_min_lessons: 4,
  adapt_min_days: 7,
  adapt_low_accuracy: 50,
  // personalised daily lesson (number of exercises) and its completion bonus
  daily_items_short: 12,
  daily_items_normal: 18,
  daily_items_long: 26,
  xp_daily_bonus: 15,
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
  placement_min_questions: { t: 'int', min: 8, max: 40 },
  placement_max_questions: { t: 'int', min: 12, max: 60 },
  placement_precision: { t: 'int', min: 20, max: 90 },
  placement_min_per_skill: { t: 'int', min: 1, max: 8 },
  placement_start_level: { t: 'level' },
  placement_cutoffs: { t: 'cutoffs' },
  placement_valid_days: { t: 'int', min: 7, max: 730 },
  adapt_enabled: { t: 'bool' },
  adapt_min_answers: { t: 'int', min: 15, max: 300 },
  adapt_up_accuracy: { t: 'int', min: 60, max: 100 },
  adapt_min_lessons: { t: 'int', min: 1, max: 60 },
  adapt_min_days: { t: 'int', min: 0, max: 120 },
  adapt_low_accuracy: { t: 'int', min: 10, max: 80 },
  daily_items_short: { t: 'int', min: 6, max: 40 },
  daily_items_normal: { t: 'int', min: 8, max: 50 },
  daily_items_long: { t: 'int', min: 10, max: 60 },
  xp_daily_bonus: { t: 'int', min: 0, max: 500 },
};

/* The settings live in the database. They are read once per request (refresh) and cached for `ttl` ms, so the rest of the code can read
   them synchronously with all(); an update made by this process is visible immediately, one made by another server instance within `ttl`. */
function make(db, { ttl = 2000 } = {}) {
  let cache = null, loadedAt = 0, loading = null;
  const load = async () => {
    const out = { ...DEFAULTS };
    for (const r of await db.all('SELECT key, value FROM settings')) { if (r.key in DEFAULTS) { try { out[r.key] = JSON.parse(r.value); } catch (_) { /* keep default */ } } }
    cache = out; loadedAt = Date.now();
    return out;
  };
  const refresh = async (force = false) => {
    if (!force && cache && Date.now() - loadedAt < ttl) return cache;
    if (!loading) loading = load().finally(() => { loading = null; });
    return loading;
  };
  const all = () => cache || DEFAULTS;
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
      else if (s.t === 'level') { if (!LV.valid(v)) errors[k] = 'val.level_unknown'; else values[k] = v; }
      else if (s.t === 'cutoffs') {
        const arr = Array.isArray(v) ? v.map(Number) : null;
        if (!arr || arr.length !== 6 || arr.some((x) => !Number.isFinite(x) || x < 0 || x > 6) || arr.some((x, i) => i && x <= arr[i - 1])) errors[k] = 'val.cutoffs'; else values[k] = arr.map((x) => Math.round(x * 100) / 100);
      }
      else if (s.t === 'translang') { if (!['uz', 'ru'].includes(v)) errors[k] = 'val.translation_language'; else values[k] = v; }
      else if (s.t === 'langs') { const arr = Array.isArray(v) ? Array.from(new Set(v)) : null; if (!arr || !arr.length || arr.some((x) => !I18N.isSupported(x))) errors[k] = 'val.languages_list'; else values[k] = arr; }
      else if (s.t === 'list') {
        const arr = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : null;
        if (!arr || !arr.length || arr.length > s.max || arr.some((x) => !/^[A-Za-z0-9 _-]{1,20}$/.test(x))) errors[k] = 'val.setting_list'; else values[k] = Array.from(new Set(arr));
      }
    }
    const lo = values.placement_min_questions !== undefined ? values.placement_min_questions : all().placement_min_questions, hi = values.placement_max_questions !== undefined ? values.placement_max_questions : all().placement_max_questions;
    if (!errors.placement_min_questions && !errors.placement_max_questions && lo > hi) errors[values.placement_min_questions !== undefined ? 'placement_min_questions' : 'placement_max_questions'] = 'val.min_max_questions';
    // the default interface language must be one of the offered languages
    const sup = values.supported_languages || all().supported_languages, def = values.default_language || all().default_language;
    if (!errors.default_language && !errors.supported_languages && !sup.includes(def)) errors[values.default_language ? 'default_language' : 'supported_languages'] = 'val.default_language_unsupported';
    return Object.keys(errors).length ? { errors } : { values };
  }
  async function update(values) {
    await db.tx(async () => { for (const [k, v] of Object.entries(values)) await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, JSON.stringify(v)); });
    await refresh(true);
  }
  return { all, refresh, validate, update, DEFAULTS };
}

module.exports = { make, DEFAULTS, SCHEMA };
