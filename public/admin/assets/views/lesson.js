import { h, icon, get, post, put, patch, del, api, table, tag, formDialog, toast, crumbs, iconBtn, confirmDialog, modal, field, wireForm, formErrorBox, ApiError, qs } from '../common.js';
import { RENDERERS } from '/js/views/exercises.js';
import { navigate } from '../admin.js';

const TYPE_LABEL = {};

export default async function lesson({ params }) {
  const id = Number(params.id);
  const [types, vocab] = await Promise.all([get('/admin/exercise-types'), get('/admin/vocabulary' + qs({ lesson_id: id, pageSize: 100 }))]);
  types.types.forEach((t) => { TYPE_LABEL[t.id] = t.label; });
  const holder = h('div', {});

  async function load() { draw(await get('/admin/lessons/' + id)); }

  function draw(d) {
    const l = d.lesson;
    const rows = d.exercises;
    const setStatus = async (status) => { try { await post(`/admin/lessons/${id}/status`, { status }); toast(`Lesson ${status}`, 'success'); load(); } catch (e) { toast(e.message, 'error', 8000); } };
    const editLesson = async () => {
      const r = await formDialog({ title: 'Lesson settings', fields: [
        { name: 'title', label: 'Title', value: l.title, required: true }, { name: 'description', label: 'Description', type: 'textarea', value: l.description }, { name: 'xp_reward', label: 'XP for completing the lesson', type: 'number', value: l.xp_reward, min: 0, max: 500 },
        { name: 'unlock_rule', label: 'Unlock rule', type: 'select', value: l.unlock_rule, options: [{ value: 'sequential', label: 'Sequential — opens after the previous lesson in the level' }, { value: 'open', label: 'Open — always available' }, { value: 'prerequisite', label: 'Prerequisite — opens after a chosen lesson' }] },
        { name: 'prerequisite_lesson_id', label: 'Required lesson (for “prerequisite”)', type: 'select', value: l.prerequisite_lesson_id || '', options: [{ value: '', label: '— none —' }].concat(d.siblings.map((s) => ({ value: s.id, label: s.title }))) }],
        save: (v) => patch('/admin/lessons/' + id, { ...v, xp_reward: Number(v.xp_reward), prerequisite_lesson_id: v.prerequisite_lesson_id === '' ? null : Number(v.prerequisite_lesson_id) }) });
      if (r) load();
    };
    const move = async (i, dir) => { const ids = rows.map((x) => x.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await post(`/admin/lessons/${id}/exercises/reorder`, { ids }); load(); };
    const dup = async (e) => { await post(`/admin/exercises/${e.id}/duplicate`); toast('Exercise duplicated', 'success'); load(); };
    const delEx = async (e) => { if (await confirmDialog('Delete exercise?', 'This cannot be undone.', 'Delete', true)) { await del('/admin/exercises/' + e.id, { confirm: true }); load(); } };
    const edit = async (exId) => { const saved = await exerciseDialog(id, exId, vocab.items); if (saved) load(); };

    holder.replaceChildren(
      h('div', { 'data-crumb': '' }, crumbs({ href: '/admin/courses', label: 'Courses' }, { href: '/admin/courses/' + d.courseId, label: d.courseTitle }, { label: l.title })),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, l.title), h('div', { class: 'row' }, tag(l.status), h('span', { class: 'muted small' }, `${l.xp_reward} XP · unlock: ${l.unlock_rule}`))),
        h('div', { class: 'row' }, h('button', { class: 'btn secondary small', onclick: editLesson }, icon('edit'), 'Settings'), l.status !== 'published' ? h('button', { class: 'btn small', onclick: () => setStatus('published') }, 'Publish') : h('button', { class: 'btn secondary small', onclick: () => setStatus('draft') }, 'Unpublish'), l.status !== 'archived' ? h('button', { class: 'btn secondary small', onclick: () => setStatus('archived') }, 'Archive') : null)),
      l.description ? h('p', { class: 'muted' }, l.description) : null,
      h('div', { class: 'row between', style: { margin: '10px 0' } }, h('h2', { style: { margin: 0 } }, `Exercises (${rows.length})`),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => edit(null) }, icon('plus'), 'Add exercise'), h('button', { class: 'btn secondary small', onclick: () => importDialog(id).then((n) => n && load()) }, icon('upload'), 'Import'),
          h('a', { class: 'btn secondary small', href: `/api/admin/lessons/${id}/export?format=json`, download: '' }, icon('download'), 'JSON'), h('a', { class: 'btn secondary small', href: `/api/admin/lessons/${id}/export?format=csv`, download: '' }, 'CSV'))),
      table([
        { label: '#', render: (e) => String(rows.indexOf(e) + 1) }, { label: 'Type', render: (e) => TYPE_LABEL[e.type] || e.type },
        { label: 'Question', render: (e) => h('span', { class: 'truncate' }, e.prompt || e.sentence || '—') }, { label: 'Status', render: (e) => tag(e.status) },
        { label: '', cls: 'acts', render: (e) => h('div', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'flex-end' } }, iconBtn('up', 'Move up', () => move(rows.indexOf(e), -1)), iconBtn('down', 'Move down', () => move(rows.indexOf(e), 1)), iconBtn('eye', 'Preview as learner', () => previewDialog(e.id)), iconBtn('edit', 'Edit exercise', () => edit(e.id)), iconBtn('copy', 'Duplicate', () => dup(e)), iconBtn('trash', 'Delete', () => delEx(e), 'danger')) },
      ], rows, { empty: 'No exercises yet. Add the first one.' }));
  }
  await load();
  return { el: holder, title: 'Lesson', nav: 'courses' };
}

/* ---------- preview exactly as a learner sees it ---------- */
export async function previewDialog(exerciseId) {
  const { exercise, problems } = await get(`/admin/exercises/${exerciseId}/preview`);
  const box = h('div', { class: 'preview-box' });
  const fb = h('div', { class: 'lesson-foot', hidden: true });
  const check = h('button', { class: 'btn', type: 'button', disabled: true }, 'Check');
  let cur;
  cur = RENDERERS[exercise.type](exercise, { changed: (ok) => { check.disabled = !ok; }, submit: () => check.click() });
  check.addEventListener('click', async () => {
    const a = cur.answer(); if (a == null) return;
    try { const r = await post(`/admin/exercises/${exerciseId}/preview-check`, { answer: a }); cur.lock(); cur.reveal(r);
      fb.hidden = false; fb.className = 'lesson-foot ' + (r.correct ? 'good' : 'bad'); fb.replaceChildren(h('div', { class: 'feedback' }, h('b', {}, r.correct ? 'Correct!' : 'Not quite'), !r.correct ? h('p', {}, 'Correct answer: ', h('span', { class: 'correct-answer' }, r.correctAnswer)) : null, r.explanation ? h('p', {}, r.explanation) : null)); check.disabled = true;
    } catch (e) { toast(e.message, 'error'); }
  });
  box.append(cur.el, fb);
  await modal({ title: 'Learner preview', content: h('div', {}, problems.length ? h('div', { class: 'problems' }, 'This exercise has problems: ', h('ul', {}, problems.map((p) => h('li', {}, p.message)))) : null, box, h('p', { class: 'muted small' }, 'Checking an answer here does not save anything.'), check), actions: [{ label: 'Close', value: true, kind: 'secondary' }] });
}

/* ---------- import dialog ---------- */
async function importDialog(lessonId) {
  const fmt = field({ label: 'Format', name: 'format', type: 'select', options: [{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }] });
  const text = field({ label: 'Content', name: 'content', type: 'textarea', rows: 8, hint: 'Paste the content, or choose a file below. Export a lesson first to see the exact format.' });
  const file = h('input', { type: 'file', accept: '.json,.csv,text/csv,application/json', 'aria-label': 'Choose a file' });
  file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; if (f.size > 1000000) return toast('The file is larger than 1 MB.', 'error'); text.value = await f.text(); fmt.value = /\.csv$/i.test(f.name) ? 'csv' : 'json'; });
  const out = h('div', {});
  return formDialog({ title: 'Import exercises', submitLabel: 'Import', wide: true, fields: [], extra: h('div', {}, fmt.el, h('div', { class: 'file-drop' }, file), text.el, out),
    save: async () => {
      out.replaceChildren();
      try { const r = await post(`/admin/lessons/${lessonId}/import`, { format: fmt.value, content: text.value }); toast(`${r.imported} exercises imported`, 'success'); return r.imported; }
      catch (e) { if (e.data && e.data.problems) out.replaceChildren(h('div', { class: 'problems' }, e.message, h('ul', {}, e.data.problems.map((p) => h('li', {}, `Row ${p.row}: ${p.problems.join(' ')}`))))); throw e; }
    } });
}

/* ---------- exercise editor ---------- */
const CHOICE = ['multiple_choice', 'translation_choice', 'listen_choice', 'reading'];
async function exerciseDialog(lessonId, exerciseId, vocabItems) {
  const ex = exerciseId ? await get('/admin/exercises/' + exerciseId) : { type: 'multiple_choice', prompt: '', answer: '', sentence: '', passage: '', audio_text: '', audio_url: '', translation: '', explanation: '', hint: '', direction: 'en-uz', difficulty: 1, status: 'published', vocabulary_id: null, options: [] };
  const state = { options: ex.options.length ? ex.options.map((o) => ({ ...o })) : [], audio_url: ex.audio_url };
  const type = field({ label: 'Exercise type', name: 'type', type: 'select', value: ex.type, options: types().map((t) => ({ value: t.id, label: t.label })) });
  const common = {
    prompt: field({ label: 'Question / instruction', name: 'prompt', value: ex.prompt, maxlength: 300 }),
    sentence: field({ label: 'Sentence / word', name: 'sentence', value: ex.sentence, maxlength: 400 }),
    passage: field({ label: 'Reading passage', name: 'passage', type: 'textarea', rows: 5, value: ex.passage }),
    answer: field({ label: 'Accepted answer(s)', name: 'answer', type: 'textarea', rows: 2, value: (ex.answer || '').split('|').join('\n'), hint: 'One accepted answer per line.' }),
    audio_text: field({ label: 'Text to read aloud', name: 'audio_text', value: ex.audio_text, hint: 'Read by the browser’s text-to-speech. Upload audio below to use a recording instead.' }),
    direction: field({ label: 'Direction', name: 'direction', type: 'select', value: ex.direction, options: [{ value: 'en-uz', label: 'English → Uzbek' }, { value: 'uz-en', label: 'Uzbek → English' }] }),
    translation: field({ label: 'Translation shown after answering', name: 'translation', value: ex.translation }),
    explanation: field({ label: 'Explanation (shown after a mistake)', name: 'explanation', type: 'textarea', rows: 2, value: ex.explanation }),
    hint: field({ label: 'Hint', name: 'hint', value: ex.hint }),
    difficulty: field({ label: 'Difficulty (1–5)', name: 'difficulty', type: 'number', value: ex.difficulty, min: 1, max: 5 }),
    status: field({ label: 'Status', name: 'status', type: 'select', value: ex.status, options: [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft (hidden from learners)' }] }),
    vocabulary_id: field({ label: 'Linked vocabulary word', name: 'vocabulary_id', type: 'select', value: ex.vocabulary_id || '', options: [{ value: '', label: '— none —' }].concat(vocabItems.map((v) => ({ value: v.id, label: `${v.en} — ${v.uz}` }))), hint: 'Wrong answers add this word to the learner’s review list.' }),
  };
  const optionsBox = h('div', {}), typeBox = h('div', {});
  const audioInfo = h('div', { class: 'muted small' });
  const audioFile = h('input', { type: 'file', accept: '.mp3,.ogg,.wav,audio/*', 'aria-label': 'Upload audio file' });
  audioFile.addEventListener('change', async () => {
    const f = audioFile.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast('Audio files may be at most 2 MB.', 'error');
    try { const buf = await f.arrayBuffer(); const r = await api('POST', '/admin/uploads', buf, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': f.name } }); state.audio_url = r.url; showAudio(); toast('Audio uploaded', 'success'); } catch (e) { toast(e.message, 'error', 6000); }
  });
  const showAudio = () => { audioInfo.replaceChildren(state.audio_url ? h('span', {}, 'Uploaded audio: ', h('audio', { controls: true, src: state.audio_url, style: { verticalAlign: 'middle', maxWidth: '100%' } }), ' ', h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.audio_url = ''; showAudio(); } }, 'Remove')) : 'No uploaded audio.'); };

  function drawOptions(t) {
    optionsBox.replaceChildren();
    if (CHOICE.includes(t)) {
      if (state.options.length < 2) while (state.options.length < 3) state.options.push({ text: '', match_text: '', is_correct: state.options.length === 0 });
      state.options.forEach((o, i) => optionsBox.append(h('div', { class: 'opt-row' },
        h('input', { type: 'radio', name: 'correct', checked: !!o.is_correct, 'aria-label': `Option ${i + 1} is correct`, onchange: () => state.options.forEach((x, k) => { x.is_correct = k === i; }) }),
        h('input', { class: 'input', value: o.text, 'aria-label': `Option ${i + 1} text`, maxlength: 200, oninput: (e) => { o.text = e.target.value; } }),
        h('button', { type: 'button', class: 'btn icon secondary', 'aria-label': 'Remove option', onclick: () => { state.options.splice(i, 1); drawOptions(t); } }, icon('x')))));
      optionsBox.append(h('p', { class: 'muted small' }, 'Select the radio button next to the correct option.'), state.options.length < 6 ? h('button', { type: 'button', class: 'btn secondary small', onclick: () => { state.options.push({ text: '', match_text: '', is_correct: false }); drawOptions(t); } }, icon('plus'), 'Add option') : null);
    } else if (t === 'match_pairs') {
      if (state.options.length < 3) while (state.options.length < 4) state.options.push({ text: '', match_text: '', is_correct: true });
      state.options.forEach((o, i) => optionsBox.append(h('div', { class: 'opt-row pair' },
        h('input', { class: 'input', value: o.text, placeholder: 'English', 'aria-label': `Pair ${i + 1} English`, oninput: (e) => { o.text = e.target.value; o.is_correct = true; } }),
        h('input', { class: 'input', value: o.match_text, placeholder: 'Translation', 'aria-label': `Pair ${i + 1} translation`, oninput: (e) => { o.match_text = e.target.value; } }),
        h('button', { type: 'button', class: 'btn icon secondary', 'aria-label': 'Remove pair', onclick: () => { state.options.splice(i, 1); drawOptions(t); } }, icon('x')))));
      optionsBox.append(state.options.length < 6 ? h('button', { type: 'button', class: 'btn secondary small', onclick: () => { state.options.push({ text: '', match_text: '', is_correct: true }); drawOptions(t); } }, icon('plus'), 'Add pair') : null);
    } else if (t === 'order_words') {
      const extra = state.options.map((o) => o.text).join(', ');
      optionsBox.append(h('label', { class: 'field' }, h('span', { class: 'label' }, 'Extra distractor words (optional, comma separated)'), h('input', { class: 'input', value: extra, oninput: (e) => { state.options = e.target.value.split(',').map((x) => x.trim()).filter(Boolean).map((text) => ({ text, match_text: '', is_correct: false })); } })));
    }
  }
  function drawType() {
    const t = type.value;
    const f = common, parts = [];
    const need = { multiple_choice: ['prompt'], translation_choice: ['prompt', 'sentence'], reading: ['passage', 'prompt'], listen_choice: ['prompt', 'audio_text'], listen_type: ['prompt', 'audio_text', 'answer'], fill_blank: ['prompt', 'sentence', 'answer', 'translation'], translate_type: ['prompt', 'sentence', 'direction', 'answer'], scramble_letters: ['prompt', 'sentence', 'answer'], order_words: ['prompt', 'sentence', 'answer'], match_pairs: ['prompt'], fix_spelling: ['prompt', 'sentence', 'answer', 'translation'] }[t] || [];
    const labels = { sentence: { translation_choice: 'Word or phrase to translate', fill_blank: 'Sentence with one blank (write ____)', translate_type: 'Text to translate', scramble_letters: 'Clue (for example the translation)', order_words: 'The correct English sentence', fix_spelling: 'Text containing the spelling mistake' }, answer: { fill_blank: 'Word that fills the blank', scramble_letters: 'The English word', listen_type: 'What the learner must type', fix_spelling: 'The corrected text', order_words: 'Other accepted sentences (optional)', translate_type: 'Accepted translations' }, prompt: { order_words: 'Translation the learner builds the sentence from' } };
    need.forEach((k) => { const fld = f[k]; const lab = labels[k] && labels[k][t]; fld.el.querySelector('.label').textContent = lab || { prompt: 'Question / instruction', sentence: 'Sentence / word', passage: 'Reading passage', answer: 'Accepted answer(s)', audio_text: 'Text to read aloud', direction: 'Direction', translation: 'Translation shown after answering' }[k]; parts.push(f[k].el); });
    if (['listen_choice', 'listen_type'].includes(t)) { parts.push(h('div', { class: 'field' }, h('span', { class: 'label', style: { display: 'block', fontWeight: 800, fontSize: '.88rem', marginBottom: '6px' } }, 'Audio recording (optional, .mp3/.ogg/.wav up to 2 MB)'), audioFile, audioInfo)); showAudio(); }
    typeBox.replaceChildren(...parts); drawOptions(t);
  }
  type.input.addEventListener('change', () => { if (CHOICE.includes(type.value) !== CHOICE.includes(ex.type) || type.value === 'match_pairs' || ex.type === 'match_pairs') state.options = []; drawType(); });
  drawType();

  const errBox = h('div', {});
  const gather = () => ({ type: type.value, prompt: common.prompt.value, sentence: common.sentence.value, passage: common.passage.value, answer: common.answer.value.split('\n').map((x) => x.trim()).filter(Boolean).join('|'), audio_text: common.audio_text.value, audio_url: state.audio_url,
    direction: common.direction.value, translation: common.translation.value, explanation: common.explanation.value, hint: common.hint.value, difficulty: Number(common.difficulty.value), status: common.status.value, vocabulary_id: common.vocabulary_id.value ? Number(common.vocabulary_id.value) : null,
    options: state.options.filter((o) => o.text || o.match_text).map((o) => ({ text: o.text, match_text: o.match_text, is_correct: !!o.is_correct })) });
  const validate = async () => {
    const r = await post('/admin/exercises/validate', gather());
    errBox.replaceChildren(r.errors.length ? h('div', { class: 'problems' }, 'To publish, fix:', h('ul', {}, r.errors.map((e) => h('li', {}, e.message)))) : h('div', { class: 'ok-box' }, 'Looks good — this exercise can be published.'));
  };
  const extra = h('div', {}, type.el, typeBox, optionsBox, h('div', { class: 'two-col' }, common.difficulty.el, common.status.el), common.explanation.el, common.hint.el, vocabItems.length ? common.vocabulary_id.el : null, errBox,
    h('button', { type: 'button', class: 'btn secondary small', onclick: validate }, 'Check for problems'));
  return formDialog({ title: exerciseId ? 'Edit exercise' : 'New exercise', wide: true, fields: [], extra, save: async () => (exerciseId ? put('/admin/exercises/' + exerciseId, gather()) : post(`/admin/lessons/${lessonId}/exercises`, gather())) });
}
const typesCache = { list: null };
function types() { return Object.keys(TYPE_LABEL).map((id) => ({ id, label: TYPE_LABEL[id] })); }
