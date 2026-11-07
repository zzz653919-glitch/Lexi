/* Avatar Studio: shared state and small widgets (stylesheet, the data of the signed-in learner, token chip, reward animation). */
import { h, toast } from '../ui.js';
import { get, post } from '../api.js';
import { t } from '../i18n.js';
import { renderAvatar } from './render.js';

let cssLoaded = false;
export function loadAvatarCss() {
  if (cssLoaded || document.querySelector('link[data-avatar]')) { cssLoaded = true; return Promise.resolve(); }
  cssLoaded = true;
  return new Promise((resolve) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/avatar.css'; l.dataset.avatar = '1'; l.onload = l.onerror = () => resolve(); document.head.append(l); });
}

/* everything the pages need (items, characters, wallet): loaded once per visit to the section and kept up to date after changes */
export const A = { boot: null };
export async function loadBoot(force = false) { await loadAvatarCss(); if (force || !A.boot) A.boot = await get('/avatar/bootstrap'); return A.boot; }
export const itemBySlug = (slug) => (A.boot ? A.boot.items.find((i) => i.slug === slug) : null);
/* the equipped slugs of a character as { slot: item } for the renderer */
export const equippedItems = (equipped) => { const out = {}; for (const [slot, slug] of Object.entries(equipped || {})) { const it = itemBySlug(slug); if (it) out[slot] = it; } return out; };
export const activeAvatar = () => (A.boot ? A.boot.avatars.find((a) => a.id === A.boot.activeId) || A.boot.avatars[0] || null : null);
/* a character as an element */
export function avatarEl(a, { size = 200, viewBox, plain = false, extra } = {}) {
  const el = h('span', { class: 'av-wrap' });
  el.innerHTML = renderAvatar({ style: a.style, look: a.look, equipped: { ...equippedItems(a.equipped), ...(extra || {}) }, size, viewBox, plain, petPose: a.petPose || 'sit', label: a.name });
  return el;
}
export const RARITY_COLORS = { common: '#9aa3b2', uncommon: '#2fb36d', rare: '#2f7bff', epic: '#a855f7', legendary: '#f2b705' };
export const rarityBadge = (r) => h('span', { class: 'av-rarity r-' + r, 'data-rarity': r }, t('av.rarity.' + r));
export const coinSvg = () => { const s = document.createElement('span'); s.className = 'av-coin'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em"><circle cx="12" cy="12" r="10" fill="#ffd23f" stroke="#c98d00" stroke-width="2"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#e0a800" stroke-width="1.6"/><path d="M12 8v8M9.6 10.2h3.6a1.6 1.6 0 0 1 0 3.2H10" stroke="#a96d00" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'; return s; };
export const tokenAmount = (n) => h('span', { class: 'av-tokens' }, coinSvg(), h('b', {}, String(n)));

/* the reward animation: coins rain down and a banner says what was earned (shown once; the server remembers it was seen) */
export function tokenBurst(rewards) {
  if (!rewards || !rewards.length) return;
  const total = rewards.reduce((a, r) => a + r.amount, 0);
  const box = h('div', { class: 'av-burst', role: 'status', 'aria-live': 'polite', 'data-total': String(total) },
    h('div', { class: 'av-burst-card' }, h('div', { class: 'av-burst-coin' }, coinSvg()), h('div', { class: 'av-burst-text' }, h('b', {}, `+${total}`), h('span', {}, ' LEXIO TOKENS'), h('ul', {}, rewards.slice(0, 4).map((r) => h('li', {}, `+${r.amount} · ${t('av.reason.' + r.reason)}`))))));
  for (let i = 0; i < 18; i++) { const c = coinSvg(); c.className += ' av-fall-coin'; c.style.left = Math.round(Math.random() * 100) + '%'; c.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's'; c.style.fontSize = (18 + Math.random() * 14).toFixed(0) + 'px'; box.append(c); }
  document.body.append(box);
  setTimeout(() => box.remove(), 3600);
  post('/avatar/wallet/seen', {}).catch(() => {});
}
/* the sub-navigation of the section */
export function avatarNav(active) {
  const items = [['studio', '/avatar', '🎨'], ['inventory', '/avatar/inventory', '🎒'], ['shop', '/avatar/shop', '🛍️'], ['missions', '/avatar/missions', '🎯']];
  return h('nav', { class: 'av-nav', 'aria-label': t('av.nav.label') }, items.map(([k, href, e]) => h('a', { class: 'av-nav-item' + (k === active ? ' on' : ''), href, 'data-av': k, 'aria-current': k === active ? 'page' : null }, h('span', { 'aria-hidden': 'true' }, e), t('av.nav.' + k))),
    h('span', { class: 'av-nav-wallet', id: 'av-balance', title: t('av.balance') }, tokenAmount(A.boot ? A.boot.wallet.balance : 0)));
}
export const setBalance = (n) => { if (A.boot) A.boot.wallet.balance = n; const el = document.getElementById('av-balance'); if (el) el.replaceChildren(tokenAmount(n)); };
