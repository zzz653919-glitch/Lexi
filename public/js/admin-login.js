import { h } from './ui.js';
import { api, session, ApiError } from './api.js';
import { field, wireForm, formErrorBox } from './forms.js';
import { applyBrand } from './brand.js';

const root = document.getElementById('app');
const me = await api('GET', '/auth/me');
session.csrf = me.csrfToken;
try { applyBrand((await api('GET', '/public/config')).brandColor); } catch (_) { /* default colours */ }
if (me.user && ['admin', 'editor'].includes(me.user.role)) location.replace('/admin');

const email = field({ label: 'E-mail', name: 'email', type: 'email', autocomplete: 'username', required: true });
const password = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
const err = formErrorBox();
const form = h('form', { novalidate: true }, err, email.el, password.el, h('button', { class: 'btn block', type: 'submit' }, 'Sign in'));
wireForm(form, { email, password }, err, async () => {
  const r = await api('POST', '/auth/login', { email: email.value, password: password.value });
  session.csrf = r.csrfToken;
  if (!['admin', 'editor'].includes(r.user.role)) {
    await api('POST', '/auth/logout', {});
    throw new ApiError(403, 'This account does not have access to the admin panel.', {});
  }
  location.replace('/admin');
});
root.append(h('main', { class: 'guest' }, h('div', { class: 'card auth-card' },
  h('img', { class: 'mascot', src: '/img/mascot.svg', alt: '' }), h('h1', { class: 'center' }, 'Admin panel'), h('p', { class: 'muted center' }, 'Sign in with an administrator or editor account.'), form,
  h('p', { class: 'center small' }, h('a', { href: '/' }, 'Back to the learning site')))));
