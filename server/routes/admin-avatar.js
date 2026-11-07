/* Avatar Management for the admin panel: shop items (prices, rarity, images, earn rules), token rewards, the token ledger and what users own. */
const express = require('express');
const A = require('../lib/avatar-spec');
const { now, clean, int, clamp, HttpError, bad, randomToken, escapeLike } = require('../lib/util');

const FILES = {
  png: { mime: 'image/png', ok: (b) => b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' }, jpg: { mime: 'image/jpeg', ok: (b) => b[0] === 0xff && b[1] === 0xd8 }, jpeg: { mime: 'image/jpeg', ok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  webp: { mime: 'image/webp', ok: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' }, gif: { mime: 'image/gif', ok: (b) => b.slice(0, 3).toString('latin1') === 'GIF' },
};
const URL_RE = /^\/uploads\/[A-Za-z0-9_-]{6,40}$/, HEX = /^#[0-9a-fA-F]{6}$/;

module.exports = function adminAvatarRoutes({ db, auth, audit, settings, tokens, avatar }) {
  const r = express.Router();
  const staff = auth.requireRole('editor', 'admin'), adminOnly = auth.requireRole('admin');
  const need = (row) => { if (!row) throw new HttpError(404, 'err.not_found'); return row; };
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'item';
  const out = (it) => ({ ...it, art: JSON.parse(it.art || '{}'), category: A.CATEGORY(it.kind) });

  function input(b, partial) {
    const e = {}, v = {};
    const has = (k) => b[k] !== undefined;
    if (!partial || has('name_en')) { const x = clean(b.name_en, 60); if (!x) e.name_en = 'val.required'; else v.name_en = x; }
    for (const k of ['name_uz', 'name_ru']) if (has(k)) v[k] = clean(b[k], 60);
    if (!partial || has('kind')) { if (!A.KINDS.includes(b.kind)) e.kind = 'val.avatar_kind'; else { v.kind = b.kind; v.slot = A.KIND_SLOT[b.kind]; } }
    if (!partial || has('price')) { const n = int(b.price, -1); if (n < 0 || n > 100000) e.price = 'val.avatar_price'; else v.price = n; }
    if (!partial || has('rarity')) { if (!A.RARITIES.includes(b.rarity)) e.rarity = 'val.avatar_rarity'; else v.rarity = b.rarity; }
    if (has('status')) { if (!['active', 'disabled'].includes(b.status)) e.status = 'val.kids_status'; else v.status = b.status; }
    if (has('art')) { const a = b.art; if (!a || typeof a !== 'object' || Array.isArray(a)) e.art = 'val.avatar_art'; else {
      const art = {}; for (const [k, x] of Object.entries(a)) { if (['c', 'c2'].includes(k)) { if (!HEX.test(String(x))) { e.art = 'val.kids_color'; break; } art[k] = String(x).toLowerCase(); } else if (['p', 'v'].includes(k)) art[k] = clean(x, 16).replace(/[^\w-]/g, ''); }
      if (!e.art) v.art = JSON.stringify(art); } }
    if (has('image_url')) { const x = String(b.image_url || ''); if (x && !URL_RE.test(x)) e.image_url = 'val.kids_url'; else v.image_url = x; }
    if (has('earn_rule')) { const x = String(b.earn_rule || ''); if (x && !avatar.parseRule(x)) e.earn_rule = 'val.avatar_rule'; else v.earn_rule = x; }
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  }

  /* ---------- items ---------- */
  r.get('/avatar/items', staff, async (req, res) => {
    const q = clean(req.query.q, 60), kind = String(req.query.kind || '');
    const where = [], args = [];
    if (q) { where.push("(name_en LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')"); args.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`); }
    if (kind) { where.push('kind = ?'); args.push(kind); }
    const rows = await db.all(`SELECT i.*, (SELECT COUNT(*) FROM avatar_owned o WHERE o.item_id = i.id AND o.source != 'starter') owners FROM avatar_items i ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.position, i.id`, ...args);
    res.json({ items: rows.map(out), kinds: A.KINDS, rarities: A.RARITIES, earnTypes: A.EARN_TYPES });
  });
  r.post('/avatar/items', staff, async (req, res) => {
    const v = input(req.body || {}, false);
    let slug = slugify((req.body || {}).slug || v.name_en), n = 2; const base = slug;
    while (await db.get('SELECT 1 x FROM avatar_items WHERE slug = ?', slug)) slug = base.slice(0, 44) + '-' + n++;
    const t = now(), pos = (await db.get('SELECT COALESCE(MAX(position), 0) + 1 p FROM avatar_items')).p;
    const id = (await db.run('INSERT INTO avatar_items (slug, name_en, name_uz, name_ru, kind, slot, price, rarity, art, image_url, earn_rule, status, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      slug, v.name_en, v.name_uz || '', v.name_ru || '', v.kind, v.slot, v.price, v.rarity, v.art || '{}', v.image_url || '', v.earn_rule || '', v.status || 'active', pos, t, t)).id;
    await audit(req, 'avatar.item.create', 'avatar_item', id, { slug });
    res.status(201).json(out(await db.get('SELECT * FROM avatar_items WHERE id = ?', id)));
  });
  r.patch('/avatar/items/:id', staff, async (req, res) => {
    const it = need(await db.get('SELECT * FROM avatar_items WHERE id = ?', int(req.params.id)));
    const v = input(req.body || {}, true), keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE avatar_items SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), it.id);
    await audit(req, 'avatar.item.update', 'avatar_item', it.id, { fields: keys });
    res.json(out(await db.get('SELECT * FROM avatar_items WHERE id = ?', it.id)));
  });
  /* removing an item that somebody owns would take it away: purchases are permanent, so such an item can only be disabled */
  r.delete('/avatar/items/:id', staff, async (req, res) => {
    const it = need(await db.get('SELECT * FROM avatar_items WHERE id = ?', int(req.params.id)));
    if ((await db.get("SELECT COUNT(*) n FROM avatar_owned WHERE item_id = ? AND source != 'starter'", it.id)).n || it.starter) throw new HttpError(409, 'err.item_has_owners');
    await db.run('DELETE FROM avatar_items WHERE id = ?', it.id);
    await audit(req, 'avatar.item.delete', 'avatar_item', it.id, { slug: it.slug });
    res.json({ ok: true });
  });
  r.post('/avatar/upload', staff, express.raw({ type: ['image/*', 'application/octet-stream'], limit: '1.2mb' }), async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw bad('err.upload_none');
    const name = clean(req.get('x-filename') || 'file', 100).replace(/[^\w.\- ]/g, '_'), kind = FILES[(name.split('.').pop() || '').toLowerCase()];
    if (!kind) throw bad('err.avatar_upload_type');
    if (buf.length > 1024 * 1024) throw bad('err.upload_too_large');
    if (!kind.ok(buf)) throw bad('err.upload_mismatch', null, { type: name.split('.').pop().toUpperCase() });
    const id = randomToken(12);
    await db.run('INSERT INTO uploads (id, filename, mime, size, uploaded_by, created_at, data) VALUES (?,?,?,?,?,?,?)', id, name, kind.mime, buf.length, req.user.id, now(), buf.toString('base64'));
    await audit(req, 'avatar.upload', 'upload', id, { name, size: buf.length });
    res.status(201).json({ url: '/uploads/' + id, filename: name, size: buf.length });
  });

  /* ---------- token rewards ---------- */
  r.get('/avatar/rewards', adminOnly, async (req, res) => { const s = settings.all(); res.json({ rewards: Object.fromEntries(A.REWARD_KEYS.map((k) => [k, s[k]])), keys: A.REWARD_KEYS }); });
  r.put('/avatar/rewards', adminOnly, async (req, res) => {
    const b = req.body || {}, pick = {};
    for (const k of A.REWARD_KEYS) if (b[k] !== undefined) pick[k] = int(b[k], -1);
    const v = settings.validate(pick);
    if (v.errors) throw bad('err.fix_fields', v.errors);
    await settings.update(v.values);
    await audit(req, 'avatar.rewards', 'settings', '', v.values);
    const s = settings.all(); res.json({ rewards: Object.fromEntries(A.REWARD_KEYS.map((k) => [k, s[k]])) });
  });

  /* ---------- the ledger and the owners ---------- */
  r.get('/avatar/transactions', adminOnly, async (req, res) => {
    const size = clamp(int(req.query.pageSize, 25), 5, 100), page = Math.max(1, int(req.query.page, 1)), email = clean(req.query.email, 100), kind = clean(req.query.kind, 12);
    const where = [], args = [];
    if (email) { where.push("u.email LIKE ? ESCAPE '\\'"); args.push(`%${escapeLike(email)}%`); }
    if (kind) { where.push('t.kind = ?'); args.push(kind); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await db.get(`SELECT COUNT(*) n FROM token_transactions t JOIN users u ON u.id = t.user_id ${w}`, ...args)).n;
    const rows = await db.all(`SELECT t.id, t.user_id, u.email, u.display_name, t.amount, t.kind, t.reason, t.ref, t.balance_after, t.created_at FROM token_transactions t JOIN users u ON u.id = t.user_id ${w} ORDER BY t.id DESC LIMIT ? OFFSET ?`, ...args, size, (page - 1) * size);
    const sums = await db.get('SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) earned, COALESCE(-SUM(CASE WHEN amount < 0 THEN amount END), 0) spent FROM token_transactions');
    res.json({ items: rows, total, page, pageSize: size, totals: sums });
  });
  r.get('/avatar/users/:id', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT id, email, display_name, xp_total FROM users WHERE id = ?', int(req.params.id)));
    const [wal, owned, avatars, tx] = await Promise.all([tokens.wallet(u.id), db.all('SELECT i.slug, i.name_en, i.kind, i.rarity, o.source, o.price_paid, o.acquired_at FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? ORDER BY o.acquired_at DESC', u.id),
      db.all('SELECT id, name, style FROM avatars WHERE user_id = ?', u.id), tokens.history(u.id, 15)]);
    res.json({ user: { id: u.id, email: u.email, name: u.display_name, xp: u.xp_total }, wallet: wal, owned, avatars, transactions: tx });
  });
  r.post('/avatar/users/:id/grant', adminOnly, async (req, res) => {
    const u = need(await db.get('SELECT id FROM users WHERE id = ?', int(req.params.id))), amount = int((req.body || {}).amount, 0), note = clean((req.body || {}).note, 100);
    if (amount < 1 || amount > 10000) throw bad('err.fix_fields', { amount: 'val.avatar_price' });
    const r2 = await tokens.earn(u.id, { ref: 'grant:' + randomToken(8), amount, reason: 'admin', kind: 'grant', meta: { by: req.user.id, note } });
    await audit(req, 'avatar.grant', 'user', u.id, { amount, note });
    res.json({ wallet: await tokens.wallet(u.id), paid: r2.paid });
  });
  return r;
};
