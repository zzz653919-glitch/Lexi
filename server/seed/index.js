/* Builds the sample course(s) from sample-data.js into the real database tables (exercises are generated from each lesson's words). */
const { now } = require('../lib/util');
const X = require('../lib/exercises');
const data = require('./sample-data');
const TR = require('./translations');

const navJson = (title) => { const n = TR.NAV[title]; if (!n) return '{}'; return JSON.stringify(Object.fromEntries(['uz', 'ru'].map((l) => [l, { title: n[l][0], description: n[l][1] }]))); };
const ru = (w) => TR.RU_WORDS[w.en] || null;
const firstRu = (w) => (ru(w) ? ru(w)[0].split(/[;,]/)[0].trim() : firstUz(w));
const allRu = (w) => (ru(w) ? ru(w)[0].split(/[;,]/).map((x) => x.trim()).filter(Boolean).join('|') : allUz(w));
const ruEx = (w) => (ru(w) ? ru(w)[1] : w.exUz);
const withRu = (ru) => ({ translations: { ru } });

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
  const nt = (x) => `“${x.en}” — ${firstUz(x)}`, nr = (x) => `“${x.en}” — ${firstRu(x)}`;
  add('translation_choice', { prompt: '', sentence: w[0].en, explanation: nt(w[0]), options: opts(firstUz(w[0]), others(0).map(firstUz)), ...withRu({ explanation: nr(w[0]), options: opts(firstRu(w[0]), others(0).map(firstRu)).map(({ text }) => ({ text })) }) }, 0);
  add('translation_choice', { prompt: '', sentence: firstUz(w[1]), direction: 'uz-en', explanation: nt(w[1]), options: opts(w[1].en, others(1).map((x) => x.en)), ...withRu({ sentence: firstRu(w[1]), explanation: nr(w[1]) }) }, 1);
  add('match_pairs', { prompt: '', options: w.slice(0, 4).map((x) => ({ text: x.en, match_text: firstUz(x), is_correct: true })), ...withRu({ options: w.slice(0, 4).map((x) => ({ text: x.en, match_text: firstRu(x) })) }) });
  const si = w.findIndex(isSingle);
  if (si >= 0) add('scramble_letters', { prompt: '', sentence: firstUz(w[si]), answer: w[si].en, ...withRu({ sentence: firstRu(w[si]) }) }, si);
  const bi = w.findIndex((x, i) => i >= 3 && blank(x.ex, x.en));
  if (bi >= 0) add('fill_blank', { prompt: '', sentence: blank(w[bi].ex, w[bi].en), answer: w[bi].en, translation: w[bi].exUz, ...withRu({ translation: ruEx(w[bi]) }) }, bi);
  add('listen_choice', { prompt: '', audio_text: w[4].en, options: opts(w[4].en, others(4).map((x) => x.en)) }, 4);
  const li = w.findIndex((x, i) => i >= 2 && isSingle(x) && i !== si);
  if (li >= 0) add('listen_type', { prompt: '', audio_text: w[li].en, answer: w[li].en }, li);
  add('translate_type', { prompt: '', sentence: w[1].en, direction: 'en-uz', answer: allUz(w[1]), explanation: nt(w[1]), ...withRu({ answer: allRu(w[1]), explanation: nr(w[1]) }) }, 1);
  add('multiple_choice', { prompt: lesson.mc.prompt, explanation: lesson.mc.expl, options: lesson.mc.options.map((t, i) => ({ text: t, is_correct: i === 0 })) });
  add('reading', { prompt: lesson.passage.q, passage: lesson.passage.text, explanation: lesson.passage.expl, options: lesson.passage.options.map((t, i) => ({ text: t, is_correct: i === 0 })) });
  const rs = TR.RU_SENTENCES[lesson.sentence[0]];
  add('order_words', { prompt: lesson.sentence[1], sentence: lesson.sentence[0], translation: lesson.sentence[1], ...(rs ? withRu({ prompt: rs, translation: rs }) : {}) });
  for (let i = 0; i < w.length; i++) { const bad = misspell(w[i].ex, w[i].en); if (bad && isSingle(w[i])) { add('fix_spelling', { prompt: '', sentence: bad, answer: w[i].ex, translation: w[i].exUz, ...withRu({ translation: ruEx(w[i]) }) }, i); break; } }
  return out;
}

async function buildCourse(db, spec, position) {
  const t = now();
  const stats = { exercises: 0, vocabulary: 0 };
  const courseId = (await db.run('INSERT INTO courses (slug, title, description, track, status, position, created_at, updated_at, translations) VALUES (?,?,?,?,?,?,?,?,?)', spec.slug, spec.title, spec.description, spec.track, 'published', position, t, t, navJson(spec.title))).id;
  for (const [li, lv] of spec.levels.entries()) {
    const levelId = (await db.run('INSERT INTO levels (course_id, code, title, description, position, unlock_rule, unlock_threshold_pct, translations) VALUES (?,?,?,?,?,?,?,?)', courseId, lv.code, lv.title, lv.description, li, 'sequential', 60, navJson(lv.title))).id;
    for (const [ui, un] of lv.units.entries()) {
      const unitId = (await db.run('INSERT INTO units (level_id, title, description, position, translations) VALUES (?,?,?,?,?)', levelId, un.title, un.description, ui, navJson(un.title))).id;
      for (const [k, ls] of un.lessons.entries()) {
        const lessonId = (await db.run('INSERT INTO lessons (unit_id, title, description, position, status, unlock_rule, xp_reward, created_at, updated_at, translations) VALUES (?,?,?,?,?,?,?,?,?,?)', unitId, ls.title, ls.description, k, 'published', 'sequential', 20, t, t, navJson(ls.title))).id;
        const vocabIds = [];
        for (const w of ls.words) {
          const r = await db.run('INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', courseId, levelId, unitId, lessonId, w.en, w.uz, ru(w) ? JSON.stringify({ ru: ru(w)[0], ru_example: ru(w)[1] }) : '{}', w.pos, w.ex, w.exUz, lv.code === 'IELTS' ? '' : lv.code, 'published', t, t);
          if (r.changes) stats.vocabulary++;
          vocabIds.push(r.changes ? r.id : (await db.get('SELECT id FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE', w.en, w.uz)).id);
        }
        for (const [pos, ex] of lessonExercises(ls, vocabIds).entries()) {
          const errs = X.validate({ ...X.normalizeInput(ex) });
          if (errs.length) throw new Error(`Sample exercise invalid (${ls.title} / ${ex.type}): ${errs[0].message}`);
          const n = X.normalizeInput(ex);
          const id = (await db.run('INSERT INTO exercises (lesson_id, type, position, difficulty, prompt, answer, sentence, passage, audio_text, audio_url, translation, explanation, hint, direction, status, vocabulary_id, created_at, updated_at, translations) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            lessonId, n.type, pos, n.difficulty, n.prompt, n.answer, n.sentence, n.passage, n.audio_text, '', n.translation, n.explanation, n.hint, n.direction, 'published', ex.vocabulary_id || null, t, t, JSON.stringify(n.translations || {}))).id;
          for (const [i, o] of n.options.filter((o) => o.text).entries()) await db.run('INSERT INTO exercise_options (exercise_id, text, match_text, is_correct, position) VALUES (?,?,?,?,?)', id, o.text, o.match_text, o.is_correct ? 1 : 0, i);
          stats.exercises++;
        }
      }
    }
  }
  return stats;
}

/* creates the sample content once (only when the database has no courses yet) */
async function ensureSample(db) {
  if (await db.get("SELECT 1 x FROM settings WHERE key = 'sample_seeded'") || await db.get('SELECT 1 x FROM courses')) return { created: false };
  const total = { exercises: 0, vocabulary: 0 };
  await db.tx(async () => {
    for (const [i, spec] of [data.GENERAL, data.IELTS].entries()) { const s = await buildCourse(db, spec, i); total.exercises += s.exercises; total.vocabulary += s.vocabulary; }
    await db.run("INSERT INTO settings (key, value) VALUES ('sample_seeded', 'true')");
  });
  return { created: true, ...total };
}

module.exports = { ensureSample, lessonExercises };
