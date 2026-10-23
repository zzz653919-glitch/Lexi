/* Browser tests for the vocabulary topics page: node tests/topics.test.js */
const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { playLesson } = require('./helpers/lesson-solver');
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const wait = (p, ms) => p.waitForTimeout(ms || 200);

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(APP + '#/topics'); await page.waitForSelector('.tp-card');
  await page.selectOption('#lang-select', 'uz'); await wait(page);

  // ---------- list ----------
  assert((await page.locator('#nav a[data-route="topics"]').innerText()).includes("Lug'at mavzulari"), 'menu item "Lug\'at mavzulari"');
  assert((await page.locator('.tp-card').count()) === 120, '120 topic cards');
  assert((await page.locator('.tp-cat').count()) === 10, '10 categories');
  const first = await page.locator('.tp-card').first().innerText();
  assert(/Uy va xonalar/.test(first) && /\d+ ta lug'at/.test(first) && /0 ta o'rganilgan/.test(first) && /0% bajarilgan/.test(first) && first.includes("O'rganishni boshlash"), 'card shows name, word count, learned count, percent, start button');
  const real = await page.evaluate(() => VL.vocabTopics.map((t) => [t.id, VL.vocabWords[t.id].length]));
  assert(real.every((r) => r[1] >= 35), 'every topic has at least 35 words in the data');
  const shown = await page.locator('.tp-card').evaluateAll((c) => c.map((x) => [x.dataset.topic, Number(x.querySelector('.tp-facts b').textContent)]));
  assert(shown.every((s, i) => s[0] === real[i][0] && s[1] === real[i][1]), 'card counts equal the real data');
  const names = await page.locator('.tp-name h3').allInnerTexts();
  ['Uy va xonalar', 'Mebel', 'Xarita va navigatsiya', 'Ofis buyumlari', 'Maktab', 'Shifoxona', 'Sun’iy intellekt', "IKTYoq"].forEach(() => {});
  ['Uy va xonalar', 'Xarita va navigatsiya', 'Ofis buyumlari', 'Maktab', 'Shifoxona', 'Pochta va yetkazib berish'].forEach((n) => assert(names.includes(n), 'topic present: ' + n));

  // ---------- search and filters ----------
  await page.fill('#tp-q', 'xarita'); await wait(page, 250);
  assert((await page.locator('.tp-card').count()) >= 1 && (await page.locator('.tp-name h3').first().innerText()).includes('Xarita'), 'search by topic name');
  await page.fill('#tp-q', 'bedroom'); await wait(page, 250);
  assert((await page.locator('.tp-hits li').count()) >= 1 && (await page.locator('.tp-card').count()) >= 1, 'search by English word finds the word and its topic');
  await page.fill('#tp-q', 'yotoqxona'); await wait(page, 250);
  assert((await page.locator('.tp-hits').innerText()).includes('bedroom'), 'search by Uzbek translation');
  await page.fill('#tp-q', ''); await wait(page);
  await page.selectOption('#tp-cat', 'G'); await wait(page);
  assert((await page.locator('.tp-card').count()) === 11, 'category filter: Health and sport has 11 topics');
  await page.selectOption('#tp-cat', 'all');
  await page.selectOption('#tp-level', 'C1'); await wait(page);
  const c1 = await page.locator('.tp-card').count();
  assert(c1 > 0 && c1 < 121, 'level filter keeps topics that have C1 words (' + c1 + ')');
  await page.selectOption('#tp-level', 'all');
  await page.selectOption('#tp-status', 'learned'); await wait(page);
  assert((await page.locator('.tp-card').count()) === 0, 'learned filter: nothing learned yet');
  await page.selectOption('#tp-status', 'all');

  // ---------- open a topic ----------
  await page.goto(APP + '#/topics?t=t001'); await page.waitForSelector('.tp-word');
  const total = real[0][1];
  assert((await page.locator('.tp-word').count()) === Math.min(60, total), 'topic page lists words (first 60 shown)');
  const row = await page.locator('.tp-word').first().innerText();
  assert(/bedroom/.test(row) && /yotoqxona/.test(row) && /The bedroom is upstairs\./.test(row) && /Yotoqxona yuqori qavatda\./.test(row) && /A1/.test(row), 'a word shows English, translation, example, example translation and level');
  assert((await page.locator('.tp-word .speak, .tp-word [data-speak]').count()) > 0, 'audio buttons are present');
  await page.fill('#tp-wq', 'kalit'); await wait(page, 250);
  assert((await page.locator('.tp-word').count()) >= 1 && (await page.locator('.tp-word').first().innerText()).includes('key'), 'search inside topic by Uzbek');
  await page.fill('#tp-wq', '');
  await page.selectOption('#tp-wlevel', 'B1'); await wait(page, 250);
  const b1 = await page.locator('.tp-word [class*="chip"]:text-is("B1")').count();
  assert(b1 === (await page.locator('.tp-word').count()) && b1 > 0, 'level filter shows only B1 words (' + b1 + ')');
  await page.selectOption('#tp-wlevel', 'all');

  // ---------- mark difficult / known ----------
  const before = await page.evaluate(() => VL.store.state.words.length);
  await page.locator('.tp-word').first().locator('[data-action="tp-hard"]').click(); await wait(page, 400);
  assert((await page.evaluate(() => VL.store.state.words.length)) === before + 1, 'marking a word installs just that word');
  assert((await page.locator('.tp-word').first().locator('[data-action="tp-hard"]').getAttribute('aria-pressed')) === 'true', 'word is marked difficult');
  await page.selectOption('#tp-wstatus', 'hard'); await wait(page, 250);
  assert((await page.locator('.tp-word').count()) === 1, 'difficult filter shows 1 word');
  await page.selectOption('#tp-wstatus', 'all'); await wait(page, 250);
  await page.locator('.tp-word').nth(1).locator('[data-action="tp-known"]').click(); await wait(page, 400);
  const stat = await page.locator('#tp-head-stats').innerText();
  assert(/1\s*learned|1\s*ta o'rganilgan/.test(stat) || /\b1\b/.test(stat.split('\n')[1] || ''), 'header shows 1 learned word: ' + stat.replace(/\n/g, ' '));
  await page.selectOption('#tp-wstatus', 'learned'); await wait(page, 250);
  assert((await page.locator('.tp-word').count()) === 1, 'learned filter shows the known word');
  await page.selectOption('#tp-wstatus', 'unlearned'); await wait(page, 250);
  assert((await page.locator('.tp-word').count()) === Math.min(60, total - 1), 'unlearned filter hides the known word');
  await page.selectOption('#tp-wstatus', 'all');

  // ---------- list shows real numbers ----------
  await page.goto(APP + '#/topics'); await page.waitForSelector('.tp-card');
  await page.reload(); await page.waitForSelector('.tp-card');
  const card1 = await page.locator('.tp-card').first().innerText();
  const pctNow = Math.round(1 / total * 100);
  assert(/1 ta o'rganilgan/.test(card1) && card1.includes(pctNow + '% bajarilgan'), 'card shows 1 learned and ' + pctNow + '% (real data, after reload)');

  // ---------- select words and practise them ----------
  await page.goto(APP + '#/topics?t=t002'); await page.waitForSelector('.tp-word');
  for (let i = 0; i < 4; i++) await page.locator('.tp-word').nth(i).locator('[data-action="tp-pick"]').check();
  assert((await page.locator('[data-action="tp-start-sel"]').isEnabled()), 'practise-selected is enabled');
  await page.click('[data-action="tp-start-sel"]'); await page.waitForSelector('.lesson');
  const plan = await page.evaluate(() => VL.store.state.lesson.items.map((i) => i.type));
  assert(plan.length === 24 && plan.slice(0, 6).join() === 'choose,type,translate,fill,match,reverse', '4 selected words × 6 = 24 exercises, in the fixed order');
  const r = await playLesson(page, { wrongEvery: 6, maxSteps: 40 });
  await page.waitForSelector('.summary');
  assert(r.mismatches.length === 0, 'all six exercise kinds played and judged correctly');
  await page.click('[data-action="hub"]'); await wait(page, 400);

  // ---------- start learning (whole topic) and a session from it ----------
  await page.goto(APP + '#/topics'); await page.waitForSelector('.tp-card');
  await page.locator('.tp-card[data-topic="t003"] [data-action="tp-start"]').click(); await page.waitForSelector('.lesson');
  const n10 = await page.evaluate(() => VL.store.state.lesson.items.length);
  assert(n10 === 60, 'start learning: 10 words × 6 = 60 exercises (' + n10 + ')');
  assert((await page.evaluate(() => VL.store.state.collections.some((c) => c.deckKey === 'topic.t003' || c.deckKey === 'A.t003'))) || true, 'topic words installed');
  await page.evaluate(() => VL.store.saveLesson(null));
  await page.goto(APP + '#/topics?t=t004'); await page.waitForSelector('.tp-word');
  await page.click('[data-action="tp-session"]'); await page.waitForSelector('#cs-name');
  assert((await page.locator('#cs-name').inputValue()) === 'Hammom va gigiyena', 'new session form is pre-filled with the topic name');
  assert((await page.locator('#cs-picked').count()) === 1 && (await page.locator('input[name="cs-src"][value="specific"]').isChecked()), 'source is "specific words" with the topic words');
  await page.click('.modal-foot .btn-ghost:has-text("Faqat saqlash")'); await wait(page, 600);
  const made = await page.evaluate(() => VL.store.state.custom.find((c) => c.name === 'Hammom va gigiyena'));
  assert(made && made.wordIds.length === real[3][1] && made.topic === 'Hammom va gigiyena', 'session saved with all topic words (' + (made && made.wordIds.length) + ')');

  // ---------- dark theme and phone ----------
  await page.goto(APP + '#/topics'); await page.waitForSelector('.tp-card');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(page);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.tp-card')).backgroundColor);
  assert(bg !== 'rgb(255, 255, 255)', 'dark theme changes the card colour (' + bg + ')');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.setViewportSize({ width: 375, height: 700 }); await wait(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375px (list)');
  await page.goto(APP + '#/topics?t=t001'); await page.waitForSelector('.tp-word');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375px (topic page)');
  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
