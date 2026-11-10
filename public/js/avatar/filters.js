/* Collection / sub-collection filters and search of the fashion shop (used by the shop and the fitting room). */
import { h } from '../ui.js';
import { t } from '../i18n.js';
import { A } from './ui.js';
import { enabled as motionOn } from '../motion.js';

const label = (prefix, k) => { const v = t(prefix + k); return v === prefix + k ? k.replace(/-/g, ' ') : v; };

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export function fashionFilter(onChange) {
  const st = { coll: '', sub: '', q: '', sort: 'featured' };
  const colls = h('div', { class: 'av-chips av-colls', id: 'av-colls', role: 'group', 'aria-label': t('av.collections') }), subs = h('div', { class: 'av-chips av-subs', role: 'group', 'aria-label': t('av.subcollections') });
  let timer = 0;
  const search = h('input', { type: 'search', class: 'av-search', id: 'av-search', placeholder: t('av.search_items'), 'aria-label': t('av.search_items'), oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.trim().toLowerCase(); onChange(); }, 200); } });
  const sort = h('select', { class: 'av-select av-sort', id: 'av-sort', 'aria-label': t('av.sort'), onchange: (e) => { st.sort = e.target.value; onChange(); } }, ...['featured', 'price_asc', 'price_desc', 'rarity_desc', 'rarity_asc', 'name'].map((k) => h('option', { value: k }, t('av.sort.' + k))));
  const note = h('p', { class: 'av-games-note', id: 'av-games-note', hidden: true }, t('av.games_note'));
  let open = false, last = [];
  const toggle = h('button', { type: 'button', class: 'av-cats-toggle', id: 'av-cats-toggle', 'aria-expanded': 'false', 'aria-controls': 'av-colls', onclick: () => { open = !open; paintToggle(); paintColls(); } });
  const paintToggle = () => { toggle.setAttribute('aria-expanded', String(open)); toggle.classList.toggle('on', open); toggle.replaceChildren(h('span', { 'aria-hidden': 'true' }, open ? '▴ ' : '▾ '), t('av.categories')); };
  paintToggle();
  const el = h('div', { class: 'av-fashion-filter' }, h('div', { class: 'av-search-row' }, search, sort), note, h('div', { class: 'av-cats-bar' }, toggle), colls, subs);
  const chip = (text, on, data, fn) => h('button', { type: 'button', class: 'av-chip' + (on ? ' on' : ''), ...data, onclick: fn }, text);
  /* all categories at once when opened; otherwise they scroll round by themselves (paused while pointed at; a plain row when motion is off) */
  function paintColls() {
    colls.classList.remove('open', 'marquee');
    if (!last.length) { colls.replaceChildren(); return; }
    const real = last.map((d) => chip(d.text, d.on, d.data, d.fn));
    if (open) { colls.classList.add('open'); colls.replaceChildren(...real); return; }
    if (!motionOn()) { colls.replaceChildren(...real); return; }
    const clones = last.map((d) => { const c = chip(d.text, d.on, { 'aria-hidden': 'true', tabindex: '-1', 'data-clone': '1' }, d.fn); return c; });
    colls.classList.add('marquee'); colls.style.setProperty('--dur', Math.max(24, last.length * 3.4) + 's');
    colls.replaceChildren(h('div', { class: 'av-marquee-track' }, ...real, ...clones));
  }
  return {
    el, st,
    reset() { st.coll = ''; st.sub = ''; st.q = ''; search.value = ''; },
    showNote(on) { note.hidden = !on; },
    /* draws the chips for the items of the open tab; the collections only appear where items have them */
    refresh(inCat) {
      const count = new Map(); for (const i of inCat) if (i.collection) count.set(i.collection, (count.get(i.collection) || 0) + 1);
      el.hidden = false;
      if (!count.size) { colls.replaceChildren(); subs.replaceChildren(); subs.hidden = true; return; }
      const sp = (A.boot && A.boot.spec) || {}, order = Object.keys({ ...(sp.collections || {}), ...(sp.games || {}) }), rank = (k) => (order.includes(k) ? order.indexOf(k) : 99);
      last = [{ text: t('av.all_collections'), on: !st.coll, data: { 'data-coll': '' }, fn: () => { st.coll = ''; st.sub = ''; onChange(); } },
        ...[...count].sort((x, y) => rank(x[0]) - rank(y[0])).map(([k, n]) => ({ text: `${label('av.collection.', k)} · ${n}`, on: st.coll === k, data: { 'data-coll': k }, fn: () => { st.coll = st.coll === k ? '' : k; st.sub = ''; onChange(); } }))];
      paintColls();
      const sc = new Map(); if (st.coll) for (const i of inCat) if (i.collection === st.coll && i.sub) sc.set(i.sub, (sc.get(i.sub) || 0) + 1);
      subs.hidden = !st.coll; subs.replaceChildren(...(st.coll ? [chip(t('av.all'), !st.sub, { 'data-sub': '' }, () => { st.sub = ''; onChange(); }), ...[...sc].map(([k, n]) => chip(`${label('av.sub.', k)} · ${n}`, st.sub === k, { 'data-sub': k }, () => { st.sub = st.sub === k ? '' : k; onChange(); }))] : []));
    },
    apply(list) {
      const idx = new Map(list.map((i, k) => [i.slug, k])), rk = (i) => RARITY_ORDER.indexOf(i.rarity);
      const cmp = { featured: (a, b) => idx.get(a.slug) - idx.get(b.slug), price_asc: (a, b) => a.price - b.price || rk(a) - rk(b), price_desc: (a, b) => b.price - a.price || rk(b) - rk(a), rarity_desc: (a, b) => rk(b) - rk(a) || b.price - a.price, rarity_asc: (a, b) => rk(a) - rk(b) || a.price - b.price, name: (a, b) => a.name.localeCompare(b.name) }[st.sort];
      return list.filter((i) => (!st.coll || i.collection === st.coll) && (!st.sub || i.sub === st.sub) && (!st.q || i.name.toLowerCase().includes(st.q) || (i.sub || '').includes(st.q))).sort(cmp);
    },
  };
}
export const PAGE = 48;
export const moreButton = (shown, total, onMore) => (total > shown ? h('button', { type: 'button', class: 'av-btn av-more-btn', id: 'av-more', onclick: onMore }, t('av.show_more', { n: total - shown })) : null);
