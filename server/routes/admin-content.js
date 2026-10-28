/* Administrator API, part 1: courses, levels, units, lessons, exercises (+ import/export). Roles: editor and admin. */
const express = require('express');
const X = require('../lib/exercises');
const csv = require('../lib/csv');
const { now, clean, cleanMultiline, int, HttpError, bad } = require('../lib/util');

const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'course';
const STATUS = ['draft', 'published', 'archived'];

module.exports = function contentRoutes({ db, settings, auth, core, audit }) {
  const r = express.Router();
  const ok = auth.requireRole('editor', 'admin');
  r.use(ok);
  const need = (row, what) => { if (!row) throw new HttpError(404, `${what} not found.`); return row; };
  const confirmed = (req) => { if (!(req.body && req.body.confirm === true)) throw bad('This action must be confirmed.'); };
  const nextPos = (table, col, id) => (db.get(`SELECT COALESCE(MAX(position), -1) + 1 p FROM ${table} WHERE ${col} = ?`, id).p);

  /* ---------- courses ---------- */
  r.get('/courses', (req, res) => {
    res.json({ items: db.all(`SELECT c.*, (SELECT COUNT(*) FROM levels WHERE course_id = c.id) levels,
      (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id) lessons,
      (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id AND l.status = 'published') published_lessons
      FROM courses c ORDER BY c.position, c.id`) });
  });
  const courseInput = (b, partial) => {
    const e = {}, v = {};
    if (!partial || b.title !== undefined) { const t = clean(b.title, 80); if (t.length < 2) e.title = 'Enter a title (at least 2 characters).'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 500);
    if (b.track !== undefined) { if (!['general', 'ielts'].includes(b.track)) e.track = 'Track must be general or ielts.'; else v.track = b.track; }
    if (b.slug !== undefined) { const s = slugify(b.slug); if (!/^[a-z0-9-]{2,60}$/.test(s)) e.slug = 'Use letters, digits and dashes.'; else v.slug = s; }
    if (Object.keys(e).length) throw bad('Please fix the highlighted fields.', e);
    return v;
  };
  r.post('/courses', (req, res) => {
    const v = courseInput(req.body || {}, false);
    let slug = v.slug || slugify(v.title), n = 1;
    while (db.get('SELECT 1 x FROM courses WHERE slug = ?', slug)) slug = slugify(v.title) + '-' + (++n);
    const t = now();
    const id = db.run('INSERT INTO courses (slug, title, description, track, status, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', slug, v.title, v.description || '', v.track || 'general', 'draft', db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM courses').p, t, t).id;
    audit(req, 'course.create', 'course', id, { title: v.title });
    res.status(201).json(db.get('SELECT * FROM courses WHERE id = ?', id));
  });
  r.get('/courses/:id', (req, res) => {
    const c = need(db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const levels = db.all('SELECT * FROM levels WHERE course_id = ? ORDER BY position, id', c.id).map((lv) => ({
      ...lv, units: db.all('SELECT * FROM units WHERE level_id = ? ORDER BY position, id', lv.id).map((u) => ({
        ...u, lessons: db.all(`SELECT l.*, (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) exercises, (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id AND e.status = 'published') published_exercises FROM lessons l WHERE l.unit_id = ? ORDER BY l.position, l.id`, u.id) })) }));
    res.json({ course: c, levels });
  });
  r.patch('/courses/:id', (req, res) => {
    const c = need(db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const v = courseInput(req.body || {}, true);
    if (v.slug && db.get('SELECT 1 x FROM courses WHERE slug = ? AND id != ?', v.slug, c.id)) throw bad('Please fix the highlighted fields.', { slug: 'This address is already used.' });
    const keys = Object.keys(v);
    if (keys.length) db.run(`UPDATE courses SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), c.id);
    audit(req, 'course.update', 'course', c.id, v);
    res.json(db.get('SELECT * FROM courses WHERE id = ?', c.id));
  });
  r.post('/courses/:id/status', (req, res) => {
    const c = need(db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const status = (req.body || {}).status;
    if (!STATUS.includes(status)) throw bad('Unknown status.');
    if (status === 'published') {
      const n = db.get("SELECT COUNT(*) n FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = ? AND l.status = 'published'", c.id).n;
      if (!n) throw bad('Publish at least one lesson before publishing the course.');
    }
    db.run('UPDATE courses SET status = ?, updated_at = ? WHERE id = ?', status, now(), c.id);
    audit(req, 'course.' + status, 'course', c.id, { from: c.status });
    res.json(db.get('SELECT * FROM courses WHERE id = ?', c.id));
  });
  r.delete('/courses/:id', auth.requireRole('admin'), (req, res) => {
    confirmed(req);
    const c = need(db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    if (c.status === 'published') throw bad('Unpublish or archive the course before deleting it.');
    if (req.body.title !== c.title) throw bad('Type the course title to confirm.');
    db.run('DELETE FROM courses WHERE id = ?', c.id);
    audit(req, 'course.delete', 'course', c.id, { title: c.title });
    res.json({ ok: true });
  });

  /* ---------- levels ---------- */
  const levelInput = (b, partial) => {
    const e = {}, v = {};
    if (!partial || b.code !== undefined) { const code = clean(b.code, 20).toUpperCase(); if (!/^[A-Z0-9 _-]{1,20}$/.test(code) || !settings.all().available_levels.map((x) => x.toUpperCase()).includes(code)) e.code = 'Choose a level from the configured list (Settings → available levels).'; else v.code = code; }
    if (!partial || b.title !== undefined) { const t = clean(b.title, 80); if (t.length < 2) e.title = 'Enter a title.'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 300);
    if (b.unlock_rule !== undefined) { if (!['sequential', 'open'].includes(b.unlock_rule)) e.unlock_rule = 'Must be sequential or open.'; else v.unlock_rule = b.unlock_rule; }
    if (b.unlock_threshold_pct !== undefined) { const n = Number(b.unlock_threshold_pct); if (!Number.isInteger(n) || n < 0 || n > 100) e.unlock_threshold_pct = 'Use 0-100.'; else v.unlock_threshold_pct = n; }
    if (Object.keys(e).length) throw bad('Please fix the highlighted fields.', e);
    return v;
  };
  r.post('/courses/:id/levels', (req, res) => {
    const c = need(db.get('SELECT id FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const v = levelInput(req.body || {}, false);
    if (db.get('SELECT 1 x FROM levels WHERE course_id = ? AND code = ?', c.id, v.code)) throw bad('Please fix the highlighted fields.', { code: 'This course already has that level.' });
    const id = db.run('INSERT INTO levels (course_id, code, title, description, position, unlock_rule, unlock_threshold_pct) VALUES (?,?,?,?,?,?,?)', c.id, v.code, v.title, v.description || '', nextPos('levels', 'course_id', c.id), v.unlock_rule || 'sequential', v.unlock_threshold_pct ?? 60).id;
    audit(req, 'level.create', 'level', id, v);
    res.status(201).json(db.get('SELECT * FROM levels WHERE id = ?', id));
  });
  r.patch('/levels/:id', (req, res) => {
    const l = need(db.get('SELECT * FROM levels WHERE id = ?', int(req.params.id)), 'Level');
    const v = levelInput(req.body || {}, true);
    if (v.code && db.get('SELECT 1 x FROM levels WHERE course_id = ? AND code = ? AND id != ?', l.course_id, v.code, l.id)) throw bad('Please fix the highlighted fields.', { code: 'This course already has that level.' });
    const keys = Object.keys(v);
    if (keys.length) db.run(`UPDATE levels SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => v[k]), l.id);
    audit(req, 'level.update', 'level', l.id, v);
    res.json(db.get('SELECT * FROM levels WHERE id = ?', l.id));
  });
  r.delete('/levels/:id', (req, res) => {
    confirmed(req);
    const l = need(db.get('SELECT * FROM levels WHERE id = ?', int(req.params.id)), 'Level');
    db.run('DELETE FROM levels WHERE id = ?', l.id);
    audit(req, 'level.delete', 'level', l.id, { code: l.code });
    res.json({ ok: true });
  });
  const reorder = (table, scopeCol, scopeVal, ids) => {
    const rows = db.all(`SELECT id FROM ${table} WHERE ${scopeCol} = ?`, scopeVal).map((x) => x.id);
    if (!Array.isArray(ids) || ids.length !== rows.length || !ids.every((i) => rows.includes(Number(i))) || new Set(ids).size !== ids.length) throw bad('The new order must list every item exactly once.');
    db.tx(() => ids.forEach((id, i) => db.run(`UPDATE ${table} SET position = ? WHERE id = ?`, i, Number(id))));
  };
  r.post('/courses/:id/levels/reorder', (req, res) => { reorder('levels', 'course_id', int(req.params.id), (req.body || {}).ids); audit(req, 'level.reorder', 'course', req.params.id, {}); res.json({ ok: true }); });

  /* ---------- units ---------- */
  const unitInput = (b, partial) => {
    const e = {}, v = {};
    if (!partial || b.title !== undefined) { const t = clean(b.title, 80); if (t.length < 2) e.title = 'Enter a title.'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 300);
    if (Object.keys(e).length) throw bad('Please fix the highlighted fields.', e);
    return v;
  };
  r.post('/levels/:id/units', (req, res) => {
    const l = need(db.get('SELECT id FROM levels WHERE id = ?', int(req.params.id)), 'Level');
    const v = unitInput(req.body || {}, false);
    const id = db.run('INSERT INTO units (level_id, title, description, position) VALUES (?,?,?,?)', l.id, v.title, v.description || '', nextPos('units', 'level_id', l.id)).id;
    audit(req, 'unit.create', 'unit', id, v);
    res.status(201).json(db.get('SELECT * FROM units WHERE id = ?', id));
  });
  r.patch('/units/:id', (req, res) => {
    const u = need(db.get('SELECT * FROM units WHERE id = ?', int(req.params.id)), 'Unit');
    const v = unitInput(req.body || {}, true);
    const keys = Object.keys(v);
    if (keys.length) db.run(`UPDATE units SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => v[k]), u.id);
    audit(req, 'unit.update', 'unit', u.id, v);
    res.json(db.get('SELECT * FROM units WHERE id = ?', u.id));
  });
  r.delete('/units/:id', (req, res) => { confirmed(req); const u = need(db.get('SELECT * FROM units WHERE id = ?', int(req.params.id)), 'Unit'); db.run('DELETE FROM units WHERE id = ?', u.id); audit(req, 'unit.delete', 'unit', u.id, { title: u.title }); res.json({ ok: true }); });
  r.post('/levels/:id/units/reorder', (req, res) => { reorder('units', 'level_id', int(req.params.id), (req.body || {}).ids); audit(req, 'unit.reorder', 'level', req.params.id, {}); res.json({ ok: true }); });

  /* ---------- lessons ---------- */
  const courseOfUnit = (unitId) => db.get('SELECT lv.course_id FROM units u JOIN levels lv ON lv.id = u.level_id WHERE u.id = ?', unitId);
  const courseOfLesson = (lessonId) => db.get('SELECT lv.course_id FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE l.id = ?', lessonId);
  function lessonInput(b, partial, lessonId, courseId) {
    const e = {}, v = {};
    if (!partial || b.title !== undefined) { const t = clean(b.title, 100); if (t.length < 2) e.title = 'Enter a title.'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 300);
    if (b.xp_reward !== undefined) { const n = Number(b.xp_reward); if (!Number.isInteger(n) || n < 0 || n > 500) e.xp_reward = 'Use 0-500.'; else v.xp_reward = n; }
    if (b.unlock_rule !== undefined) { if (!['sequential', 'open', 'prerequisite'].includes(b.unlock_rule)) e.unlock_rule = 'Unknown rule.'; else v.unlock_rule = b.unlock_rule; }
    if (b.prerequisite_lesson_id !== undefined) {
      const pid = b.prerequisite_lesson_id === null || b.prerequisite_lesson_id === '' ? null : Number(b.prerequisite_lesson_id);
      if (pid !== null) {
        const pc = courseOfLesson(pid);
        if (!Number.isInteger(pid) || !pc || pc.course_id !== courseId) e.prerequisite_lesson_id = 'The required lesson must be in the same course.';
        else if (lessonId && wouldCycle(lessonId, pid)) e.prerequisite_lesson_id = 'That would create a loop of prerequisites.';
        else v.prerequisite_lesson_id = pid;
      } else v.prerequisite_lesson_id = null;
    }
    const rule = v.unlock_rule || (partial && lessonId ? db.get('SELECT unlock_rule FROM lessons WHERE id = ?', lessonId).unlock_rule : 'sequential');
    const pre = v.prerequisite_lesson_id !== undefined ? v.prerequisite_lesson_id : (lessonId ? db.get('SELECT prerequisite_lesson_id p FROM lessons WHERE id = ?', lessonId).p : null);
    if (rule === 'prerequisite' && !pre && !e.prerequisite_lesson_id) e.prerequisite_lesson_id = 'Choose the lesson that must be finished first.';
    if (Object.keys(e).length) throw bad('Please fix the highlighted fields.', e);
    return v;
  }
  function wouldCycle(lessonId, pid) {
    let cur = pid, guard = 0;
    while (cur && guard++ < 100) { if (cur === lessonId) return true; const row = db.get('SELECT prerequisite_lesson_id p FROM lessons WHERE id = ?', cur); cur = row && row.p; }
    return false;
  }
  r.post('/units/:id/lessons', (req, res) => {
    const u = need(db.get('SELECT id FROM units WHERE id = ?', int(req.params.id)), 'Unit');
    const v = lessonInput(req.body || {}, false, null, courseOfUnit(u.id).course_id);
    const t = now();
    const id = db.run('INSERT INTO lessons (unit_id, title, description, position, status, unlock_rule, prerequisite_lesson_id, xp_reward, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      u.id, v.title, v.description || '', nextPos('lessons', 'unit_id', u.id), 'draft', v.unlock_rule || 'sequential', v.prerequisite_lesson_id || null, v.xp_reward ?? settings.all().xp_lesson_bonus, t, t).id;
    audit(req, 'lesson.create', 'lesson', id, v);
    res.status(201).json(db.get('SELECT * FROM lessons WHERE id = ?', id));
  });
  r.get('/lessons/:id', (req, res) => {
    const l = need(db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const c = courseOfLesson(l.id);
    res.json({ lesson: l, courseId: c.course_id, exercises: db.all('SELECT id, type, position, prompt, sentence, status, difficulty FROM exercises WHERE lesson_id = ? ORDER BY position, id', l.id),
      siblings: db.all(`SELECT l2.id, l2.title FROM lessons l2 JOIN units u ON u.id = l2.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = ? AND l2.id != ? ORDER BY lv.position, u.position, l2.position`, c.course_id, l.id) });
  });
  r.patch('/lessons/:id', (req, res) => {
    const l = need(db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const v = lessonInput(req.body || {}, true, l.id, courseOfLesson(l.id).course_id);
    if (v.unlock_rule && v.unlock_rule !== 'prerequisite' && v.prerequisite_lesson_id === undefined) v.prerequisite_lesson_id = null;
    const keys = Object.keys(v);
    if (keys.length) db.run(`UPDATE lessons SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), l.id);
    audit(req, 'lesson.update', 'lesson', l.id, v);
    res.json(db.get('SELECT * FROM lessons WHERE id = ?', l.id));
  });
  r.post('/lessons/:id/status', (req, res) => {
    const l = need(db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const status = (req.body || {}).status;
    if (!STATUS.includes(status)) throw bad('Unknown status.');
    if (status === 'published') {
      const exs = db.all("SELECT * FROM exercises WHERE lesson_id = ? AND status = 'published'", l.id);
      if (!exs.length) throw bad('Add and publish at least one exercise before publishing the lesson.');
      const problems = [];
      for (const e of exs) { const errs = X.validate(loadExercise(e)); if (errs.length) problems.push(`Exercise #${e.position + 1} (${X.TYPES[e.type] ? X.TYPES[e.type].label : e.type}): ${errs[0].message}`); }
      if (problems.length) throw bad('Fix these exercises before publishing: ' + problems.join(' | '));
    }
    db.run('UPDATE lessons SET status = ?, updated_at = ? WHERE id = ?', status, now(), l.id);
    audit(req, 'lesson.' + status, 'lesson', l.id, { from: l.status });
    res.json(db.get('SELECT * FROM lessons WHERE id = ?', l.id));
  });
  r.post('/lessons/:id/duplicate', (req, res) => {
    const l = need(db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const id = db.tx(() => {
      const t = now();
      const nid = db.run('INSERT INTO lessons (unit_id, title, description, position, status, unlock_rule, prerequisite_lesson_id, xp_reward, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        l.unit_id, (l.title + ' (copy)').slice(0, 100), l.description, nextPos('lessons', 'unit_id', l.unit_id), 'draft', l.unlock_rule === 'prerequisite' ? 'sequential' : l.unlock_rule, null, l.xp_reward, t, t).id;
      for (const e of db.all('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY position, id', l.id)) copyExercise(e, nid, e.position);
      return nid;
    });
    audit(req, 'lesson.duplicate', 'lesson', id, { from: l.id });
    res.status(201).json(db.get('SELECT * FROM lessons WHERE id = ?', id));
  });
  r.delete('/lessons/:id', (req, res) => {
    confirmed(req);
    const l = need(db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    db.run('DELETE FROM lessons WHERE id = ?', l.id);
    audit(req, 'lesson.delete', 'lesson', l.id, { title: l.title });
    res.json({ ok: true });
  });
  r.post('/units/:id/lessons/reorder', (req, res) => { reorder('lessons', 'unit_id', int(req.params.id), (req.body || {}).ids); audit(req, 'lesson.reorder', 'unit', req.params.id, {}); res.json({ ok: true }); });

  /* ---------- exercises ---------- */
  const loadExercise = (row) => ({ ...row, options: db.all('SELECT text, match_text, is_correct FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', row.id).map((o) => ({ text: o.text, match_text: o.match_text, is_correct: !!o.is_correct })) });
  function saveOptions(exId, options) {
    db.run('DELETE FROM exercise_options WHERE exercise_id = ?', exId);
    options.filter((o) => o.text).forEach((o, i) => db.run('INSERT INTO exercise_options (exercise_id, text, match_text, is_correct, position) VALUES (?,?,?,?,?)', exId, o.text, o.match_text || '', o.is_correct ? 1 : 0, i));
  }
  function insertExercise(lessonId, ex, position) {
    const t = now();
    const id = db.run(`INSERT INTO exercises (lesson_id, type, position, difficulty, prompt, answer, sentence, passage, audio_text, audio_url, translation, explanation, hint, direction, status, vocabulary_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      lessonId, ex.type, position, ex.difficulty, ex.prompt, ex.answer, ex.sentence, ex.passage, ex.audio_text, ex.audio_url, ex.translation, ex.explanation, ex.hint, ex.direction, ex.status, ex.vocabulary_id, t, t).id;
    saveOptions(id, ex.options);
    return id;
  }
  function copyExercise(row, lessonId, position) { return insertExercise(lessonId, { ...loadExercise(row) }, position); }
  function checkVocabId(ex) { if (ex.vocabulary_id && !db.get('SELECT 1 x FROM vocabulary WHERE id = ?', ex.vocabulary_id)) ex.vocabulary_id = null; }

  r.post('/exercises/validate', (req, res) => { const ex = X.normalizeInput(req.body || {}); res.json({ errors: X.validate(ex) }); });
  r.get('/exercise-types', (req, res) => res.json({ types: X.TYPE_IDS.map((id) => ({ id, ...X.TYPES[id] })) }));
  r.get('/exercises/:id', (req, res) => { const e = need(db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise'); res.json(loadExercise(e)); });
  r.post('/lessons/:id/exercises', (req, res) => {
    const l = need(db.get('SELECT id FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const ex = X.normalizeInput(req.body || {}); checkVocabId(ex);
    const errs = X.validate(ex);
    if (errs.length && ex.status === 'published') throw bad('This exercise cannot be published yet: ' + errs[0].message, Object.fromEntries(errs.map((e) => [e.field, e.message])));
    if (!X.TYPES[ex.type]) throw bad('Choose an exercise type.', { type: 'Required.' });
    const id = db.tx(() => insertExercise(l.id, ex, nextPos('exercises', 'lesson_id', l.id)));
    audit(req, 'exercise.create', 'exercise', id, { type: ex.type, lesson: l.id });
    res.status(201).json(loadExercise(db.get('SELECT * FROM exercises WHERE id = ?', id)));
  });
  r.put('/exercises/:id', (req, res) => {
    const old = need(db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise');
    const ex = X.normalizeInput(req.body || {}); checkVocabId(ex);
    const errs = X.validate(ex);
    if (errs.length && ex.status === 'published') throw bad('This exercise cannot be published yet: ' + errs[0].message, Object.fromEntries(errs.map((e) => [e.field, e.message])));
    db.tx(() => {
      db.run(`UPDATE exercises SET type=?, difficulty=?, prompt=?, answer=?, sentence=?, passage=?, audio_text=?, audio_url=?, translation=?, explanation=?, hint=?, direction=?, status=?, vocabulary_id=?, updated_at=? WHERE id=?`,
        ex.type, ex.difficulty, ex.prompt, ex.answer, ex.sentence, ex.passage, ex.audio_text, ex.audio_url, ex.translation, ex.explanation, ex.hint, ex.direction, ex.status, ex.vocabulary_id, now(), old.id);
      saveOptions(old.id, ex.options);
    });
    audit(req, 'exercise.update', 'exercise', old.id, { type: ex.type });
    res.json(loadExercise(db.get('SELECT * FROM exercises WHERE id = ?', old.id)));
  });
  r.delete('/exercises/:id', (req, res) => { confirmed(req); const e = need(db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise'); db.run('DELETE FROM exercises WHERE id = ?', e.id); audit(req, 'exercise.delete', 'exercise', e.id, { lesson: e.lesson_id }); res.json({ ok: true }); });
  r.post('/exercises/:id/duplicate', (req, res) => {
    const e = need(db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise');
    const id = db.tx(() => copyExercise(e, e.lesson_id, nextPos('exercises', 'lesson_id', e.lesson_id)));
    audit(req, 'exercise.duplicate', 'exercise', id, { from: e.id });
    res.status(201).json(loadExercise(db.get('SELECT * FROM exercises WHERE id = ?', id)));
  });
  r.post('/lessons/:id/exercises/reorder', (req, res) => { reorder('exercises', 'lesson_id', int(req.params.id), (req.body || {}).ids); audit(req, 'exercise.reorder', 'lesson', req.params.id, {}); res.json({ ok: true }); });
  // preview exactly what a learner sees; checking an answer here never stores anything
  r.get('/exercises/:id/preview', (req, res) => { const e = need(db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise'); res.json({ exercise: X.payload(e, db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', e.id), 7), problems: X.validate(loadExercise(e)) }); });
  r.post('/exercises/:id/preview-check', (req, res) => {
    const e = need(db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise');
    const g = X.grade(e, db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', e.id), (req.body || {}).answer, 7);
    if (g.invalid) throw bad('That answer is not valid for this exercise.');
    res.json({ correct: g.correct, typo: !!g.typo, correctAnswer: g.correctAnswer, explanation: e.explanation, translation: e.translation });
  });

  /* ---------- import / export (JSON or CSV; validated row by row, all or nothing) ---------- */
  const CSV_HEAD = ['type', 'prompt', 'sentence', 'answer', 'passage', 'audio_text', 'translation', 'explanation', 'hint', 'direction', 'difficulty', 'status', 'options'];
  const optionsToCell = (opts) => opts.map((o) => (o.is_correct ? '*' : '') + o.text + (o.match_text ? '=>' + o.match_text : '')).join(' ;; ');
  const cellToOptions = (cell) => String(cell || '').split(';;').map((x) => x.trim()).filter(Boolean).map((x) => {
    const correct = x.startsWith('*'); const t = correct ? x.slice(1).trim() : x; const [a, b] = t.split('=>');
    return { text: (a || '').trim(), match_text: (b || '').trim(), is_correct: correct };
  });
  r.get('/lessons/:id/export', (req, res) => {
    const l = need(db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const rows = db.all('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY position, id', l.id).map(loadExercise);
    audit(req, 'lesson.export', 'lesson', l.id, { format: req.query.format });
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="lesson-${l.id}-exercises.csv"`);
      return res.send(csv.stringify(CSV_HEAD, rows.map((e) => ({ ...e, options: optionsToCell(e.options) }))));
    }
    res.setHeader('Content-Disposition', `attachment; filename="lesson-${l.id}-exercises.json"`);
    res.json({ format: 'lexi-exercises', version: 1, lesson: l.title, exercises: rows.map((e) => Object.fromEntries(CSV_HEAD.filter((k) => k !== 'options').map((k) => [k, e[k]]).concat([['options', e.options]]))) });
  });
  r.post('/lessons/:id/import', (req, res) => {
    const l = need(db.get('SELECT id FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const { format, content } = req.body || {};
    if (typeof content !== 'string' || content.length > 1000000) throw bad('Paste or upload the content to import (up to 1 MB).');
    let items;
    try {
      if (format === 'csv') items = csv.objects(content).map((o) => ({ ...o, options: cellToOptions(o.options) }));
      else { const j = JSON.parse(content); items = Array.isArray(j) ? j : j.exercises; if (!Array.isArray(items)) throw new Error('missing exercises array'); }
    } catch (e) { throw bad('The file could not be read: ' + e.message); }
    if (!items.length) throw bad('The file contains no exercises.');
    if (items.length > 200) throw bad('Import at most 200 exercises at a time.');
    const prepared = [], problems = [];
    items.forEach((raw, i) => {
      const ex = X.normalizeInput({ ...raw, options: (raw.options || []).map((o) => ({ text: o.text, match_text: o.match_text, is_correct: o.is_correct === true || o.correct === true })) });
      const errs = X.validate(ex);
      if (errs.length) problems.push({ row: i + 1, problems: errs.map((e) => e.message) }); else prepared.push(ex);
    });
    if (problems.length) return res.status(422).json({ error: `${problems.length} row(s) have problems. Nothing was imported.`, problems: problems.slice(0, 30) });
    const ids = db.tx(() => { let pos = nextPos('exercises', 'lesson_id', l.id); return prepared.map((ex) => insertExercise(l.id, { ...ex, vocabulary_id: null }, pos++)); });
    audit(req, 'exercise.import', 'lesson', l.id, { count: ids.length, format });
    res.status(201).json({ imported: ids.length });
  });
  r.get('/courses/:id/export', (req, res) => {
    const c = need(db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const levels = db.all('SELECT * FROM levels WHERE course_id = ? ORDER BY position', c.id).map((lv) => ({ code: lv.code, title: lv.title, description: lv.description, unlock_rule: lv.unlock_rule, unlock_threshold_pct: lv.unlock_threshold_pct,
      units: db.all('SELECT * FROM units WHERE level_id = ? ORDER BY position', lv.id).map((u) => ({ title: u.title, description: u.description,
        lessons: db.all('SELECT * FROM lessons WHERE unit_id = ? ORDER BY position', u.id).map((l) => ({ title: l.title, description: l.description, status: l.status, unlock_rule: l.unlock_rule === 'prerequisite' ? 'sequential' : l.unlock_rule, xp_reward: l.xp_reward,
          exercises: db.all('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY position', l.id).map(loadExercise).map((e) => ({ ...Object.fromEntries(CSV_HEAD.filter((k) => k !== 'options').map((k) => [k, e[k]])), options: e.options })) })) })) }));
    audit(req, 'course.export', 'course', c.id, {});
    res.setHeader('Content-Disposition', `attachment; filename="${c.slug}.json"`);
    res.json({ format: 'lexi-course', version: 1, course: { title: c.title, description: c.description, track: c.track }, levels });
  });

  return r;
};
module.exports.slugify = slugify;
