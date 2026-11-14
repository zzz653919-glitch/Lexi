/* Achievement management for the admin panel: the catalogue (texts in three languages, rarity, requirement, rewards), how many learners unlocked each one,
   and nothing that could unlock an achievement for someone: unlocking only ever happens on the server from real activity. */
const express = require('express');
const { now, clean, int, HttpError, bad } = require('../lib/util');
const AC = require('../lib/achievements');

const ICONS = ['flag', 'path', 'book', 'cards', 'trophy', 'coin', 'flame', 'heart', 'bolt', 'check', 'star', 'globe', 'target', 'sun', 'moon', 'leaf', 'sprout', 'chart', 'shield', 'refresh', 'users', 'palette'];

module.exports = function adminAchievementRoutes({ db, auth, audit }) {
  const r = express.Router();
  const staff = auth.requireRole('editor', 'admin'), adminOnly = auth.requireRole('admin');
  const need = (row) => { if (!row) throw new HttpError(404, 'err.not_found'); return row; };

  async function input(b, partial, code) {
    const e = {}, v = {}, has = (k) => b[k] !== undefined;
    if (!partial || has('title_en')) { const x = clean(b.title_en, 60); if (!x) e.title_en = 'val.required'; else v.title_en = x; }
    for (const k of ['title_uz', 'title_ru']) if (has(k)) v[k] = clean(b[k], 60);
    if (!partial || has('desc_en')) { const x = clean(b.desc_en, 200); if (!x) e.desc_en = 'val.required'; else v.desc_en = x; }
    for (const k of ['desc_uz', 'desc_ru']) if (has(k)) v[k] = clean(b[k], 200);
    if (!partial || has('category')) { if (!AC.CATEGORIES.includes(b.category)) e.category = 'val.ach_category'; else v.category = b.category; }
    if (!partial || has('rarity')) { if (!AC.RARITIES.includes(b.rarity)) e.rarity = 'val.avatar_rarity'; else v.rarity = b.rarity; }
    if (!partial || has('metric')) {
      const m = String(b.metric || '');
      if (!AC.validMetric(m)) e.metric = 'val.ach_metric';
      else if (m.startsWith('level:') && !(await db.get('SELECT 1 x FROM levels WHERE code = ?', m.slice(6)))) e.metric = 'val.ach_metric';
      else v.metric = m;
    }
    if (!partial || has('target')) { const n = int(b.target, 0); if (n < 1 || n > 100000) e.target = 'val.ach_target'; else v.target = n; }
    if (has('icon')) { if (!ICONS.includes(b.icon)) e.icon = 'val.ach_icon'; else v.icon = b.icon; }
    for (const k of ['xp', 'tokens']) if (has(k)) { const n = int(b[k], -1); if (n < 0 || n > 5000) e[k] = 'val.ach_reward'; else v[k] = n; }
    if (has('item_slug')) { const s = String(b.item_slug || ''); if (s && !(await db.get('SELECT 1 x FROM avatar_items WHERE slug = ?', s))) e.item_slug = 'val.ach_item'; else v.item_slug = s; }
    if (has('badge')) v.badge = b.badge ? 1 : 0;
    if (has('status')) { if (!['active', 'hidden'].includes(b.status)) e.status = 'val.kids_status'; else v.status = b.status; }
    if (Object.keys(e).length) throw bad('err.fix_fields', e);
    return v;
  }

  r.get('/achievements', staff, async (req, res) => {
    const [defs, counts, items, users] = await Promise.all([db.all('SELECT * FROM achievement_defs ORDER BY position, code'), db.all('SELECT code, COUNT(*) n FROM user_achievements GROUP BY code'),
      db.all("SELECT slug, name_en, slot, rarity FROM avatar_items WHERE status = 'active' ORDER BY slot, position, id"), db.get("SELECT COUNT(*) n FROM users WHERE role = 'learner'")]);
    const c = Object.fromEntries(counts.map((x) => [x.code, x.n]));
    res.json({ items: defs.map((d) => ({ ...d, unlocked: c[d.code] || 0 })), learners: users.n, lists: { categories: AC.CATEGORIES, rarities: AC.RARITIES, metrics: AC.METRICS, icons: ICONS, items } });
  });
  r.post('/achievements', adminOnly, async (req, res) => {
    const b = req.body || {}, code = String(b.code || '').toLowerCase();
    if (!/^[a-z0-9_]{2,40}$/.test(code)) throw bad('err.fix_fields', { code: 'val.ach_code' });
    if (await db.get('SELECT 1 x FROM achievement_defs WHERE code = ?', code)) throw bad('err.fix_fields', { code: 'val.slug_taken' });
    const v = await input(b, false), t = now(), top = ((await db.get('SELECT MAX(position) m FROM achievement_defs')) || {}).m || 0;
    await db.run(`INSERT INTO achievement_defs (code, category, rarity, metric, target, icon, xp, tokens, item_slug, badge, status, position, title_en, title_uz, title_ru, desc_en, desc_uz, desc_ru, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, code, v.category, v.rarity, v.metric, v.target, v.icon || 'star', v.xp || 0, v.tokens || 0, v.item_slug || '', v.badge === undefined ? 1 : v.badge, v.status || 'active', top + 10,
      v.title_en, v.title_uz || '', v.title_ru || '', v.desc_en, v.desc_uz || '', v.desc_ru || '', t, t);
    await audit(req, 'achievement.create', 'achievement', (await db.get('SELECT rowid r FROM achievement_defs WHERE code = ?', code)).r, { code });
    res.status(201).json(await db.get('SELECT * FROM achievement_defs WHERE code = ?', code));
  });
  r.patch('/achievements/:code', adminOnly, async (req, res) => {
    const d = need(await db.get('SELECT rowid r, * FROM achievement_defs WHERE code = ?', String(req.params.code)));
    const v = await input(req.body || {}, true), keys = Object.keys(v);
    // the requirement of an achievement that people already unlocked cannot change under them
    if ((v.metric !== undefined && v.metric !== d.metric || v.target !== undefined && v.target !== d.target) && (await db.get('SELECT 1 x FROM user_achievements WHERE code = ?', d.code))) throw new HttpError(409, 'err.ach_unlocked');
    if (keys.length) await db.run(`UPDATE achievement_defs SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE code = ?`, ...keys.map((k) => v[k]), now(), d.code);
    await audit(req, 'achievement.update', 'achievement', d.r, v);
    res.json(await db.get('SELECT * FROM achievement_defs WHERE code = ?', d.code));
  });
  r.delete('/achievements/:code', adminOnly, async (req, res) => {
    const d = need(await db.get('SELECT rowid r, code FROM achievement_defs WHERE code = ?', String(req.params.code)));
    if ((await db.get('SELECT 1 x FROM user_achievements WHERE code = ?', d.code))) throw new HttpError(409, 'err.ach_unlocked');   // hide it instead: learners keep what they earned
    await db.run('DELETE FROM user_achievement_progress WHERE code = ?', d.code);
    await db.run('DELETE FROM achievement_defs WHERE code = ?', d.code);
    await audit(req, 'achievement.delete', 'achievement', d.r, { code: d.code });
    res.json({ ok: true });
  });
  return r;
};
