/* The roadmap through the real UI: node tests/ui/roadmap.ui.js */
const { check, withBrowser, openPage, summary, startServer } = require('./lib');
const { playLesson } = require('./solver');

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

(async () => {
  const s = await startServer({ roadmap: true });
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport);
    page.setDefaultTimeout(20000);
    await page.goto(s.base + '/register'); await page.waitForSelector('form');
    await page.fill('input[name=displayName]', 'Rustam'); await page.fill('input[name=email]', 'rustam@example.com'); await page.fill('input[name=password]', 'Passw0rd1'); await page.click('button[type=submit]');
    await page.waitForSelector('.welcome');
    await page.click('button:has-text("Choose my level")'); await page.click('.level-option[data-level="C2"]'); await page.click('button:has-text("Start with this level")');
    await page.waitForSelector('.roadmap-card');

    /* ---------- dashboard ---------- */
    check((await page.locator('.level-strip li').count()) === 6, 'the dashboard shows all six roadmap levels');
    check((await page.locator('.level-strip li.ls-current').count()) === 1 && (await page.locator('.level-strip li.ls-current .ls-code').innerText()) === 'A1', 'A1 is the current level');
    check((await page.locator('.level-strip li.ls-soon, .level-strip li.ls-locked').count()) === 5, 'every other level is locked, even after choosing C2 by hand');
    check((await page.locator('.roadmap-card .skill-row').count()) === 4, 'four skill indicators');
    check(/80%/.test(await page.locator('.roadmap-card').innerText()), 'the dashboard states the 80% pass mark');

    /* ---------- path ---------- */
    await page.click('a[data-nav=learn]'); await page.waitForSelector('.path');
    check((await page.locator('.level-tab').count()) === 6, 'six level tabs');
    check((await page.locator('.level-tab[aria-disabled="true"]').count()) === 5, 'five are locked');
    check(await page.locator('.level-head').isVisible(), 'the level header explains the rules');
    check((await page.locator('.node.kind-exam').count()) === 1 && (await page.locator('.node.kind-topic_test').count()) === 10, 'the exam and ten topic tests are marked on the path');
    await page.click('.level-tab[aria-disabled="true"] >> nth=0', { force: true }); await page.waitForSelector('.notice');
    check(/examination/i.test(await page.locator('.notice').first().innerText()) || /prepared/i.test(await page.locator('.notice').first().innerText()), 'a locked level says why');
    await page.click('.level-tab >> nth=0');

    /* ---------- a lesson: study page, then exercises ---------- */
    await page.click('.node.current'); await page.click('dialog .btn:not(.secondary)');
    await page.waitForSelector('.study');
    check(/objective/i.test(await page.locator('.study').innerText()) && (await page.locator('.study-examples li').count()) >= 4 && (await page.locator('.study-vocab li').count()) >= 6, 'the study page shows the objective, examples and new words');
    check(!(await overflow(page)), 'the study page fits the screen');
    const played = await playLesson(page, s.db, { max: 40 });
    await page.waitForSelector('.result');
    check(played.seen.includes('writing') && played.seen.includes('speaking') && played.seen.includes('listen_choice') && played.seen.includes('reading'), 'the lesson mixed writing, speaking, listening and reading (' + [...new Set(played.seen)].join(',') + ')');
    await page.click('.result a.btn'); await page.waitForSelector('.path');
    check((await page.locator('.node.completed').count()) === 1, 'the finished lesson is marked as completed');

    /* ---------- examination (all lessons done by the test's own shortcut) ---------- */
    const uid = s.db.get("SELECT id FROM users WHERE email = 'rustam@example.com'").id, t = new Date().toISOString();
    for (const l of s.db.all("SELECT id FROM lessons WHERE kind != 'exam' AND unit_id IN (SELECT u.id FROM units u JOIN levels v ON v.id = u.level_id WHERE v.code = 'A1' AND v.course_id = (SELECT id FROM courses WHERE slug = 'lexio-roadmap'))")) s.db.run('INSERT OR IGNORE INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) VALUES (?,?,1,100,?,?)', uid, l.id, t, t);
    await page.reload(); await page.waitForSelector('.path');
    check((await page.locator('.node.kind-exam.current, .node.kind-exam:not(.locked)').count()) === 1, 'the exam opens once all lessons are done');
    await page.click('.node.kind-exam'); await page.click('dialog .btn:not(.secondary)');
    await page.waitForSelector('.study'); check(/Level examination/i.test(await page.locator('.study .eyebrow').innerText()), 'the exam starts with its rules');
    // first try: wrong on purpose
    await playLesson(page, s.db, { wrongEvery: 2, max: 60 });
    await page.waitForSelector('.exam-result');
    check(await page.locator('.exam-result.failed').isVisible() && /Not passed/i.test(await page.locator('.exam-result h1').innerText()), 'a failed examination says so');
    check(/80%/.test(await page.locator('.exam-result').innerText()) && (await page.locator('.exam-result .skill-row').count()) >= 4, 'it shows the pass mark and results by skill');
    check((await page.locator('.exam-result .review-list li').count()) > 5, 'and the mistakes with the right answers');
    check(await page.locator('button:has-text("Retake the examination")').isVisible(), 'it offers a retake');
    check((await page.locator('.level-strip').count()) === 0, 'no new level was opened');
    await page.click('button:has-text("Retake the examination")'); await page.waitForSelector('.study');
    await playLesson(page, s.db, { max: 60 });
    await page.waitForSelector('.exam-result.passed');
    await page.waitForFunction(() => /100%/.test((document.querySelector('.exam-result .big-score') || {}).textContent || ''));
    check(/passed/i.test(await page.locator('.exam-result h1').innerText()), 'a passed examination celebrates the score (100%)');
    await page.click('.exam-result a.btn'); await page.waitForSelector('.path');
    check((await page.locator('.level-tab >> nth=0').innerText()).length > 0 && (await page.locator('.level-head .chip.ok').count()) === 1, 'level A1 is shown as completed');
    check(s.db.get('SELECT COUNT(*) n FROM exam_results WHERE user_id = ?', uid).n === 2, 'both results were saved');

    /* ---------- IELTS center ---------- */
    await page.goto(s.base + '/ielts'); await page.waitForSelector('.ielts-list');
    check((await page.locator('section.card').count()) === 6 && /not official/i.test(await page.locator('.notice').first().innerText()), 'the IELTS center lists six sections and says its bands are estimates');
    await page.locator('.ielts-lesson:has-text("Listening practice test 1") .btn').click(); await page.waitForSelector('.study');
    await playLesson(page, s.db, { max: 40 });
    await page.waitForSelector('.exam-result');
    check(/Estimated band: 9/.test(await page.locator('.band-estimate').innerText()), 'a practice test shows an estimated band');
    await page.click('.exam-result a.btn'); await page.waitForSelector('.ielts-list');
    check(/9\.0/.test(await page.locator('.stat-row').first().innerText()), 'the best band is kept on the center page');
    check(page.problems.length === 0, 'no console errors or failed requests (' + page.problems.slice(0, 3).join(' | ') + ')');

    /* ---------- phone ---------- */
    const m = await openPage(browser, { width: 390, height: 780 }); m.setDefaultTimeout(20000);
    await m.goto(s.base + '/login'); await m.fill('input[name=email]', 'rustam@example.com'); await m.fill('input[name=password]', 'Passw0rd1'); await m.click('button[type=submit]'); await m.waitForSelector('.roadmap-card');
    check(!(await overflow(m)), 'the dashboard fits a phone');
    await m.goto(s.base + '/learn'); await m.waitForSelector('.path'); check(!(await overflow(m)), 'the path fits a phone');
    await m.goto(s.base + '/ielts'); await m.waitForSelector('.ielts-list'); check(!(await overflow(m)), 'the IELTS center fits a phone');
    check(m.problems.length === 0, 'no errors on the phone (' + m.problems.slice(0, 2).join(' | ') + ')');
  });
  await s.stop();
  summary('roadmap UI');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
