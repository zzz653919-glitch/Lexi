import { h } from '../ui.js';
import { api, session } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { setUser, navigate } from '../app.js';
import { authPage, tz } from './auth-shared.js';

const LEVELS = [['A1', 'A1 — I am a beginner'], ['A2', 'A2 — I know the basics'], ['B1', 'B1 — I can talk about familiar topics'], ['B2', 'B2 — I can discuss most topics'], ['C1', 'C1 — I am advanced']];
const GOALS = [['10', 'Casual — 10 XP a day'], ['20', 'Regular — 20 XP a day'], ['30', 'Serious — 30 XP a day'], ['50', 'Intense — 50 XP a day']];

export default function register() {
  if (session.config && !session.config.registrationOpen) return { el: authPage('Registration is closed', 'New accounts cannot be created right now.', h('a', { class: 'btn block', href: '/login' }, 'Sign in')), title: 'Register', nav: '' };
  const name = field({ label: 'Display name', name: 'displayName', autocomplete: 'nickname', required: true, maxlength: 30, hint: 'Shown on your profile and, if you opt in, the leaderboard.' });
  const email = field({ label: 'E-mail', name: 'email', type: 'email', autocomplete: 'email', required: true });
  const password = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'new-password', required: true, hint: 'At least 8 characters, with letters and a digit.' });
  const level = field({ label: 'Where do you want to start?', name: 'startLevel', type: 'select', options: LEVELS.map(([v, l]) => ({ value: v, label: l })), value: 'A1' });
  const goal = field({ label: 'Daily goal', name: 'dailyGoalXp', type: 'select', options: GOALS.map(([v, l]) => ({ value: v, label: l })), value: '30' });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, name.el, email.el, password.el, level.el, goal.el, h('button', { class: 'btn block', type: 'submit' }, 'Create account'));
  wireForm(form, { displayName: name, email, password, startLevel: level, dailyGoalXp: goal }, err, async () => {
    const r = await api('POST', '/auth/register', { displayName: name.value, email: email.value, password: password.value, startLevel: level.value, dailyGoalXp: Number(goal.value), timezone: tz() });
    setUser(r.user, r.csrfToken);
    navigate('/learn', true);
  });
  return { el: authPage('Create your account', 'Free, and your progress is saved.', form, h('p', { class: 'center' }, 'Already registered? ', h('a', { href: '/login' }, 'Sign in'))), title: 'Create account', nav: '' };
}
