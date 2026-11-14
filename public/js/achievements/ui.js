/* Shared pieces of the achievements screens: the stylesheet, formatting of rewards and the item preview. */
import { h, icon } from '../ui.js';
import { t, n } from '../i18n.js';
import { medal, tilt, RARITY_STYLE } from './medal.js';

let cssP = null;
export function loadAchievementsCss() {
  if (cssP) return cssP;
  cssP = new Promise((resolve) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/achievements.css'; l.dataset.ach = '1'; l.onload = l.onerror = () => resolve(); document.head.append(l); });
  return cssP;
}
export { medal, tilt, RARITY_STYLE };
export const rarityName = (r) => t('ach.rarity.' + r);
export const rarityPill = (r) => h('span', { class: 'ach-pill r-' + r }, rarityName(r));
export const iconOf = (name) => icon(name);

/* the drawing of an exclusive avatar item (the avatar renderer is loaded the first time it is needed) */
let renderer = null, previewN = 0;
/* the renderer names its gradients by position only (and may repeat one inside a drawing): every preview gets its own ids, each used once */
const uniqueIds = (svg) => { const k = '-p' + (++previewN), seen = new Set(); return svg.replace(/\bid="([^"]+)"/g, (m, id) => (seen.has(id) ? '' : (seen.add(id), `id="${id}${k}"`))).replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${id}${k})`).replace(/(href|xlink:href)="#([^"]+)"/g, (m, a, id) => `${a}="#${id}${k}"`); };
const loadRenderer = () => (renderer || (renderer = import('../avatar/render.js').catch(() => null)));
export function itemPreview(item, size = 22) {
  const box = h('span', { class: 'ach-itemsvg', style: { width: size + 'px', height: size + 'px' }, 'aria-hidden': 'true' });
  loadRenderer().then((R) => { if (R && R.itemSvg && box.isConnected !== false) { try { box.innerHTML = uniqueIds(R.itemSvg({ ...item, image: item.image || '' }, { size })); } catch (_) { /* keep it empty */ } } });
  return box;
}
/* the rewards of an achievement as small chips */
export function rewardChips(a, { earned = false } = {}) {
  const xp = earned ? a.earnedXp !== undefined ? a.earnedXp : a.xp : a.xp, tok = earned ? a.earnedTokens !== undefined ? a.earnedTokens : a.tokens : a.tokens;
  const chips = [];
  if (xp > 0) chips.push(h('span', { class: 'ach-reward xp', 'data-reward': 'xp' }, icon('bolt'), t('ach.reward_xp', { n: xp })));
  if (tok > 0) chips.push(h('span', { class: 'ach-reward tok', 'data-reward': 'tokens' }, icon('coin'), t('ach.reward_tokens', { n: tok })));
  if (a.item) chips.push(h('span', { class: 'ach-reward item', 'data-reward': 'item', title: a.item.name }, itemPreview(a.item), t('ach.reward_item', { name: a.item.name })));
  if (a.badge) chips.push(h('span', { class: 'ach-reward', 'data-reward': 'badge' }, icon('shield'), t('ach.reward_badge')));
  return chips;
}
export { n };
