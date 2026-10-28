import { h, get, put, field, wireForm, formErrorBox, toast } from '../common.js';

export default async function settings() {
  const { settings: s } = await get('/admin/settings');
  const f = {
    site_name: field({ label: 'Site name', name: 'site_name', value: s.site_name, maxlength: 60 }), tagline: field({ label: 'Tagline', name: 'tagline', value: s.tagline, maxlength: 140 }), brand_color: field({ label: 'Brand colour', name: 'brand_color', type: 'color', value: s.brand_color }),
    default_translation_language: field({ label: 'Default translation language', name: 'default_translation_language', value: s.default_translation_language, hint: 'The language learners see translations in by default (for example uz). The learning language is English.' }),
    supported_languages: field({ label: 'Supported languages (comma separated)', name: 'supported_languages', value: s.supported_languages.join(', ') }), available_levels: field({ label: 'Available learning levels (comma separated)', name: 'available_levels', value: s.available_levels.join(', '), hint: 'Only these codes can be added to a course.' }),
    default_daily_goal_xp: field({ label: 'Default daily goal (XP)', name: 'default_daily_goal_xp', type: 'number', value: s.default_daily_goal_xp, min: 5, max: 500 }),
    xp_per_correct: field({ label: 'XP per correct answer', name: 'xp_per_correct', type: 'number', value: s.xp_per_correct }), xp_per_retry: field({ label: 'XP for a correct retry', name: 'xp_per_retry', type: 'number', value: s.xp_per_retry }),
    xp_lesson_bonus: field({ label: 'Default lesson completion XP (new lessons)', name: 'xp_lesson_bonus', type: 'number', value: s.xp_lesson_bonus }), xp_perfect_bonus: field({ label: 'Perfect-lesson bonus XP', name: 'xp_perfect_bonus', type: 'number', value: s.xp_perfect_bonus }),
    xp_per_review: field({ label: 'XP per vocabulary review answer', name: 'xp_per_review', type: 'number', value: s.xp_per_review }), xp_review_daily_cap: field({ label: 'Daily cap for review XP', name: 'xp_review_daily_cap', type: 'number', value: s.xp_review_daily_cap }), xp_per_mistake_review: field({ label: 'XP per correct answer in mistakes review', name: 'xp_per_mistake_review', type: 'number', value: s.xp_per_mistake_review }),
    hearts_enabled: field({ label: 'Use hearts (mistake limit in lessons)', name: 'hearts_enabled', type: 'checkbox', value: s.hearts_enabled }), max_hearts: field({ label: 'Maximum hearts', name: 'max_hearts', type: 'number', value: s.max_hearts, min: 1, max: 20 }), heart_regen_minutes: field({ label: 'Minutes to regain one heart', name: 'heart_regen_minutes', type: 'number', value: s.heart_regen_minutes, min: 1 }),
    leaderboard_enabled: field({ label: 'Enable the leaderboard', name: 'leaderboard_enabled', type: 'checkbox', value: s.leaderboard_enabled }), registration_open: field({ label: 'Allow new registrations', name: 'registration_open', type: 'checkbox', value: s.registration_open }),
    maintenance_mode: field({ label: 'Maintenance mode (only staff can use the site)', name: 'maintenance_mode', type: 'checkbox', value: s.maintenance_mode }), maintenance_message: field({ label: 'Maintenance message', name: 'maintenance_message', value: s.maintenance_message, maxlength: 300 }),
  };
  const err = formErrorBox();
  const group = (title, ...keys) => h('section', { class: 'card' }, h('h2', {}, title), h('div', { class: 'two-col' }, keys.map((k) => f[k].el)));
  const form = h('form', { novalidate: true }, err,
    group('Site and branding', 'site_name', 'tagline', 'brand_color', 'default_translation_language', 'supported_languages', 'available_levels'),
    group('Daily goals and XP', 'default_daily_goal_xp', 'xp_per_correct', 'xp_per_retry', 'xp_lesson_bonus', 'xp_perfect_bonus', 'xp_per_review', 'xp_review_daily_cap', 'xp_per_mistake_review'),
    group('Hearts and gamification', 'hearts_enabled', 'max_hearts', 'heart_regen_minutes', 'leaderboard_enabled'),
    group('Access', 'registration_open', 'maintenance_mode', 'maintenance_message'),
    h('button', { class: 'btn', type: 'submit' }, 'Save settings'));
  const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  wireForm(form, f, err, async () => {
    const body = {};
    for (const [k, fld] of Object.entries(f)) body[k] = fld.input.type === 'checkbox' ? fld.input.checked : ['supported_languages', 'available_levels'].includes(k) ? list(fld.value) : fld.input.type === 'number' ? Number(fld.value) : fld.value;
    const r = await put('/admin/settings', body);
    (await import('/js/brand.js')).applyBrand(r.settings.brand_color);
    toast('Settings saved', 'success');
  });
  return { el: h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'Site settings')), form), title: 'Settings', nav: 'settings' };
}
