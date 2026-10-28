import { h } from '../ui.js';
import { api, session } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { setUser, navigate } from '../app.js';
import { t, lang } from '../i18n.js';
import { authPage, tz } from './auth-shared.js';

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];
const GOALS = ['10', '20', '30', '50'];

export default function register() {
  if (session.config && !session.config.registrationOpen) return { el: authPage(t('auth.registration_closed'), t('auth.registration_closed_text'), h('a', { class: 'btn block', href: '/login' }, t('common.sign_in'))), title: t('auth.create_button'), nav: '' };
  const name = field({ label: t('auth.display_name'), name: 'displayName', autocomplete: 'nickname', required: true, maxlength: 30, hint: t('auth.display_name_hint') });
  const email = field({ label: t('common.email'), name: 'email', type: 'email', autocomplete: 'email', required: true });
  const password = field({ label: t('common.password'), name: 'password', type: 'password', autocomplete: 'new-password', required: true, hint: t('auth.password_hint') });
  const level = field({ label: t('auth.start_level'), name: 'startLevel', type: 'select', options: LEVELS.map((l) => ({ value: l.toUpperCase(), label: t('auth.level_' + l) })), value: 'A1' });
  const goal = field({ label: t('auth.daily_goal'), name: 'dailyGoalXp', type: 'select', options: GOALS.map((g) => ({ value: g, label: t('auth.goal_' + g) })), value: '30' });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, name.el, email.el, password.el, level.el, goal.el, h('button', { class: 'btn block', type: 'submit' }, t('auth.create_button')));
  wireForm(form, { displayName: name, email, password, startLevel: level, dailyGoalXp: goal }, err, async () => {
    // the account starts with the interface language the visitor is looking at; the translation language follows it (Russian -> Russian, otherwise Uzbek)
    const r = await api('POST', '/auth/register', { displayName: name.value, email: email.value, password: password.value, startLevel: level.value, dailyGoalXp: Number(goal.value), timezone: tz(), uiLanguage: lang(), translationLanguage: lang() === 'ru' ? 'ru' : 'uz' });
    setUser(r.user, r.csrfToken);
    navigate('/learn', true);
  });
  return { el: authPage(t('auth.create_title'), t('auth.create_subtitle'), form, h('p', { class: 'center' }, t('auth.have_account') + ' ', h('a', { href: '/login' }, t('common.sign_in')))), title: t('auth.create_button'), nav: '' };
}
