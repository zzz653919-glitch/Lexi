/* Responsive layout + accessibility: node tests/ui/responsive.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer, Client } = require('./lib');
const { layoutProbe, a11yProbe, contrastProbe } = require('./a11y');
const { answer, currentState } = require('./solver');

const WIDTHS = [[320, 700, 'mobile 320'], [360, 740, 'mobile 360'], [390, 844, 'mobile 390'], [430, 932, 'mobile 430'], [768, 1024, 'tablet 768'], [1024, 768, 'small desktop 1024'], [1440, 900, 'desktop 1440']];
const LEARNER_PAGES = [['/', 'continue-card', 'home'], ['/learn', 'path', 'learning path'], ['/vocabulary', 'word', 'vocabulary'], ['/review', 'btn', 'review'], ['/leaderboard', 'card', 'leaderboard'], ['/achievements', 'ach-card', 'achievements'], ['/profile', 'avatar-grid', 'profile']];
const ADMIN_PAGES = [['/admin', 'stat-grid', 'dashboard'], ['/admin/courses', 'tbl', 'courses'], ['/admin/courses/1', 'tree-level', 'course tree'], ['/admin/lessons/1', 'tbl', 'lesson editor'], ['/admin/vocabulary', 'tbl', 'vocabulary'], ['/admin/users', 'tbl', 'users'], ['/admin/users/1', 'stat-grid', 'user'], ['/admin/settings', 'card', 'settings'], ['/admin/audit', 'tbl', 'audit']];

(async () => {
  const s = await startServer();
  s.createUser({ email: 'admin@example.com', role: 'admin', name: 'Boss' });
  const uid = s.createUser({ email: 'u@example.com', name: 'Ula' });
  // give the learner some history so lists and charts have content
  s.db.run("INSERT INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) VALUES (?,1,1,100,'x','x')", uid);
  const report = (probeName, width, page, issues) => check(issues.length === 0, `${probeName} @${width} ${page}${issues.length ? ' -> ' + issues.slice(0, 3).join(' | ') : ''}`);

  await withBrowser(async (browser) => {
    for (const [w, h, label] of WIDTHS) {
      const page = await openPage(browser, { width: w, height: h }); page.setDefaultTimeout(15000);
      const probe = async (name, selector) => { if (selector) await page.waitForSelector(selector); await page.waitForTimeout(120); report('layout', label, name, await page.evaluate(layoutProbe)); };
      const mobile = w < 900;

      /* guest pages */
      await page.goto(s.base + '/'); await probe('landing', '.landing');
      await page.goto(s.base + '/login'); await probe('login', 'form');
      await page.goto(s.base + '/register'); await probe('register', 'form');
      page.expectedStatuses.add(400);
      await page.click('button[type=submit]'); await page.waitForSelector('.error-text:not([hidden])'); await probe('register with errors');
      await page.goto(s.base + '/forgot'); await probe('forgot password', 'form');

      /* learner */
      await loginUI(page, s.base, 'u@example.com'); await page.waitForSelector('.continue-card');
      check((await page.locator(mobile ? '.tabbar' : '.sidebar').isVisible()) && !(await page.locator(mobile ? '.sidebar' : '.tabbar').isVisible()), `${label}: ${mobile ? 'bottom tab bar replaces the sidebar' : 'sidebar navigation is shown'}`);
      for (const [url, sel, name] of LEARNER_PAGES) { await page.goto(s.base + url); await probe(name, '.' + sel); }
      await page.goto(s.base + '/learn'); await page.waitForSelector('.node.current'); await page.click('.node.current'); await page.waitForSelector('dialog'); await probe('lesson dialog'); await page.keyboard.press('Escape');
      await page.goto(s.base + '/vocabulary'); await page.waitForSelector('.word'); await page.click('button:has-text("Due")').catch(() => {}); await probe('vocabulary filtered');

      /* a whole lesson: every exercise type on screen, right and wrong feedback, results */
      const email = `w${w}@example.com`; s.createUser({ email });
      const lp = await openPage(browser, { width: w, height: h }); lp.setDefaultTimeout(15000);
      await loginUI(lp, s.base, email); await lp.waitForSelector('.continue-card');
      await lp.click('.continue-card .btn'); await lp.waitForSelector('.lesson-body .q-title');
      const seen = new Set(); let n = 0;
      while (!(await lp.$('.result')) && n < 30) {
        n++; await lp.waitForSelector('.lesson-body .q-title, .lesson-body .passage, .result'); if (await lp.$('.result')) break;
        const st = await currentState(lp); seen.add(st.exercise.type);
        await lp.waitForTimeout(80);
        report('layout', label, 'lesson: ' + st.exercise.type, await lp.evaluate(layoutProbe));
        if (n === 1) { // tap targets
          const small = await lp.evaluate(() => Array.from(document.querySelectorAll('.option, .lesson-foot .btn, .tile, .speak, .lesson-top .close')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && Math.min(r.width, r.height) < 44; }).map((e) => e.className + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
          check(small.length === 0, `${label}: lesson controls are at least 44px (${small.slice(0, 2).join(', ')})`);
        }
        const wrong = n === 2; await answer(lp, s.db, wrong);
        report('layout', label, 'lesson feedback ' + (wrong ? '(wrong)' : '(right)'), await lp.evaluate(layoutProbe));
        await lp.click('.lesson-foot .btn:not([disabled])');
      }
      await lp.waitForSelector('.result'); report('layout', label, 'lesson results', await lp.evaluate(layoutProbe));
      check(seen.size === 11, `${label}: all 11 exercise types fit the screen`);
      check(lp.problems.length === 0, `${label}: no console errors in the lesson (${lp.problems.slice(0, 2).join(' | ')})`);

      /* admin */
      const ap = await openPage(browser, { width: w, height: h }); ap.setDefaultTimeout(15000);
      await loginUI(ap, s.base, 'admin@example.com', 'Passw0rd!x', '/admin/login'); await ap.waitForSelector('.adm');
      for (const [url, sel, name] of ADMIN_PAGES) { await ap.goto(s.base + url); await ap.waitForSelector('.' + sel); await ap.waitForTimeout(150); report('layout', label, 'admin ' + name, await ap.evaluate(layoutProbe)); }
      await ap.goto(s.base + '/admin/lessons/1'); await ap.waitForSelector('.tbl'); await ap.click('button:has-text("Add exercise")'); await ap.waitForSelector('dialog .opt-row'); report('layout', label, 'admin exercise editor dialog', await ap.evaluate(layoutProbe));
      await ap.selectOption('dialog select[name=type]', 'match_pairs'); report('layout', label, 'admin match editor', await ap.evaluate(layoutProbe)); await ap.keyboard.press('Escape');
      await ap.click('button[aria-label="Preview as learner"] >> nth=2'); await ap.waitForSelector('.preview-box'); report('layout', label, 'admin preview dialog', await ap.evaluate(layoutProbe)); await ap.keyboard.press('Escape');
      check(ap.problems.length === 0, `${label}: no console errors in the admin (${ap.problems.slice(0, 2).join(' | ')})`);
      check(page.problems.length === 0, `${label}: no console errors on learner pages (${page.problems.slice(0, 2).join(' | ')})`);
    }

    /* ---------- accessibility (one desktop and one mobile pass) ---------- */
    for (const [w, h] of [[390, 844], [1280, 800]]) {
      const page = await openPage(browser, { width: w, height: h }); page.setDefaultTimeout(15000);
      const audit = async (name) => report('a11y', w, name, await page.evaluate(a11yProbe));
      await page.goto(s.base + '/'); await page.waitForSelector('.landing'); await audit('landing');
      await page.goto(s.base + '/login'); await page.waitForSelector('form'); await audit('login');
      await page.goto(s.base + '/register'); await page.waitForSelector('form'); await audit('register');
      await loginUI(page, s.base, 'u@example.com'); await page.waitForSelector('.continue-card'); await audit('home');
      for (const [url, sel, name] of LEARNER_PAGES.slice(1)) { await page.goto(s.base + url); await page.waitForSelector('.' + sel); await audit(name); }
      await page.goto(s.base + '/learn'); await page.waitForSelector('.node.current'); await page.click('.node.current'); await page.click('dialog button:has-text("Start lesson"), dialog button:has-text("Continue")').catch(() => {});
      await page.waitForSelector('.lesson-body .q-title');
      for (let i = 0; i < 12 && !(await page.$('.result')); i++) { await page.waitForSelector('.lesson-body .q-title, .lesson-body .passage, .result'); if (await page.$('.result')) break; await audit('lesson step ' + (i + 1)); await answer(page, s.db, false); await page.click('.lesson-foot .btn:not([disabled])'); }
      await page.waitForSelector('.result'); await audit('lesson results');
      const ap = await openPage(browser, { width: w, height: h }); ap.setDefaultTimeout(15000);
      await ap.goto(s.base + '/admin/login'); await ap.waitForSelector('form'); report('a11y', w, 'admin login', await ap.evaluate(a11yProbe));
      await loginUI(ap, s.base, 'admin@example.com', 'Passw0rd!x', '/admin/login'); await ap.waitForSelector('.adm');
      for (const [url, sel, name] of ADMIN_PAGES) { await ap.goto(s.base + url); await ap.waitForSelector('.' + sel); report('a11y', w, 'admin ' + name, await ap.evaluate(a11yProbe)); }
    }

    /* ---------- keyboard focus is visible ---------- */
    {
      const page = await openPage(browser, { width: 1280, height: 800 });
      await page.goto(s.base + '/login'); await page.waitForSelector('form');
      const seenFocus = [];
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); seenFocus.push(await page.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e); return { tag: e.tagName, ring: c.boxShadow !== 'none' || (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) }; })); }
      check(seenFocus.filter((f) => f.tag !== 'BODY').every((f) => f.ring), 'every element reached with Tab shows a visible focus ring (' + seenFocus.map((f) => f.tag + ':' + f.ring).join(' ') + ')');
      await loginUI(page, s.base, 'u@example.com'); await page.waitForSelector('.continue-card');
      let ok = true; for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); const r = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return true; const c = getComputedStyle(e); return c.boxShadow !== 'none' || (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0); }); ok = ok && r; }
      check(ok, 'focus ring visible across the dashboard navigation and buttons');
    }

    /* ---------- reduced motion ---------- */
    {
      const page = await openPage(browser, { width: 1280, height: 800 }, { reducedMotion: 'reduce', motion: 'system' });
      await loginUI(page, s.base, 'u@example.com'); await page.goto(s.base + '/learn'); await page.waitForSelector('.node.current');
      const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.node.current'), '::after').animationDuration);
      check(parseFloat(dur) < 0.01, `animations are effectively disabled with prefers-reduced-motion (${dur})`);
      const normal = await openPage(browser, { width: 1280, height: 800 }, { motion: 'system' }); await loginUI(normal, s.base, 'u@example.com'); await normal.goto(s.base + '/learn'); await normal.waitForSelector('.node.current');
      check(parseFloat(await normal.evaluate(() => getComputedStyle(document.querySelector('.node.current'), '::after').animationDuration)) > 1, 'and run normally otherwise');
    }

    /* ---------- colour contrast, light and dark ---------- */
    for (const scheme of ['light', 'dark']) {
      const page = await openPage(browser, { width: 1280, height: 800 }, { colorScheme: scheme });
      const sels = ['body', '.btn:not(.secondary):not(.ghost):not(.danger)', '.btn.secondary', '.btn.danger', '.muted', '.nav a', '.nav a[aria-current="page"]', '.chip', '.chip.ok', '.chip.warn', '.chip.bad', '.badge', '.error-text', '.form-error', 'label .label', '.unit-banner h3', '.continue-card h2', '.fchip', '.level-tab', 'h1', 'a'];
      const check1 = async (name, url, sel, extra) => { await page.goto(s.base + url); await page.waitForSelector(sel); if (extra) await extra(); const r = await page.evaluate(contrastProbe, sels); const bad = r.filter((x) => x.ratio < x.need); check(bad.length === 0, `${scheme} contrast ${name}${bad.length ? ': ' + bad.map((b) => `${b.sel} ${b.ratio}<${b.need} "${b.text}"`).join('; ') : ''}`); };
      await page.goto(s.base + '/login'); await page.waitForSelector('form'); await page.fill('input[name=email]', 'x@y.zz'); page.expectedStatuses.add(401); page.expectedStatuses.add(400);
      await check1('login', '/login', 'form'); await page.fill('input[name=email]', 'u@example.com'); await page.fill('input[name=password]', 'bad-pass-1'); await page.click('button[type=submit]'); await page.waitForSelector('.form-error:not([hidden])');
      let r = await page.evaluate(contrastProbe, ['.form-error', '.btn']); check(r.every((x) => x.ratio >= x.need), `${scheme} contrast of the login error box (${r.map((x) => x.ratio).join(', ')})`);
      await loginUI(page, s.base, 'u@example.com'); await page.waitForSelector('.continue-card');
      await check1('home', '/', '.continue-card'); await check1('learn', '/learn', '.path'); await check1('vocabulary', '/vocabulary', '.word'); await check1('profile', '/profile', '.avatar-grid'); await check1('achievements', '/achievements', '.ach-card');
      await page.goto(s.base + '/learn'); await page.waitForSelector('.node.current'); await page.click('.node.current'); await page.click('dialog button:has-text("Start lesson"), dialog button:has-text("Continue")').catch(() => {}); await page.waitForSelector('.lesson-body .q-title');
      const lessonSels = ['.q-title', '.q-sub', '.option', '.lesson-foot .btn', '.hearts', '.q-sentence', '.tile'];
      r = await page.evaluate(contrastProbe, lessonSels); let bad = r.filter((x) => x.ratio < x.need); check(bad.length === 0, `${scheme} contrast in a lesson${bad.length ? ': ' + bad.map((b) => `${b.sel} ${b.ratio}<${b.need}`).join('; ') : ''}`);
      await answer(page, s.db, true); r = await page.evaluate(contrastProbe, ['.lesson-foot.bad .feedback b', '.lesson-foot.bad .feedback p', '.lesson-foot .btn']); bad = r.filter((x) => x.ratio < x.need); check(bad.length === 0, `${scheme} contrast of the wrong-answer feedback${bad.length ? ': ' + bad.map((b) => `${b.sel} ${b.ratio}<${b.need}`).join('; ') : ''}`);
      await page.click('.lesson-foot .btn:not([disabled])'); await page.evaluate(() => document.querySelector('.lesson-body')); await answer(page, s.db, false);
      r = await page.evaluate(contrastProbe, ['.lesson-foot.good .feedback b', '.lesson-foot.good .feedback p', '.lesson-foot.good .xp']); bad = r.filter((x) => x.ratio < x.need); check(bad.length === 0, `${scheme} contrast of the right-answer feedback${bad.length ? ': ' + bad.map((b) => `${b.sel} ${b.ratio}<${b.need}`).join('; ') : ''}`);
      const ap = await openPage(browser, { width: 1280, height: 800 }, { colorScheme: scheme }); await loginUI(ap, s.base, 'admin@example.com', 'Passw0rd!x', '/admin/login'); await ap.waitForSelector('.adm');
      for (const [url, sel] of [['/admin', '.stat-grid'], ['/admin/courses', '.tbl'], ['/admin/lessons/1', '.tbl']]) { await ap.goto(s.base + url); await ap.waitForSelector(sel); const rr = await ap.evaluate(contrastProbe, sels.concat(['th', 'td', '.stat-card span', '.adm-side a.nav-i', '.tag-published', '.tag-draft'])); const b2 = rr.filter((x) => x.ratio < x.need); check(b2.length === 0, `${scheme} contrast admin ${url}${b2.length ? ': ' + b2.map((b) => `${b.sel} ${b.ratio}<${b.need} "${b.text}"`).join('; ') : ''}`); }
    }
  });
  await s.stop();
  summary('responsive & accessibility');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
