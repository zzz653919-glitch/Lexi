/* Unit tests for the answer-checking module (no browser): node tests/answer-check.test.js */
const fs = require('fs');
const path = require('path');
global.window = {}; global.VL = {};
const load = (f) => eval(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
load('utils.js'); load('quiz-engine.js');
const words = [];
VL.store = { state: { words, settings: {} } };
load('answer-check.js');
const A = VL.answers;
let n = 0;
const W = (en, uz, extra) => { const w = Object.assign({ id: 'w' + (n++), en, uz, alts: [] }, extra || {}); words.push(w); return w; };
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('FAIL:', m); } else console.log('ok  -', m); };
const v = (input, w, o) => A.checkWord(input, w, Object.assign({ dir: 'en-uz' }, o)).verdict;
const good = (input, w, o) => ['correct', 'typo'].includes(v(input, w, o));

/* verb forms: -moq <-> -ish */
const lose = W('lose', "yo'qotmoq"), begin = W('begin', 'boshlamoq'), help = W('help', 'yordam bermoq'), repair = W('repair', "ta'mirlamoq"), quick = W('quick', 'tez', { alts: [{ text: 'tezkor', context: '' }] });
ok(good("Yo'qotish", lose), "lose: yo'qotish accepted for yo'qotmoq");
ok(good("yo‘qotmoq", lose), 'lose: other apostrophe style and capitals');
ok(good('  YO\'QOTMOQ. ', lose), 'lose: extra spaces, capitals, final dot');
ok(good('boshlash', begin) && good('Boshlamoq', begin), 'begin: boshlamoq = boshlash');
ok(good('yordam berish', help) && good('yordam bermoq', help), 'help: yordam bermoq = yordam berish');
ok(good("ta'mirlash", repair) && good('ta’mirlamoq', repair), "repair: ta'mirlamoq = ta'mirlash");
ok(good('tez', quick) && good('Tezkor', quick), 'quick: tez and tezkor accepted');
ok(v('sekin', quick) === 'wrong', 'quick: unrelated word rejected');

/* participle: "To'g'ri javob: buzilmoq / Siz yozdingiz: buzilgan" */
const brk = W('break down', 'buzilmoq');
ok(good('buzilgan', brk) && good('buzilish', brk) && good('Buzilmoq', brk), 'buzilmoq = buzilgan = buzilish');
ok(good('chiqqan', W('go out', 'chiqmoq')) && good('kelgan', W('come', 'kelmoq')), 'participle after q and plain stems');
ok(v('buzilgani', brk) !== 'correct' && v('buzildi', brk) === 'wrong', 'other grammatical forms are not guessed');

/* interchangeable intensifiers */
const much = W('too much work', "haddan ortiq ko’p ish");
ok(good("juda ko'p ish", much) && good('Haddan tashqari ko‘p ish', much) && good("haddan ortiq ko'p ish", much), "haddan ortiq ko'p ish = juda ko'p ish");
ok(v("kam ish", much) === 'wrong', 'a different meaning is still rejected');

/* more interchangeable words */
const syn = (en, uz, ok1, bad) => { const w = W(en, uz); ok(good(ok1, w), en + ': ' + uz + ' = ' + ok1); if (bad) ok(v(bad, w) === 'wrong', en + ': ' + bad + ' rejected'); };
syn('but', 'lekin', 'ammo', 'va');
syn('beautiful', 'chiroyli', "go'zal", 'xunuk');
syn('difficult', 'qiyin', 'mushkul', 'oson');
syn('doctor', 'shifokor', 'vrach', "o'qituvchi");
syn('teacher', "o'qituvchi", 'ustoz', 'shifokor');
syn('search', 'izlamoq', 'qidirmoq', 'topmoq');
syn('finish', 'tugatmoq', 'yakunlamoq', 'boshlamoq');
syn('car', 'mashina', 'avtomobil', 'poyezd');
syn('thanks', 'rahmat', 'tashakkur', 'iltimos');
syn('always', 'hamisha', 'doim', 'hech qachon');
syn('often', "tez-tez", 'tez tez', 'kamdan-kam');
syn('person', 'odam', 'inson', 'hayvon');
syn('clever', 'aqlli', 'zehnli', 'dangasa');
syn('spring', 'bahor', 'bahor fasli', 'kuz');
syn('buy', 'sotib olmoq', 'xarid qilmoq', 'sotmoq');
syn('quiet', 'tinch', 'sokin', 'shovqinli');
ok(good('sotib olish', words.find((w) => w.en === 'buy')), 'multi-word verb: sotib olish');

/* forms and meaning */
const read = W('read', "o'qimoq");
ok(good("o'qish", read), "read: o'qish accepted");
ok(v("o'q", read) === 'wrong', "read: o'q (bullet) is a different word, rejected");
ok(v('yozmoq', read) === 'wrong', 'read: another verb rejected');
ok(v('', read) === 'empty', 'empty answer');

/* several stored translations */
const home = W('house', 'uy; xonadon');
ok(good('xonadon', home) && good('uy', home), 'semicolon translations are all accepted');
ok(good('uy, xonadon', home), 'several answers typed together');

/* context-dependent translations */
const give = W('give', 'bermoq', { alts: [{ text: 'boy bermoq', context: "o'yinda" }, { text: 'uzatmoq', context: '' }] });
ok(v('boy bermoq', give) === 'contextOnly', 'boy bermoq alone is flagged: only right in context');
ok(good('boy bermoq', give, { context: "o'yinda" }), 'boy bermoq accepted in the right context');
ok(v('bermoq', give, { context: "o'yinda" }) === 'wrong' || v('bermoq', give, { context: "o'yinda" }) === 'generalOnly', 'bermoq in the game context is not the intended meaning');
ok(good('uzatmoq', give) && good('uzatish', give), 'general extra translation + its other form accepted');

/* spelling: strict about meaning-changing slips */
const beautiful = W('beautiful', 'chiroyli');
ok(v('chiroyl', beautiful) === 'close' || v('chiroyl', beautiful) === 'wrong', 'short word with a letter missing is not accepted');
const important = W('important', 'muhim');
const comp = W('university', 'universitet'), comp2 = W('universal', 'universal');
ok(v('universitat', comp) === 'typo', 'long answer with one slip accepted as typo');
ok(v('universitat', comp, { typo: 'strict' }) === 'close', 'strict mode: typo is not accepted');
ok(v('universal', comp) === 'wrong', 'a different known word is never accepted');
const kitob = W('book', 'kitob'), kitoh = W('x', 'kitoblar');
ok(v('kitobx', kitob) !== 'correct', 'similar letters alone are not correct');
ok(v('sevgi', W('love', 'muhabbat')) === 'wrong', 'unrelated answer wrong');

/* Uzbek -> English: synonyms from the vocabulary */
const homeEn = W('home', 'uy');
const house = words.find((w) => w.en === 'house');
ok(A.checkWord('home', house, { dir: 'uz-en', prompt: 'uy' }).verdict === 'correct', 'uz->en: another word with the same translation accepted (home for uy)');
ok(A.checkWord('House', house, { dir: 'uz-en', prompt: 'uy' }).verdict === 'correct', 'uz->en: own word accepted');
ok(A.checkWord('car', house, { dir: 'uz-en', prompt: 'uy' }).verdict === 'wrong', 'uz->en: unrelated word rejected');
const run = W('to run', 'yugurmoq');
ok(A.checkWord('run', run, { dir: 'uz-en', prompt: 'yugurmoq' }).verdict === 'correct', 'uz->en: "to" is optional');

/* alts text helpers */
const parsed = A.parseAlts("yo'qotish\nboy bermoq | o'yinda\n\n");
ok(parsed.length === 2 && parsed[1].context === "o'yinda", 'parseAlts reads "text | context" lines');
ok(A.formatAlts(parsed) === "yo'qotish\nboy bermoq | o'yinda", 'formatAlts round-trips');
ok(A.validateExtras({ alts: new Array(13).fill({ text: 'a', context: '' }) }) === 'err.altsMany', 'too many alternatives rejected');
ok(A.validateExtras({ pos: 'banana' }) === 'err.posBad', 'unknown part of speech rejected');
ok(A.validateExtras({ pos: 'verb', alts: [] }) === null, 'valid extras accepted');

if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
console.log('All answer-check tests passed.');
