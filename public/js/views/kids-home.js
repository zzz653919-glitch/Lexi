/* LEXIO KIDS dashboard: stars, today's activity, next game, all games, badges. A separate world: no adult navigation. */
import { h, toast } from '../ui.js';
import { get, post, session } from '../api.js';
import { navigate } from '../app.js';
import { t, n, lang } from '../i18n.js';
import { loadKidsCss, MASCOTS, setSound, soundOn } from '../kids/common.js';

const starRow = (n3, total = 3) => h('span', { class: 'k-stars', 'aria-label': t('kids.stars_of', { n: n3, max: total }) }, Array.from({ length: total }, (_, i) => h('span', { class: 'k-star' + (i < n3 ? ' on' : ''), 'aria-hidden': 'true' }, '⭐')));

function parentsDialog() {
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'k-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'k-par-h', onclick: (e) => { if (e.target === box) close(); } },
    h('div', { class: 'k-modal-card' },
      h('h2', { id: 'k-par-h' }, t('kids.parents')), h('p', {}, t('kids.parents_text')),
      h('label', { class: 'k-switch' }, h('input', { type: 'checkbox', checked: soundOn(), onchange: (e) => setSound(e.target.checked) }), h('span', {}, t('kids.sound'))),
      h('button', { class: 'btn block', type: 'button', 'data-act': 'standard', onclick: async () => { try { const r = await post('/me/mode', { mode: 'standard' }); session.user = r.user; navigate('/', true); } catch (e) { toast(e.message, 'error'); } } }, t('kids.switch_standard')),
      h('button', { class: 'btn secondary block', type: 'button', onclick: close }, t('kids.close'))));
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  box.querySelector('button').focus();
}

export default async function kidsHome() {
  await loadKidsCss();
  const d = await get('/kids/overview');
  const pct = d.maxStars ? Math.round((100 * d.stars) / d.maxStars) : 0;
  document.body.classList.add('kids-body');

  const header = h('header', { class: 'k-top' },
    h('a', { class: 'k-logo', href: '/kids', 'aria-label': t('kids.brand') }, h('img', { src: MASCOTS.leo, alt: '', width: 44, height: 44 }), h('span', {}, 'LEXIO ', h('b', {}, 'KIDS'))),
    h('div', { class: 'k-top-right' },
      h('span', { class: 'k-chip', id: 'k-total-stars' }, '⭐ ', h('b', {}, n(d.stars))),
      h('button', { class: 'k-gear', type: 'button', 'aria-label': t('kids.parents'), title: t('kids.parents'), onclick: parentsDialog }, '⚙️')));

  const next = d.next;
  const hero = h('section', { class: 'k-hero' },
    h('div', { class: 'k-hero-mascot' }, h('img', { class: 'k-bounce', src: MASCOTS.leo, alt: '', width: 150, height: 150 })),
    h('div', { class: 'k-hero-text' },
      h('div', { class: 'k-bubble' }, h('h1', {}, t('kids.hello', { name: d.name }))),
      next ? h('a', { class: 'k-play', id: 'k-next', href: `/kids/learn/${next.slug}?part=${next.part}`, style: { '--c': next.color }, 'data-slug': next.slug },
        h('span', { class: 'k-play-emoji' }, next.emoji), h('span', { class: 'k-play-text' }, h('small', {}, t('kids.next_game')), h('b', {}, next.title)), h('span', { class: 'k-play-go', 'aria-hidden': 'true' }, '▶'))
        : h('p', { class: 'k-bubble' }, t('kids.all_done'))));

  const road = h('section', { class: 'k-card k-road', 'aria-label': t('kids.my_stars') },
    h('div', { class: 'k-road-head' }, h('b', {}, t('kids.my_stars')), h('span', {}, t('kids.stars_of', { n: d.stars, max: d.maxStars })), h('span', {}, t('kids.lessons_of', { n: d.lessonsDone, max: d.lessonsTotal }))),
    h('div', { class: 'k-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('div', { class: 'k-fill', style: { width: Math.max(pct, 2) + '%' } }), h('img', { class: 'k-walker', src: MASCOTS.bunny, alt: '', style: { left: `calc(${Math.min(pct, 96)}% )` }, width: 44, height: 44 }), h('span', { class: 'k-flag', 'aria-hidden': 'true' }, '🏁')));

  const dayName = (iso) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString(lang(), { weekday: 'short' }); } catch (_) { return iso.slice(5); } };
  const week = h('section', { class: 'k-card k-week', 'aria-labelledby': 'k-week-h' },
    h('div', { class: 'k-road-head' }, h('b', { id: 'k-week-h' }, t('kids.today')), h('span', { id: 'k-today' }, t('kids.today_text', { lessons: d.today.lessons, stars: d.today.stars })), d.streak > 1 ? h('span', { class: 'k-streak' }, '🔥 ', t('kids.streak', { n: d.streak })) : null),
    h('div', { class: 'k-days' }, d.week.map((x) => h('div', { class: 'k-day' + (x.today ? ' today' : '') + (x.lessons ? ' on' : '') }, h('span', { class: 'k-day-dot', 'aria-hidden': 'true' }, x.lessons ? '⭐' : '·'), h('small', {}, dayName(x.date)), h('span', { class: 'sr-only' }, t('kids.today_text', { lessons: x.lessons, stars: x.stars }))))));

  const grid = h('section', { 'aria-labelledby': 'k-games-h' }, h('h2', { class: 'k-h2', id: 'k-games-h' }, t('kids.pick_game')),
    h('div', { class: 'k-grid' }, d.categories.map((c) => {
      const firstOpen = c.parts.find((p) => p.stars === 0) || c.parts[0];
      return h('article', { class: 'k-cat' + (c.done ? ' done' : ''), style: { '--c': c.color }, 'data-slug': c.slug },
        h('a', { class: 'k-cat-main', href: `/kids/learn/${c.slug}?part=${firstOpen.part}`, 'aria-label': c.title },
          h('span', { class: 'k-cat-emoji', 'aria-hidden': 'true' }, c.emoji), h('b', {}, c.title), h('small', {}, t('kids.cards_count', { n: c.words }))),
        c.parts.length === 1 ? starRow(c.parts[0].stars) : h('div', { class: 'k-parts' }, c.parts.map((p) => h('a', { class: 'k-part' + (p.stars ? ' done' : ''), href: `/kids/learn/${c.slug}?part=${p.part}`, 'aria-label': `${c.title} ${t('kids.part', { n: p.part })}` }, h('span', {}, p.part), starRow(p.stars)))));
    })));

  const badges = h('section', { class: 'k-card', 'aria-labelledby': 'k-badges-h' }, h('h2', { class: 'k-h2', id: 'k-badges-h' }, t('kids.my_badges')),
    h('ul', { class: 'k-badges' }, d.badges.map((b) => h('li', { class: 'k-badge' + (b.earned ? ' on' : ''), 'data-code': b.code, title: t('kids.badge.' + b.code + '.desc') },
      h('span', { class: 'k-badge-emoji', 'aria-hidden': 'true' }, b.earned ? b.emoji : '🔒'), h('b', {}, t('kids.badge.' + b.code)), h('small', {}, b.earned ? t('kids.badge_earned') : t('kids.badge.' + b.code + '.desc'))))));

  const el = h('div', { class: 'kids kids-home' }, h('div', { class: 'k-sky', 'aria-hidden': 'true' }, h('span', { class: 'k-cloud c1' }, '☁️'), h('span', { class: 'k-cloud c2' }, '☁️'), h('span', { class: 'k-sun' }, '☀️'), h('span', { class: 'k-balloon' }, '🎈')),
    h('div', { class: 'k-wrap' }, header, h('main', { id: 'k-main', tabindex: '-1' }, hero, h('div', { class: 'k-two' }, road, week), grid, badges)));
  return { el, title: t('kids.brand'), nav: '', bare: true, cleanup: () => document.body.classList.remove('kids-body') };
}
