import { loader } from '/js/loaders.js';
import { h, icon, get, post, patch, api, table, tag, formDialog, toast, iconBtn, confirmDialog, pager, qs, field, modal, ApiError, t } from '../common.js';

/* the real number of words in the pasted / chosen content (JSON array or CSV rows without the header) */
function countRows(format, content) {
  const text = String(content || '');
  if (format === 'json') { try { const j = JSON.parse(text); const a = Array.isArray(j) ? j : j && j.items; return Array.isArray(a) ? a.length : 0; } catch (_) { return 0; } }
  let rows = 0, inQ = false, has = false;
  for (const ch of text) {
    if (ch === '"') { inQ = !inQ; has = true; }
    else if (ch === '\n' && !inQ) { if (has) rows++; has = false; }
    else if (ch !== '\r') has = true;
  }
  if (has) rows++;
  return Math.max(0, rows - 1);
}

const POS = ['', 'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'phrasal verb', 'determiner', 'other'];
const CEFR = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default async function vocabulary({ query }) {
  const courses = (await get('/admin/courses')).items;
  const st = { q: query.get('q') || '', status: '', cefr: '', course_id: '', page: 1 };
  const selected = new Set();
  const holder = h('div', {});
  const q = h('input', { class: 'input', type: 'search', placeholder: t('adm.vocab_search_ph'), 'aria-label': t('adm.search'), value: st.q });
  const mk = (name, label, options) => h('select', { class: 'input', 'aria-label': label, onchange: (e) => { st[name] = e.target.value; st.page = 1; load(); } }, options.map((o) => h('option', { value: o.value }, o.label)));
  const bulk = h('div', { class: 'row', hidden: true });

  async function load() {
    const data = await get('/admin/vocabulary' + qs({ q: st.q, status: st.status, cefr: st.cefr, course_id: st.course_id, page: st.page, pageSize: 20 }));
    const rows = data.items;
    const allBox = h('input', { type: 'checkbox', 'aria-label': t('adm.select_all'), onchange: (e) => { rows.forEach((r) => (e.target.checked ? selected.add(r.id) : selected.delete(r.id))); load(); } });
    holder.replaceChildren(table([
      { label: '', render: (r) => h('input', { type: 'checkbox', checked: selected.has(r.id), 'aria-label': t('adm.select_word', { word: r.en }), onchange: (e) => { e.target.checked ? selected.add(r.id) : selected.delete(r.id); showBulk(); } }) },
      { label: t('adm.col.english'), render: (r) => h('div', {}, h('b', {}, r.en), r.pos ? h('div', { class: 'muted small' }, r.pos) : null) }, { label: t('adm.col.uzbek'), render: (r) => r.uz }, { label: t('adm.col.russian'), render: (r) => (r.translations && r.translations.ru) || '—' },
      { label: t('adm.col.example'), render: (r) => h('span', { class: 'truncate muted' }, r.example || '—') }, { label: t('adm.col.level'), render: (r) => r.cefr || '—' }, { label: t('adm.col.course'), render: (r) => r.course_title || '—' }, { label: t('adm.col.status'), render: (r) => tag(r.status) },
      { label: '', cls: 'acts', render: (r) => iconBtn('edit', t('adm.edit_word', { word: r.en }), () => edit(r)) },
    ], rows, { empty: t('adm.no_words') }), pager(data, (p) => { st.page = p; load(); }));
    showBulk();
  }
  function showBulk() {
    bulk.hidden = !selected.size;
    bulk.replaceChildren(h('span', { class: 'muted' }, t('adm.n_selected', { n: selected.size })), ...['published', 'draft', 'archived'].map((s) => h('button', { class: 'btn secondary small', onclick: async () => { await post('/admin/vocabulary/bulk-status', { ids: Array.from(selected), status: s }); toast(t('adm.words_set', { n: selected.size, status: t('adm.status.' + s) }), 'success'); selected.clear(); load(); } }, t('adm.set_status', { status: t('adm.status.' + s) }))));
  }
  const fieldsFor = (w = {}) => [
    { name: 'en', label: t('adm.f.word_en'), value: w.en || '', required: true, maxlength: 120 }, { name: 'uz', label: t('adm.f.word_uz'), value: w.uz || '', required: true, maxlength: 200 },
    { name: 'ru', label: t('adm.f.word_ru'), value: (w.translations && w.translations.ru) || '', maxlength: 200 },
    { name: 'pos', label: t('adm.f.pos'), type: 'select', value: w.pos || '', options: POS.map((p) => ({ value: p, label: p ? t('adm.pos.' + p.replace(' ', '_')) : '—' })) }, { name: 'cefr', label: t('adm.col.level'), type: 'select', value: w.cefr || '', options: CEFR.map((p) => ({ value: p, label: p || '—' })) },
    { name: 'example', label: t('adm.f.example'), value: w.example || '', maxlength: 300 }, { name: 'example_uz', label: t('adm.f.example_uz'), value: w.example_uz || '', maxlength: 300 },
    { name: 'ru_example', label: t('adm.f.example_ru'), value: (w.translations && w.translations.ru_example) || '', maxlength: 300 },
    { name: 'course_id', label: t('adm.col.course'), type: 'select', value: w.course_id || '', options: [{ value: '', label: t('adm.none') }].concat(courses.map((c) => ({ value: c.id, label: c.title }))) },
    { name: 'status', label: t('adm.col.status'), type: 'select', value: w.status || 'published', options: ['published', 'draft', 'archived'].map((s) => ({ value: s, label: t('adm.status.' + s) })) },
  ];
  const toBody = (v, w) => { const tr = { ...(w && w.translations ? w.translations : {}) }; if (v.ru.trim()) tr.ru = v.ru.trim(); else delete tr.ru; if (v.ru_example.trim()) tr.ru_example = v.ru_example.trim(); else delete tr.ru_example; return { en: v.en, uz: v.uz, pos: v.pos, cefr: v.cefr, example: v.example, example_uz: v.example_uz, status: v.status, course_id: v.course_id === '' ? null : Number(v.course_id), translations: tr }; };
  async function edit(w) {
    const audio = { url: w.audio_url || '' };
    const info = h('div', { class: 'muted small' }), file = h('input', { type: 'file', accept: '.mp3,.ogg,.wav,audio/*', 'aria-label': t('adm.upload_pron') });
    const show = () => info.replaceChildren(audio.url ? h('span', {}, h('audio', { controls: true, src: audio.url, style: { verticalAlign: 'middle', maxWidth: '100%' } }), ' ', h('button', { type: 'button', class: 'btn ghost small', onclick: () => { audio.url = ''; show(); } }, t('adm.remove'))) : t('adm.no_pron'));
    show();
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) return toast(t('err.upload_too_large'), 'error'); try { const r = await api('POST', '/admin/uploads', await f.arrayBuffer(), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': f.name } }); audio.url = r.url; show(); } catch (e) { toast(e.message, 'error', 6000); } });
    const r = await formDialog({ title: t('adm.edit_word_title', { word: w.en }), wide: true, fields: fieldsFor(w), extra: h('div', { class: 'field' }, h('span', { class: 'label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, t('adm.pron_audio')), file, info), save: (v) => patch('/admin/vocabulary/' + w.id, { ...toBody(v, w), audio_url: audio.url }) });
    if (r) { toast(t('common.saved'), 'success'); load(); }
  }
  async function add() { const r = await formDialog({ title: t('adm.add_word'), wide: true, fields: fieldsFor(), save: (v) => post('/admin/vocabulary', toBody(v)) }); if (r) { toast(t('adm.word_added'), 'success'); load(); } }
  async function importWords() {
    const fmtF = field({ label: t('adm.f.format'), name: 'format', type: 'select', options: [{ value: 'csv', label: 'CSV (en,uz,pos,cefr,example,example_uz,ru,status)' }, { value: 'json', label: 'JSON' }] });
    const course = field({ label: t('adm.f.add_to_course'), name: 'courseId', type: 'select', options: [{ value: '', label: t('adm.none') }].concat(courses.map((c) => ({ value: c.id, label: c.title }))) });
    const text = field({ label: t('adm.f.content'), name: 'content', type: 'textarea', rows: 8, hint: t('adm.import_hint_vocab') });
    const file = h('input', { type: 'file', accept: '.csv,.json,text/csv,application/json', 'aria-label': t('adm.choose_file') });
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; if (f.size > 2000000) return toast(t('adm.file_too_large', { mb: 2 }), 'error'); text.value = await f.text(); fmtF.value = /\.json$/i.test(f.name) ? 'json' : 'csv'; });
    const out = h('div', {});
    const r = await formDialog({ title: t('adm.import_vocab'), submitLabel: t('adm.import'), wide: true, fields: [], extra: h('div', {}, fmtF.el, course.el, h('div', { class: 'file-drop' }, file), text.el, out),
      save: async () => { out.replaceChildren(loader('import', { count: countRows(fmtF.value, text.value), slowAfter: 0 })); try { return await post('/admin/vocabulary/import', { format: fmtF.value, content: text.value, courseId: course.value ? Number(course.value) : null }); } catch (e) { out.replaceChildren(); if (e.data && e.data.problems) out.replaceChildren(h('div', { class: 'problems' }, e.message, h('ul', {}, e.data.problems.map((p) => h('li', {}, t('adm.row_problems', { row: p.row, problems: p.problems.join(' ') })))))); throw e; } } });
    if (r) { toast(t('adm.import_result', { added: r.added, skipped: r.skipped }), 'success', 5000); load(); }
  }
  let timer; q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = q.value.trim(); st.page = 1; load(); }, 300); });
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.vocabulary')), h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: add }, icon('plus'), t('adm.add_word')), h('button', { class: 'btn secondary small', onclick: importWords }, icon('upload'), t('adm.import')),
      h('a', { class: 'btn secondary small', href: '/api/admin/vocabulary/export?format=csv', download: '' }, icon('download'), 'CSV'), h('a', { class: 'btn secondary small', href: '/api/admin/vocabulary/export?format=json', download: '' }, 'JSON'))),
    h('div', { class: 'toolbar' }, q, mk('status', t('adm.col.status'), [{ value: '', label: t('adm.any_status') }, { value: 'published', label: t('adm.status.published') }, { value: 'draft', label: t('adm.status.draft') }, { value: 'archived', label: t('adm.status.archived') }]), mk('cefr', t('adm.col.level'), [{ value: '', label: t('adm.any_level') }].concat(CEFR.filter(Boolean).map((c) => ({ value: c, label: c })))), mk('course_id', t('adm.col.course'), [{ value: '', label: t('adm.any_course') }].concat(courses.map((c) => ({ value: c.id, label: c.title }))))),
    bulk, holder);
  await load();
  return { el, title: t('adm.nav.vocabulary'), nav: 'vocabulary' };
}
