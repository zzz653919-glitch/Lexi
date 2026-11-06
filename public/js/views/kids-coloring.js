/* LEXIO KIDS colouring: pick a picture, pick a colour (its English name is spoken), tap the parts. Saved automatically. */
import { h, toast } from '../ui.js';
import { get, put, api } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile, sayText, celebrate, leaveKids, flushListens } from '../kids/common.js';
import { kidsPage, kidsView } from '../kids/shell.js';
import { PICTURES, PALETTE, svgOf } from '../kids/coloring-data.js';

export async function coloringList() {
  await initKids();
  const [d, o] = await Promise.all([get('/kids/art'), get('/kids/overview')]);
  const page = kidsPage('games', h('h1', { class: 'k-h2' }, t('kids.coloring_title')), h('p', { class: 'k-lead' }, t('kids.coloring_intro')),
    h('div', { class: 'k-art-grid' }, d.pictures.map((p) => h('a', { class: 'k-art-card' + (p.colored ? ' started' : ''), href: '/kids/coloring/' + p.code, 'data-picture': p.code, 'aria-label': PICTURES[p.code].en },
      h('span', { class: 'k-art-emoji', 'aria-hidden': 'true' }, PICTURES[p.code].emoji), h('b', { lang: 'en' }, PICTURES[p.code].en), h('small', {}, p.colored ? t('kids.art_colored', { n: p.colored }) : t('kids.art_new'))))));
  page.setStars(o.stars);
  return kidsView(page.el, t('kids.coloring_title'));
}

export default async function kidsColoring({ params }) {
  if (!params || !params.picture) return coloringList();
  await initKids();
  const code = params.picture;
  if (!PICTURES[code]) return coloringList();
  const saved = (await get('/kids/art/' + code)).fills || {};
  const fills = { ...saved }; let color = PALETTE[0], timer = 0;
  const canvas = h('div', { class: 'k-canvas', id: 'k-canvas' });
  canvas.innerHTML = svgOf(code, fills);
  const status = h('p', { class: 'k-note', id: 'k-art-status', role: 'status' });
  const save = () => { clearTimeout(timer); timer = setTimeout(async () => { try { const r = await put('/kids/art/' + code, { fills }); status.textContent = '💾 ' + t('kids.art_saved'); flushListens(); if (r.newRewards && r.newRewards.length) celebrate(r.newRewards, page.el); } catch (e) { toast(e.message, 'error', 4000); } }, 500); };
  const paint = (el) => {
    const i = el.dataset.r; el.setAttribute('fill', color[1]);
    if (color[1] === '#ffffff') delete fills[i]; else fills[i] = color[1];
    el.classList.remove('k-pop'); void el.getBoundingClientRect(); el.classList.add('k-pop'); save();
  };
  canvas.addEventListener('click', (e) => { const r = e.target.closest('.k-region'); if (r) paint(r); });
  canvas.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('k-region')) { e.preventDefault(); paint(e.target); } });
  const swatches = h('div', { class: 'k-palette', role: 'radiogroup', 'aria-label': t('kids.palette') }, PALETTE.map((c, n) => h('button', { type: 'button', class: 'k-swatch' + (n === 0 ? ' on' : ''), role: 'radio', 'aria-checked': String(n === 0), 'data-color': c[1], 'aria-label': c[0], style: { background: c[1] }, onclick: (e) => {
    color = c; swatches.querySelectorAll('.k-swatch').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-checked', 'true'); sayText(c[0], true);   // the colour's English name
  } })));
  const nameBtn = h('button', { class: 'k-big-btn say small', type: 'button', id: 'k-art-name', onclick: () => sayText(PICTURES[code].en, true) }, '🔊 ', h('span', { lang: 'en' }, PICTURES[code].en));
  const clear = h('button', { class: 'k-big-btn me small', type: 'button', id: 'k-art-clear', onclick: () => { Object.keys(fills).forEach((k) => delete fills[k]); canvas.querySelectorAll('.k-region').forEach((r) => r.setAttribute('fill', '#ffffff')); save(); } }, '🧽 ', t('kids.art_clear'));
  const page = kidsPage('games', h('div', { class: 'k-art-head' }, h('a', { class: 'k-back', href: '/kids/coloring', 'aria-label': t('kids.coloring_title') }, '🖍️'), h('h1', { class: 'k-h2', lang: 'en' }, PICTURES[code].emoji + ' ' + PICTURES[code].en), nameBtn),
    h('p', { class: 'k-lead' }, t('kids.art_hint')), canvas, swatches, h('div', { class: 'k-actions' }, clear), status);
  setTimeout(() => sayText(PICTURES[code].en, true), 300);
  return kidsView(page.el, PICTURES[code].en, { cleanup: () => { clearTimeout(timer); leaveKids(); } });
}
