import { h, avatar, icon, toast, confirmDialog } from '../ui.js';
import { get, patch, post, session, api } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { setUser, navigate, switcher } from '../app.js';
import { t, n, fmt } from '../i18n.js';
import { getPref, setPref } from '../motion.js';
import { levelBadge, levelName } from './level-info.js';
import { levelPicker, refreshUser } from './welcome.js';

const GOALS = [10, 20, 30, 50, 100];
export default async function profile() {
  const [p, lv] = await Promise.all([get('/me/profile'), get('/me/level')]);
  const u = p.user;
  const el = h('div', { class: 'stack' });
  let chosenAvatar = u.avatar;

  const avatars = h('div', { class: 'avatar-grid', role: 'radiogroup', 'aria-label': t('profile.avatar') }, p.avatars.map((a) => {
    const b = h('button', { type: 'button', class: 'avatar-pick', role: 'radio', 'aria-checked': String(a === chosenAvatar), 'aria-label': a, onclick: () => { chosenAvatar = a; avatars.querySelectorAll('.avatar-pick').forEach((x) => x.setAttribute('aria-checked', String(x === b))); } }, avatar(a, 54));
    return b;
  }));
  const name = field({ label: t('profile.display_name'), name: 'displayName', value: u.displayName, maxlength: 30, required: true });
  const goal = field({ label: t('profile.daily_goal'), name: 'dailyGoalXp', type: 'select', value: u.dailyGoalXp, options: Array.from(new Set(GOALS.concat([u.dailyGoalXp]))).sort((a, b) => a - b).map((g) => ({ value: g, label: t('profile.xp_a_day', { n: g }) })) });
  const length = field({ label: t('profile.lesson_length'), name: 'lessonLength', type: 'select', value: u.lessonLength || 'normal', options: ['short', 'normal', 'long'].map((l) => ({ value: l, label: t('profile.length_' + l) })), hint: t('profile.lesson_length_hint') });
  const course = field({ label: t('profile.course'), name: 'courseId', type: 'select', value: u.courseId || (p.course && p.course.id) || '', options: p.courses.map((c) => ({ value: c.id, label: c.title })) });
  const tzf = field({ label: t('profile.timezone'), name: 'timezone', value: u.timezone, hint: t('profile.timezone_hint') });
  const trLang = field({ label: t('profile.translation_language'), name: 'translationLanguage', type: 'select', value: u.translationLanguage, options: ['uz', 'ru'].map((l) => ({ value: l, label: t('lang.native.' + l) })), hint: t('profile.translation_language_hint') });
  const learnLang = field({ label: t('profile.learning_language'), name: 'learningLanguage', type: 'select', value: u.learningLanguage || 'en', options: [{ value: 'en', label: t('lang.native.en') }], disabled: true, hint: t('profile.learning_language_hint') });
  const uiLabel = h('span', { class: 'label', id: 'ui-lang-label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, t('profile.interface_language'));
  const uiLang = h('div', { class: 'field' }, uiLabel, switcher('wide'), h('div', { class: 'muted small' }, t('profile.interface_language_hint')));
  const board = field({ label: t('profile.leaderboard_opt_in'), name: 'leaderboardOptIn', type: 'checkbox', value: u.leaderboardOptIn });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, h('div', { class: 'field' }, h('span', { class: 'label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, t('profile.avatar')), avatars), name.el, h('div', { class: 'grid two' }, goal.el, length.el), course.el, tzf.el, uiLang, trLang.el, learnLang.el, board.el, h('button', { class: 'btn', type: 'submit' }, t('common.save_changes')));
  wireForm(form, { displayName: name, dailyGoalXp: goal, lessonLength: length, courseId: course, timezone: tzf, translationLanguage: trLang, leaderboardOptIn: board }, err, async () => {
    const r = await patch('/me', { displayName: name.value, avatar: chosenAvatar, dailyGoalXp: Number(goal.value), lessonLength: length.value, courseId: Number(course.value), timezone: tzf.value.trim(), translationLanguage: trLang.value, leaderboardOptIn: board.value });
    session.user = r.user; toast(t('profile.saved'), 'success', 2000);
  });

  const cur = field({ label: t('profile.current_password'), name: 'currentPassword', type: 'password', autocomplete: 'current-password' });
  const nw = field({ label: t('profile.new_password'), name: 'newPassword', type: 'password', autocomplete: 'new-password', hint: t('profile.password_hint') });
  const perr = formErrorBox();
  const pform = h('form', { novalidate: true }, perr, cur.el, nw.el, h('button', { class: 'btn secondary', type: 'submit' }, t('profile.change_password')));
  wireForm(pform, { currentPassword: cur, newPassword: nw }, perr, async () => { await post('/me/password', { currentPassword: cur.value, newPassword: nw.value }); cur.value = ''; nw.value = ''; toast(t('profile.password_changed'), 'success', 2500); });

  /* the learner's level: how it was set, the last placement result, retake and manual change (the test result is kept either way) */
  const levelBox = h('section', { class: 'card level-card', 'aria-labelledby': 'lvl-h' });
  const picker = h('div', { hidden: true }, levelPicker({ current: lv.level, label: t('level.save'), onPick: async (code) => { await post('/me/level', { level: code }); await refreshUser(); toast(t('level.saved'), 'success', 2200); navigate('/profile', true); } }));
  const retake = h('button', { class: 'btn secondary', type: 'button' }, t('reassess.button'));
  retake.addEventListener('click', async () => {
    if (!await confirmDialog(t('reassess.confirm_title'), t('reassess.confirm_text'), t('reassess.confirm_button'))) return;
    retake.disabled = true; try { await post('/assessment/start', {}); navigate('/placement'); } catch (e) { retake.disabled = false; toast(e.message, 'error', 5000); }
  });
  const changeBtn = h('button', { class: 'btn secondary', type: 'button', 'aria-expanded': 'false', onclick: () => { picker.hidden = !picker.hidden; changeBtn.setAttribute('aria-expanded', String(!picker.hidden)); } }, t('level.change'));
  const a = lv.assessment;
  levelBox.append(h('h2', { id: 'lvl-h' }, t('level.your_level')),
    h('div', { class: 'row' }, levelBadge(lv.level || 'A1', 'big'), h('div', {}, h('b', {}, levelName(lv.level || 'A1')), h('div', { class: 'muted small' }, t('level.source_' + lv.source)))),
    a ? h('p', { class: 'muted small' }, t('level.last_test', { level: t('level.' + a.level + '.short'), percent: a.result.percent, date: fmt.date(a.completedAt) }), ' ', h('a', { href: '/results' }, t('level.see_result'))) : h('p', { class: 'muted small' }, t('level.no_test')),
    lv.recommendation && lv.recommendation.reassess ? h('p', { class: 'notice small' }, t('reassess.' + lv.recommendation.reason, { accuracy: lv.recommendation.accuracy, days: lv.recommendation.days })) : null,
    h('div', { class: 'row' }, retake, changeBtn), picker,
    lv.history.length ? h('details', { class: 'level-history' }, h('summary', {}, t('level.history')), h('ul', {}, lv.history.slice(0, 8).map((x) => h('li', {}, `${fmt.date(x.at)} · `, h('b', {}, t('level.' + x.level + '.short')), ' · ', t('level.source_' + x.source))))) : null);

  el.append(h('div', { class: 'page-head' }, h('div', { class: 'hello' }, avatar(u.avatar, 72), h('div', {}, h('h1', {}, u.displayName), h('p', { class: 'muted', style: { margin: 0 } }, t('profile.joined', { email: u.email, date: fmt.date(u.createdAt) })))), h('div', { class: 'chips' }, h('span', { class: 'chip bolt' }, icon('bolt'), t('stats.xp_value', { n: fmt.number(u.xpTotal) })), h('span', { class: 'chip flame' }, icon('flame'), n('count.day_streak', p.stats.streak.current)), h('span', { class: 'chip ok' }, icon('check'), n('count.lessons', p.stats.lessonsCompleted)), h('span', { class: 'chip warn' }, icon('star'), n('count.badges', p.stats.achievements)))),
    h('div', { class: 'grid two' }, h('div', {}, levelBox, h('section', { class: 'card' }, h('h2', {}, t('profile.settings')), form)), h('div', {}, h('section', { class: 'card', style: { marginTop: 0 } }, h('h2', {}, t('profile.password')), pform),
      h('section', { class: 'card' }, h('h2', {}, t('profile.appearance')), h('label', { class: 'field' }, h('span', { class: 'label' }, t('profile.animations')),
        h('select', { class: 'input', id: 'motion-pref', name: 'motion', onchange: (e) => { setPref(e.target.value); toast(t('profile.animations_saved'), 'success', 1800); } }, ['system', 'on', 'off'].map((v) => h('option', { value: v, selected: getPref() === v }, t('profile.motion_' + v)))),
        h('div', { class: 'muted small' }, t('profile.animations_hint')))),
      h('section', { class: 'card' }, h('h2', {}, t('profile.account')), h('div', { class: 'stack' }, h('a', { class: 'btn secondary block', href: '/achievements' }, t('nav.achievements')), h('a', { class: 'btn secondary block', href: '/leaderboard' }, t('nav.leaderboard')),
        ['admin', 'editor'].includes(u.role) ? h('a', { class: 'btn secondary block', href: '/admin' }, icon('shield'), t('nav.admin_panel')) : null,
        h('button', { class: 'btn danger block', type: 'button', onclick: async () => { if (await confirmDialog(t('profile.signout_title'), t('profile.signout_text'), t('nav.sign_out'))) { await api('POST', '/auth/logout', {}); setUser(null, null); session.csrf = null; navigate('/login', true); } } }, icon('logout'), t('nav.sign_out')))))));
  return { el, title: t('nav.profile'), nav: 'profile' };
}
