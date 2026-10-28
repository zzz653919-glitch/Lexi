/* Loading animations and feedback effects through the real UI: node tests/ui/motion.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer } = require('./lib');
const { answer, playLesson } = require('./solver');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/* delays matching API requests by `ms` (the request is really held back, so loaders show only during real waiting) */
async function slow(page, pattern, ms) { await page.route(pattern, async (route) => { await delay(ms); route.continue().catch(() => {}); }); }

(async () => {
  const s = await startServer();
  s.createUser({ email: 'm@example.com', name: 'Mia' }); s.createUser({ email: 'boss@example.com', name: 'Boss', role: 'admin' });
  s.db.run("UPDATE users SET ui_language = 'en' WHERE 1 = 1");
  const vocab = s.db.all('SELECT id FROM vocabulary ORDER BY id LIMIT 5');
  vocab.forEach((v) => s.db.run("INSERT INTO review_items (user_id, vocabulary_id, box, due_at) VALUES (1, ?, 0, '2000-01-01T00:00:00.000Z')", v.id));

  await withBrowser(async (browser) => {
    for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 780 }]]) {
      /* ---------- start-up screen: real stages, no fake progress ---------- */
      let page = await openPage(browser, viewport, { motion: 'on' });
      page.setDefaultTimeout(15000);
      await slow(page, '**/api/public/config', 3000);
      page.goto(s.base + '/', { waitUntil: 'commit' }).catch(() => {});
      await page.waitForSelector('#splash');
      await delay(900);
      check(await page.isVisible('#splash .splash-logo'), `${label}: the start-up screen shows the logo`);
      const early = Number(await page.getAttribute('#splash-bar', 'aria-valuenow'));
      check(early === 25 && /journey/i.test(await page.innerText('#splash-msg')), `${label}: the first real stage (texts loaded) is shown: ${early}% with a message`);
      await delay(1800);
      check(Number(await page.getAttribute('#splash-bar', 'aria-valuenow')) === early, `${label}: while the server is still answering the bar does NOT creep forward on its own`);
      check((await page.locator('#splash .sp-f').count()) > 10, `${label}: floating letters, words, stars, bubbles and books are present`);
      await page.waitForSelector('#splash', { state: 'detached' });
      await page.waitForSelector('#app > *');
      check(true, `${label}: the screen goes away once the first page is drawn`);
      check(page.problems.length === 0, `${label}: start-up without console problems ${page.problems.join('; ')}`);
      await page.context().close();

      /* ---------- start-up failure: clear message and a retry button ---------- */
      page = await openPage(browser, viewport, { motion: 'on' }); page.setDefaultTimeout(15000); page.expectedStatuses.add(500);
      let fail = true;
      await page.route('**/api/public/config', (route) => (fail ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'The server is not available.' }) }) : route.continue()));
      await page.goto(s.base + '/');
      await page.waitForSelector('.auth-card button');
      await page.waitForSelector('#splash', { state: 'detached' });
      check(true, `${label}: a failed start removes the start-up screen`);
      check(/not available/i.test(await page.innerText('.auth-card')), `${label}: the error message is readable`);
      fail = false;
      await page.click('.auth-card button');
      await page.waitForSelector('.landing');
      check(true, `${label}: Retry loads the application`);
      await page.context().close();
    }

    /* ---------- loaders only while loading, page transitions ---------- */
    const page = await openPage(browser, { width: 1280, height: 800 }, { motion: 'on' });
    page.setDefaultTimeout(15000); page.expectedStatuses.add(401);
    await loginUI(page, s.base, 'm@example.com'); await page.waitForSelector('.sidebar .nav');
    await page.evaluate(() => { window.__ld = 0; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && (n.matches('.ld') || n.querySelector('.ld'))) window.__ld++; }))).observe(document.body, { childList: true, subtree: true }); });
    await page.click('.sidebar .nav a[data-nav=profile]'); await page.waitForSelector('#motion-pref');
    check((await page.evaluate(() => window.__ld)) === 0, 'a quick page (no waiting) never flashes a loader');
    check(await page.evaluate(() => !!document.querySelector('#content > .page-in')), 'opening a page fades / slides it in');

    await slow(page, '**/api/vocabulary?*', 1500);
    await page.click('.sidebar .nav a[data-nav=vocabulary]');
    await page.waitForSelector('.ld-vocab', { timeout: 3000 });
    check(true, 'vocabulary loading: floating words and a typed word appear while the list loads');
    check(/vocabulary/i.test(await page.innerText('.ld-vocab ~ .ld-text, .ld .ld-text')), 'with a friendly message');
    check((await page.locator('.ld-bar.indeterminate').count()) === 1 && (await page.locator('.ld-bar[aria-valuenow]').count()) === 0, 'and an indeterminate bar (no made-up percentage)');
    await page.waitForSelector('.word, .empty', { timeout: 6000 });
    check((await page.locator('.ld').count()) === 0, 'the loader is gone as soon as the data has arrived');
    await page.unroute('**/api/vocabulary?*');

    await slow(page, '**/api/path', 1500);
    await page.click('.sidebar .nav a[data-nav=learn]');
    await page.waitForSelector('.ld-path', { timeout: 3000 });
    check(true, 'progress loading: the learning path draws itself while the path loads');
    await page.waitForSelector('.path', { timeout: 6000 });
    await page.unroute('**/api/path');

    await slow(page, '**/api/lessons/*/start', 1500);
    await page.click('.node.current'); await page.click('dialog button:has-text("Start lesson")');
    await page.waitForSelector('.ld-overlay .ld-lesson', { timeout: 3000 });
    check(true, 'lesson loading: an animated book and stars cover the screen while the lesson is created');
    await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage', { timeout: 8000 });
    check((await page.locator('.ld-overlay').count()) === 0, 'and disappear when the first question is ready');
    check(await page.evaluate(() => !!document.querySelector('.lesson')), 'the lesson opens');
    await page.unroute('**/api/lessons/*/start');

    /* ---------- answer feedback ---------- */
    const wrong = await answer(page, s.db, true);
    check(!wrong.correct, 'a wrong answer is judged wrong');
    await page.waitForSelector('.lesson-foot.bad');
    check(await page.evaluate(() => !!document.querySelector('.shake-x')), 'a wrong answer gently shakes the question');
    check(await page.evaluate(() => !!document.querySelector('.hint-pulse')), 'and the right answer pulses as a visual hint');
    await page.click('.lesson-foot .btn:not([disabled])');
    await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage');
    await answer(page, s.db, false);
    await page.waitForSelector('.lesson-foot.good');
    check((await page.locator('.fx-stars').count()) >= 1 || await page.evaluate(() => !!document.querySelector('.fx-layer, .good-glow')), 'a correct answer brings a green highlight and stars');
    check(await page.evaluate(() => !!document.querySelector('.xp-float')), 'and the earned XP floats up');
    await page.click('.lesson-foot .btn:not([disabled])');

    /* ---------- completion: confetti, counting numbers that match the server, badge, streak ---------- */
    await playLesson(page, s.db, { max: 80 });
    await page.waitForSelector('.result.celebrate');
    await page.waitForSelector('.fx-confetti', { state: 'attached', timeout: 3000 });
    check(true, 'lesson complete: confetti');
    await delay(1400);
    const att = s.db.get("SELECT xp_awarded FROM lesson_attempts WHERE user_id = 1 AND status = 'completed' ORDER BY id DESC LIMIT 1");
    check((await page.innerText('.result-stats .xp b')) === '+' + att.xp_awarded, `the XP counter ends on the real server value (+${att.xp_awarded})`);
    check((await page.locator('.badge-reveal').count()) >= 1, 'a new achievement badge is revealed with an animation');
    check(await page.isVisible('.streak-up'), 'the first completed lesson starts a streak and the flame appears');
    await page.click('.result a.btn');
    await page.waitForSelector('.sidebar .nav');
    await delay(1200);
    const xpTotal = s.db.get('SELECT xp_total n FROM users WHERE id = 1').n;
    check((await page.innerText('#side-chips .chip.bolt .num')) === String(xpTotal), 'the XP chip shows the real total after counting up');
    check((await page.locator('#side-chips .chip.flame.lit').count()) === 1, 'the streak flame is alive when the streak is above zero');

    /* ---------- quiz loader ---------- */
    await slow(page, '**/api/review/session', 1500);
    await page.click('.sidebar .nav a[data-nav=review]'); await page.waitForSelector('button.btn.block');
    await page.click('button.btn.block:not([disabled])');
    await page.waitForSelector('.ld-quiz', { timeout: 3000 });
    check(true, 'quiz loading: letters and answer cards while the quiz is prepared');
    await page.waitForSelector('.q-title, .flash', { timeout: 6000 });
    await page.unroute('**/api/review/session');
    check(page.problems.length === 0, 'no console errors or failed requests ' + page.problems.join('; '));

    /* ---------- a loader never lasts for ever ---------- */
    const slowNote = await page.evaluate(async () => {
      const { loader } = await import('/js/loaders.js');
      let retried = false; const el = loader('vocab', { slowAfter: 300, onRetry: () => { retried = true; } }); document.body.append(el);
      await new Promise((r) => setTimeout(r, 600));
      const btn = el.querySelector('.ld-slow button'); const shown = !!btn; if (btn) btn.click(); el.remove();
      return { shown, retried };
    });
    check(slowNote.shown && slowNote.retried, 'after a long wait the loader says so and offers a working Retry button');
    await page.context().close();

    /* ---------- reduced motion and the animation setting ---------- */
    const rm = await openPage(browser, { width: 1280, height: 800 }, { reducedMotion: 'reduce', motion: 'system' });
    rm.setDefaultTimeout(15000); rm.expectedStatuses.add(401);
    await slow(rm, '**/api/public/config', 1200);
    rm.goto(s.base + '/', { waitUntil: 'commit' }).catch(() => {});
    await rm.waitForSelector('#splash .splash-logo');
    await rm.waitForFunction(() => document.documentElement.dataset.motion);   // set as soon as the scripts have loaded
    check((await rm.evaluate(() => document.documentElement.dataset.motion)) === 'off', 'reduced-motion: the system preference turns animations off');
    check((await rm.evaluate(() => getComputedStyle(document.querySelector('.splash-logo')).animationName)) === 'none', 'reduced-motion: the start-up logo does not animate');
    await rm.waitForSelector('#splash', { state: 'detached' });
    await rm.unroute('**/api/public/config');
    await loginUI(rm, s.base, 'm@example.com'); await rm.waitForSelector('.sidebar .nav');
    await rm.goto(s.base + '/learn'); await rm.waitForSelector('.path');
    await rm.click('.node.current'); await rm.click('dialog button:has-text("Start lesson")');
    await rm.waitForSelector('.lesson-body .q-title, .lesson-body .passage');
    await answer(rm, s.db, true); await rm.waitForSelector('.lesson-foot.bad');
    check(await rm.evaluate(() => !document.querySelector('.shake-x, .fx-layer')), 'reduced-motion: no shake and no effects layer after a mistake (the correct answer is still shown)');
    check((await rm.locator('.lesson-foot .correct-answer').count()) === 1, 'reduced-motion: the correct answer is still displayed');
    await rm.goto(s.base + '/profile'); await rm.waitForSelector('#motion-pref');
    await rm.selectOption('#motion-pref', 'on');
    check((await rm.evaluate(() => document.documentElement.dataset.motion)) === 'on', 'Profile → Animations → Always on overrides the system preference');
    await rm.reload(); await rm.waitForSelector('#motion-pref');
    check((await rm.evaluate(() => document.documentElement.dataset.motion)) === 'on' && (await rm.inputValue('#motion-pref')) === 'on', 'and the choice survives a refresh');
    await rm.selectOption('#motion-pref', 'off');
    check((await rm.evaluate(() => document.documentElement.dataset.motion)) === 'off', 'Off disables animations');
    check(rm.problems.length === 0, 'no console problems with reduced motion ' + rm.problems.join('; '));
    await rm.context().close();

    /* ---------- admin: vocabulary import shows the real number of words ---------- */
    const ad = await openPage(browser, { width: 1280, height: 800 }, { motion: 'on' });
    ad.setDefaultTimeout(15000); ad.expectedStatuses.add(401);
    await ad.goto(s.base + '/admin/login');
    await ad.fill('input[name=email]', 'boss@example.com'); await ad.fill('input[name=password]', 'Passw0rd!x'); await ad.click('button[type=submit]');
    await ad.waitForURL('**/admin'); await ad.goto(s.base + '/admin/vocabulary'); await ad.waitForSelector('.tbl');
    await ad.click('.page-head .btn.secondary:has-text("Import")');
    await ad.waitForSelector('dialog textarea');
    await ad.fill('dialog textarea', 'en,uz,pos,cefr,example,example_uz,ru,status\nanimate,jonlantirmoq,verb,B2,,,,published\nsparkle,yarqiramoq,verb,B2,,,,published\nbadge,nishon,noun,B1,,,,published');
    await slow(ad, '**/api/admin/vocabulary/import', 1500);
    await ad.click('dialog button[type=submit]');
    await ad.waitForSelector('.ld-import .ld-count', { timeout: 3000 });
    check((await ad.innerText('.ld-import .ld-count')) === '3', 'vocabulary import: word cards and a counter with the real number of words (3)');
    await ad.waitForSelector('dialog', { state: 'detached', timeout: 8000 });
    check(s.db.get("SELECT COUNT(*) n FROM vocabulary WHERE en IN ('animate','sparkle','badge')").n === 3, 'and the three words were really imported');
    check(ad.problems.length === 0, 'no console problems in the admin panel ' + ad.problems.join('; '));
    await ad.context().close();
  });
  const ok = summary('motion UI');
  await s.stop();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
