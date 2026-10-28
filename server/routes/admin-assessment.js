/* Administrator API: placement-test questions, grammar lessons, coverage checks and anonymised placement statistics. Roles: editor and admin. */
const express = require('express');
const LV = require('../lib/levels');
const X = require('../lib/exercises');
const { now, clean, cleanMultiline, int, clamp, HttpError, bad, escapeLike } = require('../lib/util');

const STATUS = ['draft', 'published', 'archived'];
const FORMATS = ['choice', 'type'];
const I18N = require('../../shared/i18n-core');
const parseJson = (j, d) => { try { const v = JSON.parse(j); return v == null ? d : v; } catch (_) { return d; } };

/* problems that stop a question from being published -> [{ field, message, params }] */
function questionProblems(q) {
  const errs = [], need = (field, message, params) => errs.push({ field, message, params });
  if (!q.prompt) need('prompt', 'val.question_required');
  const opts = q.options.filter((o) => o.text);
  if (q.format === 'choice') {
    if (opts.length < 3) need('options', 'val.aq_options_min');
    if (opts.length > 6) need('options', 'val.options_max');
    if (opts.filter((o) => o.is_correct).length !== 1) need('options', 'val.options_one_correct');
    if (new Set(opts.map((o) => X.norm(o.text))).size !== opts.length) need('options', 'val.options_unique');
  } else if (!X.alternatives(q.answer).length) need('answer', 'val.blank_answer_required');
  if (q.skill === 'reading' && q.passage.length < 20) need('passage', 'val.passage_required');
  if (q.skill === 'listening') { if (!q.audio_text) need('audio_text', 'val.audio_required'); if (q.format !== 'choice') need('format', 'val.aq_listening_choice'); }
  if (q.format === 'type' && !/_{3,}/.test(q.prompt)) need('prompt', 'val.blank_exactly_one');
  return errs;
}
function questionInput(b) {
  return {
    skill: LV.SKILLS.includes(b.skill) ? b.skill : null, level: LV.valid(b.level) ? b.level : null, format: FORMATS.includes(b.format) ? b.format : 'choice',
    prompt: clean(b.prompt, 300), passage: cleanMultiline(b.passage, 3000), sentence: clean(b.sentence, 300), answer: cleanMultiline(b.answer, 300).replace(/\n+/g, '|'),
    audio_text: clean(b.audio_text, 400), explanation: clean(b.explanation, 400), status: STATUS.includes(b.status) ? b.status : 'draft',
    options: (Array.isArray(b.options) ? b.options : []).slice(0, 8).map((o) => ({ text: clean(o && o.text, 200), is_correct: !!(o && o.is_correct) })),
  };
}

function grammarProblems(g) {
  const errs = [], need = (field, message, params) => errs.push({ field, message, params });
  if (!g.title) need('title', 'val.title_required');
  if (!g.explanation) need('explanation', 'val.gr_explanation');
  if (!g.examples.length) need('examples', 'val.gr_examples');
  if (!g.practice.length) need('practice', 'val.gr_practice');
  for (const p of g.practice) if (p.length < 3 || new Set(p.slice(1).map(X.norm)).size !== p.length - 1) { need('practice', 'val.gr_practice_item'); break; }
  return errs;
}
function grammarInput(b) {
  const tr = {};
  for (const lang of I18N.CODES) { const v = b.translations && b.translations[lang]; if (v && typeof v === 'object') { const o = {}; const ti = clean(v.title, 120), ex = cleanMultiline(v.explanation, 1200); if (ti) o.title = ti; if (ex) o.explanation = ex; if (Object.keys(o).length) tr[lang] = o; } }
  return {
    level: LV.valid(b.level) ? b.level : null, title: clean(b.title, 120), explanation: cleanMultiline(b.explanation, 1200), status: STATUS.includes(b.status) ? b.status : 'draft', translations: tr,
    examples: (Array.isArray(b.examples) ? b.examples : []).map((x) => clean(x, 200)).filter(Boolean).slice(0, 6),
    practice: (Array.isArray(b.practice) ? b.practice : []).slice(0, 6).map((p) => (Array.isArray(p) ? p.map((x) => clean(x, 160)).filter(Boolean).slice(0, 6) : [])).filter((p) => p.length),
  };
}

module.exports = function assessmentAdminRoutes({ db, settings, auth, audit }) {
  const r = express.Router();
  r.use(auth.requireRole('editor', 'admin'));
  const confirmed = (req) => { if (!(req.body && req.body.confirm === true)) throw bad('err.confirm_required'); };
  const load = async (row) => ({ ...row, options: (await db.all('SELECT text, is_correct FROM assessment_options WHERE question_id = ? ORDER BY position, id', row.id)).map((o) => ({ text: o.text, is_correct: !!o.is_correct })) });
  const publishError = (errs, req) => bad('err.question_cannot_publish', Object.fromEntries(errs.map((e) => [e.field, { key: e.message, params: e.params }])), { reason: req.t(errs[0].message, errs[0].params) });

  /* ---------- questions ---------- */
  r.get('/assessment/questions', async (req, res) => {
    const where = ['1=1'], args = [];
    if (LV.valid(req.query.level)) { where.push('level = ?'); args.push(req.query.level); }
    if (LV.SKILLS.includes(req.query.skill)) { where.push('skill = ?'); args.push(req.query.skill); }
    if (STATUS.includes(req.query.status)) { where.push('status = ?'); args.push(req.query.status); }
    const q = clean(req.query.q, 80);
    if (q) { where.push("(prompt LIKE ? ESCAPE '\\' OR passage LIKE ? ESCAPE '\\')"); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    const page = Math.max(1, int(req.query.page, 1)), size = clamp(int(req.query.pageSize, 25), 5, 100);
    const total = (await db.get(`SELECT COUNT(*) n FROM assessment_questions WHERE ${where.join(' AND ')}`, ...args)).n;
    const rows = await db.all(`SELECT id, skill, level, format, prompt, status, times_asked, times_correct, updated_at FROM assessment_questions WHERE ${where.join(' AND ')} ORDER BY level, skill, id LIMIT ? OFFSET ?`, ...args, size, (page - 1) * size);
    res.json({ total, page, pageSize: size, items: rows.map((x) => ({ ...x, percentCorrect: x.times_asked >= 5 ? Math.round(100 * x.times_correct / x.times_asked) : null })) });
  });
  r.get('/assessment/questions/:id', async (req, res) => {
    const row = await db.get('SELECT * FROM assessment_questions WHERE id = ?', int(req.params.id));
    if (!row) throw new HttpError(404, 'err.question_not_found');
    res.json(await load(row));
  });
  r.post('/assessment/questions/validate', async (req, res) => res.json({ errors: questionProblems(questionInput(req.body || {})) }));
  async function save(req, id) {
    const q = questionInput(req.body || {});
    const fields = {};
    if (!q.skill) fields.skill = 'val.required';
    if (!q.level) fields.level = 'val.level_unknown';
    if (Object.keys(fields).length) throw bad('err.fix_fields', fields);
    const errs = questionProblems(q);
    if (errs.length && q.status === 'published') throw publishError(errs, req);
    const t = now();
    return db.tx(async () => {
      let qid = id;
      if (id) await db.run('UPDATE assessment_questions SET skill=?, level=?, format=?, prompt=?, passage=?, sentence=?, answer=?, audio_text=?, explanation=?, status=?, updated_at=? WHERE id=?', q.skill, q.level, q.format, q.prompt, q.passage, q.sentence, q.format === 'type' ? q.answer : '', q.audio_text, q.explanation, q.status, t, id);
      else qid = (await db.run('INSERT INTO assessment_questions (skill, level, format, prompt, passage, sentence, answer, audio_text, explanation, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', q.skill, q.level, q.format, q.prompt, q.passage, q.sentence, q.format === 'type' ? q.answer : '', q.audio_text, q.explanation, q.status, t, t)).id;
      await db.run('DELETE FROM assessment_options WHERE question_id = ?', qid);
      if (q.format === 'choice') for (const [i, o] of q.options.filter((o) => o.text).entries()) await db.run('INSERT INTO assessment_options (question_id, text, is_correct, position) VALUES (?,?,?,?)', qid, o.text, o.is_correct ? 1 : 0, i);
      return qid;
    });
  }
  r.post('/assessment/questions', async (req, res) => {
    const id = await save(req, null);
    await audit(req, 'assessment.question.create', 'assessment_question', id, {});
    res.status(201).json(await load(await db.get('SELECT * FROM assessment_questions WHERE id = ?', id)));
  });
  r.put('/assessment/questions/:id', async (req, res) => {
    const old = await db.get('SELECT * FROM assessment_questions WHERE id = ?', int(req.params.id));
    if (!old) throw new HttpError(404, 'err.question_not_found');
    await save(req, old.id);
    await audit(req, 'assessment.question.update', 'assessment_question', old.id, {});
    res.json(await load(await db.get('SELECT * FROM assessment_questions WHERE id = ?', old.id)));
  });
  r.delete('/assessment/questions/:id', async (req, res) => {
    confirmed(req);
    const old = await db.get('SELECT * FROM assessment_questions WHERE id = ?', int(req.params.id));
    if (!old) throw new HttpError(404, 'err.question_not_found');
    await db.run('DELETE FROM assessment_questions WHERE id = ?', old.id);   // finished tests keep their own copy of skill / level
    await audit(req, 'assessment.question.delete', 'assessment_question', old.id, { prompt: old.prompt.slice(0, 80) });
    res.json({ ok: true });
  });

  /* ---------- coverage: a placement test needs enough published questions on every level and skill ---------- */
  r.get('/assessment/coverage', async (req, res) => {
    const rows = await db.all("SELECT level, skill, COUNT(*) n FROM assessment_questions WHERE status = 'published' GROUP BY level, skill");
    const cells = {};
    for (const x of rows) (cells[x.level] = cells[x.level] || {})[x.skill] = x.n;
    const min = 2, warnings = [];
    for (const l of LV.LEVELS) for (const s of ['vocabulary', 'grammar', 'reading']) if ((cells[l] && cells[l][s] || 0) < min) warnings.push({ level: l, skill: s, have: cells[l] && cells[l][s] || 0, need: min });
    const total = rows.reduce((a, x) => a + x.n, 0);
    res.json({ levels: LV.LEVELS, skills: LV.SKILLS, cells, total, ready: total >= 20 && !warnings.length, warnings });
  });

  /* ---------- statistics (no personal data) ---------- */
  r.get('/assessment/stats', async (req, res) => {
    const s = await db.get("SELECT COUNT(*) total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) completed, SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) abandoned, SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) open FROM assessments");
    const done = await db.get("SELECT AVG(asked) avg_asked, AVG(100.0 * correct / NULLIF(asked, 0)) avg_pct FROM assessments WHERE status = 'completed'");
    const dist = await db.all("SELECT result_level level, COUNT(*) n FROM assessments WHERE status = 'completed' GROUP BY result_level");
    const learners = await db.all("SELECT cefr_level level, COUNT(*) n FROM users WHERE role = 'learner' AND cefr_level IS NOT NULL GROUP BY cefr_level");
    const auto = (await db.get("SELECT COUNT(*) n FROM user_level_history WHERE source = 'auto'")).n;
    const hard = await db.all("SELECT id, level, skill, prompt, times_asked, times_correct FROM assessment_questions WHERE times_asked >= 20 AND status = 'published' ORDER BY 1.0 * times_correct / times_asked LIMIT 200");
    // a question looks wrong when its observed success rate is far from what its level predicts (learners at that level should get it right ~70-90%)
    const suspicious = hard.map((x) => ({ id: x.id, level: x.level, skill: x.skill, prompt: x.prompt.slice(0, 100), asked: x.times_asked, percentCorrect: Math.round(100 * x.times_correct / x.times_asked) })).filter((x) => x.percentCorrect < 20 || x.percentCorrect > 98).slice(0, 15);
    res.json({
      assessments: { total: s.total, completed: s.completed || 0, abandoned: s.abandoned || 0, inProgress: s.open || 0, avgQuestions: done.avg_asked ? Math.round(done.avg_asked * 10) / 10 : null, avgPercent: done.avg_pct ? Math.round(done.avg_pct) : null },
      levelDistribution: LV.LEVELS.map((l) => ({ level: l, tests: (dist.find((x) => x.level === l) || {}).n || 0, learners: (learners.find((x) => x.level === l) || {}).n || 0 })),
      autoLevelUps: auto, suspicious,
    });
  });

  /* ---------- grammar lessons ---------- */
  const loadGrammar = (row) => ({ id: row.id, level: row.level, title: row.title, explanation: row.explanation, examples: parseJson(row.examples, []), practice: parseJson(row.practice, []), translations: parseJson(row.translations, {}), status: row.status, position: row.position });
  r.get('/grammar', async (req, res) => {
    const where = ['1=1'], args = [];
    if (LV.valid(req.query.level)) { where.push('level = ?'); args.push(req.query.level); }
    const rows = await db.all(`SELECT * FROM grammar_points WHERE ${where.join(' AND ')} ORDER BY level, position, id`, ...args);
    res.json({ items: rows.map((g) => ({ ...loadGrammar(g), examples: undefined, practice: undefined, practiceCount: parseJson(g.practice, []).length })) });
  });
  r.get('/grammar/:id', async (req, res) => {
    const g = await db.get('SELECT * FROM grammar_points WHERE id = ?', int(req.params.id));
    if (!g) throw new HttpError(404, 'err.grammar_not_found');
    res.json(loadGrammar(g));
  });
  async function saveGrammar(req, id) {
    const g = grammarInput(req.body || {});
    if (!g.level) throw bad('err.fix_fields', { level: 'val.level_unknown' });
    const errs = grammarProblems(g);
    if (errs.length && g.status === 'published') throw bad('err.grammar_cannot_publish', Object.fromEntries(errs.map((e) => [e.field, { key: e.message, params: e.params }])), { reason: req.t(errs[0].message, errs[0].params) });
    const t = now();
    if (id) { await db.run('UPDATE grammar_points SET level=?, title=?, explanation=?, examples=?, practice=?, translations=?, status=?, updated_at=? WHERE id=?', g.level, g.title, g.explanation, JSON.stringify(g.examples), JSON.stringify(g.practice), JSON.stringify(g.translations), g.status, t, id); return id; }
    const pos = (await db.get('SELECT COALESCE(MAX(position), -1) + 1 p FROM grammar_points WHERE level = ?', g.level)).p;
    return (await db.run('INSERT INTO grammar_points (level, slug, title, explanation, examples, practice, translations, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', g.level, '', g.title, g.explanation, JSON.stringify(g.examples), JSON.stringify(g.practice), JSON.stringify(g.translations), pos, g.status, t, t)).id;
  }
  r.post('/grammar', async (req, res) => { const id = await saveGrammar(req, null); await audit(req, 'grammar.create', 'grammar_point', id, {}); res.status(201).json(loadGrammar(await db.get('SELECT * FROM grammar_points WHERE id = ?', id))); });
  r.put('/grammar/:id', async (req, res) => {
    const old = await db.get('SELECT * FROM grammar_points WHERE id = ?', int(req.params.id));
    if (!old) throw new HttpError(404, 'err.grammar_not_found');
    await saveGrammar(req, old.id); await audit(req, 'grammar.update', 'grammar_point', old.id, {});
    res.json(loadGrammar(await db.get('SELECT * FROM grammar_points WHERE id = ?', old.id)));
  });
  r.delete('/grammar/:id', async (req, res) => {
    confirmed(req);
    const old = await db.get('SELECT * FROM grammar_points WHERE id = ?', int(req.params.id));
    if (!old) throw new HttpError(404, 'err.grammar_not_found');
    await db.run('DELETE FROM grammar_points WHERE id = ?', old.id); await audit(req, 'grammar.delete', 'grammar_point', old.id, { title: old.title });
    res.json({ ok: true });
  });

  return r;
};
module.exports.questionProblems = questionProblems;
