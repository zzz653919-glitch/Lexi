/* Avatar Studio, LEXIO TOKENS, the Avatar Shop, inventory, missions and the character card (learner side). Every purchase and every token change is checked here. */
const express = require('express');
const A = require('../lib/avatar-spec');
const { now, int, clean, HttpError, bad } = require('../lib/util');

module.exports = function avatarRoutes({ db, auth, tokens, avatar, settings }) {
  const r = express.Router();
  r.use('/avatar', auth.requireUser);
  const pick = (it, lang) => (lang === 'uz' && it.name_uz) || (lang === 'ru' && it.name_ru) || it.name_en;
  const need = (row) => { if (!row) throw new HttpError(404, 'err.not_found'); return row; };

  async function owned(user) {
    let rows = await avatar.ownedRows(user.id);
    if (!rows.some((o) => o.source === 'starter')) { await avatar.ensureStarter(user.id); rows = await avatar.ownedRows(user.id); }
    return rows;
  }
  async function activeId(user, list) {
    const st = await db.get('SELECT active_avatar_id FROM avatar_state WHERE user_id = ?', user.id);
    return st && list.some((a) => a.id === st.active_avatar_id) ? st.active_avatar_id : (list[0] ? list[0].id : null);
  }
  const setActive = (userId, id) => db.run('INSERT INTO avatar_state (user_id, active_avatar_id, updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET active_avatar_id = excluded.active_avatar_id, updated_at = excluded.updated_at', userId, id, now());

  const itemBody = (it, lang, ownedIds, st) => {
    const rule = it.earn_rule ? avatar.progressOf(it.earn_rule, st) : null;
    return { id: it.id, slug: it.slug, name: pick(it, lang), kind: it.kind, slot: it.slot, category: A.CATEGORY(it.kind), collection: it.collection || '', sub: it.subcollection || '', price: it.price, rarity: it.rarity, art: JSON.parse(it.art || '{}'), image: it.image_url, starter: !!it.starter,
      forSale: !it.earn_rule && !it.starter && it.status === 'active', earn: rule, owned: ownedIds.has(it.id), disabled: it.status !== 'active' };
  };

  r.get('/avatar/bootstrap', async (req, res) => {
    const u = req.user, lang = req.lang;
    const [ownedList, avatars, wal, badges, st] = await Promise.all([owned(u), db.all('SELECT * FROM avatars WHERE user_id = ? ORDER BY id', u.id), tokens.wallet(u.id), db.all('SELECT code, earned_at FROM avatar_badges WHERE user_id = ?', u.id), avatar.playerStats(u)]);
    const items = await db.all("SELECT * FROM avatar_items WHERE status = 'active' OR id IN (SELECT item_id FROM avatar_owned WHERE user_id = ?) ORDER BY position, id", u.id);
    const ownedIds = new Set(ownedList.map((o) => o.id));
    const list = avatars.map(avatar.shape);
    res.json({ spec: { look: A.LOOK, collections: A.COLLECTIONS, styles: A.STYLES, slots: A.SLOTS, poses: A.POSES, max: A.MAX_AVATARS, rarities: A.RARITIES, badges: avatar.BADGE_CODES }, wallet: wal, avatars: list, activeId: await activeId(u, list),
      items: items.map((it) => itemBody(it, lang, ownedIds, st)), badges: badges.map((b) => b.code), name: u.display_name });
  });

  /* ---------- characters ---------- */
  async function fields(u, b, partial) {
    const v = {};
    if (!partial || b.name !== undefined) v.name = avatar.cleanName(b.name);
    if (b.style !== undefined) { if (!A.STYLES.includes(b.style)) throw bad('err.fix_fields', { style: 'val.avatar_style' }); v.style = b.style; } else if (!partial) v.style = 'cartoon';
    if (b.look !== undefined || !partial) v.look = JSON.stringify(avatar.cleanLook(b.look || {}));
    if (b.equipped !== undefined) v.equipped = JSON.stringify(await avatar.cleanEquipped(u.id, b.equipped));
    if (b.petName !== undefined) v.pet_name = clean(b.petName, 16);
    if (b.petPose !== undefined) { if (!A.POSES.includes(b.petPose)) throw bad('err.fix_fields', { petPose: 'val.avatar_pose' }); v.pet_pose = b.petPose; }
    if (b.favorite !== undefined) v.favorite = b.favorite ? 1 : 0;
    return v;
  }
  r.post('/avatar/avatars', async (req, res) => {
    const u = req.user, b = req.body || {};
    if ((await db.get('SELECT COUNT(*) n FROM avatars WHERE user_id = ?', u.id)).n >= A.MAX_AVATARS) throw bad('err.avatar_limit');
    await owned(u);
    const v = await fields(u, b, false);
    if (b.equipped === undefined) { const starters = await db.all("SELECT i.slug, i.slot FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ? AND o.source = 'starter'", u.id); v.equipped = JSON.stringify(Object.fromEntries(starters.map((s) => [s.slot, s.slug]))); }
    const t = now();
    const id = (await db.run('INSERT INTO avatars (user_id, name, style, look, equipped, pet_name, pet_pose, favorite, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', u.id, v.name, v.style, v.look, v.equipped || '{}', v.pet_name || '', v.pet_pose || 'sit', v.favorite || 0, t, t)).id;
    if (!(await db.get('SELECT active_avatar_id FROM avatar_state WHERE user_id = ?', u.id))) await setActive(u.id, id);
    await avatar.syncBadges(u);
    res.status(201).json({ avatar: avatar.shape(await db.get('SELECT * FROM avatars WHERE id = ?', id)) });
  });
  r.put('/avatar/avatars/:id', async (req, res) => {
    const u = req.user, a = need(await db.get('SELECT * FROM avatars WHERE id = ? AND user_id = ?', int(req.params.id), u.id));
    const v = await fields(u, req.body || {}, true), keys = Object.keys(v);
    if (keys.length) await db.run(`UPDATE avatars SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => v[k]), now(), a.id);
    await avatar.syncBadges(u);
    res.json({ avatar: avatar.shape(await db.get('SELECT * FROM avatars WHERE id = ?', a.id)) });
  });
  r.delete('/avatar/avatars/:id', async (req, res) => {
    const u = req.user, a = need(await db.get('SELECT * FROM avatars WHERE id = ? AND user_id = ?', int(req.params.id), u.id));
    await db.run('DELETE FROM avatars WHERE id = ?', a.id);
    const left = await db.all('SELECT id FROM avatars WHERE user_id = ? ORDER BY id', u.id);
    await setActive(u.id, left[0] ? left[0].id : null);
    res.json({ ok: true, activeId: left[0] ? left[0].id : null });
  });
  r.post('/avatar/avatars/:id/activate', async (req, res) => {
    const a = need(await db.get('SELECT id FROM avatars WHERE id = ? AND user_id = ?', int(req.params.id), req.user.id));
    await setActive(req.user.id, a.id); res.json({ activeId: a.id });
  });

  /* ---------- the shop and the wallet ---------- */
  r.post('/avatar/shop/:slug/buy', async (req, res) => {
    const out = await avatar.buy(req.user, req.params.slug);
    res.json({ ...out, wallet: await tokens.wallet(req.user.id) });
  });
  r.get('/avatar/wallet', async (req, res) => {
    const before = int(req.query.before, 0);
    res.json({ wallet: await tokens.wallet(req.user.id), items: await tokens.history(req.user.id, 30, before) });
  });
  r.post('/avatar/wallet/seen', async (req, res) => { await tokens.markSeen(req.user.id); res.json({ ok: true }); });

  /* ---------- daily missions ---------- */
  r.get('/avatar/missions', async (req, res) => {
    const u = req.user, m = await avatar.syncMissions(u);
    await avatar.touch(u);
    const [wal, badges] = await Promise.all([tokens.wallet(u.id), db.all('SELECT code FROM avatar_badges WHERE user_id = ?', u.id)]);
    res.json({ date: m.today, reward: m.tokens, missions: m.missions, allDone: m.missions.every((x) => x.done), wallet: wal, badges: badges.map((b) => b.code), rewards: { lesson: settings.all().token_lesson, topic: settings.all().token_topic, test: settings.all().token_test, mission: settings.all().token_mission, streak: settings.all().token_streak7, level: settings.all().token_level } });
  });

  /* ---------- the character on the profile ---------- */
  r.get('/avatar/card', async (req, res) => {
    const u = req.user, lang = req.lang;
    const [avatars, wal, ach, badges, st] = await Promise.all([db.all('SELECT * FROM avatars WHERE user_id = ? ORDER BY id', u.id), tokens.wallet(u.id), db.get('SELECT COUNT(*) n FROM user_achievements WHERE user_id = ?', u.id),
      db.all('SELECT code FROM avatar_badges WHERE user_id = ?', u.id), db.get('SELECT active_avatar_id FROM avatar_state WHERE user_id = ?', u.id)]);
    const list = avatars.map(avatar.shape), act = list.find((a) => st && a.id === st.active_avatar_id) || list[0] || null;
    let outfit = [], pet = null, items = [];
    if (act) {
      const slugs = Object.values(act.equipped);
      items = slugs.length ? await db.all(`SELECT * FROM avatar_items WHERE slug IN (${slugs.map(() => '?').join(',')})`, ...slugs) : [];
      const art = items.map((it) => ({ slug: it.slug, slot: it.slot, kind: it.kind, name: pick(it, lang), rarity: it.rarity, art: JSON.parse(it.art || '{}'), image: it.image_url }));
      outfit = art.filter((x) => !['pet', 'background', 'effect', 'animation', 'style', 'collectible'].includes(x.slot)); pet = art.find((x) => x.slot === 'pet') || null;
    }
    res.json({ avatar: act, items: items.map((it) => ({ slug: it.slug, slot: it.slot, kind: it.kind, art: JSON.parse(it.art || '{}'), image: it.image_url })), outfit: outfit.map((o) => ({ slot: o.slot, name: o.name, rarity: o.rarity })), pet: pet ? { name: act.petName || pet.name, kind: pet.name, pose: act.petPose } : null,
      tokens: { balance: wal.balance, earned: wal.earned }, xp: u.xp_total, level: A.charLevel(u.xp_total), achievements: ach.n, badges: badges.map((b) => b.code), count: list.length });
  });
  return r;
};
