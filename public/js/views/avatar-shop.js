/* Avatar Shop: clothing, accessories, pets and special items bought with LEXIO TOKENS (earned by learning, never with money). Every purchase is checked by the server. */
import { h, toast, confirmDialog } from '../ui.js';
import { post, put } from '../api.js';
import { t } from '../i18n.js';
import { navigate, refreshStats } from '../app.js';
import { renderAvatar, itemSvg } from '../avatar/render.js';
import { A, loadBoot, equippedItems, avatarNav, rarityBadge, tokenAmount, setBalance, coinSvg, activeAvatar } from '../avatar/ui.js';

const CATS = [['clothing', '👕'], ['accessory', '🕶️'], ['pet', '🐾'], ['special', '✨']];
const KIND_LABEL = (k) => t('av.kind.' + k);

export default async function avatarShop() {
  const boot = await loadBoot(true);
  let cat = 'clothing', kind = '', rarity = '', own = 'all';
  const grid = h('div', { class: 'av-shop-grid', id: 'av-shop-grid' }), kinds = h('div', { class: 'av-chips', role: 'group', 'aria-label': t('av.filter_kind') }), tabBar = h('div', { class: 'av-tabs shop', role: 'tablist' });
  const look = () => { const a = activeAvatar(); return a ? { look: a.look, style: a.style } : { look: undefined, style: 'cartoon' }; };

  function priceLine(it) {
    if (it.owned) return h('span', { class: 'av-owned', 'data-owned': '1' }, '✔ ', t(it.starter ? 'av.starter' : it.earn && !it.forSale ? 'av.earned' : 'av.owned'));
    if (it.earn) return h('div', { class: 'av-earn' }, h('small', {}, t('av.earn_' + it.earn.type, { n: it.earn.need })), h('div', { class: 'av-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': it.earn.need, 'aria-valuenow': it.earn.have }, h('i', { style: { width: Math.round(100 * it.earn.have / it.earn.need) + '%' } })), h('small', {}, `${it.earn.have} / ${it.earn.need}`));
    return h('span', { class: 'av-price' }, tokenAmount(it.price));
  }
  function actionBtn(it) {
    if (it.owned) return h('button', { class: 'av-btn wear', type: 'button', 'data-act': 'wear', onclick: (e) => { e.stopPropagation(); wear(it); } }, t('av.wear'));
    if (!it.forSale) return h('button', { class: 'av-btn', type: 'button', disabled: true }, t('av.earn_only'));
    const need = it.price - boot.wallet.balance;
    return h('button', { class: 'av-btn go buy', type: 'button', 'data-act': 'buy', disabled: need > 0, title: need > 0 ? t('av.need_more', { n: need }) : '', onclick: (e) => { e.stopPropagation(); buy(it); } }, need > 0 ? t('av.need_more', { n: need }) : t('av.buy'));
  }
  const card = (it) => { const thumb = h('span', { class: 'av-thumb' }); thumb.innerHTML = itemSvg(it, { ...look(), size: 110 });
    return h('article', { class: 'av-item r-' + it.rarity + (it.owned ? ' owned' : ''), 'data-slug': it.slug, 'data-rarity': it.rarity, tabindex: 0, role: 'button', 'aria-label': it.name, onclick: () => tryOn(it), onkeydown: (e) => { if (e.key === 'Enter') tryOn(it); } },
      thumb, h('h3', {}, it.name), h('div', { class: 'av-item-meta' }, rarityBadge(it.rarity), h('small', {}, KIND_LABEL(it.kind))), priceLine(it), actionBtn(it)); };

  function draw() {
    tabBar.querySelectorAll('.av-tab').forEach((b) => { const on = b.dataset.cat === cat; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const inCat = boot.items.filter((i) => i.category === cat);
    const ks = [...new Set(inCat.map((i) => i.kind))];
    kinds.replaceChildren(h('button', { type: 'button', class: 'av-chip' + (!kind ? ' on' : ''), 'data-kind': '', onclick: () => { kind = ''; draw(); } }, t('av.all')), ...ks.map((k) => h('button', { type: 'button', class: 'av-chip' + (kind === k ? ' on' : ''), 'data-kind': k, onclick: () => { kind = k; draw(); } }, KIND_LABEL(k))));
    const list = inCat.filter((i) => (!kind || i.kind === kind) && (!rarity || i.rarity === rarity) && (own === 'all' || (own === 'owned') === i.owned));
    grid.replaceChildren(...(list.length ? list.map(card) : [h('p', { class: 'av-empty' }, t('av.shop_empty'))]));
  }
  async function buy(it) {
    if (!(await confirmDialog(t('av.buy_title'), t('av.buy_text', { name: it.name, price: it.price }), t('av.buy')))) return;
    try {
      const r = await post(`/avatar/shop/${encodeURIComponent(it.slug)}/buy`, {});
      boot.items.find((x) => x.slug === it.slug).owned = true; boot.wallet = r.wallet; setBalance(r.wallet.balance); syncBalance();
      toast(t('av.bought', { name: it.name }), 'success', 3000); celebrate(it); draw(); refreshStats();
    } catch (e) { toast(e.message, 'error', 5000); await loadBoot(true).then(() => { setBalance(A.boot.wallet.balance); draw(); }); }
  }
  async function wear(it) {
    const a = activeAvatar();
    if (!a) { toast(t('av.create_first'), 'info', 3500); navigate('/avatar'); return; }
    try { const r = await put(`/avatar/avatars/${a.id}`, { equipped: { ...a.equipped, [it.slot]: it.slug } }); boot.avatars = boot.avatars.map((x) => (x.id === r.avatar.id ? r.avatar : x)); toast(t('av.wearing', { name: it.name }), 'success', 2200); closeModal(); } catch (e) { toast(e.message, 'error'); }
  }
  function celebrate(it) { const b = h('div', { class: 'av-buy-pop', role: 'status' }, '🎉 ', it.name); document.body.append(b); setTimeout(() => b.remove(), 2200); }

  const syncBalance = () => { const b = document.getElementById('av-shop-balance'); if (b) b.replaceChildren(tokenAmount(boot.wallet.balance)); };
  let modal = null;
  function closeModal() { if (modal) { modal.remove(); modal = null; document.removeEventListener('keydown', onKey); } }
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  function tryOn(it) {
    closeModal();
    const a = activeAvatar() || { name: t('av.you'), style: 'cartoon', look: {}, equipped: {}, petPose: 'sit' };
    const eq = { ...equippedItems(a.equipped), [it.slot]: it };
    const art = h('span', { class: 'av-wrap' }); art.innerHTML = renderAvatar({ style: a.style, look: a.look, equipped: eq, size: 280, petPose: a.petPose || 'sit', label: it.name });
    modal = h('div', { class: 'av-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'av-try-h', onclick: (e) => { if (e.target === modal) closeModal(); } },
      h('div', { class: 'av-modal-card' }, h('h2', { id: 'av-try-h' }, t('av.try_on')), h('div', { class: 'av-stage-card small' }, art), h('h3', {}, it.name), h('div', { class: 'av-item-meta center' }, rarityBadge(it.rarity), h('small', {}, KIND_LABEL(it.kind))), h('div', { class: 'center' }, priceLine(it)),
        h('div', { class: 'av-actions center' }, actionBtn(it), h('button', { class: 'av-btn', type: 'button', id: 'av-try-close', onclick: closeModal }, t('av.close')))));
    document.addEventListener('keydown', onKey); document.body.append(modal); modal.querySelector('button').focus();
  }

  tabBar.append(...CATS.map(([k, e]) => h('button', { type: 'button', class: 'av-tab', role: 'tab', 'data-cat': k, 'aria-selected': 'false', onclick: () => { cat = k; kind = ''; draw(); } }, h('span', { 'aria-hidden': 'true' }, e), h('b', {}, t('av.cat.' + k)))));
  const rar = h('select', { class: 'av-select', id: 'av-rarity', 'aria-label': t('av.filter_rarity'), onchange: (e) => { rarity = e.target.value; draw(); } }, h('option', { value: '' }, t('av.all_rarities')), ...boot.spec.rarities.map((r) => h('option', { value: r }, t('av.rarity.' + r))));
  const ownSel = h('select', { class: 'av-select', id: 'av-own', 'aria-label': t('av.filter_owned'), onchange: (e) => { own = e.target.value; draw(); } }, h('option', { value: 'all' }, t('av.all')), h('option', { value: 'owned' }, t('av.owned')), h('option', { value: 'free' }, t('av.not_owned')));
  draw();
  const el = h('div', { class: 'av-page av-shop' }, h('div', { class: 'av-head' }, h('h1', {}, t('av.shop_title')), avatarNav('shop')),
    h('p', { class: 'av-lead' }, t('av.shop_lead')), h('div', { class: 'av-balance-card' }, h('span', {}, t('av.your_tokens')), h('b', { id: 'av-shop-balance' }, tokenAmount(boot.wallet.balance)), h('a', { class: 'av-btn', href: '/avatar/missions' }, t('av.earn_more'))),
    tabBar, h('div', { class: 'av-filters' }, kinds, h('span', { class: 'av-filter-sel' }, rar, ownSel)), grid);
  return { el, title: t('av.shop_title'), nav: 'avatar', cleanup: closeModal };
}
