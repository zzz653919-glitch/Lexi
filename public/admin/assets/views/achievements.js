import { h, icon, get, post, patch, del, table, formDialog, toast, iconBtn, typedConfirm, t, fmt } from '../common.js';

const RAR = { common: '#9aa3b2', rare: '#2f7bff', epic: '#a855f7', legendary: '#f2b705', mythic: '#e0245e' };
const rarityTag = (r) => h('span', { class: 'badge', style: { background: RAR[r] || RAR.common, color: r === 'legendary' ? '#3a2400' : '#fff' } }, t('ach.rarity.' + r));
const metricLabel = (m) => (String(m).startsWith('level:') ? `${t('adm.ach.metric_level')} ${String(m).slice(6)}` : t('adm.ach.metric_' + m));

/* Achievement management: texts in three languages, rarity, requirement, XP / token / avatar-item rewards, visibility. The requirement is chosen from the measured
   activities only (an achievement can never be unlocked by an administrator or by a request from the browser). */
export default async function achievementsAdmin() {
  const holder = h('div', {}); let cat = '', rar = '', lists = null;

  async function dialog(a) {
    const locked = !!(a && a.unlocked);
    const levelCodes = ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS'];
    const metricOptions = [...lists.metrics.map((m) => ({ value: m, label: t('adm.ach.metric_' + m) })), ...levelCodes.map((c) => ({ value: 'level:' + c, label: `${t('adm.ach.metric_level')} ${c}` }))];
    const fields = [
      ...(a ? [] : [{ name: 'code', label: t('adm.ach.f_code'), value: '', required: true, maxlength: 40 }]),
      { name: 'title_en', label: t('adm.ach.f_title_en'), value: a ? a.title_en : '', required: true, maxlength: 60 }, { name: 'title_uz', label: t('adm.ach.f_title_uz'), value: a ? a.title_uz : '', maxlength: 60 }, { name: 'title_ru', label: t('adm.ach.f_title_ru'), value: a ? a.title_ru : '', maxlength: 60 },
      { name: 'desc_en', label: t('adm.ach.f_desc_en'), value: a ? a.desc_en : '', required: true, maxlength: 200 }, { name: 'desc_uz', label: t('adm.ach.f_desc_uz'), value: a ? a.desc_uz : '', maxlength: 200 }, { name: 'desc_ru', label: t('adm.ach.f_desc_ru'), value: a ? a.desc_ru : '', maxlength: 200 },
      { name: 'category', label: t('adm.ach.f_category'), type: 'select', value: a ? a.category : 'learning', options: lists.categories.map((c) => ({ value: c, label: t('ach.cat.' + c) })) },
      { name: 'rarity', label: t('adm.ach.f_rarity'), type: 'select', value: a ? a.rarity : 'common', options: lists.rarities.map((r) => ({ value: r, label: t('ach.rarity.' + r) })) },
      { name: 'metric', label: t('adm.ach.f_metric'), type: 'select', value: a ? a.metric : 'lessons', options: metricOptions, hint: locked ? t('adm.ach.rule_locked') : '', disabled: locked },
      { name: 'target', label: t('adm.ach.f_target'), type: 'number', value: a ? a.target : 1, min: 1, max: 100000, disabled: locked },
      { name: 'icon', label: t('adm.ach.f_icon'), type: 'select', value: a ? a.icon : 'star', options: lists.icons.map((i) => ({ value: i, label: i })) },
      { name: 'xp', label: t('adm.ach.f_xp'), type: 'number', value: a ? a.xp : 20, min: 0, max: 5000 }, { name: 'tokens', label: t('adm.ach.f_tokens'), type: 'number', value: a ? a.tokens : 10, min: 0, max: 5000 },
      { name: 'item_slug', label: t('adm.ach.f_item'), type: 'select', value: a ? a.item_slug : '', options: [{ value: '', label: t('adm.ach.no_item') }, ...lists.items.map((i) => ({ value: i.slug, label: `${i.name_en} (${i.slot})` }))] },
      { name: 'badge', label: t('adm.ach.f_badge'), type: 'checkbox', value: a ? !!a.badge : true },
      { name: 'status', label: t('adm.ach.f_status'), type: 'select', value: a ? a.status : 'active', options: [{ value: 'active', label: t('adm.ach.active') }, { value: 'hidden', label: t('adm.ach.hidden') }] },
    ];
    const r = await formDialog({ title: a ? t('adm.ach.edit') : t('adm.ach.new'), wide: true, fields, save: (v) => {
      const body = { ...v, target: Number(v.target) || 1, xp: Number(v.xp) || 0, tokens: Number(v.tokens) || 0, badge: !!v.badge };
      if (locked) { delete body.metric; delete body.target; }
      return a ? patch('/admin/achievements/' + a.code, body) : post('/admin/achievements', body);
    } });
    if (r) { toast(t('adm.ach.saved'), 'success'); draw(); }
  }

  async function draw() {
    const d = await get('/admin/achievements'); lists = d.lists;
    const cats = h('select', { class: 'input', id: 'ach-cat', 'aria-label': t('adm.ach.f_category'), onchange: (e) => { cat = e.target.value; draw(); } }, h('option', { value: '' }, t('ach.all')), ...lists.categories.map((c) => h('option', { value: c, selected: c === cat }, t('ach.cat.' + c))));
    const rars = h('select', { class: 'input', id: 'ach-rar', 'aria-label': t('adm.ach.f_rarity'), onchange: (e) => { rar = e.target.value; draw(); } }, h('option', { value: '' }, t('ach.all')), ...lists.rarities.map((r) => h('option', { value: r, selected: r === rar }, t('ach.rarity.' + r))));
    const rows = d.items.filter((a) => (!cat || a.category === cat) && (!rar || a.rarity === rar));
    holder.replaceChildren(h('div', { class: 'row' }, cats, rars, h('button', { class: 'btn', id: 'ach-new', type: 'button', onclick: () => dialog(null) }, icon('plus'), t('adm.ach.new')), h('span', { class: 'muted small' }, `${rows.length} / ${d.items.length}`)),
      table([
        { label: t('adm.ach.f_title_en'), render: (a) => h('div', {}, h('b', {}, a.title_en), h('div', { class: 'muted small' }, [a.title_uz, a.title_ru].filter(Boolean).join(' · ') + ' · ' + a.code)) },
        { label: t('adm.ach.f_category'), render: (a) => t('ach.cat.' + a.category) }, { label: t('adm.ach.f_rarity'), render: (a) => rarityTag(a.rarity) },
        { label: t('adm.ach.f_metric'), render: (a) => h('span', {}, metricLabel(a.metric) + (String(a.metric).startsWith('level:') || ['grammar'].includes(a.metric) ? '' : ' ≥ ' + fmt.number(a.target))) },
        { label: t('adm.ach.f_xp'), render: (a) => fmt.number(a.xp) }, { label: t('adm.ach.f_tokens'), render: (a) => fmt.number(a.tokens) }, { label: t('adm.ach.f_item'), render: (a) => a.item_slug || '—' },
        { label: t('adm.ach.unlocked_by'), render: (a) => `${fmt.number(a.unlocked)} / ${fmt.number(d.learners)}` },
        { label: t('adm.col.status'), render: (a) => h('span', { class: 'badge tag-' + (a.status === 'active' ? 'published' : 'draft') }, a.status === 'active' ? t('adm.ach.active') : t('adm.ach.hidden')) },
        { label: '', cls: 'actions', render: (a) => h('div', { class: 'row' }, iconBtn('edit', t('common.edit'), () => dialog(a)),
          iconBtn('eye', a.status === 'active' ? t('adm.ach.hide') : t('adm.ach.show'), async () => { try { await patch('/admin/achievements/' + a.code, { status: a.status === 'active' ? 'hidden' : 'active' }); draw(); } catch (e) { toast(e.message, 'error', 6000); } }),
          a.unlocked ? null : iconBtn('trash', t('common.delete'), async () => { if (!(await typedConfirm(t('adm.ach.delete_q'), a.title_en, a.code))) return; try { await del('/admin/achievements/' + a.code); toast(t('adm.ach.deleted'), 'success'); draw(); } catch (e) { toast(e.message, 'error', 6000); } })) },
      ], rows));
  }
  await draw();
  return { el: h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.ach.title'))), h('p', { class: 'muted' }, t('adm.ach.lead')), holder), title: t('adm.nav.achievements'), nav: 'achievements' };
}
