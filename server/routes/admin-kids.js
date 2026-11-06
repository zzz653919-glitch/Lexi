/* LEXIO KIDS, administrator side: categories, picture cards, extra quiz questions and image / audio uploads. Roles: editor and admin. */
const express = require('express');
const { now, clean, int, clamp, HttpError, bad, randomToken } = require('../lib/util');

const FILES = {
  png: { mime: 'image/png', max: 1024 * 1024, ok: (b) => b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' },
  jpg: { mime: 'image/jpeg', max: 1024 * 1024, ok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: 'image/jpeg', max: 1024 * 1024, ok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  webp: { mime: 'image/webp', max: 1024 * 1024, ok: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  gif: { mime: 'image/gif', max: 1024 * 1024, ok: (b) => b.slice(0, 3).toString('latin1') === 'GIF' },
  mp3: { mime: 'audio/mpeg', max: 2 * 1024 * 1024, ok: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  ogg: { mime: 'audio/ogg', max: 2 * 1024 * 1024, ok: (b) => b.slice(0, 4).toString('latin1') === 'OggS' },
  wav: { mime: 'audio/wav', max: 2 * 1024 * 1024, ok: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE' },
};
const KINDS = ['words', 'letters', 'numbers', 'sentences'], STATUS = ['published', 'draft'];
const URL_RE = /^\/uploads\/[A-Za-z0-9_-]{6,40}$/;

module.exports = function adminKidsRoutes({ db, auth, audit }) {
  const r = express.Router();
  const staff = auth.requireRole('editor', 'admin');
  const need = (row) => { if (!row) throw new HttpError(404, 'err.not_found'); return row; };
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'category';

  function fields(b, spec, partial) {
    const e = {}, v = {};
    for (const [k, [kind, max, required]] of Object.entries(spec)) {
      if (partial && b[k] === undefined) continue;
      let x = b[k] === undefined || b[k] === null ? '' : String(b[k]).trim();
      if (kind === 'text') x = clean(x, max);
      if ((required || (partial && ['kind', 'status', 'color'].includes(kind))) && !x) { e[k] = 'val.required'; continue; }
      if (kind === 'color' && x && !/^#[0-9a-fA-F]{6}$/.test(x)) { e[k] = 'val.kids_color'; continue; }
      if (kind === 'url' && x && !URL_RE.test(x)) { e[k] = 'val.kids_url'; continue; }
      if (kind === 'kind' && x && !KINDS.includes(x)) { e[k] = 'val.kids_kind'; continue; }
      if (kind === 'status' && x && !STATUS.includes(x)) { e[k] = 'val.kids_status'; continue; }
      if (kind === 'int') x = clamp(int(x, 0), 0, 9999);
      v[k] = x;
    }
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  }
  const update = async (table, id, v) => {
    const keys = Object.keys(v); if (!keys.length) return;
    await db.run(`UPDATE ${table} SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), id);
  };

  /* ---------- categories ---------- */
  const CAT = { title_en: ['text', 80, true], title_uz: ['text', 80], title_ru: ['text', 80], emoji: ['text', 16], color: ['color'], kind: ['kind'], position: ['int'], status: ['status'] };
  r.get('/kids/categories', staff, async (req, res) => {
    const rows = await db.all(`SELECT c.*, (SELECT COUNT(*) FROM kids_words w WHERE w.category_id = c.id) words, (SELECT COUNT(*) FROM kids_words w WHERE w.category_id = c.id AND w.status = 'published') published,
      (SELECT COUNT(*) FROM kids_questions q WHERE q.category_id = c.id) questions, (SELECT COUNT(DISTINCT p.user_id) FROM kids_progress p WHERE p.category_id = c.id) learners FROM kids_categories c ORDER BY c.position, c.id`);
    res.json({ items: rows });
  });
  r.post('/kids/categories', staff, async (req, res) => {
    const v = fields(req.body || {}, CAT, false);
    let slug = slugify((req.body || {}).slug || v.title_en), n = 2; const base = slug;
    while (await db.get('SELECT 1 x FROM kids_categories WHERE slug = ?', slug)) slug = base.slice(0, 36) + '-' + n++;
    const pos = v.position || ((await db.get('SELECT COALESCE(MAX(position), 0) + 1 p FROM kids_categories')).p);
    const t = now();
    const id = (await db.run('INSERT INTO kids_categories (slug, title_en, title_uz, title_ru, emoji, color, kind, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      slug, v.title_en, v.title_uz || '', v.title_ru || '', v.emoji || '⭐', v.color || '#ffb703', v.kind || 'words', pos, v.status || 'draft', t, t)).id;
    await audit(req, 'kids.category.create', 'kids_category', id, { slug });
    res.status(201).json(await db.get('SELECT * FROM kids_categories WHERE id = ?', id));
  });
  r.patch('/kids/categories/:id', staff, async (req, res) => {
    const c = need(await db.get('SELECT * FROM kids_categories WHERE id = ?', int(req.params.id)));
    await update('kids_categories', c.id, fields(req.body || {}, CAT, true));
    await audit(req, 'kids.category.update', 'kids_category', c.id, {});
    res.json(await db.get('SELECT * FROM kids_categories WHERE id = ?', c.id));
  });
  r.delete('/kids/categories/:id', staff, async (req, res) => {
    const c = need(await db.get('SELECT * FROM kids_categories WHERE id = ?', int(req.params.id)));
    await db.tx(async () => { for (const t of ['kids_progress', 'kids_questions', 'kids_words']) await db.run(`DELETE FROM ${t} WHERE category_id = ?`, c.id); await db.run('DELETE FROM kids_categories WHERE id = ?', c.id); });
    await audit(req, 'kids.category.delete', 'kids_category', c.id, { slug: c.slug });
    res.json({ ok: true });
  });

  /* ---------- picture cards ---------- */
  const WORD = { en: ['text', 120, true], uz: ['text', 200], ru: ['text', 200], pic: ['text', 60], extra: ['text', 40], image_url: ['url'], audio_url: ['url'], position: ['int'], status: ['status'] };
  r.get('/kids/categories/:id/words', staff, async (req, res) => {
    const c = need(await db.get('SELECT * FROM kids_categories WHERE id = ?', int(req.params.id)));
    res.json({ category: c, words: await db.all('SELECT * FROM kids_words WHERE category_id = ? ORDER BY position, id', c.id), questions: await db.all('SELECT * FROM kids_questions WHERE category_id = ? ORDER BY position, id', c.id) });
  });
  r.post('/kids/categories/:id/words', staff, async (req, res) => {
    const c = need(await db.get('SELECT * FROM kids_categories WHERE id = ?', int(req.params.id)));
    const v = fields(req.body || {}, WORD, false);
    if (!v.pic && !v.image_url) throw bad('err.fix_fields', { pic: 'val.kids_picture' });
    const pos = v.position || ((await db.get('SELECT COALESCE(MAX(position), 0) + 1 p FROM kids_words WHERE category_id = ?', c.id)).p), t = now();
    const id = (await db.run('INSERT INTO kids_words (category_id, en, uz, ru, pic, extra, image_url, audio_url, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      c.id, v.en, v.uz || '', v.ru || '', v.pic || '', v.extra || '', v.image_url || '', v.audio_url || '', pos, v.status || 'published', t, t)).id;
    await audit(req, 'kids.word.create', 'kids_word', id, { en: v.en });
    res.status(201).json(await db.get('SELECT * FROM kids_words WHERE id = ?', id));
  });
  r.patch('/kids/words/:id', staff, async (req, res) => {
    const w = need(await db.get('SELECT * FROM kids_words WHERE id = ?', int(req.params.id)));
    const v = fields(req.body || {}, WORD, true);
    if (('pic' in v || 'image_url' in v) && !(('pic' in v ? v.pic : w.pic) || ('image_url' in v ? v.image_url : w.image_url))) throw bad('err.fix_fields', { pic: 'val.kids_picture' });
    await update('kids_words', w.id, v); await audit(req, 'kids.word.update', 'kids_word', w.id, {});
    res.json(await db.get('SELECT * FROM kids_words WHERE id = ?', w.id));
  });
  r.delete('/kids/words/:id', staff, async (req, res) => {
    const w = need(await db.get('SELECT * FROM kids_words WHERE id = ?', int(req.params.id)));
    await db.run('DELETE FROM kids_words WHERE id = ?', w.id); await audit(req, 'kids.word.delete', 'kids_word', w.id, { en: w.en });
    res.json({ ok: true });
  });

  /* ---------- extra quiz questions ---------- */
  const Q = { prompt: ['text', 200, true], prompt_uz: ['text', 200], prompt_ru: ['text', 200], pic: ['text', 60], image_url: ['url'], audio_url: ['url'], correct: ['text', 80, true], wrong1: ['text', 80, true], wrong2: ['text', 80], wrong3: ['text', 80], position: ['int'], status: ['status'] };
  r.post('/kids/categories/:id/questions', staff, async (req, res) => {
    const c = need(await db.get('SELECT * FROM kids_categories WHERE id = ?', int(req.params.id)));
    const v = fields(req.body || {}, Q, false), t = now();
    const pos = v.position || ((await db.get('SELECT COALESCE(MAX(position), 0) + 1 p FROM kids_questions WHERE category_id = ?', c.id)).p);
    const id = (await db.run('INSERT INTO kids_questions (category_id, prompt, prompt_uz, prompt_ru, pic, image_url, audio_url, correct, wrong1, wrong2, wrong3, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      c.id, v.prompt, v.prompt_uz || '', v.prompt_ru || '', v.pic || '', v.image_url || '', v.audio_url || '', v.correct, v.wrong1, v.wrong2 || '', v.wrong3 || '', pos, v.status || 'published', t, t)).id;
    await audit(req, 'kids.question.create', 'kids_question', id, {});
    res.status(201).json(await db.get('SELECT * FROM kids_questions WHERE id = ?', id));
  });
  r.patch('/kids/questions/:id', staff, async (req, res) => {
    const q = need(await db.get('SELECT * FROM kids_questions WHERE id = ?', int(req.params.id)));
    await update('kids_questions', q.id, fields(req.body || {}, Q, true)); await audit(req, 'kids.question.update', 'kids_question', q.id, {});
    res.json(await db.get('SELECT * FROM kids_questions WHERE id = ?', q.id));
  });
  r.delete('/kids/questions/:id', staff, async (req, res) => {
    const q = need(await db.get('SELECT * FROM kids_questions WHERE id = ?', int(req.params.id)));
    await db.run('DELETE FROM kids_questions WHERE id = ?', q.id); await audit(req, 'kids.question.delete', 'kids_question', q.id, {});
    res.json({ ok: true });
  });

  /* ---------- image / audio upload (raw body; the type is checked by file extension, size and file signature) ---------- */
  r.post('/kids/upload', staff, express.raw({ type: ['image/*', 'audio/*', 'application/octet-stream'], limit: '2.5mb' }), async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw bad('err.upload_none');
    const name = clean(req.get('x-filename') || 'file', 100).replace(/[^\w.\- ]/g, '_');
    const kind = FILES[(name.split('.').pop() || '').toLowerCase()];
    if (!kind) throw bad('err.kids_upload_type');
    if (buf.length > kind.max) throw bad('err.upload_too_large');
    if (!kind.ok(buf)) throw bad('err.upload_mismatch', null, { type: name.split('.').pop().toUpperCase() });
    const id = randomToken(12);
    await db.run('INSERT INTO uploads (id, filename, mime, size, uploaded_by, created_at, data) VALUES (?,?,?,?,?,?,?)', id, name, kind.mime, buf.length, req.user.id, now(), buf.toString('base64'));
    await audit(req, 'kids.upload', 'upload', id, { name, size: buf.length });
    res.status(201).json({ url: '/uploads/' + id, filename: name, size: buf.length, kind: kind.mime.split('/')[0] });
  });
  return r;
};
