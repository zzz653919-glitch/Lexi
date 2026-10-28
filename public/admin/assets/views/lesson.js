import { h, icon, get, post, put, patch, del, api, table, tag, formDialog, toast, crumbs, iconBtn, confirmDialog, modal, field, wireForm, formErrorBox, ApiError, qs, t, has, trFields, withTr, trOf } from '../common.js';
import { RENDERERS } from '/js/views/exercises.js';
import { navigate } from '../admin.js';

const TYPE_IDS = [];
const typeLabel = (id) => t('ex.type.' + id);

export default async function lesson({ params }) {
  const id = Number(params.id);
  const [types, vocab] = await Promise.all([get('/admin/exercise-types'), get('/admin/vocabulary' + qs({ lesson_id: id, pageSize: 100 }))]);
  TYPE_IDS.length = 0; types.types.forEach((x) => TYPE_IDS.push(x.id));
  const holder = h('div', {});

  async function load() { draw(await get('/admin/lessons/' + id)); }

  function draw(d) {
    const l = d.lesson;
    const rows = d.exercises;
    const setStatus = async (status) => { try { await post(`/admin/lessons/${id}/status`, { status }); toast(t('adm.lesson_status_' + status), 'success'); load(); } catch (e) { toast(e.message, 'error', 8000); } };
    const editLesson = async () => {
      const r = await formDialog({ title: t('adm.lesson_settings'), wide: true, fields: [
        { name: 'title', label: t('adm.f.title'), value: l.title, required: true }, { name: 'description', label: t('adm.f.description'), type: 'textarea', value: l.description }, { name: 'xp_reward', label: t('adm.f.xp_reward'), type: 'number', value: l.xp_reward, min: 0, max: 500 },
        { name: 'unlock_rule', label: t('adm.f.unlock_rule'), type: 'select', value: l.unlock_rule, options: [{ value: 'sequential', label: t('adm.unlock_long.sequential') }, { value: 'open', label: t('adm.unlock_long.open') }, { value: 'prerequisite', label: t('adm.unlock_long.prerequisite') }] },
        { name: 'prerequisite_lesson_id', label: t('adm.f.prerequisite'), type: 'select', value: l.prerequisite_lesson_id || '', options: [{ value: '', label: t('adm.none') }].concat(d.siblings.map((s) => ({ value: s.id, label: s.title }))) }, ...trFields(l)],
        save: (v) => patch('/admin/lessons/' + id, { ...withTr(v), xp_reward: Number(v.xp_reward), prerequisite_lesson_id: v.prerequisite_lesson_id === '' ? null : Number(v.prerequisite_lesson_id) }) });
      if (r) load();
    };
    const move = async (i, dir) => { const ids = rows.map((x) => x.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await post(`/admin/lessons/${id}/exercises/reorder`, { ids }); load(); };
    const dup = async (e) => { await post(`/admin/exercises/${e.id}/duplicate`); toast(t('adm.exercise_duplicated'), 'success'); load(); };
    const delEx = async (e) => { if (await confirmDialog(t('adm.delete_exercise_title'), t('adm.cannot_undo'), t('common.delete'), true)) { await del('/admin/exercises/' + e.id, { confirm: true }); load(); } };
    const edit = async (exId) => { const saved = await exerciseDialog(id, exId, vocab.items); if (saved) load(); };

    holder.replaceChildren(
      h('div', { 'data-crumb': '' }, crumbs({ href: '/admin/courses', label: t('adm.nav.courses') }, { href: '/admin/courses/' + d.courseId, label: d.courseTitle }, { label: l.title })),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, l.title), h('div', { class: 'row' }, tag(l.status), h('span', { class: 'muted small' }, t('adm.lesson_head_meta', { xp: l.xp_reward, rule: t('adm.unlock.' + l.unlock_rule) })))),
        h('div', { class: 'row' }, h('button', { class: 'btn secondary small', onclick: editLesson }, icon('edit'), t('adm.settings')), l.status !== 'published' ? h('button', { class: 'btn small', onclick: () => setStatus('published') }, t('adm.publish')) : h('button', { class: 'btn secondary small', onclick: () => setStatus('draft') }, t('adm.unpublish')), l.status !== 'archived' ? h('button', { class: 'btn secondary small', onclick: () => setStatus('archived') }, t('adm.archive')) : null)),
      l.description ? h('p', { class: 'muted' }, l.description) : null,
      h('div', { class: 'row between', style: { margin: '10px 0' } }, h('h2', { style: { margin: 0 } }, t('adm.exercises_count', { n: rows.length })),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => edit(null) }, icon('plus'), t('adm.add_exercise')), h('button', { class: 'btn secondary small', onclick: () => importDialog(id).then((n) => n && load()) }, icon('upload'), t('adm.import')),
          h('a', { class: 'btn secondary small', href: `/api/admin/lessons/${id}/export?format=json`, download: '' }, icon('download'), 'JSON'), h('a', { class: 'btn secondary small', href: `/api/admin/lessons/${id}/export?format=csv`, download: '' }, 'CSV'))),
      table([
        { label: '#', render: (e) => String(rows.indexOf(e) + 1) }, { label: t('adm.col.type'), render: (e) => typeLabel(e.type) },
        { label: t('adm.col.question'), render: (e) => h('span', { class: 'truncate' }, e.prompt || e.sentence || '—') }, { label: t('adm.col.status'), render: (e) => tag(e.status) },
        { label: '', cls: 'acts', render: (e) => h('div', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'flex-end' } }, iconBtn('up', t('adm.move_up'), () => move(rows.indexOf(e), -1)), iconBtn('down', t('adm.move_down'), () => move(rows.indexOf(e), 1)), iconBtn('eye', t('adm.preview_as_learner'), () => previewDialog(e.id)), iconBtn('edit', t('adm.edit_exercise'), () => edit(e.id)), iconBtn('copy', t('adm.duplicate'), () => dup(e)), iconBtn('trash', t('common.delete'), () => delEx(e), 'danger')) },
      ], rows, { empty: t('adm.no_exercises') }));
  }
  await load();
  return { el: holder, title: t('adm.lesson'), nav: 'courses' };
}

/* ---------- preview exactly as a learner sees it ---------- */
export async function previewDialog(exerciseId) {
  const { exercise, problems } = await get(`/admin/exercises/${exerciseId}/preview`);
  const box = h('div', { class: 'preview-box' });
  const fb = h('div', { class: 'lesson-foot', hidden: true });
  const check = h('button', { class: 'btn', type: 'button', disabled: true }, t('lesson.check'));
  let cur;
  cur = RENDERERS[exercise.type](exercise, { changed: (ok) => { check.disabled = !ok; }, submit: () => check.click() });
  check.addEventListener('click', async () => {
    const a = cur.answer(); if (a == null) return;
    try { const r = await post(`/admin/exercises/${exerciseId}/preview-check`, { answer: a }); cur.lock(); cur.reveal(r);
      fb.hidden = false; fb.className = 'lesson-foot ' + (r.correct ? 'good' : 'bad'); fb.replaceChildren(h('div', { class: 'feedback' }, h('b', {}, r.correct ? t('lesson.correct') : t('lesson.incorrect')), !r.correct ? h('p', {}, t('lesson.correct_answer') + ' ', h('span', { class: 'correct-answer' }, r.correctAnswer)) : null, r.explanation ? h('p', {}, r.explanation) : null)); check.disabled = true;
    } catch (e) { toast(e.message, 'error'); }
  });
  box.append(cur.el, fb);
  await modal({ title: t('adm.learner_preview'), content: h('div', {}, problems.length ? h('div', { class: 'problems' }, t('adm.exercise_problems') + ' ', h('ul', {}, problems.map((p) => h('li', {}, t(p.message, p.params))))) : null, box, h('p', { class: 'muted small' }, t('adm.preview_note')), check), actions: [{ label: t('common.close'), value: true, kind: 'secondary' }] });
}

/* ---------- import dialog ---------- */
async function importDialog(lessonId) {
  const fmt = field({ label: t('adm.f.format'), name: 'format', type: 'select', options: [{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }] });
  const text = field({ label: t('adm.f.content'), name: 'content', type: 'textarea', rows: 8, hint: t('adm.import_hint_exercises') });
  const file = h('input', { type: 'file', accept: '.json,.csv,text/csv,application/json', 'aria-label': t('adm.choose_file') });
  file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; if (f.size > 1000000) return toast(t('adm.file_too_large', { mb: 1 }), 'error'); text.value = await f.text(); fmt.value = /\.csv$/i.test(f.name) ? 'csv' : 'json'; });
  const out = h('div', {});
  return formDialog({ title: t('adm.import_exercises'), submitLabel: t('adm.import'), wide: true, fields: [], extra: h('div', {}, fmt.el, h('div', { class: 'file-drop' }, file), text.el, out),
    save: async () => {
      out.replaceChildren();
      try { const r = await post(`/admin/lessons/${lessonId}/import`, { format: fmt.value, content: text.value }); toast(t('adm.exercises_imported', { n: r.imported }), 'success'); return r.imported; }
      catch (e) { if (e.data && e.data.problems) out.replaceChildren(h('div', { class: 'problems' }, e.message, h('ul', {}, e.data.problems.map((p) => h('li', {}, t('adm.row_problems', { row: p.row, problems: p.problems.join(' ') })))))); throw e; }
    } });
}

/* ---------- exercise editor ---------- */
const CHOICE = ['multiple_choice', 'translation_choice', 'listen_choice', 'reading'];
async function exerciseDialog(lessonId, exerciseId, vocabItems) {
  const ex = exerciseId ? await get('/admin/exercises/' + exerciseId) : { type: 'multiple_choice', prompt: '', answer: '', sentence: '', passage: '', audio_text: '', audio_url: '', translation: '', explanation: '', hint: '', direction: 'en-uz', translations: {}, difficulty: 1, status: 'published', vocabulary_id: null, options: [] };
  const state = { options: ex.options.length ? ex.options.map((o) => ({ ...o })) : [], audio_url: ex.audio_url };
  const type = field({ label: t('adm.f.exercise_type'), name: 'type', type: 'select', value: ex.type, options: TYPE_IDS.map((id) => ({ value: id, label: typeLabel(id) })) });
  const common = {
    prompt: field({ label: t('adm.ex.prompt'), name: 'prompt', hint: t('adm.ex.prompt_hint'), value: ex.prompt, maxlength: 300 }),
    sentence: field({ label: t('adm.ex.sentence'), name: 'sentence', value: ex.sentence, maxlength: 400 }),
    passage: field({ label: t('adm.ex.passage'), name: 'passage', type: 'textarea', rows: 5, value: ex.passage }),
    answer: field({ label: t('adm.ex.answer'), name: 'answer', type: 'textarea', rows: 2, value: (ex.answer || '').split('|').join('\n'), hint: t('adm.ex.answer_hint') }),
    audio_text: field({ label: t('adm.ex.audio_text'), name: 'audio_text', value: ex.audio_text, hint: t('adm.ex.audio_text_hint') }),
    direction: field({ label: t('adm.ex.direction'), name: 'direction', type: 'select', value: ex.direction, options: [{ value: 'en-uz', label: t('adm.ex.dir_to_tr') }, { value: 'uz-en', label: t('adm.ex.dir_to_en') }] }),
    translation: field({ label: t('adm.ex.translation'), name: 'translation', value: ex.translation }),
    explanation: field({ label: t('adm.ex.explanation'), name: 'explanation', type: 'textarea', rows: 2, value: ex.explanation }),
    hint: field({ label: t('adm.ex.hint'), name: 'hint', value: ex.hint }),
    difficulty: field({ label: t('adm.ex.difficulty'), name: 'difficulty', type: 'number', value: ex.difficulty, min: 1, max: 5 }),
    status: field({ label: t('adm.col.status'), name: 'status', type: 'select', value: ex.status, options: [{ value: 'published', label: t('adm.status.published') }, { value: 'draft', label: t('adm.ex.draft_hidden') }] }),
    vocabulary_id: field({ label: t('adm.ex.vocab'), name: 'vocabulary_id', type: 'select', value: ex.vocabulary_id || '', options: [{ value: '', label: t('adm.none') }].concat(vocabItems.map((v) => ({ value: v.id, label: `${v.en} — ${v.uz}` }))), hint: t('adm.ex.vocab_hint') }),
  };
  const optionsBox = h('div', {}), typeBox = h('div', {});
  const audioInfo = h('div', { class: 'muted small' });
  const audioFile = h('input', { type: 'file', accept: '.mp3,.ogg,.wav,audio/*', 'aria-label': t('adm.upload_audio') });
  audioFile.addEventListener('change', async () => {
    const f = audioFile.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast(t('err.upload_too_large'), 'error');
    try { const buf = await f.arrayBuffer(); const r = await api('POST', '/admin/uploads', buf, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': f.name } }); state.audio_url = r.url; showAudio(); toast(t('adm.audio_uploaded'), 'success'); } catch (e) { toast(e.message, 'error', 6000); }
  });
  const showAudio = () => { audioInfo.replaceChildren(state.audio_url ? h('span', {}, t('adm.uploaded_audio') + ' ', h('audio', { controls: true, src: state.audio_url, style: { verticalAlign: 'middle', maxWidth: '100%' } }), ' ', h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.audio_url = ''; showAudio(); } }, t('adm.remove'))) : t('adm.no_uploaded_audio')); };

  function drawOptions(kind) {
    optionsBox.replaceChildren();
    if (CHOICE.includes(kind)) {
      if (state.options.length < 2) while (state.options.length < 3) state.options.push({ text: '', match_text: '', is_correct: state.options.length === 0 });
      state.options.forEach((o, i) => optionsBox.append(h('div', { class: 'opt-row' },
        h('input', { type: 'radio', name: 'correct', checked: !!o.is_correct, 'aria-label': t('adm.ex.option_correct', { n: i + 1 }), onchange: () => state.options.forEach((x, k) => { x.is_correct = k === i; }) }),
        h('input', { class: 'input', value: o.text, 'aria-label': t('adm.ex.option_text', { n: i + 1 }), maxlength: 200, oninput: (e) => { o.text = e.target.value; } }),
        h('button', { type: 'button', class: 'btn icon secondary', 'aria-label': t('adm.ex.remove_option'), onclick: () => { state.options.splice(i, 1); drawOptions(kind); } }, icon('x')))));
      optionsBox.append(h('p', { class: 'muted small' }, t('adm.ex.option_hint')), state.options.length < 6 ? h('button', { type: 'button', class: 'btn secondary small', onclick: () => { state.options.push({ text: '', match_text: '', is_correct: false }); drawOptions(kind); } }, icon('plus'), t('adm.ex.add_option')) : null);
    } else if (kind === 'match_pairs') {
      if (state.options.length < 3) while (state.options.length < 4) state.options.push({ text: '', match_text: '', is_correct: true });
      state.options.forEach((o, i) => optionsBox.append(h('div', { class: 'opt-row pair' },
        h('input', { class: 'input', value: o.text, placeholder: t('adm.ex.pair_en'), 'aria-label': t('adm.ex.pair_en_label', { n: i + 1 }), oninput: (e) => { o.text = e.target.value; o.is_correct = true; } }),
        h('input', { class: 'input', value: o.match_text, placeholder: t('adm.ex.pair_tr'), 'aria-label': t('adm.ex.pair_tr_label', { n: i + 1 }), oninput: (e) => { o.match_text = e.target.value; } }),
        h('button', { type: 'button', class: 'btn icon secondary', 'aria-label': t('adm.ex.remove_pair'), onclick: () => { state.options.splice(i, 1); drawOptions(kind); } }, icon('x')))));
      optionsBox.append(state.options.length < 6 ? h('button', { type: 'button', class: 'btn secondary small', onclick: () => { state.options.push({ text: '', match_text: '', is_correct: true }); drawOptions(kind); } }, icon('plus'), t('adm.ex.add_pair')) : null);
    } else if (kind === 'order_words') {
      const extra = state.options.map((o) => o.text).join(', ');
      optionsBox.append(h('label', { class: 'field' }, h('span', { class: 'label' }, t('adm.ex.distractors')), h('input', { class: 'input', value: extra, oninput: (e) => { state.options = e.target.value.split(',').map((x) => x.trim()).filter(Boolean).map((text) => ({ text, match_text: '', is_correct: false })); } })));
    }
  }
  function drawType() {
    const kind = type.value;
    const f = common, parts = [];
    const need = { multiple_choice: ['prompt'], translation_choice: ['prompt', 'sentence'], reading: ['passage', 'prompt'], listen_choice: ['prompt', 'audio_text'], listen_type: ['prompt', 'audio_text', 'answer'], fill_blank: ['prompt', 'sentence', 'answer', 'translation'], translate_type: ['prompt', 'sentence', 'direction', 'answer'], scramble_letters: ['prompt', 'sentence', 'answer'], order_words: ['prompt', 'sentence', 'answer'], match_pairs: ['prompt'], fix_spelling: ['prompt', 'sentence', 'answer', 'translation'] }[kind] || [];
    need.forEach((k) => { const fld = f[k]; const special = 'adm.exl.' + k + '.' + kind; fld.el.querySelector('.label').textContent = has(special) ? t(special) : t('adm.ex.' + k); parts.push(f[k].el); });
    if (['listen_choice', 'listen_type'].includes(kind)) { parts.push(h('div', { class: 'field' }, h('span', { class: 'label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, t('adm.ex.audio_upload')), audioFile, audioInfo)); showAudio(); }
    typeBox.replaceChildren(...parts); drawOptions(kind);
  }
  type.input.addEventListener('change', () => { if (CHOICE.includes(type.value) !== CHOICE.includes(ex.type) || type.value === 'match_pairs' || ex.type === 'match_pairs') state.options = []; drawType(); });
  drawType();

  /* Russian version of the exercise: shown to learners whose translation language is Russian (the main fields hold the Uzbek version) */
  const ru = trOf(ex).ru || {};
  const VFIELDS = [['prompt', 'adm.ex.prompt', 'text'], ['sentence', 'adm.ex.sentence', 'text'], ['answer', 'adm.ex.answer', 'textarea'], ['translation', 'adm.ex.translation', 'text'], ['explanation', 'adm.ex.explanation', 'textarea'], ['hint', 'adm.ex.hint', 'text']];
  const variant = Object.fromEntries(VFIELDS.map(([k, label, kind]) => [k, field({ label: t(label), name: 'ru_' + k, type: kind === 'textarea' ? 'textarea' : 'text', rows: 2, value: (ru[k] || '').split('|').join(kind === 'textarea' ? '\n' : '|') })]));
  const variantOptions = field({ label: t('adm.ex.variant_options'), name: 'ru_options', type: 'textarea', rows: 4, value: (ru.options || []).map((o) => (o.match_text ? o.text + ' | ' + o.match_text : o.text)).join('\n'), hint: t('adm.ex.variant_options_hint') });
  const gatherVariants = () => {
    const o = {};
    VFIELDS.forEach(([k]) => { const v = String(variant[k].value || '').trim(); if (v) o[k] = k === 'answer' ? v.split('\n').map((x) => x.trim()).filter(Boolean).join('|') : v; });
    const lines = String(variantOptions.value || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (lines.length) o.options = lines.map((ln) => { const [a, b] = ln.split('|').map((x) => x.trim()); return { text: a || '', match_text: b || '' }; });
    return Object.keys(o).length ? { ru: o } : {};
  };
  const variantBox = h('details', { class: 'variant-box' }, h('summary', {}, t('adm.ex.ru_version')), h('p', { class: 'muted small' }, t('adm.ex.ru_version_hint')), ...VFIELDS.map(([k]) => variant[k].el), variantOptions.el);
  const errBox = h('div', {});
  const gather = () => ({ type: type.value, prompt: common.prompt.value, sentence: common.sentence.value, passage: common.passage.value, answer: common.answer.value.split('\n').map((x) => x.trim()).filter(Boolean).join('|'), audio_text: common.audio_text.value, audio_url: state.audio_url,
    direction: common.direction.value, translation: common.translation.value, explanation: common.explanation.value, hint: common.hint.value, difficulty: Number(common.difficulty.value), status: common.status.value, vocabulary_id: common.vocabulary_id.value ? Number(common.vocabulary_id.value) : null,
    options: state.options.filter((o) => o.text || o.match_text).map((o) => ({ text: o.text, match_text: o.match_text, is_correct: !!o.is_correct })), translations: gatherVariants() });
  const validate = async () => {
    const r = await post('/admin/exercises/validate', gather());
    errBox.replaceChildren(r.errors.length ? h('div', { class: 'problems' }, t('adm.ex.fix_to_publish'), h('ul', {}, r.errors.map((e) => h('li', {}, t(e.message, e.params))))) : h('div', { class: 'ok-box' }, t('adm.ex.looks_good')));
  };
  const extra = h('div', {}, type.el, typeBox, optionsBox, h('div', { class: 'two-col' }, common.difficulty.el, common.status.el), common.explanation.el, common.hint.el, variantBox, vocabItems.length ? common.vocabulary_id.el : null, errBox,
    h('button', { type: 'button', class: 'btn secondary small', onclick: validate }, t('adm.ex.check_problems')));
  return formDialog({ title: exerciseId ? t('adm.edit_exercise') : t('adm.new_exercise'), wide: true, fields: [], extra, save: async () => (exerciseId ? put('/admin/exercises/' + exerciseId, gather()) : post(`/admin/lessons/${lessonId}/exercises`, gather())) });
}
