/* Learner journey through the real UI: node tests/ui/learner.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer } = require('./lib');
const { answer, playLesson, currentState } = require('./solver');
const A = require('../../server/lib/auth');

(async () => {
  const s = await startServer();
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport);
    page.setDefaultTimeout(15000);

    /* ---------- guests, registration, login, protected routes ---------- */
    await page.goto(s.base + '/');
    await page.waitForSelector('.landing');
    check(await page.locator('h1').first().innerText() !== '', 'landing page for guests shows the product');
    check((await page.locator('a[href="/admin"]').count()) === 0, 'no admin link on the public landing page');
    page.expectedStatuses.add(401);
    await page.goto(s.base + '/learn');
    await page.waitForURL('**/login?next=%2Flearn');
    check(true, 'a protected learner route redirects guests to the sign-in page (next=/learn)');
    await page.click('a[href="/register"]'); await page.waitForSelector('form');
    page.expectedStatuses.add(400);
    await page.click('button[type=submit]');
    await page.waitForSelector('.error-text:not([hidden])');
    check((await page.locator('.error-text:not([hidden])').count()) >= 3, 'registration shows server-side errors next to the fields');
    check(await page.locator('.form-error').isVisible(), 'and a summary message');
    await page.fill('input[name=displayName]', 'Anna'); await page.fill('input[name=email]', 'anna@example.com'); await page.fill('input[name=password]', 'weak');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#f3-password-err, [id$="-password-err"]') && !document.querySelector('[id$="-password-err"]').hidden);
    check(true, 'weak password is rejected');
    await page.fill('input[name=password]', 'Passw0rd1'); await page.selectOption('select[name=dailyGoalXp]', '20');
    await page.click('button[type=submit]');
    await page.waitForSelector('.welcome');
    check(new URL(page.url()).pathname === '/welcome', 'registering signs the learner in and opens the welcome screen');
    await page.click('button:has-text("Choose my level")'); await page.click('.level-option[data-level="A1"]'); await page.click('button:has-text("Start with this level")');
    await page.waitForSelector('.continue-card');
    await page.click('a[data-nav=learn]'); await page.waitForSelector('.path');
    check(new URL(page.url()).pathname === '/learn', 'choosing a level finishes onboarding and the learning path opens');
    const u = s.db.get("SELECT * FROM users WHERE email = 'anna@example.com'");
    check(u && u.role === 'learner' && u.daily_goal_xp === 20 && u.password_hash.startsWith('scrypt$'), 'account stored as learner with a hashed password and the chosen goal');
    check((await page.locator('.sidebar .nav a').count()) === 7, 'desktop sidebar shows the 7 learner sections');
    const labels = await page.locator('.sidebar .nav a').allInnerTexts();
    check(!labels.some((l) => /admin/i.test(l)), 'no admin navigation for learners');
    // sign out and in
    await page.click('a[data-nav=profile]'); await page.waitForSelector('text=Sign out >> nth=0');
    await page.click('button:has-text("Sign out")'); await page.click('dialog button:has-text("Sign out")');
    await page.waitForURL('**/login');
    check(true, 'sign out returns to the sign-in page');
    await page.fill('input[name=email]', 'anna@example.com'); await page.fill('input[name=password]', 'wrong-pass1'); await page.click('button[type=submit]');
    await page.waitForSelector('.form-error:not([hidden])');
    check((await page.locator('.form-error').innerText()).includes('not correct'), 'a wrong password shows a clear error');
    await page.fill('input[name=password]', 'Passw0rd1'); await page.click('button[type=submit]');
    await page.waitForSelector('.continue-card');
    check(true, 'sign in works and opens the dashboard');

    /* ---------- dashboard shows real data ---------- */
    const dash = async () => ({ goal: await page.locator('.ring').getAttribute('aria-label') });
    check((await page.locator('.continue-card h2').innerText()) === 'Greetings', 'dashboard recommends the first lesson');
    check((await page.locator('.continue-card .btn').innerText()).toLowerCase().includes('start lesson'), '"Start lesson" button on the dashboard');

    /* ---------- path -> lesson ---------- */
    await page.click('a[data-nav=learn]'); await page.waitForSelector('.path');
    check((await page.locator('.node.completed').count()) === 0 && (await page.locator('.node.current').count()) === 1 && (await page.locator('.node.locked').count()) >= 2, 'path shows current and locked lessons');
    check((await page.locator('.level-tab[aria-disabled="true"]').count()) === 4, 'levels A2–C1 are shown as locked');
    await page.click('.node.locked >> nth=0');
    check((await page.locator('dialog').innerText()).includes('Locked'), 'tapping a locked lesson explains why');
    await page.keyboard.press('Escape');
    await page.click('.node.current'); await page.click('dialog button:has-text("Start lesson")');
    await page.waitForSelector('.lesson-body .q-title');
    check(new URL(page.url()).pathname.startsWith('/attempt/'), 'lesson opens in focus mode');
    check((await page.locator('.sidebar').count()) === 0, 'navigation is hidden during the lesson');
    check((await page.locator('.hearts').innerText()).trim() === '5', 'five hearts at the start');

    /* each exercise: first one answered wrongly on purpose, the double-click guard, keyboard use */
    const seen = [];
    let n = 0;
    while (!(await page.$('.result'))) {
      n++;
      await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage, .result');
      if (await page.$('.result')) break;
      const st = await currentState(page);
      const type = st.exercise.type; seen.push(type);
      if (n === 1) {   // wrong answer first: feedback, hearts, no XP
        const before = s.db.get('SELECT xp_total n FROM users WHERE email = ?', 'anna@example.com').n;
        const r = await answer(page, s.db, true);
        check(!r.correct, 'a wrong answer is judged wrong');
        check((await page.locator('.lesson-foot.bad .correct-answer').count()) === 1, 'the correct answer is shown after a mistake');
        check((await page.locator('.hearts').innerText()).trim() === '4', 'a heart is lost');
        check(s.db.get('SELECT xp_total n FROM users WHERE email = ?', 'anna@example.com').n === before, 'no XP for a wrong answer');
      } else if (n === 2) {  // keyboard only: number key picks, Enter checks, Enter continues
        const row = s.db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', st.exercise.id);
        const shown = await page.locator('.option').allInnerTexts();
        const correctText = row.find((o) => o.is_correct).text; const idx = shown.findIndex((t) => t.endsWith(correctText));
        await page.keyboard.press(String(idx + 1)); await page.keyboard.press('Enter');
        await page.waitForSelector('.lesson-foot.good');
        check(true, 'keyboard: number key + Enter answers a choice question');
      } else if (n === 3) {  // double clicking Check must award XP once
        const before = s.db.get('SELECT xp_total n FROM users WHERE email = ?', 'anna@example.com').n;
        await answer(page, s.db, false, { dbl: true });
        await page.waitForTimeout(300);
        check(s.db.get('SELECT xp_total n FROM users WHERE email = ?', 'anna@example.com').n === before + 10, 'double-clicking Check awards XP only once');
      } else { await answer(page, s.db, false); }
      await page.click('.lesson-foot .btn:not([disabled])');
      if (n === 4) { // reload in the middle: the lesson resumes
        await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage');
        const qBefore = (await currentState(page)).exercise.id;
        await page.reload(); await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage');
        check((await currentState(page)).exercise.id === qBefore, 'a page reload resumes the lesson at the same question');
        check((await page.locator('.hearts').innerText()).trim() === '4', 'hearts survive the reload');
      }
      if (n > 40) break;
    }
    await page.waitForSelector('.result');
    check(new Set(seen).size === 11, `all 11 exercise types appeared in one lesson (${Array.from(new Set(seen)).join(', ')})`);
    const text = await page.locator('.result').innerText();
    check(/Lesson complete!/.test(text), 'completion screen is shown');
    const att = s.db.get('SELECT * FROM lesson_attempts ORDER BY id DESC LIMIT 1');
    check(att.status === 'completed' && att.incorrect === 1 && att.correct === 11, 'server recorded 11 right and 1 wrong');
    check(text.includes('92%'), 'accuracy 92% is displayed');
    check(text.includes('+' + att.xp_awarded) && att.xp_awarded === 11 * 10 + 5 + 20, `XP earned (${att.xp_awarded}) is displayed and matches the server`);
    check((await page.locator('.result-stats').innerText()).includes('11/12'), 'right-first-time count shown');
    check(text.includes('11 correct') && text.includes('1 incorrect'), 'correct and incorrect answer counts shown');
    check(/Words to review/.test(text) && (await page.locator('.review-list li').count()) >= 1, 'words to review are listed');
    check(/Your mistakes/.test(text), 'mistakes are listed');
    check((await page.locator('.result a:has-text("Continue")').count()) === 1, 'Continue button');
    check(s.db.get('SELECT xp_total n FROM users WHERE email = ?', 'anna@example.com').n === 11 * 10 + 5 + 20 + 0 - 0, 'user XP total equals the sum of earned XP');
    await page.click('.result a:has-text("Continue")'); await page.waitForSelector('.path');
    check((await page.locator('.node.completed').count()) === 1 && (await page.locator('.node.current').count()) === 1, 'completing the lesson unlocks the next one');
    check((await page.locator('.chips .flame').first().innerText()).trim().startsWith('1'), 'streak shows 1 day');

    /* ---------- dashboard numbers come from the database ---------- */
    await page.click('a[data-nav=home]'); await page.waitForSelector('.continue-card');
    const xpTxt = await page.locator('.ring + div b').innerText();
    const dbXp = s.db.get("SELECT COALESCE(SUM(amount),0) n FROM xp_transactions WHERE user_id = (SELECT id FROM users WHERE email = 'anna@example.com')").n;
    check(xpTxt.startsWith(String(dbXp)) && xpTxt.endsWith('/ 20 XP'), `today's XP ${xpTxt} equals stored ${dbXp} and the 20 XP goal`);
    check((await page.locator('.continue-card h2').innerText()) === 'About me', 'recommended lesson moved on');
    check((await page.locator('.week .bar').count()) === 7, 'week chart has 7 days');
    check((await page.locator('.ach-mini').count()) >= 2, 'recent achievements are listed');
    check((await page.locator('a[href="/practice"]').count()) === 1, 'mistakes review is offered');

    /* ---------- mistakes review ---------- */
    await page.click('a[href="/practice"]'); await page.waitForSelector('.lesson-body .q-title');
    check(true, 'the mistakes review opens as a lesson');
    for (let i = 0; i < 5 && !(await page.$('.result')); i++) { await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage, .result'); if (await page.$('.result')) break; await answer(page, s.db, false); await page.click('.lesson-foot .btn:not([disabled])'); }
    await page.waitForSelector('.result');
    check(/Mistakes reviewed/.test(await page.locator('.result').innerText()), 'mistakes review completion screen');
    await page.click('.result a:has-text("Continue")'); await page.waitForSelector('.path');

    /* ---------- vocabulary ---------- */
    await page.click('a[data-nav=vocabulary]'); await page.waitForSelector('.word');
    check((await page.locator('.word').count()) === 15, 'vocabulary list is paginated (15 per page)');
    await page.fill('input[type=search]', 'hello'); await page.waitForFunction(() => document.querySelectorAll('.word').length === 1);
    check((await page.locator('.word .en').innerText()).startsWith('hello'), 'search finds the word');
    await page.click('button[aria-label^="Mark “hello” as difficult"]'); await page.waitForTimeout(300);
    check(s.db.get("SELECT is_difficult n FROM review_items WHERE vocabulary_id = (SELECT id FROM vocabulary WHERE en = 'hello')").n === 1, 'a word can be added to the difficult list');
    await page.click('button:has-text("Difficult")'); await page.waitForFunction(() => document.querySelectorAll('.word').length === 1);
    check(true, 'the difficult filter shows it');
    await page.fill('input[type=search]', ''); await page.click('button:has-text("All")');

    /* ---------- review modes ---------- */
    s.db.run("UPDATE review_items SET due_at = '2000-01-01T00:00:00.000Z'");
    for (const mode of ['flashcards', 'choice', 'typed', 'spelling']) {
      await page.goto(s.base + '/review?mode=' + mode); await page.waitForSelector('button:has-text("Start review")');
      await page.click('button:has-text("Start review")');
      if (mode === 'flashcards') {
        await page.waitForSelector('.flash-inner'); await page.click('.flash-inner'); await page.waitForSelector('text=I knew it'); await page.click('button:has-text("I knew it")'); await page.waitForSelector('text=Correct!');
        check(true, 'flashcards: flip and self-grade');
      } else if (mode === 'choice') {
        await page.waitForSelector('.option'); const c0 = (await page.locator('.q-sentence').innerText()).trim();
        await page.click('.option >> nth=0'); await page.waitForSelector('text=/Correct!|Not quite/'); check(true, 'choice: answering shows feedback');
      } else {
        await page.waitForSelector('input.answer-input'); await page.fill('input.answer-input', 'zzz'); await page.keyboard.press('Enter'); await page.waitForSelector('text=Not quite');
        check(true, mode + ': typed answer checked');
      }
      await page.click('button:has-text("Continue")').catch(() => {});
    }
    check(s.db.get('SELECT COUNT(*) n FROM review_items WHERE last_reviewed_at IS NOT NULL').n >= 3, 'review answers update the schedule');

    /* ---------- profile, leaderboard, achievements ---------- */
    await page.goto(s.base + '/profile'); await page.waitForSelector('input[name=displayName]');
    await page.fill('input[name=displayName]', 'Anna K'); await page.click('.avatar-pick >> nth=2'); await page.selectOption('select[name=dailyGoalXp]', '50'); await page.fill('input[name=timezone]', 'Asia/Tashkent');
    await page.check('input[name=leaderboardOptIn]'); await page.click('button:has-text("Save changes")'); await page.waitForSelector('.toast');
    await page.reload(); await page.waitForSelector('input[name=displayName]');
    check((await page.inputValue('input[name=displayName]')) === 'Anna K' && (await page.inputValue('select[name=dailyGoalXp]')) === '50' && (await page.inputValue('input[name=timezone]')) === 'Asia/Tashkent' && (await page.locator('input[name=leaderboardOptIn]').isChecked()), 'profile changes persist after a reload');
    check(s.db.get("SELECT avatar FROM users WHERE email = 'anna@example.com'").avatar === 'moon', 'avatar choice saved');
    await page.fill('input[name=timezone]', 'Mars/Olympus'); await page.click('button:has-text("Save changes")'); page.expectedStatuses.add(400);
    await page.waitForSelector('.form-error:not([hidden])'); check(true, 'an invalid time zone is rejected by the server');
    await page.goto(s.base + '/leaderboard'); await page.waitForSelector('.board');
    check((await page.locator('.board li.you').count()) === 1 && (await page.locator('.board').innerText()).includes('Anna K') && !(await page.content()).includes('anna@example.com'), 'leaderboard shows the opted-in learner by display name only');
    await page.goto(s.base + '/achievements'); await page.waitForSelector('.ach-card');
    check((await page.locator('.ach-card:not(.locked)').count()) >= 2 && (await page.locator('.ach-card.locked').count()) >= 5, 'achievements page separates earned and locked badges');

    /* ---------- no obsolete pages, unknown routes ---------- */
    page.expectedStatuses.add(404);   // unknown pages are real 404 responses that still show the app's not-found screen
    for (const old of ['/lessons', '/sessions', '/topics', '/path', '/sample', '/vocabularies']) {
      await page.goto(s.base + old); await page.waitForSelector('#app > *');
      check((await page.locator('h1').first().innerText()) === 'Page not found', `old route ${old} is gone (404 page)`);
    }
    check((await page.evaluate(() => /lug.at|Mavzular|Sessiyalar/i.test(document.body.innerText))) === false, 'no old-site text anywhere');

    check(page.problems.length === 0, 'no console errors or failed requests (' + page.problems.slice(0, 3).join(' | ') + ')');
  });
  await s.stop();
  summary('learner UI');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
