import { h, icon, get, post, patch, del, table, tag, formDialog, toast, iconBtn, typedConfirm, t, fmt } from '../common.js';
import { navigate } from '../admin.js';

export const KINDS = ['words', 'letters', 'numbers', 'sentences'];
export const catFields = (c = {}) => [
  { name: 'title_en', label: t('adm.kids.f_title_en'), value: c.title_en || '', required: true, maxlength: 80 },
  { name: 'title_uz', label: t('adm.kids.f_title_uz'), value: c.title_uz || '', maxlength: 80 },
  { name: 'title_ru', label: t('adm.kids.f_title_ru'), value: c.title_ru || '', maxlength: 80 },
  { name: 'emoji', label: t('adm.kids.f_emoji'), value: c.emoji || '⭐', maxlength: 16 },
  { name: 'color', label: t('adm.kids.f_color'), value: c.color || '#ffb703', maxlength: 7, hint: t('adm.kids.f_color_hint') },
  { name: 'kind', label: t('adm.kids.f_kind'), type: 'select', value: c.kind || 'words', options: KINDS.map((k) => ({ value: k, label: t('adm.kids.kind_' + k) })) },
  { name: 'position', label: t('adm.kids.f_position'), type: 'number', value: c.position || '', min: 0 },
  { name: 'status', label: t('adm.kids.f_status'), type: 'select', value: c.status || 'draft', options: ['published', 'draft'].map((s) => ({ value: s, label: t('adm.status.' + s) })) },
];

/* LEXIO KIDS content: all categories (games). Open one to manage its picture cards, images, audio and quiz questions. */
export default async function kids() {
  const holder = h('div', {});
  const load = async () => {
    const { items } = await get('/admin/kids/categories');
    holder.replaceChildren(h('section', { class: 'card' }, h('h2', {}, t('adm.kids.categories')), table([
      { label: t('adm.kids.col_category'), render: (c) => h('div', {}, h('a', { href: '/admin/kids/' + c.id, style: { fontWeight: 800 } }, h('span', { 'aria-hidden': 'true' }, c.emoji + ' '), c.title_en), h('div', { class: 'muted small' }, c.title_uz)) },
      { label: t('adm.kids.f_kind'), render: (c) => t('adm.kids.kind_' + c.kind) },
      { label: t('adm.kids.col_cards'), render: (c) => `${fmt.number(c.published)} / ${fmt.number(c.words)}` },
      { label: t('adm.kids.col_questions'), render: (c) => fmt.number(c.questions) },
      { label: t('adm.kids.col_learners'), render: (c) => fmt.number(c.learners) },
      { label: t('adm.col.status'), render: (c) => tag(c.status) },
      { label: '', cls: 'actions', render: (c) => h('div', { class: 'row' },
        h('a', { class: 'btn secondary small', href: '/admin/kids/' + c.id }, t('adm.kids.open')),
        iconBtn('edit', t('common.edit'), async () => { const r = await formDialog({ title: t('adm.kids.edit_category'), fields: catFields(c), save: (v) => patch('/admin/kids/categories/' + c.id, { ...v, position: Number(v.position) || 0 }) }); if (r) { toast(t('adm.kids.saved'), 'success'); load(); } }),
        iconBtn('trash', t('common.delete'), async () => { if (!(await typedConfirm(t('adm.kids.delete_category'), t('adm.kids.delete_category_text', { name: c.title_en }), c.slug))) return; try { await del('/admin/kids/categories/' + c.id); toast(t('adm.kids.deleted'), 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); } }, 'danger')) },
    ], items)));
  };
  await load();
  const create = async () => {
    const c = await formDialog({ title: t('adm.kids.new_category'), submitLabel: t('adm.kids.create'), fields: catFields(), save: (v) => post('/admin/kids/categories', { ...v, position: Number(v.position) || 0 }) });
    if (c) { toast(t('adm.kids.saved'), 'success'); navigate('/admin/kids/' + c.id); }
  };
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.kids')), h('div', { class: 'row' }, h('a', { class: 'btn secondary', href: '/kids', target: '_self' }, t('adm.kids.preview')), h('button', { class: 'btn', id: 'kids-new', onclick: create }, icon('plus'), t('adm.kids.new_category')))), h('p', { class: 'muted' }, t('adm.kids.intro')), holder);
  return { el, title: t('adm.nav.kids'), nav: 'kids' };
}
