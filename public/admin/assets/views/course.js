import { h, icon, get, post, patch, del, put, table, tag, formDialog, toast, crumbs, iconBtn, confirmDialog, typedConfirm, session } from '../common.js';
import { navigate } from '../admin.js';

export default async function course({ params }) {
  const id = Number(params.id);
  const holder = h('div', {});
  const isAdmin = () => session.user.role === 'admin';
  async function load() { const d = await get('/admin/courses/' + id); draw(d); }

  async function reorder(kind, parentId, ids) {
    const url = { level: `/admin/courses/${parentId}/levels/reorder`, unit: `/admin/levels/${parentId}/units/reorder`, lesson: `/admin/units/${parentId}/lessons/reorder` }[kind];
    await post(url, { ids }); await load();
  }
  const move = (list, i, dir, kind, parent) => { const ids = list.map((x) => x.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; reorder(kind, parent, ids); };

  function draw(d) {
    const c = d.course;
    const setStatus = async (status) => {
      if (status === 'archived' && !(await confirmDialog('Archive this course?', 'Learners will no longer see it. You can publish it again later.', 'Archive', true))) return;
      try { await post(`/admin/courses/${id}/status`, { status }); toast(`Course ${status}`, 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); }
    };
    const editCourse = async () => { const r = await formDialog({ title: 'Edit course', fields: [{ name: 'title', label: 'Title', value: c.title, required: true }, { name: 'slug', label: 'Address (slug)', value: c.slug }, { name: 'description', label: 'Description', type: 'textarea', value: c.description },
      { name: 'track', label: 'Track', type: 'select', value: c.track, options: [{ value: 'general', label: 'General English' }, { value: 'ielts', label: 'IELTS preparation (practice)' }] }], save: (v) => patch('/admin/courses/' + id, v) }); if (r) load(); };
    const addLevel = async () => {
      const r = await formDialog({ title: 'Add level', fields: [{ name: 'code', label: 'Level code', type: 'select', options: ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS'].filter((x) => !d.levels.some((l) => l.code === x)).map((x) => ({ value: x, label: x })), hint: 'A1–C1 follow the CEFR scale as a guide; they are not an official assessment.' }, { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' }, { name: 'unlock_rule', label: 'Unlock rule', type: 'select', options: [{ value: 'sequential', label: 'Opens when the previous level is far enough along' }, { value: 'open', label: 'Always open' }] }, { name: 'unlock_threshold_pct', label: 'Previous level must be finished to (%)', type: 'number', value: 60, min: 0, max: 100 }],
        save: (v) => post(`/admin/courses/${id}/levels`, { ...v, unlock_threshold_pct: Number(v.unlock_threshold_pct) }) }); if (r) load();
    };
    const editLevel = async (lv) => { const r = await formDialog({ title: `Edit level ${lv.code}`, fields: [{ name: 'title', label: 'Title', value: lv.title, required: true }, { name: 'description', label: 'Description', type: 'textarea', value: lv.description },
      { name: 'unlock_rule', label: 'Unlock rule', type: 'select', value: lv.unlock_rule, options: [{ value: 'sequential', label: 'Opens when the previous level is far enough along' }, { value: 'open', label: 'Always open' }] }, { name: 'unlock_threshold_pct', label: 'Previous level must be finished to (%)', type: 'number', value: lv.unlock_threshold_pct, min: 0, max: 100 }],
      save: (v) => patch('/admin/levels/' + lv.id, { ...v, unlock_threshold_pct: Number(v.unlock_threshold_pct) }) }); if (r) load(); };
    const delLevel = async (lv) => { if (await confirmDialog('Delete level?', `Delete ${lv.code} with all its units, lessons and exercises? Learner progress on these lessons is removed too.`, 'Delete level', true)) { await del('/admin/levels/' + lv.id, { confirm: true }); toast('Level deleted', 'success'); load(); } };
    const addUnit = async (lv) => { const r = await formDialog({ title: `Add unit to ${lv.code}`, fields: [{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description', type: 'textarea' }], save: (v) => post(`/admin/levels/${lv.id}/units`, v) }); if (r) load(); };
    const editUnit = async (u) => { const r = await formDialog({ title: 'Edit unit', fields: [{ name: 'title', label: 'Title', value: u.title, required: true }, { name: 'description', label: 'Description', type: 'textarea', value: u.description }], save: (v) => patch('/admin/units/' + u.id, v) }); if (r) load(); };
    const delUnit = async (u) => { if (await confirmDialog('Delete unit?', `Delete “${u.title}” with its lessons and exercises?`, 'Delete unit', true)) { await del('/admin/units/' + u.id, { confirm: true }); load(); } };
    const addLesson = async (u) => { const r = await formDialog({ title: 'Add lesson', fields: [{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'xp_reward', label: 'XP for completing the lesson', type: 'number', value: 20, min: 0, max: 500 }], save: (v) => post(`/admin/units/${u.id}/lessons`, { ...v, xp_reward: Number(v.xp_reward) }) }); if (r) navigate('/admin/lessons/' + r.id); };
    const dupLesson = async (l) => { const r = await post(`/admin/lessons/${l.id}/duplicate`); toast('Lesson duplicated as a draft', 'success'); load(); };
    const delLesson = async (l) => { if (await confirmDialog('Delete lesson?', `Delete “${l.title}” and its ${l.exercises} exercises? This cannot be undone.`, 'Delete lesson', true)) { await del('/admin/lessons/' + l.id, { confirm: true }); toast('Lesson deleted', 'success'); load(); } };

    const levels = d.levels.map((lv, li) => h('section', { class: 'tree-level', 'aria-label': 'Level ' + lv.code },
      h('header', {}, h('div', {}, h('b', { style: { fontSize: '1.1rem' } }, `${lv.code} — ${lv.title}`), h('div', { class: 'muted small' }, lv.unlock_rule === 'open' ? 'Always open' : `Opens at ${lv.unlock_threshold_pct}% of the previous level`)),
        h('div', { class: 'row' }, iconBtn('up', 'Move level up', () => move(d.levels, li, -1, 'level', id)), iconBtn('down', 'Move level down', () => move(d.levels, li, 1, 'level', id)), iconBtn('edit', 'Edit level', () => editLevel(lv)), h('button', { class: 'btn small secondary', onclick: () => addUnit(lv) }, icon('plus'), 'Unit'), iconBtn('trash', 'Delete level', () => delLevel(lv), 'danger'))),
      lv.units.length ? lv.units.map((u, ui) => h('div', { class: 'tree-unit' },
        h('header', {}, h('div', {}, h('b', {}, u.title), u.description ? h('div', { class: 'muted small' }, u.description) : null), h('div', { class: 'row' }, iconBtn('up', 'Move unit up', () => move(lv.units, ui, -1, 'unit', lv.id)), iconBtn('down', 'Move unit down', () => move(lv.units, ui, 1, 'unit', lv.id)), iconBtn('edit', 'Edit unit', () => editUnit(u)), h('button', { class: 'btn small secondary', onclick: () => addLesson(u) }, icon('plus'), 'Lesson'), iconBtn('trash', 'Delete unit', () => delUnit(u), 'danger'))),
        u.lessons.length ? u.lessons.map((l, i) => h('div', { class: 'lesson-row' }, h('div', { class: 't' }, h('a', { href: '/admin/lessons/' + l.id }, l.title), ' ', tag(l.status), h('span', { class: 'muted small' }, ` · ${l.published_exercises}/${l.exercises} exercises · ${l.unlock_rule}`)),
          h('div', { class: 'row' }, iconBtn('up', 'Move lesson up', () => move(u.lessons, i, -1, 'lesson', u.id)), iconBtn('down', 'Move lesson down', () => move(u.lessons, i, 1, 'lesson', u.id)), h('a', { class: 'btn small secondary', href: '/admin/lessons/' + l.id }, 'Edit'), iconBtn('copy', 'Duplicate lesson', () => dupLesson(l)), iconBtn('trash', 'Delete lesson', () => delLesson(l), 'danger')))) : h('p', { class: 'muted small' }, 'No lessons in this unit yet.'))) : h('div', { class: 'tree-unit muted' }, 'No units yet.')));

    holder.replaceChildren(
      crumbs({ href: '/admin/courses', label: 'Courses' }, { label: c.title }),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, c.title), h('div', { class: 'row' }, tag(c.status), h('span', { class: 'muted small' }, c.track === 'ielts' ? 'IELTS practice track' : 'General course'))),
        h('div', { class: 'row' }, h('button', { class: 'btn secondary small', onclick: editCourse }, icon('edit'), 'Edit'), c.status !== 'published' ? h('button', { class: 'btn small', onclick: () => setStatus('published') }, 'Publish') : h('button', { class: 'btn secondary small', onclick: () => setStatus('draft') }, 'Unpublish'),
          c.status !== 'archived' ? h('button', { class: 'btn secondary small', onclick: () => setStatus('archived') }, 'Archive') : null, h('a', { class: 'btn secondary small', href: `/api/admin/courses/${id}/export`, download: '' }, icon('download'), 'Export JSON'),
          isAdmin() && c.status !== 'published' ? h('button', { class: 'btn danger small', onclick: async () => { if (await typedConfirm('Delete course', `Delete “${c.title}” with all levels, lessons, exercises and learner progress? This cannot be undone.`, c.title, 'Delete course')) { await del('/admin/courses/' + id, { confirm: true, title: c.title }); toast('Course deleted', 'success'); navigate('/admin/courses'); } } }, icon('trash'), 'Delete') : null)),
      c.description ? h('p', { class: 'muted' }, c.description) : null,
      c.track === 'ielts' ? h('div', { class: 'notice' }, 'IELTS content here is practice material. Learners see a notice that it is not an official assessment.') : null,
      h('div', { class: 'row between', style: { margin: '10px 0' } }, h('h2', { style: { margin: 0 } }, 'Levels, units and lessons'), h('button', { class: 'btn small', onclick: addLevel }, icon('plus'), 'Add level')),
      ...levels);
  }
  await load();
  return { el: holder, title: 'Course', nav: 'courses' };
}
