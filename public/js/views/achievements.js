import { h, icon, fmt } from '../ui.js';
import { get } from '../api.js';

const IC = { flame: 'flame', bolt: 'bolt', trophy: 'trophy', target: 'target', cards: 'cards', flag: 'flag', path: 'path', star: 'star' };
export default async function achievements() {
  const d = await get('/achievements');
  const got = d.items.filter((a) => a.earnedAt).length;
  const el = h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', {}, 'Achievements'), h('span', { class: 'chip' }, `${got} / ${d.items.length}`)),
    h('div', { class: 'grid two' }, d.items.map((a) => h('div', { class: 'card ach-card' + (a.earnedAt ? '' : ' locked'), style: { marginTop: 0 } }, h('div', { class: 'ico' }, icon(IC[a.icon] || 'star')), h('div', {}, h('b', {}, a.title), h('div', { class: 'muted small' }, a.description), a.earnedAt ? h('div', { class: 'chip ok', style: { marginTop: '6px' } }, icon('check'), 'Earned ' + fmt.date(a.earnedAt)) : h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'Locked'))))));
  return { el, title: 'Achievements', nav: 'achievements' };
}
