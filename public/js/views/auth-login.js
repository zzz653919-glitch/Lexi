import { h } from '../ui.js';
import { api, session } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { setUser, navigate } from '../app.js';
import { authPage } from './auth-shared.js';

export default function login({ query }) {
  const email = field({ label: 'E-mail', name: 'email', type: 'email', autocomplete: 'email', required: true });
  const password = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, email.el, password.el, h('button', { class: 'btn block', type: 'submit' }, 'Sign in'));
  wireForm(form, { email, password }, err, async () => {
    const r = await api('POST', '/auth/login', { email: email.value, password: password.value });
    setUser(r.user, r.csrfToken);
    const next = query.get('next');
    navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', true);
  });
  const el = authPage('Welcome back', 'Sign in to continue learning.', form,
    h('p', { class: 'center small' }, h('a', { href: '/forgot' }, 'Forgot your password?')),
    session.config && session.config.registrationOpen ? h('p', { class: 'center' }, 'New here? ', h('a', { href: '/register' }, 'Create an account')) : null);
  return { el, title: 'Sign in', nav: '' };
}
