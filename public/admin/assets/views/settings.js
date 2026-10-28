import { h, get, put, field, wireForm, formErrorBox, toast, t } from '../common.js';
import { LANGUAGES } from '/js/i18n.js';

export default async function settings() {
  const { settings: s } = await get('/admin/settings');
  const langOptions = LANGUAGES.map((l) => ({ value: l.code, label: `${l.flag} ${t('lang.native.' + l.code)}` }));
  const num = (k, label, extra = {}) => field({ label: t(label), name: k, type: 'number', value: s[k], ...extra });
  const f = {
    site_name: field({ label: t('adm.set.site_name'), name: 'site_name', value: s.site_name, maxlength: 60 }), tagline: field({ label: t('adm.set.tagline'), name: 'tagline', value: s.tagline, maxlength: 140, hint: t('adm.set.tagline_hint') }), brand_color: field({ label: t('adm.set.brand_color'), name: 'brand_color', type: 'color', value: s.brand_color }),
    default_language: field({ label: t('adm.set.default_language'), name: 'default_language', type: 'select', value: s.default_language, options: langOptions, hint: t('adm.set.default_language_hint') }),
    default_translation_language: field({ label: t('adm.set.default_translation_language'), name: 'default_translation_language', type: 'select', value: s.default_translation_language, options: langOptions.filter((o) => o.value !== 'en'), hint: t('adm.set.default_translation_language_hint') }),
    available_levels: field({ label: t('adm.set.available_levels'), name: 'available_levels', value: s.available_levels.join(', '), hint: t('adm.set.available_levels_hint') }),
    default_daily_goal_xp: num('default_daily_goal_xp', 'adm.set.default_daily_goal_xp', { min: 5, max: 500 }),
    xp_per_correct: num('xp_per_correct', 'adm.set.xp_per_correct'), xp_per_retry: num('xp_per_retry', 'adm.set.xp_per_retry'),
    xp_lesson_bonus: num('xp_lesson_bonus', 'adm.set.xp_lesson_bonus'), xp_perfect_bonus: num('xp_perfect_bonus', 'adm.set.xp_perfect_bonus'),
    xp_per_review: num('xp_per_review', 'adm.set.xp_per_review'), xp_review_daily_cap: num('xp_review_daily_cap', 'adm.set.xp_review_daily_cap'), xp_per_mistake_review: num('xp_per_mistake_review', 'adm.set.xp_per_mistake_review'),
    hearts_enabled: field({ label: t('adm.set.hearts_enabled'), name: 'hearts_enabled', type: 'checkbox', value: s.hearts_enabled }), max_hearts: num('max_hearts', 'adm.set.max_hearts', { min: 1, max: 20 }), heart_regen_minutes: num('heart_regen_minutes', 'adm.set.heart_regen_minutes', { min: 1 }),
    leaderboard_enabled: field({ label: t('adm.set.leaderboard_enabled'), name: 'leaderboard_enabled', type: 'checkbox', value: s.leaderboard_enabled }), registration_open: field({ label: t('adm.set.registration_open'), name: 'registration_open', type: 'checkbox', value: s.registration_open }),
    maintenance_mode: field({ label: t('adm.set.maintenance_mode'), name: 'maintenance_mode', type: 'checkbox', value: s.maintenance_mode }), maintenance_message: field({ label: t('adm.set.maintenance_message'), name: 'maintenance_message', value: s.maintenance_message, maxlength: 300, hint: t('adm.set.maintenance_message_hint') }),
  };
  // the languages offered in the selector: one checkbox per language
  const supported = Object.fromEntries(LANGUAGES.map((l) => [l.code, field({ label: `${l.flag} ${t('lang.native.' + l.code)}`, name: 'lang_' + l.code, type: 'checkbox', value: s.supported_languages.includes(l.code) })]));
  const err = formErrorBox();
  const group = (title, ...keys) => h('section', { class: 'card' }, h('h2', {}, title), h('div', { class: 'two-col' }, keys.map((k) => f[k].el)));
  const langGroup = h('section', { class: 'card' }, h('h2', {}, t('adm.set.group_languages')), h('p', { class: 'muted small' }, t('adm.set.languages_help')),
    h('fieldset', { class: 'plain' }, h('legend', {}, t('adm.set.supported_languages')), ...Object.values(supported).map((x) => x.el)),
    h('div', { class: 'two-col' }, f.default_language.el, f.default_translation_language.el), h('a', { href: '/admin/translations' }, t('adm.set.manage_translations')));
  const form = h('form', { novalidate: true }, err,
    group(t('adm.set.group_site'), 'site_name', 'tagline', 'brand_color', 'available_levels'), langGroup,
    group(t('adm.set.group_xp'), 'default_daily_goal_xp', 'xp_per_correct', 'xp_per_retry', 'xp_lesson_bonus', 'xp_perfect_bonus', 'xp_per_review', 'xp_review_daily_cap', 'xp_per_mistake_review'),
    group(t('adm.set.group_hearts'), 'hearts_enabled', 'max_hearts', 'heart_regen_minutes', 'leaderboard_enabled'),
    group(t('adm.set.group_access'), 'registration_open', 'maintenance_mode', 'maintenance_message'),
    h('button', { class: 'btn', type: 'submit' }, t('adm.set.save')));
  const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  wireForm(form, { ...f, supported_languages: supported[LANGUAGES[0].code] }, err, async () => {
    const body = {};
    for (const [k, fld] of Object.entries(f)) body[k] = fld.input.type === 'checkbox' ? fld.input.checked : k === 'available_levels' ? list(fld.value) : fld.input.type === 'number' ? Number(fld.value) : fld.value;
    body.supported_languages = LANGUAGES.filter((l) => supported[l.code].value).map((l) => l.code);
    const r = await put('/admin/settings', body);
    (await import('/js/brand.js')).applyBrand(r.settings.brand_color);
    toast(t('adm.set.saved'), 'success');
  });
  return { el: h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.set.title'))), form), title: t('adm.nav.settings'), nav: 'settings' };
}
