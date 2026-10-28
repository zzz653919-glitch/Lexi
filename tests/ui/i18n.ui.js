/* Language switching through the real UI: node tests/ui/i18n.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer, Client } = require('./lib');
const A = require('../../server/lib/auth');

const NAMES = ['🇺🇿 O‘zbekcha', '🇷🇺 Русский', '🇬🇧 English'];
const lang = (page) => page.evaluate(() => document.documentElement.lang);
const stored = (page) => page.evaluate(() => localStorage.getItem('lexi.lang'));
async function pick(page, code, withKeyboard) {
  await page.locator('.lang-switcher:visible .lang-btn').first().click();
  if (withKeyboard) {
    const want = { uz: 0, ru: 1, en: 2 }[code];
    await page.keyboard.press('Home'); for (let i = 0; i < want; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  } else await page.locator(`.lang-switcher:visible .lang-option[data-code=${code}]`).first().click();
  await page.waitForFunction((c) => document.documentElement.lang === c, code);
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const s = await startServer();
  s.createUser({ email: 'ru@example.com', name: 'Ru User' });
  s.createUser({ email: 'uz@example.com', name: 'Uz User' });
  s.createUser({ email: 'boss@example.com', name: 'Boss', role: 'admin' });
  s.db.run("UPDATE users SET ui_language = 'uz' WHERE email IN ('ru@example.com', 'uz@example.com', 'boss@example.com')");
  await withBrowser(async (browser, viewport) => {
    /* ---------- default language, selector contents, switching without a reload ---------- */
    const page = await openPage(browser, viewport, { lang: false });
    page.setDefaultTimeout(15000);
    await page.goto(s.base + '/');
    await page.waitForSelector('.landing');
    check((await lang(page)) === 'uz', 'a new visitor gets Uzbek by default');
    await page.locator('.lang-switcher:visible .lang-btn').first().click();
    const opts = await page.locator('.lang-switcher:visible .lang-option').allInnerTexts();
    check(NAMES.every((n, i) => opts[i] && opts[i].replace(/\s+/g, ' ').includes(n.split(' ')[1]) ), 'the selector offers Uzbek, Russian and English with their own names');
    const flags = await page.locator('.lang-switcher:visible .lang-option .lang-flag').allInnerTexts();
    check(flags.join('') === '🇺🇿🇷🇺🇬🇧', 'with the flags 🇺🇿 🇷🇺 🇬🇧');
    check((await page.locator('.lang-switcher:visible .lang-btn').first().getAttribute('aria-expanded')) === 'true', 'the list is exposed as expanded');
    await page.keyboard.press('Escape');
    check((await page.locator('.lang-switcher:visible .lang-list').first().isHidden()), 'Escape closes the selector');
    await page.evaluate(() => { window.__marker = 'same-page'; });
    const before = await page.locator('h1').first().innerText();
    await pick(page, 'ru', true);
    check((await page.evaluate(() => window.__marker)) === 'same-page', 'switching does not reload the application');
    check((await page.locator('h1').first().innerText()) !== before, 'the page text changes immediately');
    check((await page.locator('.lang-switcher:visible .lang-list').first().isHidden()), 'the selector closes after choosing');
    check((await stored(page)) === 'ru', 'the choice is stored on the device');
    await page.reload(); await page.waitForSelector('.landing');
    check((await lang(page)) === 'ru', 'the language survives a refresh');
    await pick(page, 'en'); check(/learn/i.test(await page.locator('h1').first().innerText()), 'English works too');
    await pick(page, 'uz');

    /* ---------- account: stored in the profile, restored on another device, no leaking between accounts ---------- */
    page.expectedStatuses.add(401);
    await loginUI(page, s.base, 'ru@example.com');
    await page.waitForSelector('.sidebar .nav');
    check((await lang(page)) === 'uz', 'signing in applies the language saved in the account');
    const xpBefore = s.db.get("SELECT xp_total n FROM users WHERE email='ru@example.com'").n;
    await pick(page, 'ru');
    await page.waitForFunction(() => true);
    await page.waitForTimeout(400);
    check(s.db.get("SELECT ui_language l FROM users WHERE email='ru@example.com'").l === 'ru', 'the language is saved in the user profile');
    check(s.db.get("SELECT xp_total n FROM users WHERE email='ru@example.com'").n === xpBefore, 'switching does not change XP');
    const nav = await page.locator('.sidebar .nav a').allInnerTexts();
    check(nav.length === 7 && !nav.some((t) => /^(Home|Courses|Profile|Practice|Vocabulary)$/i.test(t.trim())), 'the whole navigation is translated');
    // a second device (fresh browser context, English left over in its storage) gets the server-side language after sign-in
    const other = await openPage(browser, viewport, { lang: 'en' });
    other.expectedStatuses.add(401); other.setDefaultTimeout(15000);
    await loginUI(other, s.base, 'ru@example.com'); await other.waitForSelector('.sidebar .nav');
    check((await lang(other)) === 'ru', 'the profile language is restored after signing in on another device');
    await other.evaluate(() => localStorage.setItem('lexi.lang', 'en')); await other.reload(); await other.waitForSelector('.sidebar .nav');
    check((await lang(other)) === 'ru', 'and wins over a stale device value after the next authenticated refresh');
    await other.context().close();
    // sign out; a different account must not inherit it
    await page.goto(s.base + '/profile'); await page.waitForSelector('form');
    await page.locator('button.danger').filter({ hasText: /.+/ }).last().click();
    await page.locator('dialog button').last().click();
    await page.waitForURL('**/login**');
    await loginUI(page, s.base, 'uz@example.com'); await page.waitForSelector('.sidebar .nav');
    const uzUser = s.db.get("SELECT ui_language l FROM users WHERE email='uz@example.com'").l;
    check(uzUser !== 'ru', 'another account keeps its own language setting (no leak through the device)');

    /* ---------- no overflow with long Russian texts at small widths ---------- */
    for (const w of [320, 375, 768, 1440]) {
      const p = await openPage(browser, { width: w, height: 800 }, { lang: 'ru' });
      p.setDefaultTimeout(15000); p.expectedStatuses.add(401); p.expectedStatuses.add(409);
      let ok = true;
      for (const url of ['/', '/login', '/register']) { await p.goto(s.base + url); await p.waitForSelector('form, .landing'); ok = ok && await noOverflow(p); }
      await loginUI(p, s.base, 'ru@example.com'); await p.waitForSelector('#main .stack, #main .path, #main h1');
      for (const url of ['/learn', '/practice', '/vocabulary', '/review', '/leaderboard', '/achievements', '/profile']) { await p.goto(s.base + url); await p.waitForTimeout(500); ok = ok && await noOverflow(p); }
      check(ok, `no horizontal overflow in Russian at ${w}px`);
      check(p.problems.length === 0, `no console or network problems in Russian at ${w}px ${p.problems.join('; ')}`);
      await p.context().close();
    }

    /* ---------- untranslated English must not leak into Russian / Uzbek screens ---------- */
    const leak = /\b(Continue|Settings|Sign out|Loading|Cancel|Something went wrong|Daily goal|Start review|Save changes)\b/;
    for (const code of ['ru', 'uz']) {
      s.db.run("UPDATE users SET ui_language = ? WHERE email = 'boss@example.com'", code);
      const p = await openPage(browser, viewport, { lang: code });
      p.setDefaultTimeout(15000); p.expectedStatuses.add(401);
      await loginUI(p, s.base, 'boss@example.com'); await p.waitForSelector('#main .stack, #main .path, #main h1');
      let bad = [];
      for (const url of ['/learn', '/practice', '/vocabulary', '/review', '/leaderboard', '/achievements', '/profile']) {
        await p.goto(s.base + url); await p.waitForTimeout(500);
        const txt = await p.locator('body').innerText(); const m = txt.match(leak); if (m) bad.push(url + ':' + m[0]);
      }
      check(bad.length === 0, `no stray English interface text in ${code}: ${bad.join(', ')}`);
      await p.context().close();
    }

    /* ---------- admin: translated panel, completeness page, validated edit ---------- */
    s.db.run("UPDATE users SET ui_language = 'ru' WHERE email = 'boss@example.com'");
    const adm = await openPage(browser, viewport, { lang: 'ru' });
    adm.setDefaultTimeout(15000); adm.expectedStatuses.add(401); adm.expectedStatuses.add(400);
    await adm.goto(s.base + '/admin/login');
    await adm.fill('input[name=email]', 'boss@example.com'); await adm.fill('input[name=password]', 'Passw0rd!x'); await adm.click('button[type=submit]');
    await adm.waitForURL('**/admin');
    await adm.waitForSelector('.adm-main h1');
    check(/Обзор/.test(await adm.locator('.adm-main h1').innerText()), 'the admin panel follows the chosen language');
    await adm.goto(s.base + '/admin/translations'); await adm.waitForSelector('.lang-card');
    check((await adm.locator('.lang-card').count()) === 3, 'the translations page shows the completeness of all three languages');
    const pct = await adm.locator('.lang-card [role=progressbar]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-valuenow')));
    check(pct.every((x) => Number(x) === 100), 'every language is 100% complete against the English reference');
    await adm.locator('tbody tr').first().locator('button', { hasText: /.+/ }).last().click();
    await adm.waitForSelector('dialog textarea');
    await adm.locator('dialog textarea').first().fill('<b>x</b>');
    await adm.locator('dialog button[type=submit]').click();
    await adm.waitForSelector('dialog .error-text:not([hidden]), dialog .form-error:not([hidden])');
    check(true, 'invalid translations (markup) are rejected before publishing');
    await adm.keyboard.press('Escape');
    check(adm.problems.length === 0, 'no console problems in the admin panel ' + adm.problems.join('; '));
    await adm.context().close();
  });
  const ok = summary('i18n UI');
  await s.stop();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
