/* LEXIO KIDS: shared helpers (stylesheet, pictures, speech, small random helpers). */
import { h, speak, canSpeak } from '../ui.js';

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

/* sound switch (remembered on this device) */
const KEY = 'lexi.kids.sound';
export const soundOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } };
export const setSound = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* ignore */ } };
export function say(c, kind, slow = false) {
  if (!soundOn()) return;
  if (c.audio) return speak({ url: c.audio }, slow);
  if (canSpeak()) speak({ text: spokenOf(c, kind) }, slow);
}
export function sayText(text, slow = false) { if (soundOn() && canSpeak()) speak({ text }, slow); }

/* falling stars / emoji for celebrations */
export function confetti(host, emojis = ['⭐', '🌟', '✨', '🎈', '🎉', '💛']) {
  const box = h('div', { class: 'k-confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 26; i++) box.append(h('span', { style: { left: Math.round(Math.random() * 100) + '%', animationDelay: (Math.random() * 1.2).toFixed(2) + 's', animationDuration: (2.2 + Math.random() * 1.8).toFixed(2) + 's', fontSize: (18 + Math.random() * 20).toFixed(0) + 'px' } }, emojis[i % emojis.length]));
  host.append(box); setTimeout(() => box.remove(), 5200);
}
export const MASCOTS = { leo: '/img/kids-leo.svg', bunny: '/img/kids-bunny.svg' };
