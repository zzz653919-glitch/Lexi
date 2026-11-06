/* LEXIO KIDS through the real UI: mode choice, dashboard, every game step, stars, badges, parents, responsive layout, admin: node tests/ui/kids.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer } = require('./lib');

async function playLesson(page, { mistakeOnce = false } = {}) {
  let guard = 0, wrongDone = !mistakeOnce;
  while (guard++ < 120) {
    if (await page.locator('.k-result[data-stars]').count()) return;
    if (await page.locator('.k-flash').count()) {
      await page.click('.k-big-btn.me'); await page.click('.k-big-btn.go');
    } else if (await page.locator('.k-match').count()) {
      const ids = await page.$$eval('.k-tile.pic', (els) => els.map((e) => e.dataset.id));
      for (const id of ids) { await page.click(`.k-tile.pic[data-id="${id}"]`); await page.click(`.k-tile.word[data-id="${id}"]`); }
      await page.waitForSelector('.k-flash, .k-options, .k-slots, .k-answers, .k-result', { timeout: 5000 }).catch(() => {});
    } else if (await page.locator('.k-options').count()) {
      const heading = await page.locator('.k-count').innerText();
      if (!wrongDone) { await page.click('.k-option[data-correct="false"]'); wrongDone = true; check(await page.locator('.k-option.wrong').count() === 1, 'a wrong picture is marked and can be retried'); }
      await page.click('.k-option[data-correct="true"]');
      await page.waitForFunction((h0) => { const c = document.querySelector('.k-count'); return !c || c.textContent !== h0 || !document.querySelector('.k-options'); }, heading, { timeout: 5000 });
    } else if (await page.locator('.k-slots').count()) {
      const answer = await page.getAttribute('.k-slots', 'data-answer');
      const word = await page.locator('.k-letter-tile.word').count() > 0;
      const parts = word ? answer.split(' ') : [...answer];
      const label = await page.locator('.k-count').innerText();
      for (const p of parts) await page.locator('.k-letter-tile:not([disabled])', { hasText: new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
      await page.waitForFunction((l0) => { const c = document.querySelector('.k-count'); return !c || c.textContent !== l0 || !document.querySelector('.k-slots'); }, label, { timeout: 6000 });
    } else if (await page.locator('.k-answers').count()) {
      const label = await page.locator('.k-count').innerText();
      await page.click('.k-answer[data-correct="true"]');
      await page.waitForFunction((l0) => { const c = document.querySelector('.k-count'); return !c || c.textContent !== l0 || !document.querySelector('.k-answers'); }, label, { timeout: 5000 });
    } else await page.waitForTimeout(150);
  }
  throw new Error('the game did not finish');
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const s = await startServer({ seedKids: true });
  s.createUser({ email: 'mum@example.com', name: 'Mum' });
  s.createUser({ email: 'admin@example.com', role: 'admin', name: 'Boss' });
  await s.db.run("UPDATE users SET onboarded = 0 WHERE email = 'mum@example.com'");
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport, { lang: 'en' }); page.setDefaultTimeout(15000);
    const external = []; page.on('request', (r) => { const u = r.url(); if (!u.startsWith(s.base) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });

    /* ---------- the mode-selection page ---------- */
    await loginUI(page, s.base, 'mum@example.com');
    await page.goto(s.base + '/learn'); await page.waitForURL('**/welcome');
    check(await page.locator('.welcome .choice-card').count() === 3 && await page.locator('#kids-card').count() === 1, 'the first screen offers the placement test, choosing a level and LEXIO KIDS');
    await page.click('#kids-start'); await page.waitForURL('**/kids');
    check(true, 'LEXIO KIDS opens from the first screen');
    await page.waitForSelector('.k-cat');

    /* ---------- dashboard ---------- */
    check(await page.locator('.k-cat').count() === 14, 'fourteen game categories');
    check(await page.locator('aside, nav.nav, .bottom-nav').count() === 0, 'no adult navigation in Kids mode');
    check(await page.locator('a[href^="http"], iframe, ins').count() === 0, 'no external links, frames or ads');
    check((await page.locator('.k-bubble h1').innerText()).includes('Mum'), 'the mascot greets the child by name');
    check((await page.locator('#k-next').getAttribute('data-slug')) === 'alphabet', 'the recommended next game is the alphabet');
    check(await page.locator('.k-badge').count() === 11 && await page.locator('.k-badge.on').count() === 0, 'badges are shown, none earned yet');
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.kids')).fontFamily.includes('Fredoka')), 'a playful rounded font is used');

    /* ---------- a whole game ---------- */
    await page.click('#k-next'); await page.waitForURL('**/kids/learn/alphabet?part=1');
    await page.waitForSelector('.k-flash');
    check(await page.locator('.k-letter').innerText() === 'Aa' && (await page.locator('.k-word').innerText()) === 'Apple', 'a letter card shows Aa, a picture and the word Apple');
    check((await page.locator('.k-tr').innerText()) === 'olma', 'with the Uzbek translation');
    check(await page.locator('.k-big-btn.say').count() === 1, 'and a listen button');
    await playLesson(page, { mistakeOnce: true });
    check(await page.locator('.k-result').count() === 1, 'the game ends with a result screen');
    const stars = Number(await page.getAttribute('.k-result', 'data-stars'));
    check(stars >= 2, 'stars are given (' + stars + ')');
    check(await page.locator('.k-newbadge[data-code="first_lesson"]').count() === 1, 'a badge is earned for the first game');
    check(await page.locator('#k-next-part').count() === 1, 'the next part of the alphabet is offered');
    await page.click('#k-home'); await page.waitForURL('**/kids'); await page.waitForSelector('.k-cat');
    check(Number(await page.locator('#k-total-stars b').innerText()) === stars, 'the star counter shows the collected stars');
    check(await page.locator('.k-badge.on[data-code="first_lesson"]').count() === 1, 'the badge appears on the dashboard');
    check((await page.locator('#k-today').innerText()).includes('1 games'), "today's activity is counted");
    check((await page.locator('#k-next').getAttribute('href')).endsWith('part=2'), 'the next recommendation is part 2');

    /* ---------- other kinds of cards ---------- */
    await page.goto(s.base + '/kids/learn/colors'); await page.waitForSelector('.k-flash');
    check(await page.locator('.kpic-swatch').count() === 1, 'colors are shown as color swatches');
    await page.goto(s.base + '/kids/learn/numbers'); await page.waitForSelector('.k-flash');
    check(await page.locator('.k-letter').innerText() === '1', 'numbers show the digit and counted objects');
    await page.goto(s.base + '/kids/learn/sentences'); await page.waitForSelector('.k-flash');
    check((await page.locator('.k-word').innerText()).endsWith('.'), 'sentences are shown whole');
    await playLesson(page);
    check(Number(await page.getAttribute('.k-result', 'data-stars')) === 3, 'a sentence game played without mistakes gives 3 stars');

    /* ---------- parents and profile ---------- */
    await page.goto(s.base + '/kids'); await page.waitForSelector('.k-cat');
    await page.click('.k-gear'); await page.waitForSelector('.k-modal');
    await page.click('.k-modal [data-act=standard]'); await page.waitForURL(s.base + '/');
    check((await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))).user.mode === 'standard', 'the parents panel switches back to the standard course');
    await page.goto(s.base + '/profile'); await page.waitForSelector('#mode-card');
    await page.click('#mode-card [data-mode=kids]'); await page.waitForURL('**/kids');
    check((await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))).user.mode === 'kids', 'the profile switches to Kids mode');
    await page.goto(s.base + '/'); await page.waitForURL('**/kids');
    check(true, 'a Kids account opens on its Kids dashboard');
    check(external.length === 0, 'no request left the site ' + external.join(', '));
    check(page.problems.length === 0, 'no console problems ' + page.problems.join('; '));

    /* ---------- phone and tablet ---------- */
    for (const [name, vp] of [['phone', { width: 375, height: 667 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1366, height: 768 }]]) {
      const p = await openPage(browser, vp, { lang: 'en' }); p.setDefaultTimeout(15000);
      await loginUI(p, s.base, 'mum@example.com'); await p.waitForURL('**/kids'); await p.waitForSelector('.k-cat');
      check(await overflow(p) <= 1, `${name}: the dashboard has no sideways scrolling`);
      await p.goto(s.base + '/kids/learn/animals'); await p.waitForSelector('.k-flash');
      check(await overflow(p) <= 1, `${name}: the first game screen fits`);
      const btn = await p.locator('.k-big-btn.go').boundingBox();
      check(btn && btn.height >= 44 && btn.width >= 44, `${name}: buttons are large enough to tap`);
      await p.click('.k-big-btn.me'); await p.click('.k-big-btn.go');
      for (let i = 0; i < 11; i++) { await p.click('.k-big-btn.me'); await p.click('.k-big-btn.go'); if (await p.locator('.k-match').count()) break; }
      await p.waitForSelector('.k-match');
      check(await overflow(p) <= 1, `${name}: the matching game fits`);
      check(p.problems.length === 0, `${name}: no console problems ` + p.problems.join('; '));
      await p.context().close();
    }

    /* ---------- admin ---------- */
    const a = await openPage(browser, viewport, { lang: 'en' }); a.setDefaultTimeout(15000);
    await a.goto(s.base + '/admin/login'); await a.fill('input[name=email]', 'admin@example.com'); await a.fill('input[name=password]', 'Passw0rd!x'); await a.click('button[type=submit]');
    await a.waitForURL('**/admin');
    await a.goto(s.base + '/admin/kids'); await a.waitForSelector('table.tbl tbody tr');
    check(await a.locator('table.tbl tbody tr').count() === 14, 'the admin panel lists the 14 Kids categories');
    check(await a.locator('.nav a[href="/admin/kids"], nav a[href="/admin/kids"]').count() >= 1, 'with a Kids entry in the menu');
    await a.click('table.tbl tbody tr:nth-child(2) a.btn'); await a.waitForSelector('#kids-add-card');
    const before = await a.locator('table.tbl').first().locator('tbody tr').count();
    await a.click('#kids-add-card'); await a.waitForSelector('dialog[open]');
    await a.fill('dialog input[name=en]', 'Zebra'); await a.fill('dialog input[name=uz]', 'zebra'); await a.fill('dialog input[name=pic]', '🦓');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await a.setInputFiles('dialog input[data-upload=image_url]', { name: 'zebra.png', mimeType: 'image/png', buffer: png });
    await a.waitForSelector('dialog img[src^="/uploads/"]', { state: 'attached' });
    check(true, 'an image can be uploaded to a card');
    await a.click('dialog button[type=submit]'); await a.waitForSelector('dialog', { state: 'detached' });
    await a.waitForFunction((n) => document.querySelectorAll('table.tbl')[0].querySelectorAll('tbody tr').length === n + 1, before);
    check(true, 'a new card is added to the category');
    await a.click('#kids-add-question'); await a.waitForSelector('dialog[open]');
    await a.fill('dialog input[name=prompt]', 'Which animal has stripes?'); await a.fill('dialog input[name=correct]', 'Zebra'); await a.fill('dialog input[name=wrong1]', 'Cat');
    await a.click('dialog button[type=submit]'); await a.waitForSelector('dialog', { state: 'detached' });
    await a.waitForFunction(() => document.querySelectorAll('table.tbl')[1].querySelectorAll('tbody tr td')[1] && /stripes/.test(document.querySelectorAll('table.tbl')[1].innerText));
    check(true, 'a quiz question is added');
    check(a.problems.length === 0, 'no console problems in the admin panel ' + a.problems.join('; '));
  });
  await s.stop();
  summary('kids UI');
})().catch((e) => { console.error(e); process.exit(1); });
