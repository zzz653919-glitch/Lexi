/* The vocabulary database (English, Uzbek, IPA, part of speech, example, synonyms, difficulty, topic, kind) by CEFR level.
   Source files (a1.js … ielts.js) export one text: a header line "@ Level | Topic | kind" starts a group, every other line is
   en | uz | ipa | pos | example | synonyms | difficulty   (synonyms and difficulty may be empty). Uzbek is written in the old spelling and converted. */
const fs = require('node:fs');
const path = require('node:path');
const { toNewUz } = require('../roadmap/uzfix');

const KINDS = ['word', 'collocation', 'phrasal_verb', 'idiom', 'academic'];
const LEVEL_DIFF = { A1: 1, A2: 1, B1: 2, B2: 3, C1: 4, IELTS: 3 };

function parse() {
  const rows = [], seen = new Set(), problems = [], dupes = [];
  for (const f of fs.readdirSync(__dirname).filter((x) => x !== 'index.js' && x.endsWith('.js')).sort()) {
    const text = require(path.join(__dirname, f));
    let level = '', topic = '', kind = 'word';
    String(text).split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line.startsWith('@')) { const p = line.slice(1).split('|').map((x) => x.trim()); level = p[0]; topic = p[1] || ''; kind = (p[2] || 'word'); if (!KINDS.includes(kind)) problems.push(`${f}:${i + 1} kind ${kind}`); return; }
      const p = line.split('|').map((x) => x.trim());
      if (p.length < 5 || !p[0] || !p[1] || !p[4]) { problems.push(`${f}:${i + 1} incomplete: ${line.slice(0, 40)}`); return; }
      const key = p[0].toLowerCase();
      if (seen.has(key)) { dupes.push(`${f}:${i + 1} ${p[0]}`); return; }
      seen.add(key);
      rows.push({ en: p[0], uz: toNewUz(p[1]), ipa: p[2], pos: p[3], example: p[4], synonyms: p[5] || '', difficulty: Math.min(5, Math.max(1, Number(p[6]) || LEVEL_DIFF[level] || 1)), level, topic, kind });
    });
  }
  return { rows, problems, dupes };
}

async function ensureVocab(db) {
  const { rows, problems } = parse();
  if (problems.length) throw new Error('Vocabulary data invalid: ' + problems.slice(0, 5).join('; '));
  const flag = 'seeded_vocab_' + rows.length;
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', flag)) return { added: 0, total: rows.length };
  const course = await db.get("SELECT id FROM courses WHERE slug = 'lexio-roadmap'");
  const have = new Set((await db.all('SELECT en FROM vocabulary')).map((r) => String(r.en).toLowerCase()));
  const t = new Date().toISOString();
  let added = 0, batch = [];
  const flush = async () => { if (batch.length) { await db.batch(batch); batch = []; } };
  for (const r of rows) {
    if (have.has(r.en.toLowerCase())) continue;
    batch.push({ sql: 'INSERT OR IGNORE INTO vocabulary (course_id, level_id, unit_id, lesson_id, en, uz, translations, pos, example, example_uz, cefr, status, created_at, updated_at, ipa, synonyms, topic, difficulty, kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [course ? course.id : null, null, null, null, r.en, r.uz, '{}', r.pos, r.example, '', r.level, 'published', t, t, r.ipa, r.synonyms, r.topic, r.difficulty, r.kind] });
    added++;
    if (batch.length >= 150) await flush();
  }
  await flush();
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", flag);
  return { added, total: rows.length };
}
module.exports = { ensureVocab, parse };
