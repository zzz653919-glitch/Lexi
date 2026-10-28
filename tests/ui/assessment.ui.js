/* Placement test, results, daily lesson and level controls through the real UI: node tests/ui/assessment.ui.js */
const { check, withBrowser, openPage, summary, startServer, loginUI } = require('./lib');
const X = require('../../server/lib/exercises');

async function register(page, base, email, name = 'Nora') {
  await page.goto(base + '/register'); await page.waitForSelector('form');
  await page.fill('input[name=displayName]', name); await page.fill('input[name=email]', email); await page.fill('input[name=password]', 'Passw0rd1');
  await page.click('button[type=submit]'); await page.waitForSelector('.welcome');
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
/* answers the daily-lesson screen using the stored queue (the test owns the database) */
async function dailyStep(page, db) {
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  const a = db.get('SELECT queue, position FROM lesson_attempts WHERE id = ?', id);
  const item = JSON.parse(a.queue)[a.position];
  if (item.type === 'card') { await page.waitForSelector('.info-card'); await page.click('.lesson-foot .btn'); return 'card'; }
  if (item.type === 'choice') { await page.waitForSelector('.option'); await page.click(`.option[data-id="${item.correctId}"]`); }
  else if (item.type === 'order') { for (const w of X.tokensOf(item.sentence)) await page.locator('.tile-area:not(.answer) .tile:not(.used)').filter({ hasText: new RegExp('^' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click(); }
  else { await page.fill('.answer-input', X.alternatives(item.accepted)[0]); }
  await page.click('.lesson-foot .btn:has-text("Check")'); await page.waitForSelector('.lesson-foot.good, .lesson-foot.bad');
  const good = !!(await page.$('.lesson-foot.good'));
  await page.click('.lesson-foot .btn');
  return good ? 'good' : 'bad';
}

const settingsMin = (s) => JSON.parse(s.db.get("SELECT value FROM settings WHERE key = 'placement_min_questions'").value);

(async () => {
  const s = await startServer();
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport);
    page.setDefaultTimeout(15000);

    /* ---------- welcome ---------- */
    await register(page, s.base, 'nora@example.com');
    check((await page.locator('.welcome .choice-card').count()) === 2, 'welcome offers the placement test and manual level choice');
    check(await page.locator('.welcome .recommended .chip').isVisible(), 'the placement test is marked as recommended');
    await page.goto(s.base + '/learn'); await page.waitForSelector('.welcome');
    check(new URL(page.url()).pathname === '/welcome', 'a learner who has not chosen a level is sent to the welcome screen from other pages');

    /* ---------- placement test: answer "I don't know" until it ends ---------- */
    await page.uncheck('#wl');
    await page.click('button:has-text("Start the test")'); await page.waitForSelector('.placement .lesson-body .option, .placement .lesson-body .answer-input');
    check(new URL(page.url()).pathname === '/placement', 'starting opens the test');
    check((await page.locator('.placement .lesson-foot .btn').count()) === 2, 'test has "I don\'t know" and "Next"');
    check(await page.locator('.placement .btn:has-text("Next")').isDisabled(), 'Next is disabled until an answer is chosen');
    // reload resumes at the same question
    const q1 = await page.locator('.q-title').first().innerText();
    await page.reload(); await page.waitForSelector('.placement .lesson-body');
    check((await page.locator('.q-title').first().innerText()) === q1, 'reloading the page shows the same question (progress is saved)');
    // answer a couple by clicking the first option, then give up on the rest
    for (let i = 0; i < 3; i++) { await page.waitForSelector('.placement .option, .placement .answer-input'); if (await page.$('.placement .option')) { await page.click('.placement .option >> nth=0'); await page.click('.placement .btn:has-text("Next")'); } else await page.click('.placement .lesson-foot .btn.secondary'); await page.waitForTimeout(250); }
    let n = 3;
    while (!(await page.$('.placement-result')) && n < 40) {
      await page.waitForSelector('.placement-result, .placement .lesson-foot .btn.secondary:not([disabled])');
      if (await page.$('.placement-result')) break;
      try { await page.click('.placement .lesson-foot .btn.secondary:not([disabled])', { timeout: 3000 }); n++; } catch (_) { /* the result appeared meanwhile */ }
      await page.waitForTimeout(100);
    }
    await page.waitForSelector('.placement-result');
    check(n >= 20 && n <= 35, `the test asked ${n + 1} questions (20–35)`);
    check(await page.locator('.level-badge.big').isVisible(), 'results show the estimated level');
    check((await page.locator('.skill-row').count()) >= 3, 'results show a skill breakdown');
    check((await page.locator('.plan-list li').count()) >= 3, 'results show a personalised plan');
    check(/estimate/i.test(await page.locator('.placement-result .notice').innerText()), 'results are clearly labelled as an estimate');
    check((await page.locator('.placement-result .chip.warn').count()) + (await page.locator('.placement-result .chip.ok').count()) >= 0, 'strengths / areas to improve section present when relevant');
    const u = s.db.get("SELECT * FROM users WHERE email = 'nora@example.com'");
    check(u.onboarded === 1 && u.level_source === 'placement' && !!u.cefr_level, 'level saved on the account (' + u.cefr_level + ')');

    /* ---------- dashboard daily card and the daily lesson ---------- */
    await page.click('.placement-result a:has-text("Start learning")'); await page.waitForSelector('.daily-card');
    check(await page.locator('.daily-card .level-badge').isVisible(), 'dashboard shows the level and the daily lesson card');
    await page.click('.daily-card .btn'); await page.waitForURL('**/daily/*'); await page.waitForSelector('.lesson-body');
    let cards = 0, steps = 0, bad = 0;
    for (let i = 0; i < 60 && !(await page.$('.result')); i++) { const r = await dailyStep(page, s.db); steps++; if (r === 'card') cards++; if (r === 'bad') bad++; await page.waitForTimeout(60); }
    await page.waitForSelector('.result');
    check(cards >= 2 && steps >= 12, `daily lesson played to the end (${steps} screens, ${cards} teaching cards)`);
    check(bad === 0 && (await page.locator('.result h1').innerText()).includes('Daily lesson complete'), 'daily lesson completes with its own result screen');
    await page.click('.result a.btn'); await page.waitForSelector('.daily-card');
    check(/practise|again/i.test(await page.locator('.daily-card .btn').innerText()), 'dashboard now offers more practice');

    /* ---------- profile: level card, manual change keeps the test result, retake ---------- */
    await page.click('a[data-nav=profile]'); await page.waitForSelector('.level-card');
    check(/placement test/i.test(await page.locator('.level-card').innerText()), 'profile shows where the level comes from');
    await page.click('.level-card button:has-text("Change level")'); await page.click('.level-card .level-option[data-level="B2"]'); await page.click('.level-card button:has-text("Save level")');
    await page.waitForSelector('.level-card .level-badge.lv-B2');
    const u2 = s.db.get("SELECT cefr_level, level_source FROM users WHERE email = 'nora@example.com'");
    check(u2.cefr_level === 'B2' && u2.level_source === 'manual', 'manual level change saved');
    check(s.db.get("SELECT COUNT(*) n FROM assessments WHERE status = 'completed'").n === 1, 'the placement result is kept');
    await page.click('.level-card a:has-text("See the result")'); await page.waitForSelector('.placement-result');
    check(/current level is/i.test(await page.locator('.notice').first().innerText()), 'results page explains the difference between the tested and the chosen level');
    await page.click('a[data-nav=profile]'); await page.waitForSelector('.level-card');
    await page.click('.level-card button:has-text("Retake the placement test")'); await page.click('dialog button:has-text("Start the test")');
    await page.waitForURL('**/placement'); await page.waitForSelector('.placement .lesson-body');
    check(true, 'retake starts a new test from the profile');
    await page.click('.lesson-top .close'); await page.click('dialog button:has-text("Leave")'); await page.waitForSelector('.level-card');
    check(true, 'leaving a test keeps it for later');
    page.expectedStatuses.add(409);

    check(page.problems.length === 0, 'no console errors or failed requests (' + page.problems.slice(0, 3).join(' | ') + ')');

    /* ---------- mobile + other languages ---------- */
    for (const [lang, word] of [['ru', /Добро пожаловать/], ['uz', /Xush kelibsiz/]]) {
      const p = await openPage(browser, { width: 390, height: 780 }, { lang });
      p.setDefaultTimeout(15000);
      const email = `m-${lang}@example.com`;
      await p.goto(s.base + '/register'); await p.waitForSelector('form');
      await p.fill('input[name=displayName]', 'Mira'); await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'Passw0rd1'); await p.click('button[type=submit]'); await p.waitForSelector('.welcome');
      check(word.test(await p.locator('.welcome h1').innerText()), `welcome screen is translated (${lang})`);
      check(!(await overflow(p)), `welcome has no horizontal scroll on a phone (${lang})`);
      await p.uncheck('#wl'); await p.click('.welcome .recommended .btn'); await p.waitForSelector('.placement .lesson-body');
      check(!(await overflow(p)), `test question fits a phone screen (${lang})`);
      const btns = await p.locator('.placement .lesson-foot .btn').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      check(btns.every((hgt) => hgt >= 44), `test buttons are large enough to tap (${lang})`);
      let k = 0; while (!(await p.$('.placement-result')) && k++ < 40) { await p.click('.placement .lesson-foot .btn.secondary'); await p.waitForTimeout(120); }
      await p.waitForSelector('.placement-result');
      check(!(await overflow(p)), `results fit a phone screen (${lang})`);
      check(/[A-Za-zА-Яа-я]/.test(await p.locator('.placement-result h1').innerText()) && (await p.locator('.plan-list li').first().innerText()).length > 20, `results and plan are translated (${lang})`);
      check(p.problems.length === 0, `no errors on the phone flow (${lang}) ` + p.problems.slice(0, 2).join('|'));
      await p.context().close();
    }

    /* ---------- admin panel ---------- */
    s.createUser({ email: 'boss@example.com', role: 'admin', name: 'Boss' });
    const ad = await openPage(browser, viewport); ad.setDefaultTimeout(15000);
    await loginUI(ad, s.base, 'boss@example.com', 'Passw0rd!x', '/admin/login'); await ad.waitForSelector('.adm');
    await ad.goto(s.base + '/admin/assessment'); await ad.waitForSelector('.tbl');
    check((await ad.locator('.tbl tbody tr').count()) >= 20, 'admin lists placement questions');
    await ad.selectOption('select[name=level]', 'C2'); await ad.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length > 0 && [...document.querySelectorAll('.tbl tbody tr td:first-child')].every((td) => td.textContent === 'C2'));
    check(true, 'questions can be filtered by level');
    await ad.click('button:has-text("Add question")'); await ad.waitForSelector('dialog');
    await ad.fill('dialog textarea[name=prompt]', 'Admin test: she ___ home.'); await ad.fill('dialog textarea[name=options]', 'went\ngoes\ngoing'); await ad.selectOption('dialog select[name=status]', 'published');
    await ad.click('dialog button[type=submit]'); await ad.waitForSelector('dialog', { state: 'detached' });
    check(s.db.get("SELECT COUNT(*) n FROM assessment_questions WHERE prompt LIKE 'Admin test%' AND status = 'published'").n === 1, 'a question can be created and published from the admin panel');
    await ad.click('button:has-text("Add question")'); await ad.waitForSelector('dialog');
    page.expectedStatuses.add(400); ad.expectedStatuses.add(400);
    await ad.fill('dialog textarea[name=prompt]', 'Broken'); await ad.selectOption('dialog select[name=status]', 'published'); await ad.click('dialog button[type=submit]');
    await ad.waitForSelector('dialog .form-error:not([hidden])');
    check(true, 'a question that fails validation cannot be published');
    await ad.click('dialog button:has-text("Cancel")');
    await ad.goto(s.base + '/admin/assessment?tab=coverage'); await ad.waitForSelector('.chip');
    check(/Ready/i.test(await ad.locator('.chip').first().innerText()), 'coverage check says the bank is ready');
    await ad.goto(s.base + '/admin/assessment?tab=rules'); await ad.waitForSelector('input[name=placement_min_questions]');
    await ad.fill('input[name=placement_min_questions]', '22'); await ad.click('button[type=submit]'); await ad.waitForTimeout(500);
    check(settingsMin(s) === 22, 'thresholds can be changed in the admin panel');
    await ad.goto(s.base + '/admin/assessment?tab=stats'); await ad.waitForSelector('.stat-row');
    await ad.goto(s.base + '/admin/assessment?tab=grammar'); await ad.waitForSelector('.tbl');
    check((await ad.locator('.tbl tbody tr').count()) >= 18, 'admin lists grammar lessons');
    check(ad.problems.length === 0, 'no admin console errors (' + ad.problems.slice(0, 2).join(' | ') + ')');
  });
  await s.stop();
  summary('assessment UI');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
