/* Plays a lesson through the real UI (clicks, typing, Check, Continue) for the browser tests.
   For every exercise it answers correctly (or, every Nth time, wrongly) and verifies that the
   result panel agrees with what was entered. */
const wait = (p, ms) => p.waitForTimeout(ms || 120);

async function readItem(page) {
  return page.evaluate(() => {
    const l = VL.store.state.lesson;
    const it = l.items[l.index];
    return {
      it,
      idx: l.index,
      total: l.items.length,
      w: it.wordIds && it.wordIds[0] && it.type !== 'match' ? VL.store.word(it.wordIds[0]) : null,
      s: it.sentenceId ? VL.sentenceById(it.sentenceId) : null,
    };
  });
}

const firstAlt = (text) => String(text).split(/[;,]/)[0].trim();

async function clickChipByText(page, zone, text, used) {
  const chips = page.locator('.tb-bank .tile-chip');
  const n = await chips.count();
  for (let i = 0; i < n; i++) {
    const tx = (await chips.nth(i).innerText()).trim();
    if (tx.toLowerCase() === text.toLowerCase()) { await chips.nth(i).click(); return true; }
  }
  return false;
}

/* opts: { wrongEvery, stopAfter, maxSteps } -> { seen, answered, wrongs, mismatches, steps } */
async function playLesson(page, opts) {
  const o = Object.assign({ wrongEvery: 0, stopAfter: 0, maxSteps: 60 }, opts);
  const seen = {}, mismatches = [];
  let answered = 0, wrongs = 0, steps = 0;
  while (steps++ < o.maxSteps) {
    await wait(page, 260);
    if (await page.locator('.summary').count()) break;
    if (o.stopAfter && answered >= o.stopAfter) return { seen, answered, wrongs, mismatches, stopped: true };
    if (!(await page.locator('.lesson-card').count())) break;
    const d = await readItem(page);
    const it = d.it;
    seen[it.type] = (seen[it.type] || 0) + 1;
    const wrong = !!o.wrongEvery && it.type !== 'learn' && (answered + 1) % o.wrongEvery === 0;
    const checkBtn = page.locator('[data-action="check"]');

    if (it.type === 'match') {
      for (const p of it.pairs) {
        if (wrong && p === it.pairs[0]) {
          await page.click('.tile[data-side="l"][data-id="' + p.wordId + '"]');
          await page.click('.tile[data-side="r"][data-id="' + it.pairs[1].wordId + '"]');
          await wait(page, 500);
        }
        await page.click('.tile[data-side="l"][data-id="' + p.wordId + '"]');
        await page.click('.tile[data-side="r"][data-id="' + p.wordId + '"]');
        await wait(page, 50);
      }
    } else {
      if (await checkBtn.isEnabled()) mismatches.push(it.type + ': Check was enabled before answering');
      if (it.type === 'choose' || it.type === 'cloze' || (it.type === 'listen' && it.variant === 'choose')) {
        const idx = it.options.findIndex((x) => (wrong ? !x.correct : x.correct));
        await page.click('.option[data-index="' + idx + '"]');
      } else if (it.type === 'scramble') {
        const target = d.w.en.toUpperCase();
        let letters = Array.from(target);
        if (wrong) letters = letters.slice().reverse();
        const before = await page.locator('.tb-bank .tile-chip').count();
        // placing all but the last letter must not enable Check
        for (let i = 0; i < letters.length; i++) {
          if (!(await clickChipByText(page, 'bank', letters[i]))) mismatches.push('scramble: missing tile ' + letters[i]);
          if (i < letters.length - 1 && (await checkBtn.isEnabled())) mismatches.push('scramble: Check enabled too early');
        }
        if (before !== letters.length) mismatches.push('scramble: tile count ' + before + ' != ' + letters.length);
      } else if (it.type === 'order') {
        let tokens = d.s.en.replace(/[.?!]+$/, '').split(/\s+/);
        if (wrong) tokens = tokens.slice().reverse();
        for (const tk of tokens) if (!(await clickChipByText(page, 'bank', tk))) mismatches.push('order: missing tile ' + tk);
      } else {
        let text;
        if (it.type === 'learn' || it.type === 'intro') text = d.w.en;
        else if (it.type === 'fill') text = d.w.en;
        else if (it.type === 'listen') text = it.sentenceId ? d.s.en : d.w.en;
        else if (it.type === 'sentEnUz') text = d.s.uz[0];
        else if (it.type === 'sentUzEn') text = d.s.en;
        else text = it.dir === 'en-uz' ? firstAlt(d.w.uz) : d.w.en;
        if (wrong) text = 'zzzzq';
        else if (it.type !== 'sentEnUz') text = '  ' + (it.type === 'sentUzEn' ? text.toLowerCase() : text.toUpperCase()) + ' ';
        await page.fill('#lans', text);
      }
      await page.waitForFunction(() => { const b = document.querySelector('[data-action="check"]'); return b && !b.disabled; });
      await checkBtn.click();
    }
    await page.waitForSelector('#lfeedback:not([hidden])');
    const cls = await page.locator('#lfeedback').getAttribute('class');
    const gotOk = /\bok\b/.test(cls);
    if (it.type === 'match') { /* feedback is always the "all pairs matched" panel */ }
    else if (wrong && gotOk) mismatches.push(it.type + ': a wrong answer was accepted');
    else if (!wrong && !gotOk) mismatches.push(it.type + ': a correct answer was rejected');
    if (wrong) wrongs++;
    answered++;
    await wait(page, 300);
    await page.click('#btn-next');
  }
  return { seen, answered, wrongs, mismatches, steps };
}

module.exports = { playLesson, readItem, wait };
