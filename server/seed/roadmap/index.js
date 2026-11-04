const fs = require('node:fs');
const path = require('node:path');
const { ensureRoadmap } = require('./build');
const A1 = require('./a1');

/* the English words of the interface texts: kept as they are when Uzbek lesson texts are converted to the new alphabet */
function englishWords() {
  const set = new Set();
  try { const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8')); for (const v of Object.values(en)) for (const w of JSON.stringify(v).split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); } catch (_) { /* no file */ }
  return set;
}
const FLAG = 'seeded_roadmap_a1_v1';
async function ensure(db) {
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG)) return { lessons: 0, exercises: 0 };
  const made = await ensureRoadmap(db, A1.content(englishWords()));
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG);
  return made;
}
module.exports = { ensure };
