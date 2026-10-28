import { h } from '../ui.js';
import { api, session } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { setUser, navigate } from '../app.js';
import { t, adopt } from '../i18n.js';
import { authPage } from './auth-shared.js';

export default function login({ query }) {
  const email = field({ label: t('common.email'), name: 'email', type: 'email', autocomplete: 'email', required: true });
  const password = field({ label: t('common.password'), name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, email.el, password.el, h('button', { class: 'btn block', type: 'submit' }, t('common.sign_in')));
  wireForm(form, { email, password }, err, async () => {
    const r = await api('POST', '/auth/login', { email: email.value, password: password.value });
    setUser(r.user, r.csrfToken);
    await adopt(r.user.uiLanguage);          // the language saved in the profile applies on this device too
    const next = query.get('next');
    navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', true);
  });
  const el = authPage(t('auth.welcome_back'), t('auth.signin_subtitle'), form,
    h('p', { class: 'center small' }, h('a', { href: '/forgot' }, t('auth.forgot_link'))),
    session.config && session.config.registrationOpen ? h('p', { class: 'center' }, t('auth.new_here') + ' ', h('a', { href: '/register' }, t('auth.create_account_link'))) : null);
  return { el, title: t('common.sign_in'), nav: '' };
}
