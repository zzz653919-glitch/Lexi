/* LEXIO KIDS: shared helpers (stylesheet, pictures, speech, small random helpers). */
import { h, speak, canSpeak } from '../ui.js';
import { get, post } from '../api.js';
import { t } from '../i18n.js';

let cssLoaded = false;
export function loadKidsCss() {
  if (cssLoaded || document.querySelector('link[data-kids]')) { cssLoaded = true; return Promise.resolve(); }
  cssLoaded = true;
  return new Promise((resolve) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/kids.css'; l.dataset.kids = '1';
    l.onload = l.onerror = () => resolve(); document.head.append(l);
  });
}

export const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const sample = (a, n) => shuffle(a).slice(0, n);

/* what is written / spoken for a card: letters use the example word ("Apple"), everything else the English text itself */
export const labelOf = (c, kind) => (kind === 'letters' && c.extra ? c.extra : c.en);
export const badgeOf = (c, kind) => (kind === 'letters' ? c.en : kind === 'numbers' ? c.extra : '');
export const spokenOf = (c, kind) => (kind === 'letters' ? `${c.en}. ${c.extra}` : c.en);

/* the picture of a card: an uploaded image, a colour swatch (#rrggbb) or an emoji / row of emoji */
export function picture(c, cls = '') {
  if (c.image) return h('img', { class: 'kpic kpic-img ' + cls, src: c.image, alt: '', draggable: 'false' });
  if (/^#[0-9a-fA-F]{6}$/.test(c.pic || '')) return h('span', { class: 'kpic kpic-swatch ' + cls, style: { background: c.pic }, 'aria-hidden': 'true' });
  const count = [...(c.pic || '')].length;
  return h('span', { class: 'kpic kpic-emoji ' + cls + (count > 4 ? ' many' : ''), 'aria-hidden': 'true' }, c.pic || '⭐');
}

/* the child's profile (companion, background, parent settings), loaded once per visit */
export const kidsState = { profile: null };
export const profile = () => kidsState.profile || {};
export const choices = () => (profile().age === 'young' ? 3 : 4);     // young children get fewer answers to choose from
export async function initKids(force = false) {
  const [, p] = await Promise.all([loadKidsCss(), force || !kidsState.profile ? get('/kids/profile') : Promise.resolve(kidsState.profile)]);
  kidsState.profile = p; applyBackground();
  return p;
}
export function applyBackground() {
  document.body.classList.add('kids-body');
  document.body.className = document.body.className.replace(/\bkids-bg-\S+/g, '').trim() + ' kids-bg-' + (profile().background || 'sky');
}
export function leaveKids() { document.body.className = document.body.className.replace(/\bkids-(body|bg-\S+)/g, '').trim(); flushListens(); }

/* every word the child listens to is counted for the daily mission (sent when a page is left or finished) */
let pendingListens = 0;
export const trackListen = () => { pendingListens++; };
export function flushListens() { if (!pendingListens) return; const n = Math.min(pendingListens, 60); pendingListens = 0; post('/kids/event', { kind: 'listen', n }).catch(() => {}); }

/* sound: the parent's setting AND the switch in the lesson header (remembered on this device) */
const KEY = 'lexi.kids.sound';
export const soundOn = () => { if (kidsState.profile && kidsState.profile.sound === false) return false; try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } };
export const setSound = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* ignore */ } };
export function say(c, kind, slow = false) {
  if (!soundOn()) return;
  trackListen();
  if (c.audio) return speak({ url: c.audio }, slow);
  if (canSpeak()) speak({ text: spokenOf(c, kind) }, slow);
}
export function sayText(text, slow = false) { if (soundOn() && canSpeak()) { trackListen(); speak({ text }, slow); } }

/* falling stars / emoji for celebrations */
export function confetti(host, emojis = ['⭐', '🌟', '✨', '🎈', '🎉', '💛']) {
  const box = h('div', { class: 'k-confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 26; i++) box.append(h('span', { style: { left: Math.round(Math.random() * 100) + '%', animationDelay: (Math.random() * 1.2).toFixed(2) + 's', animationDuration: (2.2 + Math.random() * 1.8).toFixed(2) + 's', fontSize: (18 + Math.random() * 20).toFixed(0) + 'px' } }, emojis[i % emojis.length]));
  host.append(box); setTimeout(() => box.remove(), 5200);
}
export const MASCOTS = { leo: '/img/kids-leo.svg', bunny: '/img/kids-bunny.svg' };

/* names of rewards (stickers, animals, accessories…) */
export function rewardName(r) {
  if (r.name) return r.name;
  const key = r.code.startsWith('game_') ? 'kids.game.' + r.code.slice(5) : r.code.startsWith('story_') ? 'kids.story.' + r.code.slice(6) : r.kind === 'sticker' ? 'kids.r.sticker.' + r.code : r.kind === 'decor' ? '' : `kids.r.${r.kind}.${r.code}`;
  return key ? t(key) : r.code;
}
/* a pop-up with what was just earned (stickers, accessories, places…) — click anywhere to close */
export function celebrate(rewards, host = document.body) {
  const list = (rewards || []).filter((r) => r.kind !== 'decor').slice(0, 4);
  if (!list.length) return null;
  const close = () => { box.remove(); };
  const box = h('div', { class: 'k-modal k-reward-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('kids.new_reward'), onclick: close },
    h('div', { class: 'k-modal-card k-reward-card' }, h('h2', {}, t('kids.new_reward')), h('div', { class: 'k-reward-list' }, list.map((r) => h('div', { class: 'k-reward', 'data-kind': r.kind, 'data-code': r.code }, h('span', { class: 'k-reward-emoji', 'aria-hidden': 'true' }, r.emoji || '⭐'), h('b', {}, rewardName(r)), h('small', {}, t('kids.kind.' + r.kind))))),
      h('button', { class: 'k-big-btn go', type: 'button', onclick: close }, t('kids.hooray'))));
  host.append(box); confetti(box); box.querySelector('button').focus();
  return box;
}
export const minutes = (sec) => Math.round((sec || 0) / 60);
