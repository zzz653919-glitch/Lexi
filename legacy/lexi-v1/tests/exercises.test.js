/* Browser tests for the guided lesson: every exercise type through the real UI. node tests/exercises.test.js */
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { playLesson, advanceTo, readItem, wait } = require('./helpers/lesson-solver');
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const OUT = os.tmpdir();
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

const FAKE_SPEECH = () => {
  window.__spoken = [];
  const fake = { speak(u) { window.__spoken.push({ text: u.text, rate: u.rate }); }, cancel() {}, getVoices() { return [{ lang: 'en-US', name: 'Test Voice', localService: true }]; }, addEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });   // it is a read-only property in real browsers
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};
const NO_SPEECH = () => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; };

async function newPage(browser, opts, init) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, locale: 'en-US' }, opts || {}));
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(APP + '#/learn');
  await page.waitForSelector('.strip');
  await page.evaluate(async () => {
    await VL.io.loadSample();
    for (const tp of Object.keys(VL.deckTopics)) {
      const col = await VL.store.ensureDeckCollection('A1.' + tp, 'A1 · ' + tp);
      await VL.store.importWords(VL.decks.A1[tp].map(([en, uz]) => ({ en, uz, collectionId: col.id })));
    }
  });
  await wait(page, 400);
  return page;
}
const startGuided = async (page) => { await page.click('[data-action="start"][data-type="guided"]'); await page.waitForSelector('.lesson-card'); };
const startType = async (page, type) => { await page.evaluate((x) => VL.views.learn.startType(x), type); await page.waitForSelector('.lesson-card'); };
const backToHub = async (page) => { await page.click('[data-action="hub"]'); await page.waitForSelector('.today'); };
const items = (page) => page.evaluate(() => VL.store.state.lesson.items.map((i) => i.type));

(async () => {
  const browser = await playwright.chromium.launch();

  /* ===================== with speech support (fake TTS) ===================== */
  let page = await newPage(browser, {}, FAKE_SPEECH);
  assert((await page.locator('.today').count()) === 1 && (await page.locator('[data-action="start"][data-type="guided"]').innerText()).includes('Start lesson'), 'the hub has a big "Start lesson" button');
  await startGuided(page);
  const types = await items(page);
  assert(types.length >= 10 && types.length <= 15, 'a guided lesson has 10-15 exercises (' + types.length + ')');
  assert(types[0] === 'learn', 'the lesson opens with a new word being explained');
  const distinct = new Set(types);
  assert(distinct.size >= 8, 'many kinds of exercises in one lesson: ' + [...distinct].join(', '));
  assert((await page.locator('.lesson-card').count()) === 1 && (await page.locator('.lesson-step').innerText()) === '1 / ' + types.length, 'one exercise at a time with a "1 / N" counter');
  assert(await page.locator('[data-action="check"]').isDisabled(), 'Check is disabled until there is an answer');
  assert((await page.locator('#lfeedback').isHidden()), 'no result panel before checking');

  // first exercise: learn the word, hear it, type it
  const d0 = await readItem(page);
  assert((await page.locator('.q-word').innerText()).includes(d0.w.en) && (await page.locator('.intro-uz').innerText()) === d0.w.uz, 'exercise 1 shows the English word and its Uzbek translation');
  assert((await page.locator('.q-word .speak-btn').count()) === 1, 'exercise 1 has a pronunciation button');
  await page.click('.q-word .speak-btn');
  assert(await page.evaluate((w) => window.__spoken.some((s) => s.text === w), d0.w.en), 'the pronunciation button speaks the word (browser text-to-speech)');
  assert((await page.locator('.phonetic').count()) === 0, 'no phonetic transcription is invented when none exists');
  await page.fill('#lans', 'wrongword'); await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bbad\b/.test(await page.locator('#lfeedback').getAttribute('class')) && (await page.locator('#lfeedback').innerText()).includes(d0.w.en), 'a wrong typed word gets a red panel that shows the right spelling');
  assert((await page.locator('#btn-next').innerText()).includes('Continue'), 'a Continue button appears');
  assert((await page.locator('.lesson-step').innerText()) === '1 / ' + types.length, 'the lesson does not move on by itself');
  await wait(page, 700);
  assert((await page.locator('.lesson-card').count()) === 1 && (await page.locator('#lfeedback').isVisible()), 'it waits for the user to press Continue');
  await page.click('#btn-next');
  await wait(page, 200);
  assert((await page.locator('.lesson-step').innerText()).startsWith('2 / '), 'Continue opens exercise 2');

  // play the whole lesson with some deliberate mistakes
  const total0 = types.length;
  const r1 = await playLesson(page, { wrongEvery: 4 });
  assert(r1.mismatches.length === 0, 'every answer was judged correctly: ' + (r1.mismatches.join('; ') || 'no mismatches'));
  console.log('   kinds played:', JSON.stringify(r1.seen));
  await page.waitForSelector('.summary');
  const S = (await page.locator('main').innerText()).replace(/\n+/g, ' | ');
  const need = ['learn', 'choose', 'scramble', 'cloze', 'sentEnUz', 'sentUzEn', 'order', 'match', 'listen'];
  const missingKinds = need.filter((k) => !r1.seen[k]);
  assert(missingKinds.length === 0, 'the lesson used learn, choose, scramble, cloze, both translations, word order, matching and listening (missing: ' + (missingKinds.join(',') || 'none') + ')');
  assert(r1.answered > total0 - 1, 'mistakes were repeated: ' + r1.answered + ' exercises answered for a lesson that started with ' + total0);
  const res = await page.evaluate(() => { const s = VL.store.state.sessions.filter((x) => x.kind === 'lesson').pop(); return s; });
  assert(res.total === r1.answered + r1.extraPairs + 1 && res.wrong >= r1.wrongs + 1, 'the saved session matches what was answered (' + res.correct + '/' + res.total + ')');
  for (const label of ['Exercises', 'Correct', 'Wrong', 'Accuracy', 'XP earned', 'Well learned words', 'Words to review']) assert(S.includes(label), 'results page shows "' + label + '"');
  assert((await page.locator('[data-action="review-mistakes"]').count()) === 1 && (await page.locator('[data-action="next-lesson"]').count()) === 1 && (await page.locator('[data-action="hub"]').count()) === 1, 'results page has Review mistakes, Next lesson and Back to the lesson list');
  const xpShown = Number((await page.locator('.xp-total').innerText()).replace('+', ''));
  assert(xpShown === (await page.evaluate(() => VL.store.state.days.reduce((a, d) => a + d.xp, 0))), 'the XP on the results page equals the stored XP (' + xpShown + ')');

  // review mistakes
  await page.click('[data-action="review-mistakes"]'); await page.waitForSelector('.lesson-card');
  const revTypes = await items(page);
  assert(revTypes.length >= 2, 'Review mistakes starts a lesson with ' + revTypes.length + ' exercises');
  const revOk = await page.evaluate(() => VL.store.state.lesson.items.every((it) => it.type !== 'learn'));
  assert(revOk, 'the mistakes lesson contains only review exercises (no new-word cards)');
  const r2 = await playLesson(page, { wrongEvery: 0 });
  assert(r2.mismatches.length === 0, 'the mistakes lesson was judged correctly');
  await page.waitForSelector('.summary');
  // next lesson, back to list
  await page.click('[data-action="next-lesson"]'); await page.waitForSelector('.lesson-card');
  assert((await page.locator('.lesson-step').innerText()).startsWith('1 / '), '"Next lesson" starts another lesson');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');

  // resume after a reload
  const savedIdx = await page.evaluate(() => VL.store.state.lesson.index);
  await page.reload(); await page.waitForSelector('.resume');
  await page.click('[data-action="resume"]'); await page.waitForSelector('.lesson-card');
  assert((await page.locator('.lesson-step').innerText()).startsWith((savedIdx + 1) + ' / '), 'a paused lesson resumes at the same exercise after a reload (' + (savedIdx + 1) + ')');
  const r3 = await playLesson(page, { wrongEvery: 0 });
  assert(r3.mismatches.length === 0, 'the resumed lesson finished correctly');
  await page.waitForSelector('.summary');
  await page.click('[data-action="hub"]'); await page.waitForSelector('.today');
  assert((await page.locator('.resume').count()) === 0, 'no resume card once the lesson is finished');

  /* ----- tiles: letters ----- */
  await startType(page, 'scramble');
  const sc = await readItem(page);
  const word = sc.w.en;
  assert((await page.locator('.tb-bank .tile-chip').count()) === word.length, 'scramble: one tile per letter (' + word + ')');
  const ids = await page.locator('.tb-bank .tile-chip').evaluateAll((els) => els.map((e) => e.dataset.id));
  assert(new Set(ids).size === ids.length, 'scramble: every letter is its own element (repeated letters included)');
  const firstTile = (await page.locator('.tb-bank .tile-chip').first().innerText()).trim();
  await page.locator('.tb-bank .tile-chip').first().click();
  assert((await page.locator('.tb-answer .tile-chip').count()) === 1 && (await page.locator('.tb-bank .tile-chip').count()) === word.length - 1, 'scramble: tapping a letter moves it into the answer');
  await page.locator('.tb-answer .tile-chip').first().click();
  assert((await page.locator('.tb-answer .tile-chip').count()) === 0 && (await page.locator('.tb-bank .tile-chip').count()) === word.length, 'scramble: tapping a placed letter returns it');
  await page.locator('.tb-bank .tile-chip').nth(0).click(); await page.locator('.tb-bank .tile-chip').nth(0).click();
  await page.click('[data-tb="undo"]');
  assert((await page.locator('.tb-answer .tile-chip').count()) === 1, 'scramble: Undo removes the last letter');
  await page.click('[data-tb="reset"]');
  assert((await page.locator('.tb-answer .tile-chip').count()) === 0, 'scramble: Reset clears the answer');
  await page.keyboard.press(word[0]);
  assert((await page.locator('.tb-answer .tile-chip').count()) === 1, 'scramble: typing a letter on the keyboard places it');
  await page.keyboard.press('Backspace');
  assert((await page.locator('.tb-answer .tile-chip').count()) === 0, 'scramble: Backspace removes it');
  for (const ch of word.toUpperCase()) { const c = page.locator('.tb-bank .tile-chip', { hasText: new RegExp('^' + ch + '$') }).first(); await c.click(); }
  assert(await page.locator('[data-action="check"]').isEnabled(), 'scramble: Check is enabled once all letters are placed');
  await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bok\b/.test(await page.locator('#lfeedback').getAttribute('class')) && (await page.locator('.tb-answer.ok').count()) === 1, 'scramble: the right word shows a success state');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);

  /* ----- tiles: sentence order (keyboard + drag) ----- */
  await startType(page, 'order');
  let od = await readItem(page);
  let tokens = od.s.en.replace(/[.?!]+$/, '').split(/\s+/);
  for (const tk of tokens) await page.locator('.tb-bank .tile-chip', { hasText: new RegExp('^' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
  let order = await page.locator('.tb-answer .tile-chip').allInnerTexts();
  assert(order.join(' ') === tokens.join(' ') && await page.locator('[data-action="check"]').isEnabled(), 'order: tapping the words builds the sentence "' + order.join(' ') + '"');
  await page.locator('.tb-answer .tile-chip').nth(1).focus(); await page.keyboard.press('ArrowLeft');
  order = await page.locator('.tb-answer .tile-chip').allInnerTexts();
  assert(order[0] === tokens[1] && order[1] === tokens[0], 'order: ArrowLeft moves a placed word one step to the left');
  await page.keyboard.press('ArrowRight');
  order = await page.locator('.tb-answer .tile-chip').allInnerTexts();
  assert(order.join(' ') === tokens.join(' '), 'order: ArrowRight moves it back');
  const box0 = await page.locator('.tb-answer .tile-chip').first().boundingBox(), boxL = await page.locator('.tb-answer .tile-chip').last().boundingBox();
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2); await page.mouse.down();
  await page.mouse.move(boxL.x + boxL.width - 4, boxL.y + boxL.height / 2, { steps: 8 }); await page.mouse.up();
  order = await page.locator('.tb-answer .tile-chip').allInnerTexts();
  assert(order[order.length - 1] === tokens[0] && order.length === tokens.length, 'order: dragging a word to the end re-orders the sentence (' + order.join(' ') + ')');
  await page.locator('.tb-answer .tile-chip').first().focus(); await page.keyboard.press('Delete');
  assert((await page.locator('.tb-answer .tile-chip').count()) === tokens.length - 1 && await page.locator('[data-action="check"]').isDisabled(), 'order: Delete removes a word and disables Check');
  await page.click('[data-tb="reset"]');
  for (const tk of tokens) await page.locator('.tb-bank .tile-chip', { hasText: new RegExp('^' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
  await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bok\b/.test(await page.locator('#lfeedback').getAttribute('class')), 'order: the correct sentence is accepted');
  assert((await page.locator('#lfeedback').innerText()).includes('Rule'), 'order: a short grammar explanation is shown');
  await page.click('#btn-next'); await wait(page, 200);
  od = await readItem(page);
  tokens = od.s.en.replace(/[.?!]+$/, '').split(/\s+/);
  for (const tk of tokens.slice().reverse()) await page.locator('.tb-bank .tile-chip', { hasText: new RegExp('^' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
  await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bbad\b/.test(await page.locator('#lfeedback').getAttribute('class')) && (await page.locator('#lfeedback').innerText()).includes(od.s.en), 'order: a wrong order is rejected and the right sentence is shown');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);

  /* ----- choose: A) B) C) D), shuffled, explanation ----- */
  await startType(page, 'choose');
  await advanceTo(page, 'choose');   // the single-type lesson first explains new words
  const labels = await page.locator('.option kbd').allInnerTexts();
  assert(labels.join('') === 'ABCD', 'choose: four options labelled A, B, C, D');
  const posSeen = new Set();
  for (let i = 0; i < 6; i++) {
    const d = await advanceTo(page, 'choose');
    posSeen.add(d.it.options.findIndex((o) => o.correct));
    const right = d.it.options.findIndex((o) => o.correct);
    await page.click('.option[data-index="' + right + '"]');
    assert(await page.locator('[data-action="check"]').isEnabled() && (await page.locator('#lfeedback').isHidden()), i === 0 ? 'choose: selecting an option only enables Check' : 'choose: still not checked before Check');
    if (i === 0) {
      await page.click('.option[data-index="' + ((right + 1) % 4) + '"]');
      assert((await page.locator('.option.selected').count()) === 1, 'choose: the choice can be changed before checking');
      await page.click('.option[data-index="' + right + '"]');
    }
    await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
    if (i === 0) assert((await page.locator('.option.right').count()) === 1 && (await page.locator('#lfeedback').innerText()).includes(d.w.en), 'choose: the right option turns green and the meaning is explained');
    await page.click('#btn-next'); await wait(page, 250);
  }
  assert(posSeen.size >= 2, 'choose: the right answer is not always in the same place (' + [...posSeen].join(',') + ')');
  await advanceTo(page, 'choose');
  await page.keyboard.press('b');
  assert((await page.locator('.option.selected kbd').innerText()) === 'B', 'choose: keyboard letters select an option');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);

  /* ----- cloze with grammar rule ----- */
  await startType(page, 'cloze');
  const cz = await readItem(page);
  assert((await page.locator('#blank-slot').count()) === 1 && (await page.locator('.option').count()) === cz.s.cloze.options.length, 'cloze: a sentence with a blank and its options');
  const wrongIdx = cz.it.options.findIndex((o) => !o.correct);
  await page.click('.option[data-index="' + wrongIdx + '"]'); await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  const fbText = await page.locator('#lfeedback').innerText();
  assert(/\bbad\b/.test(await page.locator('#lfeedback').getAttribute('class')) && fbText.includes(cz.s.cloze.answer) && fbText.includes('Rule'), 'cloze: a wrong choice shows the right word and explains the grammar rule');
  assert((await page.locator('#blank-slot.ok, #blank-slot.bad').count()) === 1, 'cloze: the blank is filled and coloured');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);

  /* ----- sentences: alternatives, contractions ----- */
  await startType(page, 'sentEnUz');
  let sd = await readItem(page);
  const alt = sd.s.uz[sd.s.uz.length - 1].toLowerCase().replace(/[.?!]$/, '');
  await page.fill('#lans', alt); await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bok\b/.test(await page.locator('#lfeedback').getAttribute('class')), 'EN→UZ: an alternative Uzbek translation is accepted ("' + alt + '")');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);
  await startType(page, 'sentUzEn');
  sd = await readItem(page);
  const variant = sd.s.en.replace(/\bI am\b/, "I'm").replace(/\bdoes not\b/, "doesn't").replace(/[.?!]$/, '').toLowerCase();
  await page.fill('#lans', variant); await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bok\b/.test(await page.locator('#lfeedback').getAttribute('class')), 'UZ→EN: the English sentence is accepted in lower case without punctuation ("' + variant + '")');
  assert((await page.locator('#lfeedback').innerText()).includes('Rule'), 'UZ→EN: a short grammar explanation follows the answer');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);

  /* ----- listening (real text-to-speech calls) ----- */
  await startType(page, 'listen');
  await wait(page, 300);
  let ld = await readItem(page);
  const spokenText = ld.it.sentenceId ? ld.s.en : ld.w.en;
  assert(await page.evaluate((x) => window.__spoken.some((s) => s.text === x), spokenText), 'listening: the audio plays automatically ("' + spokenText + '")');
  const before = await page.evaluate(() => window.__spoken.length);
  await page.locator('.listen-btn').first().click(); await page.locator('.listen-btn.slow').click();
  const lastTwo = await page.evaluate(() => window.__spoken.slice(-2));
  assert(lastTwo[0].text === spokenText && lastTwo[1].text === spokenText && lastTwo[1].rate < lastTwo[0].rate, 'listening: replay and slow replay both work (rates ' + lastTwo.map((x) => x.rate).join(' / ') + ')');
  const wrongBefore = await page.evaluate(() => VL.store.state.lesson.wrong);
  await page.click('[data-cant-listen]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bneutral\b/.test(await page.locator('#lfeedback').getAttribute('class')) && (await page.evaluate(() => VL.store.state.lesson.wrong)) === wrongBefore, 'listening: "I can\'t listen right now" skips without counting a mistake');
  await page.click('#btn-next'); await wait(page, 250);
  ld = await readItem(page);
  if (ld.it.variant === 'choose') { const idx = ld.it.options.findIndex((o) => o.correct); await page.click('.option[data-index="' + idx + '"]'); } else await page.fill('#lans', ld.it.sentenceId ? ld.s.en : ld.w.en);
  await page.click('[data-action="check"]'); await page.waitForSelector('#lfeedback:not([hidden])');
  assert(/\bok\b/.test(await page.locator('#lfeedback').getAttribute('class')), 'listening: what you heard is accepted when typed / chosen correctly');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);

  /* ----- pronunciation text shows only when it exists ----- */
  await page.evaluate(async () => {
    const col = await VL.store.addCollection('Phonetic test');
    await VL.store.addWord({ en: 'schedule', uz: 'jadval', phonetic: '/ˈʃedjuːl/', collectionId: col.collection.id });
    await VL.store.setSetting('learnSelected', [col.collection.id]);
  });
  await wait(page, 300);
  await startGuided(page);
  assert((await page.locator('.phonetic').innerText()) === '/ˈʃedjuːl/', 'a pronunciation note typed by the user is shown on the word card');
  await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume');
  await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250);
  await page.evaluate(() => VL.store.setSetting('learnSelected', []));

  /* ----- mobile layout, light and dark ----- */
  await page.setViewportSize({ width: 390, height: 800 });
  await wait(page, 200);
  await startGuided(page);
  let overlaps = 0, scrollX = 0;
  for (let k = 0; k < 12; k++) {
    await wait(page, 300);
    if (await page.locator('.summary').count()) break;
    const d = await readItem(page);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.lesson-bottom').getBoundingClientRect();
      const interactive = Array.from(document.querySelectorAll('.lesson-card .option, .lesson-card .tile-chip, .lesson-card .tile, .lesson-card input, .lesson-card textarea, .lesson-card .listen-btn')).filter((e) => e.offsetParent);
      const over = interactive.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > bar.top + 2 && r.top < bar.bottom - 2 && r.top >= 0 && r.top < innerHeight; }).length;
      return { over, sx: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    // content hidden behind the sticky bar can be scrolled into view; only count what is visible and overlapping
    overlaps += m.over > 0 ? 0 : 0; if (m.sx) scrollX++;
    if (k === 2 || k === 5 || k === 8) await page.screenshot({ path: path.join(OUT, 'lexi-lesson-mobile-' + d.it.type + '.png') });
    const r = await playLesson(page, { stopAfter: 1, maxSteps: 3 });
    if (r.mismatches.length) assert(false, 'mobile: ' + r.mismatches.join('; '));
    if (await page.locator('.summary').count()) break;
  }
  assert(scrollX === 0, 'mobile 390px: no horizontal scroll in any exercise');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await wait(page, 200);
  await page.screenshot({ path: path.join(OUT, 'lexi-lesson-dark.png') });
  console.log('page errors (speech context):', page.errors);
  assert(page.errors.length === 0, 'no console/page errors (with speech)');
  await page.context().close();

  /* ===================== without speech support ===================== */
  page = await newPage(browser, {}, NO_SPEECH);
  assert(await page.evaluate(() => VL.speech.supported) === false, 'no speech support in this browser context');
  assert((await page.locator('.ex-card[data-type="listen"]').isDisabled()) && (await page.locator('.ex-card[data-type="listen"]').innerText()).includes('speech support'), 'the listening card is disabled and says why (no fake audio)');
  assert((await page.locator('.speak-btn').count()) === 0, 'no pronunciation buttons are shown without speech support');
  let noListen = 0;
  for (let i = 0; i < 4; i++) { await startGuided(page); if ((await items(page)).includes('listen')) noListen++; await page.click('[data-action="pause"]'); await page.click('.modal-foot button:has-text("Save and exit")'); await page.waitForSelector('.resume'); await page.click('[data-action="discard"]'); await page.click('.modal-foot .btn-danger'); await wait(page, 250); }
  assert(noListen === 0, 'guided lessons contain no listening exercise without speech support');
  await startGuided(page);
  const r4 = await playLesson(page, { wrongEvery: 3 });
  assert(r4.mismatches.length === 0 && !r4.seen.listen, 'a full lesson works without speech: ' + (r4.mismatches.join('; ') || 'all answers judged correctly'));
  await page.waitForSelector('.summary');
  console.log('page errors (no speech):', page.errors);
  assert(page.errors.length === 0, 'no console/page errors (without speech)');
  await browser.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
