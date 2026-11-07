/* The character on the profile page: name, outfit, pet, tokens earned, XP, achievements and character level. */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t, n } from '../i18n.js';
import { renderAvatar } from './render.js';
import { loadAvatarCss, tokenAmount } from './ui.js';

export async function avatarCard() {
  await loadAvatarCss();
  const d = await get('/avatar/card');
  const box = h('section', { class: 'card av-profile', id: 'avatar-card', 'aria-labelledby': 'avc-h' });
  if (!d.avatar) {
    box.append(h('h2', { id: 'avc-h' }, t('av.profile_title')), h('p', { class: 'muted' }, t('av.profile_empty')), h('a', { class: 'btn', href: '/avatar', id: 'avc-create' }, t('av.create_character')));
    return box;
  }
  const eq = {}; for (const it of d.items) eq[it.slot] = it;
  const art = h('span', { class: 'av-wrap' }); art.innerHTML = renderAvatar({ style: d.avatar.style, look: d.avatar.look, equipped: eq, size: 170, petPose: d.avatar.petPose || 'sit', label: d.avatar.name });
  box.append(h('div', { class: 'av-profile-grid' },
    h('div', { class: 'av-profile-art' }, art),
    h('div', { class: 'av-profile-info' }, h('h2', { id: 'avc-h' }, d.avatar.name), h('div', { class: 'av-level', 'data-level': String(d.level.level) }, h('span', { class: 'av-lv' }, t('av.level', { n: d.level.level })),
      h('div', { class: 'av-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': d.level.pct, 'aria-label': t('av.level', { n: d.level.level }) }, h('i', { style: { width: d.level.pct + '%' } })), h('small', {}, t('av.level_next', { xp: Math.max(0, d.level.next - d.xp), n: d.level.level + 1 }))),
      h('dl', { class: 'av-facts' },
        h('div', {}, h('dt', {}, t('av.outfit')), h('dd', { id: 'avc-outfit' }, d.outfit.length ? d.outfit.map((o) => h('span', { class: 'av-pill r-' + o.rarity }, o.name)) : t('av.none'))),
        h('div', {}, h('dt', {}, t('av.pet')), h('dd', { id: 'avc-pet' }, d.pet ? `🐾 ${d.pet.name}` : t('av.none'))),
        h('div', {}, h('dt', {}, t('av.tokens_earned')), h('dd', { id: 'avc-tokens' }, tokenAmount(d.tokens.earned))),
        h('div', {}, h('dt', {}, t('av.total_xp')), h('dd', { id: 'avc-xp' }, n(d.xp) + ' XP')),
        h('div', {}, h('dt', {}, t('av.achievements')), h('dd', { id: 'avc-ach' }, String(d.achievements + d.badges.length)))),
      h('div', { class: 'av-profile-actions' }, h('a', { class: 'btn', href: '/avatar' }, t('av.edit_character')), h('a', { class: 'btn secondary', href: '/avatar/shop' }, t('av.nav.shop'))))));
  return box;
}
