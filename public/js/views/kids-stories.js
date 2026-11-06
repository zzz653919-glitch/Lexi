/* LEXIO KIDS: the story shelf. */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t } from '../i18n.js';
import { initKids } from '../kids/common.js';
import { kidsPage, kidsView } from '../kids/shell.js';
import { starRow } from './kids-lessons.js';

export default async function kidsStories() {
  await initKids();
  const [d, o] = await Promise.all([get('/kids/stories'), get('/kids/overview')]);
  const grid = h('div', { class: 'k-books' }, d.stories.map((s) => h('a', { class: 'k-book' + (s.reads ? ' read' : ''), href: '/kids/stories/' + s.slug, style: { '--c': s.color }, 'data-story': s.slug, 'aria-label': s.title },
    h('span', { class: 'k-book-cover', 'aria-hidden': 'true' }, s.emoji), h('b', {}, s.title), h('small', {}, t('kids.pages_count', { n: s.pages })), starRow(s.stars))));
  const page = kidsPage('stories', h('h1', { class: 'k-h2' }, t('kids.nav.stories')), h('p', { class: 'k-lead' }, t('kids.stories_intro')), grid);
  page.setStars(o.stars);
  return kidsView(page.el, t('kids.nav.stories'));
}
