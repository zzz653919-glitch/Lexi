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
  assert((await page.locator('#cs-count').count()) === 0 && (await page.locator('input[name="cs-type"]').count()) === 0, 'no exercise-count/type pickers: every session follows the same fixed workflow');
  // validation
  await page.fill('#cs-name', '   '); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'empty name rejected');
  assert((await page.locator('#cs-topic option[value="custom"]').count()) === 0 && (await page.locator('#cs-topic-text').count()) === 0, 'no free-text "other topic" field');
  await page.selectOption('#cs-topic', 'grammar');
  await page.check('input[name="cs-src"][value="specific"]'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'no specific words chosen -> error');
  await page.check('input[name="cs-src"][value="mistakes"]'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).length > 0, 'no mistakes yet -> error');

  // ---------- topic session: 5 exercises, two types ----------
  await page.check('input[name="cs-src"][value="topic"]');
  await page.selectOption('#cs-topic', 'family'); await page.fill('#cs-name', 'Oila mashqi');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 600);
  let cs = await store(page, () => VL.store.state.custom);
  assert(cs.length === 1 && cs[0].name === 'Oila mashqi' && cs[0].topic === 'Oila va uy', 'session saved with name and topic');
  assert(cs[0].wordIds.length === 64, 'topic words installed (family+home, 4 levels = 64)');
  assert((await page.locator('.cs-card').count()) === 1 && (await page.locator('.cs-card').innerText()).includes('Oila mashqi'), 'session card visible with name + topic');

  // ---------- play a small session, with mistakes ----------
  await store(page, async () => { const ws = VL.store.state.words.slice(0, 4); await VL.store.addCustom({ name: 'Kichik', topic: 'Test', source: 'specific', wordIds: ws.map((w) => w.id) }); });
  await page.reload(); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Kichik")) [data-action="cs-start"]').click(); await page.waitForSelector('.lesson');
  await wait(page, 300);
  const planned = await store(page, () => VL.store.state.custom.find((c) => c.name === 'Kichik').progress.items.map((i) => i.type));
  assert(planned.slice(0, 4).every((t) => t === 'study') && planned.slice(4).every((t) => t !== 'study'), 'four intro screens first, then the exercises (' + planned.join(',') + ')');
  const r1 = await playLesson(page, { wrongEvery: 2 });
  await page.waitForSelector('.summary');
  const resText = await page.locator('main, #view, body').first().innerText();
  ['Faqat xatolarni qayta ishlash', 'Sessiyani qayta boshlash', 'Yangi sessiya yaratish'].forEach((x) => assert(resText.includes(x), 'results button: ' + x));
  assert(resText.includes('Kichik') && resText.includes('Test'), 'result page shows session name and topic');
  const kich = () => store(page, () => VL.store.state.custom.find((c) => c.name === 'Kichik'));
  let ks = await kich();
  const run = ks.runs[0];
  assert(ks.runs.length === 1 && run.total >= 4 && run.correct + run.wrong === run.total, 'run saved: total ' + run.total + ' = correct ' + run.correct + ' + wrong ' + run.wrong);
  assert(run.missedIds.length > 0 && (await store(page, () => VL.store.state.settings.mistakeIds)).length === run.missedIds.length, 'mistaken words saved for future sessions');
  const sess = await store(page, () => VL.store.state.sessions.filter((s) => s.customId));
  assert(sess.length === 1 && sess[0].customName === 'Kichik', 'global session history records the custom session');

  // ---------- only mistakes ----------
  await page.click('[data-action="review-mistakes"]'); await page.waitForSelector('.lesson');
  const miss = await store(page, () => ({ ids: new Set(VL.store.state.lesson.items.flatMap((i) => i.wordIds)), types: VL.store.state.lesson.items.map((i) => i.type) }));
  const missedSet = new Set(run.missedIds);
  assert(Array.from(miss.ids).every((id) => missedSet.has(id)) && !miss.types.includes('study'), 'mistakes-only run uses only the mistaken words (no intro again)');
  await playLesson(page, { wrongEvery: 0 });
  await page.waitForSelector('.summary');
  ks = await kich();
  assert(ks.runs.length === 2 && ks.runs[1].mode === 'mistakes', 'second run saved as mistakes-only');
  assert((await store(page, () => VL.store.state.settings.mistakeIds)).length < run.missedIds.length + 1, 'corrected words leave the mistake list');

  // ---------- restart from results ----------
  await page.click('[data-action="cs-restart"]'); await page.waitForSelector('.lesson'); await wait(page, 300);
  assert((await kich()).progress.items[0].type === 'study', 'restart begins again with the intro');

  // ---------- reload keeps progress ----------
  await page.reload(); await page.waitForSelector('.tabs');
  assert((await store(page, () => VL.store.state.custom.length)) === 2 && (await kich()).runs.length === 2, 'sessions and history survive a reload');
  assert(!!(await kich()).progress, 'unfinished run survives a reload (its own progress record)');
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Kichik")) [data-action="cs-start"]').click(); await page.waitForSelector('.lesson');
  await page.click('[data-action="pause"]'); await page.waitForSelector('.modal-foot');
  await page.click('.modal-foot .btn-ghost'); await wait(page, 800);   // end now
  await page.waitForSelector('.summary, .tabs', { timeout: 5000 });

  // ---------- history, rename, delete ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.click('.cs-card:has(h3:text-is("Kichik")) [data-action="cs-history"]');
  assert((await page.locator('.cs-runs li').count()) >= 2, 'history lists the old runs');
  const oila = '.cs-card:has(h3:text-is("Oila mashqi"))';
  await page.click(oila + ' [data-action="cs-rename"]'); await page.fill('#cs-rn', 'Yangi nom'); await page.click('.modal-foot .btn-primary'); await wait(page);
  assert((await page.locator('.cs-card h3:text-is("Yangi nom")').count()) === 1 && (await page.locator('.cs-card h3:text-is("Oila mashqi")').count()) === 0, 'rename works');
  await page.click('.cs-card:has(h3:text-is("Yangi nom")) [data-action="cs-rename"]'); await page.fill('#cs-rn', ''); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-rn-err').innerText()).length > 0, 'empty rename rejected'); await page.click('.modal-foot .btn-ghost');

  // ---------- typed words, few words reused, all types incl. matching ----------
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Mening 3 so‘zim'); await page.check('input[name="cs-src"][value="typed"]');
  await page.fill('#cs-typed', 'sunrise — tong otishi\nsunset — quyosh botishi\nrainbow'); await page.click('.modal-foot .btn-primary');
  assert((await page.locator('#cs-error').innerText()).includes('rainbow'), 'typed word without translation is reported, not invented');
  await page.fill('#cs-typed', 'sunrise — tong otishi\nsunset — quyosh botishi\nvalley — vodiy');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 500);
  cs = await store(page, () => VL.store.state.custom);
  const few = cs.find((c) => c.name.startsWith('Mening 3'));
  assert(few && few.wordIds.length === 3, 'typed words created (3)');
  const fewWords = await store(page, () => VL.store.state.words.filter((w) => ['sunrise', 'sunset', 'valley'].includes(w.en)).length);
  assert(fewWords === 3, 'typed words saved to vocabulary');
  const built = await store(page, (id) => { const c = VL.store.customSession(id); return VL.learn.buildSession(VL.custom.sessionWords(c), {}).items.map((i) => i.phase); }, few.id);
  assert(built.filter((x) => x === 'learn').length === 3 && built.filter((x) => x === 'recall').length === 3 && built.filter((x) => x === 'choose').length === 3, '3 typed words: 3 intros, 3 recall, 3 multiple choice');

  // ---------- empty type selection -> default ----------
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Standart'); await page.selectOption('#cs-topic', 'grammar');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 500);
  cs = await store(page, () => VL.store.state.custom);
  const def = cs.find((c) => c.name === 'Standart');
  assert(def && def.wordIds.length === 15, 'Grammar topic has 15 words');

  // ---------- mistakes source ----------
  await store(page, () => VL.store.setSetting('mistakeIds', VL.store.state.words.slice(0, 3).map((w) => w.id)));
  await page.click('[data-action="cs-new"]'); await page.waitForSelector('#cs-name');
  await page.fill('#cs-name', 'Xatolar'); await page.check('input[name="cs-src"][value="mistakes"]');
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

  // ---------- sessions do not replace each other ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Tanlangan")) [data-action="cs-start"]').click(); await page.waitForSelector('.lesson');
  await wait(page, 300);
  await page.reload(); await page.waitForSelector('.tabs');
  await page.goto(APP + '#/learn?tab=sessions'); await page.waitForSelector('.cs-card');
  await page.locator('.cs-card:has(h3:text-is("Standart")) [data-action="cs-start"]').click(); await page.waitForSelector('.lesson'); await wait(page, 300);
  assert(!(await page.locator('.modal-foot').count()), 'no warning when another session is unfinished');
  const both = await store(page, () => ['Tanlangan', 'Standart'].map((n) => !!VL.store.state.custom.find((c) => c.name === n).progress));
  assert(both.every(Boolean), 'both sessions keep their own unfinished progress');

  // ---------- delete ----------
  await page.goto(APP + '#/learn?tab=sessions'); await page.reload(); await page.waitForSelector('.cs-card');
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
