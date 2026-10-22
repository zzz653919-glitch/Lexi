/* Browser tests for Bulk Vocabulary Import: node tests/bulk.test.js */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const OUT = os.tmpdir();
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const wait = (p, ms) => p.waitForTimeout(ms || 150);

const ENGLISH = ['problem', 'home', 'work', 'repair', 'broken', 'mend', 'die', 'water', 'untidy', 'tidy', 'lose', 'look for', 'cut', 'put on a plaster', 'have a row with', 'apologise'];
const TRANSLATIONS = ['muammo', 'uy', 'ishlamoq', 'tuzatmoq', 'buzilgan', 'yamoq solmoq', "o'lmoq", 'suv', 'tartibsiz', 'tartibli', "yo'qotmoq", 'izlamoq', 'kesmoq', "leykoplastir qo'ymoq", 'bilan janjallashmoq', "kechirim so'ramoq"];
TRANSLATIONS.splice(13, 0, 'kesmoq'); // keep 16 entries aligned with ENGLISH (cut -> kesmoq is index 12)
const PAIRS = ENGLISH.map((e, i) => [e, ['muammo', 'uy', 'ishlamoq', 'tuzatmoq', 'buzilgan', 'yamoq solmoq', "o'lmoq", 'suv', 'tartibsiz', 'tartibli', "yo'qotmoq", 'izlamoq', 'kesmoq', "leykoplastir qo'ymoq", 'bilan janjallashmoq', "kechirim so'ramoq"][i]]);
const tsv = (pairs) => pairs.map((p) => p.join('\t')).join('\n');
const gen = (n, prefix) => Array.from({ length: n }, (_, i) => [(prefix || 'word') + (i + 1), 'tarjima' + (i + 1)]);

async function fresh(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, locale: 'en-US' }, opts || {}));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(APP + '#/bulk');
  await page.waitForSelector('#bulk-text');
  return page;
}
const paste = async (page, text, sep) => {
  await page.fill('#bulk-text', text);
  if (sep) await page.selectOption('#bulk-sep', sep);
  await page.click('[data-action="build"]');
  await page.waitForSelector('.bulk-row[data-id]');
};
// the collection selector remembers the last target, so pick "new collection" explicitly
const toNew = async (page, name) => { await page.selectOption('#bulk-target', '__new__'); await page.fill('#bulk-newname', name); };
const tableRows = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.bulk-row[data-id]')).map((r) => [r.querySelector('.b-en').value, r.querySelector('.b-uz').value]));
const storeWords = (page, colName) => page.evaluate((n) => { const c = VL.store.state.collections.find((x) => x.name === n); return c ? VL.store.wordsIn(c.id).map((w) => [w.en, w.uz]) : null; }, colName);

(async () => {
  const browser = await playwright.chromium.launch();

  /* ---- entry points ---- */
  let page = await fresh(browser);
  await page.goto(APP + '#/vocabulary'); await page.waitForSelector('#add-form');
  await page.click('a[href="#/bulk"]'); await page.waitForSelector('#bulk-text');
  assert((await page.locator('h1').innerText()) === 'Bulk Vocabulary Import', 'My Vocabulary has a Bulk add button that opens the page');
  assert((await page.locator('nav a.active').innerText()).includes('My Vocabulary'), 'sidebar keeps "My Vocabulary" highlighted');

  /* ---- 1. ten words at once, saved to a named collection ---- */
  await paste(page, tsv(gen(10, 'w')));
  assert((await page.locator('.bulk-row[data-id]').count()) === 10, '10 words pasted -> 10 table rows');
  assert((await page.locator('#bulk-summary').innerText()).includes('10 ready'), 'summary shows 10 ready');
  assert((await page.locator('#bulk-willsave').innerText()).includes('10 words'), 'save panel shows how many words were found (10)');
  await toNew(page, 'Unit 5');
  await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  let saved = await storeWords(page, 'Unit 5');
  assert(saved && saved.length === 10, '10 words saved to the new collection "Unit 5" as separate records (' + (saved && saved.length) + ')');
  assert(JSON.stringify(saved.map((w) => w[0]).sort()) === JSON.stringify(gen(10, 'w').map((w) => w[0]).sort()), 'every English word stored individually');
  assert((await page.locator('.bulk-done').innerText()).includes('10 words saved to “Unit 5”'), 'success message shown');

  /* ---- 2. 20 and 50 words ---- */
  await page.click('[data-action="more"]');
  await paste(page, tsv(gen(20, 'twenty')));
  await page.selectOption('#bulk-target', { label: 'Unit 5' }); await wait(page);
  await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  assert((await storeWords(page, 'Unit 5')).length === 30, '20 more words saved into the existing collection (30 total)');
  await page.click('[data-action="more"]');
  await paste(page, tsv(gen(50, 'fifty')));
  assert((await page.locator('.bulk-row[data-id]').count()) === 50 && (await page.locator('.bulk-pager').innerText()).includes('1–50 of 50'), '50 words fit one page (page size 50)');
  await toNew(page, 'Fifty'); await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  assert((await storeWords(page, 'Fifty')).length === 50, '50 words saved');

  /* ---- 3. spec example: multi-word phrases, alignment ---- */
  await page.click('[data-action="more"]');
  await page.click('[data-action="example"]'); await page.waitForSelector('.bulk-row[data-id]');
  let rows = await tableRows(page);
  assert(rows.length === 16, 'spec example -> 16 rows');
  assert(JSON.stringify(rows) === JSON.stringify(PAIRS.map((p) => p.slice())) , 'every English word sits next to its own translation');
  assert(rows[11][0] === 'look for' && rows[11][1] === 'izlamoq', '"look for" kept as one unit with its translation');
  assert(rows[14][0] === 'have a row with' && rows[14][1] === 'bilan janjallashmoq', '"have a row with" kept as one unit');
  assert(rows[13][0] === 'put on a plaster', '"put on a plaster" kept as one unit');
  await toNew(page, 'Daily Vocabulary'); await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  saved = await storeWords(page, 'Daily Vocabulary');
  assert(JSON.stringify(saved) === JSON.stringify(PAIRS), 'saved words keep exact pairs and order');
  assert((await page.evaluate(() => VL.store.state.words.filter((w) => w.en.includes(' ')).length)) === 3, 'phrases stored as single records (3)');

  /* ---- 4. English-only list: empty translations ---- */
  await page.click('[data-action="more"]');
  await paste(page, ENGLISH.join('\n'));
  assert((await page.locator('#bulk-summary').innerText()).includes('16 without translation'), 'English-only: 16 rows flagged "without translation"');
  assert((await page.locator('.bulk-row.k-error').count()) === 16, 'rows with missing translation are highlighted');
  assert((await page.locator('#bulk-table-card').innerText()).includes('AI translation is not available'), 'honest note: no AI translation (button not faked)');
  assert((await page.locator('button:has-text("AI")').count()) === 0, 'no fake AI button');
  await toNew(page, 'English only'); await page.click('[data-action="save"]');
  assert((await page.locator('#bulk-save-error').innerText()).includes('Nothing to save'), 'cannot save while every translation is empty');
  await page.click('[data-action="fill-lib"]'); await wait(page, 300);
  const filled = await page.evaluate(() => Array.from(document.querySelectorAll('.bulk-row[data-id]')).filter((r) => r.querySelector('.b-uz').value).length);
  const marked = await page.locator('.bulk-row .chip:has-text("from library")').count();
  assert(filled >= 1 && marked === filled, 'fill-from-library filled ' + filled + ' translations and marks them as "from library"');
  const waterRow = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('.bulk-row[data-id]')).find((x) => x.querySelector('.b-en').value === 'water'); return r.querySelector('.b-uz').value; });
  assert(waterRow === 'suv', 'library filled "water" -> suv');
  // type the remaining translations by hand
  const missing = await page.evaluate(() => Array.from(document.querySelectorAll('.bulk-row[data-id]')).filter((r) => !r.querySelector('.b-uz').value).map((r) => r.querySelector('.b-en').value));
  const byHand = Object.fromEntries(PAIRS);
  for (const en of missing) {
    const input = page.locator('.bulk-row', { has: page.locator('.b-en[value="' + en + '"]') }).locator('.b-uz');
    await input.fill(byHand[en]);
  }
  await wait(page, 300);
  assert((await page.locator('#bulk-summary').innerText()).includes('16 ready'), 'after typing the rest, all 16 rows are ready');
  await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  saved = await storeWords(page, 'English only');
  assert(saved.length === 16 && saved.every(([e, u]) => byHand[e] === u || (e === 'water' && u === 'suv') || u), '16 words saved with filled + typed translations');

  /* ---- 5. duplicates: shown, never silently removed ---- */
  await page.click('[data-action="more"]');
  await paste(page, tsv([['water', 'suv'], ['bread', 'non'], ['Water', 'suv 2'], ['tea', 'choy'], ['look for', 'qidirmoq']]));
  await page.selectOption('#bulk-target', { label: 'Daily Vocabulary' }); await wait(page);
  assert((await page.locator('.bulk-row[data-id]').count()) === 5, 'duplicate rows stay in the table (5 rows)');
  assert((await page.locator('#bulk-dup-banner').innerText()).includes('duplicates found'), 'duplicate banner shown');
  const kinds = await page.evaluate(() => Array.from(document.querySelectorAll('.bulk-row[data-id]')).map((r) => r.className.match(/ k-(\w+)/)[1]));
  assert(JSON.stringify(kinds) === JSON.stringify(['dup', 'ok', 'dup', 'ok', 'dup']), 'duplicates identified: 2 already saved + 1 repeat within the list (' + kinds + ')');
  assert((await page.locator('.bulk-row[data-id]').nth(2).innerText()).includes('Repeats row 1'), 'repeat points to its first row');
  assert((await page.locator('.bulk-row[data-id]').nth(2).locator('input[type="checkbox"]').isChecked()) === false, 'duplicates are not ticked by default');
  assert((await page.locator('.bulk-row[data-id]').nth(0).innerText()).includes('Already saved as “suv”'), 'already-saved duplicate shows the stored translation');
  await page.locator('.bulk-row[data-id]').nth(0).locator('input[type="checkbox"]').check();
  await page.locator('.bulk-row[data-id]').nth(2).locator('input[type="checkbox"]').check(); await wait(page, 250);
  await page.click('[data-action="save"]');
  assert((await page.locator('#bulk-save-error').innerText()).includes('same English word'), 'two ticked rows with the same word are blocked');
  await page.locator('.bulk-row[data-id]').nth(2).locator('input[type="checkbox"]').uncheck(); await wait(page, 250);
  await page.locator('.bulk-row[data-id]').nth(4).locator('input[type="checkbox"]').check(); await wait(page, 250);
  assert((await page.locator('#bulk-save-card').innerText()).includes('2 existing translations will be replaced'), 'ticking an existing duplicate offers to replace its translation');
  await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  const dv = await storeWords(page, 'Daily Vocabulary');
  assert(dv.find((w) => w[0] === 'look for')[1] === 'qidirmoq', 'existing word got the new translation');
  assert(dv.filter((w) => w[0].toLowerCase() === 'water').length === 1, 'no duplicate "water" was created');
  assert(dv.length === 18, 'new non-duplicate words were added (18 total)');

  /* ---- 6. editing: add / delete / swap / error rows ---- */
  await page.click('[data-action="more"]');
  await paste(page, tsv([['a1', 'x1'], ['b1', 'x2'], ['c1', ''], ['', 'x4'], ['d1', 'x5']]));
  assert((await page.locator('.bulk-row.k-error').count()) === 2, 'rows with a missing English word or translation are marked');
  assert((await page.locator('#bulk-table-card').innerText()).includes('Missing English word'), 'status text names the problem');
  await page.locator('.bulk-row[data-id]').nth(0).locator('[data-action="del-row"]').click(); await wait(page, 150);
  rows = await tableRows(page);
  assert(rows.length === 4 && rows[0][0] === 'b1' && rows[0][1] === 'x2', 'deleting a row does not shift the other pairs');
  await page.click('[data-action="add-row"]'); await wait(page, 150);
  assert((await page.locator('.bulk-row[data-id]').count()) === 5, 'new row added');
  await page.click('[data-action="swap"]'); await wait(page, 150);
  rows = await tableRows(page);
  assert(rows[0][0] === 'x2' && rows[0][1] === 'b1', 'swap columns exchanges every pair');
  await page.click('[data-action="swap"]');
  await page.locator('.bulk-row[data-id]').nth(1).locator('.b-uz').fill('x3'); await wait(page, 300);
  assert((await page.locator('.bulk-row.k-error').count()) === 2, 'fixing a translation updates the status live (2 errors left: missing English + empty new row)');
  assert((await page.locator('.bulk-row.k-error input[type="checkbox"]:checked').count()) === 0, 'rows with errors are not ticked by default');
  await page.locator('.bulk-row.k-error').first().locator('input[type="checkbox"]').check(); await wait(page, 250);
  await page.click('[data-action="save"]');
  assert((await page.locator('#bulk-save-error').innerText()).includes('Fix or untick 1 rows'), 'ticking a row with an error blocks saving and says why');
  await page.locator('.bulk-row.k-error').first().locator('input[type="checkbox"]').uncheck(); await wait(page, 250);
  await toNew(page, '');
  await page.click('[data-action="save"]');
  assert((await page.locator('#bulk-save-error').innerText()).includes('name'), 'a new collection needs a name');
  page.once('dialog', () => {});
  await page.click('[data-action="clear-all"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 200);
  assert((await page.locator('#bulk-table-card').isHidden()), 'clear table empties it after confirmation');

  /* ---- 7. saved words show up in Word Lessons ---- */
  await page.goto(APP + '#/learn'); await page.waitForSelector('.strip');
  await page.click('[data-tab="collections"]');
  assert((await page.locator('.col-card:has-text("Unit 5")').count()) === 1 && (await page.locator('.col-card:has-text("Daily Vocabulary")').count()) === 1, 'new collections appear as separate cards in Word Lessons');
  await page.goto(APP + '#/bulk'); await page.waitForSelector('#bulk-text');
  await paste(page, tsv(gen(8, 'lesson')));
  await toNew(page, 'Lesson words'); await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done');
  await page.click('[data-action="practise-now"]'); await page.waitForSelector('.strip');
  assert((await page.locator('.source').innerText()).includes('8 words'), '"Practise these words" selects exactly the imported collection (8 words)');
  await page.click('.ex-card[data-type="mixed"]'); await page.waitForSelector('.lesson');
  const lessonOk = await page.evaluate(() => { const l = VL.store.state.lesson; const col = VL.store.state.collections.find((c) => c.name === 'Lesson words'); return l.items.every((it) => it.wordIds.every((id) => VL.store.word(id).collectionId === col.id)); });
  assert(lessonOk, 'the lesson only contains the imported words');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("End and see")'); await page.waitForSelector('.summary'); 

  /* ---- 8. files: TSV and CSV ---- */
  await page.goto(APP + '#/bulk'); await page.waitForSelector('#bulk-text');
  const tsvFile = path.join(OUT, 'lexi-bulk.tsv'); fs.writeFileSync(tsvFile, '﻿English\tUzbek\n' + tsv(gen(12, 'tsv')) + '\n');
  await page.setInputFiles('#bulk-file', tsvFile); await page.waitForSelector('.bulk-row[data-id]');
  assert((await page.locator('.bulk-row[data-id]').count()) === 12 && (await page.locator('#bulk-summary').innerText()).includes('Header row skipped'), 'TSV file with header: 12 rows, header skipped');
  const csvFile = path.join(OUT, 'lexi-bulk.csv'); fs.writeFileSync(csvFile, 'english,uzbek\r\n"to run, to jog",yugurmoq\r\nlook for,izlamoq\r\n"have a row with","bilan janjallashmoq"\r\n');
  await page.setInputFiles('#bulk-file', csvFile); await wait(page, 300);
  const confirmShown = await page.locator('.modal').count();
  if (confirmShown) await page.click('.modal-foot .btn-danger');
  await wait(page, 300);
  rows = await tableRows(page);
  assert(JSON.stringify(rows) === JSON.stringify([['to run, to jog', 'yugurmoq'], ['look for', 'izlamoq'], ['have a row with', 'bilan janjallashmoq']]), 'CSV file with quoted commas parsed correctly');

  /* ---- 9. big lists, pagination, responsiveness ---- */
  await page.goto(APP + '#/bulk'); await page.waitForSelector('#bulk-text');
  for (const n of [100]) {
    await page.click('[data-action="clear-text"]');
    await page.fill('#bulk-text', tsv(gen(n, 'n' + n + '_'))); await page.click('[data-action="build"]'); await page.waitForSelector('.bulk-row[data-id]');
    await page.selectOption('#bulk-psize', '100');
    assert((await page.locator('.bulk-row[data-id]').count()) === 100, n + ' words with 100 rows per page');
  }
  const t0 = Date.now();
  await page.fill('#bulk-text', tsv(gen(5000, 'big')));
  await page.click('[data-action="build"]'); await page.waitForSelector('.bulk-row[data-id]');
  const buildMs = Date.now() - t0;
  assert((await page.locator('.bulk-row[data-id]').count()) <= 100 && (await page.locator('.bulk-pager').innerText()).includes('of 5000'), '5000 rows: only one page is rendered, pager shows total');
  assert(buildMs < 4000, '5000-row paste -> table in ' + buildMs + ' ms');
  await page.click('[data-action="next"]'); await wait(page, 100);
  assert((await page.locator('.bulk-pager').innerText()).includes('101–200'), 'pager moves to the next page');
  const typeStart = Date.now();
  await page.locator('.bulk-row[data-id]').first().locator('.b-uz').fill('edited'); await wait(page, 250);
  assert(Date.now() - typeStart < 2000, 'editing a cell in a 5000-row table stays responsive');
  await toNew(page, 'Big list');
  const s0 = Date.now(); await page.click('[data-action="save"]'); await page.waitForSelector('.bulk-done', { timeout: 60000 });
  const saveMs = Date.now() - s0;
  assert((await storeWords(page, 'Big list')).length === 5000, '5000 words saved in ' + saveMs + ' ms');

  /* ---- 10. languages + phone layout ---- */
  await page.goto(APP + '#/bulk'); await page.waitForSelector('#bulk-text');
  await page.selectOption('#lang-select', 'ru'); await wait(page, 200);
  assert((await page.locator('h1').innerText()) === 'Массовый импорт слов', 'page in Russian');
  await page.selectOption('#lang-select', 'uz'); await wait(page, 200);
  assert((await page.locator('h1').innerText()) === "Ko'p so'zni birdaniga kiritish", 'page in Uzbek');
  await page.selectOption('#lang-select', 'en');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.fill('#bulk-text', tsv([['look for', 'izlamoq'], ['have a row with', 'bilan janjallashmoq'], ['water', ''], ['', 'x']]));
  await page.click('[data-action="build"]'); await page.waitForSelector('.bulk-row[data-id]'); await wait(page, 400);
  await page.screenshot({ path: path.join(OUT, 'lexi-bulk-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone width: no horizontal scroll');
  await page.setViewportSize({ width: 1280, height: 900 }); await wait(page, 200);
  await page.screenshot({ path: path.join(OUT, 'lexi-bulk-desktop.png'), fullPage: true });

  console.log('page errors:', page.errors);
  assert(page.errors.length === 0, 'no console/page errors');
  await browser.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
