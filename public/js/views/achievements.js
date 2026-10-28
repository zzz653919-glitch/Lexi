import { h, icon } from '../ui.js';
import { get } from '../api.js';
import { t, fmt } from '../i18n.js';

const IC = { flame: 'flame', bolt: 'bolt', trophy: 'trophy', target: 'target', cards: 'cards', flag: 'flag', path: 'path', star: 'star' };
export const achievementIcon = (name) => IC[name] || 'star';

export default async function achievements() {
  const d = await get('/achievements');
  const got = d.items.filter((a) => a.earnedAt).length;
  const el = h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', {}, t('nav.achievements')), h('span', { class: 'chip' }, `${got} / ${d.items.length}`)),
    h('div', { class: 'grid two' }, d.items.map((a) => h('div', { class: 'card ach-card' + (a.earnedAt ? '' : ' locked'), style: { marginTop: 0 } }, h('div', { class: 'ico' }, icon(achievementIcon(a.icon))), h('div', {}, h('b', {}, t('ach.' + a.code + '.title')), h('div', { class: 'muted small' }, t('ach.' + a.code + '.desc')), a.earnedAt ? h('div', { class: 'chip ok', style: { marginTop: '6px' } }, icon('check'), t('ach.earned', { date: fmt.date(a.earnedAt) })) : h('div', { class: 'muted small', style: { marginTop: '6px' } }, t('ach.locked')))))));
  return { el, title: t('nav.achievements'), nav: 'achievements' };
}
