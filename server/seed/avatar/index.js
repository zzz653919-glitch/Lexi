/* Creates the Avatar Shop catalogue once (flag), without touching items an administrator has changed afterwards. */
const { ITEMS, OLD_PETS } = require('./catalog');
const FLAG = 'seeded_avatar_1', FLAG_PETS = 'seeded_avatar_pets_2';
/* Pet models (once): adds the new animals to a catalogue that already exists and retires the plain coloured pets (owners keep theirs). */
async function ensurePets(db) {
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG_PETS)) return;
  const t = new Date().toISOString(), pets = ITEMS.filter((it) => it.slot === 'pet' && it.slug.startsWith('pet-') && it.art && it.art.v);
  const top = ((await db.get('SELECT MAX(position) m FROM avatar_items')) || {}).m || 0;
  const stmts = pets.map((it, i) => ({ sql: `INSERT OR IGNORE INTO avatar_items (slug, name_en, name_uz, name_ru, kind, slot, price, rarity, art, earn_rule, starter, position, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [it.slug, it.en, it.uz, it.ru, it.kind, it.slot, it.price, it.rarity, JSON.stringify(it.art), it.earn, it.starter, top + i + 1, t, t] }));
  for (const [slug, v] of Object.entries(OLD_PETS)) {
    const row = await db.get('SELECT id, art FROM avatar_items WHERE slug = ?', slug); if (!row) continue;
    const art = JSON.parse(row.art || '{}'); if (slug.startsWith('cat-') || slug.startsWith('dog-')) art.v = v;
    stmts.push({ sql: "UPDATE avatar_items SET status = 'disabled', art = ?, updated_at = ? WHERE id = ?", args: [JSON.stringify(art), t, row.id] });
  }
  for (let i = 0; i < stmts.length; i += 60) await db.batch(stmts.slice(i, i + 60));
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG_PETS);
}
async function ensureAvatar(db) {
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG)) { await ensurePets(db); return { items: 0 }; }
  const t = new Date().toISOString(); let n = 0;
  const stmts = ITEMS.map((it, i) => ({ sql: `INSERT OR IGNORE INTO avatar_items (slug, name_en, name_uz, name_ru, kind, slot, price, rarity, art, earn_rule, starter, position, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [it.slug, it.en, it.uz, it.ru, it.kind, it.slot, it.price, it.rarity, JSON.stringify(it.art), it.earn, it.starter, i + 1, t, t] }));
  for (let i = 0; i < stmts.length; i += 60) await db.batch(stmts.slice(i, i + 60));
  n = ITEMS.length;
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG);
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG_PETS);
  return { items: n };
}
module.exports = { ensureAvatar, ITEMS };
