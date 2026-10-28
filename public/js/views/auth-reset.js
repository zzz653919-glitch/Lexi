import { h, toast } from '../ui.js';
import { api } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { navigate } from '../app.js';
import { t } from '../i18n.js';
import { authPage } from './auth-shared.js';

export default function reset({ query }) {
  const token = query.get('token') || '';
  const password = field({ label: t('auth.new_password'), name: 'password', type: 'password', autocomplete: 'new-password', required: true, hint: t('auth.password_hint') });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, password.el, h('button', { class: 'btn block', type: 'submit' }, t('auth.set_password')));
  wireForm(form, { password }, err, async () => { await api('POST', '/auth/reset', { token, password: password.value }); toast(t('auth.password_changed_signin'), 'success'); navigate('/login', true); });
  return { el: authPage(t('auth.reset_title'), null, token ? form : h('div', { class: 'form-error' }, t('auth.link_invalid'))), title: t('auth.reset_title'), nav: '' };
}
