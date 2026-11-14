/* The animated "achievement unlocked" notification. Achievements come from the server only (the answer of a lesson, a review or a daily lesson carries
   `earned`; anything unlocked elsewhere is fetched from /achievements/unseen); the server remembers what has been shown. */
import { h } from '../ui.js';
import { get, post } from '../api.js';
import { t } from '../i18n.js';
import { navigate } from '../app.js';
import { loadAchievementsCss, medal, RARITY_STYLE, rewardChips, rarityName, iconOf } from './ui.js';

const shown = new Set(), queue = [];
let open = false;

export async function showUnlocked(list) {
  const fresh = (list || []).filter((a) => a && a.code && !shown.has(a.code));
  if (!fresh.length) return;
  fresh.forEach((a) => shown.add(a.code));
  queue.push(...fresh);
  if (!open) { await loadAchievementsCss(); next(); }
}
export async function checkUnseen() {
  try { const d = await get('/achievements/unseen'); await showUnlocked(d.items); } catch (_) { /* the notification is a bonus: never in the way */ }
}

function next() {
  const a = queue.shift();
  if (!a) { open = false; return; }
  open = true;
  const rc = (RARITY_STYLE[a.rarity] || RARITY_STYLE.common).glow, prev = document.activeElement;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); post('/achievements/seen', { codes: [a.code] }).catch(() => {}); if (prev && prev.focus) try { prev.focus(); } catch (_) { /* gone */ } next(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const sparks = Array.from({ length: 14 }, (_, i) => { const ang = (Math.PI * 2 * i) / 14, d = 90 + (i % 3) * 30; return h('i', { class: 'ach-spark', style: { '--x': Math.round(Math.cos(ang) * d) + 'px', '--y': Math.round(Math.sin(ang) * d) + 'px', '--d': (i % 5) * 0.08 + 's' } }); });
  const go = h('button', { class: 'btn', type: 'button', id: 'ach-pop-close', onclick: close }, queue.length ? t('ach.popup_next') : t('ach.popup_close'));
  const box = h('div', { class: 'ach-pop', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': t('ach.popup_title'), 'data-code': a.code, 'data-rarity': a.rarity, style: { '--rc': rc } },
    h('div', { class: 'ach-pop-card' }, ...sparks,
      h('div', { class: 'ach-pop-kicker' }, t('ach.popup_title')),
      h('div', { class: 'ach-pop-medal' }, medal(a, iconOf, { size: 150 })),
      h('span', { class: 'ach-pill r-' + a.rarity, style: { position: 'relative' } }, rarityName(a.rarity)),
      h('h2', {}, a.title), h('p', {}, a.description),
      h('div', { class: 'ach-pop-rewards' }, rewardChips(a, { earned: true })),
      queue.length ? h('p', { class: 'muted small' }, t('ach.popup_more', { n: queue.length })) : null,
      h('div', { class: 'ach-pop-actions' }, go, h('a', { class: 'btn secondary', href: '/achievements', onclick: (e) => { e.preventDefault(); close(); navigate('/achievements'); } }, t('ach.popup_view')))));
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  go.focus();
}
