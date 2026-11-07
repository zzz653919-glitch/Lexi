/* Daily missions, how LEXIO TOKENS are earned, badges and the token history. */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t, fmt } from '../i18n.js';
import { refreshStats } from '../app.js';
import { loadBoot, avatarNav, tokenAmount, A } from '../avatar/ui.js';

const EMOJI = { lessons: '📚', words: '🌱', vocab_test: '📝', listening: '🎧', speaking: '🎤', streak: '🔥' };
const BADGE_EMOJI = { first_purchase: '🛍️', collector_5: '🎒', collector_10: '🧺', collector_25: '🏛️', rare_find: '💎', legendary: '👑', pet_friend: '🐾', stylist: '🎨', first_mission: '🎯', mission_master: '🏆', tokens_100: '🪙', tokens_500: '💰', tokens_1000: '🤑' };

export default async function avatarMissions() {
  const boot = await loadBoot(true);
  const [m, w] = await Promise.all([get('/avatar/missions'), get('/avatar/wallet')]);
  refreshStats();   // a mission that was just paid shows its reward animation
  const done = m.missions.filter((x) => x.done).length;
  const mission = (x) => h('article', { class: 'av-mission' + (x.done ? ' done' : ''), 'data-code': x.code, 'data-done': String(x.done), 'data-claimed': String(!!x.claimed) },
    h('span', { class: 'av-mission-emoji', 'aria-hidden': 'true' }, x.done ? '✅' : EMOJI[x.code]), h('div', { class: 'av-mission-body' }, h('b', {}, t('av.mission.' + x.code)),
      h('div', { class: 'av-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': x.need, 'aria-valuenow': x.have, 'aria-label': t('av.mission.' + x.code) }, h('i', { style: { width: Math.round(100 * x.have / x.need) + '%' } }))),
    h('span', { class: 'av-mission-n' }, `${x.have}/${x.need}`), h('span', { class: 'av-mission-reward' }, x.claimed ? h('span', { class: 'av-got' }, '✔ +', String(m.reward)) : tokenAmount(m.reward)));
  const earnRows = [['lesson', m.rewards.lesson], ['topic', m.rewards.topic], ['test', m.rewards.test], ['mission', m.rewards.mission], ['streak', m.rewards.streak], ['level', m.rewards.level]];
  const el = h('div', { class: 'av-page av-missions' }, h('div', { class: 'av-head' }, h('h1', {}, t('av.missions_title')), avatarNav('missions')),
    h('p', { class: 'av-lead' }, t('av.missions_lead')),
    h('section', { class: 'av-card-box' }, h('div', { class: 'av-box-head' }, h('h2', {}, t('av.today')), h('span', { id: 'av-mis-count' }, t('av.missions_done', { n: done, max: m.missions.length }))), h('div', { class: 'av-missions-list' }, m.missions.map(mission)),
      m.allDone ? h('p', { class: 'av-bonus' }, '🏆 ', t('av.missions_all')) : null),
    h('section', { class: 'av-card-box' }, h('h2', {}, t('av.how_earn')), h('p', { class: 'av-note' }, t('av.how_earn_text')), h('ul', { class: 'av-earn-list', id: 'av-earn-list' }, earnRows.map(([k, n]) => h('li', { 'data-reason': k }, h('span', {}, t('av.earn.' + k)), tokenAmount(n))))),
    h('section', { class: 'av-card-box' }, h('h2', {}, t('av.badges')), h('ul', { class: 'av-badges' }, boot.spec.badges.map((c) => h('li', { class: 'av-badge' + (m.badges.includes(c) ? ' on' : ''), 'data-code': c }, h('span', { 'aria-hidden': 'true' }, m.badges.includes(c) ? BADGE_EMOJI[c] : '🔒'), h('b', {}, t('av.badge.' + c)), h('small', {}, t('av.badge.' + c + '.desc')))))),
    h('section', { class: 'av-card-box' }, h('div', { class: 'av-box-head' }, h('h2', {}, t('av.history')), h('span', {}, t('av.total_earned', { n: w.wallet.earned }))),
      w.items.length ? h('ul', { class: 'av-history', id: 'av-history' }, w.items.map((x) => h('li', { class: x.amount > 0 ? 'plus' : 'minus', 'data-ref': x.ref }, h('span', {}, t('av.reason.' + x.reason), x.meta && x.meta.name ? ' · ' + x.meta.name : ''), h('b', {}, (x.amount > 0 ? '+' : '') + x.amount), h('small', {}, fmt.dateTime ? fmt.dateTime(x.created_at) : x.created_at)))) : h('p', { class: 'av-empty' }, t('av.history_empty'))));
  return { el, title: t('av.missions_title'), nav: 'avatar' };
}
