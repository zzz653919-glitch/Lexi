/* DOM helpers. Text is always inserted with textContent, never as HTML, so user-supplied content cannot inject markup. */
import { t } from './i18n.js';
export { fmt } from './i18n.js';
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  path: 'M6 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.5 17.5c7 0 1-9 7-9',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  cards: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3 0-6 1-9z',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6z',
  check: 'M5 12.5l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  play: 'M8 5l11 7-11 7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  volume: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  slow: 'M4 9h4l5-4v14l-5-4H4zM16 10l4 4M20 10l-4 4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  wave: 'M2 12c3-5 5 5 8 0s5 5 8 0 3 2 4 0M2 17c3-5 5 5 8 0s5 5 8 0 3 2 4 0',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 7z',
  sprout: 'M12 21V11M12 12C12 7 8 5 4 5c0 5 3 8 8 7zM12 10c0-4 3-6 8-6 0 5-3 7-8 6z',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 0 0-14-4L4 9M4 5v4h4M4 13a8 8 0 0 0 14 4l2-2M20 19v-4h-4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-3-2 1a7 7 0 0 0-2-1l-.5-2h-4L10 8a7 7 0 0 0-2 1L6 8 4 11l2 1v2l-2 1 2 3 2-1a7 7 0 0 0 2 1l.5 2h4l.5-2a7 7 0 0 0 2-1l2 1 2-3-2-1z',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a7 7 0 0 1 4 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
};
const FILLED = new Set(['heart', 'bolt', 'play', 'star', 'flame']);
export function icon(name, cls) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', FILLED.has(name) ? 'currentColor' : 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  if (cls) svg.setAttribute('class', cls);
  const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.star); svg.append(p);
  return svg;
}

const AVATAR_COLORS = { sprout: '#1f9d6b', sun: '#f5a524', moon: '#6c5ce7', wave: '#2f7de1', leaf: '#3aa35c', star: '#e8590c', bolt: '#d6336c', cloud: '#5c7cfa' };
export function avatar(name, size = 44) {
  const a = h('span', { class: 'avatar', 'aria-hidden': 'true', style: { width: size + 'px', height: size + 'px', background: AVATAR_COLORS[name] || AVATAR_COLORS.sprout } });
  a.append(icon(AVATAR_COLORS[name] ? name : 'sprout'));
  return a;
}

/* ---------- toasts & dialogs ---------- */
let toastBox;
export function toast(message, kind = 'info', ms = 3500) {
  if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastBox); }
  const t = h('div', { class: 'toast ' + kind }, message);
  toastBox.append(t);
  setTimeout(() => t.remove(), ms);
}
/* modal(options) -> Promise<value>. content: Node; actions: [{label, value, kind}] */
export function modal({ title, content, actions, dismissValue = null }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { 'aria-labelledby': 'dlg-title' });
    const body = h('div', { class: 'dialog-body' }, title ? h('h2', { id: 'dlg-title' }, title) : null, content);
    const bar = h('div', { class: 'dialog-actions' });
    (actions || [{ label: t('common.ok'), value: true }]).forEach((a) => bar.append(h('button', { type: 'button', class: 'btn ' + (a.kind || ''), onclick: () => { dlg.close(); resolve(a.value); } }, a.label)));
    body.append(bar); dlg.append(body);
    dlg.addEventListener('close', () => { dlg.remove(); resolve(dismissValue); });
    document.body.append(dlg); dlg.showModal();
    const first = dlg.querySelector('[autofocus], input, select, textarea') || bar.lastChild; if (first) first.focus();
  });
}
export const confirmDialog = (title, message, label, danger = false) =>
  modal({ title, content: h('p', {}, message), actions: [{ label: t('common.cancel'), value: false, kind: 'secondary' }, { label: label || t('common.confirm'), value: true, kind: danger ? 'danger' : '' }], dismissValue: false });

/* ---------- speech (browser text-to-speech; uploaded audio is preferred when an exercise has it) ---------- */
export const canSpeak = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
let current = null;
export function speak(audio, slow = false) {
  if (current) { try { current.pause(); } catch (_) { /* ignore */ } current = null; }
  if (audio && audio.url) { const a = new Audio(audio.url); current = a; a.playbackRate = slow ? 0.75 : 1; a.play().catch(() => toast(t('err.audio_play'), 'error')); return; }
  const text = audio && (audio.text || audio);
  if (!text || !canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text)); u.lang = 'en-US'; u.rate = slow ? 0.6 : 0.95;
  window.speechSynthesis.speak(u);
}

export const spinner = () => h('div', { class: 'spinner', role: 'status', 'aria-label': t('app.loading') });
