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
  const need = (row, what) => { if (!row) throw new HttpError(404, `${what} not found.`); return row; };
  const page = (req, def = 20) => { const size = clamp(int(req.query.pageSize, def), 5, 100), p = Math.max(1, int(req.query.page, 1)); return { size, p, off: (p - 1) * size }; };

  /* ---------- vocabulary ---------- */
  function vocabInput(b, partial) {
    const e = {}, v = {};
    if (!partial || b.en !== undefined) { const x = clean(b.en, 120); if (!x) e.en = 'Enter the English word or phrase.'; else v.en = x; }
    if (!partial || b.uz !== undefined) { const x = clean(b.uz, 200); if (!x) e.uz = 'Enter the Uzbek translation.'; else v.uz = x; }
    if (b.pos !== undefined) { if (!POS.includes(clean(b.pos, 20))) e.pos = 'Unknown part of speech.'; else v.pos = clean(b.pos, 20); }
    if (b.example !== undefined) v.example = clean(b.example, 300);
    if (b.example_uz !== undefined) v.example_uz = clean(b.example_uz, 300);
    if (b.cefr !== undefined) { if (!CEFR.includes(clean(b.cefr, 4).toUpperCase())) e.cefr = 'Use A1-C2 or leave empty.'; else v.cefr = clean(b.cefr, 4).toUpperCase(); }
    if (b.audio_url !== undefined) { const a = clean(b.audio_url, 200); if (a && !/^\/uploads\/[A-Za-z0-9_-]{6,40}$/.test(a)) e.audio_url = 'Audio must be uploaded through the admin panel.'; else v.audio_url = a; }
    if (b.translations !== undefined) {
      const t = b.translations && typeof b.translations === 'object' && !Array.isArray(b.translations) ? b.translations : null;
      if (!t) e.translations = 'Translations must be an object such as {"ru":"..."}.';
      else { const out = {}; for (const [k, val] of Object.entries(t)) { if (/^[a-z]{2,8}$/.test(k) && clean(val, 200)) out[k] = clean(val, 200); } v.translations = JSON.stringify(out); }
    }
    for (const k of ['course_id', 'level_id', 'unit_id', 'lesson_id']) if (b[k] !== undefined) {
      const val = b[k] === null || b[k] === '' ? null : Number(b[k]);
      const table = { course_id: 'courses', level_id: 'levels', unit_id: 'units', lesson_id: 'lessons' }[k];
      if (val !== null && (!Number.isInteger(val) || !db.get(`SELECT 1 x FROM ${table} WHERE id = ?`, val))) e[k] = 'Not found.'; else v[k] = val;
    }
    if (b.status !== undefined) { if (!['draft', 'published', 'archived'].includes(b.status)) e.status = 'Unknown status.'; else v.status = b.status; }
    if (Object.keys(e).length) throw bad('Please fix the highlighted fields.', e);
    return v;
  }
  const vocabRow = (v) => ({ ...v, translations: (() => { try { return JSON.parse(v.translations); } catch (_) { return {}; } })() });
  r.get('/vocabulary', staff, (req, res) => {
    const { size, p, off } = page(req);
    const where = ['1=1'], args = [];
    const q = clean(req.query.q, 60);
    if (q) { where.push("(v.en LIKE ? ESCAPE '\\' OR v.uz LIKE ? ESCAPE '\\')"); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    for (const k of ['course_id', 'level_id', 'unit_id', 'lesson_id']) if (req.query[k]) { where.push(`v.${k} = ?`); args.push(int(req.query[k])); }
    if (req.query.status && ['draft', 'published', 'archived'].includes(req.query.status)) { where.push('v.status = ?'); args.push(req.query.status); }
    if (req.query.cefr && CEFR.includes(req.query.cefr)) { where.push('v.cefr = ?'); args.push(req.query.cefr); }
    const total = db.get(`SELECT COUNT(*) n FROM vocabulary v WHERE ${where.join(' AND ')}`, ...args).n;
    const items = db.all(`SELECT v.*, c.title course_title, un.title unit_title FROM vocabulary v LEFT JOIN courses c ON c.id = v.course_id LEFT JOIN units un ON un.id = v.unit_id WHERE ${where.join(' AND ')} ORDER BY v.id DESC LIMIT ? OFFSET ?`, ...args, size, off).map(vocabRow);
    res.json({ total, page: p, pageSize: size, items });
  });
  r.post('/vocabulary', staff, (req, res) => {
    const v = vocabInput(req.body || {}, false);
    if (db.get('SELECT 1 x FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE', v.en, v.uz)) throw bad('Please fix the highlighted fields.', { en: 'This word with the same translation already exists.' });
    const t = now();
    const id = db.run(`INSERT INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, audio_url, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      v.course_id ?? null, v.level_id ?? null, v.unit_id ?? null, v.lesson_id ?? null, v.en, v.uz, v.translations || '{}', v.pos || '', v.example || '', v.example_uz || '', v.audio_url || '', v.cefr || '', v.status || 'published', t, t).id;
    audit(req, 'vocabulary.create', 'vocabulary', id, { en: v.en });
    res.status(201).json(vocabRow(db.get('SELECT * FROM vocabulary WHERE id = ?', id)));
  });
  r.patch('/vocabulary/:id', staff, (req, res) => {
    const old = need(db.get('SELECT * FROM vocabulary WHERE id = ?', int(req.params.id)), 'Word');
    const v = vocabInput(req.body || {}, true);
    const en = v.en ?? old.en, uz = v.uz ?? old.uz;
    if (db.get('SELECT 1 x FROM vocabulary WHERE en = ? COLLATE NOCASE AND uz = ? COLLATE NOCASE AND id != ?', en, uz, old.id)) throw bad('Please fix the highlighted fields.', { en: 'This word with the same translation already exists.' });
    const keys = Object.keys(v);
    if (keys.length) db.run(`UPDATE vocabulary SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), old.id);
    audit(req, 'vocabulary.update', 'vocabulary', old.id, { fields: keys });
    res.json(vocabRow(db.get('SELECT * FROM vocabulary WHERE id = ?', old.id)));
  });
  r.post('/vocabulary/bulk-status', staff, (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 500) : [];
    const status = (req.body || {}).status;
    if (!ids.length || !['draft', 'published', 'archived'].includes(status)) throw bad('Choose words and a status.');
    db.tx(() => ids.forEach((id) => db.run('UPDATE vocabulary SET status = ?, updated_at = ? WHERE id = ?', status, now(), id)));
    audit(req, 'vocabulary.bulk_status', 'vocabulary', '', { count: ids.length, status });
    res.json({ updated: ids.length });
  });
  const VOCAB_HEAD = ['en', 'uz', 'pos', 'cefr', 'example', 'example_uz', 'ru', 'status', 'course', 'unit', 'lesson'];
  r.get('/vocabulary/export', staff, (req, res) => {
    const rows = db.all(`SELECT v.*, c.title course, un.title unit, l.title lesson FROM vocabulary v LEFT JOIN courses c ON c.id = v.course_id LEFT JOIN units un ON un.id = v.unit_id LEFT JOIN lessons l ON l.id = v.lesson_id ORDER BY v.id`).map((v) => ({ ...v, ru: (vocabRow(v).translations.ru) || '' }));
    audit(req, 'vocabulary.export', 'vocabulary', '', { format: req.query.format, count: rows.length });
    if (req.query.format === 'json') { res.setHeader('Content-Disposition', 'attachment; filename="vocabulary.json"'); return res.json({ format: 'lexi-vocabulary', version: 1, items: rows.map((v) => Object.fromEntries(VOCAB_HEAD.map((k) => [k, v[k] || '']))) }); }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="vocabulary.csv"');
    res.send(csv.stringify(VOCAB_HEAD, rows));
  });
  /* bulk import: CSV (header row: en,uz,pos,cefr,example,example_uz,ru,status,course,unit,lesson) or JSON { items: [...] } */
  r.post('/vocabulary/import', staff, (req, res) => {
    const { format, content, courseId, lessonId } = req.body || {};
    if (typeof content !== 'string' || content.length > 2000000) throw bad('Paste or upload the content to import (up to 2 MB).');
    let items;
    try { if (format === 'json') { const j = JSON.parse(content); items = Array.isArray(j) ? j : j.items; if (!Array.isArray(items)) throw new Error('missing items array'); } else items = csv.objects(content); }
    catch (e) { throw bad('The file could not be read: ' + e.message); }
    if (!items.length) throw bad('The file contains no rows.');
    if (items.length > 5000) throw bad('Import at most 5000 words at a time.');
    const course = courseId ? need(db.get('SELECT id FROM courses WHERE id = ?', int(courseId)), 'Course') : null;
    const lesson = lessonId ? need(db.get('SELECT l.id, u.id unit_id, lv.id level_id, lv.course_id FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE l.id = ?', int(lessonId)), 'Lesson') : null;
    const problems = [], ready = [];
    items.forEach((raw, i) => {
      try {
        const v = vocabInput({ en: raw.en, uz: raw.uz, pos: raw.pos || '', cefr: raw.cefr || '', example: raw.example || '', example_uz: raw.example_uz || '', status: ['draft', 'published', 'archived'].includes(raw.status) ? raw.status : 'published',
          translations: raw.ru ? { ru: raw.ru } : (raw.translations && typeof raw.translations === 'object' ? raw.translations : {}) }, false);
        ready.push(v);
      } catch (e) { problems.push({ row: i + 1, problems: Object.values(e.fields || { _: e.message }) }); }
    });
    if (problems.length) return res.status(422).json({ error: `${problems.length} row(s) have problems. Nothing was imported.`, problems: problems.slice(0, 30) });
    let added = 0, skipped = 0;
    db.tx(() => {
      const t = now();
      for (const v of ready) {
        const r2 = db.run(`INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, audio_url, cefr, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          lesson ? lesson.course_id : course ? course.id : null, lesson ? lesson.level_id : null, lesson ? lesson.unit_id : null, lesson ? lesson.id : null, v.en, v.uz, v.translations || '{}', v.pos || '', v.example || '', v.example_uz || '', '', v.cefr || '', v.status || 'published', t, t);
        if (r2.changes) added++; else skipped++;
      }
    });
    audit(req, 'vocabulary.import', 'vocabulary', '', { added, skipped, format });
    res.status(201).json({ added, skipped });
  });

  /* ---------- audio uploads (raw request body, validated by size and file signature) ---------- */
  r.post('/uploads', staff, express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '2.5mb' }), (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw bad('No file received.');
    if (buf.length > 2 * 1024 * 1024) throw bad('Audio files may be at most 2 MB.');
    const name = clean(req.get('x-filename') || 'audio', 100).replace(/[^\w.\- ]/g, '_');
    const ext = (name.split('.').pop() || '').toLowerCase();
    const kind = AUDIO_TYPES[ext];
    if (!kind) throw bad('Upload an .mp3, .ogg or .wav file.');
    if (!kind.ok(buf)) throw bad('This file does not look like a real ' + ext.toUpperCase() + ' audio file.');
    const id = randomToken(12);
    const fs = require('node:fs'), path = require('node:path');
    fs.mkdirSync(path.join(opts.dataDir, 'uploads'), { recursive: true });
    fs.writeFileSync(path.join(opts.dataDir, 'uploads', id), buf, { mode: 0o640 });
    db.run('INSERT INTO uploads (id, filename, mime, size, uploaded_by, created_at) VALUES (?,?,?,?,?,?)', id, name, kind.mime, buf.length, req.user.id, now());
    audit(req, 'upload.create', 'upload', id, { name, size: buf.length });
    res.status(201).json({ url: '/uploads/' + id, filename: name, size: buf.length });
  });

  /* ---------- users (administrators only) ---------- */
  const userSummary = (u) => ({ id: u.id, email: u.email, displayName: u.display_name, role: u.role, status: u.status, xpTotal: u.xp_total, createdAt: u.created_at, lastActiveAt: u.last_active_at, timezone: u.timezone });
  r.get('/users', adminOnly, (req, res) => {
    const { size, p, off } = page(req);
    const where = ['1=1'], args = [];
    const q = clean(req.query.q, 60);
    if (q) { where.push("(u.email LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')"); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%'); }
    if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); args.push(req.query.role); }
    if (['active', 'suspended'].includes(req.query.status)) { where.push('u.status = ?'); args.push(req.query.status); }
    const total = db.get(`SELECT COUNT(*) n FROM users u WHERE ${where.join(' AND ')}`, ...args).n;
    const items = db.all(`SELECT u.*, (SELECT COUNT(*) FROM user_progress p WHERE p.user_id = u.id) lessons FROM users u WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT ? OFFSET ?`, ...args, size, off).map((u) => ({ ...userSummary(u), lessons: u.lessons }));
    res.json({ total, page: p, pageSize: size, items });
  });
  r.get('/users/:id', adminOnly, (req, res) => {
    const u = need(db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    const st = core.streakInfo(u);
    res.json({ user: userSummary(u), streak: st, today: core.dayInfo(u), hearts: core.heartState(u),
      lessonsCompleted: db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', u.id).n,
      attempts: db.get('SELECT COUNT(*) n FROM exercise_responses WHERE user_id = ?', u.id).n,
      accuracy: (() => { const a = db.get('SELECT COUNT(*) n, SUM(is_correct) c FROM exercise_responses WHERE user_id = ?', u.id); return a.n ? Math.round(100 * a.c / a.n) : null; })(),
      reviewWords: db.get('SELECT COUNT(*) n FROM review_items WHERE user_id = ?', u.id).n,
      achievements: core.achievementList(u.id).filter((a) => a.earnedAt).map((a) => a.title),
      week: core.weekDays(u),
      recent: db.all(`SELECT a.id, a.kind, a.status, a.correct, a.incorrect, a.started_at, l.title lesson FROM lesson_attempts a LEFT JOIN lessons l ON l.id = a.lesson_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 10`, u.id) });
  });
  const adminCount = () => db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND status = 'active'").n;
  r.post('/users/:id/suspend', adminOnly, (req, res) => {
    const u = need(db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    if (u.id === req.user.id) throw bad('You cannot suspend your own account.');
    if (u.role === 'admin' && adminCount() <= 1) throw bad('You cannot suspend the last active administrator.');
    db.tx(() => { db.run("UPDATE users SET status = 'suspended' WHERE id = ?", u.id); db.run('DELETE FROM sessions WHERE user_id = ?', u.id); });
    audit(req, 'user.suspend', 'user', u.id, { email: u.email });
    res.json(userSummary(db.get('SELECT * FROM users WHERE id = ?', u.id)));
  });
  r.post('/users/:id/reactivate', adminOnly, (req, res) => {
    const u = need(db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    db.run("UPDATE users SET status = 'active' WHERE id = ?", u.id);
    audit(req, 'user.reactivate', 'user', u.id, { email: u.email });
    res.json(userSummary(db.get('SELECT * FROM users WHERE id = ?', u.id)));
  });
  /* strict role rules: only administrators change roles; nobody changes their own role; the last administrator can never be demoted */
  r.post('/users/:id/role', adminOnly, (req, res) => {
    const u = need(db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    const role = (req.body || {}).role;
    if (!ROLES.includes(role)) throw bad('Unknown role.');
    if (u.id === req.user.id) throw bad('You cannot change your own role.');
    if (u.role === 'admin' && role !== 'admin' && adminCount() <= 1) throw bad('You cannot demote the last administrator.');
    if (role === 'admin' && u.status !== 'active') throw bad('Reactivate the account before making it an administrator.');
    db.run('UPDATE users SET role = ? WHERE id = ?', role, u.id);
    audit(req, 'user.role', 'user', u.id, { email: u.email, from: u.role, to: role });
    res.json(userSummary(db.get('SELECT * FROM users WHERE id = ?', u.id)));
  });
  r.post('/users/:id/reset-progress', adminOnly, (req, res) => {
    const u = need(db.get('SELECT * FROM users WHERE id = ?', int(req.params.id)), 'User');
    if ((req.body || {}).confirmEmail !== u.email) throw bad("Type the learner's e-mail address to confirm.");
    db.tx(() => {
      for (const t of ['lesson_attempts', 'user_progress', 'xp_transactions', 'user_streaks', 'user_days', 'user_achievements', 'review_items']) db.run(`DELETE FROM ${t} WHERE user_id = ?`, u.id);
      db.run('UPDATE users SET xp_total = 0, hearts = ?, hearts_updated_at = ? WHERE id = ?', settings.all().max_hearts, now(), u.id);
    });
    audit(req, 'user.reset_progress', 'user', u.id, { email: u.email });
    res.json({ ok: true });
  });

  /* ---------- statistics (real records only) ---------- */
  r.get('/stats', adminOnly, (req, res) => {
    const days = clamp(int(req.query.days, 30), 7, 365);
    const today = new Date().toISOString().slice(0, 10), from = addDays(today, -(days - 1));
    const fromIso = from + 'T00:00:00.000Z';
    const series = (rows, key = 'n') => { const m = Object.fromEntries(rows.map((r2) => [r2.d, r2[key]])); const out = []; for (let i = days - 1; i >= 0; i--) { const d = addDays(today, -i); out.push({ date: d, value: m[d] || 0 }); } return out; };
    const active = (n) => db.get('SELECT COUNT(DISTINCT user_id) n FROM user_days WHERE local_date >= ?', addDays(today, -(n - 1))).n;
    res.json({
      days, totals: {
        users: db.get('SELECT COUNT(*) n FROM users').n, learners: db.get("SELECT COUNT(*) n FROM users WHERE role = 'learner'").n, suspended: db.get("SELECT COUNT(*) n FROM users WHERE status = 'suspended'").n,
        courses: db.get('SELECT COUNT(*) n FROM courses').n, publishedCourses: db.get("SELECT COUNT(*) n FROM courses WHERE status = 'published'").n,
        lessons: db.get('SELECT COUNT(*) n FROM lessons').n, exercises: db.get('SELECT COUNT(*) n FROM exercises').n, vocabulary: db.get("SELECT COUNT(*) n FROM vocabulary WHERE status != 'archived'").n,
        completedLessons: db.get("SELECT COUNT(*) n FROM lesson_attempts WHERE kind = 'lesson' AND status = 'completed'").n,
        exerciseAttempts: db.get('SELECT COUNT(*) n FROM exercise_responses').n,
        accuracy: (() => { const a = db.get('SELECT COUNT(*) n, SUM(is_correct) c FROM exercise_responses'); return a.n ? Math.round(100 * a.c / a.n) : null; })(),
      },
      active: { d1: active(1), d7: active(7), d30: active(30), custom: active(days) },
      signups: series(db.all("SELECT substr(created_at,1,10) d, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY d", fromIso)),
      activeUsers: series(db.all('SELECT local_date d, COUNT(DISTINCT user_id) n FROM user_days WHERE local_date >= ? GROUP BY d', from)),
      completions: series(db.all("SELECT substr(completed_at,1,10) d, COUNT(*) n FROM lesson_attempts WHERE status = 'completed' AND kind = 'lesson' AND completed_at >= ? GROUP BY d", fromIso)),
      attemptsPerDay: series(db.all('SELECT substr(created_at,1,10) d, COUNT(*) n FROM exercise_responses WHERE created_at >= ? GROUP BY d', fromIso)),
      courses: db.all(`SELECT c.id, c.title, c.status,
        (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id AND l.status = 'published') lessons,
        (SELECT COUNT(DISTINCT p.user_id) FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id) learners,
        (SELECT COUNT(*) FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id) completed_lessons,
        (SELECT COUNT(*) FROM (SELECT p.user_id FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = c.id AND l.status = 'published' GROUP BY p.user_id
          HAVING COUNT(DISTINCT p.lesson_id) = (SELECT COUNT(*) FROM lessons l2 JOIN units u2 ON u2.id = l2.unit_id JOIN levels lv2 ON lv2.id = u2.level_id WHERE lv2.course_id = c.id AND l2.status = 'published'))) finished_learners
        FROM courses c ORDER BY c.position, c.id`),
      recentAudit: db.all('SELECT id, admin_email, action, entity, entity_id, created_at FROM audit_log ORDER BY id DESC LIMIT 8'),
    });
  });

  /* ---------- settings ---------- */
  r.get('/settings', adminOnly, (req, res) => res.json({ settings: settings.all() }));
  r.put('/settings', adminOnly, (req, res) => {
    const v = settings.validate(req.body || {});
    if (v.errors) throw bad('Please fix the highlighted fields.', v.errors);
    settings.update(v.values);
    audit(req, 'settings.update', 'settings', '', v.values);
    res.json({ settings: settings.all() });
  });

  /* ---------- audit log ---------- */
  r.get('/audit', adminOnly, (req, res) => {
    const { size, p, off } = page(req, 25);
    const where = ['1=1'], args = [];
    if (req.query.action) { where.push("action LIKE ? ESCAPE '\\'"); args.push(escapeLike(clean(req.query.action, 40)) + '%'); }
    const total = db.get(`SELECT COUNT(*) n FROM audit_log WHERE ${where.join(' AND ')}`, ...args).n;
    const items = db.all(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, size, off).map((a) => ({ ...a, details: (() => { try { return JSON.parse(a.details); } catch (_) { return {}; } })() }));
    res.json({ total, page: p, pageSize: size, items });
  });

  return r;
};
