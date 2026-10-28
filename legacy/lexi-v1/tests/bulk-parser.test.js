/* Pure logic tests for the bulk-import parser (no browser needed): node tests/bulk-parser.test.js */
const fs = require('fs');
const path = require('path');
global.window = {}; global.VL = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'bulk-parse.js'), 'utf8'));
let failed = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { failed++; console.error('FAIL:', m, '\n  got ', JSON.stringify(a), '\n  want', JSON.stringify(b)); } else console.log('ok  -', m); };
const pairs = (t, o) => VL.bulk.parse(t, o).rows.map((r) => [r.en, r.uz]);

const english = 'problem\nhome\nwork\nrepair\nbroken\nmend\ndie\nwater\nuntidy\ntidy\nlose\nlook for\ncut\nput on a plaster\nhave a row with\napologise';
const p1 = VL.bulk.parse(english);
eq(p1.rows.length, 16, 'format 1: 16 English-only lines -> 16 rows');
eq(p1.rows.map((r) => r.uz).every((x) => x === ''), true, 'format 1: translations stay empty');
eq(p1.rows[11].en, 'look for', 'format 1: "look for" stays one unit');
eq(p1.rows[14].en, 'have a row with', 'format 1: "have a row with" stays one unit');

const tsv = ['problem\tmuammo', 'home\tuy', 'work\tishlamoq', 'repair\ttuzatmoq', 'broken\tbuzilgan', 'mend\tyamoq solmoq', 'die\to‘lmoq', 'water\tsuv', 'untidy\ttartibsiz', 'tidy\ttartibli', 'lose\tyo‘qotmoq', 'look for\tizlamoq', 'cut\tkesmoq', 'put on a plaster\tleykoplastir qo‘ymoq', 'have a row with\tbilan janjallashmoq', 'apologise\tkechirim so‘ramoq'].join('\n');
const p2 = VL.bulk.parse(tsv);
eq(p2.separator, 'tab', 'format 2: tab detected');
eq(p2.rows.length, 16, 'format 2: 16 rows');
eq(p2.rows[11], { en: 'look for', uz: 'izlamoq', example: '', line: 12 }, 'format 2: phrase + translation aligned');
eq(p2.rows[14].uz, 'bilan janjallashmoq', 'format 2: "have a row with" -> its own translation');
eq(p2.rows[0], { en: 'problem', uz: 'muammo', example: '', line: 1 }, 'format 2: first row');

eq(pairs('problem;muammo\nhome;uy'), [['problem', 'muammo'], ['home', 'uy']], 'semicolon separator');
eq(pairs('problem,muammo\nlook for,izlamoq'), [['problem', 'muammo'], ['look for', 'izlamoq']], 'comma separator');
eq(pairs('problem — muammo\nhome - uy\nwork = ish\nrepair | tuzatmoq'), [['problem', 'muammo'], ['home', 'uy'], ['work', 'ish'], ['repair', 'tuzatmoq']], 'dash / equals / pipe separators');
eq(pairs('hello,salom; assalomu alaykum\nthank you,rahmat; tashakkur'), [['hello', 'salom; assalomu alaykum'], ['thank you', 'rahmat; tashakkur']], 'comma file whose translations contain ";"');
eq(pairs('hello;salom, assalomu\nbye;xayr'), [['hello', 'salom, assalomu'], ['bye', 'xayr']], 'semicolon file whose translations contain ","');
eq(pairs('"to run, to jog","yugurmoq"\nhome,uy'), [['to run, to jog', 'yugurmoq'], ['home', 'uy']], 'quoted CSV fields keep commas');

const table = '№\tEnglish\tO‘zbekcha tarjima\n1\tproblem\tmuammo\n2\thome\tuy\n3\twork\tishlamoq\n4\trepair\ttuzatmoq';
const p3 = VL.bulk.parse(table);
eq(p3.rows.map((r) => [r.en, r.uz]), [['problem', 'muammo'], ['home', 'uy'], ['work', 'ishlamoq'], ['repair', 'tuzatmoq']], 'table copied with header and № column');
eq([p3.hadHeader, p3.droppedNumbers], [true, true], 'header and number column reported');
eq(pairs('English,Uzbek\nproblem,muammo'), [['problem', 'muammo']], 'CSV header skipped');
eq(pairs('1. problem\n2. home\n3) work'), [['problem', ''], ['home', ''], ['work', '']], 'numbered English list');

eq(pairs('problem\tmuammo\n\n   \n\t\nhome\tuy\n'), [['problem', 'muammo'], ['home', 'uy']], 'blank lines ignored');
eq(VL.bulk.parse('a\tb\n\n\nc\td').blank, 2, 'blank lines counted');
eq(pairs('problem\tmuammo\nhome\nwork\tishlamoq'), [['problem', 'muammo'], ['home', ''], ['work', 'ishlamoq']], 'a missing translation keeps its row and does not shift others');
eq(pairs('problem\t\nhome\tuy'), [['problem', ''], ['home', 'uy']], 'empty Excel cell -> empty translation');
eq(pairs('  look   for \t  izlamoq  '), [['look for', 'izlamoq']], 'extra spaces collapsed');
eq(pairs('hello, how are you\nthanks', { separator: 'none' }), [['hello, how are you', ''], ['thanks', '']], 'forced "English only" keeps commas inside phrases');
eq(VL.bulk.parse('a\tb\tThe example.').rows[0].example, 'The example.', 'third column = example');
eq(pairs('﻿problem\tmuammo\r\nhome\tuy\r\n'), [['problem', 'muammo'], ['home', 'uy']], 'BOM and Windows line endings');

// validation
const ex = new Map([['water', { id: 'w', uz: 'suv' }]]);
const st = VL.bulk.validate([{ en: 'a', uz: 'x' }, { en: '', uz: 'x' }, { en: 'b', uz: '' }, { en: 'A ', uz: 'y' }, { en: 'Water', uz: 'suv' }], ex);
eq(st.map((s) => s.code), ['ready', 'noEn', 'noUz', 'dupList', 'dupExisting'], 'validation codes');
eq(st[3].ref, 1, 'duplicate points to the first row');

// size / speed
const big = Array.from({ length: 6000 }, (_, i) => 'word' + i + '\ttarjima' + i).join('\n');
const t0 = Date.now(); const pb = VL.bulk.parse(big); VL.bulk.validate(pb.rows, null); const ms = Date.now() - t0;
eq([pb.rows.length, pb.truncated], [5000, true], '6000 lines are capped at 5000 rows and reported');
eq(ms < 500, true, '5000 rows parse + validate in ' + ms + ' ms');
process.exit(failed ? 1 : 0);
