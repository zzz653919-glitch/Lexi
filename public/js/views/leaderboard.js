import { h, avatar, icon } from '../ui.js';
import { get, patch } from '../api.js';
import { t, fmt } from '../i18n.js';
import { navigate } from '../app.js';

export default async function leaderboard() {
  const d = await get('/leaderboard');
  const title = t('nav.leaderboard');
  const el = h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', {}, title)));
  if (!d.enabled) { el.append(h('div', { class: 'card empty' }, h('p', {}, t('board.off')))); return { el, title, nav: 'leaderboard' }; }
  el.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, t('board.intro', { date: fmt.date(d.weekStarts) })),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: d.optedIn, onchange: async (e) => { await patch('/me', { leaderboardOptIn: e.target.checked }); navigate('/leaderboard', true); } }), h('span', {}, t('board.opt_in')))));
  el.append(h('div', { class: 'card' }, d.items.length ? h('ol', { class: 'board' }, d.items.map((u) => h('li', { class: u.you ? 'you' : '' }, h('span', { class: 'rank' }, fmt.number(u.rank)), avatar(u.avatar, 40), h('span', { class: 'name' }, u.displayName, u.you ? h('span', { class: 'badge', style: { marginLeft: '8px' } }, t('board.you')) : null), h('span', { class: 'chip bolt' }, icon('bolt'), fmt.number(u.xp))))) : h('div', { class: 'empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('p', {}, t('board.empty')))));
  return { el, title, nav: 'leaderboard' };
}
