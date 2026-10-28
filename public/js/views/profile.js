import { h, avatar, icon, toast, confirmDialog } from '../ui.js';
import { get, patch, post, session, api } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { setUser, navigate } from '../app.js';

const GOALS = [10, 20, 30, 50, 100];
export default async function profile() {
  const p = await get('/me/profile');
  const u = p.user;
  const el = h('div', { class: 'stack' });
  let chosenAvatar = u.avatar;

  const avatars = h('div', { class: 'avatar-grid', role: 'radiogroup', 'aria-label': 'Avatar' }, p.avatars.map((a) => {
    const b = h('button', { type: 'button', class: 'avatar-pick', role: 'radio', 'aria-checked': String(a === chosenAvatar), 'aria-label': a, onclick: () => { chosenAvatar = a; avatars.querySelectorAll('.avatar-pick').forEach((x) => x.setAttribute('aria-checked', String(x === b))); } }, avatar(a, 54));
    return b;
  }));
  const name = field({ label: 'Display name', name: 'displayName', value: u.displayName, maxlength: 30, required: true });
  const goal = field({ label: 'Daily goal', name: 'dailyGoalXp', type: 'select', value: u.dailyGoalXp, options: Array.from(new Set(GOALS.concat([u.dailyGoalXp]))).sort((a, b) => a - b).map((g) => ({ value: g, label: `${g} XP a day` })) });
  const level = field({ label: 'Starting level', name: 'startLevel', type: 'select', value: u.startLevel, options: ['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => ({ value: l, label: l })), hint: 'Levels up to this one are open from the start.' });
  const course = field({ label: 'Course', name: 'courseId', type: 'select', value: u.courseId || (p.course && p.course.id) || '', options: p.courses.map((c) => ({ value: c.id, label: c.title })) });
  const tzf = field({ label: 'Time zone', name: 'timezone', value: u.timezone, hint: 'Your streak and daily goal follow this time zone (for example Asia/Tashkent).' });
  const lang = field({ label: 'Interface language', name: 'uiLanguage', type: 'select', value: u.uiLanguage, options: (session.config.supportedLanguages || ['en']).map((l) => ({ value: l, label: l.toUpperCase() })) });
  const board = field({ label: 'Show me on the leaderboard (display name and avatar only)', name: 'leaderboardOptIn', type: 'checkbox', value: u.leaderboardOptIn });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, h('div', { class: 'field' }, h('span', { class: 'label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, 'Avatar'), avatars), name.el, h('div', { class: 'grid two' }, goal.el, level.el), course.el, tzf.el, lang.el, board.el, h('button', { class: 'btn', type: 'submit' }, 'Save changes'));
  wireForm(form, { displayName: name, dailyGoalXp: goal, startLevel: level, courseId: course, timezone: tzf, uiLanguage: lang, leaderboardOptIn: board }, err, async () => {
    const r = await patch('/me', { displayName: name.value, avatar: chosenAvatar, dailyGoalXp: Number(goal.value), startLevel: level.value, courseId: Number(course.value), timezone: tzf.value.trim(), uiLanguage: lang.value, leaderboardOptIn: board.value });
    session.user = r.user; toast('Profile saved', 'success', 2000);
  });

  const cur = field({ label: 'Current password', name: 'currentPassword', type: 'password', autocomplete: 'current-password' });
  const nw = field({ label: 'New password', name: 'newPassword', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters, with letters and a digit.' });
  const perr = formErrorBox();
  const pform = h('form', { novalidate: true }, perr, cur.el, nw.el, h('button', { class: 'btn secondary', type: 'submit' }, 'Change password'));
  wireForm(pform, { currentPassword: cur, newPassword: nw }, perr, async () => { await post('/me/password', { currentPassword: cur.value, newPassword: nw.value }); cur.value = ''; nw.value = ''; toast('Password changed', 'success', 2500); });

  el.append(h('div', { class: 'page-head' }, h('div', { class: 'hello' }, avatar(u.avatar, 72), h('div', {}, h('h1', {}, u.displayName), h('p', { class: 'muted', style: { margin: 0 } }, `${u.email} · joined ${new Date(u.createdAt).toLocaleDateString()}`))), h('div', { class: 'chips' }, h('span', { class: 'chip bolt' }, icon('bolt'), `${u.xpTotal} XP`), h('span', { class: 'chip flame' }, icon('flame'), `${p.stats.streak.current} day streak`), h('span', { class: 'chip ok' }, icon('check'), `${p.stats.lessonsCompleted} lessons`), h('span', { class: 'chip warn' }, icon('star'), `${p.stats.achievements} badges`))),
    h('div', { class: 'grid two' }, h('section', { class: 'card' }, h('h2', {}, 'Settings'), form), h('div', {}, h('section', { class: 'card', style: { marginTop: 0 } }, h('h2', {}, 'Password'), pform),
      h('section', { class: 'card' }, h('h2', {}, 'Account'), h('div', { class: 'stack' }, h('a', { class: 'btn secondary block', href: '/achievements' }, 'Achievements'), h('a', { class: 'btn secondary block', href: '/leaderboard' }, 'Leaderboard'),
        ['admin', 'editor'].includes(u.role) ? h('a', { class: 'btn secondary block', href: '/admin' }, icon('shield'), 'Admin panel') : null,
        h('button', { class: 'btn danger block', type: 'button', onclick: async () => { if (await confirmDialog('Sign out?', 'You can sign in again at any time.', 'Sign out')) { await api('POST', '/auth/logout', {}); setUser(null, null); session.csrf = null; navigate('/login', true); } } }, icon('logout'), 'Sign out'))))));
  return { el, title: 'Profile', nav: 'profile' };
}
