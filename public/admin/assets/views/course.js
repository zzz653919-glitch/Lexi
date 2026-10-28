import { h, icon, get, post, patch, del, table, tag, formDialog, toast, crumbs, iconBtn, confirmDialog, typedConfirm, session, t, n, fmt, trFields, withTr } from '../common.js';
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
  const unlockOptions = () => [{ value: 'sequential', label: t('adm.unlock.sequential') }, { value: 'open', label: t('adm.unlock.open') }];
  const trackOptions = () => [{ value: 'general', label: t('adm.track.general_full') }, { value: 'ielts', label: t('adm.track.ielts_full') }];

  function draw(d) {
    const c = d.course;
    const setStatus = async (status) => {
      if (status === 'archived' && !(await confirmDialog(t('adm.archive_title'), t('adm.archive_text'), t('adm.archive'), true))) return;
      try { await post(`/admin/courses/${id}/status`, { status }); toast(t('adm.course_status_' + status), 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); }
    };
    const editCourse = async () => { const r = await formDialog({ title: t('adm.edit_course'), wide: true, fields: [{ name: 'title', label: t('adm.f.title'), value: c.title, required: true }, { name: 'slug', label: t('adm.f.slug'), value: c.slug }, { name: 'description', label: t('adm.f.description'), type: 'textarea', value: c.description },
      { name: 'track', label: t('adm.f.track'), type: 'select', value: c.track, options: trackOptions() }, ...trFields(c)], save: (v) => patch('/admin/courses/' + id, withTr(v)) }); if (r) load(); };
    const addLevel = async () => {
      const r = await formDialog({ title: t('adm.add_level'), wide: true, fields: [{ name: 'code', label: t('adm.f.level_code'), type: 'select', options: ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS'].filter((x) => !d.levels.some((l) => l.code === x)).map((x) => ({ value: x, label: x })), hint: t('adm.level_code_hint') }, { name: 'title', label: t('adm.f.title'), required: true },
        { name: 'description', label: t('adm.f.description'), type: 'textarea' }, { name: 'unlock_rule', label: t('adm.f.unlock_rule'), type: 'select', options: unlockOptions() }, { name: 'unlock_threshold_pct', label: t('adm.f.unlock_pct'), type: 'number', value: 60, min: 0, max: 100 }, ...trFields({})],
        save: (v) => post(`/admin/courses/${id}/levels`, { ...withTr(v), unlock_threshold_pct: Number(v.unlock_threshold_pct) }) }); if (r) load();
    };
    const editLevel = async (lv) => { const r = await formDialog({ title: t('adm.edit_level', { code: lv.code }), wide: true, fields: [{ name: 'title', label: t('adm.f.title'), value: lv.title, required: true }, { name: 'description', label: t('adm.f.description'), type: 'textarea', value: lv.description },
      { name: 'unlock_rule', label: t('adm.f.unlock_rule'), type: 'select', value: lv.unlock_rule, options: unlockOptions() }, { name: 'unlock_threshold_pct', label: t('adm.f.unlock_pct'), type: 'number', value: lv.unlock_threshold_pct, min: 0, max: 100 }, ...trFields(lv)],
      save: (v) => patch('/admin/levels/' + lv.id, { ...withTr(v), unlock_threshold_pct: Number(v.unlock_threshold_pct) }) }); if (r) load(); };
    const delLevel = async (lv) => { if (await confirmDialog(t('adm.delete_level_title'), t('adm.delete_level_text', { code: lv.code }), t('adm.delete_level'), true)) { await del('/admin/levels/' + lv.id, { confirm: true }); toast(t('adm.level_deleted'), 'success'); load(); } };
    const addUnit = async (lv) => { const r = await formDialog({ title: t('adm.add_unit', { code: lv.code }), wide: true, fields: [{ name: 'title', label: t('adm.f.title'), required: true }, { name: 'description', label: t('adm.f.description'), type: 'textarea' }, ...trFields({})], save: (v) => post(`/admin/levels/${lv.id}/units`, withTr(v)) }); if (r) load(); };
    const editUnit = async (u) => { const r = await formDialog({ title: t('adm.edit_unit'), wide: true, fields: [{ name: 'title', label: t('adm.f.title'), value: u.title, required: true }, { name: 'description', label: t('adm.f.description'), type: 'textarea', value: u.description }, ...trFields(u)], save: (v) => patch('/admin/units/' + u.id, withTr(v)) }); if (r) load(); };
    const delUnit = async (u) => { if (await confirmDialog(t('adm.delete_unit_title'), t('adm.delete_unit_text', { title: u.title }), t('adm.delete_unit'), true)) { await del('/admin/units/' + u.id, { confirm: true }); load(); } };
    const addLesson = async (u) => { const r = await formDialog({ title: t('adm.add_lesson'), wide: true, fields: [{ name: 'title', label: t('adm.f.title'), required: true }, { name: 'description', label: t('adm.f.description'), type: 'textarea' }, { name: 'xp_reward', label: t('adm.f.xp_reward'), type: 'number', value: 20, min: 0, max: 500 }, ...trFields({})], save: (v) => post(`/admin/units/${u.id}/lessons`, { ...withTr(v), xp_reward: Number(v.xp_reward) }) }); if (r) navigate('/admin/lessons/' + r.id); };
    const dupLesson = async (l) => { await post(`/admin/lessons/${l.id}/duplicate`); toast(t('adm.lesson_duplicated'), 'success'); load(); };
    const delLesson = async (l) => { if (await confirmDialog(t('adm.delete_lesson_title'), t('adm.delete_lesson_text', { title: l.title, n: n('count.exercises', l.exercises) }), t('adm.delete_lesson'), true)) { await del('/admin/lessons/' + l.id, { confirm: true }); toast(t('adm.lesson_deleted'), 'success'); load(); } };

    const levels = d.levels.map((lv, li) => h('section', { class: 'tree-level', 'aria-label': t('adm.level_label', { code: lv.code }) },
      h('header', {}, h('div', {}, h('b', { style: { fontSize: '1.1rem' } }, `${lv.code} — ${lv.title}`), h('div', { class: 'muted small' }, lv.unlock_rule === 'open' ? t('adm.unlock.open') : t('adm.opens_at', { pct: lv.unlock_threshold_pct }))),
        h('div', { class: 'row' }, iconBtn('up', t('adm.level_up'), () => move(d.levels, li, -1, 'level', id)), iconBtn('down', t('adm.level_down'), () => move(d.levels, li, 1, 'level', id)), iconBtn('edit', t('adm.edit_level_btn'), () => editLevel(lv)), h('button', { class: 'btn small secondary', onclick: () => addUnit(lv) }, icon('plus'), t('adm.unit')), iconBtn('trash', t('adm.delete_level'), () => delLevel(lv), 'danger'))),
      lv.units.length ? lv.units.map((u, ui) => h('div', { class: 'tree-unit' },
        h('header', {}, h('div', {}, h('b', {}, u.title), u.description ? h('div', { class: 'muted small' }, u.description) : null), h('div', { class: 'row' }, iconBtn('up', t('adm.unit_up'), () => move(lv.units, ui, -1, 'unit', lv.id)), iconBtn('down', t('adm.unit_down'), () => move(lv.units, ui, 1, 'unit', lv.id)), iconBtn('edit', t('adm.edit_unit'), () => editUnit(u)), h('button', { class: 'btn small secondary', onclick: () => addLesson(u) }, icon('plus'), t('adm.lesson')), iconBtn('trash', t('adm.delete_unit'), () => delUnit(u), 'danger'))),
        u.lessons.length ? u.lessons.map((l, i) => h('div', { class: 'lesson-row' }, h('div', { class: 't' }, h('a', { href: '/admin/lessons/' + l.id }, l.title), ' ', tag(l.status), h('span', { class: 'muted small' }, ` · ${t('adm.lesson_meta', { done: l.published_exercises, total: l.exercises })} · ${t('adm.unlock.' + l.unlock_rule)}`)),
          h('div', { class: 'row' }, iconBtn('up', t('adm.lesson_up'), () => move(u.lessons, i, -1, 'lesson', u.id)), iconBtn('down', t('adm.lesson_down'), () => move(u.lessons, i, 1, 'lesson', u.id)), h('a', { class: 'btn small secondary', href: '/admin/lessons/' + l.id }, t('adm.edit')), iconBtn('copy', t('adm.duplicate_lesson'), () => dupLesson(l)), iconBtn('trash', t('adm.delete_lesson'), () => delLesson(l), 'danger')))) : h('p', { class: 'muted small' }, t('adm.no_lessons')))) : h('div', { class: 'tree-unit muted' }, t('adm.no_units'))));

    holder.replaceChildren(
      crumbs({ href: '/admin/courses', label: t('adm.nav.courses') }, { label: c.title }),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, c.title), h('div', { class: 'row' }, tag(c.status), h('span', { class: 'muted small' }, c.track === 'ielts' ? t('adm.track.ielts') : t('adm.track.general')))),
        h('div', { class: 'row' }, h('button', { class: 'btn secondary small', onclick: editCourse }, icon('edit'), t('adm.edit')), c.status !== 'published' ? h('button', { class: 'btn small', onclick: () => setStatus('published') }, t('adm.publish')) : h('button', { class: 'btn secondary small', onclick: () => setStatus('draft') }, t('adm.unpublish')),
          c.status !== 'archived' ? h('button', { class: 'btn secondary small', onclick: () => setStatus('archived') }, t('adm.archive')) : null, h('a', { class: 'btn secondary small', href: `/api/admin/courses/${id}/export`, download: '' }, icon('download'), t('adm.export_json')),
          isAdmin() && c.status !== 'published' ? h('button', { class: 'btn danger small', onclick: async () => { if (await typedConfirm(t('adm.delete_course_title'), t('adm.delete_course_text', { title: c.title }), c.title, t('adm.delete_course'))) { await del('/admin/courses/' + id, { confirm: true, title: c.title }); toast(t('adm.course_deleted'), 'success'); navigate('/admin/courses'); } } }, icon('trash'), t('common.delete')) : null)),
      c.description ? h('p', { class: 'muted' }, c.description) : null,
      c.track === 'ielts' ? h('div', { class: 'notice' }, t('adm.ielts_notice')) : null,
      h('div', { class: 'row between', style: { margin: '10px 0' } }, h('h2', { style: { margin: 0 } }, t('adm.tree_title')), h('button', { class: 'btn small', onclick: addLevel }, icon('plus'), t('adm.add_level'))),
      ...levels);
  }
  await load();
  return { el: holder, title: t('adm.course'), nav: 'courses' };
}
