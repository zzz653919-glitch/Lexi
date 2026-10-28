import { h, icon, get, post, table, tag, formDialog, toast, crumbs, iconBtn, ApiError, api } from '../common.js';
import { navigate } from '../admin.js';

export default async function courses() {
  const { items } = await get('/admin/courses');
  const holder = h('div', {});
  const draw = (rows) => holder.replaceChildren(table([
    { label: 'Course', render: (c) => h('div', {}, h('a', { href: '/admin/courses/' + c.id, style: { fontWeight: 800 } }, c.title), h('div', { class: 'muted small' }, c.track === 'ielts' ? 'IELTS practice track' : 'General course')) },
    { label: 'Status', render: (c) => tag(c.status) }, { label: 'Levels', render: (c) => String(c.levels) }, { label: 'Lessons', render: (c) => `${c.published_lessons} / ${c.lessons} published` },
    { label: '', cls: 'acts', render: (c) => h('a', { class: 'btn small secondary', href: '/admin/courses/' + c.id }, 'Open') },
  ], rows, { empty: 'No courses yet. Create the first one.' }));
  draw(items);
  const create = async () => {
    const c = await formDialog({ title: 'New course', submitLabel: 'Create course', fields: [
      { name: 'title', label: 'Title', required: true, maxlength: 80 }, { name: 'description', label: 'Description', type: 'textarea', maxlength: 500 },
      { name: 'track', label: 'Track', type: 'select', options: [{ value: 'general', label: 'General English' }, { value: 'ielts', label: 'IELTS preparation (practice)' }] }],
      save: (v) => post('/admin/courses', v) });
    if (c) { toast('Course created as a draft', 'success'); navigate('/admin/courses/' + c.id); }
  };
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'Courses'), h('button', { class: 'btn', onclick: create }, icon('plus'), 'New course')), holder);
  return { el, title: 'Courses', nav: 'courses' };
}
