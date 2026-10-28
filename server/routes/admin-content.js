/* Administrator API, part 1: courses, levels, units, lessons, exercises (+ import/export). Roles: editor and admin. */
const express = require('express');
const X = require('../lib/exercises');
const csv = require('../lib/csv');
const { now, clean, cleanMultiline, int, HttpError, bad } = require('../lib/util');

const parseJson = (j) => { try { const v = JSON.parse(j || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'course';
const STATUS = ['draft', 'published', 'archived'];

const I18N = require('../../shared/i18n-core');
/* translated titles / descriptions: { uz: { title, description }, ru: {...} } -> JSON text (only known languages and fields) */
function cleanNavTranslations(raw, limits) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('err.fix_fields', { translations: 'val.translations_object' });
  const out = {};
  for (const lang of I18N.CODES) {
    const v = raw[lang]; if (!v || typeof v !== 'object') continue;
    const o = {};
    for (const [f, max] of Object.entries(limits)) { const t = clean(v[f], max); if (t) o[f] = t; }
    if (Object.keys(o).length) out[lang] = o;
  }
  return JSON.stringify(out);
}

module.exports = function contentRoutes({ db, settings, auth, core, audit }) {
  const r = express.Router();
  const ok = auth.requireRole('editor', 'admin');
  r.use(ok);
  const need = (row, what) => { if (!row) throw new HttpError(404, 'err.' + what.toLowerCase() + '_not_found'); return row; };
  const confirmed = (req) => { if (!(req.body && req.body.confirm === true)) throw bad('err.confirm_required'); };
  const nextPos = async (table, col, id) => ((await db.get(`SELECT COALESCE(MAX(position), -1) + 1 p FROM ${table} WHERE ${col} = ?`, id)).p);

  /* ---------- courses ---------- */
  r.get('/courses', async (req, res) => {
    res.json({ items: await db.all(`SELECT c.*, (SELECT COUNT(*) FROM levels WHERE course_id = c.id) levels,
      (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id) lessons,
      (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id AND l.status = 'published') published_lessons
      FROM courses c ORDER BY c.position, c.id`) });
  });
  const courseInput = async (b, partial) => {
    const e = {}, v = {};
    if (!partial || b.title !== undefined) { const t = clean(b.title, 80); if (t.length < 2) e.title = 'val.course_title'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 500);
    if (b.track !== undefined) { if (!['general', 'ielts'].includes(b.track)) e.track = 'val.track'; else v.track = b.track; }
    if (b.translations !== undefined) v.translations = cleanNavTranslations(b.translations, { title: 80, description: 500 });
    if (b.slug !== undefined) { const s = slugify(b.slug); if (!/^[a-z0-9-]{2,60}$/.test(s)) e.slug = 'val.slug'; else v.slug = s; }
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  };
  r.post('/courses', async (req, res) => {
    const v = await courseInput(req.body || {}, false);
    let slug = v.slug || slugify(v.title), n = 1;
    while (await db.get('SELECT 1 x FROM courses WHERE slug = ?', slug)) slug = slugify(v.title) + '-' + (++n);
    const t = now();
    const id = (await db.run('INSERT INTO courses (slug, title, description, track, status, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', slug, v.title, v.description || '', v.track || 'general', 'draft', (await db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM courses')).p, t, t)).id;
    if (v.translations) await db.run('UPDATE courses SET translations = ? WHERE id = ?', v.translations, id);
    await audit(req, 'course.create', 'course', id, { title: v.title });
    res.status(201).json(await db.get('SELECT * FROM courses WHERE id = ?', id));
  });
  r.get('/courses/:id', async (req, res) => {
    const c = need(await db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const levels = await db.all('SELECT * FROM levels WHERE course_id = ? ORDER BY position, id', c.id);
    for (const lv of levels) {
      lv.units = await db.all('SELECT * FROM units WHERE level_id = ? ORDER BY position, id', lv.id);
      for (const u of lv.units) u.lessons = await db.all(`SELECT l.*, (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) exercises, (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id AND e.status = 'published') published_exercises FROM lessons l WHERE l.unit_id = ? ORDER BY l.position, l.id`, u.id);
    }
    res.json({ course: c, levels });
  });
  r.patch('/courses/:id', async (req, res) => {
    const c = need(await db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const v = await courseInput(req.body || {}, true);
    if (v.slug && await db.get('SELECT 1 x FROM courses WHERE slug = ? AND id != ?', v.slug, c.id)) throw bad('err.fix_fields', { slug: 'val.slug_taken' });
    const keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE courses SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), c.id);
    await audit(req, 'course.update', 'course', c.id, v);
    res.json(await db.get('SELECT * FROM courses WHERE id = ?', c.id));
  });
  r.post('/courses/:id/status', async (req, res) => {
    const c = need(await db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const status = (req.body || {}).status;
    if (!STATUS.includes(status)) throw bad('val.unknown_status');
    if (status === 'published') {
      const n = (await db.get("SELECT COUNT(*) n FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = ? AND l.status = 'published'", c.id)).n;
      if (!n) throw bad('err.course_needs_lesson');
    }
    await db.run('UPDATE courses SET status = ?, updated_at = ? WHERE id = ?', status, now(), c.id);
    await audit(req, 'course.' + status, 'course', c.id, { from: c.status });
    res.json(await db.get('SELECT * FROM courses WHERE id = ?', c.id));
  });
  r.delete('/courses/:id', auth.requireRole('admin'), async (req, res) => {
    confirmed(req);
    const c = need(await db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    if (c.status === 'published') throw bad('err.course_delete_published');
    if (req.body.title !== c.title) throw bad('err.course_delete_confirm');
    await db.run('DELETE FROM courses WHERE id = ?', c.id);
    await audit(req, 'course.delete', 'course', c.id, { title: c.title });
    res.json({ ok: true });
  });

  /* ---------- levels ---------- */
  const levelInput = async (b, partial) => {
    const e = {}, v = {};
    if (!partial || b.code !== undefined) { const code = clean(b.code, 20).toUpperCase(); if (!/^[A-Z0-9 _-]{1,20}$/.test(code) || !settings.all().available_levels.map((x) => x.toUpperCase()).includes(code)) e.code = 'val.level_code'; else v.code = code; }
    if (!partial || b.title !== undefined) { const t = clean(b.title, 80); if (t.length < 2) e.title = 'val.title_required'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 300);
    if (b.unlock_rule !== undefined) { if (!['sequential', 'open'].includes(b.unlock_rule)) e.unlock_rule = 'val.unlock_rule_level'; else v.unlock_rule = b.unlock_rule; }
    if (b.translations !== undefined) v.translations = cleanNavTranslations(b.translations, { title: 80, description: 300 });
    if (b.unlock_threshold_pct !== undefined) { const n = Number(b.unlock_threshold_pct); if (!Number.isInteger(n) || n < 0 || n > 100) e.unlock_threshold_pct = 'val.percent_range'; else v.unlock_threshold_pct = n; }
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  };
  r.post('/courses/:id/levels', async (req, res) => {
    const c = need(await db.get('SELECT id FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const v = await levelInput(req.body || {}, false);
    if (await db.get('SELECT 1 x FROM levels WHERE course_id = ? AND code = ?', c.id, v.code)) throw bad('err.fix_fields', { code: 'val.level_exists' });
    const id = (await db.run('INSERT INTO levels (course_id, code, title, description, position, unlock_rule, unlock_threshold_pct) VALUES (?,?,?,?,?,?,?)', c.id, v.code, v.title, v.description || '', await nextPos('levels', 'course_id', c.id), v.unlock_rule || 'sequential', v.unlock_threshold_pct ?? 60)).id;
    if (v.translations) await db.run('UPDATE levels SET translations = ? WHERE id = ?', v.translations, id);
    await audit(req, 'level.create', 'level', id, v);
    res.status(201).json(await db.get('SELECT * FROM levels WHERE id = ?', id));
  });
  r.patch('/levels/:id', async (req, res) => {
    const l = need(await db.get('SELECT * FROM levels WHERE id = ?', int(req.params.id)), 'Level');
    const v = await levelInput(req.body || {}, true);
    if (v.code && await db.get('SELECT 1 x FROM levels WHERE course_id = ? AND code = ? AND id != ?', l.course_id, v.code, l.id)) throw bad('err.fix_fields', { code: 'val.level_exists' });
    const keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE levels SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => v[k]), l.id);
    await audit(req, 'level.update', 'level', l.id, v);
    res.json(await db.get('SELECT * FROM levels WHERE id = ?', l.id));
  });
  r.delete('/levels/:id', async (req, res) => {
    confirmed(req);
    const l = need(await db.get('SELECT * FROM levels WHERE id = ?', int(req.params.id)), 'Level');
    await db.run('DELETE FROM levels WHERE id = ?', l.id);
    await audit(req, 'level.delete', 'level', l.id, { code: l.code });
    res.json({ ok: true });
  });
  const reorder = async (table, scopeCol, scopeVal, ids) => {
    const rows = (await db.all(`SELECT id FROM ${table} WHERE ${scopeCol} = ?`, scopeVal)).map((x) => x.id);
    if (!Array.isArray(ids) || ids.length !== rows.length || !ids.every((i) => rows.includes(Number(i))) || new Set(ids).size !== ids.length) throw bad('err.reorder_incomplete');
    await db.tx(async () => { for (const [i, id] of ids.entries()) await db.run(`UPDATE ${table} SET position = ? WHERE id = ?`, i, Number(id)); });
  };
  r.post('/courses/:id/levels/reorder', async (req, res) => { await reorder('levels', 'course_id', int(req.params.id), (req.body || {}).ids); await audit(req, 'level.reorder', 'course', req.params.id, {}); res.json({ ok: true }); });

  /* ---------- units ---------- */
  const unitInput = async (b, partial) => {
    const e = {}, v = {};
    if (!partial || b.title !== undefined) { const t = clean(b.title, 80); if (t.length < 2) e.title = 'val.title_required'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 300);
    if (b.translations !== undefined) v.translations = cleanNavTranslations(b.translations, { title: 80, description: 300 });
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  };
  r.post('/levels/:id/units', async (req, res) => {
    const l = need(await db.get('SELECT id FROM levels WHERE id = ?', int(req.params.id)), 'Level');
    const v = await unitInput(req.body || {}, false);
    const id = (await db.run('INSERT INTO units (level_id, title, description, position) VALUES (?,?,?,?)', l.id, v.title, v.description || '', await nextPos('units', 'level_id', l.id))).id;
    if (v.translations) await db.run('UPDATE units SET translations = ? WHERE id = ?', v.translations, id);
    await audit(req, 'unit.create', 'unit', id, v);
    res.status(201).json(await db.get('SELECT * FROM units WHERE id = ?', id));
  });
  r.patch('/units/:id', async (req, res) => {
    const u = need(await db.get('SELECT * FROM units WHERE id = ?', int(req.params.id)), 'Unit');
    const v = await unitInput(req.body || {}, true);
    const keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE units SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => v[k]), u.id);
    await audit(req, 'unit.update', 'unit', u.id, v);
    res.json(await db.get('SELECT * FROM units WHERE id = ?', u.id));
  });
  r.delete('/units/:id', async (req, res) => { confirmed(req); const u = need(await db.get('SELECT * FROM units WHERE id = ?', int(req.params.id)), 'Unit'); await db.run('DELETE FROM units WHERE id = ?', u.id); await audit(req, 'unit.delete', 'unit', u.id, { title: u.title }); res.json({ ok: true }); });
  r.post('/levels/:id/units/reorder', async (req, res) => { await reorder('units', 'level_id', int(req.params.id), (req.body || {}).ids); await audit(req, 'unit.reorder', 'level', req.params.id, {}); res.json({ ok: true }); });

  /* ---------- lessons ---------- */
  const courseOfUnit = async (unitId) => await db.get('SELECT lv.course_id FROM units u JOIN levels lv ON lv.id = u.level_id WHERE u.id = ?', unitId);
  const courseOfLesson = async (lessonId) => await db.get('SELECT lv.course_id FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE l.id = ?', lessonId);
  async function lessonInput(b, partial, lessonId, courseId) {
    const e = {}, v = {};
    if (!partial || b.title !== undefined) { const t = clean(b.title, 100); if (t.length < 2) e.title = 'val.title_required'; else v.title = t; }
    if (b.description !== undefined) v.description = clean(b.description, 300);
    if (b.translations !== undefined) v.translations = cleanNavTranslations(b.translations, { title: 100, description: 300 });
    if (b.xp_reward !== undefined) { const n = Number(b.xp_reward); if (!Number.isInteger(n) || n < 0 || n > 500) e.xp_reward = 'val.xp_range'; else v.xp_reward = n; }
    if (b.unlock_rule !== undefined) { if (!['sequential', 'open', 'prerequisite'].includes(b.unlock_rule)) e.unlock_rule = 'val.unlock_rule'; else v.unlock_rule = b.unlock_rule; }
    if (b.prerequisite_lesson_id !== undefined) {
      const pid = b.prerequisite_lesson_id === null || b.prerequisite_lesson_id === '' ? null : Number(b.prerequisite_lesson_id);
      if (pid !== null) {
        const pc = await courseOfLesson(pid);
        if (!Number.isInteger(pid) || !pc || pc.course_id !== courseId) e.prerequisite_lesson_id = 'val.prerequisite_course';
        else if (lessonId && await wouldCycle(lessonId, pid)) e.prerequisite_lesson_id = 'val.prerequisite_loop';
        else v.prerequisite_lesson_id = pid;
      } else v.prerequisite_lesson_id = null;
    }
    const rule = v.unlock_rule || (partial && lessonId ? (await db.get('SELECT unlock_rule FROM lessons WHERE id = ?', lessonId)).unlock_rule : 'sequential');
    const pre = v.prerequisite_lesson_id !== undefined ? v.prerequisite_lesson_id : (lessonId ? (await db.get('SELECT prerequisite_lesson_id p FROM lessons WHERE id = ?', lessonId)).p : null);
    if (rule === 'prerequisite' && !pre && !e.prerequisite_lesson_id) e.prerequisite_lesson_id = 'val.prerequisite_required';
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  }
  async function wouldCycle(lessonId, pid) {
    let cur = pid, guard = 0;
    while (cur && guard++ < 100) { if (cur === lessonId) return true; const row = await db.get('SELECT prerequisite_lesson_id p FROM lessons WHERE id = ?', cur); cur = row && row.p; }
    return false;
  }
  r.post('/units/:id/lessons', async (req, res) => {
    const u = need(await db.get('SELECT id FROM units WHERE id = ?', int(req.params.id)), 'Unit');
    const v = await lessonInput(req.body || {}, false, null, (await courseOfUnit(u.id)).course_id);
    const t = now();
    const id = (await db.run('INSERT INTO lessons (unit_id, title, description, position, status, unlock_rule, prerequisite_lesson_id, xp_reward, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      u.id, v.title, v.description || '', await nextPos('lessons', 'unit_id', u.id), 'draft', v.unlock_rule || 'sequential', v.prerequisite_lesson_id || null, v.xp_reward ?? settings.all().xp_lesson_bonus, t, t)).id;
    if (v.translations) await db.run('UPDATE lessons SET translations = ? WHERE id = ?', v.translations, id);
    await audit(req, 'lesson.create', 'lesson', id, v);
    res.status(201).json(await db.get('SELECT * FROM lessons WHERE id = ?', id));
  });
  r.get('/lessons/:id', async (req, res) => {
    const l = need(await db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const c = await courseOfLesson(l.id);
    res.json({ lesson: l, courseId: c.course_id, courseTitle: (await db.get('SELECT title FROM courses WHERE id = ?', c.course_id)).title, exercises: await db.all('SELECT id, type, position, prompt, sentence, status, difficulty FROM exercises WHERE lesson_id = ? ORDER BY position, id', l.id),
      siblings: await db.all(`SELECT l2.id, l2.title FROM lessons l2 JOIN units u ON u.id = l2.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = ? AND l2.id != ? ORDER BY lv.position, u.position, l2.position`, c.course_id, l.id) });
  });
  r.patch('/lessons/:id', async (req, res) => {
    const l = need(await db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const v = await lessonInput(req.body || {}, true, l.id, (await courseOfLesson(l.id)).course_id);
    if (v.unlock_rule && v.unlock_rule !== 'prerequisite' && v.prerequisite_lesson_id === undefined) v.prerequisite_lesson_id = null;
    const keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE lessons SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), l.id);
    await audit(req, 'lesson.update', 'lesson', l.id, v);
    res.json(await db.get('SELECT * FROM lessons WHERE id = ?', l.id));
  });
  r.post('/lessons/:id/status', async (req, res) => {
    const l = need(await db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const status = (req.body || {}).status;
    if (!STATUS.includes(status)) throw bad('val.unknown_status');
    if (status === 'published') {
      const exs = await db.all("SELECT * FROM exercises WHERE lesson_id = ? AND status = 'published'", l.id);
      if (!exs.length) throw bad('err.lesson_needs_exercise');
      const problems = [];
      for (const e of exs) { const errs = X.validate(await loadExercise(e)); if (errs.length) problems.push(req.t('err.exercise_problem', { n: e.position + 1, type: req.t('ex.type.' + e.type), reason: req.t(errs[0].message, errs[0].params) })); }
      if (problems.length) throw bad('err.lesson_fix_exercises', null, { list: problems.join(' | ') });
    }
    await db.run('UPDATE lessons SET status = ?, updated_at = ? WHERE id = ?', status, now(), l.id);
    await audit(req, 'lesson.' + status, 'lesson', l.id, { from: l.status });
    res.json(await db.get('SELECT * FROM lessons WHERE id = ?', l.id));
  });
  r.post('/lessons/:id/duplicate', async (req, res) => {
    const l = need(await db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const id = await db.tx(async () => {
      const t = now();
      const nid = (await db.run('INSERT INTO lessons (unit_id, title, description, position, status, unlock_rule, prerequisite_lesson_id, xp_reward, created_at, updated_at, translations) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        l.unit_id, (l.title + ' (copy)').slice(0, 100), l.description, await nextPos('lessons', 'unit_id', l.unit_id), 'draft', l.unlock_rule === 'prerequisite' ? 'sequential' : l.unlock_rule, null, l.xp_reward, t, t, l.translations)).id;
      for (const e of await db.all('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY position, id', l.id)) await copyExercise(e, nid, e.position);
      return nid;
    });
    await audit(req, 'lesson.duplicate', 'lesson', id, { from: l.id });
    res.status(201).json(await db.get('SELECT * FROM lessons WHERE id = ?', id));
  });
  r.delete('/lessons/:id', async (req, res) => {
    confirmed(req);
    const l = need(await db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    await db.run('DELETE FROM lessons WHERE id = ?', l.id);
    await audit(req, 'lesson.delete', 'lesson', l.id, { title: l.title });
    res.json({ ok: true });
  });
  r.post('/units/:id/lessons/reorder', async (req, res) => { await reorder('lessons', 'unit_id', int(req.params.id), (req.body || {}).ids); await audit(req, 'lesson.reorder', 'unit', req.params.id, {}); res.json({ ok: true }); });

  /* ---------- exercises ---------- */
  const loadExercise = async (row) => ({ ...row, translations: parseJson(row.translations), options: (await db.all('SELECT text, match_text, is_correct FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', row.id)).map((o) => ({ text: o.text, match_text: o.match_text, is_correct: !!o.is_correct })) });
  async function saveOptions(exId, options) {
    await db.run('DELETE FROM exercise_options WHERE exercise_id = ?', exId);
    for (const [i, o] of options.filter((o) => o.text).entries()) await db.run('INSERT INTO exercise_options (exercise_id, text, match_text, is_correct, position) VALUES (?,?,?,?,?)', exId, o.text, o.match_text || '', o.is_correct ? 1 : 0, i);
  }
  async function insertExercise(lessonId, ex, position) {
    const t = now();
    const id = (await db.run(`INSERT INTO exercises (lesson_id, type, position, difficulty, prompt, answer, sentence, passage, audio_text, audio_url, translation, explanation, hint, direction, status, vocabulary_id, translations, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      lessonId, ex.type, position, ex.difficulty, ex.prompt, ex.answer, ex.sentence, ex.passage, ex.audio_text, ex.audio_url, ex.translation, ex.explanation, ex.hint, ex.direction, ex.status, ex.vocabulary_id, JSON.stringify(ex.translations || {}), t, t)).id;
    await saveOptions(id, ex.options);
    return id;
  }
  async function copyExercise(row, lessonId, position) { return await insertExercise(lessonId, { ...(await loadExercise(row)) }, position); }
  async function checkVocabId(ex) { if (ex.vocabulary_id && !await db.get('SELECT 1 x FROM vocabulary WHERE id = ?', ex.vocabulary_id)) ex.vocabulary_id = null; }

  r.post('/exercises/validate', async (req, res) => { const ex = X.normalizeInput(req.body || {}); res.json({ errors: X.validate(ex) }); });
  r.get('/exercise-types', async (req, res) => res.json({ types: X.TYPE_IDS.map((id) => ({ id })) }));
  r.get('/exercises/:id', async (req, res) => { const e = need(await db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise'); res.json(await loadExercise(e)); });
  r.post('/lessons/:id/exercises', async (req, res) => {
    const l = need(await db.get('SELECT id FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const ex = X.normalizeInput(req.body || {}); await checkVocabId(ex);
    const errs = X.validate(ex);
    if (errs.length && ex.status === 'published') throw bad('err.exercise_cannot_publish', Object.fromEntries(errs.map((e) => [e.field, { key: e.message, params: e.params }])), { reason: req.t(errs[0].message, errs[0].params) });
    if (!X.TYPES[ex.type]) throw bad('val.type_required', { type: 'val.required' });
    const id = await db.tx(async () => await insertExercise(l.id, ex, await nextPos('exercises', 'lesson_id', l.id)));
    await audit(req, 'exercise.create', 'exercise', id, { type: ex.type, lesson: l.id });
    res.status(201).json(await loadExercise(await db.get('SELECT * FROM exercises WHERE id = ?', id)));
  });
  r.put('/exercises/:id', async (req, res) => {
    const old = need(await db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise');
    const ex = X.normalizeInput(req.body || {}); await checkVocabId(ex);
    const errs = X.validate(ex);
    if (errs.length && ex.status === 'published') throw bad('err.exercise_cannot_publish', Object.fromEntries(errs.map((e) => [e.field, { key: e.message, params: e.params }])), { reason: req.t(errs[0].message, errs[0].params) });
    await db.tx(async () => {
      await db.run(`UPDATE exercises SET type=?, difficulty=?, prompt=?, answer=?, sentence=?, passage=?, audio_text=?, audio_url=?, translation=?, explanation=?, hint=?, direction=?, status=?, vocabulary_id=?, translations=?, updated_at=? WHERE id=?`,
        ex.type, ex.difficulty, ex.prompt, ex.answer, ex.sentence, ex.passage, ex.audio_text, ex.audio_url, ex.translation, ex.explanation, ex.hint, ex.direction, ex.status, ex.vocabulary_id, JSON.stringify(ex.translations || {}), now(), old.id);
      await saveOptions(old.id, ex.options);
    });
    await audit(req, 'exercise.update', 'exercise', old.id, { type: ex.type });
    res.json(await loadExercise(await db.get('SELECT * FROM exercises WHERE id = ?', old.id)));
  });
  r.delete('/exercises/:id', async (req, res) => { confirmed(req); const e = need(await db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise'); await db.run('DELETE FROM exercises WHERE id = ?', e.id); await audit(req, 'exercise.delete', 'exercise', e.id, { lesson: e.lesson_id }); res.json({ ok: true }); });
  r.post('/exercises/:id/duplicate', async (req, res) => {
    const e = need(await db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise');
    const id = await db.tx(async () => await copyExercise(e, e.lesson_id, await nextPos('exercises', 'lesson_id', e.lesson_id)));
    await audit(req, 'exercise.duplicate', 'exercise', id, { from: e.id });
    res.status(201).json(await loadExercise(await db.get('SELECT * FROM exercises WHERE id = ?', id)));
  });
  r.post('/lessons/:id/exercises/reorder', async (req, res) => { await reorder('exercises', 'lesson_id', int(req.params.id), (req.body || {}).ids); await audit(req, 'exercise.reorder', 'lesson', req.params.id, {}); res.json({ ok: true }); });
  // preview exactly what a learner sees; checking an answer here never stores anything
  r.get('/exercises/:id/preview', async (req, res) => { const e = need(await db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise'); res.json({ exercise: X.payload(e, await db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', e.id), 7), problems: X.validate(await loadExercise(e)) }); });
  r.post('/exercises/:id/preview-check', async (req, res) => {
    const e = need(await db.get('SELECT * FROM exercises WHERE id = ?', int(req.params.id)), 'Exercise');
    const g = X.grade(e, await db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', e.id), (req.body || {}).answer, 7);
    if (g.invalid) throw bad('err.invalid_answer');
    res.json({ correct: g.correct, typo: !!g.typo, correctAnswer: g.correctAnswer, explanation: e.explanation, translation: e.translation });
  });

  /* ---------- import / export (JSON or CSV; validated row by row, all or nothing) ---------- */
  const CSV_HEAD = ['type', 'prompt', 'sentence', 'answer', 'passage', 'audio_text', 'translation', 'explanation', 'hint', 'direction', 'difficulty', 'status', 'options'];
  const optionsToCell = (opts) => opts.map((o) => (o.is_correct ? '*' : '') + o.text + (o.match_text ? '=>' + o.match_text : '')).join(' ;; ');
  const cellToOptions = (cell) => String(cell || '').split(';;').map((x) => x.trim()).filter(Boolean).map((x) => {
    const correct = x.startsWith('*'); const t = correct ? x.slice(1).trim() : x; const [a, b] = t.split('=>');
    return { text: (a || '').trim(), match_text: (b || '').trim(), is_correct: correct };
  });
  r.get('/lessons/:id/export', async (req, res) => {
    const l = need(await db.get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const rows = [];
    for (const row of await db.all('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY position, id', l.id)) rows.push(await loadExercise(row));
    await audit(req, 'lesson.export', 'lesson', l.id, { format: req.query.format });
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="lesson-${l.id}-exercises.csv"`);
      return res.send(csv.stringify(CSV_HEAD, rows.map((e) => ({ ...e, options: optionsToCell(e.options) }))));
    }
    res.setHeader('Content-Disposition', `attachment; filename="lesson-${l.id}-exercises.json"`);
    res.json({ format: 'lexi-exercises', version: 1, lesson: l.title, exercises: rows.map((e) => Object.fromEntries(CSV_HEAD.filter((k) => k !== 'options').map((k) => [k, e[k]]).concat([['options', e.options], ['translations', e.translations]]))) });
  });
  r.post('/lessons/:id/import', async (req, res) => {
    const l = need(await db.get('SELECT id FROM lessons WHERE id = ?', int(req.params.id)), 'Lesson');
    const { format, content } = req.body || {};
    if (typeof content !== 'string' || content.length > 1000000) throw bad('err.import_content_exercises');
    let items;
    try {
      if (format === 'csv') items = csv.objects(content).map((o) => ({ ...o, options: cellToOptions(o.options) }));
      else { const j = JSON.parse(content); items = Array.isArray(j) ? j : j.exercises; if (!Array.isArray(items)) throw new Error('missing exercises array'); }
    } catch (e) { throw bad('err.import_unreadable', null, { reason: e.message }); }
    if (!items.length) throw bad('err.import_no_exercises');
    if (items.length > 200) throw bad('err.import_max_exercises');
    const prepared = [], problems = [];
    items.forEach((raw, i) => {
      const ex = X.normalizeInput({ ...raw, options: (raw.options || []).map((o) => ({ text: o.text, match_text: o.match_text, is_correct: o.is_correct === true || o.correct === true })) });
      const errs = X.validate(ex);
      if (errs.length) problems.push({ row: i + 1, problems: errs.map((e) => e.message) }); else prepared.push(ex);
    });
    if (problems.length) return res.status(422).json({ error: `${problems.length} row(s) have problems. Nothing was imported.`, problems: problems.slice(0, 30) });
    const ids = await db.tx(async () => { let pos = await nextPos('exercises', 'lesson_id', l.id); const made = []; for (const ex of prepared) made.push(await insertExercise(l.id, { ...ex, vocabulary_id: null }, pos++)); return made; });
    await audit(req, 'exercise.import', 'lesson', l.id, { count: ids.length, format });
    res.status(201).json({ imported: ids.length });
  });
  r.get('/courses/:id/export', async (req, res) => {
    const c = need(await db.get('SELECT * FROM courses WHERE id = ?', int(req.params.id)), 'Course');
    const levels = [];
    for (const lv of await db.all('SELECT * FROM levels WHERE course_id = ? ORDER BY position', c.id)) {
      const units = [];
      for (const u of await db.all('SELECT * FROM units WHERE level_id = ? ORDER BY position', lv.id)) {
        const lessons = [];
        for (const l of await db.all('SELECT * FROM lessons WHERE unit_id = ? ORDER BY position', u.id)) {
          const exercises = [];
          for (const row of await db.all('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY position', l.id)) {
            const e = await loadExercise(row);
            exercises.push({ ...Object.fromEntries(CSV_HEAD.filter((k) => k !== 'options').map((k) => [k, e[k]])), options: e.options });
          }
          lessons.push({ title: l.title, description: l.description, status: l.status, unlock_rule: l.unlock_rule === 'prerequisite' ? 'sequential' : l.unlock_rule, xp_reward: l.xp_reward, exercises });
        }
        units.push({ title: u.title, description: u.description, lessons });
      }
      levels.push({ code: lv.code, title: lv.title, description: lv.description, unlock_rule: lv.unlock_rule, unlock_threshold_pct: lv.unlock_threshold_pct, units });
    }
    await audit(req, 'course.export', 'course', c.id, {});
    res.setHeader('Content-Disposition', `attachment; filename="${c.slug}.json"`);
    res.json({ format: 'lexi-course', version: 1, course: { title: c.title, description: c.description, track: c.track }, levels });
  });

  return r;
};
module.exports.slugify = slugify;
