/* LEXIO KIDS: all lessons (14 categories). */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t, n } from '../i18n.js';
import { initKids, profile } from '../kids/common.js';
import { kidsPage, kidsView, breakCard } from '../kids/shell.js';

export const starRow = (n3, total = 3) => h('span', { class: 'k-stars', 'aria-label': t('kids.stars_of', { n: n3, max: total }) }, Array.from({ length: total }, (_, i) => h('span', { class: 'k-star' + (i < n3 ? ' on' : ''), 'aria-hidden': 'true' }, '⭐')));

export default async function kidsLessons() {
  await initKids();
  const d = await get('/kids/overview');
  const grid = h('div', { class: 'k-grid' }, d.categories.map((c) => {
    const firstOpen = c.parts.find((p) => p.stars === 0) || c.parts[0];
    return h('article', { class: 'k-cat' + (c.done ? ' done' : ''), style: { '--c': c.color }, 'data-slug': c.slug },
      h('a', { class: 'k-cat-main', href: `/kids/learn/${c.slug}?part=${firstOpen.part}`, 'aria-label': c.title },
        h('span', { class: 'k-cat-emoji', 'aria-hidden': 'true' }, c.emoji), h('b', {}, c.title), h('small', {}, t('kids.cards_count', { n: c.words }))),
      c.parts.length === 1 ? starRow(c.parts[0].stars) : h('div', { class: 'k-parts' }, c.parts.map((p) => h('a', { class: 'k-part' + (p.stars ? ' done' : ''), href: `/kids/learn/${c.slug}?part=${p.part}`, 'aria-label': `${c.title} ${t('kids.part', { n: p.part })}` }, h('span', {}, p.part), starRow(p.stars)))));
  }));
  const page = kidsPage('lessons', profile().limitReached ? breakCard() : null, h('section', { 'aria-labelledby': 'k-games-h' }, h('h1', { class: 'k-h2', id: 'k-games-h' }, t('kids.pick_game')), grid));
  page.setStars(d.stars);
  return kidsView(page.el, t('kids.nav.lessons'));
}
