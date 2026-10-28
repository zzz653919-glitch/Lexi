const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const SAMPLE_CSV = path.join(__dirname, '..', 'sample', 'sample-vocabulary.csv');
const TXT = pathToFileURL(path.join(__dirname, '..', 'sample', 'sample-vocabulary.txt')).href;
const OUT = require('os').tmpdir();
const { chromium } = playwright;
const URL = APP;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForSelector('.home-hero');
  assert(await page.locator('h1').innerText() === 'Hello!' && (await page.locator('[data-action="sample"]').count()) === 1, 'new home page with no words offers the sample');

  // add words
  await page.click('nav a[data-route=vocabulary]');
  await page.fill('#f-en', 'apple'); await page.fill('#f-uz', 'olma'); await page.press('#f-uz', 'Enter');
  await page.fill('#f-en', 'book'); await page.fill('#f-uz', 'kitob'); await page.click('.add-btn'); await page.waitForTimeout(200);
  await page.fill('#f-en', 'Apple '); await page.fill('#f-uz', 'x'); await page.click('.add-btn');
  assert((await page.locator('#add-error').innerText()).includes('already exists'), 'duplicate rejected');
  await page.fill('#f-en', ''); await page.fill('#f-uz', ''); await page.click('.add-btn');
  assert((await page.locator('#add-error').innerText()).length > 0, 'empty rejected');
  assert(await page.locator('#v-list tbody tr').count() === 2, '2 words listed');

  // persistence
  await page.reload(); await page.waitForSelector('#v-list tbody tr');
  assert(await page.locator('#v-list tbody tr').count() === 2, 'words persist after reload');
  const page2 = await ctx.newPage(); await page2.goto(URL + '#/vocabulary'); await page2.waitForSelector('#v-list tbody tr');
  assert(await page2.locator('#v-list tbody tr').count() === 2, 'persist in new tab'); await page2.close();

  // edit + delete
  await page.click('tr:has-text("book") [data-action=edit]');
  await page.fill('#e-uz', 'kitoblar'); await page.click('.modal-foot .btn-primary'); await page.waitForTimeout(250);
  assert(await page.locator('tr:has-text("kitoblar")').count() === 1, 'edit works');
  await page.click('tr:has-text("kitoblar") [data-action=delete]'); await page.click('.modal-foot .btn-danger'); await page.waitForTimeout(200);
  assert(await page.locator('#v-list tbody tr').count() === 1, 'delete works');

  // import via paste
  await page.click('[data-action=import]');
  await page.fill('#imp-text', 'english,uzbek\ncat — mushuk\ndog = it\nbad line\n"a,b";c\napple — olma\nhouse\tuy\n');
  await page.waitForTimeout(100);
  const prev = await page.locator('#imp-preview').innerText();
  console.log(prev.replace(/\n/g, ' | '));
  await page.click('.modal-foot .btn-primary');
  await page.waitForTimeout(200);
  assert(await page.locator('#v-list tbody tr').count() === 5, 'import added 4 (dup skipped) -> 5 total');

  // import file CSV with collection column
  await page.click('[data-action=import]');
  await page.setInputFiles('#imp-file', SAMPLE_CSV);
  await page.check('#imp-colcol'); await page.waitForTimeout(150);
  await page.click('.modal-foot .btn-primary'); await page.waitForTimeout(300);
  assert(await page.locator('.col-row').count() === 5, '4 sample collections + personal');
  const n = await page.evaluate(() => VL.store.state.words.length);
  assert(n === 65, 'words after sample import = ' + n);

  // export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export]')]);
  const fs = require('fs'); const p = await dl.path(); const txt = fs.readFileSync(p, 'utf8');
  assert(txt.includes('english,uzbek,collection') && txt.includes('mushuk'), 'CSV export');

  // quiz
  await page.click('nav a[data-route=practice]');
  console.log(await page.locator('#s-scope option').allInnerTexts()); await page.selectOption('#s-scope', { index: 3 });
  await page.selectOption('#s-len', '10');
  await page.click('#setup .btn-primary');
  assert(await page.locator('.q-word').count() === 1, 'quiz started');
  const seen = new Set(); let correct = 0;
  for (let i = 0; i < 10; i++) {
    const prompt = await page.locator('.q-word').innerText();
    assert(!seen.has(prompt), 'no repeat: ' + prompt); seen.add(prompt);
    const ans = await page.evaluate((pr) => { const w = VL.store.state.words.find((x) => x.en === pr); return w ? w.uz : ''; }, prompt);
    if (i % 3 === 2) { await page.fill('#answer', 'wrong'); } else { await page.fill('#answer', '  ' + ans.split(';')[0].toUpperCase() + ' '); correct++; }
    await page.press('#answer', 'Enter');
    await page.waitForSelector('#btn-next');
    const ok = await page.locator('#qcard.is-correct').count();
    if (i % 3 === 2) assert(!ok && (await page.locator('.fb-bad').innerText()).includes('Correct answer'), 'wrong shows answer');
    await page.waitForTimeout(300); await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('.summary');
  console.log('summary:', (await page.locator('.summary').innerText()).replace(/\n/g, ' '));
  assert((await page.locator('.summary').innerText()).includes(correct + ' correct'), 'summary correct count ' + correct);

  // difficult
  const nd = await page.evaluate(() => VL.store.difficultWords().length);
  assert(nd === 3, 'difficult words = ' + nd);
  await page.click('nav a[data-route=difficult]');
  assert(await page.locator('#main tbody tr').count() === 3, 'difficult list shows 3');
  await page.click('text=Practise these');
  await page.selectOption('#s-len', 'all');
  await page.click('#setup .btn-primary');
  assert(await page.locator('.q-word').count() === 1, 'difficult quiz started');
  await page.click('#btn-end'); await page.waitForSelector('.summary, #setup');

  // progress & dashboard
  await page.click('nav a[data-route=progress]'); await page.waitForSelector('.chart');
  await page.click('nav a[data-route=dashboard]'); await page.waitForSelector('.stat-grid');
  await page.screenshot({ path: path.join(OUT, 'lexi-dash-light.png') });

  // theme toggle
  await page.click('#theme-toggle');
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark theme');
  await page.screenshot({ path: path.join(OUT, 'lexi-dash-dark.png') });
  await page.reload(); await page.waitForSelector('.stat-grid');
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'theme persists');

  // mobile
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click('nav a[data-route=vocabulary]'); await page.waitForSelector('#v-list tbody tr');
  await page.screenshot({ path: path.join(OUT, 'lexi-vocab-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll on mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('nav a[data-route=practice]'); await page.click('#setup .btn-primary');
  await page.screenshot({ path: path.join(OUT, 'lexi-quiz.png') });
  await page.fill('#answer', 'zzz'); await page.press('#answer', 'Enter'); await page.waitForSelector('#btn-next');
  await page.screenshot({ path: path.join(OUT, 'lexi-quiz-wrong.png') });
  await page.click('nav a[data-route=settings]').catch(() => {});
  console.log('page errors:', errors);
  assert(errors.length === 0, 'no console/page errors');
  await browser.close();
})();
