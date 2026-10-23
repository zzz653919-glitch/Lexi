/* Browser tests for the mixed exercise (six exercises for every word): node tests/mixed.test.js */
const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { playLesson } = require('./helpers/lesson-solver');
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const wait = (p, ms) => p.waitForTimeout(ms || 200);
const ORDER = ['choose', 'type', 'translate', 'fill', 'match', 'reverse'];

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(APP + '#/learn?tab=practice'); await page.waitForSelector('.strip');
  await page.selectOption('#lang-select', 'uz'); await wait(page);
  assert(await page.locator('[data-action="start-mix"]').isDisabled(), 'no words: mixed button disabled');
  await page.evaluate(() => VL.io.loadSample()); await wait(page, 500);
  await page.evaluate(() => VL.store.addWord({ en: 'lose', uz: "yo'qotmoq", collectionId: VL.store.state.collections[0].id }));
  await page.evaluate(() => VL.store.setSetting('mixedWords', 5)); await wait(page, 300);

  const btn = page.locator('[data-action="start-mix"]');
  assert((await btn.innerText()).includes('Aralash mashqni boshlash') && !(await btn.isDisabled()), 'button "Aralash mashqni boshlash" is shown and enabled');
  const legacy = await page.locator('.ex-card').evaluateAll((c) => c.map((x) => x.dataset.type));
  assert(['choose', 'type', 'translate', 'fill', 'match', 'reverse'].every((k) => !legacy.includes(k)), 'the six separate cards are gone (' + legacy.join(',') + ')');
  assert((await page.locator('.mix-steps li').count()) === 6, 'card lists the six steps');

  // ---------- plan ----------
  await btn.click(); await page.waitForSelector('.lesson');
  const full = await page.evaluate(() => VL.store.state.lesson.items.map((i) => ({ t: i.type, w: i.wordIds[0], d: i.dir, f: i.focusId || null, p: i.prompt || null })));
  assert(full.length === 35 && full.filter((x, i) => x.t === 'study' && i % 7 === 0).length === 5, 'a translation card comes first for each of the 5 words (35 steps)');
  const plan = full.filter((x) => x.t !== 'study');
  assert(plan.length === 30, '5 words × 6 = 30 exercises (' + plan.length + ')');
  let orderOk = true, dirOk = true;
  for (let w = 0; w < 5; w++) {
    const chunk = plan.slice(w * 6, w * 6 + 6);
    if (chunk.some((c, i) => c.t !== ORDER[i] && !(c.t === 'type' && ORDER[i] !== 'type' && false))) orderOk = orderOk && chunk.every((c, i) => c.t === ORDER[i] || ['type', 'translate', 'reverse'].includes(c.t));
    if (!(chunk[0].t === 'choose' && chunk[1].t === 'type' && chunk[1].d === 'en-uz' && chunk[2].t === 'translate' && chunk[2].d === 'uz-en' && chunk[3].t === 'fill' || chunk[3].t === 'type')) dirOk = false;
    if (chunk.some((c) => c.t !== 'match' && c.w !== chunk[0].w && c.f !== chunk[0].w)) orderOk = false;
  }
  assert(orderOk && dirOk, 'each word: choose → type → translate → fill → match → reverse, finished before the next word');
  assert(new Set(plan.filter((c) => c.t !== 'match').map((c) => c.w)).size === 5, 'five different words');
  assert((await page.locator('.study-go').count()) === 1 && (await page.locator('.q-word').innerText()).length > 0 && (await page.locator('.intro-uz').innerText()).length > 0, 'the first screen shows the first word with its translation');
  assert((await page.locator('#lstep').innerText()).trim() === '0 / 30', 'progress is 0 / 30 on the translation card');
  await page.click('[data-study-go]'); await page.waitForSelector('.option');
  assert((await page.locator('#lstep').innerText()).trim() === '1 / 30', 'after the card the first exercise (choose) is 1 / 30');

  // ---------- play 8, leave, reload, resume ----------
  const part = await playLesson(page, { wrongEvery: 0, stopAfter: 8, maxSteps: 40 });
  assert(part.stopped && part.answered === 8, 'played 8 exercises');
  await page.reload(); await page.waitForSelector('.strip');
  await page.goto(APP + '#/learn?tab=practice'); await page.waitForSelector('[data-action="resume"]');
  await page.click('[data-action="resume"]'); await page.waitForSelector('.lesson');
  assert((await page.locator('#lstep').innerText()).trim() === '9 / 30', 'after reload the progress is kept: 9 / 30');
  const state = await page.evaluate(() => ({ a: VL.store.state.lesson.answers, n: VL.store.state.lesson.items.length }));
  assert(state.a === 8 && state.n === 35, 'saved state: 8 answers, 35 steps (30 exercises + 5 translation cards)');

  // ---------- finish with some mistakes ----------
  const rest = await playLesson(page, { wrongEvery: 5, maxSteps: 80 });
  await page.waitForSelector('.summary');
  const txt = await page.locator('#main').innerText();
  const lesson = await page.evaluate(() => VL.store.state.sessions[VL.store.state.sessions.length - 1]);
  assert(lesson.total === 30 && lesson.correct + lesson.wrong === 30, 'result: 30 exercises counted once each (correct ' + lesson.correct + ' + wrong ' + lesson.wrong + ')');
  assert(lesson.wrong >= 3 && rest.mismatches.length === 0, 'mistakes were made and every verdict matched the entered answer');
  ['Xatolarni qayta ishlash', 'Yangi sessiya yaratish', 'Qayta boshlash', "Qiyin bo'lgan so'zlar"].forEach((x) => assert(txt.includes(x), 'results show: ' + x));
  assert(/30/.test(txt) && txt.includes('%'), 'results show totals and percent');
  const noRetry = await page.evaluate(() => VL.store.state.sessions.length);
  assert(noRetry === 1, 'one session saved (no double counting)');

  // ---------- review mistakes ----------
  await page.click('[data-action="review-mistakes"]'); await page.waitForSelector('.lesson');
  const miss = await page.evaluate(() => VL.store.state.lesson.items.length);
  assert(miss > 0 && miss < 30, 'review run built from the mistakes only (' + miss + ' exercises)');
  await page.click('[data-action="pause"]'); await page.waitForSelector('.modal-foot');
  await page.evaluate(() => document.querySelector('dialog .modal-foot .btn-ghost:last-child').click()); await wait(page, 800);

  // ---------- restart ----------
  await page.goto(APP + '#/learn?tab=practice'); await page.reload(); await page.waitForSelector('.strip');
  await page.evaluate(() => VL.store.saveLesson(null));
  await page.reload(); await page.waitForSelector('.strip');
  await page.click('[data-action="start-mix"]'); await page.waitForSelector('.lesson');
  await playLesson(page, { wrongEvery: 0, maxSteps: 80 });
  await page.waitForSelector('.summary');
  await page.click('[data-action="mx-restart"]'); await page.waitForSelector('.lesson');
  assert((await page.evaluate(() => VL.store.state.lesson.items.filter((i) => i.type !== 'study').length)) === 30, 'restart: new 30-exercise run with the same words');
  await page.evaluate(() => VL.store.saveLesson(null));

  // ---------- the lose example ----------
  const lose = await page.evaluate(() => {
    const w = VL.store.state.words.find((x) => x.en === 'lose');
    const b = VL.learn.buildMixed({ words: [w] }, VL.store.state.words);
    return b.items.filter((i) => i.type !== 'study').map((i) => i.type + ':' + i.dir + ':' + (i.prompt || ''));
  });
  assert(lose.length === 6 && lose[0].startsWith('choose') && lose[1].startsWith('type:en-uz') && lose[2].startsWith('translate:uz-en') && lose[5].startsWith('reverse:uz-en:Yo\'qotish'), 'lose: ' + lose.join(' | '));

  // ---------- phone ----------
  await page.setViewportSize({ width: 375, height: 700 });
  await page.reload(); await page.waitForSelector('.strip');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375px');
  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
