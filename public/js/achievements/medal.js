/* Achievement medals: a metallic emblem drawn in SVG as three stacked layers (rim, face, symbol) that sit at different depths, so the medal tilts in 3D
   when the pointer moves over it. The shape and the metal follow the rarity: common (disc, silver), rare (hexagon, blue), epic (octagon, violet),
   legendary (twelve-point seal, gold), mythic (sixteen-point star, magenta with a moving shimmer). */
import { h } from '../ui.js';

export const RARITY_STYLE = {
  common: { a: '#e4e9f2', b: '#8c98b3', c: '#4b5573', glow: '#9fb0d0', gem: '#ffffff', sides: 0 },
  rare: { a: '#9fd0ff', b: '#3a86ff', c: '#16398f', glow: '#4d9bff', gem: '#cfe6ff', sides: 6 },
  epic: { a: '#e0c2ff', b: '#9b5de5', c: '#41197a', glow: '#b57cff', gem: '#f1deff', sides: 8 },
  legendary: { a: '#fff0a6', b: '#f2b705', c: '#8a5a00', glow: '#ffc933', gem: '#fff7cc', sides: 12 },
  mythic: { a: '#ffc2e4', b: '#e0245e', c: '#5d0c46', glow: '#ff4d94', gem: '#ffe3f1', sides: 16 },
};
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

/* the outline: a disc for sides = 0, otherwise a regular polygon (a star when `spike` pulls every other corner inwards) */
function outline(cx, cy, r, sides, spike = 1) {
  if (!sides) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  const pts = [];
  for (let i = 0; i < sides; i++) { const k = i % 2 && spike < 1 ? spike : 1, a = (Math.PI * 2 * i) / sides - Math.PI / 2; pts.push(`${(cx + r * k * Math.cos(a)).toFixed(1)} ${(cy + r * k * Math.sin(a)).toFixed(1)}`); }
  return 'M' + pts.join('L') + 'z';
}
/* the symbol is one of the app's icons (the same paths as everywhere else); the paths are read from the icon element */
function glyph(name, icon) {
  const el = icon(name), p = el.querySelector('path');
  return { d: p ? p.getAttribute('d') : '', filled: el.getAttribute('fill') === 'currentColor' };
}

export function medal(a, icon, { size = 96, locked = false } = {}) {
  const s = RARITY_STYLE[a.rarity] || RARITY_STYLE.common, id = 'm' + (++uid), g = glyph(a.icon || 'star', icon);
  const spike = a.rarity === 'mythic' ? .86 : a.rarity === 'legendary' ? .9 : 1, sides = s.sides, shape = (r) => outline(60, 60, r, sides, spike);
  const gems = a.rarity === 'common' ? '' : [0, 1, 2, 3].map((i) => { const ang = (Math.PI / 2) * i - Math.PI / 4 + (a.rarity === 'rare' ? 0 : 0); return `<circle cx="${(60 + 40 * Math.cos(ang)).toFixed(1)}" cy="${(60 + 40 * Math.sin(ang)).toFixed(1)}" r="2.6" fill="${s.gem}" opacity=".9"/>`; }).join('');
  const defs = `<defs>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.a}"/><stop offset=".5" stop-color="${s.b}"/><stop offset="1" stop-color="${s.c}"/></linearGradient>
    <radialGradient id="${id}f" cx=".32" cy=".26" r=".95"><stop offset="0" stop-color="${s.a}"/><stop offset=".55" stop-color="${s.b}"/><stop offset="1" stop-color="${s.c}"/></radialGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="${id}d" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".45"/></filter></defs>`;
  const base = `<svg viewBox="0 0 120 120" aria-hidden="true">${defs}<g filter="url(#${id}d)"><path d="${shape(54)}" fill="url(#${id}r)"/><path d="${shape(54)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/></g>
    <path d="${shape(47)}" fill="${s.c}" opacity=".55"/></svg>`;
  const face = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="${shape(44)}" fill="url(#${id}f)" stroke="rgba(255,255,255,.65)" stroke-width="1.2"/>
    <path d="${shape(36)}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1" stroke-dasharray="2 3"/>${gems}</svg>`;
  const top = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <svg x="33" y="32" width="54" height="54" viewBox="0 0 24 24" style="width:54px;height:54px" fill="${g.filled ? '#fff' : 'none'}" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))"><path d="${g.d}"/></svg>
    <path d="M22 44a40 40 0 0 1 56-20" fill="none" stroke="url(#${id}s)" stroke-width="5" stroke-linecap="round" opacity=".75"/></svg>`;
  const layer = (cls, svg) => { const l = document.createElement('span'); l.className = 'ach-layer ' + cls; l.innerHTML = svg; return l; };
  const inner = h('span', { class: 'ach-medal-in' }, layer('base', base), layer('face', face), layer('top', top));
  const root = h('span', { class: `ach-medal r-${a.rarity}${locked ? ' is-locked' : ''}`, style: { '--s': size + 'px', '--glow': s.glow }, 'data-rarity': a.rarity, 'data-code': a.code || '' }, inner);
  if (locked) { const lock = icon('lock'); lock.setAttribute('class', 'ach-lock'); root.append(lock); }
  return root;
}

/* tilt a medal towards the pointer while it is over `area` (the whole card); the 3D follows the finger on a touch screen as well */
export function tilt(area, root) {
  const inner = root.querySelector('.ach-medal-in');
  if (!inner) return;
  const move = (e) => { const r = root.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / Math.max(1, area.clientWidth / 2), y = (e.clientY - (r.top + r.height / 2)) / Math.max(1, area.clientHeight / 2);
    inner.style.setProperty('--ry', Math.max(-1, Math.min(1, x)) * 24 + 'deg'); inner.style.setProperty('--rx', Math.max(-1, Math.min(1, y)) * -20 + 'deg'); };
  const reset = () => { inner.style.setProperty('--rx', '0deg'); inner.style.setProperty('--ry', '0deg'); };
  area.addEventListener('pointermove', move); area.addEventListener('pointerleave', reset); area.addEventListener('pointercancel', reset);
}
