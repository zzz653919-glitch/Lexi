/* Creates the LEXIO KIDS categories and picture cards (once; administrators may edit everything afterwards). */
const { CATEGORIES } = require('./data');
const FLAG = 'seeded_kids_1';

function parseWords(text) {
  return text.trim().split('\n').map((line) => line.split('|').map((x) => x.trim())).map((p) => ({ en: p[0], uz: p[1], ru: p[2], pic: p[3], extra: p[4] || '' }));
}
async function ensureKids(db) {
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG)) return { categories: 0, words: 0 };
  const t = new Date().toISOString();
  let cats = 0, words = 0;
  for (const [i, c] of CATEGORIES.entries()) {
    let row = await db.get('SELECT id FROM kids_categories WHERE slug = ?', c.slug);
    if (!row) {
      const r = await db.run('INSERT INTO kids_categories (slug, title_en, title_uz, title_ru, emoji, color, kind, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        c.slug, c.en, c.uz, c.ru, c.emoji, c.color, c.kind, i + 1, 'published', t, t);
      row = { id: r.id }; cats++;
      const items = parseWords(c.words);
      await db.batch(items.map((w, j) => ({ sql: 'INSERT INTO kids_words (category_id, en, uz, ru, pic, extra, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', args: [row.id, w.en, w.uz, w.ru, w.pic, w.extra, j + 1, 'published', t, t] })));
      words += items.length;
    }
  }
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG);
  return { categories: cats, words };
}
module.exports = { ensureKids, parseWords, CATEGORIES };
