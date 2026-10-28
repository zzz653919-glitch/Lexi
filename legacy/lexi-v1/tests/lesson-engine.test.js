/* Pure logic tests for the lesson engine (no browser): node tests/lesson-engine.test.js */
const fs = require('fs');
const path = require('path');
global.window = {}; global.VL = {};
const load = (f) => eval(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8').replace('window.VL = { views: {} };', 'VL.views = {};'));
load('utils.js'); load('quiz-engine.js'); load('sentences.js');
const cols = [{ id: 'c1', name: 'A1 · Family', deckKey: 'A1.family' }, { id: 'c2', name: 'Mine' }];
const mkWord = (en, uz, i, col) => ({ id: 'w' + i, en, uz, collectionId: col || 'c1', box: 0, reps: 0, lapses: 0, due: null, correct: 0, wrong: 0, streak: 0, createdAt: i, example: '' });
const words = [['mother', 'ona'], ['father', 'ota'], ['sister', 'opa'], ['brother', 'aka'], ['water', 'suv'], ['apple', 'olma'], ['look for', 'izlamoq'], ['to run', 'yugurmoq'], ['house', 'uy'], ['book', 'kitob']].map((x, i) => mkWord(x[0], x[1], i));
VL.store = { status: () => 'new', collection: (id) => cols.find((c) => c.id === id), word: (id) => words.find((w) => w.id === id), state: { words, settings: {} } };
load('learn-engine.js'); load('lesson-engine.js');
const E = VL.learn;

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('FAIL:', m); } else console.log('ok  -', m); };

/* ---- sentence checking ---- */
const cs = (i, alts, lang) => E.checkSentence(i, alts, lang, true);
ok(cs('Men uydaman', ['Men uydaman.', 'Uydaman.'], 'uz').correct, 'uz: capitalisation and final punctuation are ignored');
ok(cs('uydaman', ['Men uydaman.'], 'uz').correct, 'uz: dropping the pronoun "Men" is accepted');
ok(cs('Men uyda turibman', ['Men uydaman.', 'Men uyda turibman.'], 'uz').correct, 'uz: any listed alternative is accepted');
ok(cs("Men o‘qiyman", ["Men o'qiyman."], 'uz').correct, 'uz: apostrophe variants are treated alike');
ok(!cs('Men maktabdaman', ['Men uydaman.'], 'uz').correct, 'uz: a different sentence is rejected');
ok(!cs('', ['Men uydaman.'], 'uz').correct, 'uz: empty input is rejected');
ok(cs("I'm at home", ['I am at home.'], 'en').correct, "en: contraction I'm = I am");
ok(cs('I am at home', ["I'm at home."], 'en').correct, "en: expanded form matches a contracted answer");
ok(cs("She doesn't eat meat", ["She does not eat meat."], 'en').correct, "en: doesn't = does not");
ok(cs('i drink water', ['I drink water.'], 'en').correct, 'en: case and punctuation ignored');
const typo = cs('I am at hom', ['I am at home.'], 'en');
ok(typo.correct && typo.typo, 'en: one missing letter is accepted and flagged as a typo');
ok(!cs('I am at school', ['I am at home.'], 'en').correct, 'en: a different word is rejected');
ok(!cs('home at I am', ['I am at home.'], 'en').correct, 'en: wrong word order is rejected');
ok(!cs('I am', ['I am at home.'], 'en').correct, 'en: an incomplete sentence is rejected');

/* ---- tiles & masks ---- */
const tiles = E.tilesFrom(Array.from('apple'), true);
ok(tiles.length === 5 && new Set(tiles.map((t) => t.id)).size === 5, 'letter tiles: 5 tiles with unique ids (duplicate P stays two tiles)');
ok(tiles.filter((t) => t.text === 'P').length === 2, 'letter tiles: both P tiles exist');
let everShuffled = false; for (let i = 0; i < 20; i++) { if (E.tilesFrom(Array.from('apple'), true).map((t) => t.text).join('') !== 'APPLE') everShuffled = true; }
ok(everShuffled, 'letter tiles: are shuffled');
ok(E.tilesFrom(['I', 'drink', 'water'], false).map((t) => t.text).sort().join(' ') === 'I drink water', 'word tiles contain exactly the sentence words');
ok(E.sentenceTokens('Do you speak English?').join('|') === 'Do|you|speak|English', 'sentence tokens drop the final punctuation');
ok(E.mk.scramble(mkWord('look for', 'x', 99)) === null, 'multi-word entries do not become letter scrambles');

/* ---- guided lesson ---- */
const types = new Set(); let bad = 0, lengths = new Set(), learnBefore = 0, runs = 200, order = new Set();
for (let r = 0; r < runs; r++) {
  const g = E.buildGuided({ words, length: [10, 12, 15][r % 3], speech: r % 2 === 0, history: [] }, words);
  lengths.add(g.items.length);
  order.add(g.items.map((i) => i.type).join(','));
  const introduced = new Set();
  g.items.forEach((it, i) => {
    types.add(it.type);
    if (it.type === 'learn') introduced.add(it.wordIds[0]);
    else if (it.wordIds.some((id) => !words.find((w) => w.id === id).reps && g.items.some((x) => x.type === 'learn' && x.wordIds[0] === id) && !introduced.has(id))) learnBefore++;
    if (i && g.items[i].type === g.items[i - 1].type) bad++;
    const a = g.items[i - 1], c = g.items[i];
    if (i && a.type !== 'learn' && a.type !== 'match' && c.type !== 'match' && a.wordIds.some((id) => c.wordIds.includes(id))) bad++;
    if (it.type === 'listen' && r % 2 !== 0) bad++; // never a listening exercise without speech support
  });
}
ok(bad === 0, 'guided lessons: no neighbouring items share a type or word, no listening without speech (' + bad + ' violations)');
ok(learnBefore === 0, 'guided lessons: a new word is always introduced before it is used');
ok([...lengths].every((n) => n >= 10 && n <= 15), 'guided lessons: 10-15 exercises (' + [...lengths].sort() + ')');
ok(order.size > 20, 'guided lessons: the order differs between lessons (' + order.size + ' different orders in ' + runs + ')');
const need = ['learn', 'choose', 'scramble', 'listen', 'cloze', 'sentEnUz', 'sentUzEn', 'order', 'match', 'translate'];
ok(need.every((t) => types.has(t)), 'guided lessons: all kinds of exercises appear (' + [...types].sort().join(', ') + ')');
const big = E.buildGuided({ words, length: 15, speech: true, history: [] }, words);
ok(big.items.filter((i) => i.type === 'choose').every((i) => i.options.length === 4 && i.options.filter((o) => o.correct).length === 1), 'choose: 4 options, exactly one correct');

// the correct option does not always sit in the same place
const pos = new Set();
for (let i = 0; i < 40; i++) { const it = E.mk.choose(words[i % words.length], words); if (it) pos.add(it.options.findIndex((o) => o.correct)); }
ok(pos.size >= 3, 'choose: the correct answer appears in several positions (' + [...pos].sort() + ')');
// no two options with the same text
ok(Array.from({ length: 30 }, (_, i) => E.mk.choose(words[i % words.length], words)).filter(Boolean).every((it) => new Set(it.options.map((o) => o.text)).size === 4), 'choose: options are all different');

// the history makes the next lesson prefer different sentences
const a = E.buildGuided({ words, length: 12, speech: false, history: [] }, words);
const used = a.sentenceIds;
const b = E.buildGuided({ words, length: 12, speech: false, history: used }, words);
ok(b.sentenceIds.filter((id) => used.includes(id)).length <= 2, 'guided lessons: recently used sentences are avoided');

/* ---- mistakes come back as a different exercise, near the end ---- */
const base = E.buildGuided({ words, length: 12, speech: true, history: [] }, words).items;
let diffType = 0, nearEnd = 0, tries = 0;
for (let i = 0; i < 60; i++) {
  const items = base.slice();
  const idx = 1 + (i % 4);
  const src = items[idx];
  if (src.type === 'learn' || src.type === 'match') continue;
  const r = E.reviewItemFor(src, words, true);
  if (!r) continue;
  tries++;
  if (r.type !== src.type && r.retry) diffType++;
  const pos2 = E.insertReview(items, idx, r);
  if (pos2 >= items.length - 3 && pos2 > idx + 1) nearEnd++;
}
ok(tries > 20 && diffType === tries, 'review: a mistake is repeated as a different kind of exercise (' + diffType + '/' + tries + ')');
ok(nearEnd >= tries * 0.9, 'review: the repeat is placed near the end of the lesson (' + nearEnd + '/' + tries + ')');

// single-type lessons
const sc = E.buildSingle('scramble', { words, size: 10 }, words);
ok(sc.items.length > 0 && sc.items.every((i) => i.type === 'scramble'), 'single type: scramble only (' + sc.items.length + ' items, multi-word entries skipped)');
ok(E.buildSingle('listen', { words, size: 10, speech: false }, words).items.length === 0, 'single type: listening is not offered without speech support');
ok(E.buildSingle('cloze', { words, size: 8 }, words).items.every((i) => i.type === 'cloze'), 'single type: cloze only');
ok(E.buildSingle('order', { words, size: 8 }, words).items.every((i) => i.type === 'order' && i.tiles.length >= 3), 'single type: word-order items have 3+ tiles');

// XP table
ok(E.xpFor('sentUzEn', true, false) > E.xpFor('choose', true, false) && E.xpFor('choose', false, false) === 0, 'XP: harder exercises give more, wrong answers give none');
ok(E.xpFor('scramble', true, true) === Math.round(E.xpFor('scramble', true, false) * 0.5), 'XP: a repeated exercise gives half');
process.exit(failed ? 1 : 0);
