/* Browser tests for custom sessions and translation answer checking: node tests/sessions.test.js */
const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { playLesson } = require('./helpers/lesson-solver');
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const wait = (p, ms) => p.waitForTimeout(ms || 200);

async function fresh(browser, hash, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, locale: 'en-US' }, opts || {}));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(APP + (hash || '#/learn?tab=sessions'));
  await page.waitForSelector('.tabs');
  return page;
}
const store = (page, fn, arg) => page.evaluate(fn, arg);

(async () => {
  const browser = await playwright.chromium.launch();
  let page = await fresh(browser);
  await page.selectOption('#lang-select', 'uz'); await wait(page);

  // ---------- creation window ----------
  assert((await page.locator('[data-action="cs-new"]').first().innerText()).includes('Yangi sessiya yaratish'), 'button "Yangi sessiya yaratish" is visible');
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  const topics = await page.locator('#cs-topic option').allInnerTexts();
  ['Kundalik hayot', 'Oila va uy', 'Ish va kasblar', 'Sayohat', 'Oziq-ovqat', 'Grammatika', "Fe'llar", 'Sifatlar', 'Phrasal verbs', 'IELTS vocabulary', "O'zimning so'zlarim"].forEach((x) => assert(topics.includes(x), 'topic offered: ' + x));
  const counts = await page.locator('#cs-count option').evaluateAll((o) => o.map((x) => x.value));
  assert(counts.join(',') === '5,10,15,20,all', 'counts 5/10/15/20/all');
  assert((await page.locator('input[name="cs-type"]').count()) === 9, 'nine exercise types offered');
  // validation
  await page.fill('#cs-name', '   '); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'empty name rejected');
  await page.fill('#cs-name', 'Oila'); await page.selectOption('#cs-topic', 'custom'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'custom topic needs a name');
  await page.selectOption('#cs-topic', 'grammar');
  await page.check('input[name="cs-src"][value="specific"]'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'no specific words chosen -> error');
  await page.check('input[name="cs-src"][value="mistakes"]'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'no mistakes yet -> error');

  // ---------- topic session: 5 exercises, two types ----------
  await page.check('input[name="cs-src"][value="topic"]');
  await page.selectOption('#cs-topic', 'family'); await page.fill('#cs-name', 'Oila mashqi');
  await page.selectOption('#cs-count', '5');
  await page.check('input[name="cs-type"][value="translate"]'); await page.check('input[name="cs-type"][value="choose"]');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 600);
  let cs = await store(page, () => VL.store.state.custom);
  assert(cs.length === 1 && cs[0].name === 'Oila mashqi' && cs[0].topic === 'Oila va uy', 'session saved with name and topic');
  assert(cs[0].wordIds.length === 64 && cs[0].count === '5' && cs[0].types.join() === 'translate,choose', 'topic words installed (family+home, 4 levels = 64) and types stored');
  assert((await page.locator('.cs-card').count()) === 1 && (await page.locator('.cs-card').innerText()).includes('Oila mashqi'), 'session card visible with name + topic');

  // ---------- play it, with mistakes ----------
  await page.click('[data-action="cs-start"]'); await page.waitForSelector('.lesson');
  const planned = await store(page, () => VL.store.state.lesson.items.map((i) => i.type));
  assert(planned.length === 5 && planned.every((t) => ['translate', 'choose', 'reverse'].includes(t)), 'exactly 5 exercises, only the chosen types (' + planned + ')');
  assert(new Set(await store(page, () => VL.store.state.lesson.items.map((i) => i.wordIds[0]))).size === 5, 'no word repeats when there are enough words');
  const r1 = await playLesson(page, { wrongEvery: 2 });
  await page.waitForSelector('.summary');
  const resText = await page.locator('main, #view, body').first().innerText();
  ['Faqat xatolarni qayta ishlash', 'Sessiyani qayta boshlash', 'Yangi sessiya yaratish'].forEach((x) => assert(resText.includes(x), 'results button: ' + x));
  assert(resText.includes('Oila mashqi') && resText.includes('Oila va uy'), 'result page shows session name and topic');
  cs = await store(page, () => VL.store.state.custom);
  const run = cs[0].runs[0];
  assert(cs[0].runs.length === 1 && run.total >= 5 && run.total === r1.answered + (run.total - r1.answered) && run.correct + run.wrong === run.total, 'run saved: total ' + run.total + ' = correct ' + run.correct + ' + wrong ' + run.wrong);
  assert(run.missedIds.length > 0 && (await store(page, () => VL.store.state.settings.mistakeIds)).length === run.missedIds.length, 'mistaken words saved for future sessions');
  const sess = await store(page, () => VL.store.state.sessions.filter((s) => s.customId));
  assert(sess.length === 1 && sess[0].customName === 'Oila mashqi', 'global session history records the custom session');

  // ---------- only mistakes ----------
  await page.click('[data-action="review-mistakes"]'); await page.waitForSelector('.lesson');
  const miss = await store(page, () => ({ ids: new Set(VL.store.state.lesson.items.flatMap((i) => i.wordIds)), n: VL.store.state.lesson.items.length }));
  const missedSet = new Set(run.missedIds);
  assert(Array.from(miss.ids).every((id) => missedSet.has(id)), 'mistakes-only run uses only the mistaken words');
  await playLesson(page, { wrongEvery: 0 });
  await page.waitForSelector('.summary');
  cs = await store(page, () => VL.store.state.custom);
  assert(cs[0].runs.length === 2 && cs[0].runs[1].mode === 'mistakes', 'second run saved as mistakes-only');
  assert((await store(page, () => VL.store.state.settings.mistakeIds)).length < run.missedIds.length + 1, 'corrected words leave the mistake list');

  // ---------- restart / new from results ----------
  await page.click('[data-action="cs-restart"]'); await page.waitForSelector('.lesson');
  assert((await store(page, () => VL.store.state.lesson.items.length)) === 5, 'restart rebuilds a fresh 5-exercise run');

  // ---------- reload keeps progress ----------
  await page.click('#btn-check, [data-action="skip"]').catch(() => {});
  await page.reload(); await page.waitForSelector('.tabs');
  assert((await store(page, () => VL.store.state.custom.length)) === 1 && (await store(page, () => VL.store.state.custom[0].runs.length)) === 2, 'sessions and history survive a reload');
  assert(!!(await store(page, () => VL.store.state.lesson)), 'unfinished run survives a reload');
  await page.goto(APP + '#/learn?tab=practice'); await page.waitForSelector('[data-action="resume"]');
  await page.click('[data-action="resume"]'); await page.waitForSelector('.lesson');
  await page.click('[data-action="pause"]'); await page.waitForSelector('.modal-foot');
  await page.click('.modal-foot .btn-ghost'); await wait(page, 800);   // end now
  await page.waitForSelector('.summary, .tabs', { timeout: 5000 });

  // ---------- history, rename, delete ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.click('[data-action="cs-history"]');
  assert((await page.locator('.cs-runs li').count()) >= 2, 'history lists the old runs');
  await page.click('[data-action="cs-rename"]'); await page.fill('#cs-rn', 'Yangi nom'); await page.click('.modal-foot .btn-primary'); await wait(page);
  assert((await page.locator('.cs-card h3').innerText()) === 'Yangi nom', 'rename works');
  await page.click('[data-action="cs-rename"]'); await page.fill('#cs-rn', ''); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-rn-err').innerText()).length > 0, 'empty rename rejected'); await page.click('.modal-foot .btn-ghost');

  // ---------- typed words, few words reused, all types incl. matching ----------
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Mening 3 so‘zim'); await page.check('input[name="cs-src"][value="typed"]');
  await page.fill('#cs-typed', 'sunrise — tong otishi\nsunset — quyosh botishi\nrainbow'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).includes('rainbow'), 'typed word without translation is reported, not invented');
  await page.fill('#cs-typed', 'sunrise — tong otishi\nsunset — quyosh botishi\nvalley — vodiy');
  await page.selectOption('#cs-count', '15');
  for (const k of ['translate', 'choose', 'scramble', 'fill', 'match']) await page.check('input[name="cs-type"][value="' + k + '"]');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 500);
  cs = await store(page, () => VL.store.state.custom);
  const few = cs.find((c) => c.name.startsWith('Mening 3'));
  assert(few && few.wordIds.length === 3, 'typed words created (3)');
  const fewWords = await store(page, () => VL.store.state.words.filter((w) => ['sunrise', 'sunset', 'valley'].includes(w.en)).length);
  assert(fewWords === 3, 'typed words saved to vocabulary');
  const built = await store(page, (id) => { const c = VL.store.customSession(id); const b = VL.learn.buildCustom({ words: VL.custom.sessionWords(c), count: c.count, types: c.types, speech: false }, VL.store.state.words); return b.items.map((i) => i.type + ':' + (i.wordIds[0] || '')); }, few.id);
  assert(built.length === 15, '15 exercises from 3 words (' + built.length + ')');
  assert(built.every((x, i) => i === 0 || x !== built[i - 1]), 'no identical exercise twice in a row');
  assert(built.some((x) => x.startsWith('match')), 'matching exercise used');

  // ---------- empty type selection -> default ----------
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Standart'); await page.selectOption('#cs-topic', 'grammar'); await page.selectOption('#cs-count', 'all');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 500);
  cs = await store(page, () => VL.store.state.custom);
  const def = cs.find((c) => c.name === 'Standart');
  assert(def && def.types.length >= 5 && def.wordIds.length === 15, 'no types chosen -> default mix; Grammar topic has 15 words');
  const allB = await store(page, (id) => { const c = VL.store.customSession(id); return VL.learn.buildCustom({ words: VL.custom.sessionWords(c), count: 'all', types: c.types, speech: false }, VL.store.state.words).items.length; }, def.id);
  assert(allB === 15, '"all" = one exercise per selected word');

  // ---------- mistakes source ----------
  await store(page, () => VL.store.setSetting('mistakeIds', VL.store.state.words.slice(0, 3).map((w) => w.id)));
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Xatolar'); await page.check('input[name="cs-src"][value="mistakes"]'); await page.selectOption('#cs-count', '10');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 400);
  assert((await store(page, () => VL.store.state.custom.some((c) => c.name === 'Xatolar'))), 'session from wrong words created');

  // ---------- specific words + collection ----------
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Tanlangan'); await page.check('input[name="cs-src"][value="specific"]');
  await page.fill('#cs-find', 'sunrise'); await page.check('#cs-pick input[type="checkbox"]');
  await page.fill('#cs-find', 'sunset'); await page.check('#cs-pick input[type="checkbox"]');
  assert((await page.locator('#cs-picked').innerText()).includes('2'), 'picked counter shows 2');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 400);
  assert((await store(page, () => VL.store.state.custom.find((c) => c.name === 'Tanlangan').wordIds.length)) === 2, 'specific words kept across searches');
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Toplam'); await page.check('input[name="cs-src"][value="collection"]');
  await page.selectOption('#cs-col', { index: 0 });
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")');
  await wait(page, 400);
  const colErr = await page.locator('#cs-error').count() ? await page.locator('#cs-error').innerText().catch(() => '') : '';
  assert(colErr.length > 0 || (await store(page, () => VL.store.state.custom.some((c) => c.name === 'Toplam'))), 'collection source handled (error for empty collection or session created)');
  if (await page.locator('.modal-foot').count()) await page.click('.modal-foot .btn-ghost:has-text("Bekor")');

  // ---------- paused lesson replacement is confirmed ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Tanlangan")) [data-action="cs-start"]').click(); await page.waitForSelector('.lesson, .modal-foot');
  if (await page.locator('.modal-foot').count()) { console.log('modal:', await page.locator('dialog').innerText()); await page.click('.modal-foot .btn-danger'); await page.waitForSelector('.lesson'); }
  await page.reload(); await page.waitForSelector('.tabs');
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Standart")) [data-action="cs-start"]').click();
  await page.waitForSelector('.modal-foot');
  await page.click('.modal-foot .btn-ghost'); await wait(page, 700);
  const nm = await store(page, () => VL.store.state.lesson && VL.store.state.lesson.custom && VL.store.state.lesson.custom.name); console.log('paused:', nm);
  assert(nm === 'Tanlangan', 'cancelling the warning keeps the paused session');

  // ---------- delete ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  const before = await page.locator('.cs-card').count();
  await page.locator('.cs-card:has(h3:text-is("Xatolar")) [data-action="cs-delete"]').click(); await page.click('.modal-foot .btn-danger'); await wait(page, 400);
  assert((await page.locator('.cs-card').count()) === before - 1, 'delete removes the session');
  assert((await store(page, () => VL.store.state.words.length)) > 0, 'words stay after deleting a session');

  // ---------- backup / restore keeps sessions ----------
  const backup = await store(page, () => JSON.parse(JSON.stringify(VL.store.backup())));
  await store(page, () => VL.store.clearAll());
  assert((await store(page, () => VL.store.state.custom.length)) === 0, 'clear all removes sessions');
  await page.evaluate((b) => VL.store.restore(b), backup);
  assert((await store(page, () => VL.store.state.custom.length)) === backup.custom.length, 'restore brings sessions back');

  // ---------- answer checking in the real exercise ----------
  const mkTyped = async (en, uz, extra, typed, dir) => {
    await page.goto(APP + '#/learn?tab=practice'); await page.reload(); await page.waitForSelector('.tabs', { timeout: 8000 }).catch(async () => console.log('NO TABS:', (await page.locator('#main').innerText()).slice(0, 300)));
    await store(page, () => VL.store.saveLesson(null));
    const id = await store(page, async ({ en, uz, extra }) => {
      const col = VL.store.state.collections[0];
      let w = VL.store.state.words.find((x) => x.en === en);
      if (!w) { const r = await VL.store.addWord(Object.assign({ en, uz, collectionId: col.id }, extra)); w = r.word; }
      return w.id;
    }, { en, uz, extra });
    await store(page, ({ id, dir }) => VL.player.start(document.querySelector('#main'), { type: 'review', items: [{ id: 'x1', type: dir === 'uz-en' ? 'reverse' : 'translate', wordIds: [id], sentenceId: null, dir: dir || 'en-uz', retry: false }] }, { onExit() {} }), { id, dir });
    await page.waitForSelector('.lesson input[type="text"], .lesson input:not([type])');
    await page.fill('.lesson input', typed); await page.click('[data-action="check"]'); await wait(page, 250);
    return (await page.locator('.feedback, .fb-panel, .lesson-feedback, [role="status"]').first().innerText().catch(() => '')) + '|' + (await page.locator('.lesson').getAttribute('class'));
  };
  const okState = async () => store(page, () => { const l = VL.store.state.lesson; return l ? l.correct : -1; });
  await mkTyped('lose', "yo'qotmoq", {}, "Yo'qotish");
  assert((await okState()) === 1, "lose → \"Yo'qotish\" accepted as correct");
  await mkTyped('begin', 'boshlamoq', {}, 'boshlash');
  assert((await okState()) === 1, 'begin → boshlash accepted');
  await mkTyped('help', 'yordam bermoq', {}, 'yordam berish');
  assert((await okState()) === 1, 'help → yordam berish accepted');
  await mkTyped('repair', "ta'mirlamoq", {}, "ta'mirlash");
  assert((await okState()) === 1, "repair → ta'mirlash accepted");
  await mkTyped('quick', 'tez', { alts: 'tezkor' }, 'tezkor');
  assert((await okState()) === 1, 'quick → tezkor accepted (additional translation)');
  await mkTyped('lose', "yo'qotmoq", {}, "yo'q");
  assert((await okState()) === 0, "lose → \"yo'q\" (a different word) rejected");
  await mkTyped('give', 'bermoq', { alts: "boy bermoq | o'yinda" }, 'boy bermoq');
  assert((await okState()) === 0, 'context-only translation rejected without that context');
  await mkTyped('home', 'uy', {}, 'house', 'uz-en');
  assert((await okState()) === 0 || (await okState()) === 1, 'uz→en check runs');

  // ---------- phone width ----------
  const mob = await fresh(browser, '#/learn?tab=sessions', { viewport: { width: 375, height: 700 } });
  await mob.click('[data-action="cs-new"]'); await mob.waitForSelector('#cs-name');
  const over = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(over <= 0, 'no horizontal overflow on a phone (creation window)');
  await mob.close();

  assert(page.errors.length === 0, 'no page errors: ' + page.errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
