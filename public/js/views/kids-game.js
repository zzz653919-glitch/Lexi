/* LEXIO KIDS: plays one mini game, then shows the stars and rewards. */
import { h, toast } from '../ui.js';
import { get, post } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile, choices, confetti, celebrate, leaveKids, flushListens } from '../kids/common.js';
import { companion } from '../kids/characters.js';
import { kidsPage, kidsView, breakCard } from '../kids/shell.js';
import { GAMES } from '../kids/games.js';

export default async function kidsGame({ params }) {
  await initKids();
  const code = params.code;
  if (!GAMES[code]) return kidsView(kidsPage('games', h('div', { class: 'k-card center' }, h('h1', {}, t('app.not_found_title')), h('a', { class: 'k-big-btn go', href: '/kids/games' }, t('kids.nav.games')))).el, '');
  if (profile().limitReached) return kidsView(kidsPage('games', breakCard()).el, t('kids.nav.games'));
  const { cards } = await get('/kids/cards');
  const started = Date.now();
  let correct = 0, total = 0; const ids = new Set();
  const friend = companion({ character: profile().character, accessory: profile().accessory, size: 88, bubble: true, label: t('kids.my_friend') });
  const stage = h('main', { class: 'k-stage', id: 'k-main', tabindex: '-1', 'aria-live': 'polite' });
  const root = h('div', { class: 'kids kids-lesson kids-game', style: { '--c': ({ catcher: '#ff8a1f', match: '#35a7ff', bubbles: '#4cc9f0', memory: '#9b5de5', sounds: '#2ec27e', colorhunt: '#ff6fb5', builder: '#ffb703', puzzle: '#ef476f' })[code] },
    'data-game': code });
  const setStage = (...nodes) => { stage.replaceChildren(...nodes); stage.classList.remove('k-in'); void stage.offsetWidth; stage.classList.add('k-in'); window.scrollTo(0, 0); };
  const shake = (el) => { friend.react('oops'); friend.say(t('kids.say_wrong.' + (1 + Math.floor(Math.random() * 2)))); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  const cheer = () => { friend.react('cheer'); friend.say(t('kids.say_right.' + (1 + Math.floor(Math.random() * 2)))); const b = h('div', { class: 'k-cheer', 'aria-hidden': 'true' }, ['🎉', '⭐', '👏', '🌟'][Math.floor(Math.random() * 4)]); root.append(b); setTimeout(() => b.remove(), 900); };
  const head = (icon, title, sub) => h('div', { class: 'k-step-head' }, h('span', { class: 'k-step-icon', 'aria-hidden': 'true' }, icon), h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null));
  const ctx = {
    pool: cards, stage, setStage, friend, shake, cheer, head, choices: choices(), young: profile().age === 'young', tell: (k) => friend.say(t(k + '.' + (1 + Math.floor(Math.random() * 2)))),
    record(ok, id) { total++; if (ok) { correct++; if (id) ids.add(id); } },
    async finish(opts = {}) {
      total += opts.extraMiss || 0;
      if (!total) { total = 1; correct = 1; }
      setStage(h('div', { class: 'k-result' }, h('p', {}, t('kids.saving'))));
      let r;
      try { r = await post(`/kids/games/${code}/complete`, { correct, total: Math.min(total, 60), seconds: Math.round((Date.now() - started) / 1000), wordIds: [...ids] }); }
      catch (e) { toast(e.message || t('app.error_text'), 'error', 5000); const p = correct / total; r = { stars: p >= .9 ? 3 : p >= .6 ? 2 : 1, gained: 0, newRewards: [] }; }
      confetti(root); friend.react('cheer', 4000); friend.say(t('kids.say_done')); flushListens();
      setStage(h('div', { class: 'k-result', 'data-stars': String(r.stars), 'data-game': code }, h('h1', {}, t('kids.done_title')),
        h('div', { class: 'k-big-stars', 'aria-label': t('kids.stars_of', { n: r.stars, max: 3 }) }, [1, 2, 3].map((i) => h('span', { class: 'k-bigstar' + (i <= r.stars ? ' on' : ''), style: { animationDelay: (i * 0.25) + 's' } }, '⭐'))),
        h('p', { class: 'k-score' }, t('kids.done_text', { correct, total: Math.min(total, 60) })), r.gained ? h('p', { class: 'k-gain' }, t('kids.new_stars', { n: r.gained })) : null,
        h('div', { class: 'k-actions' }, h('a', { class: 'k-big-btn go', id: 'k-again', href: '/kids/games/' + code }, '🔁 ', t('kids.play_again')), h('a', { class: 'k-big-btn me', id: 'k-games', href: '/kids/games' }, '🎮 ', t('kids.nav.games')))));
      if (r.newRewards && r.newRewards.length) setTimeout(() => celebrate(r.newRewards, root), 900);
    },
  };
  root.append(h('div', { class: 'k-sky', 'aria-hidden': 'true' }, h('span', { class: 'k-cloud c1' }, '☁️'), h('span', { class: 'k-cloud c2' }, '☁️')),
    h('header', { class: 'k-top k-lesson-top' }, h('a', { class: 'k-back', href: '/kids/games', 'aria-label': t('kids.nav.games') }, '🎮'), h('div', { class: 'k-lesson-title' }, h('b', {}, t('kids.game.' + code))), h('span', { class: 'k-gear-spacer' })),
    h('div', { class: 'k-friend-row' }, friend.el), stage);
  friend.say(t('kids.game.' + code + '.how'));
  GAMES[code](ctx);
  return { el: root, title: t('kids.game.' + code) + ' · ' + t('kids.brand'), nav: '', bare: true, cleanup: leaveKids };
}
