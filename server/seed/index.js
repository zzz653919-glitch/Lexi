/* Builds the sample course(s) from sample-data.js into the real database tables (exercises are generated from each lesson's words). */
const { now } = require('../lib/util');
const X = require('../lib/exercises');
const data = require('./sample-data');

const isSingle = (w) => /^\p{L}{3,14}$/u.test(w.en);
const firstUz = (w) => w.uz.split(/[;,]/)[0].trim();
const allUz = (w) => w.uz.split(/[;,]/).map((x) => x.trim()).filter(Boolean).join('|');
function misspell(text, word) {
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0 || word.length < 4) return null;
  const chars = word.split('');
  let a = 1; while (a < chars.length - 2 && chars[a] === chars[a + 1]) a++;
  [chars[a], chars[a + 1]] = [chars[a + 1], chars[a]];
  const bad = chars.join('');
  return bad === word ? null : text.slice(0, i) + bad + text.slice(i + word.length);
}
const blank = (ex, word) => { const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); return re.test(ex) ? ex.replace(re, '____') : null; };

/* -> array of exercise inputs (same shape the admin editor produces) for one lesson spec */
function lessonExercises(lesson, vocabIds) {
  const w = lesson.words, out = [];
  const others = (i) => w.filter((_, k) => k !== i);
  const opts = (correctText, wrongTexts) => [{ text: correctText, is_correct: true }].concat(wrongTexts.slice(0, 3).map((t) => ({ text: t, is_correct: false })));
  const add = (type, f, wordIdx) => out.push({ type, status: 'published', difficulty: 1 + Math.min(2, Math.floor(out.length / 5)), vocabulary_id: wordIdx == null ? null : vocabIds[wordIdx], ...f });
  add('translation_choice', { prompt: 'Select the correct translation.', sentence: w[0].en, explanation: `“${w[0].en}” means “${firstUz(w[0])}”.`, options: opts(firstUz(w[0]), others(0).map(firstUz)) }, 0);
  add('translation_choice', { prompt: 'Select the English word.', sentence: firstUz(w[1]), direction: 'uz-en', explanation: `“${firstUz(w[1])}” in English is “${w[1].en}”.`, options: opts(w[1].en, others(1).map((x) => x.en)) }, 1);
  add('match_pairs', { prompt: 'Match each word with its translation.', explanation: 'Review these words in the vocabulary section.', options: w.slice(0, 4).map((x) => ({ text: x.en, match_text: firstUz(x), is_correct: true })) });
  const si = w.findIndex(isSingle);
  if (si >= 0) add('scramble_letters', { prompt: 'Arrange the letters to make the English word.', sentence: firstUz(w[si]), answer: w[si].en, explanation: `The word is “${w[si].en}”.` }, si);
  const bi = w.findIndex((x, i) => i >= 3 && blank(x.ex, x.en));
  if (bi >= 0) add('fill_blank', { prompt: 'Type the missing word.', sentence: blank(w[bi].ex, w[bi].en), answer: w[bi].en, translation: w[bi].exUz, explanation: `The missing word is “${w[bi].en}”.` }, bi);
  add('listen_choice', { prompt: 'Listen and choose what you hear.', audio_text: w[4].en, explanation: `You heard “${w[4].en}”.`, options: opts(w[4].en, others(4).map((x) => x.en)) }, 4);
  const li = w.findIndex((x, i) => i >= 2 && isSingle(x) && i !== si);
  if (li >= 0) add('listen_type', { prompt: 'Listen and type the word.', audio_text: w[li].en, answer: w[li].en, explanation: `The word is “${w[li].en}”.` }, li);
  add('translate_type', { prompt: 'Translate into Uzbek.', sentence: w[1].en, direction: 'en-uz', answer: allUz(w[1]), explanation: `“${w[1].en}” means “${firstUz(w[1])}”.` }, 1);
  add('multiple_choice', { prompt: lesson.mc.prompt, explanation: lesson.mc.expl, options: lesson.mc.options.map((t, i) => ({ text: t, is_correct: i === 0 })) });
  add('reading', { prompt: lesson.passage.q, passage: lesson.passage.text, explanation: lesson.passage.expl, options: lesson.passage.options.map((t, i) => ({ text: t, is_correct: i === 0 })) });
  add('order_words', { prompt: lesson.sentence[1], sentence: lesson.sentence[0], translation: lesson.sentence[1], explanation: `The sentence is: ${lesson.sentence[0]}` });
  for (let i = 0; i < w.length; i++) { const bad = misspell(w[i].ex, w[i].en); if (bad && isSingle(w[i])) { add('fix_spelling', { prompt: 'Correct the spelling mistake.', sentence: bad, answer: w[i].ex, translation: w[i].exUz, explanation: `The correct spelling is “${w[i].en}”.` }, i); break; } }
  return out;
}

function buildCourse(db, spec, position) {
  const t = now();
  const stats = { exercises: 0, vocabulary: 0 };
  const courseId = db.run('INSERT INTO courses (slug, title, description, track, status, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', spec.slug, spec.title, spec.description, spec.track, 'published', position, t, t).id;
  spec.levels.forEach((lv, li) => {
    const levelId = db.run('INSERT INTO levels (course_id, code, title, description, position, unlock_rule, unlock_threshold_pct) VALUES (?,?,?,?,?,?,?)', courseId, lv.code, lv.title, lv.description, li, 'sequential', 60).id;
    lv.units.forEach((un, ui) => {
      const unitId = db.run('INSERT INTO units (level_id, title, description, position) VALUES (?,?,?,?)', levelId, un.title, un.description, ui).id;
      un.lessons.forEach((ls, k) => {
        const lessonId = db.run('INSERT INTO lessons (unit_id, title, description, position, status, unlock_rule, xp_reward, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', unitId, ls.title, ls.description, k, 'published', 'sequential', 20, t, t).id;
        const vocabIds = ls.words.map((w) => {
          const r = db.run('INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', courseId, levelId, unitId, lessonId, w.en, w.uz, '{}', w.pos, w.ex, w.exUz, lv.code === 'IELTS' ? '' : lv.code, 'published', t, t);
          if (r.changes) stats.vocabulary++;
          return r.changes ? r.id : db.get('SELECT id FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE', w.en, w.uz).id;
        });
        lessonExercises(ls, vocabIds).forEach((ex, pos) => {
          const errs = X.validate({ ...X.normalizeInput(ex) });
          if (errs.length) throw new Error(`Sample exercise invalid (${ls.title} / ${ex.type}): ${errs[0].message}`);
          const n = X.normalizeInput(ex);
          const id = db.run('INSERT INTO exercises (lesson_id, type, position, difficulty, prompt, answer, sentence, passage, audio_text, audio_url, translation, explanation, hint, direction, status, vocabulary_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            lessonId, n.type, pos, n.difficulty, n.prompt, n.answer, n.sentence, n.passage, n.audio_text, '', n.translation, n.explanation, n.hint, n.direction, 'published', ex.vocabulary_id || null, t, t).id;
          n.options.filter((o) => o.text).forEach((o, i) => db.run('INSERT INTO exercise_options (exercise_id, text, match_text, is_correct, position) VALUES (?,?,?,?,?)', id, o.text, o.match_text, o.is_correct ? 1 : 0, i));
          stats.exercises++;
        });
      });
    });
  });
  return stats;
}

/* creates the sample content once (only when the database has no courses yet) */
function ensureSample(db) {
  if (db.get("SELECT 1 x FROM settings WHERE key = 'sample_seeded'") || db.get('SELECT 1 x FROM courses')) return { created: false };
  const total = { exercises: 0, vocabulary: 0 };
  db.tx(() => {
    [data.GENERAL, data.IELTS].forEach((spec, i) => { const s = buildCourse(db, spec, i); total.exercises += s.exercises; total.vocabulary += s.vocabulary; });
    db.run("INSERT INTO settings (key, value) VALUES ('sample_seeded', 'true')");
  });
  return { created: true, ...total };
}

module.exports = { ensureSample, lessonExercises };
