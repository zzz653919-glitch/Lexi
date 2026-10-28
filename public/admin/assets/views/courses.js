import { h, icon, get, post, table, tag, formDialog, toast, t, fmt } from '../common.js';
import { navigate } from '../admin.js';

export default async function courses() {
  const { items } = await get('/admin/courses');
  const holder = h('div', {});
  const draw = (rows) => holder.replaceChildren(table([
    { label: t('adm.col.course'), render: (c) => h('div', {}, h('a', { href: '/admin/courses/' + c.id, style: { fontWeight: 800 } }, c.title), h('div', { class: 'muted small' }, c.track === 'ielts' ? t('adm.track.ielts') : t('adm.track.general'))) },
    { label: t('adm.col.status'), render: (c) => tag(c.status) }, { label: t('adm.col.levels'), render: (c) => fmt.number(c.levels) }, { label: t('adm.col.lessons'), render: (c) => t('adm.published_of', { done: fmt.number(c.published_lessons), total: fmt.number(c.lessons) }) },
    { label: '', cls: 'acts', render: (c) => h('a', { class: 'btn small secondary', href: '/admin/courses/' + c.id }, t('adm.open')) },
  ], rows, { empty: t('adm.no_courses') }));
  draw(items);
  const create = async () => {
    const c = await formDialog({ title: t('adm.new_course'), submitLabel: t('adm.create_course'), fields: [
      { name: 'title', label: t('adm.f.title'), required: true, maxlength: 80 }, { name: 'description', label: t('adm.f.description'), type: 'textarea', maxlength: 500 },
      { name: 'track', label: t('adm.f.track'), type: 'select', options: [{ value: 'general', label: t('adm.track.general_full') }, { value: 'ielts', label: t('adm.track.ielts_full') }] }],
      save: (v) => post('/admin/courses', v) });
    if (c) { toast(t('adm.course_created'), 'success'); navigate('/admin/courses/' + c.id); }
  };
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.courses')), h('button', { class: 'btn', onclick: create }, icon('plus'), t('adm.new_course'))), holder);
  return { el, title: t('adm.nav.courses'), nav: 'courses' };
}
