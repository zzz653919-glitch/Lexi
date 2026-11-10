import { h, icon, get, post, patch, put, del, api, table, tag, formDialog, toast, iconBtn, pager, typedConfirm, t, fmt, modal } from '../common.js';

const KINDS = ['tee', 'hoodie', 'jacket', 'shirt', 'pants', 'shorts', 'dress', 'shoes', 'costume', 'seasonal', 'glasses', 'sunglasses', 'hat', 'cap', 'headphones', 'backpack', 'watch', 'necklace', 'wings', 'mask', 'fashion', 'headwear', 'footwear', 'neckwear', 'cape', 'gloves', 'facewear', 'cat', 'dog', 'rabbit', 'fox', 'dragon', 'bird', 'dino', 'fantasy', 'animation', 'background', 'effect', 'style', 'collectible'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'], EARN = ['lessons', 'streak', 'xp', 'levels', 'words', 'tokens', 'missions'], REWARDS = ['token_lesson', 'token_topic', 'token_test', 'token_mission', 'token_streak7', 'token_level'];
const rarityTag = (r) => h('span', { class: 'badge', style: { background: { common: '#9aa3b2', uncommon: '#2fb36d', rare: '#2f7bff', epic: '#a855f7', legendary: '#f2b705', mythic: '#e0245e' }[r], color: r === 'legendary' ? '#3a2400' : '#fff' } }, t('av.rarity.' + r));

function uploader(state, label) {
  const info = h('span', { class: 'muted small' });
  const input = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif', 'aria-label': label, 'data-upload': 'image_url' });
  const show = () => info.replaceChildren(state.image_url ? h('span', {}, t('adm.avatar.uploaded') + ' ', h('img', { src: state.image_url, alt: '', height: 40, style: { verticalAlign: 'middle', borderRadius: '8px' } }), ' ', h('button', { type: 'button', class: 'btn secondary small', onclick: () => { state.image_url = ''; show(); } }, t('adm.avatar.remove'))) : '');
  input.addEventListener('change', async () => { const f = input.files[0]; if (!f) return; try { const r = await api('POST', '/admin/avatar/upload', await f.arrayBuffer(), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': f.name } }); state.image_url = r.url; show(); toast(t('adm.avatar.uploaded'), 'success', 2000); } catch (e) { toast(e.message, 'error', 6000); } input.value = ''; });
  show();
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'row' }, input), info);
}

/* Avatar management: shop items (price, rarity, image, earn rule), token rewards, the ledger and what users own */
export default async function avatarAdmin() {
  const R = await import('/js/avatar/render.js'); const O = await import('/js/avatar/outfits.js'), W = await import('/js/avatar/wear.js'), G = await import('/js/avatar/gear.js');
  const holder = h('div', {}); let tab = 'items', q = '', kind = '', page = 1, email = '';
  const tabs = h('div', { class: 'row', role: 'tablist' }, [['items', 'adm.avatar.items'], ['rewards', 'adm.avatar.rewards'], ['tx', 'adm.avatar.transactions']].map(([k, key]) => h('button', { type: 'button', class: 'btn secondary small', role: 'tab', 'data-tab': k, onclick: () => { tab = k; draw(); } }, t(key))));
  const mark = () => tabs.querySelectorAll('button').forEach((b) => { b.classList.toggle('secondary', b.dataset.tab !== tab); b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });

  let d0 = { collections: {} };
  async function itemDialog(it) {
    d0 = await get('/admin/avatar/items?q=zzzz-none');
    const st = { image_url: it ? it.image_url : '' };
    const rule = it && it.earn_rule ? it.earn_rule.split(':') : ['', ''], art = it ? it.art : { c: '#e63946', c2: '#ffffff', p: 'solid' };
    const r = await formDialog({ title: it ? t('adm.avatar.edit_item') : t('adm.avatar.new_item'), wide: true, fields: [
      { name: 'name_en', label: t('adm.avatar.f_name_en'), value: it ? it.name_en : '', required: true, maxlength: 60 }, { name: 'name_uz', label: t('adm.avatar.f_name_uz'), value: it ? it.name_uz : '', maxlength: 60 }, { name: 'name_ru', label: t('adm.avatar.f_name_ru'), value: it ? it.name_ru : '', maxlength: 60 },
      { name: 'kind', label: t('adm.avatar.f_kind'), type: 'select', value: it ? it.kind : 'tee', options: KINDS.map((k) => ({ value: k, label: t('av.kind.' + k) })) },
      { name: 'price', label: t('adm.avatar.f_price'), type: 'number', value: it ? it.price : 50, min: 0 }, { name: 'rarity', label: t('adm.avatar.f_rarity'), type: 'select', value: it ? it.rarity : 'common', options: RARITIES.map((x) => ({ value: x, label: t('av.rarity.' + x) })) },
      { name: 'status', label: t('adm.avatar.f_status'), type: 'select', value: it ? it.status : 'active', options: [{ value: 'active', label: t('adm.avatar.active') }, { value: 'disabled', label: t('adm.avatar.disabled') }] },
      { name: 'collection', label: t('adm.avatar.f_collection'), type: 'select', value: it ? it.collection || '' : '', options: [{ value: '', label: t('adm.avatar.no_collection') }, ...Object.keys(d0.collections || {}).map((k) => ({ value: k, label: t('av.collection.' + k) }))] }, { name: 'subcollection', label: t('adm.avatar.f_subcollection'), value: it ? it.subcollection || '' : '', maxlength: 24 },
      { name: 'preset', label: t('adm.avatar.f_preset'), type: 'select', value: '', options: [{ value: '', label: '—' }, ...[['fashion', O.PRESET_KEYS], ['headwear', W.ALL_HATS], ['footwear', W.ALL_SHOES], ['neckwear', W.ALL_NECKS], ['cape', W.ALL_BACKS], ['gloves', G.GLOVES], ['facewear', G.FACES_WEAR]].flatMap(([g, list]) => list.map((x) => ({ value: x, label: t('av.kind.' + g) + ': ' + x })))] },
      { name: 'c', label: t('adm.avatar.f_color'), value: art.c || '#e63946', maxlength: 7 }, { name: 'c2', label: t('adm.avatar.f_color2'), value: art.c2 || '#ffffff', maxlength: 7 },
      { name: 'c3', label: t('adm.avatar.f_color3'), value: art.c3 || '', maxlength: 7 }, { name: 'p', label: t('adm.avatar.f_pattern'), type: 'select', value: art.p || 'solid', options: O.PATTERNS.map((x) => ({ value: x, label: x })) }, { name: 'e', label: t('adm.avatar.f_emblem'), type: 'select', value: art.e || 'none', options: O.EMBLEMS.map((x) => ({ value: x, label: x })) }, { name: 'n', label: t('adm.avatar.f_number'), type: 'number', value: art.n ?? '', min: 0, max: 99 }, { name: 'v', label: t('adm.avatar.f_variant'), value: art.v || '', maxlength: 16, hint: t('adm.avatar.f_variant_hint') },
      { name: 'earn_type', label: t('adm.avatar.f_earn_type'), type: 'select', value: rule[0], options: [{ value: '', label: t('adm.avatar.earn_none') }, ...EARN.map((x) => ({ value: x, label: t('adm.avatar.earn_' + x) }))] }, { name: 'earn_value', label: t('adm.avatar.f_earn_value'), type: 'number', value: rule[1] || '', min: 1, hint: t('adm.avatar.f_earn_hint') }],
      extra: uploader(st, t('adm.avatar.upload_image')),
      save: (v) => { const body = { name_en: v.name_en, name_uz: v.name_uz, name_ru: v.name_ru, kind: v.kind, price: Number(v.price) || 0, rarity: v.rarity, status: v.status, collection: v.collection, subcollection: v.subcollection, art: { c: v.c, c2: v.c2, ...(v.c3 ? { c3: v.c3 } : {}), p: v.p, ...(v.e && v.e !== 'none' ? { e: v.e } : {}), ...(v.n !== '' && v.n != null ? { n: Number(v.n) } : {}), ...((v.preset || v.v) ? { v: v.preset || v.v } : {}) }, image_url: st.image_url, earn_rule: v.earn_type && Number(v.earn_value) > 0 ? `${v.earn_type}:${Number(v.earn_value)}` : '' }; return it ? patch('/admin/avatar/items/' + it.id, body) : post('/admin/avatar/items', body); } });
    if (r) { toast(t('adm.avatar.saved'), 'success'); draw(); }
  }
  const preview = (it) => { const s = h('span', { style: { display: 'inline-block', width: '56px', height: '56px', overflow: 'hidden' } }); s.innerHTML = R.itemSvg({ ...it, image: it.image_url }, { size: 56 }); return s; };

  async function userDialog(id) {
    const d = await get('/admin/avatar/users/' + id);
    const amount = h('input', { class: 'input', type: 'number', id: 'av-grant-amount', min: 1, max: 10000, placeholder: '50', 'aria-label': t('adm.avatar.grant_amount') }), note = h('input', { class: 'input', id: 'av-grant-note', maxlength: 100, placeholder: t('adm.avatar.grant_note'), 'aria-label': t('adm.avatar.grant_note') });
    const body = h('div', {}, h('p', {}, h('b', {}, d.user.name), ` (${d.user.email}) · ${t('adm.avatar.wallet', { balance: d.wallet.balance, earned: d.wallet.earned, spent: d.wallet.spent })} · XP ${d.user.xp}`),
      h('h3', {}, t('adm.avatar.owned_items', { n: d.owned.length })), d.owned.length ? h('ul', { id: 'av-owned-list' }, d.owned.map((o) => h('li', { 'data-slug': o.slug }, `${o.name_en} · ${t('av.rarity.' + o.rarity)} · ${t('adm.avatar.source_' + o.source)}${o.price_paid ? ' · ' + o.price_paid : ''}`))) : h('p', { class: 'muted' }, t('adm.nothing_here')),
      h('h3', {}, t('adm.avatar.characters', { n: d.avatars.length })), h('p', {}, d.avatars.map((a) => a.name).join(', ') || '—'),
      h('h3', {}, t('adm.avatar.grant')), h('div', { class: 'row' }, amount, note, h('button', { class: 'btn small', type: 'button', id: 'av-grant', onclick: async () => { try { await post(`/admin/avatar/users/${id}/grant`, { amount: Number(amount.value), note: note.value }); toast(t('adm.avatar.granted'), 'success'); dlg.close(); userDialog(id); } catch (e) { toast(e.message, 'error', 6000); } } }, t('adm.avatar.grant_button'))));
    const dlg = h('dialog', { class: 'wide', 'aria-label': t('adm.avatar.user_title') }, h('div', { class: 'dialog-body' }, h('h2', {}, t('adm.avatar.user_title')), body, h('div', { class: 'dialog-actions' }, h('button', { class: 'btn secondary', type: 'button', onclick: () => dlg.close() }, t('adm.avatar.close')))));
    dlg.addEventListener('close', () => dlg.remove()); document.body.append(dlg); dlg.showModal();
  }

  async function draw() {
    mark();
    if (tab === 'items') {
      const d = await get('/admin/avatar/items?q=' + encodeURIComponent(q) + '&kind=' + encodeURIComponent(kind));
      const search = h('input', { class: 'input', id: 'av-q', type: 'search', value: q, placeholder: t('adm.avatar.search'), 'aria-label': t('adm.avatar.search'), onchange: (e) => { q = e.target.value; draw(); } });
      const ks = h('select', { class: 'input', id: 'av-kind', 'aria-label': t('adm.avatar.f_kind'), onchange: (e) => { kind = e.target.value; draw(); } }, h('option', { value: '' }, t('av.all')), ...KINDS.map((k) => h('option', { value: k, selected: k === kind }, t('av.kind.' + k))));
      holder.replaceChildren(h('div', { class: 'row' }, search, ks, h('button', { class: 'btn', id: 'av-new-item', type: 'button', onclick: () => itemDialog(null) }, icon('plus'), t('adm.avatar.new_item')), h('span', { class: 'muted small' }, t('adm.avatar.count', { n: d.items.length }))),
        table([
          { label: t('adm.avatar.col_picture'), render: preview }, { label: t('adm.avatar.col_item'), render: (it) => h('div', {}, h('b', {}, it.name_en), h('div', { class: 'muted small' }, [it.name_uz, it.name_ru].filter(Boolean).join(' · ') + ' · ' + it.slug)) },
          { label: t('adm.avatar.f_kind'), render: (it) => t('av.kind.' + it.kind) }, { label: t('adm.avatar.f_collection'), render: (it) => (it.collection ? t('av.collection.' + it.collection) + (it.subcollection ? ' / ' + it.subcollection : '') : '—') }, { label: t('adm.avatar.f_rarity'), render: (it) => rarityTag(it.rarity) },
          { label: t('adm.avatar.f_price'), render: (it) => (it.earn_rule ? '—' : fmt.number(it.price)) }, { label: t('adm.avatar.col_earn'), render: (it) => (it.earn_rule ? it.earn_rule : it.starter ? t('av.starter') : '') },
          { label: t('adm.avatar.col_owners'), render: (it) => fmt.number(it.owners) }, { label: t('adm.col.status'), render: (it) => tag(it.status === 'active' ? 'published' : 'draft') },
          { label: '', cls: 'actions', render: (it) => h('div', { class: 'row' }, iconBtn('edit', t('common.edit'), () => itemDialog(it)),
            iconBtn('trash', t('common.delete'), async () => { if (!(await typedConfirm(t('adm.avatar.delete_item'), t('adm.avatar.delete_text', { name: it.name_en }), it.slug))) return; try { await del('/admin/avatar/items/' + it.id); toast(t('adm.avatar.deleted'), 'success'); draw(); } catch (e) { toast(e.message, 'error', 6000); } }, 'danger')) },
        ], d.items.slice(0, 200)));
    } else if (tab === 'rewards') {
      const d = await get('/admin/avatar/rewards'), inputs = {};
      const rows = REWARDS.map((k) => { inputs[k] = h('input', { class: 'input', type: 'number', min: 0, max: 5000, id: 'av-r-' + k, name: k, value: d.rewards[k] }); return h('label', { class: 'field' }, h('span', { class: 'label' }, t('adm.avatar.reward.' + k)), inputs[k]); });
      holder.replaceChildren(h('section', { class: 'card' }, h('h2', {}, t('adm.avatar.rewards')), h('p', { class: 'muted' }, t('adm.avatar.rewards_hint')), h('form', { id: 'av-rewards-form', onsubmit: async (e) => { e.preventDefault(); try { await put('/admin/avatar/rewards', Object.fromEntries(REWARDS.map((k) => [k, Number(inputs[k].value)]))); toast(t('adm.avatar.saved'), 'success'); } catch (x) { toast(x.message, 'error', 6000); } } }, ...rows, h('button', { class: 'btn', type: 'submit', id: 'av-rewards-save' }, t('common.save')))));
    } else {
      const d = await get(`/admin/avatar/transactions?page=${page}&email=${encodeURIComponent(email)}`);
      const search = h('input', { class: 'input', id: 'av-tx-email', type: 'search', value: email, placeholder: t('adm.avatar.search_user'), 'aria-label': t('adm.avatar.search_user'), onchange: (e) => { email = e.target.value; page = 1; draw(); } });
      holder.replaceChildren(h('div', { class: 'row' }, search, h('span', { class: 'muted small', id: 'av-tx-totals' }, t('adm.avatar.totals', { earned: fmt.number(d.totals.earned), spent: fmt.number(d.totals.spent), n: fmt.number(d.total) }))),
        table([
          { label: t('adm.avatar.col_date'), render: (x) => fmt.dateTime(x.created_at) }, { label: t('adm.avatar.col_user'), render: (x) => h('button', { class: 'btn secondary small', type: 'button', 'data-user': x.user_id, onclick: () => userDialog(x.user_id) }, x.email) },
          { label: t('adm.avatar.col_reason'), render: (x) => t('av.reason.' + x.reason) }, { label: t('adm.avatar.col_amount'), render: (x) => h('b', { style: { color: x.amount > 0 ? '#1b8a55' : '#d6336c' } }, (x.amount > 0 ? '+' : '') + x.amount) },
          { label: t('adm.avatar.col_balance'), render: (x) => fmt.number(x.balance_after) }, { label: t('adm.avatar.col_ref'), render: (x) => h('code', { class: 'small' }, x.ref) },
        ], d.items), pager({ page: d.page, pageSize: d.pageSize, total: d.total }, (n) => { page = n; draw(); }));
    }
  }
  await draw();
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.avatar'))), h('p', { class: 'muted' }, t('adm.avatar.intro')), tabs, holder);
  return { el, title: t('adm.nav.avatar'), nav: 'avatar' };
}
