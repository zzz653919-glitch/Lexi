import { h, avatar, icon, modal } from '../ui.js';
import { renderAvatar } from '../avatar/render.js';
import { loadAvatarCss } from '../avatar/ui.js';
import { get, patch } from '../api.js';
import { t, fmt } from '../i18n.js';
import { navigate } from '../app.js';

export default async function leaderboard() {
  const d = await get('/leaderboard');
  const title = t('nav.leaderboard');
  const el = h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', {}, title)));
  if (!d.enabled) { el.append(h('div', { class: 'card empty' }, h('p', {}, t('board.off')))); return { el, title, nav: 'leaderboard' }; }
  el.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, t('board.intro', { date: fmt.date(d.weekStarts) })),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: d.optedIn, onchange: async (e) => { await patch('/me', { leaderboardOptIn: e.target.checked }); navigate('/leaderboard', true); } }), h('span', {}, t('board.opt_in')))));
  await loadAvatarCss();
  const pic = (c, size, view = '62 22 116 116') => { const el = h('span', { class: 'av-wrap' }); el.innerHTML = renderAvatar({ style: c.style, look: c.look, equipped: c.equipped, size, viewBox: view, plain: size < 100, petPose: c.petPose, label: c.name }); return el; };
  /* a click on a person shows their name and character */
  async function show(u) {
    const c = u.character;
    const stage = c ? h('div', { class: 'lb-stage' }, pic(c, 240, '0 0 240 340')) : h('div', { class: 'lb-stage lb-none' }, avatar(u.avatar, 96));
    await modal({ title: u.displayName, content: h('div', { class: 'lb-card', id: 'lb-card' }, stage,
      h('div', { class: 'chips', style: { justifyContent: 'center' } }, h('span', { class: 'chip' }, t('board.rank', { n: fmt.number(u.rank) })), h('span', { class: 'chip bolt' }, icon('bolt'), t('board.week_xp') + ': ' + fmt.number(u.xp)), c ? h('span', { class: 'chip' }, t('board.char_level', { n: c.level })) : null),
      c && c.petName ? h('p', { class: 'muted', style: { textAlign: 'center', margin: 0 } }, t('board.pet', { name: c.petName })) : null, !c ? h('p', { class: 'muted', style: { textAlign: 'center' } }, t('board.no_character', { name: u.displayName })) : null),
      actions: [{ label: t('common.close'), value: true }] });
  }
  const row = (u) => h('li', { class: (u.you ? 'you ' : '') + 'lb-row r' + Math.min(u.rank, 4), tabindex: 0, role: 'button', 'data-rank': u.rank, 'aria-label': t('board.view', { name: u.displayName }), onclick: () => show(u), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(u); } } },
    h('span', { class: 'rank' }, fmt.number(u.rank)), u.character ? h('span', { class: 'lb-char' }, pic(u.character, 48)) : avatar(u.avatar, 40), h('span', { class: 'name' }, u.displayName, u.you ? h('span', { class: 'badge', style: { marginLeft: '8px' } }, t('board.you')) : null), h('span', { class: 'chip bolt' }, icon('bolt'), fmt.number(u.xp)));
  el.append(h('div', { class: 'card' }, d.items.length ? h('ol', { class: 'board' }, d.items.map(row)) : h('div', { class: 'empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('p', {}, t('board.empty')))));
  return { el, title, nav: 'leaderboard' };
}
