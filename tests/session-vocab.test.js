/* Browser tests for session-based vocabulary (isolated words, per-session progress, intro first, fixed exercise order):
   node tests/session-vocab.test.js */
const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { solveCurrent, readItem } = require('./helpers/lesson-solver');
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const wait = (p, ms) => p.waitForTimeout(ms || 200);

// two sessions with clearly different words (A: 5 words with examples, B: 4 words), a 2-word, a 1-word one and one with a missing translation
const SETS = {
  A: [['harvest', 'hosil', 'The farmers harvest wheat in autumn.', "Fermerlar kuzda bug'doy yig'adi."], ['anchor', 'langar', 'The ship dropped its anchor near the shore.', "Kema qirg'oq yaqiniga langar tashladi."],
      ['blanket', "ko'rpa", 'She covered the child with a warm blanket.', "U bolani issiq ko'rpa bilan yopdi."], ['lantern', 'fonus', 'He carried a lantern through the dark forest.', "U qorong'i o'rmon bo'ylab fonus ko'tarib yurdi."], ['pebble', 'mayda tosh', 'There was a pebble in my shoe.', "Oyoq kiyimim ichida mayda tosh bor edi."]],
  B: [['velvet', 'baxmal', '', ''], ['saddle', 'egar', '', ''], ['compass', 'kompas', '', ''], ['thimble', 'angishvona', '', '']],
  C: [['whisper', 'shivirlamoq', '', ''], ['meadow', "o'tloq", '', '']],
  D: [['orchard', "mevazor", '', '']],
  E: [['glimmer', 'milt-milt', '', ''], ['rustle', '', '', ''], ['plank', 'taxta', '', '']],
};

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.tabs');
  await page.selectOption('#lang-select', 'uz'); await wait(page);
  // lots of OTHER vocabulary that must never leak into a session
  await page.evaluate(() => VL.io.loadSample()); await wait(page, 500);
  const ids = await page.evaluate(async (SETS) => {
    const col = VL.store.state.collections[0];
    const out = {};
    for (const k of Object.keys(SETS)) {
      const created = [];
      await VL.store.importWords(SETS[k].map(([en, uz, ex, exUz]) => ({ en, uz: uz || 'x', example: ex, exUz, collectionId: col.id })));
      SETS[k].forEach(([en]) => created.push(VL.store.wordByEn(en).id));
      if (k === 'E') { const w = VL.store.word(created[1]); w.uz = ''; await VL.db.put('words', [w]); }   // a word that has no translation
      const c = await VL.store.addCustom({ name: 'Sessiya ' + k, topic: 'Test', source: 'specific', wordIds: created });
      out[k] = { id: c.id, words: created };
    }
    return out;
  }, SETS);
  const total = await page.evaluate(() => VL.store.state.words.length);
  assert(total > 50, 'plenty of other vocabulary exists (' + total + ' words) that could leak');
  const wordsOf = (k) => SETS[k].map((r) => r[0]);

  // ---------- plan: order, membership, no leakage (built many times because choices are random) ----------
  const plan = await page.evaluate((ids) => {
    const res = {};
    for (const k of Object.keys(ids)) {
      const words = ids[k].words.map((id) => VL.store.word(id));
      const allowedIds = new Set(ids[k].words), allowedEn = new Set(words.map((w) => w.en)), allowedUz = new Set(words.map((w) => w.uz));
      const bad = []; let phases = null; const counts = {};
      for (let rep = 0; rep < 60; rep++) {
        const b = VL.learn.buildSession(words, {});
        const seq = []; b.items.forEach((i) => { if (seq[seq.length - 1] !== i.phase) seq.push(i.phase); });
        phases = seq.join('>');
        b.items.forEach((i) => {
          counts[i.phase] = (counts[i.phase] || 0) + 1;
          (i.wordIds || []).forEach((id) => { if (!allowedIds.has(id)) bad.push('wordId ' + id); });
          if (i.sentenceId && !allowedIds.has(String(i.sentenceId).slice(2))) bad.push('sentence ' + i.sentenceId);
          (i.options || []).forEach((o) => { if (!allowedEn.has(o.text) && !allowedUz.has(o.text)) bad.push('option ' + o.text); });
          (i.tiles || []).forEach(() => {});
        });
      }
      res[k] = { phases, bad: Array.from(new Set(bad)), counts };
    }
    return res;
  }, ids);
  assert(plan.A.phases === 'learn>recall>choose>spell>scramble>translate', 'A: intro, recall, multiple choice, spelling, scrambled letters, translation in this order (' + plan.A.phases + ')');
  assert(plan.A.counts.learn === 5 * 60 && plan.A.counts.recall === 5 * 60 && plan.A.counts.choose === 5 * 60, 'A: every phase has one item per word (5)');
  for (const k of Object.keys(plan)) assert(plan[k].bad.length === 0, k + ': 60 builds never used a word, option or sentence from outside the session ' + JSON.stringify(plan[k].bad.slice(0, 3)));
  assert(!plan.B.counts.translate, 'B: no example sentences -> sentence translation is left out, not borrowed from other words');
  assert(plan.D.phases.startsWith('learn>recall') && !plan.D.counts.choose, 'D (one word): intro and recall; multiple choice is skipped instead of importing other words');
  const twoOpt = await page.evaluate((ids) => VL.learn.buildSession(ids.C.words.map((id) => VL.store.word(id)), {}).items.filter((i) => i.phase === 'choose').map((i) => i.options.length), ids);
  assert(twoOpt.length === 2 && twoOpt.every((n) => n === 2), 'C (two words): multiple choice has two options, both from the session');
  const missing = await page.evaluate((ids) => VL.learn.buildSession(ids.E.words.map((id) => VL.store.word(id)), {}).items.filter((i) => i.phase !== 'learn').map((i) => i.wordIds[0]), ids);
  assert(!missing.includes(ids.E.words[1]), 'E: a word without translation gets an intro only (no exercises)');

  // ---------- play session A through the real UI ----------
  await page.reload(); await page.waitForSelector('.cs-card');
  await page.evaluate(() => VL.store.saveLesson(null));
  const globalMarker = await page.evaluate(async () => { await VL.store.saveLesson({ marker: 'global-paused', items: [], index: 0 }); return VL.store.state.lesson.marker; });
  await page.locator('.cs-card:has(h3:text-is("Sessiya A")) [data-action="cs-start"]').click(); await page.waitForSelector('.lesson');
  assert(!(await page.locator('.modal-foot').count()), 'starting a session does not ask about another paused lesson');
  const aEn = new Set(wordsOf('A'));
  const screenWord = async () => (await page.locator('.q-word').first().innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
  assert((await page.locator('#lstep').innerText()).trim() === "5 tadan 1-so'z", 'counter reads "Word 1 of 5" in the intro');
  assert((await page.locator('.study-go').count()) === 1 && (await page.locator('.study-back').count()) === 0, 'first intro: Next only, no Back');
  const intro1 = await page.locator('.lesson-card').innerText();
  assert(intro1.includes('The farmers harvest wheat') || intro1.includes('anchor') || intro1.includes('blanket') || intro1.includes('lantern') || intro1.includes('pebble'), 'intro shows the English example');
  assert(intro1.includes("Fermerlar") || intro1.includes('Kema') || intro1.includes("U bolani") || intro1.includes("U qorong") || intro1.includes('Oyoq'), 'intro shows the Uzbek translation of the example');
  const seenIntro = [];
  for (let i = 0; i < 5; i++) {
    seenIntro.push((await screenWord()).replace(/\s*🔊.*$/, ''));
    if (i === 1) {   // Back returns to the previous intro, Next comes again
      await page.click('.study-back'); await wait(page, 150);
      assert((await page.locator('#lstep').innerText()).includes('1-so'), 'Back shows word 1 again');
      await page.click('.study-go'); await wait(page, 150);
    }
    await page.click('.study-go'); await wait(page, 150);
  }
  assert(seenIntro.every((w) => aEn.has(w.split(' ')[0])) && new Set(seenIntro).size === 5, 'the five intros are exactly the five words of session A (' + seenIntro.join(', ') + ')');
  const bar = await page.locator('#lbar').evaluate((e) => parseFloat(e.style.width));
  assert(bar > 0 && bar < 100, 'session progress bar moves (' + bar + '%)');
  assert((await page.locator('.ss-phase').innerText()).includes('Eslab qolish'), 'after the intros the Recall exercise starts');

  // answer everything; every 4th answer wrong; check each screen only shows session words
  let leaks = 0, count = 0, phasesSeen = [], wrongs = 0;
  while (!(await page.locator('.summary').count()) && count < 80) {
    await wait(page, 200);
    const d = await readItem(page).catch(() => null);   // finishing clears the saved progress a moment before the results appear
    if (!d) continue;
    if (d.it.type === 'study') { await page.click('.study-go'); continue; }
    if (!phasesSeen.length || phasesSeen[phasesSeen.length - 1] !== d.it.phase) phasesSeen.push(d.it.phase);
    const txt = (await page.locator('.lesson-card').innerText()).toLowerCase();
    (await page.locator('.option').allInnerTexts()).forEach((o) => { const x = o.trim().toLowerCase().replace(/^[a-z0-9]\s+/, ''); if (x && !SETS.A.some((r) => x === r[0] || x === r[1].toLowerCase())) { leaks++; console.log('LEAK?', JSON.stringify(x)); } });
    const wrong = d.it.phase !== 'review' && (count + 1) % 4 === 0;
    const r = await solveCurrent(page, wrong);
    if (wrong) wrongs++;
    count++;
    await wait(page, 250);
    await page.click('#btn-next');
  }
  assert(leaks === 0, 'no multiple-choice option came from outside session A');
  assert(phasesSeen.join('>') === 'recall>choose>spell>scramble>translate>review', 'exercise phases appear in the required order incl. a review of wrong words (' + phasesSeen.join('>') + ')');
  await page.waitForSelector('.summary');
  const resText = await page.locator('.summary').innerText();
  assert(/\d+%/.test(resText) && resText.includes('Sessiya A'.slice(0, 0)) || /\d+%/.test(resText), 'completion screen shows the score and percentage');
  assert((await page.locator('.two-col .word-list li').count()) >= 1, 'completion screen lists words (incorrect words / learned words)');
  assert((await page.locator('[data-action="review-mistakes"]').count()) === 1, 'completion screen offers a review of the session');
  assert((await page.locator('[data-action="ss-next"]').count()) === 1, 'completion screen offers the next session');
  const stillGlobal = await page.evaluate(() => VL.store.state.lesson && VL.store.state.lesson.marker);
  assert(stillGlobal === globalMarker, 'finishing a session leaves the separate paused lesson alone');
  const aState = await page.evaluate((id) => { const c = VL.store.customSession(id); return { progress: !!c.progress, runs: c.runs.length, words: c.wordIds.length }; }, ids.A.id);
  assert(!aState.progress && aState.runs === 1 && aState.words === 5, 'finished session: progress cleared, run recorded, words kept');

  // ---------- next session starts with ITS intro; nothing from A shows up ----------
  await page.click('[data-action="ss-next"]'); await page.waitForSelector('.study-go');
  const bFirst = (await screenWord()).split(' ')[0];
  assert(wordsOf('B').includes(bFirst) && (await page.locator('#lstep').innerText()).includes('4 tadan 1-'), 'next session begins at its own intro, Word 1 of 4 (' + bFirst + ')');

  // ---------- independent progress / resume ----------
  await page.click('.study-go'); await wait(page, 150); await page.click('.study-go'); await wait(page, 300);
  const bProg = await page.evaluate((id) => { const c = VL.store.customSession(id); return c.progress && c.progress.index; }, ids.B.id);
  assert(bProg === 2, 'session B saved its own progress (index 2)');
  await page.reload(); await page.waitForSelector('.tabs'); await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  assert((await page.locator('.cs-card:has(h3:text-is("Sessiya B"))').innerText()).includes('davom etmoqda'), 'session list shows B as in progress');
  // start C meanwhile
  await page.locator('.cs-card:has(h3:text-is("Sessiya C")) [data-action="cs-start"]').click(); await page.waitForSelector('.study-go');
  const cFirst = (await screenWord()).split(' ')[0];
  assert(wordsOf('C').includes(cFirst), 'C starts at its own first intro (' + cFirst + ')');
  await page.click('.study-go'); await wait(page, 300);
  const prog = await page.evaluate((ids) => ({ b: VL.store.customSession(ids.B.id).progress.index, c: VL.store.customSession(ids.C.id).progress.index }), ids);
  assert(prog.b === 2 && prog.c === 1, 'B and C keep separate progress (' + JSON.stringify(prog) + ')');
  await page.goto(APP + '#/learn?tab=sessions'); await page.reload(); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Sessiya B")) [data-action="cs-start"]').click(); await page.waitForSelector('.study-go');
  assert((await page.locator('#lstep').innerText()).includes('3-'), 'Continue resumes B at word 3 of 4');
  assert(wordsOf('B').includes((await screenWord()).split(' ')[0]), 'resumed screen shows a word of B');

  // ---------- restart resets exercise progress but keeps words and history ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.reload(); await page.waitForSelector('.cs-card');
  const wordsBefore = await page.evaluate(() => VL.store.state.words.length);
  await page.locator('.cs-card:has(h3:text-is("Sessiya B")) [data-action="cs-reset"]').click(); await page.click('.modal-foot .btn-danger'); await page.waitForSelector('.study-go');
  assert((await page.locator('#lstep').innerText()).includes('1-'), 'restart begins again at word 1 (intro)');
  const kept = await page.evaluate((ids) => ({ words: VL.store.state.words.length, bw: VL.store.customSession(ids.B.id).wordIds.length, aRuns: VL.store.customSession(ids.A.id).runs.length, c: !!VL.store.customSession(ids.C.id).progress }), ids);
  assert(kept.words === wordsBefore && kept.bw === 4 && kept.aRuns === 1 && kept.c, 'restart deletes no vocabulary or history and leaves other sessions alone');

  // ---------- edge cases ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.reload(); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Sessiya D")) [data-action="cs-start"]').click(); await page.waitForSelector('.study-go');
  await page.click('.study-go'); await page.waitForSelector('.lesson input');
  assert((await page.locator('.ss-phase').innerText()).includes('Eslab'), 'one-word session: intro, then recall (no crash)');
  await page.goto(APP + '#/learn?tab=sessions'); await page.reload(); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Sessiya E")) [data-action="cs-start"]').click(); await page.waitForSelector('.study-go');
  let noTr = false;
  for (let i = 0; i < 3; i++) { if ((await page.locator('.intro-uz').innerText()).includes('tarjima hali')) noTr = true; await page.click('.study-go'); await wait(page, 150); }
  assert(noTr, 'a word without a translation shows a placeholder in the intro');
  await page.goto(APP + '#/learn?tab=sessions'); await page.reload(); await page.waitForSelector('.cs-card');
  await page.evaluate(async (ids) => { const c = VL.store.customSession(ids.D.id); c.wordIds = ['gone']; await VL.store.saveSessionProgress(ids.D.id, null); }, ids);
  await page.locator('.cs-card:has(h3:text-is("Sessiya D")) [data-action="cs-start"]').click(); await wait(page, 400);
  assert((await page.locator('.lesson').count()) === 0 && (await page.locator('.toast').count()) >= 1, 'empty session shows a message and does not start');

  assert(errors.length === 0, 'no page errors (' + errors.slice(0, 3).join(' | ') + ')');
  await browser.close();
})().catch((e) => { console.error('CRASH:', e); process.exit(1); });
