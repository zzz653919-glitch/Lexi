import { h, icon, get, post, patch, api, table, tag, formDialog, toast, iconBtn, confirmDialog, pager, qs, field, modal, ApiError } from '../common.js';

const POS = ['', 'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'phrasal verb', 'determiner', 'other'];
const CEFR = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default async function vocabulary({ query }) {
  const courses = (await get('/admin/courses')).items;
  const st = { q: query.get('q') || '', status: '', cefr: '', course_id: '', page: 1 };
  const selected = new Set();
  const holder = h('div', {});
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Search English or Uzbek…', 'aria-label': 'Search', value: st.q });
  const mk = (name, label, options) => h('select', { class: 'input', 'aria-label': label, onchange: (e) => { st[name] = e.target.value; st.page = 1; load(); } }, options.map((o) => h('option', { value: o.value }, o.label)));
  const bulk = h('div', { class: 'row', hidden: true });

  async function load() {
    const data = await get('/admin/vocabulary' + qs({ q: st.q, status: st.status, cefr: st.cefr, course_id: st.course_id, page: st.page, pageSize: 20 }));
    const rows = data.items;
    const allBox = h('input', { type: 'checkbox', 'aria-label': 'Select all on this page', onchange: (e) => { rows.forEach((r) => (e.target.checked ? selected.add(r.id) : selected.delete(r.id))); load(); } });
    holder.replaceChildren(table([
      { label: '', render: (r) => h('input', { type: 'checkbox', checked: selected.has(r.id), 'aria-label': `Select ${r.en}`, onchange: (e) => { e.target.checked ? selected.add(r.id) : selected.delete(r.id); showBulk(); } }) },
      { label: 'English', render: (r) => h('div', {}, h('b', {}, r.en), r.pos ? h('div', { class: 'muted small' }, r.pos) : null) }, { label: 'Uzbek', render: (r) => r.uz },
      { label: 'Example', render: (r) => h('span', { class: 'truncate muted' }, r.example || '—') }, { label: 'Level', render: (r) => r.cefr || '—' }, { label: 'Course', render: (r) => r.course_title || '—' }, { label: 'Status', render: (r) => tag(r.status) },
      { label: '', cls: 'acts', render: (r) => iconBtn('edit', `Edit ${r.en}`, () => edit(r)) },
    ], rows, { empty: 'No words match.' }), pager(data, (p) => { st.page = p; load(); }));
    showBulk();
  }
  function showBulk() {
    bulk.hidden = !selected.size;
    bulk.replaceChildren(h('span', { class: 'muted' }, `${selected.size} selected`), ...['published', 'draft', 'archived'].map((s) => h('button', { class: 'btn secondary small', onclick: async () => { await post('/admin/vocabulary/bulk-status', { ids: Array.from(selected), status: s }); toast(`${selected.size} words set to ${s}`, 'success'); selected.clear(); load(); } }, `Set ${s}`)));
  }
  const fieldsFor = (w = {}) => [
    { name: 'en', label: 'English word or phrase', value: w.en || '', required: true, maxlength: 120 }, { name: 'uz', label: 'Uzbek translation', value: w.uz || '', required: true, maxlength: 200 },
    { name: 'ru', label: 'Russian translation (optional)', value: (w.translations && w.translations.ru) || '', maxlength: 200 },
    { name: 'pos', label: 'Part of speech', type: 'select', value: w.pos || '', options: POS.map((p) => ({ value: p, label: p || '—' })) }, { name: 'cefr', label: 'Level', type: 'select', value: w.cefr || '', options: CEFR.map((p) => ({ value: p, label: p || '—' })) },
    { name: 'example', label: 'Example sentence', value: w.example || '', maxlength: 300 }, { name: 'example_uz', label: 'Example translation (Uzbek)', value: w.example_uz || '', maxlength: 300 },
    { name: 'course_id', label: 'Course', type: 'select', value: w.course_id || '', options: [{ value: '', label: '— none —' }].concat(courses.map((c) => ({ value: c.id, label: c.title }))) },
    { name: 'status', label: 'Status', type: 'select', value: w.status || 'published', options: ['published', 'draft', 'archived'].map((s) => ({ value: s, label: s })) },
  ];
  const toBody = (v, w) => { const t = { ...(w && w.translations ? w.translations : {}) }; if (v.ru.trim()) t.ru = v.ru.trim(); else delete t.ru; return { en: v.en, uz: v.uz, pos: v.pos, cefr: v.cefr, example: v.example, example_uz: v.example_uz, status: v.status, course_id: v.course_id === '' ? null : Number(v.course_id), translations: t }; };
  async function edit(w) {
    const audio = { url: w.audio_url || '' };
    const info = h('div', { class: 'muted small' }), file = h('input', { type: 'file', accept: '.mp3,.ogg,.wav,audio/*', 'aria-label': 'Upload pronunciation audio' });
    const show = () => info.replaceChildren(audio.url ? h('span', {}, h('audio', { controls: true, src: audio.url, style: { verticalAlign: 'middle', maxWidth: '100%' } }), ' ', h('button', { type: 'button', class: 'btn ghost small', onclick: () => { audio.url = ''; show(); } }, 'Remove')) : 'No pronunciation audio (the browser’s text-to-speech is used).');
    show();
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) return toast('Audio files may be at most 2 MB.', 'error'); try { const r = await api('POST', '/admin/uploads', await f.arrayBuffer(), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': f.name } }); audio.url = r.url; show(); } catch (e) { toast(e.message, 'error', 6000); } });
    const r = await formDialog({ title: `Edit “${w.en}”`, wide: true, fields: fieldsFor(w), extra: h('div', { class: 'field' }, h('span', { class: 'label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, 'Pronunciation audio'), file, info), save: (v) => patch('/admin/vocabulary/' + w.id, { ...toBody(v, w), audio_url: audio.url }) });
    if (r) { toast('Saved', 'success'); load(); }
  }
  async function add() { const r = await formDialog({ title: 'Add word', wide: true, fields: fieldsFor(), save: (v) => post('/admin/vocabulary', toBody(v)) }); if (r) { toast('Word added', 'success'); load(); } }
  async function importWords() {
    const fmt = field({ label: 'Format', name: 'format', type: 'select', options: [{ value: 'csv', label: 'CSV (en,uz,pos,cefr,example,example_uz,ru,status)' }, { value: 'json', label: 'JSON' }] });
    const course = field({ label: 'Add to course (optional)', name: 'courseId', type: 'select', options: [{ value: '', label: '— none —' }].concat(courses.map((c) => ({ value: c.id, label: c.title }))) });
    const text = field({ label: 'Content', name: 'content', type: 'textarea', rows: 8, hint: 'Header row: en,uz,pos,cefr,example,example_uz,ru,status. Duplicates are skipped.' });
    const file = h('input', { type: 'file', accept: '.csv,.json,text/csv,application/json', 'aria-label': 'Choose a file' });
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; if (f.size > 2000000) return toast('The file is larger than 2 MB.', 'error'); text.value = await f.text(); fmt.value = /\.json$/i.test(f.name) ? 'json' : 'csv'; });
    const out = h('div', {});
    const r = await formDialog({ title: 'Bulk import vocabulary', submitLabel: 'Import', wide: true, fields: [], extra: h('div', {}, fmt.el, course.el, h('div', { class: 'file-drop' }, file), text.el, out),
      save: async () => { out.replaceChildren(); try { return await post('/admin/vocabulary/import', { format: fmt.value, content: text.value, courseId: course.value ? Number(course.value) : null }); } catch (e) { if (e.data && e.data.problems) out.replaceChildren(h('div', { class: 'problems' }, e.message, h('ul', {}, e.data.problems.map((p) => h('li', {}, `Row ${p.row}: ${p.problems.join(' ')}`))))); throw e; } } });
    if (r) { toast(`${r.added} words added, ${r.skipped} skipped`, 'success', 5000); load(); }
  }
  let timer; q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = q.value.trim(); st.page = 1; load(); }, 300); });
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'Vocabulary'), h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: add }, icon('plus'), 'Add word'), h('button', { class: 'btn secondary small', onclick: importWords }, icon('upload'), 'Import'),
      h('a', { class: 'btn secondary small', href: '/api/admin/vocabulary/export?format=csv', download: '' }, icon('download'), 'CSV'), h('a', { class: 'btn secondary small', href: '/api/admin/vocabulary/export?format=json', download: '' }, 'JSON'))),
    h('div', { class: 'toolbar' }, q, mk('status', 'Status', [{ value: '', label: 'Any status' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]), mk('cefr', 'Level', [{ value: '', label: 'Any level' }].concat(CEFR.filter(Boolean).map((c) => ({ value: c, label: c })))), mk('course_id', 'Course', [{ value: '', label: 'Any course' }].concat(courses.map((c) => ({ value: c.id, label: c.title }))))),
    bulk, holder);
  await load();
  return { el, title: 'Vocabulary', nav: 'vocabulary' };
}
