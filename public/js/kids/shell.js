/* LEXIO KIDS: the common page frame (sky, header with the learning friend, the big illustrated navigation) and the "my friend" picker. */
import { h, toast } from '../ui.js';
import { get, patch, session } from '../api.js';
import { t } from '../i18n.js';
import { companion, CHARACTERS } from './characters.js';
import { kidsState, profile, initKids, applyBackground, leaveKids } from './common.js';

export const NAV = [
  { key: 'home', href: '/kids', emoji: '🏠' }, { key: 'lessons', href: '/kids/lessons', emoji: '📚' }, { key: 'games', href: '/kids/games', emoji: '🎮' }, { key: 'stories', href: '/kids/stories', emoji: '📖' },
  { key: 'world', href: '/kids/world', emoji: '🌍' }, { key: 'stickers', href: '/kids/stickers', emoji: '🏅' }, { key: 'progress', href: '/kids/progress', emoji: '📈' },
];
const BG = { sky: ['#8fd8ff', '#c9f0ff', '#fff4c9', '#ffe0f0'], meadow: ['#9be3a1', '#d7f7c4', '#fff6c9', '#ffe7d6'], space: ['#1d1b4b', '#3a2f8a', '#5a3d9e', '#8a4fb0'], sea: ['#7fe0e8', '#a6ecf0', '#c7f3f7', '#ffe9c8'], candy: ['#ffc2e2', '#ffdff0', '#fff1cc', '#d9f3ff'], forest: ['#a8dca5', '#c9efc0', '#e7f6c8', '#fff0c2'] };

/* the friend (character + accessory the child chose) */
export function myCompanion(size = 64, mood = 'happy') { const p = profile(); return companion({ character: p.character || 'lion', accessory: p.accessory || '', mood, size }); }

/* choose a friend, an accessory and a background (only what has been earned can be chosen) */
export async function friendPicker(onChange) {
  const p = await initKids(true), close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const NEED = { character: { cat: 6, dino: 15, robot: 30 }, accessory: {}, background: {} };
  const save = async (body) => { try { kidsState.profile = { ...kidsState.profile, ...(await patch('/kids/profile', body)) }; applyBackground(); draw(); onChange && onChange(); } catch (e) { toast(e.message, 'error', 4000); } };
  const holder = h('div', { class: 'stack' });
  const row = (title, kind, list, current, make, empty) => h('section', {}, h('h3', {}, title), h('div', { class: 'k-pick-row', role: 'radiogroup', 'aria-label': title }, list.map((code) => {
    const open = (kind === 'accessory' && code === '') || p.unlocked[kind].includes(code);
    return h('button', { type: 'button', class: 'k-pick' + (current === code ? ' on' : '') + (open ? '' : ' locked'), role: 'radio', 'aria-checked': String(current === code), 'data-kind': kind, 'data-code': code, disabled: !open && undefined,
      title: open ? '' : t('kids.locked'), onclick: () => open && save({ [kind]: code }) }, make(code, open));
  }), empty));
  function draw() {
    const cur = profile();
    holder.replaceChildren(
      row(t('kids.pick_friend'), 'character', CHARACTERS, cur.character, (code, open) => h('span', {}, h('span', { class: 'k-pick-art' }, companion({ character: code, accessory: cur.accessory, size: 70 }).el), h('small', {}, open ? t('kids.r.character.' + code) : '🔒'))),
      row(t('kids.pick_accessory'), 'accessory', ['', 'hat', 'glasses', 'bow', 'scarf', 'headphones', 'crown'], cur.accessory || '', (code, open) => h('span', {}, h('span', { class: 'k-pick-emoji' }, code ? { hat: '🎩', glasses: '🕶️', bow: '🎀', scarf: '🧣', headphones: '🎧', crown: '👑' }[code] : '🚫'), h('small', {}, open ? (code ? t('kids.r.accessory.' + code) : t('kids.none')) : '🔒'))),
      row(t('kids.pick_background'), 'background', ['sky', 'meadow', 'space', 'sea', 'candy', 'forest'], cur.background, (code, open) => h('span', {}, h('span', { class: 'k-pick-bg', style: { background: `linear-gradient(180deg, ${BG[code][0]}, ${BG[code][3]})` } }), h('small', {}, open ? t('kids.r.background.' + code) : '🔒'))));
  }
  const box = h('div', { class: 'k-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'k-friend-h', onclick: (e) => { if (e.target === box) close(); } },
    h('div', { class: 'k-modal-card k-friend-card' }, h('h2', { id: 'k-friend-h' }, t('kids.my_friend')), holder, h('button', { class: 'k-big-btn go', type: 'button', onclick: close }, t('kids.done'))));
  draw(); document.addEventListener('keydown', onKey); document.body.append(box); box.querySelector('.k-pick.on, .k-pick').focus();
}

/* page = frame around the content; `active` marks the navigation button */
export function kidsPage(active, ...content) {
  const p = profile(), ch = myCompanion(56);
  const stars = h('b', { id: 'k-total-stars-n' }, String(p.stars || 0));
  const header = h('header', { class: 'k-top' },
    h('a', { class: 'k-logo', href: '/kids', 'aria-label': t('kids.brand') }, h('span', { class: 'k-logo-mark', 'aria-hidden': 'true' }, '🦁'), h('span', {}, 'LEXIO ', h('b', {}, 'KIDS'))),
    h('div', { class: 'k-top-right' },
      h('button', { class: 'k-friend-btn', type: 'button', id: 'k-friend', 'aria-label': t('kids.my_friend'), title: t('kids.my_friend'), onclick: () => friendPicker(() => { ch.set({ character: profile().character, accessory: profile().accessory }); }) }, ch.el),
      h('span', { class: 'k-chip', id: 'k-total-stars' }, '⭐ ', stars),
      h('a', { class: 'k-gear', href: '/kids/parents', 'aria-label': t('kids.parents'), title: t('kids.parents') }, '⚙️')));
  const nav = h('nav', { class: 'k-nav', 'aria-label': t('kids.menu') }, NAV.map((n) => h('a', { class: 'k-nav-item' + (n.key === active ? ' on' : ''), href: n.href, 'data-nav': n.key, 'aria-current': n.key === active ? 'page' : null },
    h('span', { class: 'k-nav-emoji', 'aria-hidden': 'true' }, n.emoji), h('span', { class: 'k-nav-label' }, t('kids.nav.' + n.key)))));
  const bg = BG[p.background] || BG.sky;
  const el = h('div', { class: 'kids kids-page', 'data-bg': p.background || 'sky', style: { '--bg0': bg[0], '--bg1': bg[1], '--bg2': bg[2], '--bg3': bg[3] } },
    h('div', { class: 'k-sky', 'aria-hidden': 'true' }, h('span', { class: 'k-cloud c1' }, '☁️'), h('span', { class: 'k-cloud c2' }, '☁️'), h('span', { class: 'k-sun' }, p.background === 'space' ? '🌙' : '☀️'), h('span', { class: 'k-balloon' }, '🎈')),
    h('div', { class: 'k-wrap' }, header, h('main', { id: 'k-main', tabindex: '-1' }, ...content), nav));
  return { el, setStars: (n) => { stars.textContent = String(n); } };
}
/* the standard result object of a Kids page */
export const kidsView = (el, title, extra = {}) => ({ el, title: (title ? title + ' · ' : '') + t('kids.brand'), nav: '', bare: true, cleanup: leaveKids, ...extra });
/* a friendly stop when the parent's daily time limit is reached */
export function breakCard() {
  return h('section', { class: 'k-card k-break', id: 'k-break' }, h('div', { class: 'k-break-art', 'aria-hidden': 'true' }, '😴'), h('h2', {}, t('kids.break_title')), h('p', {}, t('kids.break_text')), h('a', { class: 'k-big-btn me', href: '/kids/parents' }, '⚙️ ', t('kids.parents')));
}
