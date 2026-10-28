/* `npm run import-legacy-vocab`: copies the ~4,900 word entries of the old Lexi v1 vocabulary data (legacy/lexi-v1/js/data) into the
   vocabulary table as DRAFT entries (not shown to learners until an editor publishes them). Their translations and examples were
   written for v1 and have not been reviewed by a teacher. Words that already exist are skipped. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { now } = require('./lib/util');

async function run(db) {
  const dir = path.join(__dirname, '..', 'legacy', 'lexi-v1', 'js', 'data');
  if (!fs.existsSync(dir)) { console.error('legacy/lexi-v1/js/data was not found.'); process.exit(1); }
  const VL = { vocabWords: {}, vocabTopics: [], vocabCategories: [], POS_CODES: {} };
  VL.defVocab = (id, rows) => { VL.vocabWords[id] = rows; };
  const ctx = vm.createContext({ VL, console });
  for (const f of ['topic-index.js'].concat(fs.readdirSync(dir).filter((x) => /^words-.*\.js$/.test(x)).sort())) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', pron: 'pronoun', phr: 'phrase', det: 'determiner', int: 'interjection' };
  const t = now(); let added = 0, skipped = 0;
  await db.tx(async () => {
    for (const [, rows] of Object.entries(VL.vocabWords)) for (const r of rows) {
      const [en, uz, pos, level, ex, exUz] = r;
      if (!en || !uz) { skipped++; continue; }
      const res = await db.run("INSERT OR IGNORE INTO vocabulary (en, uz, pos, cefr, example, example_uz, status, created_at, updated_at) VALUES (?,?,?,?,?,?, 'draft', ?, ?)", String(en).slice(0, 120), String(uz).slice(0, 200), POS[pos] || '', ['A1', 'A2', 'B1', 'B2', 'C1'].includes(level) ? level : '', String(ex || '').slice(0, 300), String(exUz || '').slice(0, 300), t, t);
      if (res.changes) added++; else skipped++;
    }
  });
  console.log(`Imported ${added} draft words (${skipped} skipped as duplicates or incomplete). Review and publish them in the admin panel (Vocabulary → status: draft).`);
}
module.exports = { run };
