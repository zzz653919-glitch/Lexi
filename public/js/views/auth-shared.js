import { h } from '../ui.js';
import { session } from '../api.js';

export function authPage(title, subtitle, ...body) {
  const site = session.config ? session.config.siteName : 'Lexi Learn';
  return h('div', { class: 'guest' }, h('div', { class: 'card auth-card' },
    h('a', { href: '/', 'aria-label': site + ' home' }, h('img', { class: 'mascot', src: '/img/mascot.svg', alt: '' })),
    h('h1', { class: 'center' }, title), subtitle ? h('p', { class: 'muted center' }, subtitle) : null, ...body));
}
export const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; } };
