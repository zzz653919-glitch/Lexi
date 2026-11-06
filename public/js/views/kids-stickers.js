/* LEXIO KIDS: the sticker album (stickers, collectible animals, dress-up: friends, accessories, backgrounds). Everything is earned. */
import { h, toast } from '../ui.js';
import { get, patch } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile, kidsState, applyBackground, rewardName } from '../kids/common.js';
import { companion } from '../kids/characters.js';
import { kidsPage, kidsView } from '../kids/shell.js';

export function needText(n) {
  if (!n || n.type === 'free') return t('kids.need.free');
  const p = { n: n.n, name: n.type === 'game' ? t('kids.game.' + n.code) : n.type === 'story' ? t('kids.story.' + n.code) : n.name, word: n.word };
  return t('kids.need.' + n.type, p);
}
const TABS = [['stickers', ['sticker']], ['animals', ['animal']], ['dress', ['character', 'accessory', 'background']]];

export default async function kidsStickers() {
  await initKids(true);
  const [d, o] = await Promise.all([get('/kids/rewards'), get('/kids/overview')]);
  let tab = 'stickers';
  const body = h('div', {}), tabs = h('div', { class: 'k-tabs', role: 'tablist' });
  const card = (x) => h('li', { class: 'k-sticker' + (x.earned ? ' on' : ''), 'data-kind': x.kind, 'data-code': x.code, 'data-earned': String(x.earned) },
    h('span', { class: 'k-sticker-art', 'aria-hidden': 'true' }, x.earned ? (x.image ? h('img', { src: x.image, alt: '', width: 56, height: 56 }) : x.emoji) : '❔'), h('b', {}, x.earned ? rewardName(x) : '???'), h('small', {}, x.earned ? t('kids.badge_earned') : needText(x.need)));
  async function wear(kind, code) { try { kidsState.profile = { ...kidsState.profile, ...(await patch('/kids/profile', { [kind]: code })) }; applyBackground(); toast(t('kids.saved'), 'success', 1500); draw(); } catch (e) { toast(e.message, 'error', 4000); } }
  function dressItem(x) {
    const cur = profile(), on = (x.kind === 'character' && cur.character === x.code) || (x.kind === 'accessory' && cur.accessory === x.code) || (x.kind === 'background' && cur.background === x.code);
    return h('li', { class: 'k-sticker dress' + (x.earned ? ' on' : '') + (on ? ' wearing' : ''), 'data-kind': x.kind, 'data-code': x.code, 'data-earned': String(x.earned) },
      h('span', { class: 'k-sticker-art', 'aria-hidden': 'true' }, !x.earned ? '❔' : x.kind === 'character' ? companion({ character: x.code, accessory: cur.accessory, size: 56 }).el : x.emoji), h('b', {}, x.earned ? t(`kids.r.${x.kind}.${x.code}`) : '???'),
      x.earned ? h('button', { class: 'btn small', type: 'button', 'aria-pressed': String(on), onclick: () => wear(x.kind, x.code) }, on ? t('kids.wearing') : t('kids.wear')) : h('small', {}, needText(x.need)));
  }
  function draw() {
    tabs.replaceChildren(...TABS.map(([key, kinds]) => { const list = d.items.filter((x) => kinds.includes(x.kind)); return h('button', { class: 'k-tab' + (tab === key ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(tab === key), 'data-tab': key, onclick: () => { tab = key; draw(); } }, t('kids.tab.' + key), h('small', {}, ` ${list.filter((x) => x.earned).length}/${list.length}`)); }));
    const kinds = TABS.find((x) => x[0] === tab)[1];
    if (tab === 'dress') {
      const cur = profile();
      body.replaceChildren(h('div', { class: 'k-dress-preview' }, companion({ character: cur.character, accessory: cur.accessory, size: 150 }).el),
        ...kinds.map((k) => h('section', {}, h('h2', { class: 'k-h2' }, t('kids.kind.' + k)), h('ul', { class: 'k-stickers' }, d.items.filter((x) => x.kind === k).map(dressItem)))));
    } else body.replaceChildren(h('ul', { class: 'k-stickers' }, d.items.filter((x) => kinds.includes(x.kind)).map(card)));
  }
  draw();
  const page = kidsPage('stickers', h('h1', { class: 'k-h2' }, t('kids.nav.stickers')), h('p', { class: 'k-lead' }, t('kids.stickers_intro')), tabs, body);
  page.setStars(o.stars);
  return kidsView(page.el, t('kids.nav.stickers'));
}
