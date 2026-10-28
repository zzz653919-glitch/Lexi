/* Plays lessons through the real UI. The test process owns the database, so it can look up the right answers. */
const { shuffled } = require('../../server/lib/util');
const X = require('../../server/lib/exercises');

async function currentState(page) {
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  return page.evaluate(async (attemptId) => (await fetch('/api/attempts/' + attemptId)).json(), id);
}
const perm = (n, seed) => { const idx = Array.from({ length: n }, (_, i) => i); let p = shuffled(idx, seed); for (let k = 1; k < 6 && n > 1 && p.every((v, i) => v === i); k++) p = shuffled(idx, seed + k * 104729); return p; };

/* answers the exercise on screen; wrong=true gives a deliberately wrong answer */
async function answer(page, db, wrong = false, { dbl = false } = {}) {
  const st = await currentState(page);
  const ex = st.exercise;
  const row = db.get('SELECT * FROM exercises WHERE id = ?', ex.id);
  const opts = db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', ex.id);
  const alts = X.alternatives(row.answer);
  switch (ex.type) {
    case 'multiple_choice': case 'translation_choice': case 'listen_choice': case 'reading': {
      const o = opts.find((x) => (wrong ? !x.is_correct : x.is_correct));
      await page.click(`.option[data-id="${o.id}"]`); break;
    }
    case 'fill_blank': case 'listen_type': case 'translate_type': await page.fill('.answer-input', wrong ? 'zzzzqq' : alts[0]); break;
    case 'fix_spelling': await page.fill('.answer-input', wrong ? 'zzzzqq' : alts[0]); break;
    case 'scramble_letters': {
      const ids = alts[0].split('').map((_, i) => i); if (wrong) ids.reverse();
      const letters = alts[0].toUpperCase().split('');
      for (const i of ids) { await page.locator(`.tile-area:not(.answer) .tile:not(.used)`).filter({ hasText: new RegExp('^' + letters[i] + '$') }).first().click(); }
      break;
    }
    case 'order_words': {
      const toks = X.tokensOf(row.sentence); const order = toks.map((_, i) => i); if (wrong) order.reverse();
      for (const i of order) await page.locator('.tile-area:not(.answer) .tile:not(.used)').filter({ hasText: new RegExp('^' + toks[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
      break;
    }
    case 'match_pairs': {
      const seed = db.get('SELECT seed FROM lesson_attempts WHERE id = ?', st.attemptId).seed + ex.id;
      const p = perm(opts.length, seed);
      for (let i = 0; i < opts.length; i++) {
        const j = p.findIndex((src) => src === i);
        const target = wrong && i < 2 ? p.findIndex((src) => src === (i + 1) % 2) : j;
        await page.locator('.match .col').nth(0).locator('button').nth(i).click();
        await page.locator('.match .col').nth(1).locator('button').nth(target).click();
      }
      break;
    }
    default: throw new Error('unknown type ' + ex.type);
  }
  if (dbl) await page.locator('.lesson-foot .btn:has-text("Check")').dblclick(); else await page.click('.lesson-foot .btn:has-text("Check")');
  await page.waitForSelector('.lesson-foot.good, .lesson-foot.bad');
  const good = await page.$('.lesson-foot.good');
  return { type: ex.type, correct: !!good };
}

async function playLesson(page, db, { wrongEvery = 0, max = 60 } = {}) {
  const seen = [], results = [];
  for (let n = 0; n < max; n++) {
    if (await page.$('.result')) break;
    if (await page.$('.lesson-body .q-title, .lesson-body .passage')) {
      const wrong = wrongEvery && (n + 1) % wrongEvery === 0;
      const r = await answer(page, db, wrong); seen.push(r.type); results.push({ ...r, wrong });
      await page.click('.lesson-foot .btn:not([disabled])');
    } else await page.waitForTimeout(150);
    await page.waitForTimeout(80);
  }
  return { seen, results };
}
module.exports = { answer, playLesson, currentState, perm };
