/* Built-in placement questions, grammar lessons and extra vocabulary. Runs on every start-up but only fills what is missing,
   so administrators' edits are never overwritten and existing databases get the new content once.
   Everything is written in ONE batch (a single round trip), so it is fast even on a hosted database. */
const { now } = require('../lib/util');
const { QUESTIONS } = require('./placement-questions');
const { POINTS } = require('./grammar-points');
const { POOL } = require('./vocab-pool');

const FLAGS = ['seeded_placement_questions', 'seeded_grammar_points', 'seeded_vocab_pool'];

async function ensureAssessmentContent(db) {
  const done = new Set((await db.all(`SELECT key FROM settings WHERE key IN (${FLAGS.map(() => '?').join(',')})`, ...FLAGS)).map((r) => r.key));
  if (FLAGS.every((f) => done.has(f))) return { questions: 0, grammar: 0, vocabulary: 0 };   // the usual case: three flags, nothing else to do
  const out = { questions: 0, grammar: 0, vocabulary: 0 }, t = now(), st = [];
  const flag = (k) => st.push({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", args: [k] });
  if (!done.has(FLAGS[0])) {
    if (!(await db.get('SELECT COUNT(*) n FROM assessment_questions')).n) {
      let id = 0, opt = 0;
      for (const q of QUESTIONS) {
        const typed = q.format === 'type';
        id++;
        st.push({ sql: 'INSERT INTO assessment_questions (id, skill, level, format, prompt, passage, sentence, answer, audio_text, explanation, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          args: [id, q.skill, q.level, typed ? 'type' : 'choice', q.prompt, q.passage || '', q.sentence || '', typed ? q.correct : '', q.audio || '', q.explanation || '', 'published', t, t] });
        if (!typed) for (const [i, text] of [q.correct].concat(q.wrong).entries()) st.push({ sql: 'INSERT INTO assessment_options (question_id, text, is_correct, position) VALUES (?,?,?,?)', args: [id, text, i === 0 ? 1 : 0, i] });
        out.questions++;
      }
    }
    flag(FLAGS[0]);
  }
  if (!done.has(FLAGS[1])) {
    if (!(await db.get('SELECT COUNT(*) n FROM grammar_points')).n) {
      for (const [i, p] of POINTS.entries()) {
        st.push({ sql: 'INSERT INTO grammar_points (level, slug, title, explanation, examples, practice, translations, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          args: [p.level, p.slug, p.title, p.explanation, JSON.stringify(p.examples), JSON.stringify(p.practice), JSON.stringify(p.translations), i, 'published', t, t] });
        out.grammar++;
      }
    }
    flag(FLAGS[1]);
  }
  if (!done.has(FLAGS[2])) {
    const course = await db.get("SELECT id FROM courses WHERE track = 'general' ORDER BY position, id LIMIT 1");
    if (course) {   // without a general course nothing is added and the pool is tried again later
      for (const [level, words] of Object.entries(POOL)) for (const [en, uz, ru, pos, ex] of words) {
        st.push({ sql: 'INSERT OR IGNORE INTO vocabulary (course_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', args: [course.id, en, uz, JSON.stringify({ ru }), pos, ex, '', level, 'published', t, t] });
        out.vocabulary++;
      }
      flag(FLAGS[2]);
    }
  }
  if (st.length) await db.batch(st);
  return out;
}

module.exports = { ensureAssessmentContent };
