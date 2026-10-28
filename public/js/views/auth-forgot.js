import { h } from '../ui.js';
import { api } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { t } from '../i18n.js';
import { authPage } from './auth-shared.js';

export default function forgot() {
  const email = field({ label: t('common.email'), name: 'email', type: 'email', autocomplete: 'email', required: true });
  const err = formErrorBox(), done = h('div', { class: 'notice', hidden: true, role: 'status' });
  const form = h('form', { novalidate: true }, err, email.el, h('button', { class: 'btn block', type: 'submit' }, t('auth.send_link')));
  wireForm(form, { email }, err, async () => { const r = await api('POST', '/auth/forgot', { email: email.value }); done.textContent = r.message; done.hidden = false; });
  return { el: authPage(t('auth.forgot_title'), t('auth.forgot_subtitle'), done, form, h('p', { class: 'center' }, h('a', { href: '/login' }, t('auth.back_to_signin')))), title: t('auth.forgot_title'), nav: '' };
}
