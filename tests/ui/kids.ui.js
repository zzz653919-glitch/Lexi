/* LEXIO KIDS through the real UI: mode choice, home, navigation, lessons, 8 games, stories, world, stickers, speaking, colouring, parents, friends: node tests/ui/kids.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer, Client } = require('./lib');

const jsClick = (page, sel) => page.$eval(sel, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));          // moving elements (falling words, floating bubbles) are clicked directly
const dismiss = async (page) => { for (let i = 0; i < 3; i++) { const b = page.locator('.k-reward-pop .k-big-btn'); if (await b.count()) { await b.first().click(); await page.waitForTimeout(150); } else break; } };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const countText = (page) => page.locator('.k-count').first().innerText().catch(() => '');
const advance = async (page, before) => { await page.waitForFunction((b) => { const c = document.querySelector('.k-count'); return !c || c.textContent !== b || document.querySelector('.k-result[data-stars]'); }, before, { timeout: 9000 }); };

async function playLesson(page, { mistakeOnce = false } = {}) {
  let guard = 0, wrongDone = !mistakeOnce;
  while (guard++ < 140) {
    if (await page.locator('.k-result[data-stars]').count()) return;
    if (await page.locator('.k-flash').count()) { await page.click('.k-big-btn.me'); await page.click('.k-big-btn.go'); }
    else if (await page.locator('.k-match').count()) {
      const ids = await page.$$eval('.k-tile.pic', (els) => els.map((e) => e.dataset.id));
      for (const id of ids) { await page.click(`.k-tile.pic[data-id="${id}"]`); await page.click(`.k-tile.word[data-id="${id}"]`); }
      await page.waitForSelector('.k-flash, .k-options, .k-slots, .k-answers, .k-result', { timeout: 5000 }).catch(() => {});
    } else if (await page.locator('.k-options').count()) {
      const c = await countText(page);
      if (!wrongDone) { await page.click('.k-option[data-correct="false"]'); wrongDone = true; check(await page.locator('.k-option.wrong').count() === 1, 'a wrong picture is marked and can be retried'); }
      await page.click('.k-option[data-correct="true"]'); await advance(page, c);
    } else if (await page.locator('.k-slots').count()) {
      const answer = await page.getAttribute('.k-slots', 'data-answer'), word = await page.locator('.k-letter-tile.word').count() > 0, c = await countText(page);
      for (const p of (word ? answer.split(' ') : [...answer])) await page.locator('.k-letter-tile:not([disabled])', { hasText: new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
      await advance(page, c);
    } else if (await page.locator('.k-answers').count()) { const c = await countText(page); await page.click('.k-answer[data-correct="true"]'); await advance(page, c); }
    else await page.waitForTimeout(150);
  }
  throw new Error('the lesson did not finish');
}

/* every mini game is played to its end through the page */
async function playGame(page, code) {
  let guard = 0;
  while (guard++ < 160) {
    if (await page.locator('.k-result[data-stars]').count()) return;
    const c = await countText(page);
    if (code === 'catcher' && await page.locator('.k-fallword').count()) { await jsClick(page, '.k-fallword[data-correct="true"]'); await advance(page, c); }
    else if (code === 'match' && await page.locator('.k-match').count()) { const ids = await page.$$eval('.k-tile.pic', (els) => els.map((e) => e.dataset.id)); for (const id of ids) { await page.click(`.k-tile.pic[data-id="${id}"]`); await page.click(`.k-tile.word[data-id="${id}"]`); } await page.waitForSelector('.k-result[data-stars]', { timeout: 5000 }); }
    else if (code === 'bubbles' && await page.locator('.k-bubble-opt').count()) { await jsClick(page, '.k-bubble-opt[data-correct="true"]'); await advance(page, c); }
    else if (code === 'memory' && await page.locator('.k-mem').count()) {
      const ids = [...new Set(await page.$$eval('.k-mem', (els) => els.map((e) => e.dataset.id)))];
      for (const id of ids) { await page.click(`.k-mem[data-id="${id}"][data-kind="word"]`); await page.click(`.k-mem[data-id="${id}"][data-kind="pic"]`); await page.waitForSelector(`.k-mem[data-id="${id}"].done`, { timeout: 3000 }); }
      await page.waitForSelector('.k-result[data-stars]', { timeout: 5000 });
    } else if (code === 'sounds' && await page.locator('.k-answer').count()) { await page.click('.k-answer[data-correct="true"]'); await advance(page, c); }
    else if (code === 'colorhunt' && await page.locator('.k-obj').count()) { for (const el of await page.$$('.k-obj[data-match="true"]')) await el.click(); await advance(page, c); }
    else if (code === 'builder' && await page.locator('.k-slots').count()) { const answer = await page.getAttribute('.k-slots', 'data-answer'); for (const ch of answer) await page.locator('.k-letter-tile:not([disabled])', { hasText: new RegExp('^' + ch + '$') }).first().click(); await advance(page, c); }
    else if (code === 'puzzle' && await page.locator('.k-answer').count()) { await page.click('.k-answer[data-correct="true"]'); await advance(page, c); }
    else await page.waitForTimeout(150);
  }
  throw new Error('game ' + code + ' did not finish');
}

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
    await page.goto(s.base + '/learn'); await page.waitForURL('**/welcome'); await page.waitForSelector('#kids-card');
    check(await page.locator('.welcome .choice-card').count() === 3 && await page.locator('#kids-card').count() === 1, 'the first screen offers the placement test, choosing a level and LEXIO KIDS');
    await page.click('#kids-start'); await page.waitForURL('**/kids'); await page.waitForSelector('#k-missions');

    /* ---------- home and the big navigation ---------- */
    check(await page.locator('aside, nav.nav, .bottom-nav').count() === 0, 'no adult navigation in Kids mode');
    check(await page.locator('a[href^="http"], iframe, ins').count() === 0, 'no external links, frames or ads');
    check(await page.locator('.k-nav .k-nav-item').count() === 7, 'a big illustrated navigation with seven buttons');
    check((await page.$$eval('.k-nav-item', (a) => a.map((x) => x.dataset.nav))).join() === 'home,lessons,games,stories,world,stickers,progress', 'Home, Lessons, Games, Stories, My World, Stickers, My Progress');
    check((await page.locator('.k-speech').first().innerText()).includes('Mum'), 'the learning friend greets the child by name');
    check(await page.locator('.k-companion svg').count() >= 1, 'the friend is a drawn character');
    check(await page.locator('.k-mission').count() === 5 && await page.locator('.k-mission.done').count() === 0, 'five daily missions with progress bars');
    check((await page.locator('#k-next').getAttribute('data-slug')) === 'alphabet', 'the recommended next lesson is the alphabet');
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.kids')).fontFamily.includes('Fredoka')), 'a playful rounded font is used');
    for (const [key, sel, path] of [['lessons', '.k-cat', '/kids/lessons'], ['games', '.k-game', '/kids/games'], ['stories', '.k-book', '/kids/stories'], ['world', '.k-place', '/kids/world'], ['stickers', '.k-sticker', '/kids/stickers'], ['progress', '.k-badge', '/kids/progress']]) {
      await page.click(`.k-nav-item[data-nav="${key}"]`); await page.waitForURL('**' + path); await page.waitForSelector(sel);
      check(await page.locator(`.k-nav-item.on[data-nav="${key}"]`).count() === 1, `${key}: opens from the navigation and is highlighted`);
    }
    await page.goto(s.base + '/kids/lessons'); await page.waitForSelector('.k-cat');
    check(await page.locator('.k-cat').count() === 14, 'Lessons shows the fourteen categories');
    await page.goto(s.base + '/kids/progress'); await page.waitForSelector('.k-badge');
    check(await page.locator('.k-badge').count() === 11 && await page.locator('.k-badge.on').count() === 0, 'badges are shown, none earned yet');

    /* ---------- a whole lesson, with the friend reacting ---------- */
    await page.goto(s.base + '/kids'); await page.waitForSelector('#k-next'); await page.click('#k-next'); await page.waitForURL('**/kids/learn/alphabet?part=1'); await page.waitForSelector('.k-flash');
    check(await page.locator('.k-letter').innerText() === 'Aa' && (await page.locator('.k-word').innerText()) === 'Apple', 'a letter card shows Aa, a picture and the word Apple');
    check(await page.locator('.k-tr').count() === 0 && !(await page.locator('.k-flash').innerText()).includes('olma') && await page.locator('.k-big-btn.say').count() === 1, 'no translation is shown under the word, and there is a listen button');
    check((await page.locator('.k-speech').innerText()).length > 3, 'the friend explains the task');
    await playLesson(page, { mistakeOnce: true });
    const stars = Number(await page.getAttribute('.k-result', 'data-stars'));
    check(stars >= 2 && await page.locator('.k-newbadge[data-code="first_lesson"]').count() === 1, 'the lesson gives stars and a badge (' + stars + ')');
    await page.waitForTimeout(1300); await dismiss(page);
    await page.click('#k-home'); await page.waitForURL('**/kids'); await page.waitForSelector('#k-missions');
    check(Number(await page.locator('#k-total-stars b').innerText()) >= stars, 'the star counter shows the collected stars');
    check(await page.locator('.k-mission[data-code="lesson"].done').count() === 1, 'the "complete one lesson" mission is done');
    check(await page.locator('.k-mission[data-code="words"].done').count() === 1, 'and the five new words mission');

    /* ---------- all eight mini games ---------- */
    await page.goto(s.base + '/kids/games'); await page.waitForSelector('.k-game');
    check(await page.locator('.k-game').count() === 8, 'eight mini games');
    for (const code of ['catcher', 'match', 'bubbles', 'memory', 'sounds', 'colorhunt', 'builder', 'puzzle']) {
      await page.goto(s.base + '/kids/games/' + code); await page.waitForSelector('.k-step-head');
      await playGame(page, code);
      const st = Number(await page.getAttribute('.k-result', 'data-stars'));
      check(st >= 1, `${code}: played to the end with ${st} star(s)`);
      await page.waitForTimeout(1000); await dismiss(page);
    }
    await page.goto(s.base + '/kids'); await page.waitForSelector('#k-missions');
    check(await page.locator('.k-mission[data-code="game"].done').count() === 1 && await page.locator('.k-mission[data-code="quiz"].done').count() === 1 && await page.locator('.k-mission[data-code="listen"].done').count() === 1, 'game, quiz and listening missions are done');
    check(await page.locator('.k-bonus').count() === 1, 'all five missions give a bonus');

    /* ---------- a story: highlighted words, narration, questions ---------- */
    await page.goto(s.base + '/kids/stories'); await page.waitForSelector('.k-book');
    check(await page.locator('.k-book').count() === 6, 'six storybooks');
    await page.click('.k-book[data-story="bunny"]'); await page.waitForSelector('.k-scene');
    check(await page.locator('.k-prop').count() >= 2 && await page.locator('.k-story-tr, .k-tr').count() === 0, 'an illustrated page; no translation lines in Kids');
    await page.waitForSelector('.k-w.hl', { timeout: 4000 }); check(true, 'words are highlighted while the story is read');
    check(await page.locator('.k-w').count() >= 4, 'every word can be tapped');
    for (let i = 0; i < 5; i++) { await page.click('#k-next-page'); await page.waitForFunction((n) => document.querySelector('.k-count').textContent.startsWith(String(n)), i + 2); }
    await page.click('#k-next-page'); await page.waitForSelector('.k-answer');
    for (let i = 0; i < 2; i++) { const c = await countText(page); await page.click('.k-answer[data-correct="true"]'); await advance(page, c); }
    await page.waitForSelector('.k-result[data-story]'); check(Number(await page.getAttribute('.k-result', 'data-stars')) === 3, 'the story ends with questions and stars');
    await page.waitForTimeout(1000); await dismiss(page);

    /* ---------- speaking and listening ---------- */
    await page.goto(s.base + '/kids/speak'); await page.waitForSelector('[data-mode=words]');
    check(await page.locator('#k-mic-note').innerText().then((x) => /out loud/i.test(x)), 'without the parent\'s permission no microphone is used');
    await page.click('[data-mode=words]');
    for (let i = 0; i < 5; i++) { await page.waitForSelector('#k-say-it'); await page.click('#k-say-it'); check(await page.locator('#k-speak-next').isEnabled(), i === 0 ? 'repeating a word is never blocked or punished' : 'next word is open'); await page.click('#k-speak-next'); }
    await page.waitForSelector('#k-speak-done'); await page.waitForTimeout(1000); await dismiss(page);
    await page.click('#k-speak-again'); await page.click('[data-mode=listen]'); await page.waitForSelector('.k-option');
    await page.click('.k-option[data-correct="false"]'); check(await page.locator('.k-option.soft').count() === 1, 'a wrong picture gets a gentle hint, no penalty');
    for (let i = 0; i < 5; i++) { await page.waitForSelector('.k-option[data-correct="true"]'); await page.click('.k-option[data-correct="true"]:not(.right)'); await page.waitForTimeout(1100); }
    await page.waitForSelector('#k-speak-done'); await dismiss(page);

    /* ---------- colouring ---------- */
    await page.goto(s.base + '/kids/coloring'); await page.waitForSelector('.k-art-card');
    check(await page.locator('.k-art-card').count() === 8, 'eight pictures to color');
    await page.click('.k-art-card[data-picture="cat"]'); await page.waitForSelector('.k-region');
    await page.click('.k-swatch[data-color="#ef4444"]');
    for (const i of [0, 1, 2]) await jsClick(page, `.k-region[data-r="${i}"]`);
    check(await page.getAttribute('.k-region[data-r="1"]', 'fill') === '#ef4444', 'a tapped part takes the chosen color');
    await page.waitForSelector('.k-reward-pop', { timeout: 6000 }); await dismiss(page);
    const art = await page.evaluate(() => fetch('/api/kids/art/cat').then((r) => r.json()));
    check(Object.keys(art.fills).length === 3, 'the colouring is saved on the account');
    await page.goto(s.base + '/kids/coloring/cat'); await page.waitForSelector('.k-region');
    check(await page.getAttribute('.k-region[data-r="0"]', 'fill') === '#ef4444', 'and comes back when the picture is opened again');

    /* ---------- world, stickers, friends ---------- */
    await page.goto(s.base + '/kids/world'); await page.waitForSelector('.k-place');
    check(await page.locator('.k-place').count() === 6, 'the world has six places');
    const opened = await page.locator('.k-place[data-unlocked="true"]').count();
    check(opened >= 2 && opened < 6, `places open with stars (${opened} open)`);
    check(await page.locator('.k-place[data-unlocked="true"] .k-decor.on').count() >= 1, 'decorations appear as the child learns');
    await page.goto(s.base + '/kids/stickers'); await page.waitForSelector('.k-sticker');
    const earned = await page.locator('.k-sticker.on').count();
    check(earned >= 4 && await page.locator('.k-sticker[data-earned="false"]').count() >= 10, `the album shows earned (${earned}) and locked stickers`);
    check(await page.locator('.k-sticker[data-code="game_memory"][data-earned="true"]').count() === 1, 'playing the memory game earned its sticker');
    await page.click('.k-tab[data-tab="animals"]'); check(await page.locator('.k-sticker[data-kind="animal"]').count() === 12, 'twelve collectible animals');
    await page.click('.k-tab[data-tab="dress"]'); await page.waitForSelector('.k-sticker.dress');
    check(await page.locator('.k-sticker[data-kind="accessory"][data-code="crown"][data-earned="false"]').count() === 1, 'the golden crown is still locked (40 stars)');
    await page.click('.k-sticker[data-kind="character"][data-code="fox"] button'); await page.waitForSelector('.k-sticker[data-code="fox"].wearing');
    check((await page.evaluate(() => fetch('/api/kids/profile').then((r) => r.json()))).character === 'fox', 'a favorite friend can be chosen and is saved');
    await page.click('#k-friend'); await page.waitForSelector('.k-pick');
    check(await page.locator('.k-pick[data-kind="accessory"][data-code="crown"].locked').count() === 1 && await page.locator('.k-pick[data-kind="character"]').count() === 6, 'the friend picker offers six friends, locked rewards cannot be chosen');
    await page.click('.k-pick[data-kind="character"][data-code="bunny"]'); await page.waitForSelector('.k-pick[data-code="bunny"].on');
    await page.keyboard.press('Escape'); await page.waitForSelector('.k-modal', { state: 'detached' });
    await page.goto(s.base + '/kids'); await page.waitForSelector('.k-companion');
    check(await page.locator('.k-hero .k-companion[data-character="bunny"]').count() === 1, 'the chosen friend appears on the home page');

    /* ---------- parents ---------- */
    await page.click('.k-gear'); await page.waitForSelector('#k-gate');
    check(await page.locator('#k-par-stats').count() === 0, 'the parent area is closed behind a grown-up question');
    page.expectedStatuses.add(400); await page.fill('#k-gate-input', '1'); await page.click('#k-gate-ok'); await page.waitForSelector('#k-gate-error:not([hidden])');
    check(true, 'a wrong answer does not open it');
    const a = Number(await page.getAttribute('#k-gate-q', 'data-a')), b = Number(await page.getAttribute('#k-gate-q', 'data-b'));
    await page.fill('#k-gate-input', String(a + b)); await page.click('#k-gate-ok'); await page.waitForSelector('#k-par-stats');
    check(Number((await page.locator('#k-par-lessons b').innerText()).split('/')[0]) >= 1, 'lessons completed are shown');
    check(Number(await page.locator('#k-par-words b').innerText()) >= 10, 'words learned are shown');
    check(/\d+ \/ \d+ \/ \d+/.test(await page.locator('#k-par-time b').innerText()), 'learning time is shown');
    check(await page.locator('#k-par-recommended .k-rec-link').count() === 3 && await page.locator('#k-par-settings .k-cat-bars, .k-cat-bars li').count() >= 14, 'recommended lessons and progress by category');
    check(await page.locator('#k-set-mic').isChecked() === false && await page.locator('#k-set-reminders').isChecked() === false, 'privacy-conscious defaults: microphone and reminders are off');
    await page.uncheck('#k-set-narration'); await page.selectOption('#k-set-age', 'young'); await page.fill('#k-set-limit', '5'); await page.dispatchEvent('#k-set-limit', 'change'); await page.check('#k-set-reminders'); await page.waitForTimeout(500);
    const prof = await page.evaluate(() => fetch('/api/kids/profile').then((r) => r.json()));
    check(prof.narration === false && prof.age === 'young' && prof.dailyLimitMin === 5 && prof.reminders === true, 'audio, age group, time limit and reminders are saved');
    await page.fill('#k-set-pin', '2468'); await page.click('#k-set-pin-save'); await page.waitForTimeout(400);
    await s.db.run("UPDATE kids_days SET seconds = 900"); await page.click('#k-par-lock'); await page.waitForURL('**/kids'); await page.waitForSelector('#k-break');
    check(await page.locator('#k-next').count() === 0, 'when the daily limit is reached the home page offers a break');
    await page.goto(s.base + '/kids/games/memory'); await page.waitForSelector('#k-break'); check(true, 'and games are paused too');
    await page.goto(s.base + '/kids/parents'); await page.waitForSelector('#k-gate-input'); check(await page.getAttribute('#k-gate-input', 'name') === 'pin', 'a PIN replaces the question once set');
    await page.fill('#k-gate-input', '2468'); await page.click('#k-gate-ok'); await page.waitForSelector('#k-par-stats');
    check(await page.locator('#k-par-standard').count() === 0, 'there is no button that leaves Kids mode');
    check(external.length === 0, 'no request left the site ' + external.join(', '));
    check(page.problems.length === 0, 'no console problems ' + page.problems.join('; '));

    /* ---------- phone, tablet, desktop ---------- */
    const api = new Client(s.base); await api.login('mum@example.com'); await api.post('/api/me/mode', { mode: 'kids' });
    await api.patch('/api/kids/parent/settings', { dailyLimitMin: 0, age: 'older' }, { headers: { 'X-Parent-Token': (await (async () => { const pin = await api.post('/api/kids/parent/verify', { pin: '2468' }); return pin.json.token; })()) } });
    for (const [name, vp] of [['phone', { width: 375, height: 667 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1366, height: 768 }]]) {
      const p = await openPage(browser, vp, { lang: 'en' }); p.setDefaultTimeout(15000);
      await loginUI(p, s.base, 'mum@example.com'); await p.waitForURL('**/kids'); await p.waitForSelector('#k-missions');
      for (const path of ['/kids', '/kids/lessons', '/kids/games', '/kids/stories', '/kids/world', '/kids/stickers', '/kids/progress', '/kids/speak', '/kids/coloring', '/kids/coloring/apple', '/kids/stories/zoo', '/kids/games/memory', '/kids/games/catcher', '/kids/games/bubbles', '/kids/learn/animals']) {
        await p.goto(s.base + path); await p.waitForSelector('.kids'); await p.waitForTimeout(250);
        const o = await overflow(p); if (o > 1) check(false, `${name} ${path}: sideways scrolling (${o}px)`);
      }
      check(true, `${name}: no page scrolls sideways`);
      await p.goto(s.base + '/kids'); await p.waitForSelector('.k-nav');
      const nb = await p.locator('.k-nav-item').first().boundingBox();
      check(nb && nb.height >= 44 && nb.width >= 40, `${name}: navigation buttons are large enough to tap`);
      if (vp.width <= 900) check((await p.locator('.k-nav').evaluate((n) => getComputedStyle(n).position)) === 'fixed', `${name}: the navigation stays at the bottom`);
      check(p.problems.length === 0, `${name}: no console problems ` + p.problems.join('; '));
      await p.context().close();
    }

    /* ---------- admin (cards, images, audio, questions) ---------- */
    const ad = await openPage(browser, viewport, { lang: 'en' }); ad.setDefaultTimeout(15000);
    await ad.goto(s.base + '/admin/login'); await ad.fill('input[name=email]', 'admin@example.com'); await ad.fill('input[name=password]', 'Passw0rd!x'); await ad.click('button[type=submit]'); await ad.waitForURL('**/admin');
    await ad.goto(s.base + '/admin/kids'); await ad.waitForSelector('table.tbl tbody tr');
    check(await ad.locator('table.tbl tbody tr').count() === 14, 'the admin panel lists the 14 Kids categories');
    await ad.click('table.tbl tbody tr:nth-child(2) a.btn'); await ad.waitForSelector('#kids-add-card');
    const before = await ad.locator('table.tbl').first().locator('tbody tr').count();
    await ad.click('#kids-add-card'); await ad.waitForSelector('dialog[open]');
    await ad.fill('dialog input[name=en]', 'Zebra'); await ad.fill('dialog input[name=uz]', 'zebra'); await ad.fill('dialog input[name=pic]', '🦓');
    await ad.setInputFiles('dialog input[data-upload=image_url]', { name: 'zebra.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await ad.waitForSelector('dialog img[src^="/uploads/"]', { state: 'attached' });
    await ad.click('dialog button[type=submit]'); await ad.waitForSelector('dialog', { state: 'detached' });
    await ad.waitForFunction((n) => document.querySelectorAll('table.tbl')[0].querySelectorAll('tbody tr').length === n + 1, before);
    check(true, 'admin: a card with an uploaded image is added');
    check(ad.problems.length === 0, 'no console problems in the admin panel ' + ad.problems.join('; '));
  }, { viewport: { width: 1280, height: 900 } });
  await s.stop();
  summary('kids UI');
})().catch((e) => { console.error(e); process.exit(1); });
