/* Checks the vocabulary topic data (no browser): node tests/vocab-data.test.js
   Fails on broken rows and duplicates inside one topic; prints how complete each topic is. */
const fs = require('fs');
const path = require('path');
global.window = {}; global.VL = {};
const dir = path.join(__dirname, '..', 'js', 'data');
eval(fs.readFileSync(path.join(dir, 'topic-index.js'), 'utf8'));
fs.readdirSync(dir).filter((f) => /^words-.*\.js$/.test(f)).sort().forEach((f) => eval(fs.readFileSync(path.join(dir, f), 'utf8')));
let failed = 0;
const bad = (m) => { failed++; console.error('FAIL:', m); };
const norm = (s) => s.toLowerCase().replace(/[’‘ʻʼ]/g, "'").replace(/\s+/g, ' ').trim();
const MIN = Number(process.env.VOCAB_MIN || 30);
const POS = Object.keys(VL.POS_CODES), LV = VL.VOCAB_LEVELS;
if (VL.vocabTopics.length !== 120) bad('expected 120 topics, got ' + VL.vocabTopics.length);
Object.keys(VL.vocabWords).forEach((id) => { if (!VL.vocabTopics.some((t) => t.id === id)) bad('data for unknown topic ' + id); });
const seenAll = new Map();
let total = 0, empty = [], thin = [];
VL.vocabTopics.forEach((tp) => {
  if (!VL.vocabCategories.some((c) => c.id === tp.cat)) bad(tp.id + ': unknown category');
  if (!tp.uz || !tp.en || !tp.ru || !tp.emoji) bad(tp.id + ': missing name or emoji');
  const rows = VL.vocabWords[tp.id] || [];
  if (!rows.length) { empty.push(tp.id); return; }
  if (rows.length < MIN) thin.push(tp.id + '(' + rows.length + ')');
  total += rows.length;
  const seen = new Set();
  rows.forEach((r, i) => {
    const where = tp.id + '#' + (i + 1) + ' "' + r[0] + '"';
    if (r.length < 6 || r.length > 7) return bad(where + ': row must have 6 or 7 fields');
    const [en, uz, pos, lv, ex, exUz] = r;
    [en, uz, ex, exUz].forEach((x, k) => { if (typeof x !== 'string' || !x.trim()) bad(where + ': empty field ' + k); else if (x !== x.trim() || /\s{2}/.test(x)) bad(where + ': stray spaces in field ' + k); });
    if (!POS.includes(pos)) bad(where + ': bad part of speech ' + pos);
    if (!LV.includes(lv)) bad(where + ': bad level ' + lv);
    if (/[()]/.test(en)) bad(where + ': no brackets in the English word');
    if (!/[.!?]$/.test(ex) || !/[.!?]$/.test(exUz)) bad(where + ': examples must end with . ! or ?');
    if (/�/.test(en + uz + ex + exUz)) bad(where + ': replacement character');
    const k = norm(en);
    if (seen.has(k)) bad(where + ': duplicate inside the topic');
    seen.add(k);
    if (!seenAll.has(k)) seenAll.set(k, []);
    seenAll.get(k).push(tp.id);
  });
});
const shared = Array.from(seenAll.values()).filter((v) => v.length > 1).length;
console.log('topics with words: ' + (120 - empty.length) + ' / 120, entries: ' + total + ', distinct English words: ' + seenAll.size + ', words used by more than one topic: ' + shared);
if (thin.length) console.log('topics below ' + MIN + ' words: ' + thin.join(', '));
if (empty.length) console.log('topics without words: ' + empty.join(', '));
if (process.env.VOCAB_REQUIRE_ALL && empty.length) bad(empty.length + ' topics still empty');
if (failed) { console.error(failed + ' problem(s)'); process.exit(1); }
console.log('Vocabulary data checks passed.');
