/* Avatar Studio and the inventory: a large live preview, options for every part, saved characters. The inventory shows only what the learner owns. */
import { h, toast, confirmDialog, icon } from '../ui.js';
import { post, put, del } from '../api.js';
import { t } from '../i18n.js';
import { navigate } from '../app.js';
import { renderAvatar, SKINS, HAIRS, EYES, STYLE_NAMES, itemSvg } from '../avatar/render.js';
import { A, loadBoot, equippedItems, avatarEl, avatarNav, rarityBadge, setBalance } from '../avatar/ui.js';

const DEFAULT_LOOK = { build: 1, shape: 0, skin: 2, hairStyle: 1, hairColor: 1, eyeStyle: 0, eyeColor: 0, brows: 0, mouth: 0 };
const TABS = { studio: ['style', 'face', 'hair', 'eyes', 'mouth', 'outfit', 'shoes', 'head', 'accessories', 'pet', 'scene'], inventory: ['outfit', 'shoes', 'head', 'accessories', 'pet', 'scene'] };
const TAB_EMOJI = { style: '✨', face: '🙂', hair: '💇', eyes: '👀', mouth: '👄', outfit: '👕', shoes: '👟', head: '🎩', accessories: '🎒', pet: '🐾', scene: '🌄' };
const GROUPS = { outfit: ['top', 'bottom', 'dress', 'outfit'], shoes: ['shoes'], head: ['hat', 'glasses', 'headphones', 'mask'], accessories: ['back', 'wrist', 'neck', 'wings'], pet: ['pet'], scene: ['background', 'effect', 'animation', 'style', 'collectible'] };
const clone = (o) => JSON.parse(JSON.stringify(o));

export default async function avatarStudio({ mode = 'studio' } = {}) {
  const boot = await loadBoot(true);
  const tabs = TABS[mode];
  let tab = tabs[0], current = null, draft = null, saved = null;      // current: the saved character being edited (null = a new one)

  const blank = () => { const eq = {}; for (const it of boot.items.filter((i) => i.owned && i.starter)) eq[it.slot] = it.slug; return { name: boot.name ? String(boot.name).slice(0, 24) : '', style: 'cartoon', look: clone(DEFAULT_LOOK), equipped: eq, petName: '', petPose: 'sit', favorite: false }; };
  const from = (a) => ({ name: a.name, style: a.style, look: { ...DEFAULT_LOOK, ...a.look }, equipped: { ...a.equipped }, petName: a.petName, petPose: a.petPose, favorite: a.favorite });
  const select = (a) => { current = a; draft = a ? from(a) : blank(); saved = clone(draft); };
  select(boot.avatars.find((a) => a.id === boot.activeId) || boot.avatars[0] || null);
  const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);

  const stage = h('div', { class: 'av-stage-art', id: 'av-stage' });
  const nameInput = h('input', { class: 'av-name', id: 'av-name', name: 'name', maxlength: 24, 'aria-label': t('av.name'), placeholder: t('av.name_ph'), oninput: (e) => { draft.name = e.target.value; refreshState(); } });
  const state = h('span', { class: 'av-dirty', id: 'av-dirty', role: 'status' });
  const panel = h('div', { class: 'av-panel', id: 'av-panel' }), tabBar = h('div', { class: 'av-tabs', role: 'tablist', 'aria-label': t('av.parts') });
  const strip = h('div', { class: 'av-strip', id: 'av-strip' });
  const saveBtn = h('button', { class: 'av-btn go', type: 'button', id: 'av-save', onclick: save }, icon('check'), t('av.save'));
  const resetBtn = h('button', { class: 'av-btn', type: 'button', id: 'av-reset', onclick: reset }, '↺ ', t('av.reset'));
  const randBtn = h('button', { class: 'av-btn', type: 'button', id: 'av-random', onclick: randomize }, '🎲 ', t('av.random'));

  const equippedNow = () => equippedItems(draft.equipped);
  function paintStage() {
    stage.replaceChildren(h('span', { class: 'av-wrap' }));
    stage.firstChild.innerHTML = renderAvatar({ style: draft.style, look: draft.look, equipped: equippedNow(), size: 300, petPose: draft.petPose, label: draft.name || t('av.you') });
    const pet = draft.equipped.pet && boot.items.find((i) => i.slug === draft.equipped.pet);
    if (pet && draft.petName) stage.append(h('span', { class: 'av-petname' }, '🐾 ' + draft.petName));
  }
  function refreshState() { state.textContent = dirty() ? t('av.unsaved') : (current ? t('av.saved') : t('av.new')); state.classList.toggle('warn', dirty()); saveBtn.disabled = !dirty() && !!current; resetBtn.disabled = !dirty(); }
  function paint() { paintStage(); refreshState(); }

  /* ---------- option tiles ---------- */
  const tile = (child, { on, label, onclick, extraClass = '', data = {} }) => h('button', { type: 'button', class: 'av-tile' + (on ? ' on' : '') + ' ' + extraClass, 'aria-pressed': String(!!on), 'aria-label': label, title: label, onclick, ...Object.fromEntries(Object.entries(data).map(([k, v]) => ['data-' + k, v])) }, child, h('small', {}, label));
  const faceTile = (k, i, label) => { const span = h('span', { class: 'av-mini' }); span.innerHTML = renderAvatar({ style: draft.style, look: { ...draft.look, [k]: i }, equipped: {}, size: 74, viewBox: '52 14 136 140', plain: true }); return tile(span, { on: draft.look[k] === i, label, data: { part: k, index: i }, onclick: () => { draft.look[k] = i; paint(); fill(); } }); };
  const buildTile = (i) => { const span = h('span', { class: 'av-mini tall' }); span.innerHTML = renderAvatar({ style: draft.style, look: { ...draft.look, build: i }, equipped: draft.equipped ? Object.fromEntries(Object.entries(draft.equipped).filter(([sl]) => ['top', 'bottom', 'dress', 'outfit', 'shoes'].includes(sl)).map(([sl, slug]) => [sl, boot.items.find((x) => x.slug === slug)]).filter(([, it]) => it)) : {}, size: 74, viewBox: '28 8 184 320', plain: true }); return tile(span, { on: (draft.look.build ?? 1) === i, label: t('av.build_n.' + i), data: { part: 'build', index: i }, onclick: () => { draft.look.build = i; paint(); fill(); } }); };
  const swatches = (k, list, names) => h('div', { class: 'av-swatches', role: 'radiogroup' }, list.map((c, i) => h('button', { type: 'button', class: 'av-swatch' + (draft.look[k] === i ? ' on' : ''), role: 'radio', 'aria-checked': String(draft.look[k] === i), 'aria-label': t(names + '.' + i), title: t(names + '.' + i), 'data-part': k, 'data-index': i, style: { background: c }, onclick: () => { draft.look[k] = i; paint(); fill(); } })));
  const section = (title, ...kids) => h('section', { class: 'av-section' }, h('h3', {}, title), ...kids);
  const labelN = (key, n) => t(`av.${key}`, { n: n + 1 });
  const ownedFor = (slot) => boot.items.filter((i) => i.slot === slot && i.owned);
  const itemTile = (it, slot) => { const on = draft.equipped[slot] === it.slug; const span = h('span', { class: 'av-mini' }); span.innerHTML = itemSvg(it, { look: draft.look, style: draft.style, size: 74 });
    return tile(span, { on, label: it.name, extraClass: 'r-' + it.rarity, data: { slug: it.slug, slot }, onclick: () => { if (on) delete draft.equipped[slot]; else draft.equipped[slot] = it.slug; paint(); fill(); } }); };
  const noneTile = (slot) => tile(h('span', { class: 'av-mini none' }, '🚫'), { on: !draft.equipped[slot], label: t('av.none'), data: { slot, none: 1 }, onclick: () => { delete draft.equipped[slot]; paint(); fill(); } });
  const slotBlock = (slot) => { const list = ownedFor(slot); return section(t('av.slot.' + slot), h('div', { class: 'av-grid' }, noneTile(slot), list.map((it) => itemTile(it, slot)), list.length ? null : h('p', { class: 'av-empty' }, t('av.nothing_owned'), ' ', h('a', { href: '/avatar/shop' }, t('av.go_shop'))))); };

  function fill() {
    tabBar.querySelectorAll('.av-tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const parts = [];
    if (tab === 'style') parts.push(section(t('av.tab.style'), h('div', { class: 'av-grid' }, STYLE_NAMES.map((s) => { const span = h('span', { class: 'av-mini tall' }); span.innerHTML = renderAvatar({ style: s, look: draft.look, equipped: {}, size: 80, viewBox: '40 8 160 190', plain: true }); return tile(span, { on: draft.style === s, label: t('av.style.' + s), data: { style: s }, onclick: () => { draft.style = s; paint(); fill(); } }); }))));
    if (tab === 'face') parts.push(section(t('av.build'), h('div', { class: 'av-grid' }, [0, 1, 2].map(buildTile))), section(t('av.face_shape'), h('div', { class: 'av-grid' }, Array.from({ length: boot.spec.look.shape }, (_, i) => i).filter((i) => i !== 3).map((i, pos) => faceTile('shape', i, labelN('shape', pos))))), section(t('av.skin'), swatches('skin', SKINS, 'av.skin_n')));
    if (tab === 'hair') parts.push(section(t('av.hair_style'), h('div', { class: 'av-grid' }, Array.from({ length: boot.spec.look.hairStyle }, (_, i) => faceTile('hairStyle', i, i === 0 ? t('av.none') : labelN('hair', i))))), section(t('av.hair_color'), swatches('hairColor', HAIRS, 'av.hair_n')));
    if (tab === 'eyes') parts.push(section(t('av.eye_style'), h('div', { class: 'av-grid' }, Array.from({ length: boot.spec.look.eyeStyle }, (_, i) => faceTile('eyeStyle', i, labelN('eyes', i))))), section(t('av.eye_color'), swatches('eyeColor', EYES, 'av.eye_n')));
    if (tab === 'mouth') parts.push(section(t('av.brows'), h('div', { class: 'av-grid' }, Array.from({ length: boot.spec.look.brows }, (_, i) => faceTile('brows', i, labelN('brows', i))))), section(t('av.mouth'), h('div', { class: 'av-grid' }, Array.from({ length: boot.spec.look.mouth }, (_, i) => faceTile('mouth', i, labelN('mouth', i))))));
    if (GROUPS[tab]) {
      for (const slot of GROUPS[tab]) parts.push(slotBlock(slot));
      if (tab === 'pet') {
        const has = !!draft.equipped.pet;
        parts.push(section(t('av.pet_details'), h('div', { class: 'av-petform' },
          h('label', {}, t('av.pet_name'), h('input', { class: 'av-name', id: 'av-petname', maxlength: 16, value: draft.petName, disabled: !has, placeholder: t('av.pet_name_ph'), oninput: (e) => { draft.petName = e.target.value; paintStage(); refreshState(); } })),
          h('div', { class: 'av-poses', role: 'radiogroup', 'aria-label': t('av.pose') }, boot.spec.poses.map((p) => h('button', { type: 'button', class: 'av-pose' + (draft.petPose === p ? ' on' : ''), role: 'radio', 'aria-checked': String(draft.petPose === p), 'data-pose': p, disabled: !has, onclick: () => { draft.petPose = p; paint(); fill(); } }, ({ sit: '🪑', play: '🎾', sleep: '😴' })[p] + ' ' + t('av.pose.' + p)))))));
      }
      parts.push(h('p', { class: 'av-more' }, t('av.more_items'), ' ', h('a', { href: '/avatar/shop' }, t('av.go_shop') + ' →')));
    }
    panel.replaceChildren(...parts);
  }

  /* ---------- characters: save, reset, switch ---------- */
  async function save() {
    draft.name = draft.name.trim();
    if (!draft.name) { toast(t('av.name_required'), 'error', 3000); nameInput.focus(); return; }
    try {
      const body = { name: draft.name, style: draft.style, look: draft.look, equipped: draft.equipped, petName: draft.petName, petPose: draft.petPose, favorite: draft.favorite };
      const r = current ? await put(`/avatar/avatars/${current.id}`, body) : await post('/avatar/avatars', body);
      if (current) boot.avatars = boot.avatars.map((a) => (a.id === r.avatar.id ? r.avatar : a)); else { boot.avatars.push(r.avatar); if (!boot.activeId) boot.activeId = r.avatar.id; }
      select(r.avatar); toast(t('av.saved_toast', { name: r.avatar.name }), 'success', 2200); drawStrip(); paint(); fill();
    } catch (e) { toast(e.message, 'error', 5000); }
  }
  function reset() { draft = saved ? clone(saved) : blank(); nameInput.value = draft.name; paint(); fill(); toast(t('av.reset_done'), 'info', 1800); }
  function randomize() { const r = (n) => Math.floor(Math.random() * n), L = boot.spec.look; draft.look = { build: r(L.build), shape: [0, 1, 2, 4][r(4)], skin: r(L.skin), hairStyle: r(L.hairStyle), hairColor: r(L.hairColor), eyeStyle: r(L.eyeStyle), eyeColor: r(L.eyeColor), brows: r(L.brows), mouth: r(L.mouth) }; paint(); fill(); }
  async function switchTo(a) {
    if (dirty() && !(await confirmDialog(t('av.discard_title'), t('av.discard_text'), t('av.discard'), true))) return;
    select(a); nameInput.value = draft.name; drawStrip(); paint(); fill();
  }
  async function activate() { if (!current) return; try { const r = await post(`/avatar/avatars/${current.id}/activate`, {}); boot.activeId = r.activeId; drawStrip(); toast(t('av.active_toast', { name: current.name }), 'success', 2000); } catch (e) { toast(e.message, 'error'); } }
  async function remove() {
    if (!current || !(await confirmDialog(t('av.delete_title'), t('av.delete_text', { name: current.name }), t('common.delete'), true))) return;
    try { const r = await del(`/avatar/avatars/${current.id}`); boot.avatars = boot.avatars.filter((a) => a.id !== current.id); boot.activeId = r.activeId; select(boot.avatars.find((a) => a.id === r.activeId) || boot.avatars[0] || null); nameInput.value = draft.name; drawStrip(); paint(); fill(); toast(t('av.deleted'), 'success', 2000); } catch (e) { toast(e.message, 'error'); }
  }
  async function toggleFavorite() { draft.favorite = !draft.favorite; if (current) { try { const r = await put(`/avatar/avatars/${current.id}`, { favorite: draft.favorite }); boot.avatars = boot.avatars.map((a) => (a.id === r.avatar.id ? r.avatar : a)); current = r.avatar; saved.favorite = draft.favorite; } catch (e) { draft.favorite = !draft.favorite; toast(e.message, 'error'); } } drawStrip(); paint(); }
  function drawStrip() {
    strip.replaceChildren(...boot.avatars.map((a) => h('button', { type: 'button', class: 'av-card' + (current && current.id === a.id ? ' on' : '') + (boot.activeId === a.id ? ' active' : ''), 'data-avatar': a.id, 'aria-label': a.name, onclick: () => switchTo(a) },
      avatarEl(a, { size: 62, viewBox: '40 6 160 190', plain: true }), h('b', {}, a.name), a.favorite ? h('span', { class: 'av-fav', title: t('av.favorite') }, '⭐') : null, boot.activeId === a.id ? h('span', { class: 'av-live' }, t('av.in_use')) : null)),
      boot.avatars.length < boot.spec.max ? h('button', { type: 'button', class: 'av-card new' + (!current ? ' on' : ''), id: 'av-new', onclick: () => { if (!current && !dirty()) return; switchTo(null); } }, h('span', { class: 'av-plus', 'aria-hidden': 'true' }, '+'), h('b', {}, t('av.new_character'))) : null);
  }

  /* ---------- page ---------- */
  tabBar.append(...tabs.map((k) => h('button', { type: 'button', class: 'av-tab', role: 'tab', 'data-tab': k, 'aria-selected': 'false', onclick: () => { tab = k; fill(); } }, h('span', { 'aria-hidden': 'true' }, TAB_EMOJI[k]), h('b', {}, t('av.tab.' + k)))));
  nameInput.value = draft.name;
  drawStrip(); paint(); fill();
  const actions = h('div', { class: 'av-actions' }, saveBtn, resetBtn, mode === 'studio' ? randBtn : null,
    h('button', { class: 'av-btn', type: 'button', id: 'av-fav', 'aria-pressed': String(draft.favorite), onclick: toggleFavorite }, '⭐ ', t('av.favorite')),
    h('button', { class: 'av-btn', type: 'button', id: 'av-activate', onclick: activate }, '✅ ', t('av.use_this')),
    h('button', { class: 'av-btn danger', type: 'button', id: 'av-delete', onclick: remove }, '🗑️ ', t('av.delete')));
  const el = h('div', { class: 'av-page av-' + mode, 'data-mode': mode },
    h('div', { class: 'av-head' }, h('h1', {}, mode === 'studio' ? t('av.studio_title') : t('av.inventory_title')), avatarNav(mode)),
    h('p', { class: 'av-lead' }, mode === 'studio' ? t('av.studio_lead') : t('av.inventory_lead')), strip,
    h('div', { class: 'av-layout' },
      h('section', { class: 'av-stage', 'aria-label': t('av.preview') }, h('div', { class: 'av-stage-card' }, stage), h('div', { class: 'av-stage-meta' }, nameInput, state), actions),
      h('section', { class: 'av-editor' }, tabBar, panel)));
  return { el, title: mode === 'studio' ? t('av.studio_title') : t('av.inventory_title'), nav: 'avatar' };
}
