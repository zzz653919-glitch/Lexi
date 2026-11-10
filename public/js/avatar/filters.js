/* Collection / sub-collection filters and search of the fashion shop (used by the shop and the fitting room). */
import { h } from '../ui.js';
import { t } from '../i18n.js';
import { A } from './ui.js';

const label = (prefix, k) => { const v = t(prefix + k); return v === prefix + k ? k.replace(/-/g, ' ') : v; };

export function fashionFilter(onChange) {
  const st = { coll: '', sub: '', q: '' };
  const colls = h('div', { class: 'av-chips av-colls', role: 'group', 'aria-label': t('av.collections') }), subs = h('div', { class: 'av-chips av-subs', role: 'group', 'aria-label': t('av.subcollections') });
  let timer = 0;
  const search = h('input', { type: 'search', class: 'av-search', id: 'av-search', placeholder: t('av.search_items'), 'aria-label': t('av.search_items'), oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.trim().toLowerCase(); onChange(); }, 200); } });
  const el = h('div', { class: 'av-fashion-filter' }, search, colls, subs);
  const chip = (text, on, data, fn) => h('button', { type: 'button', class: 'av-chip' + (on ? ' on' : ''), ...data, onclick: fn }, text);
  return {
    el, st,
    reset() { st.coll = ''; st.sub = ''; st.q = ''; search.value = ''; },
    /* draws the chips for the items of the open tab; the collections only appear where items have them */
    refresh(inCat) {
      const count = new Map(); for (const i of inCat) if (i.collection) count.set(i.collection, (count.get(i.collection) || 0) + 1);
      el.hidden = count.size === 0; if (!count.size) return;
      const order = Object.keys((A.boot && A.boot.spec && A.boot.spec.collections) || {}), rank = (k) => (order.includes(k) ? order.indexOf(k) : 99);
      colls.replaceChildren(chip(t('av.all_collections'), !st.coll, { 'data-coll': '' }, () => { st.coll = ''; st.sub = ''; onChange(); }),
        ...[...count].sort((a, b) => rank(a[0]) - rank(b[0])).map(([k, n]) => chip(`${label('av.collection.', k)} · ${n}`, st.coll === k, { 'data-coll': k }, () => { st.coll = st.coll === k ? '' : k; st.sub = ''; onChange(); })));
      const sc = new Map(); if (st.coll) for (const i of inCat) if (i.collection === st.coll && i.sub) sc.set(i.sub, (sc.get(i.sub) || 0) + 1);
      subs.hidden = !st.coll; subs.replaceChildren(...(st.coll ? [chip(t('av.all'), !st.sub, { 'data-sub': '' }, () => { st.sub = ''; onChange(); }), ...[...sc].map(([k, n]) => chip(`${label('av.sub.', k)} · ${n}`, st.sub === k, { 'data-sub': k }, () => { st.sub = st.sub === k ? '' : k; onChange(); }))] : []));
    },
    apply(list) { return list.filter((i) => (!st.coll || i.collection === st.coll) && (!st.sub || i.sub === st.sub) && (!st.q || i.name.toLowerCase().includes(st.q) || (i.sub || '').includes(st.q))); },
  };
}
export const PAGE = 48;
export const moreButton = (shown, total, onMore) => (total > shown ? h('button', { type: 'button', class: 'av-btn av-more-btn', id: 'av-more', onclick: onMore }, t('av.show_more', { n: total - shown })) : null);
