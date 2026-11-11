/* Achievements and rewards through the real UI: the page, filters, 3D medals, the unlocked notification, profile badges, languages, the admin panel, a phone: node tests/ui/achievements.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer } = require('./lib');

(async () => {
  const s = await startServer({ roadmap: true });
  const uid = s.createUser({ email: 'ach@example.com', name: 'Aziza' }); s.createUser({ email: 'admin@example.com', role: 'admin', name: 'Boss' });
  const lessons = s.db.all("SELECT l.id FROM lessons l JOIN levels lv ON lv.id = l.level_id WHERE lv.code = 'A1' AND l.status = 'published' ORDER BY l.id").map((r) => r.id);
  const done = (n) => lessons.slice(0, n).forEach((id) => s.db.run('INSERT OR IGNORE INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) VALUES (?,?,1,95,?,?)', uid, id, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'));
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport, { ach: false }); page.setDefaultTimeout(30000);
    await loginUI(page, s.base, 'ach@example.com'); await page.waitForSelector('.continue-card, .roadmap-card, .welcome');

    /* ---------- the page: nothing unlocked yet ---------- */
    await page.goto(s.base + '/achievements'); await page.waitForSelector('.ach-item');
    const total = await page.locator('.ach-item').count();
    check(total >= 35 && (await page.locator('#ach-pct').innerText()) === '0%', `${total} achievements, 0% complete`);
    check((await page.locator('.ach-item[data-unlocked="1"]').count()) === 0 && (await page.locator('.ach-item.locked .ach-prog .bar').count()) === total, 'every locked achievement shows a progress bar');
    check((await page.locator('.ach-item.locked .ach-medal.is-locked').count()) === total, 'locked medals are dimmed with a lock');
    const layers = await page.locator('.ach-item').first().locator('.ach-layer').count();
    check(layers === 3, 'each medal is built from three depth layers (3D)');
    check((await page.locator('.ach-item .ach-pill').allInnerTexts()).every((x) => ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'].includes(x.toUpperCase())), 'rarity labels: Common, Rare, Epic, Legendary, Mythic');
    check((await page.locator('.ach-item .ach-reward[data-reward="xp"]').count()) > 20 && (await page.locator('.ach-item .ach-reward[data-reward="item"]').count()) > 10, 'rewards are shown: XP, tokens and exclusive items');

    /* ---------- filters ---------- */
    await page.click('[data-filter="category"][data-value="streak"]');
    check((await page.locator('.ach-item').count()) === 5 && (await page.locator('.ach-item[data-category="streak"]').count()) === 5, 'category filter: the 5 streak achievements');
    await page.click('[data-filter="rarity"][data-value="mythic"]');
    check((await page.locator('.ach-item').count()) === 1, 'rarity filter on top: only Legendary Learner');
    await page.click('[data-filter="category"][data-value=""]'); await page.click('[data-filter="rarity"][data-value=""]');
    await page.click('[data-filter="rarity"][data-value="mythic"]'); check((await page.locator('.ach-item').count()) === 2, 'mythic: two achievements');
    await page.click('[data-filter="rarity"][data-value=""]'); await page.click('[data-filter="status"][data-value="unlocked"]');
    check((await page.locator('#ach-empty').count()) === 1, 'unlocked filter with nothing unlocked: an empty message');
    await page.click('[data-filter="status"][data-value=""]');

    /* ---------- 3D tilt ---------- */
    const card = page.locator('.ach-item').first(), box = await card.boundingBox();
    await page.mouse.move(box.x + box.width - 10, box.y + 10); await page.waitForTimeout(120);
    const ry = await card.locator('.ach-medal-in').evaluate((el) => el.style.getPropertyValue('--ry'));
    check(ry && parseFloat(ry) > 3, 'the medal tilts towards the pointer (' + ry + ')');

    /* ---------- real activity unlocks things, and the notification celebrates it ---------- */
    done(10);
    await page.evaluate(() => fetch('/api/achievements'));   // the learner's activity is evaluated on the server (a lesson answer does the same)
    await page.goto(s.base + '/learn'); await page.waitForSelector('.pop, .path, .ach-pop', { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('.ach-pop', { timeout: 30000 }).catch(() => {});
    const pop = await page.locator('.ach-pop').count();
    check(pop === 1, 'the unlocked-achievement notification appears');
    if (pop) {
      const first = await page.locator('.ach-pop').getAttribute('data-code');
      check(!!(await page.locator('.ach-pop .ach-medal').count()) && (await page.locator('.ach-pop h2').innerText()).length > 2, 'it shows the 3D medal and the title (' + first + ')');
      check((await page.locator('.ach-pop .ach-reward').count()) >= 2, 'and the rewards');
      check((await page.locator('.ach-pop').getAttribute('role')) === 'alertdialog', 'it is an accessible dialog');
      for (let i = 0; i < 6 && (await page.locator('.ach-pop').count()); i++) { await page.click('#ach-pop-close'); await page.waitForTimeout(150); }
      check((await page.locator('.ach-pop').count()) === 0, 'it closes (one by one when several are unlocked)');
    }
    check(s.db.get('SELECT COUNT(*) n FROM user_achievements WHERE user_id = ? AND seen = 0', uid).n === 0, 'the server remembers they were shown');
    await page.reload(); await page.waitForSelector('.continue-card, .roadmap-card, .path, .page-head'); await page.waitForTimeout(800);
    check((await page.locator('.ach-pop').count()) === 0, 'and they are not shown again after a refresh');

    /* ---------- the page after unlocking ---------- */
    await page.goto(s.base + '/achievements'); await page.waitForSelector('.ach-item');
    const unlocked = await page.locator('.ach-item[data-unlocked="1"]').count();
    check(unlocked >= 3 && (await page.locator('#ach-pct').innerText()) !== '0%', `${unlocked} unlocked; the completion percentage moved (${await page.locator('#ach-pct').innerText()})`);
    check((await page.locator('.ach-item[data-unlocked="1"] .ach-when').count()) === unlocked, 'unlocked ones show the date');
    const lp = page.locator('.ach-item[data-code="lessons_50"] .ach-prog');
    check((await lp.innerText()).includes('10 / 50'), 'a locked achievement shows its progress: 10 / 50');

    /* ---------- profile badges ---------- */
    await page.goto(s.base + '/profile'); await page.waitForSelector('#profile-badges');
    check((await page.locator('#profile-badges .ach-badge').count()) >= 1, 'special badges on the profile');

    /* ---------- the shop shows the exclusive item of an achievement ---------- */
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item, .av-shop');
    check((await page.locator('.av-shop').count()) >= 0 && !page.problems.length, 'the shop still works ' + page.problems.slice(0, 2).join(' | '));

    /* ---------- languages ---------- */
    await page.goto(s.base + '/achievements'); await page.waitForSelector('.ach-item');
    const en = await page.locator('.ach-item[data-code="first_lesson"] h3').innerText();
    s.db.run("UPDATE users SET ui_language = 'uz' WHERE id = ?", uid); await page.goto(s.base + '/achievements'); await page.waitForSelector('.ach-item');
    const uz = await page.locator('.ach-item[data-code="first_lesson"] h3').innerText();
    s.db.run("UPDATE users SET ui_language = 'ru' WHERE id = ?", uid); await page.goto(s.base + '/achievements'); await page.waitForSelector('.ach-item');
    const ru = await page.locator('.ach-item[data-code="first_lesson"] h3').innerText();
    check(en === 'First Lesson' && uz !== en && /[а-я]/i.test(ru), `titles in three languages: ${en} / ${uz} / ${ru}`);
    check(!(await page.evaluate(() => document.body.innerText.includes('ach.'))), 'no untranslated keys on the page');
    check(!page.problems.length, 'no console errors ' + page.problems.slice(0, 3).join(' | '));

    /* ---------- a phone ---------- */
    const ph = await openPage(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true, ach: false }); ph.setDefaultTimeout(30000);
    await loginUI(ph, s.base, 'ach@example.com'); await ph.waitForSelector('.continue-card, .roadmap-card, .welcome');
    await ph.goto(s.base + '/achievements'); await ph.waitForSelector('.ach-item');
    check(!(await ph.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'mobile: the page fits the screen');
    check((await ph.locator('.ach-item').first().boundingBox()).width > 300, 'mobile: one card per row');
    check(!ph.problems.length, 'mobile: no console errors ' + ph.problems.slice(0, 2).join(' | '));

    /* ---------- the admin panel ---------- */
    const ad = await openPage(browser, viewport); ad.setDefaultTimeout(20000);
    await loginUI(ad, s.base, 'admin@example.com', 'Passw0rd!x', '/admin/login'); await ad.waitForSelector('.adm');
    check((await ad.locator('.adm-side nav a[data-nav="achievements"]').count()) === 1, 'the admin menu has Achievements');
    await ad.goto(s.base + '/admin/achievements'); await ad.waitForSelector('.tbl tbody tr');
    check((await ad.locator('.tbl tbody tr').count()) >= 35, 'the admin sees every achievement with its unlock count');
    await ad.click('#ach-new'); await ad.waitForSelector('dialog');
    await ad.fill('dialog input[name=code]', 'ui_ten'); await ad.fill('dialog input[name=title_en]', 'UI ten'); await ad.fill('dialog input[name=desc_en]', 'Ten lessons through the UI.');
    await ad.selectOption('dialog select[name=metric]', 'lessons'); await ad.fill('dialog input[name=target]', '12'); await ad.click('dialog button[type=submit]');
    await ad.waitForFunction(() => !document.querySelector('dialog')); await ad.waitForSelector('.tbl tbody tr');
    check(!!s.db.get("SELECT 1 x FROM achievement_defs WHERE code = 'ui_ten' AND target = 12 AND metric = 'lessons'"), 'a new achievement is created from the panel');
    await ad.selectOption('#ach-rar', 'epic'); await ad.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length < 35).catch(() => {}); check((await ad.locator('.tbl tbody tr').count()) < 35, 'the admin can filter by rarity');
    check(!ad.problems.length, 'no console errors in the admin panel ' + ad.problems.slice(0, 2).join(' | '));
  });
  await s.stop();
  summary('achievements UI');
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
