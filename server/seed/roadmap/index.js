const fs = require('node:fs');
const path = require('node:path');
const { ensureRoadmap } = require('./build');
const LEVELS = require('./levels');

/* the English words of the interface texts: kept as they are when Uzbek lesson texts are converted to the new alphabet */
function englishWords() {
  const set = new Set();
  try { const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8')); for (const v of Object.values(en)) for (const w of JSON.stringify(v).split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); } catch (_) { /* no file */ }
  return set;
}

/* a version string of the authored content: when lessons are added the seeding runs once more (it is idempotent) */
const versionOf = (content) => 'seeded_roadmap_' + Object.entries(content.levels).map(([c, l]) => `${c}${l.topics.reduce((a, t) => a + t.lessons.length, 0)}${l.exam ? 'x' : ''}`).join('_');
async function ensureAll(db) {
  const keep = englishWords();
  const content = LEVELS.content(keep);
  let made = { lessons: 0, exercises: 0 };
  const flag = versionOf(content);
  if (!await db.get('SELECT 1 x FROM settings WHERE key = ?', flag)) { made = await ensureRoadmap(db, content); await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", flag); }
  return made;
}
module.exports = { ensure: ensureAll };
