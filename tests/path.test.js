/* Browser tests for the learning path, the new home page, navigation and the default Uzbek interface: node tests/path.test.js */
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

  // ---------- the interface is Uzbek by default ----------
  const real = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' })).newPage();
  await real.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  await real.goto(APP + '?nosplash#/dashboard'); await real.waitForSelector('.home-hero');
  const navText = await real.locator('#nav').innerText();
  assert(['Bosh sahifa', "O'rganish xaritasi", "Lug'at mavzulari", "Mening lug'atlarim", 'Statistika', 'Profil va sozlamalar'].every((x) => navText.includes(x)), 'default language is Uzbek: ' + navText.split('\n').slice(0, 4).join(' | '));
  assert((await real.locator('.home-hero').innerText()).includes("O'rganishni boshlash") || (await real.locator('.home-hero').innerText()).includes("O'rganishni davom ettirish"), 'home page: main "continue" button in Uzbek');
  await real.close();

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(APP + '#/path'); await page.waitForSelector('.plevel');
  await page.selectOption('#lang-select', 'uz'); await wait(page);

  // ---------- map ----------
  assert((await page.locator('.plevel').count()) === 6, 'six levels (A1, A2, B1, B2, C1, IELTS)');
  assert((await page.locator('.plevel.closed').count()) === 5 && (await page.locator('.plevel.active').innerText()).includes('A1'), 'A1 is open, the other five levels are locked');
  const struct = await page.evaluate(() => { const b = VL.path.build(); return b.levels.map((l) => [l.id, l.units.length, l.units.reduce((a, u) => a + u.lessons.length, 0)]); });
  assert(struct.every((s) => s[1] > 0 && s[2] > 0), 'every level has units and lessons: ' + struct.map((s) => s.join(':')).join(' '));
  const unit = await page.evaluate(() => { const u = VL.path.build().levels[0].units.find((x) => x.lessons.length >= 2); return { id: u.id, first: u.lessons[0].id, second: u.lessons[1].id, words: u.lessons[0].rows.length }; });
  assert((await page.locator('[data-lesson="' + unit.first + '"]').getAttribute('class')).includes('pnode-available'), 'first lesson of a unit is ready to start');
  assert((await page.locator('[data-lesson="' + unit.second + '"]').getAttribute('class')).includes('pnode-locked'), 'second lesson is locked');
  await page.locator('[data-lesson="' + unit.second + '"]').click(); await wait(page, 300);
  assert((await page.locator('dialog[open]').count()) === 0 && (await page.locator('.toast').count()) > 0, 'a locked lesson does not open; a message appears');

  // ---------- start a lesson ----------
  await page.locator('[data-lesson="' + unit.first + '"]').click(); await page.waitForSelector('dialog[open] .word-list');
  assert((await page.locator('dialog[open] .word-list li').count()) === unit.words, 'the lesson dialog lists its ' + unit.words + ' words');
  await page.click('dialog[open] .modal-foot .btn-primary'); await page.waitForSelector('.lesson');
  const plan = await page.evaluate(() => VL.store.state.lesson.items.map((i) => i.type));
  assert(plan.filter((x) => x === 'study').length === unit.words && plan[0] === 'study' && plan[plan.length - 1] === 'match', 'translation card for every word first, matching at the end (' + plan.join(',') + ')');
  assert(new Set(plan.filter((x) => x !== 'study')).size >= 4, 'different kinds of exercises (' + Array.from(new Set(plan)).join(',') + ')');
  assert((await page.evaluate(() => VL.store.state.lesson.pathLesson)) === unit.first, 'the lesson state remembers which lesson it is');
  const r1 = await playLesson(page, { wrongEvery: 0, maxSteps: 60 });
  await page.waitForSelector('.summary');
  assert(r1.mismatches.length === 0, 'all exercise kinds judged correctly: ' + JSON.stringify(r1.seen));
  const rec = await page.evaluate((id) => VL.store.state.path.lessons[id], unit.first);
  assert(rec && rec.done && rec.best === 100 && rec.runs === 1, 'result saved: done, 100%, one run');
  assert((await page.locator('[data-action="path-next"]').count()) === 1 && (await page.locator('.path-banner').innerText()).length > 0, 'results offer "Davom ettirish" and a pass message');
  const xp1 = await page.evaluate(() => VL.store.state.days.reduce((a, d) => a + d.xp, 0));
  assert(xp1 > 0, 'XP earned from real answers (' + xp1 + ')');

  // ---------- next lesson opened ----------
  await page.click('[data-action="hub"]'); await page.waitForSelector('.plevel');
  assert((await page.locator('[data-lesson="' + unit.first + '"]').getAttribute('class')).includes('pnode-done'), 'finished lesson shows as done');
  assert((await page.locator('[data-lesson="' + unit.second + '"]').getAttribute('class')).includes('pnode-available'), 'the next lesson opened');

  // ---------- reload: progress is kept, XP is not given again ----------
  await page.reload(); await page.waitForSelector('.plevel');
  const xp2 = await page.evaluate(() => VL.store.state.days.reduce((a, d) => a + d.xp, 0));
  assert(xp2 === xp1, 'reloading does not change XP (' + xp2 + ')');
  assert((await page.locator('[data-lesson="' + unit.first + '"]').getAttribute('class')).includes('pnode-done'), 'progress survives a reload');

  // ---------- failing a lesson does not finish it ----------
  await page.locator('[data-lesson="' + unit.second + '"]').click(); await page.waitForSelector('dialog[open] .word-list');
  await page.click('dialog[open] .modal-foot .btn-primary'); await page.waitForSelector('.lesson');
  await playLesson(page, { wrongEvery: 1, maxSteps: 80 });
  await page.waitForSelector('.summary');
  const rec2 = await page.evaluate((id) => VL.store.state.path.lessons[id], unit.second);
  assert(rec2 && !rec2.done && rec2.lastPct < 60, 'a lesson answered badly is not finished (' + (rec2 && rec2.lastPct) + '%)');
  assert((await page.locator('.path-banner.warn').count()) === 1 && (await page.locator('[data-action="path-again"]').count()) === 1, 'results show a warning and "try again"');
  await page.evaluate(() => VL.store.saveLesson(null));

  // ---------- needs review ----------
  await page.evaluate((id) => { VL.store.state.words.forEach((w) => { if (VL.path.build().lessonsById[id].rows.some((r) => r[0] === w.en)) { w.due = 1; w.box = 1; w.reps = 1; } }); VL.store.setSetting('x', 1); }, unit.first);
  await page.goto(APP + '#/learn'); await page.goto(APP + '#/path'); await page.waitForSelector('.plevel');
  assert((await page.locator('[data-lesson="' + unit.first + '"]').getAttribute('class')).includes('pnode-review'), 'a finished lesson whose words are due again needs review');

  // ---------- level unlock (40%) and free mode ----------
  await page.evaluate(() => { const b = VL.path.build(); const ids = [].concat(...b.levels[0].units.map((u) => u.lessons)).map((l) => l.id); const need = Math.ceil(ids.length * 0.4); ids.slice(0, need).forEach((id) => { VL.store.state.path.lessons[id] = { done: true, best: 90, runs: 1, last: Date.now(), lastPct: 90 }; }); });
  await page.evaluate(() => VL.store.setSetting('x', 2));
  await page.goto(APP + '#/learn'); await page.goto(APP + '#/path'); await page.waitForSelector('.plevel');
  assert((await page.locator('.plevel.closed').count()) === 4, 'A2 opens when 40% of A1 is finished (still locked: B1, B2, C1, IELTS)');
  await page.evaluate(() => VL.store.setSetting('freePath', true));
  await page.goto(APP + '#/learn'); await page.goto(APP + '#/path'); await page.waitForSelector('.plevel');
  assert((await page.locator('.plevel.closed').count()) === 0 && (await page.locator('.pnode.pnode-locked').count()) === 0, 'free practice mode opens everything');
  await page.evaluate(() => VL.store.setSetting('freePath', false));

  // ---------- home page: continue a paused lesson ----------
  await page.evaluate(() => { VL.store.state.path.lessons = {}; return VL.store.setSetting('x', 3); });
  await page.goto(APP + '#/path'); await page.waitForSelector('.plevel');
  await page.click('[data-action="path-go"]'); await page.waitForSelector('.lesson');
  await playLesson(page, { wrongEvery: 0, stopAfter: 2, maxSteps: 20 });
  const idxBefore = await page.evaluate(() => VL.store.state.lesson.index);
  await page.goto(APP + '#/dashboard'); await page.waitForSelector('.home-hero');
  assert((await page.locator('.home-next').innerText()).length > 0, 'home page shows what is paused / next');
  await page.click('[data-action="continue"]'); await page.waitForSelector('.lesson');
  assert((await page.evaluate(() => VL.store.state.lesson.index)) === idxBefore, 'the big button resumes the paused lesson where it stopped (step ' + idxBefore + ')');
  const home = await (async () => { await page.evaluate(() => VL.store.saveLesson(null)); await page.goto(APP + '#/learn'); await page.goto(APP + '#/dashboard'); await page.waitForSelector('.home-hero'); return page.locator('.home-main').innerText(); })();
  assert(/XP/.test(home) && (await page.locator('.hstat').count()) === 4 && (await page.locator('.week-col').count()) === 7 && (await page.locator('.goal-ring').count()) === 1, 'home page: streak, XP, learned words, overall %, goal ring and a 7-day chart');
  assert((await page.locator('.home-hero [data-action="new-session"]').count()) === 1 && (await page.locator('.home-hero a[href="#/topics"]').count()) === 1 && (await page.locator('.home-hero a[href="#/difficult"]').count()) === 1, 'home page: new session, topics and mistakes buttons');
  await page.click('.home-hero [data-action="new-session"]'); await page.waitForSelector('#cs-name');
  await page.click('.modal-foot .btn-ghost'); await wait(page, 300);

  // ---------- settings: name and free mode ----------
  await page.goto(APP + '#/settings'); await page.waitForSelector('#set-name');
  await page.fill('#set-name', 'Dilnoza'); await page.press('#set-name', 'Tab'); await wait(page, 300);
  await page.goto(APP + '#/dashboard'); await page.waitForSelector('.home-hero');
  assert((await page.locator('.home-hero h1').innerText()).includes('Dilnoza'), 'the profile name is shown on the home page');

  // ---------- phone: bottom bar and no horizontal scroll ----------
  await page.setViewportSize({ width: 375, height: 760 }); await wait(page);
  for (const h of ['#/dashboard', '#/path', '#/topics', '#/vocabulary', '#/settings']) {
    await page.goto(APP + h); await wait(page, 400);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375px: ' + h);
  }
  const vis = await page.locator('#nav a').evaluateAll((a) => a.filter((x) => x.offsetParent).length);
  assert(vis === 4 && (await page.locator('#nav-more').isVisible()), 'phone: bottom bar shows 4 main pages and "Yana"');
  await page.click('#nav-more'); await wait(page, 200);
  assert((await page.locator('#nav a').evaluateAll((a) => a.filter((x) => x.offsetParent).length)) === 9, 'phone: "Yana" shows the other pages');
  await page.click('#nav a[data-route="progress"]'); await wait(page, 300);
  assert(page.url().includes('#/progress') && (await page.locator('#nav.more-open').count()) === 0, 'phone: choosing a page closes the menu');
  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
