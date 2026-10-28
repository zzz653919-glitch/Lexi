import { h } from './ui.js';
import { api, session, ApiError } from './api.js';
import { field, wireForm, formErrorBox } from './forms.js';
import { applyBrand } from './brand.js';
import { t, init as initI18n } from './i18n.js';
import { languageSwitcher } from './lang-switcher.js';

const root = document.getElementById('app');
const me = await api('GET', '/auth/me');
session.csrf = me.csrfToken;
let cfg = null;
try { cfg = await api('GET', '/public/config'); applyBrand(cfg.brandColor); } catch (_) { /* default colours */ }
const staff = me.user && ['admin', 'editor'].includes(me.user.role);
if (staff) { location.replace('/admin'); await new Promise(() => {}); }   // already signed in: leave without rendering
try { await initI18n({ user: me.user, config: cfg }); } catch (_) { await new Promise(() => {}); }   // navigation aborted the request
document.title = t('auth.admin_title');

const email = field({ label: t('common.email'), name: 'email', type: 'email', autocomplete: 'username', required: true });
const password = field({ label: t('common.password'), name: 'password', type: 'password', autocomplete: 'current-password', required: true });
const err = formErrorBox();
const form = h('form', { novalidate: true }, err, email.el, password.el, h('button', { class: 'btn block', type: 'submit' }, t('common.sign_in')));
wireForm(form, { email, password }, err, async () => {
  const r = await api('POST', '/auth/login', { email: email.value, password: password.value });
  session.csrf = r.csrfToken;
  if (!['admin', 'editor'].includes(r.user.role)) {
    await api('POST', '/auth/logout', {});
    throw new ApiError(403, t('auth.admin_no_access'), {});
  }
  location.replace('/admin');
});
root.append(h('main', { class: 'guest' }, h('div', { class: 'guest-bar' }, languageSwitcher({ className: 'compact' })), h('div', { class: 'card auth-card' },
  h('img', { class: 'mascot', src: '/img/mascot.svg', alt: '' }), h('h1', { class: 'center' }, t('auth.admin_title')), h('p', { class: 'muted center' }, t('auth.admin_subtitle')), form,
  h('p', { class: 'center small' }, h('a', { href: '/' }, t('auth.back_to_site'))))));
