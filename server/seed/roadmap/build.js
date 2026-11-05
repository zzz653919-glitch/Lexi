/* Turns the authored lesson specs (see a1-*.js) into database rows. Every exercise is validated with the same rules the admin editor uses,
   so a broken exercise can never be seeded. Large inserts go in per-topic batches (one request each on a hosted database). */
const { now } = require('../../lib/util');
const X = require('../../lib/exercises');
const { LEVELS } = require('./curriculum');
const IPA = require('./ipa-a1');
const UZ = require('../../../shared/uz-alphabet');

const opts = (correct, wrong) => [{ text: correct, is_correct: true }].concat(wrong.map((text) => ({ text, is_correct: false })));
const first = (txt) => String(txt).split(/[;,]/)[0].trim();
const all = (txt) => String(txt).split(/[;,]/).map((x) => x.trim()).filter(Boolean).join('|');
const single = (w) => /^\p{L}{3,14}$/u.test(w[0]);
const blankOf = (sentence, word) => { const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); return re.test(sentence) ? sentence.replace(re, '____') : null; };
const ru = (o) => ({ translations: { ru: o } });
const others = (words, i, n, f) => words.filter((_, k) => k !== i).slice(0, n).map(f);

/* word = [en, uz, ru, pos, example, exampleUz] */
function lessonExercises(L) {
  const w = L.w, out = [];
  const add = (type, f, module, vocabIdx) => out.push({ type, status: 'published', module, difficulty: 1 + Math.min(2, Math.floor(out.length / 6)), vocabIdx: vocabIdx == null ? null : vocabIdx, ...f });
  const uz = (x) => first(x[1]), rus = (x) => first(x[2] || x[1]);
  add('translation_choice', { sentence: w[0][0], explanation: `“${w[0][0]}” — ${uz(w[0])}`, options: opts(uz(w[0]), others(w, 0, 3, uz)), ...ru({ explanation: `“${w[0][0]}” — ${rus(w[0])}`, options: opts(rus(w[0]), others(w, 0, 3, rus)).map(({ text }) => ({ text })) }) }, 'vocabulary', 0);
  add('translation_choice', { sentence: uz(w[1]), direction: 'uz-en', explanation: `“${w[1][0]}” — ${uz(w[1])}`, options: opts(w[1][0], others(w, 1, 3, (x) => x[0])), ...ru({ sentence: rus(w[1]), explanation: `“${w[1][0]}” — ${rus(w[1])}` }) }, 'vocabulary', 1);
  add('match_pairs', { options: w.slice(0, 4).map((x) => ({ text: x[0], match_text: uz(x), is_correct: true })), ...ru({ options: w.slice(0, 4).map((x) => ({ text: x[0], match_text: rus(x) })) }) }, 'vocabulary');
  const si = w.findIndex(single);
  if (si >= 0) add('scramble_letters', { sentence: uz(w[si]), answer: w[si][0], ...ru({ sentence: rus(w[si]) }) }, 'vocabulary', si);
  add('listen_choice', { audio_text: w[2][0], options: opts(w[2][0], others(w, 2, 3, (x) => x[0])) }, 'listening', 2);
  const li = w.findIndex((x, i) => i >= 3 && single(x));
  if (li >= 0) add('listen_type', { audio_text: w[li][0], answer: w[li][0] }, 'listening', li);
  const bi = w.findIndex((x) => x[4] && blankOf(x[4], x[0]));
  if (bi >= 0) add('fill_blank', { sentence: blankOf(w[bi][4], w[bi][0]), answer: w[bi][0], translation: w[bi][5] || '' }, 'grammar', bi);
  add('translate_type', { sentence: w[3][0], direction: 'en-uz', answer: all(w[3][1]), explanation: `“${w[3][0]}” — ${uz(w[3])}`, ...ru({ answer: all(w[3][2] || w[3][1]), explanation: `“${w[3][0]}” — ${rus(w[3])}` }) }, 'vocabulary', 3);
  for (const g of L.g) add('multiple_choice', { prompt: g[0], explanation: g[4] || '', options: opts(g[1], [g[2], g[3]]) }, 'grammar');
  add('listen_choice', { prompt: L.dlg[1], audio_text: L.dlg[0], options: opts(L.dlg[2], [L.dlg[3], L.dlg[4]]) }, 'listening');
  for (const q of L.rd.slice(1)) {
    if (q.length === 2) add('reading', { passage: L.rd[0], prompt: 'True, False or Not Given? ' + q[0], explanation: q[2] || '', options: opts(q[1], ['True', 'False', 'Not Given'].filter((x) => x !== q[1])) }, 'reading');
    else add('reading', { passage: L.rd[0], prompt: q[0], options: opts(q[1], [q[2], q[3]]) }, 'reading');
  }
  const ex0 = L.eg.find((e) => X.tokensOf(e[0]).length >= 3 && X.tokensOf(e[0]).length <= 9);
  if (ex0) add('order_words', { prompt: ex0[1], sentence: ex0[0], translation: ex0[1] }, 'grammar');
  add('writing', { prompt: L.wr[0], answer: L.wr[1], min_words: L.wr[2], translation: L.wr[3] }, 'writing');
  add('speaking', { prompt: L.sp[0], translation: L.sp[1] }, 'speaking');
  return out;
}
/* topic test / exam items: [question, correct, wrong, wrong, module?] */
const mcq = (q, module) => ({ type: 'multiple_choice', status: 'published', difficulty: 2, module: q[4] || module, prompt: q[0], options: opts(q[1], [q[2], q[3]]) });

function check(ex, where) {
  const n = X.normalizeInput(ex);
  const errs = X.validate(n);
  if (errs.length) throw new Error(`Roadmap exercise invalid (${where} / ${ex.type}): ${errs[0].message} ${JSON.stringify(errs[0].params || '')}`);
  return n;
}

const idCache = new WeakMap();
async function nextId(db, table) { const ids = idCache.get(db) || idCache.set(db, {}).get(db); if (ids[table] == null) ids[table] = (await db.get(`SELECT COALESCE(MAX(id), 0) m FROM ${table}`)).m; return ++ids[table]; }
const tr3 = (arr, f1 = 'title') => JSON.stringify({ uz: { [f1]: arr[1] }, ru: { [f1]: arr[2] } });
const trNav = (title, desc) => JSON.stringify({ uz: { title: title[1], description: desc ? desc[1] : '' }, ru: { title: title[2], description: desc ? desc[2] : '' } });

/* the exercise + option inserts of one lesson */
async function exerciseStatements(db, { lessonId, exercises, words, title, t }) {
  const st = [];
  for (const [pos, e] of exercises.entries()) {
    const n = check(e, title);
    const eid = await nextId(db, 'exercises');
    const vocab = e.vocabIdx != null && words && words[e.vocabIdx] ? words[e.vocabIdx] : null;
    st.push({ sql: `INSERT INTO exercises (id, lesson_id, type, position, difficulty, prompt, answer, sentence, passage, audio_text, audio_url, translation, explanation, hint, direction, status, vocabulary_id, translations, skill, min_words, module, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${vocab ? '(SELECT id FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE)' : 'NULL'},?,?,?,?,?,?)`,
      args: [eid, lessonId, n.type, pos, n.difficulty, n.prompt, n.answer, n.sentence, n.passage, n.audio_text, '', n.translation, n.explanation, n.hint, n.direction, 'published'].concat(vocab ? [vocab[0], vocab[1]] : []).concat([JSON.stringify(n.translations || {}), n.skill || null, n.min_words || 0, e.module || null, t, t]) });
    for (const [i, o] of n.options.filter((o) => o.text).entries()) st.push({ sql: 'INSERT INTO exercise_options (exercise_id, text, match_text, is_correct, position) VALUES (?,?,?,?,?)', args: [eid, o.text, o.match_text, o.is_correct ? 1 : 0, i] });
  }
  return st;
}

/* statements for one NEW lesson (with its exercises, options and vocabulary) */
async function lessonStatements(db, { unlock = 'sequential', unitId, position, kind, skill, title, desc, descs, content, exercises, words, levelId, courseId, cefr, xp, t }) {
  const st = [], lid = await nextId(db, 'lessons');
  st.push({ sql: 'INSERT INTO lessons (id, unit_id, title, description, position, status, unlock_rule, xp_reward, created_at, updated_at, translations, kind, skill, content) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [lid, unitId, title[0], desc || '', position, 'published', unlock, xp, t, t, trNav(title, descs || null), kind, skill || null, JSON.stringify(content || {})] });
  for (const w of words || []) st.push({ sql: 'INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at, ipa) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [courseId, levelId, unitId, lid, w[0], w[1], JSON.stringify({ ru: w[2] || '', ru_example: '' }), w[3] || '', w[4] || '', w[5] || '', cefr, 'published', t, t, ipaOf(w)] });
  st.push(...await exerciseStatements(db, { lessonId: lid, exercises, words, title: title[0], t }));
  return st;
}

/* Creates the roadmap course, its levels and topics, and all 240 lesson rows of the curriculum (lessons without content stay drafts, hidden from
   learners). Then every lesson that has authored content is filled in: study page, exercises, vocabulary. Topic tests and level examinations are
   added when all the lessons they cover have content. Every step is atomic, resumable and never duplicates. */
async function ensureRoadmap(db, content) {
  const t = now(), made = { lessons: 0, exercises: 0 };
  let course = await db.get("SELECT id FROM courses WHERE slug = 'lexio-roadmap'");
  if (!course) {
    const id = await nextId(db, 'courses');
    const pos = (await db.get('SELECT COALESCE(MAX(position), -1) + 1 p FROM courses')).p;
    const st = [{ sql: 'INSERT INTO courses (id, slug, title, description, track, status, position, created_at, updated_at, translations) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [id, 'lexio-roadmap', 'LEXIO English Roadmap', 'From A1 Beginner to IELTS Band 6.5–7.0: 240 lessons in six levels. Each level opens when you pass the examination of the level before.', 'general', 'published', pos, t, t,
        JSON.stringify({ uz: { title: 'LEXIO ingliz tili yo‘li', description: UZ.toNew('A1 boshlang‘ichdan IELTS 6.5–7.0 gacha: oltita darajada 240 ta dars. Har bir daraja oldingi daraja imtihonidan o‘tgandan keyin ochiladi.') }, ru: { title: 'Дорожная карта LEXIO', description: 'От A1 до IELTS 6.5–7.0: 240 уроков в шести уровнях. Каждый уровень открывается после экзамена предыдущего.' } })] }];
    for (const [li, lv] of LEVELS.entries()) {
      const lid = await nextId(db, 'levels');
      st.push({ sql: 'INSERT INTO levels (id, course_id, code, title, description, position, unlock_rule, unlock_threshold_pct, translations, exam_pass_pct, strict) VALUES (?,?,?,?,?,?,?,?,?,?,?)', args: [lid, id, lv.code, lv.title[0], lv.description[0], li, 'sequential', 80, trNav(lv.title, lv.description), 80, 1] });
      for (const [ui, topic] of lv.topics.entries()) { const uid = await nextId(db, 'units'); st.push({ sql: 'INSERT INTO units (id, level_id, title, description, position, translations) VALUES (?,?,?,?,?,?)', args: [uid, lid, topic.title[0], '', ui, JSON.stringify({ uz: { title: topic.title[1] }, ru: { title: topic.title[2] } })] }); }
    }
    await db.batch(st);
    course = { id };
  }
  for (const lv of LEVELS) {
    const level = await db.get('SELECT * FROM levels WHERE course_id = ? AND code = ?', course.id, lv.code);
    if (!level) continue;
    const spec = (content.levels || {})[lv.code] || { topics: [] };
    let complete = true;
    for (const topic of lv.topics) {
      const unit = await db.get('SELECT id FROM units WHERE level_id = ? AND title = ?', level.id, topic.title[0]);
      if (!unit) { complete = false; continue; }
      const tspec = spec.topics.find((x) => x.title === topic.title[0]) || { lessons: [] };
      const st = [];
      let allDone = true, ids = null;
      for (const [i, [en, uz]] of topic.lessons.entries()) {
        let row = await db.get('SELECT id, status FROM lessons WHERE unit_id = ? AND title = ?', unit.id, en);
        const L = tspec.lessons.find((x) => x.t[0] === en);
        if (!row) {
          const lid = await nextId(db, 'lessons');
          st.push({ sql: 'INSERT INTO lessons (id, unit_id, title, description, position, status, unlock_rule, xp_reward, created_at, updated_at, translations, kind, skill, content) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', args: [lid, unit.id, en, '', i, L ? 'draft' : 'draft', 'sequential', 20, t, t, JSON.stringify({ uz: { title: uz } }), 'lesson', null, '{}'] });
          row = { id: lid, status: 'draft', fresh: true };
        }
        if (L && row.status === 'draft' && !(await db.get('SELECT 1 x FROM exercises WHERE lesson_id = ?', row.id))) {
          const ex = L.exercises || lessonExercises(L);
          st.push(...await fillLesson(db, { lessonId: row.id, unitId: unit.id, levelId: level.id, courseId: course.id, spec: L, exercises: ex, cefr: lv.code === 'IELTS' ? '' : lv.code, topic: topic.title[0], t }));
          made.lessons++; made.exercises += ex.length;
        }
        if (!L) allDone = false;
      }
      if (st.length) await db.batch(st);
      if (!allDone) { complete = false; continue; }
      // the topic test, once all four lessons have content
      const withTest = tspec.test !== false && tspec.lessons.every((L) => L.ts && L.ts.length);
      if (withTest && !(await db.get("SELECT 1 x FROM lessons WHERE unit_id = ? AND kind = 'topic_test'", unit.id))) {
        const items = tspec.lessons.flatMap((L) => L.ts.map((q) => mcq(q, 'grammar')));
        const pos = (await db.get('SELECT COALESCE(MAX(position), -1) + 1 p FROM lessons WHERE unit_id = ?', unit.id)).p;
        await db.batch(await lessonStatements(db, { unitId: unit.id, position: pos, kind: 'topic_test', skill: 'mixed', title: [topic.title[0] + ' — test', UZ.toNew('Mavzu testi'), 'Тест по теме'], desc: '', content: topicTestContent(topic), exercises: items, words: [], levelId: level.id, courseId: course.id, cefr: lv.code, xp: 30, t }));
        made.lessons++; made.exercises += items.length;
      }
    }
    // the final examination of the level, in its last topic, once every topic of the level is complete
    if (complete && spec.exam) {
      const lastTopic = lv.topics[lv.topics.length - 1];
      const unit = await db.get('SELECT id FROM units WHERE level_id = ? AND title = ?', level.id, lastTopic.title[0]);
      if (unit && !(await db.get("SELECT 1 x FROM lessons WHERE unit_id = ? AND kind = 'exam'", unit.id))) {
        const pos = (await db.get('SELECT COALESCE(MAX(position), -1) + 1 p FROM lessons WHERE unit_id = ?', unit.id)).p;
        const items = spec.exam.items.map((q) => (q.type ? q : mcq(q, 'grammar')));
        await db.batch(await lessonStatements(db, { unitId: unit.id, position: pos, kind: 'exam', skill: 'mixed', title: [`${lv.code} final examination`, `${lv.code} yakuniy imtihoni`, `Итоговый экзамен ${lv.code}`], desc: '', content: spec.exam.content, exercises: items, words: [], levelId: level.id, courseId: course.id, cefr: lv.code, xp: 100, t }));
        made.lessons++; made.exercises += items.length;
      }
    }
  }
  return made;
}

/* fills an existing (draft) lesson row: publishes it with its study page, vocabulary and exercises */
async function fillLesson(db, { lessonId, unitId, levelId, courseId, spec, exercises, cefr, topic, t }) {
  const st = [];
  const words = spec.w || [];
  const content = spec.content || lessonContent(spec);
  const o = content.objective || {};
  st.push({ sql: "UPDATE lessons SET status = 'published', description = ?, translations = ?, kind = ?, skill = ?, content = ?, xp_reward = ?, unlock_rule = ?, updated_at = ? WHERE id = ?",
    args: [o.en || '', trNav(spec.t, [o.en || '', o.uz || '', o.ru || o.en || '']), spec.kind || 'lesson', spec.skill || 'mixed', JSON.stringify(content), spec.xp || 20, spec.unlock || 'sequential', t, lessonId] });
  for (const w of words) st.push({ sql: 'INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at, ipa, topic, kind, difficulty) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [courseId, levelId, unitId, lessonId, w[0], w[1], JSON.stringify({ ru: w[2] || '', ru_example: '' }), w[3] || '', w[4] || '', w[5] || '', cefr, 'published', t, t, ipaOf(w), topic, 'word', DIFFICULTY[cefr] || 1] });
  st.push(...await exerciseStatements(db, { lessonId, exercises, words, title: spec.t[0], t }));
  return st;
}
const DIFFICULTY = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const ipaOf = (w) => w[6] || IPA[w[0]] || '';

const lessonContent = (L) => ({ objective: { uz: L.obj[0], en: L.obj[1], ru: L.obj[2] }, explanation: { uz: L.ex[0], en: L.ex[1], ru: L.ex[2] }, tip: L.tip ? { uz: L.tip[0], en: L.tip[1] } : undefined,
  examples: L.eg.map((e) => ({ en: e[0], tr: { uz: e[1], ru: e[2] } })), vocabulary: L.w.map((w) => ({ en: w[0], uz: w[1], ru: w[2], ipa: ipaOf(w) })) });
const topicTestContent = (topic) => ({ objective: { uz: UZ.toNew('Mavzu bo‘yicha bilimingizni tekshiring. Har bir savolga bir marta javob berasiz; o‘tish bali 70%.'), en: 'Check what you learned in this topic. Each question has one try; the pass mark is 70%.' }, explanation: { en: '', uz: '' }, examples: [], vocabulary: [] });

module.exports = { ensureRoadmap, lessonExercises, mcq, check, lessonStatements, nextId, trNav };
