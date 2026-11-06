/* LEXIO KIDS home: the learning friend greets the child, the next lesson, today's missions, quick fun. */
import { h } from '../ui.js';
import { get, session } from '../api.js';
import { t, lang } from '../i18n.js';
import { initKids, profile, sayText } from '../kids/common.js';
import { companion } from '../kids/characters.js';
import { kidsPage, kidsView, breakCard } from '../kids/shell.js';

const MISSION_EMOJI = { words: '🌱', lesson: '📚', game: '🎮', listen: '👂', quiz: '🧠' };

export function missionsCard(missions, bonus) {
  const done = missions.filter((m) => m.done).length;
  return h('section', { class: 'k-card k-missions', id: 'k-missions', 'aria-labelledby': 'k-mis-h' },
    h('div', { class: 'k-road-head' }, h('h2', { class: 'k-h2', id: 'k-mis-h' }, t('kids.missions')), h('span', { id: 'k-mis-count' }, t('kids.missions_done', { n: done, max: missions.length }))),
    h('ul', { class: 'k-mission-list' }, missions.map((m) => h('li', { class: 'k-mission' + (m.done ? ' done' : ''), 'data-code': m.code, 'data-done': String(m.done) },
      h('span', { class: 'k-mission-emoji', 'aria-hidden': 'true' }, m.done ? '✅' : MISSION_EMOJI[m.code]),
      h('div', { class: 'k-mission-body' }, h('b', {}, t('kids.mission.' + m.code)),
        h('div', { class: 'k-mbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': m.need, 'aria-valuenow': m.have, 'aria-label': t('kids.mission.' + m.code) }, h('i', { style: { width: Math.round((100 * m.have) / m.need) + '%' } }))),
      h('span', { class: 'k-mission-n' }, `${m.have}/${m.need}`)))),
    done === missions.length ? h('p', { class: 'k-bonus' }, '🎯 ', t('kids.missions_all')) : null);
}

export default async function kidsHome() {
  await initKids(true);
  const d = await get('/kids/overview');
  const p = profile(), next = d.next;
  const greetKey = d.missions.every((m) => m.done) ? 'kids.greet_done' : p.hasActivityToday ? 'kids.greet_back' : 'kids.greet_new';
  const friend = companion({ character: d.character, accessory: d.accessory, size: 170, bubble: true, label: t('kids.my_friend') });
  friend.say(t(greetKey, { name: d.name }));
  const speakIt = () => { friend.react('cheer'); sayText(t(greetKey, { name: d.name }).replace(/[!?.]+$/, ''), false); };
  const [hh, mm] = String(p.reminderTime || '17:00').split(':').map(Number), nowD = new Date();
  const remind = p.reminders && !p.hasActivityToday && (nowD.getHours() * 60 + nowD.getMinutes() >= hh * 60 + mm);
  const rnd = (list) => list[Math.floor(Math.random() * list.length)];
  const games = ['catcher', 'match', 'bubbles', 'memory', 'sounds', 'colorhunt', 'builder', 'puzzle'];
  const stories = ['bunny', 'zoo', 'garden', 'school', 'puppy', 'moon'];
  const page = kidsPage('home',
    p.limitReached ? breakCard() : null,
    remind ? h('div', { class: 'k-card k-reminder', id: 'k-reminder', role: 'status' }, h('span', { 'aria-hidden': 'true' }, '⏰'), h('b', {}, t('kids.reminder')) ) : null,
    h('section', { class: 'k-hero' },
      h('button', { class: 'k-hero-mascot k-friend-tap', type: 'button', 'aria-label': t('kids.my_friend'), onclick: speakIt }, friend.el),
      h('div', { class: 'k-hero-text' },
        next && !p.limitReached ? h('a', { class: 'k-play', id: 'k-next', href: `/kids/learn/${next.slug}?part=${next.part}`, style: { '--c': next.color }, 'data-slug': next.slug },
          h('span', { class: 'k-play-emoji' }, next.emoji), h('span', { class: 'k-play-text' }, h('small', {}, t('kids.next_game')), h('b', {}, next.title)), h('span', { class: 'k-play-go', 'aria-hidden': 'true' }, '▶'))
          : !next ? h('p', { class: 'k-bubble' }, t('kids.all_done')) : null)),
    missionsCard(d.missions, d.missionsBonus),
    h('section', { 'aria-labelledby': 'k-fun-h' }, h('h2', { class: 'k-h2', id: 'k-fun-h' }, t('kids.fun_today')),
      h('div', { class: 'k-tiles' },
        h('a', { class: 'k-tile-link', href: '/kids/speak', style: { '--c': '#9b5de5' }, id: 'k-fun-speak' }, h('span', { 'aria-hidden': 'true' }, '🎤'), h('b', {}, t('kids.speak_title'))),
        h('a', { class: 'k-tile-link', href: '/kids/coloring', style: { '--c': '#ff6fb5' }, id: 'k-fun-color' }, h('span', { 'aria-hidden': 'true' }, '🖍️'), h('b', {}, t('kids.coloring_title'))),
        h('a', { class: 'k-tile-link', href: '/kids/games/' + rnd(games), style: { '--c': '#35a7ff' }, id: 'k-fun-game' }, h('span', { 'aria-hidden': 'true' }, '🎮'), h('b', {}, t('kids.random_game'))),
        h('a', { class: 'k-tile-link', href: '/kids/stories/' + rnd(stories), style: { '--c': '#ff8a1f' }, id: 'k-fun-story' }, h('span', { 'aria-hidden': 'true' }, '📖'), h('b', {}, t('kids.random_story'))))));
  page.setStars(d.stars);
  return kidsView(page.el, '');
}
