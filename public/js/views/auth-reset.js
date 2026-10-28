import { h } from '../ui.js';
import { api } from '../api.js';
import { field, wireForm, formErrorBox } from '../forms.js';
import { navigate } from '../app.js';
import { toast } from '../ui.js';
import { authPage } from './auth-shared.js';

export default function reset({ query }) {
  const token = query.get('token') || '';
  const password = field({ label: 'New password', name: 'password', type: 'password', autocomplete: 'new-password', required: true, hint: 'At least 8 characters, with letters and a digit.' });
  const err = formErrorBox();
  const form = h('form', { novalidate: true }, err, password.el, h('button', { class: 'btn block', type: 'submit' }, 'Set new password'));
  wireForm(form, { password }, err, async () => { await api('POST', '/auth/reset', { token, password: password.value }); toast('Password changed. Please sign in.', 'success'); navigate('/login', true); });
  return { el: authPage('Choose a new password', null, token ? form : h('div', { class: 'form-error' }, 'This link is not valid.')), title: 'Reset password', nav: '' };
}
