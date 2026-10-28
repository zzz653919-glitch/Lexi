/* Built-in placement questions, grammar lessons and extra vocabulary. Runs on every start-up but only fills what is missing,
   so administrators' edits are never overwritten and existing databases get the new content once. */
const { now } = require('../lib/util');
const { QUESTIONS } = require('./placement-questions');
const { POINTS } = require('./grammar-points');
const { POOL } = require('./vocab-pool');

async function ensureAssessmentContent(db) {
  const out = { questions: 0, grammar: 0, vocabulary: 0 };
  const t = now();
  await db.tx(async () => {
    if (!await db.get("SELECT 1 x FROM settings WHERE key = 'seeded_placement_questions'")) {
      if (!(await db.get('SELECT COUNT(*) n FROM assessment_questions')).n) {
        for (const q of QUESTIONS) {
          const typed = q.format === 'type';
          const id = (await db.run('INSERT INTO assessment_questions (skill, level, format, prompt, passage, sentence, answer, audio_text, explanation, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            q.skill, q.level, typed ? 'type' : 'choice', q.prompt, q.passage || '', q.sentence || '', typed ? q.correct : '', q.audio || '', q.explanation || '', 'published', t, t)).id;
          if (!typed) for (const [i, text] of [q.correct].concat(q.wrong).entries()) await db.run('INSERT INTO assessment_options (question_id, text, is_correct, position) VALUES (?,?,?,?)', id, text, i === 0 ? 1 : 0, i);
          out.questions++;
        }
      }
      await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded_placement_questions', 'true')");
    }
    if (!await db.get("SELECT 1 x FROM settings WHERE key = 'seeded_grammar_points'")) {
      if (!(await db.get('SELECT COUNT(*) n FROM grammar_points')).n) {
        for (const [i, p] of POINTS.entries()) {
          await db.run('INSERT INTO grammar_points (level, slug, title, explanation, examples, practice, translations, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            p.level, p.slug, p.title, p.explanation, JSON.stringify(p.examples), JSON.stringify(p.practice), JSON.stringify(p.translations), i, 'published', t, t);
          out.grammar++;
        }
      }
      await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded_grammar_points', 'true')");
    }
    if (!await db.get("SELECT 1 x FROM settings WHERE key = 'seeded_vocab_pool'")) {
      const course = await db.get("SELECT id FROM courses WHERE track = 'general' ORDER BY position, id LIMIT 1");
      if (course) {
        for (const [level, words] of Object.entries(POOL)) for (const [en, uz, ru, pos, ex] of words) {
          const r = await db.run('INSERT OR IGNORE INTO vocabulary (course_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', course.id, en, uz, JSON.stringify({ ru }), pos, ex, '', level, 'published', t, t);
          if (r.changes) out.vocabulary++;
        }
        await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded_vocab_pool', 'true')");
      }   // without a general course nothing is added and the pool is tried again later
    }
  });
  return out;
}

module.exports = { ensureAssessmentContent };
