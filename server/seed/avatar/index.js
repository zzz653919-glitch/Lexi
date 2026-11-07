/* Creates the Avatar Shop catalogue once (flag), without touching items an administrator has changed afterwards. */
const { ITEMS } = require('./catalog');
const FLAG = 'seeded_avatar_1';
async function ensureAvatar(db) {
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG)) return { items: 0 };
  const t = new Date().toISOString(); let n = 0;
  const stmts = ITEMS.map((it, i) => ({ sql: `INSERT OR IGNORE INTO avatar_items (slug, name_en, name_uz, name_ru, kind, slot, price, rarity, art, earn_rule, starter, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [it.slug, it.en, it.uz, it.ru, it.kind, it.slot, it.price, it.rarity, JSON.stringify(it.art), it.earn, it.starter, i + 1, t, t] }));
  for (let i = 0; i < stmts.length; i += 60) await db.batch(stmts.slice(i, i + 60));
  n = ITEMS.length;
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG);
  return { items: n };
}
module.exports = { ensureAvatar, ITEMS };
