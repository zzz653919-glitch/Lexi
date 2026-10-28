import { h, avatar, icon } from '../ui.js';
import { get, patch, session } from '../api.js';
import { navigate } from '../app.js';

export default async function leaderboard() {
  const d = await get('/leaderboard');
  const el = h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', {}, 'Leaderboard')));
  if (!d.enabled) { el.append(h('div', { class: 'card empty' }, h('p', {}, 'The leaderboard is turned off.'))); return { el, title: 'Leaderboard', nav: 'leaderboard' }; }
  el.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, `Weekly XP since ${d.weekStarts} (UTC). Only learners who opt in appear here, and only with their display name and avatar.`),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: d.optedIn, onchange: async (e) => { await patch('/me', { leaderboardOptIn: e.target.checked }); navigate('/leaderboard', false); location.reload(); } }), h('span', {}, 'Show me on the leaderboard'))));
  el.append(h('div', { class: 'card' }, d.items.length ? h('ol', { class: 'board' }, d.items.map((u) => h('li', { class: u.you ? 'you' : '' }, h('span', { class: 'rank' }, String(u.rank)), avatar(u.avatar, 40), h('span', { class: 'name' }, u.displayName, u.you ? h('span', { class: 'badge', style: { marginLeft: '8px' } }, 'You') : null), h('span', { class: 'chip bolt' }, icon('bolt'), String(u.xp))))) : h('div', { class: 'empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('p', {}, 'Nobody has earned XP this week yet. Be the first!'))));
  return { el, title: 'Leaderboard', nav: 'leaderboard' };
}
