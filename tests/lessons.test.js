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
const wait = (p, ms) => p.waitForTimeout(ms || 120);

// Plays the current lesson item. wrongEvery: answer every Nth question wrongly (0 = never).
async function playLesson(page, opts) {
  const seen = { intro: 0, choose: 0, type: 0, translate: 0, reverse: 0, fill: 0, match: 0 };
  let answered = 0, guard = 0;
  while (guard++ < 80) {
    await wait(page, 330);
    if (await page.locator('.summary').count()) break;
    if (opts.stopAfter && answered >= opts.stopAfter) return { seen, answered, stopped: true };
    const s = await page.evaluate(() => {
      const l = VL.store.state.lesson; if (!l) return null;
      const it = l.items[l.index]; if (!it) return null;
      const w = VL.store.word(it.wordIds[0]);
      return { it, w: w ? { en: w.en, uz: w.uz } : null, idx: l.index, total: l.items.length };
    });
    if (!s) break;
    const it = s.it;
    const wrong = opts.wrongEvery && (answered + 1) % opts.wrongEvery === 0;
    if (it.type === 'intro') {
      seen.intro++;
      await page.click('#btn-intro');
      continue;
    }
    if (it.type === 'choose') {
      seen.choose++;
      const idx = it.options.findIndex((o) => (wrong ? !o.correct : o.correct));
      await page.click('.option[data-index="' + idx + '"]');
    } else if (it.type === 'match') {
      seen.match++;
      for (const p of it.pairs) {
        if (wrong && p === it.pairs[0]) { // one deliberate wrong try
          const other = it.pairs[1];
          await page.click('.tile[data-side="l"][data-id="' + p.wordId + '"]');
          await page.click('.tile[data-side="r"][data-id="' + other.wordId + '"]');
          await wait(page, 500);
        }
        await page.click('.tile[data-side="l"][data-id="' + p.wordId + '"]');
        await page.click('.tile[data-side="r"][data-id="' + p.wordId + '"]');
        await wait(page, 60);
      }
    } else {
      seen[it.type]++;
      const expected = it.type === 'fill' ? s.w.en : (it.dir === 'en-uz' ? s.w.uz : s.w.en);
      const first = expected.split(/[;,]/)[0].trim();
      await page.fill('#lans', wrong ? 'zzzzq' : '  ' + first.toUpperCase() + ' ');
      await page.press('#lans', 'Enter');
    }
    answered++;
    await page.waitForSelector('#btn-next');
    await wait(page, 300);
    await page.click('#btn-next');
  }
  return { seen, answered };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL + '#/learn');
  await page.waitForSelector('.strip');

  // ---------- empty state ----------
  assert((await page.locator('.ex-card').count()) === 8, '8 exercise cards (mixed + 7 types)');
  assert((await page.locator('.ex-card:not([disabled])').count()) === 0, 'all exercises disabled with no words');
  assert((await page.locator('.strip-item').first().innerText()).includes('0 days'), 'streak starts at 0');

  // ---------- ready-made decks ----------
  await page.click('[data-tab="decks"]');
  assert((await page.locator('.deck-card').count()) === 9, '9 topics per level');
  await page.click('.deck-card[data-topic="family"] [data-action="deck-add"]'); await wait(page, 250);
  let n = await page.evaluate(() => VL.store.state.words.filter((w) => VL.store.collection(w.collectionId).deckKey === 'A1.family').length);
  assert(n === 8, 'A1 Family installed: 8 words (' + n + ')');
  assert((await page.locator('.deck-card[data-topic="family"]').innerText()).includes('Added'), 'deck shows Added state');
  await page.click('.deck-card[data-topic="family"] [data-action="deck-add"]').catch(() => {});
  await page.click('[data-action="deck-add-level"]'); await wait(page, 600);
  n = await page.evaluate(() => VL.store.state.words.length);
  assert(n === 72, 'A1 level installed: 72 words, no duplicates (' + n + ')');
  await page.click('[data-action="deck-level"][data-level="B2"]');
  await page.click('.deck-card[data-topic="verbs"] [data-action="deck-preview"]');
  assert((await page.locator('.deck-card[data-topic="verbs"] .word-list li').count()) === 8, 'deck preview lists 8 words');
  await page.click('.deck-card[data-topic="verbs"] [data-action="deck-add"]'); await wait(page, 250);
  const colNames = await page.evaluate(() => VL.store.state.collections.map((c) => c.name));
  console.log('collections:', colNames.join(' | '));

  // ---------- own collection + word with example ----------
  await page.click('[data-tab="collections"]');
  await page.click('[data-action="new-col"]'); await page.fill('#r-name', 'My words'); await page.click('.modal-foot .btn-primary'); await wait(page, 250);
  await page.click('.col-card:has-text("My words") [data-action="add-word"]');
  await page.fill('#e-en', 'sunrise'); await page.fill('#e-uz', 'tong otishi'); await page.fill('#e-ex', 'We watched the sunrise.');
  await page.click('.modal-foot .btn-ghost:has-text("another")'); await wait(page, 200);
  assert((await page.locator('#e-en').inputValue()) === '', 'save-and-add-another clears the form');
  await page.fill('#e-en', 'sunrise'); await page.fill('#e-uz', 'x'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#e-error').innerText()).includes('already exists'), 'duplicate in dialog rejected');
  await page.fill('#e-en', ''); await page.fill('#e-uz', ''); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#e-error').innerText()).length > 0, 'empty word rejected in dialog');
  await page.fill('#e-en', 'sunset'); await page.fill('#e-uz', 'quyosh botishi'); await page.click('.modal-foot .btn-primary'); await wait(page, 250);
  await page.click('.col-card:has-text("My words") [data-action="toggle-words"]');
  assert((await page.locator('.col-card:has-text("My words") .word-list li').count()) === 2, 'collection shows 2 words');
  assert((await page.locator('.col-card:has-text("My words") .word-example').innerText()).includes('sunrise'), 'example is shown');
  await page.click('.col-card:has-text("My words") li:has-text("sunset") [data-action="edit-word"]');
  await page.fill('#e-uz', 'quyosh botish'); await page.click('.modal-foot .btn-primary'); await wait(page, 250);
  assert((await page.locator('.col-card:has-text("My words")').innerText()).includes('quyosh botish'), 'edit works');
  await page.click('.col-card:has-text("My words") li:has-text("sunset") [data-action="delete-word"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);
  assert((await page.locator('.col-card:has-text("My words") .word-list li').count()) === 1, 'delete word works');

  // practise only A1 Family + My words
  await page.click('.col-card:has-text("A1 · Family") .switch'); await wait(page, 150);
  await page.click('.col-card:has-text("My words") .switch'); await wait(page, 150);
  let sel = await page.evaluate(() => VL.store.state.settings.learnSelected.length);
  assert(sel === 2, 'two collections marked for practice');
  await page.click('[data-tab="practice"]');
  assert((await page.locator('.source').innerText()).includes('9 words'), 'source summary: 9 words (' + (await page.locator('.source b').first().innerText()) + ')');

  // ---------- lesson: mixed ----------
  await page.click('.ex-card[data-type="mixed"]');
  await page.waitForSelector('.lesson');
  assert((await page.locator('.sidebar').isHidden()), 'focus mode hides the sidebar');
  const r1 = await playLesson(page, { wrongEvery: 4 });
  console.log('lesson 1 played:', JSON.stringify(r1));
  await page.waitForSelector('.summary');
  const sum1 = (await page.locator('main').innerText()).replace(/\n/g, ' | ');
  console.log(sum1.slice(0, 300));
  const st1 = await page.evaluate(() => ({
    day: VL.store.state.days.map((d) => ({ xp: d.xp, answers: d.answers, correct: d.correct, sessions: d.sessions, lessons: d.lessons })),
    sessions: VL.store.state.sessions.filter((s) => s.kind === 'lesson').length,
    lesson: VL.store.state.lesson,
    reps: VL.store.state.words.filter((w) => w.reps > 0).length,
    boxes: VL.store.state.words.filter((w) => w.reps > 0).map((w) => w.box + ':' + w.lapses),
    ach: VL.learn.achievements(VL.store.state).filter((a) => a.unlocked).map((a) => a.id),
  }));
  console.log(JSON.stringify(st1));
  assert(st1.sessions === 1 && st1.lesson === null, 'session saved, lesson state cleared');
  assert(st1.day[0].xp > 0 && st1.day[0].lessons === 1, 'XP and lesson counted for today (' + st1.day[0].xp + ' XP)');
  assert(st1.reps >= 5, 'SRS schedule updated for practised words (' + st1.reps + ')');
  assert(st1.ach.includes('firstLesson'), 'first-lesson achievement unlocked from real data');
  assert((await page.locator('main').innerText()).includes('Streak: 1'), 'streak = 1 after first lesson');
  const xpShown = Number((await page.locator('.xp-total').innerText()).replace('+', ''));
  assert(xpShown === st1.day[0].xp, 'XP on result page equals stored day XP (' + xpShown + ')');

  // persistence
  await page.reload(); await page.waitForSelector('.strip');
  const xpAfter = await page.evaluate(() => VL.store.state.days.reduce((a, d) => a + d.xp, 0));
  assert(xpAfter === st1.day[0].xp, 'XP survives reload');
  await page.click('[data-tab="achievements"]');
  assert((await page.locator('.ach.unlocked').count()) >= 1, 'awards tab shows unlocked achievement');
  assert((await page.locator('.xp-chart .col').count()) === 14, 'history chart has 14 days');
  await page.selectOption('#goal-select', '20'); await wait(page, 150);
  assert((await page.evaluate(() => VL.store.state.settings.dailyGoal)) === 20, 'daily goal changed');

  // ---------- words tab ----------
  await page.click('[data-tab="words"]');
  assert((await page.locator('.meter').count()) > 0, 'word knowledge list with strength meters');
  await page.click('[data-filter="learning"]'); await wait(page, 100);
  const learningRows = await page.locator('#tab-body tbody tr').count();
  assert(learningRows === (await page.evaluate(() => VL.store.state.words.filter((w) => VL.srs.level(w) === 'learning').length)), 'filter "Learning" matches data (' + learningRows + ')');

  // ---------- each exercise type ----------
  await page.click('[data-tab="practice"]');
  const types = ['choose', 'type', 'translate', 'fill', 'match', 'reverse'];
  for (const tp of types) {
    await page.click('.ex-card[data-type="' + tp + '"]');
    await page.waitForSelector('.lesson');
    const r = await playLesson(page, { wrongEvery: 3 });
    const kind = tp === 'type' ? ['type'] : [tp];
    const ok = kind.every((k) => r.seen[k] > 0) || tp === 'match' && r.seen.match > 0;
    assert(ok, 'exercise "' + tp + '" played (' + JSON.stringify(r.seen) + ')');
    await page.waitForSelector('.summary');
    await page.click('[data-action="hub"]'); await page.waitForSelector('.ex-grid');
  }

  // ---------- review of difficult / due words ----------
  const due = await page.evaluate(() => VL.srs.reviewPool(VL.store.state.words).length);
  assert(due > 0 && (await page.locator('.ex-card[data-type="review"]:not([disabled])').count()) === 1, 'review exercise available (' + due + ' words)');
  await page.click('.ex-card[data-type="review"]'); await page.waitForSelector('.lesson');
  const r7 = await playLesson(page, { wrongEvery: 0 });
  await page.waitForSelector('.summary');
  assert(r7.answered > 0, 'review lesson completed');
  await page.click('[data-action="hub"]');

  // ---------- pause / resume ----------
  await page.click('.ex-card[data-type="mixed"]'); await page.waitForSelector('.lesson');
  const partial = await playLesson(page, { wrongEvery: 0, stopAfter: 2 });
  await wait(page, 400);
  await page.click('[data-action="pause"]');
  await page.click('.modal-foot button:has-text("Save and exit")'); await wait(page, 300);
  assert((await page.locator('.resume').count()) === 1, 'paused lesson shows a Resume card');
  const savedIdx = await page.evaluate(() => VL.store.state.lesson.index);
  await page.reload(); await page.waitForSelector('.strip');
  assert((await page.locator('.resume').count()) === 1, 'paused lesson survives reload');
  await page.click('[data-action="resume"]'); await page.waitForSelector('.lesson');
  const resumedIdx = await page.evaluate(() => VL.store.state.lesson.index);
  assert(resumedIdx === savedIdx && savedIdx >= 1, 'resumed at saved position (' + savedIdx + ')');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("End and see results")');
  await page.waitForSelector('.summary');
  assert((await page.locator('h1').innerText()).includes('ended early'), 'ending early shows results');
  await page.click('[data-action="hub"]');

  // ---------- existing features intact ----------
  await page.click('nav a[data-route=vocabulary]'); await page.waitForSelector('#v-list tbody tr');
  assert((await page.locator('#add-form #f-ex').count()) === 1, 'vocabulary form has example field');
  await page.fill('#f-en', 'moonlight'); await page.fill('#f-uz', 'oy nuri'); await page.fill('#f-ex', 'The moonlight was bright.'); await page.click('.add-btn'); await wait(page, 250);
  assert((await page.locator('#v-list tr:has-text("moonlight") .word-example').count()) === 1, 'example saved from My Vocabulary');
  await page.click('nav a[data-route=progress]'); await page.waitForSelector('.chart');
  assert((await page.locator('main').innerText()).includes('Lesson ·'), 'progress history lists lessons');
  await page.click('nav a[data-route=settings]'); await page.waitForSelector('.settings-group');
  assert((await page.locator('#set-goal').count()) === 1, 'settings has daily goal');

  // ---------- export / re-import keeps example ----------
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export]')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  assert(csv.includes('moonlight,oy nuri,Personal Vocabulary,The moonlight was bright.'), 'CSV export includes example column');

  // ---------- language + mobile ----------
  await page.click('nav a[data-route=learn]'); await page.waitForSelector('.strip');
  await page.selectOption('#lang-select', 'ru'); await wait(page, 200);
  assert((await page.locator('h1').innerText()) === 'Уроки слов', 'Learn page in Russian');
  await page.selectOption('#lang-select', 'uz'); await wait(page, 200);
  assert((await page.locator('.ex-card').first().innerText()).includes('Aralash mashq'), 'Learn page in Uzbek');
  await page.screenshot({ path: path.join(OUT, 'lexi-learn-hub-uz.png'), fullPage: true });
  await page.selectOption('#lang-select', 'en');

  await page.setViewportSize({ width: 390, height: 800 });
  await page.screenshot({ path: path.join(OUT, 'lexi-learn-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'hub: no horizontal scroll at 390px');
  for (const tab of ['collections', 'decks', 'words', 'achievements']) {
    await page.click('[data-tab="' + tab + '"]');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), tab + ' tab: no horizontal scroll at 390px');
  }
  await page.click('[data-tab="practice"]');
  await page.click('.ex-card[data-type="choose"]'); await page.waitForSelector('.option');
  await page.screenshot({ path: path.join(OUT, 'lexi-lesson-choose-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'lesson: no horizontal scroll at 390px');
  await page.keyboard.press('1'); await page.waitForSelector('#btn-next');
  await page.screenshot({ path: path.join(OUT, 'lexi-lesson-feedback-mobile.png') });
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save")');

  console.log('page errors:', errors);
  assert(errors.length === 0, 'no console/page errors');
  await browser.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
