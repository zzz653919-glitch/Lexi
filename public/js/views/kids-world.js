/* LEXIO KIDS: "My world" – six places that open and fill with decorations and animals as the child learns (earned, never bought). */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile } from '../kids/common.js';
import { companion } from '../kids/characters.js';
import { kidsPage, kidsView } from '../kids/shell.js';

export default async function kidsWorld() {
  await initKids(true);
  const w = await get('/kids/world');
  const open = w.places.filter((p) => p.unlocked).length, nextP = w.places.find((p) => !p.unlocked);
  const place = (p) => {
    const roam = p.animals.slice(0, 5).map((a, i) => h('span', { class: 'k-roamer', title: a.name, style: { top: (62 + (i % 3) * 9) + '%', animationDuration: (14 + i * 3) + 's', animationDelay: (-i * 4) + 's' } }, a.image ? h('img', { src: a.image, alt: '', width: 34, height: 34 }) : a.emoji));
    const decor = p.decor.map((d) => h('span', { class: 'k-decor' + (d.unlocked ? ' on' : ''), 'data-unlocked': String(d.unlocked), style: { left: d.x + '%', top: d.y + '%' }, title: d.unlocked ? '' : t('kids.need.stars', { n: d.need }) }, d.unlocked ? d.emoji : '·'));
    return h('article', { class: 'k-place place-' + p.code + (p.unlocked ? '' : ' locked'), 'data-place': p.code, 'data-unlocked': String(p.unlocked), 'aria-label': t('kids.r.place.' + p.code) },
      h('div', { class: 'k-place-scene', 'aria-hidden': 'true' }, h('div', { class: 'k-ground' }), p.unlocked ? [h('span', { class: 'k-place-emoji' }, p.emoji), decor, roam, p.code === 'house' ? h('span', { class: 'k-place-friend' }, companion({ character: profile().character, accessory: profile().accessory, size: 64 }).el) : null] : h('span', { class: 'k-place-lock' }, '🔒')),
      h('div', { class: 'k-place-info' }, h('b', {}, t('kids.r.place.' + p.code)), p.unlocked ? h('small', {}, t('kids.world_items', { n: p.decor.filter((d) => d.unlocked).length, max: p.decor.length })) : h('small', {}, t('kids.need.stars', { n: p.need }))));
  };
  const page = kidsPage('world', h('h1', { class: 'k-h2' }, t('kids.nav.world')), h('p', { class: 'k-lead', id: 'k-world-note' }, nextP ? t('kids.world_next', { n: Math.max(0, nextP.need - w.stars), place: t('kids.r.place.' + nextP.code) }) : t('kids.world_all')),
    h('div', { class: 'k-places', 'data-open': String(open) }, w.places.map(place)));
  return kidsView(page.el, t('kids.nav.world'));
}
