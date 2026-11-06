import { h, toast } from '../ui.js';
import { api, session } from '../api.js';
import { setUser, navigate } from '../app.js';
import { adopt } from '../i18n.js';
import { t } from '../i18n.js';
import { authPage } from './auth-shared.js';

/* The "Yes, it is me" link of the e-mail: signs the person in automatically (the link works once), then asks for a new password in the profile. */
export default function confirm({ query }) {
  const token = query.get('token') || '';
  const body = h('p', { class: 'muted center', role: 'status' }, t('auth.confirm_working'));
  const page = authPage(t('auth.confirm_title'), null, token ? body : h('div', { class: 'form-error' }, t('auth.link_invalid')));
  if (token) {
    api('POST', '/auth/confirm', { token }).then(async (r) => {
      setUser(r.user, r.csrfToken);
      session.recovery = !!r.recovery;
      try { await adopt(r.user.uiLanguage); } catch (_) { /* keep the current language */ }
      toast(t('auth.confirm_set_password'), 'success', 6000);
      navigate('/profile', true);
    }).catch(() => { body.replaceWith(h('div', { class: 'form-error' }, t('auth.link_invalid'))); });
  }
  return { el: page, title: t('auth.confirm_title'), nav: '' };
}
