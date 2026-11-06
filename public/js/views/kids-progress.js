/* LEXIO KIDS: "My progress" for the child: stars on the way, this week, every category, badges. */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t, lang } from '../i18n.js';
import { initKids } from '../kids/common.js';
import { kidsPage, kidsView } from '../kids/shell.js';
import { starRow } from './kids-lessons.js';

export default async function kidsProgress() {
  await initKids();
  const [d, pr] = await Promise.all([get('/kids/overview'), get('/kids/progress')]);
  const pct = d.maxStars ? Math.round((100 * d.stars) / d.maxStars) : 0;
  const dayName = (iso) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString(lang(), { weekday: 'short' }); } catch (_) { return iso.slice(5); } };
  const stat = (emoji, v, label, id) => h('div', { class: 'k-stat', id }, h('span', { 'aria-hidden': 'true' }, emoji), h('b', {}, v), h('small', {}, label));
  const road = h('section', { class: 'k-card k-road', 'aria-label': t('kids.my_stars') },
    h('div', { class: 'k-road-head' }, h('b', {}, t('kids.my_stars')), h('span', {}, t('kids.stars_of', { n: d.stars, max: d.maxStars })), h('span', {}, t('kids.lessons_of', { n: d.lessonsDone, max: d.lessonsTotal }))),
    h('div', { class: 'k-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('div', { class: 'k-fill', style: { width: Math.max(pct, 2) + '%' } }), h('span', { class: 'k-walker-emoji', style: { left: `calc(${Math.min(pct, 94)}%)` }, 'aria-hidden': 'true' }, '🐰'), h('span', { class: 'k-flag', 'aria-hidden': 'true' }, '🏁')));
  const stats = h('div', { class: 'k-stats' }, stat('⭐', pr.stars, t('kids.stat_stars'), 'k-stat-stars'), stat('🌱', pr.words.known, t('kids.stat_words'), 'k-stat-words'), stat('📚', `${pr.lessons.done}/${pr.lessons.total}`, t('kids.stat_lessons'), 'k-stat-lessons'),
    stat('🎮', `${pr.games.played}/${pr.games.total}`, t('kids.stat_games'), 'k-stat-games'), stat('📖', `${pr.stories.read}/${pr.stories.total}`, t('kids.stat_stories'), 'k-stat-stories'), stat('🏅', `${pr.stickers.earned}/${pr.stickers.total}`, t('kids.stat_stickers'), 'k-stat-stickers'));
  const week = h('section', { class: 'k-card k-week', 'aria-labelledby': 'k-week-h' },
    h('div', { class: 'k-road-head' }, h('b', { id: 'k-week-h' }, t('kids.today')), h('span', { id: 'k-today' }, t('kids.today_text', { lessons: d.today.lessons, stars: d.today.stars })), d.streak > 1 ? h('span', { class: 'k-streak' }, '🔥 ', t('kids.streak', { n: d.streak })) : null),
    h('div', { class: 'k-days' }, d.week.map((x) => h('div', { class: 'k-day' + (x.today ? ' today' : '') + (x.lessons ? ' on' : '') }, h('span', { class: 'k-day-dot', 'aria-hidden': 'true' }, x.lessons ? '⭐' : '·'), h('small', {}, dayName(x.date)), h('span', { class: 'sr-only' }, t('kids.today_text', { lessons: x.lessons, stars: x.stars }))))));
  const cats = h('section', { class: 'k-card', 'aria-labelledby': 'k-cats-h' }, h('h2', { class: 'k-h2', id: 'k-cats-h' }, t('kids.by_category')),
    h('ul', { class: 'k-cat-bars' }, pr.categories.map((c) => h('li', { 'data-slug': c.slug }, h('span', { class: 'k-cat-bar-emoji', 'aria-hidden': 'true' }, c.emoji), h('a', { href: `/kids/learn/${c.slug}?part=${c.nextPart}` }, h('b', {}, c.title)),
      h('div', { class: 'k-mbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': c.maxStars, 'aria-valuenow': c.stars, 'aria-label': c.title }, h('i', { style: { width: Math.round((100 * c.stars) / c.maxStars) + '%', background: c.color } })), starRow(Math.min(3, Math.round(c.stars / c.parts)))))));
  const badges = h('section', { class: 'k-card', 'aria-labelledby': 'k-badges-h' }, h('h2', { class: 'k-h2', id: 'k-badges-h' }, t('kids.my_badges')),
    h('ul', { class: 'k-badges' }, d.badges.map((b) => h('li', { class: 'k-badge' + (b.earned ? ' on' : ''), 'data-code': b.code, title: t('kids.badge.' + b.code + '.desc') },
      h('span', { class: 'k-badge-emoji', 'aria-hidden': 'true' }, b.earned ? b.emoji : '🔒'), h('b', {}, t('kids.badge.' + b.code)), h('small', {}, b.earned ? t('kids.badge_earned') : t('kids.badge.' + b.code + '.desc'))))));
  const page = kidsPage('progress', h('h1', { class: 'k-h2' }, t('kids.nav.progress')), road, stats, week, cats, badges);
  page.setStars(d.stars);
  return kidsView(page.el, t('kids.nav.progress'));
}
