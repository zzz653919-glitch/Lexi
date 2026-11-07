/* The fitting room of the Avatar Shop. Everything here is a PREVIEW kept in memory: trying on is free, never touches the wallet
   and never saves anything. Only "Buy" (after a confirmation) spends tokens, and only "Equip" / "Save this look" change the saved character,
   and the server accepts nothing the learner does not own. Leaving the room throws the preview away. */
import { h, toast, confirmDialog } from '../ui.js';
import { post, put } from '../api.js';
import { t } from '../i18n.js';
import { renderAvatar, itemSvg, fitsStyle } from './render.js';
import { A, equippedItems, rarityBadge, tokenAmount, setBalance, coinSvg } from './ui.js';

const CATS = [['clothing', '👕'], ['accessory', '🕶️'], ['pet', '🐾'], ['special', '✨']];
/* a dress or a costume replaces the top and the trousers, and the other way round */
const CLEARS = { dress: ['top', 'bottom', 'outfit'], outfit: ['top', 'bottom', 'dress'], top: ['dress', 'outfit'], bottom: ['dress', 'outfit'] };
let current = null;
export const closeFitting = () => { if (current) current.close(); };

export function openFitting({ item = null, buy, refresh = () => {} }) {
  closeFitting();
  const boot = A.boot, avatars = () => boot.avatars;
  const fallback = { id: null, name: t('av.you'), style: 'cartoon', look: {}, equipped: {}, petPose: 'sit' };
  let av = avatars().find((a) => a.id === boot.activeId) || avatars()[0] || null;
  const me = () => av || fallback;
  let saved = equippedItems(me().equipped), trial = { ...saved }, sel = null, cat = 'clothing', kind = '', angle = 0, spinning = null, pose = me().petPose || 'sit';
  const fits = (it) => fitsStyle(me().style, it);
  const sameSet = (a, b) => { const k = new Set([...Object.keys(a), ...Object.keys(b)]); for (const s of k) if ((a[s] && a[s].slug) !== (b[s] && b[s].slug)) return false; return true; };
  const unowned = () => Object.values(trial).filter((it) => !it.owned && !it.starter);
  const itemsOf = () => boot.items.filter((i) => i.category === cat && (!kind || i.kind === kind));

  /* ---- the stage: a front and a back picture on a turning card ---- */
  const front = h('div', { class: 'av-fit-face front' }), backF = h('div', { class: 'av-fit-face back' });
  const turn = h('div', { class: 'av-fit-turn', id: 'av-fit-turn' }, front, backF);
  const stage = h('div', { class: 'av-fit-stage', id: 'av-fit-stage', tabindex: 0, 'aria-label': t('av.fit.drag') }, h('div', { class: 'av-fit-scene' }, turn), h('div', { class: 'av-fit-floor', 'aria-hidden': 'true' }));
  /* a flat picture is edge-on at 90° and 270°, so the turns stop at the front, the three-quarter views and the back */
  const VIEWS = [0, 45, 135, 180, 225, 315], all = (c) => [-1, 0, 1, 2].flatMap((k) => VIEWS.map((v) => Math.floor(c / 360) * 360 + k * 360 + v)).sort((a, b) => a - b);
  const snap = (a) => all(a).reduce((best, v) => (Math.abs(v - a) < Math.abs(best - a) ? v : best), all(a)[0]);
  const step = (dir) => { const s0 = snap(angle), list = all(angle); setAngle(dir > 0 ? list.find((v) => v > s0) : [...list].reverse().find((v) => v < s0)); };
  const setAngle = (a, instant) => { angle = a; turn.classList.toggle('drag', !!instant); turn.style.setProperty('--a', angle + 'deg'); const f = ((angle % 360) + 360) % 360; stage.dataset.view = f > 90 && f < 270 ? 'back' : 'front'; };
  function paint() {
    const base = { style: me().style, look: me().look, equipped: trial, size: 360, petPose: pose, label: me().name, plain: !trial.background };
    front.innerHTML = renderAvatar(base); backF.innerHTML = renderAvatar({ ...base, view: 'back' });
    stage.classList.remove('pop'); void stage.offsetWidth; stage.classList.add('pop');
  }
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, a: angle }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (drag) setAngle(drag.a + (e.clientX - drag.x) * .6, true); });
  const endDrag = () => { if (!drag) return; drag = null; setAngle(snap(angle)); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } });
  const spinBtn = h('button', { type: 'button', class: 'av-fit-rot', id: 'av-fit-spin', 'aria-pressed': 'false', title: t('av.fit.spin'), onclick: () => { if (spinning) stopSpin(); else { spinning = setInterval(() => step(1), 900); spinBtn.classList.add('on'); spinBtn.setAttribute('aria-pressed', 'true'); } } }, '⟳ 360°');
  function stopSpin() { clearInterval(spinning); spinning = null; spinBtn.classList.remove('on'); spinBtn.setAttribute('aria-pressed', 'false'); }
  const rotL = h('button', { type: 'button', class: 'av-fit-rot', id: 'av-fit-left', 'aria-label': t('av.fit.rotate_left'), title: t('av.fit.rotate_left'), onclick: () => { stopSpin(); step(-1); } }, '◀');
  const rotR = h('button', { type: 'button', class: 'av-fit-rot', id: 'av-fit-right', 'aria-label': t('av.fit.rotate_right'), title: t('av.fit.rotate_right'), onclick: () => { stopSpin(); step(1); } }, '▶');
  const poseBar = h('div', { class: 'av-chips center av-fit-pose', role: 'group', 'aria-label': t('av.pose') });

  /* ---- actions ---- */
  function apply(it) {
    if (!fits(it)) { toast(t('av.fit.no_fit'), 'info', 2200); return; }
    for (const s of CLEARS[it.slot] || []) delete trial[s];
    trial[it.slot] = it; sel = it; paint(); update();
  }
  function remove() { if (!sel || !trial[sel.slot]) return; delete trial[sel.slot]; paint(); update(); }
  function reset() { trial = { ...saved }; paint(); update(); }
  function adopt(avatar) { boot.avatars = boot.avatars.map((x) => (x.id === avatar.id ? avatar : x)); av = avatar; saved = equippedItems(avatar.equipped); refresh(); }
  async function equip(it) {
    if (!av) { toast(t('av.fit.no_character'), 'info', 3000); return; }
    if (!it.owned && !it.starter) return;
    try { const r = await put(`/avatar/avatars/${av.id}`, { equipped: { ...av.equipped, [it.slot]: it.slug } }); adopt(r.avatar); toast(t('av.fit.equipped', { name: it.name }), 'success', 2200); update(); } catch (e) { toast(e.message, 'error'); }
  }
  async function saveLook() {
    if (!av) { toast(t('av.fit.no_character'), 'info', 3000); return; }
    const eq = {};
    for (const [slot, it] of Object.entries(trial)) { if (it.owned || it.starter) eq[slot] = it.slug; else if (av.equipped[slot]) eq[slot] = av.equipped[slot]; }
    try { const r = await put(`/avatar/avatars/${av.id}`, { equipped: eq }); adopt(r.avatar); toast(t('av.fit.saved'), 'success', 2200); update(); } catch (e) { toast(e.message, 'error'); }
  }
  async function buyOne(it) { if (await buy(it)) { setBal(); update(); } }
  async function buyAll() {
    const list = unowned().filter((it) => it.forSale), total = list.reduce((a, it) => a + it.price, 0);
    if (!list.length || !(await confirmDialog(t('av.fit.buy_all_title'), t('av.fit.buy_all_text', { n: list.length, price: total }), t('av.buy')))) return;
    try {
      for (const it of list) { const r = await post(`/avatar/shop/${encodeURIComponent(it.slug)}/buy`, {}); boot.items.find((x) => x.slug === it.slug).owned = true; boot.wallet = r.wallet; }
      setBalance(boot.wallet.balance); setBal(); toast(t('av.fit.bought_all', { n: list.length }), 'success', 3000); refresh(); update();
    } catch (e) { toast(e.message, 'error', 5000); setBalance(boot.wallet.balance); setBal(); refresh(); update(); }
  }

  /* ---- the panel ---- */
  const bal = h('span', { class: 'av-fit-bal', id: 'av-fit-balance', title: t('av.balance') });
  const setBal = () => bal.replaceChildren(tokenAmount(boot.wallet.balance));
  const tabs = h('div', { class: 'av-tabs shop fit', role: 'tablist' }), chips = h('div', { class: 'av-chips fit' }), grid = h('div', { class: 'av-fit-grid', id: 'av-fit-grid' });
  const info = h('div', { class: 'av-fit-info', id: 'av-fit-info', 'aria-live': 'polite' }), bar = h('div', { class: 'av-fit-actions', id: 'av-fit-actions' }), note = h('div', { class: 'av-fit-note', id: 'av-fit-note' });
  const btn = (act, label, onclick, disabled, cls = '') => h('button', { type: 'button', class: 'av-btn ' + cls, 'data-act': act, disabled: !!disabled, onclick }, label);

  function tile(it) {
    const on = trial[it.slot] && trial[it.slot].slug === it.slug, ok = fits(it), th = h('span', { class: 'av-fit-thumb' });
    th.innerHTML = itemSvg(it, { look: me().look, style: me().style, size: 64 });
    return h('button', { type: 'button', class: 'av-fit-tile r-' + it.rarity + (on ? ' on' : '') + (sel && sel.slug === it.slug ? ' sel' : '') + (ok ? '' : ' nofit') + (it.owned ? ' owned' : ''), 'data-slug': it.slug, 'aria-pressed': String(!!on), title: ok ? it.name : t('av.fit.no_fit'), onclick: () => apply(it) },
      th, h('b', {}, it.name), h('small', {}, ...(!ok ? [t('av.fit.no_fit')] : it.owned ? ['✔ ' + t('av.owned')] : it.earn && !it.forSale ? [t('av.earn_only')] : [String(it.price), ' ', coinSvg()])), ...(on ? [h('i', { class: 'av-fit-tick', 'aria-label': t('av.fit.in_preview') }, '✓')] : []));
  }
  function update() {
    tabs.querySelectorAll('.av-tab').forEach((b) => { const on = b.dataset.cat === cat; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const inCat = boot.items.filter((i) => i.category === cat), ks = [...new Set(inCat.map((i) => i.kind))];
    chips.replaceChildren(h('button', { type: 'button', class: 'av-chip' + (!kind ? ' on' : ''), onclick: () => { kind = ''; update(); } }, t('av.all')), ...ks.map((k) => h('button', { type: 'button', class: 'av-chip' + (kind === k ? ' on' : ''), 'data-kind': k, onclick: () => { kind = k; update(); } }, t('av.kind.' + k))));
    const list = itemsOf(); grid.replaceChildren(...(list.length ? list.map(tile) : [h('p', { class: 'av-empty' }, t('av.shop_empty'))]));
    /* the selected item */
    if (sel) {
      const owned = sel.owned || sel.starter;
      info.replaceChildren(h('b', {}, sel.name), rarityBadge(sel.rarity), owned ? h('span', { class: 'av-owned' }, '✔ ', t('av.owned')) : sel.forSale ? h('span', { class: 'av-price' }, tokenAmount(sel.price)) : h('small', {}, t('av.earn_only')));
    } else info.replaceChildren(h('small', {}, t('av.fit.pick')));
    const owned = sel && (sel.owned || sel.starter), need = sel && sel.forSale && !owned ? sel.price - boot.wallet.balance : 0, changed = !sameSet(trial, saved);
    bar.replaceChildren(...[
      btn('apply', t('av.fit.apply'), () => sel && apply(sel), !sel || !fits(sel), 'wear'),
      btn('remove', t('av.fit.remove'), remove, !sel || !trial[sel.slot], ''),
      btn('reset', t('av.fit.reset'), reset, !changed, ''),
      sel && !owned ? btn('buy', need > 0 ? t('av.need_more', { n: need }) : t('av.fit.buy'), () => buyOne(sel), !sel.forSale || need > 0, 'go') : null,
      owned ? btn('equip', t('av.fit.equip'), () => equip(sel), !av || !fits(sel) || (av && av.equipped[sel.slot] === sel.slug), 'go') : null,
      btn('save', t('av.fit.save'), saveLook, !av || !changed, 'go')].filter(Boolean));
    const un = unowned(), buyable = un.filter((it) => it.forSale);
    note.replaceChildren(...[h('small', { class: 'av-fit-free' }, '✔ ', t('av.fit.free')),
      un.length ? h('div', { class: 'av-fit-unowned' }, h('span', {}, t('av.fit.not_owned', { n: un.length, price: un.reduce((a, it) => a + (it.forSale ? it.price : 0), 0) })), ...(buyable.length ? [btn('buy-all', t('av.fit.buy_all', { n: buyable.length }), buyAll, false, 'go')] : [])) : null,
      !av ? h('small', {}, t('av.fit.no_character')) : null].filter(Boolean));
    const pet = trial.pet; poseBar.replaceChildren(...(pet ? ['sit', 'play', 'sleep'].map((p) => h('button', { type: 'button', class: 'av-chip' + (p === pose ? ' on' : ''), 'data-pose': p, onclick: () => { pose = p; paint(); update(); } }, t('av.pose.' + p))) : []));
    poseBar.hidden = !pet;
  }
  tabs.append(...CATS.map(([k, e]) => h('button', { type: 'button', class: 'av-tab', role: 'tab', 'data-cat': k, 'aria-selected': 'false', onclick: () => { cat = k; kind = ''; update(); } }, h('span', { 'aria-hidden': 'true' }, e), h('b', {}, t('av.cat.' + k)))));

  /* the character to dress (a learner can have several) */
  const who = avatars().length > 1 ? h('select', { class: 'av-select', id: 'av-fit-who', 'aria-label': t('av.fit.character'), onchange: (e) => {
    const old = saved, tried = Object.fromEntries(Object.entries(trial).filter(([s, it]) => !old[s] || old[s].slug !== it.slug));
    av = avatars().find((a) => String(a.id) === e.target.value) || av; saved = equippedItems(me().equipped); pose = me().petPose || 'sit';
    trial = { ...saved }; for (const it of Object.values(tried)) if (fits(it)) { for (const s of CLEARS[it.slot] || []) delete trial[s]; trial[it.slot] = it; } paint(); update();
  } }, ...avatars().map((a) => h('option', { value: a.id, selected: av && a.id === av.id }, a.name))) : null;

  const closeBtn = h('button', { type: 'button', class: 'av-btn av-fit-close', id: 'av-try-close', title: t('av.fit.close'), 'aria-label': t('av.fit.close'), onclick: () => close() }, '✕');
  const root = h('div', { class: 'av-modal av-fit', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'av-fit-h' },
    h('div', { class: 'av-fit-room' },
      h('header', { class: 'av-fit-head' }, ...[h('h2', { id: 'av-fit-h' }, '👗 ', t('av.fit.title')), who, bal, closeBtn].filter(Boolean)),
      h('div', { class: 'av-fit-body' },
        h('section', { class: 'av-fit-left' }, stage, h('div', { class: 'av-fit-rots' }, rotL, spinBtn, rotR), poseBar),
        h('section', { class: 'av-fit-right' }, tabs, chips, grid, info, bar, note))));
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  function close() { stopSpin(); document.removeEventListener('keydown', onKey); root.remove(); if (current && current.root === root) current = null; document.body.classList.remove('av-noscroll'); }
  current = { root, close };
  setBal(); setAngle(0); if (item) { cat = item.category; sel = item; if (fits(item)) { for (const s of CLEARS[item.slot] || []) delete trial[s]; trial[item.slot] = item; } }
  paint(); update();
  document.addEventListener('keydown', onKey); document.body.classList.add('av-noscroll'); document.body.append(root); closeBtn.focus();
  return current;
}
