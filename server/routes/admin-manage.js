/* Administrator API, part 2: vocabulary, uploads, users, statistics, settings, audit log. */
const express = require('express');
const crypto = require('node:crypto');
const csv = require('../lib/csv');
const { now, clean, int, clamp, HttpError, bad, escapeLike, randomToken, addDays } = require('../lib/util');
const { publicUser } = require('./auth');

const POS = ['', 'phrasal verb', 'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'determiner', 'other'];
const CEFR = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const AUDIO_TYPES = {
  mp3: { mime: 'audio/mpeg', ok: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  ogg: { mime: 'audio/ogg', ok: (b) => b.slice(0, 4).toString('latin1') === 'OggS' },
  wav: { mime: 'audio/wav', ok: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE' },
};
const ROLES = ['learner', 'editor', 'admin'];

module.exports = function manageRoutes({ db, settings, auth, core, audit, opts }) {
  const r = express.Router();
  const staff = auth.requireRole('editor', 'admin'), adminOnly = auth.requireRole('admin');
  const need = (row, what) => { if (!row) throw new HttpError(404, 'err.' + what.toLowerCase() + '_not_found'); return row; };
  const page = (req, def = 20) => { const size = clamp(int(req.query.pageSize, def), 5, 100), p = Math.max(1, int(req.query.page, 1)); return { size, p, off: (p - 1) * size }; };

  /* ---------- vocabulary ---------- */
  async function vocabInput(b, partial) {
    const e = {}, v = {};
    if (!partial || b.en !== undefined) { const x = clean(b.en, 120); if (!x) e.en = 'val.word_en_required'; else v.en = x; }
    if (!partial || b.uz !== undefined) { const x = clean(b.uz, 200); if (!x) e.uz = 'val.word_uz_required'; else v.uz = x; }
    if (b.pos !== undefined) { if (!POS.includes(clean(b.pos, 20))) e.pos = 'val.pos'; else v.pos = clean(b.pos, 20); }
    if (b.example !== undefined) v.example = clean(b.example, 300);
    if (b.example_uz !== undefined) v.example_uz = clean(b.example_uz, 300);
    if (b.cefr !== undefined) { if (!CEFR.includes(clean(b.cefr, 4).toUpperCase())) e.cefr = 'val.cefr'; else v.cefr = clean(b.cefr, 4).toUpperCase(); }
    if (b.audio_url !== undefined) { const a = clean(b.audio_url, 200); if (a && !/^\/uploads\/[A-Za-z0-9_-]{6,40}$/.test(a)) e.audio_url = 'val.audio_upload_only'; else v.audio_url = a; }
    if (b.translations !== undefined) {
      const t = b.translations && typeof b.translations === 'object' && !Array.isArray(b.translations) ? b.translations : null;
      if (!t) e.translations = 'val.translations_object';
      else { const out = {}; for (const [k, val] of Object.entries(t)) { if (/^[a-z]{2,8}(_example)?$/.test(k) && clean(val, 300)) out[k] = clean(val, 200); } v.translations = JSON.stringify(out); }
    }
    for (const k of ['course_id', 'level_id', 'unit_id', 'lesson_id']) if (b[k] !== undefined) {
      const val = b[k] === null || b[k] === '' ? null : Number(b[k]);
      const table = { course_id: 'courses', level_id: 'levels', unit_id: 'units', lesson_id: 'lessons' }[k];
      if (val !== null && (!Number.isInteger(val) || !await db.get(`SELECT 1 x FROM ${table} WHERE id = ?`, val))) e[k] = 'val.not_found'; else v[k] = val;
    }
    if (b.status !== undefined) { if (!['draft', 'published', 'archived'].includes(b.status)) e.status = 'val.unknown_status'; else v.status = b.status; }
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  }
  const vocabRow = (v) => ({ ...v, translations: (() => { try { return JSON.parse(v.translations); } catch (_) { return {}; } })() });
  r.get('/vocabulary', staff, async (req, res) => {
    const { size, p, off } = page(req);
    const where = ['1=1'], args = [];
    const q = clean(req.query.q, 60);
    if (q) { where.push("(v.en LIKE ? ESCAPE '\\' OR v.uz LIKE ? ESCAPE '\\')"); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    for (const k of ['course_id', 'level_id', 'unit_id', 'lesson_id']) if (req.query[k]) { where.push(`v.${k} = ?`); args.push(int(req.query[k])); }
    if (req.query.status && ['draft', 'published', 'archived'].includes(req.query.status)) { where.push('v.status = ?'); args.push(req.query.status); }
    if (req.query.cefr && CEFR.includes(req.query.cefr)) { where.push('v.cefr = ?'); args.push(req.query.cefr); }
    const total = (await db.get(`SELECT COUNT(*) n FROM vocabulary v WHERE ${where.join(' AND ')}`, ...args)).n;
    const items = (await db.all(`SELECT v.*, c.title course_title, un.title unit_title FROM vocabulary v LEFT JOIN courses c ON c.id = v.course_id LEFT JOIN units un ON un.id = v.unit_id WHERE ${where.join(' AND ')} ORDER BY v.id DESC LIMIT ? OFFSET ?`, ...args, size, off)).map(vocabRow);
    res.json({ total, page: p, pageSize: size, items });
  });
  r.post('/vocabulary', staff, async (req, res) => {
    const v = await vocabInput(req.body || {}, false);
    if (await db.get('SELECT 1 x FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE', v.en, v.uz)) throw bad('err.fix_fields', { en: 'val.word_exists' });
    const t = now();
    const id = (await db.run(`INSERT INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, audio_url, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      v.course_id ?? null, v.level_id ?? null, v.unit_id ?? null, v.lesson_id ?? null, v.en, v.uz, v.translations || '{}', v.pos || '', v.example || '', v.example_uz || '', v.audio_url || '', v.cefr || '', v.status || 'published', t, t)).id;
    await audit(req, 'vocabulary.create', 'vocabulary', id, { en: v.en });
    res.status(201).json(vocabRow(await db.get('SELECT * FROM vocabulary WHERE id = ?', id)));
  });
  r.patch('/vocabulary/:id', staff, async (req, res) => {
    const old = need(await db.get('SELECT * FROM vocabulary WHERE id = ?', int(req.params.id)), 'Word');
    const v = await vocabInput(req.body || {}, true);
    const en = v.en ?? old.en, uz = v.uz ?? old.uz;
    if (await db.get('SELECT 1 x FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE AND id != ?', en, uz, old.id)) throw bad('err.fix_fields', { en: 'val.word_exists' });
    const keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE vocabulary SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), old.id);
    await audit(req, 'vocabulary.update', 'vocabulary', old.id, { fields: keys });
    res.json(vocabRow(await db.get('SELECT * FROM vocabulary WHERE id = ?', old.id)));
  });
  r.post('/vocabulary/bulk-status', staff, async (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 500) : [];
    const status = (req.body || {}).status;
    if (!ids.length || !['draft', 'published', 'archived'].includes(status)) throw bad('err.choose_words_status');
    await db.tx(async () => { for (const id of ids) await db.run('UPDATE vocabulary SET status = ?, updated_at = ? WHERE id = ?', status, now(), id); });
    await audit(req, 'vocabulary.bulk_status', 'vocabulary', '', { count: ids.length, status });
    res.json({ updated: ids.length });
  });
  const VOCAB_HEAD = ['en', 'uz', 'pos', 'cefr', 'example', 'example_uz', 'ru', 'status', 'course', 'unit', 'lesson'];
  r.get('/vocabulary/export', staff, async (req, res) => {
    const rows = (await db.all(`SELECT v.*, c.title course, un.title unit, l.title lesson FROM vocabulary v LEFT JOIN courses c ON c.id = v.course_id LEFT JOIN units un ON un.id = v.unit_id LEFT JOIN lessons l ON l.id = v.lesson_id ORDER BY v.id`)).map((v) => ({ ...v, ru: (vocabRow(v).translations.ru) || '' }));
    await audit(req, 'vocabulary.export', 'vocabulary', '', { format: req.query.format, count: rows.length });
    if (req.query.format === 'json') { res.setHeader('Content-Disposition', 'attachment; filename="vocabulary.json"'); return res.json({ format: 'lexi-vocabulary', version: 1, items: rows.map((v) => Object.fromEntries(VOCAB_HEAD.map((k) => [k, v[k] || '']))) }); }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="vocabulary.csv"');
    res.send(csv.stringify(VOCAB_HEAD, rows));
  });
  /* bulk import: CSV (header row: en,uz,pos,cefr,example,example_uz,ru,status,course,unit,lesson) or JSON { items: [...] } */
  r.post('/vocabulary/import', staff, async (req, res) => {
    const { format, content, courseId, lessonId } = req.body || {};
    if (typeof content !== 'string' || content.length > 2000000) throw bad('err.import_content_vocabulary');
    let items;
    try { if (format === 'json') { const j = JSON.parse(content); items = Array.isArray(j) ? j : j.items; if (!Array.isArray(items)) throw new Error('missing items array'); } else items = csv.objects(content); }
    catch (e) { throw bad('err.import_unreadable', null, { reason: e.message }); }
    if (!items.length) throw bad('err.import_no_rows');
    if (items.length > 5000) throw bad('err.import_max_words');
    const course = courseId ? need(await db.get('SELECT id FROM courses WHERE id = ?', int(courseId)), 'Course') : null;
    const lesson = lessonId ? need(await db.get('SELECT l.id, u.id unit_id, lv.id level_id, lv.course_id FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE l.id = ?', int(lessonId)), 'Lesson') : null;
    const problems = [], ready = [];
    for (const [i, raw] of items.entries()) {
      try {
        const v = await vocabInput({ en: raw.en, uz: raw.uz, pos: raw.pos || '', cefr: raw.cefr || '', example: raw.example || '', example_uz: raw.example_uz || '', status: ['draft', 'published', 'archived'].includes(raw.status) ? raw.status : 'published',
          translations: raw.ru ? { ru: raw.ru } : (raw.translations && typeof raw.translations === 'object' ? raw.translations : {}) }, false);
        ready.push(v);
      } catch (e) { problems.push({ row: i + 1, problems: Object.values(e.fields || { _: e.message }) }); }
    }
    if (problems.length) return res.status(422).json({ error: `${problems.length} row(s) have problems. Nothing was imported.`, problems: problems.slice(0, 30) });
    let added = 0, skipped = 0;
    await db.tx(async () => {
      const t = now();
      for (const v of ready) {
        const r2 = await db.run(`INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, audio_url, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          lesson ? lesson.course_id : course ? course.id : null, lesson ? lesson.level_id : null, lesson ? lesson.unit_id : null, lesson ? lesson.id : null, v.en, v.uz, v.translations || '{}', v.pos || '', v.example || '', v.example_uz || '', '', v.cefr || '', v.status || 'published', t, t);
        if (r2.changes) added++; else skipped++;
      }
    });
    await audit(req, 'vocabulary.import', 'vocabulary', '', { added, skipped, format });
    res.status(201).json({ added, skipped });
  });

  /* ---------- audio uploads (raw request body, validated by size and file signature) ---------- */
  r.post('/uploads', staff, express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '2.5mb' }), async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw bad('err.upload_none');
    if (buf.length > 2 * 1024 * 1024) throw bad('err.upload_too_large');
    const name = clean(req.get('x-filename') || 'audio', 100).replace(/[^\w.\- ]/g, '_');
    const ext = (name.split('.').pop() || '').toLowerCase();
    const kind = AUDIO_TYPES[ext];
    if (!kind) throw bad('err.upload_type');
    if (!kind.ok(buf)) throw bad('err.upload_mismatch', null, { type: ext.toUpperCase() });
    const id = randomToken(12);
    // the audio is kept in the database (base64), so it survives on hosts without a persistent disk
    await db.run('INSERT INTO uploads (id, filename, mime, size, uploaded_by, created_at, data) VALUES (?,?,?,?,?,?,?)', id, name, kind.mime, buf.length, req.user.id, now(), buf.toString('base64'));
    await audit(req, 'upload.create', 'upload', id, { name, size: buf.length });
    res.status(201).json({ url: '/uploads/' + id, filename: name, size: buf.length });
  });

  /* ---------- users (administrators only) ---------- */
  const userSummary = (u) => ({ id: u.id, email: u.email, displayName: u.display_name, role: u.role, status: u.status, xpTotal: u.xp_total, createdAt: u.created_at, lastActiveAt: u.last_active_at, timezone: u.timezone });
  r.get('/users', adminOnly, async (req, res) => {
    const { size, p, off } = page(req);
    const where = ['1=1'], args = [];
    const q = clean(req.query.q, 60);
    if (q) { where.push("(u.email LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')"); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); args.push(req.query.role); }
    if (['active', 'suspended'].includes(req.query.status)) { where.push('u.status = ?'); args.push(req.query.status); }
    const total = (await db.get(`SELECT COUNT(*) n FROM users u WHERE ${where.join(' AND ')}`, ...args)).n;
    const items = (await db.all(`SELECT u.*, (SELECT COUNT(*) FROM user_progress p WHERE p.user_id = u.id) lessons FROM users u WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT ? OFFSET ?`, ...args, size, off)).map((u) => ({ ...userSummary(u), lessons: u.lessons }));
    res.json({ total, page: p, pageSize: size, items });
  });
  r.get('/users/:id', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    const st = await core.streakInfo(u);
    const acc = await db.get('SELECT COUNT(*) n, SUM(is_correct) c FROM exercise_responses WHERE user_id = ?', u.id);
    res.json({ user: userSummary(u), streak: st, today: await core.dayInfo(u), hearts: core.heartState(u),
      lessonsCompleted: (await db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', u.id)).n,
      attempts: (await db.get('SELECT COUNT(*) n FROM exercise_responses WHERE user_id = ?', u.id)).n,
      accuracy: acc.n ? Math.round(100 * acc.c / acc.n) : null,
      reviewWords: (await db.get('SELECT COUNT(*) n FROM review_items WHERE user_id = ?', u.id)).n,
      achievements: (await core.achievementList(u.id)).filter((a) => a.earnedAt).map((a) => a.code),
      week: await core.weekDays(u),
      recent: await db.all(`SELECT a.id, a.kind, a.status, a.correct, a.incorrect, a.started_at, l.title lesson FROM lesson_attempts a LEFT JOIN lessons l ON l.id = a.lesson_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 10`, u.id) });
  });
  const adminCount = async () => (await db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND status = 'active'")).n;
  r.post('/users/:id/suspend', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    if (u.id === req.user.id) throw bad('err.cannot_suspend_self');
    if (u.role === 'admin' && await adminCount() <= 1) throw bad('err.cannot_suspend_last_admin');
    await db.tx(async () => { await db.run("UPDATE users SET status = 'suspended' WHERE id = ?", u.id); await db.run('DELETE FROM sessions WHERE user_id = ?', u.id); });
    await audit(req, 'user.suspend', 'user', u.id, { email: u.email });
    res.json(userSummary(await db.get('SELECT * FROM users WHERE id = ?', u.id)));
  });
  r.post('/users/:id/reactivate', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    await db.run("UPDATE users SET status = 'active' WHERE id = ?", u.id);
    await audit(req, 'user.reactivate', 'user', u.id, { email: u.email });
    res.json(userSummary(await db.get('SELECT * FROM users WHERE id = ?', u.id)));
  });
  /* strict role rules: only administrators change roles; nobody changes their own role; the last administrator can never be demoted */
  r.post('/users/:id/role', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    const role = (req.body || {}).role;
    if (!ROLES.includes(role)) throw bad('val.unknown_role');
    if (u.id === req.user.id) throw bad('err.cannot_change_own_role');
    if (u.role === 'admin' && role !== 'admin' && await adminCount() <= 1) throw bad('err.cannot_demote_last_admin');
    if (role === 'admin' && u.status !== 'active') throw bad('err.reactivate_first');
    await db.run('UPDATE users SET role = ? WHERE id = ?', role, u.id);
    await audit(req, 'user.role', 'user', u.id, { email: u.email, from: u.role, to: role });
    res.json(userSummary(await db.get('SELECT * FROM users WHERE id = ?', u.id)));
  });
  r.post('/users/:id/reset-progress', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    if ((req.body || {}).confirmEmail !== u.email) throw bad('err.confirm_email');
    await db.tx(async () => {
      for (const t of ['lesson_attempts', 'user_progress', 'xp_transactions', 'user_streaks', 'user_days', 'user_achievements', 'review_items']) await db.run(`DELETE FROM ${t} WHERE user_id = ?`, u.id);
      await db.run('UPDATE users SET xp_total = 0, hearts = ?, hearts_updated_at = ? WHERE id = ?', settings.all().max_hearts, now(), u.id);
    });
    await audit(req, 'user.reset_progress', 'user', u.id, { email: u.email });
    res.json({ ok: true });
  });

  /* ---------- statistics (real records only) ---------- */
  r.get('/stats', adminOnly, async (req, res) => {
    const days = clamp(int(req.query.days, 30), 7, 365);
    const today = new Date().toISOString().slice(0, 10), from = addDays(today, -(days - 1));
    const fromIso = from + 'T00:00:00.000Z';
    const series = (rows, key = 'n') => { const m = Object.fromEntries(rows.map((r2) => [r2.d, r2[key]])); const out = []; for (let i = days - 1; i >= 0; i--) { const d = addDays(today, -i); out.push({ date: d, value: m[d] || 0 }); } return out; };
    const acc = await db.get('SELECT COUNT(*) n, SUM(is_correct) c FROM exercise_responses');
    const active = async (n) => (await db.get('SELECT COUNT(DISTINCT user_id) n FROM user_days WHERE local_date >= ?', addDays(today, -(n - 1)))).n;
    res.json({
      days, totals: {
        users: (await db.get('SELECT COUNT(*) n FROM users')).n, learners: (await db.get("SELECT COUNT(*) n FROM users WHERE role = 'learner'")).n, suspended: (await db.get("SELECT COUNT(*) n FROM users WHERE status = 'suspended'")).n,
        courses: (await db.get('SELECT COUNT(*) n FROM courses')).n, publishedCourses: (await db.get("SELECT COUNT(*) n FROM courses WHERE status = 'published'")).n,
        lessons: (await db.get('SELECT COUNT(*) n FROM lessons')).n, exercises: (await db.get('SELECT COUNT(*) n FROM exercises')).n, vocabulary: (await db.get("SELECT COUNT(*) n FROM vocabulary WHERE status != 'archived'")).n,
        completedLessons: (await db.get("SELECT COUNT(*) n FROM lesson_attempts WHERE kind = 'lesson' AND status = 'completed'")).n,
        exerciseAttempts: (await db.get('SELECT COUNT(*) n FROM exercise_responses')).n,
        accuracy: acc.n ? Math.round(100 * acc.c / acc.n) : null,
      },
      active: { d1: await active(1), d7: await active(7), d30: await active(30), custom: await active(days) },
      signups: series(await db.all("SELECT substr(created_at,1,10) d, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY d", fromIso)),
      activeUsers: series(await db.all('SELECT local_date d, COUNT(DISTINCT user_id) n FROM user_days WHERE local_date >= ? GROUP BY d', from)),
      completions: series(await db.all("SELECT substr(completed_at,1,10) d, COUNT(*) n FROM lesson_attempts WHERE status = 'completed' AND kind = 'lesson' AND completed_at >= ? GROUP BY d", fromIso)),
      attemptsPerDay: series(await db.all('SELECT substr(created_at,1,10) d, COUNT(*) n FROM exercise_responses WHERE created_at >= ? GROUP BY d', fromIso)),
      courses: await db.all(`SELECT c.id, c.title, c.status,
        (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id AND l.status = 'published') lessons,
        (SELECT COUNT(DISTINCT p.user_id) FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id) learners,
        (SELECT COUNT(*) FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id) completed_lessons,
        (SELECT COUNT(*) FROM (SELECT p.user_id FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id AND l.status = 'published' GROUP BY p.user_id
          HAVING COUNT(DISTINCT p.lesson_id) = (SELECT COUNT(*) FROM lessons l2 JOIN units u2 ON u2.id = l2.unit_id JOIN levels lv2 ON lv2.id = u2.level_id WHERE lv2.course_id = c.id AND l2.status = 'published'))) finished_learners
        FROM courses c ORDER BY c.position, c.id`),
      recentAudit: await db.all('SELECT id, admin_email, action, entity, entity_id, created_at FROM audit_log ORDER BY id DESC LIMIT 8'),
    });
  });

  /* ---------- settings ---------- */
  r.get('/settings', adminOnly, async (req, res) => res.json({ settings: settings.all() }));
  r.put('/settings', adminOnly, async (req, res) => {
    const v = settings.validate(req.body || {});
    if (v.errors) throw bad('err.fix_fields', v.errors);
    await settings.update(v.values);
    await audit(req, 'settings.update', 'settings', '', v.values);
    res.json({ settings: settings.all() });
  });

  /* ---------- audit log ---------- */
  r.get('/audit', adminOnly, async (req, res) => {
    const { size, p, off } = page(req, 25);
    const where = ['1=1'], args = [];
    if (req.query.action) { where.push("action LIKE ? ESCAPE '\\'"); args.push(escapeLike(clean(req.query.action, 40)) + '%'); }
    const total = (await db.get(`SELECT COUNT(*) n FROM audit_log WHERE ${where.join(' AND ')}`, ...args)).n;
    const items = (await db.all(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, size, off)).map((a) => ({ ...a, details: (() => { try { return JSON.parse(a.details); } catch (_) { return {}; } })() }));
    res.json({ total, page: p, pageSize: size, items });
  });

  return r;
};
