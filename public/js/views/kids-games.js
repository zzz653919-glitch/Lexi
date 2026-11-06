/* LEXIO KIDS: the games shelf (eight mini games) plus speaking and colouring. */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile } from '../kids/common.js';
import { kidsPage, kidsView, breakCard } from '../kids/shell.js';
import { starRow } from './kids-lessons.js';

export default async function kidsGames() {
  await initKids();
  const [g, o] = await Promise.all([get('/kids/games'), get('/kids/overview')]);
  const tile = (x) => h('a', { class: 'k-game', href: '/kids/games/' + x.code, style: { '--c': x.color }, 'data-game': x.code, 'aria-label': t('kids.game.' + x.code) },
    h('span', { class: 'k-game-emoji', 'aria-hidden': 'true' }, x.emoji), h('b', {}, t('kids.game.' + x.code)), h('small', {}, t('kids.game.' + x.code + '.desc')), starRow(x.stars));
  const page = kidsPage('games', profile().limitReached ? breakCard() : null,
    h('h1', { class: 'k-h2' }, t('kids.nav.games')), h('div', { class: 'k-games-grid' }, g.games.map(tile)),
    h('h2', { class: 'k-h2' }, t('kids.more_fun')),
    h('div', { class: 'k-tiles' },
      h('a', { class: 'k-tile-link', href: '/kids/speak', style: { '--c': '#9b5de5' }, id: 'k-speak' }, h('span', { 'aria-hidden': 'true' }, '🎤'), h('b', {}, t('kids.speak_title'))),
      h('a', { class: 'k-tile-link', href: '/kids/coloring', style: { '--c': '#ff6fb5' }, id: 'k-coloring' }, h('span', { 'aria-hidden': 'true' }, '🖍️'), h('b', {}, t('kids.coloring_title')))));
  page.setStars(o.stars);
  return kidsView(page.el, t('kids.nav.games'));
}
