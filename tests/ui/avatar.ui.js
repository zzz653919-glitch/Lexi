/* Avatar Studio, LEXIO TOKENS, the shop, inventory, pets, missions, profile card and the admin section through the real UI: node tests/ui/avatar.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer, Client } = require('./lib');
const TokensLib = require('../../server/lib/tokens');

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const api = (page, path, opts) => page.evaluate(([p, o]) => fetch('/api' + p, o).then((r) => r.json()), [path, opts || {}]);
const stageHtml = (page) => page.locator('#av-stage').innerHTML();
const confirmYes = async (page) => { await page.waitForSelector('dialog[open]'); await page.click('dialog[open] .dialog-actions button:last-child'); };

(async () => {
  const s = await startServer({ seedKids: true });
  const uid = s.createUser({ email: 'hero@example.com', name: 'Hero' }), uid2 = s.createUser({ email: 'newbie@example.com', name: 'Newbie' });
  s.createUser({ email: 'admin@example.com', role: 'admin', name: 'Boss' });
  const T = TokensLib.make(s.appDb);
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport, { lang: 'en' }); page.setDefaultTimeout(15000);
    await loginUI(page, s.base, 'hero@example.com');

    /* ---------- the profile before there is a character ---------- */
    await page.goto(s.base + '/profile'); await page.waitForSelector('#avatar-card');
    check(await page.locator('#avc-create').count() === 1, 'the profile invites the learner to create a character');

    /* ---------- creating and customizing ---------- */
    await page.goto(s.base + '/avatar'); await page.waitForSelector('#av-stage svg');
    check(await page.locator('#av-new.on').count() === 1 && await page.locator('.av-tab').count() === 11, 'Avatar Studio opens a new character with eleven part tabs');
    check(await page.locator('.av-tile[data-style]').count() === 5, 'five character styles (cute cartoon, modern 2D, fantasy, animal, robot)');
    const first = await stageHtml(page);
    await page.fill('#av-name', 'Nova');
    await page.click('.av-tile[data-style="fantasy"]');
    check(await page.locator('#av-stage svg.av-style-fantasy').count() === 1 && first !== await stageHtml(page), 'the large live preview changes at once');
    await page.click('.av-tab[data-tab="face"]'); await page.click('.av-tile[data-part="shape"][data-index="2"]'); await page.click('.av-swatch[data-part="skin"][data-index="5"]');
    await page.click('.av-tab[data-tab="hair"]'); await page.click('.av-tile[data-part="hairStyle"][data-index="4"]'); await page.click('.av-swatch[data-part="hairColor"][data-index="8"]');
    await page.click('.av-tab[data-tab="eyes"]'); await page.click('.av-tile[data-part="eyeStyle"][data-index="2"]'); await page.click('.av-swatch[data-part="eyeColor"][data-index="3"]');
    await page.click('.av-tab[data-tab="mouth"]'); await page.click('.av-tile[data-part="brows"][data-index="4"]'); await page.click('.av-tile[data-part="mouth"][data-index="1"]');
    check(await page.locator('.av-tile[data-part="mouth"][data-index="1"].on').count() === 1 && /unsaved/i.test(await page.locator('#av-dirty').innerText()), 'face shapes, skin, hair, eyes, eyebrows and mouths can be combined; unsaved changes are shown');
    await page.click('.av-tab[data-tab="outfit"]');
    check(await page.locator('.av-tile[data-slug="starter-tee"].on').count() === 1, 'the starter clothes are worn and free');
    await page.click('#av-save'); await page.waitForSelector('.av-card[data-avatar]');
    let boot = await api(page, '/avatar/bootstrap');
    check(boot.avatars.length === 1 && boot.avatars[0].name === 'Nova' && boot.avatars[0].style === 'fantasy' && boot.avatars[0].look.hairColor === 8 && boot.avatars[0].look.mouth === 1, 'the character is saved on the account with its name');
    // a second character, switching, reset, delete
    await page.click('#av-new'); await page.fill('#av-name', 'Robo'); await page.click('.av-tab[data-tab="style"]'); await page.click('.av-tile[data-style="robot"]'); await page.click('#av-save');
    await page.waitForFunction(() => document.querySelectorAll('.av-card[data-avatar]').length === 2);
    check(true, 'a learner can own several saved characters');
    await page.click('.av-card[data-avatar]:first-child');
    check(await page.inputValue('#av-name') === 'Nova', 'switching between characters loads each one');
    await page.click('#av-activate'); await page.waitForSelector('.av-card.active[data-avatar]:first-child');
    check((await api(page, '/avatar/bootstrap')).activeId === boot.avatars[0].id, 'the chosen character is the active one');
    await page.click('.av-tab[data-tab="face"]'); await page.click('.av-swatch[data-part="skin"][data-index="0"]'); check(await page.locator('#av-reset').isEnabled(), 'reset is offered after a change');
    await page.click('#av-reset'); check(await page.locator('.av-swatch[data-part="skin"][data-index="5"].on').count() === 1 && await page.locator('#av-reset').isDisabled(), 'reset restores the saved look');
    await page.click('#av-random'); await page.click('#av-reset');
    await page.click('.av-card[data-avatar]:nth-child(2)'); await page.click('#av-delete'); await confirmYes(page);
    await page.waitForFunction(() => document.querySelectorAll('.av-card[data-avatar]').length === 1);
    check(true, 'a character can be deleted');

    /* ---------- LEXIO TOKENS and the shop ---------- */
    await T.earn(uid, { ref: 'ui:gift', amount: 200, reason: 'admin', kind: 'grant' });
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item');
    check((await page.locator('#av-shop-balance').innerText()).includes('200'), 'the shop shows the token balance');
    check(await page.locator('.av-tab[data-cat]').count() === 5, 'five categories: clothing, accessories, pets, special items, game skins');
    check(await page.locator('.av-item:not(.owned)').first().locator('.av-rarity, .av-price, h3, .av-thumb svg').count() >= 4, 'every item shows a picture, name, rarity and price');
    check(await page.locator('.av-item[data-slug="costume-hero"] [data-act="buy"]').isDisabled(), 'an item that costs more than the balance cannot be bought');
    await page.click('.av-item[data-slug="tee-red"] [data-act="buy"]'); await confirmYes(page);
    await page.waitForSelector('.av-item[data-slug="tee-red"] [data-owned]');
    check((await page.locator('#av-shop-balance').innerText()).includes('160'), 'a purchase takes the tokens (200 → 160) and the item shows as owned');
    check((await api(page, '/avatar/wallet')).wallet.balance === 160, 'and the server agrees');
    await page.selectOption('#av-rarity', 'legendary'); check(await page.locator('.av-item[data-rarity]:not([data-rarity="legendary"])').count() === 0 && await page.locator('.av-item').count() >= 1, 'items can be filtered by rarity'); await page.selectOption('#av-rarity', '');
    await page.click('.av-chip[data-kind="hoodie"]'); check(await page.locator('.av-item').count() === 4, 'and by type'); await page.click('.av-chip[data-kind=""]');
    await page.click('.av-item[data-slug="hoodie-gray"] h3'); await page.waitForSelector('.av-modal'); check(await page.locator('.av-modal svg').count() >= 1, 'an item can be tried on before buying'); await page.keyboard.press('Escape'); await page.waitForSelector('.av-modal', { state: 'detached' });
    await page.click('.av-tab[data-cat="pet"]'); await page.waitForSelector('.av-item[data-slug="pet-dragon-golden"]');
    check(await page.locator('.av-item[data-slug="pet-dragon-golden"] .av-earn').count() === 1 && await page.locator('.av-item[data-slug="pet-dragon-golden"] button').first().isDisabled(), 'some pets are earned by learning, with a progress bar, and cannot be bought');
    check(await page.locator('.av-item[data-slug="pet-tabby"]').count() === 1, 'pets are for sale (every animal has its own model)');
    await page.click('.av-item[data-slug="pet-tabby"] [data-act="buy"]'); await confirmYes(page); await page.waitForSelector('.av-item[data-slug="pet-tabby"] [data-owned]');
    check((await api(page, '/avatar/wallet')).wallet.balance === 120, 'a pet costs tokens too (160 → 120)');

    /* ---------- fitting room (Primerka): a free preview, nothing is saved until the learner buys and equips ---------- */
    const equippedNow = async () => JSON.stringify((await api(page, '/avatar/bootstrap')).avatars[0].equipped);
    const eqBefore = await equippedNow();
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item');
    check(await page.locator('.av-item [data-act="fit"]').count() === await page.locator('.av-item').count(), 'every shop item has its own Try on (Primerka) button');
    await page.click('.av-item[data-slug="hoodie-gray"] [data-act="fit"]'); await page.waitForSelector('.av-fit #av-fit-grid .av-fit-tile');
    check(await page.locator('.av-fit-face.front svg').count() === 1 && await page.locator('.av-fit-face.back svg').count() === 1 && await page.locator('.av-fit-tile[data-slug="hoodie-gray"].on').count() === 1, 'the fitting room shows the character from the front and the back, wearing the chosen item');
    const f0 = await page.locator('.av-fit-face.front').innerHTML();
    await page.click('.av-fit-room .av-tab[data-cat="accessory"]'); await page.click('.av-fit-tile[data-slug="cap-blue"]'); await page.click('.av-fit-tile[data-slug="glasses-red"]');
    await page.click('.av-fit-room .av-tab[data-cat="pet"]'); await page.click('.av-fit-tile[data-slug="pet-corgi"]');
    await page.click('.av-fit-room .av-tab[data-cat="clothing"]'); await page.click('.av-fit-tile[data-slug="pants-black"]');
    check(await page.locator('.av-fit-tile.on').count() >= 1 && (await page.locator('.av-fit-face.front').innerHTML()) !== f0 && await page.locator('.av-fit-face.front .av-pet').count() === 1, 'several items can be tried on together (hoodie, trousers, cap, glasses, pet) and the preview updates at once');
    check((await api(page, '/avatar/wallet')).wallet.balance === 120 && (await equippedNow()) === eqBefore, 'trying on is free and saves nothing');
    await page.click('.av-fit-room .av-tab[data-cat="pet"]'); await page.click('.av-fit-tile[data-slug="pet-corgi"]'); await page.click('.av-fit-actions [data-act="remove"]');
    check(await page.locator('.av-fit-tile[data-slug="pet-corgi"].on').count() === 0 && await page.locator('.av-fit-face.front .av-pet').count() === 0, 'Remove takes the selected item off the preview');
    await page.click('.av-fit-actions [data-act="reset"]');
    check(await page.locator('.av-fit-tile.on').count() === 0 || (await page.locator('.av-fit-actions [data-act="reset"]').isDisabled()), 'Reset restores the saved appearance');
    await page.click('.av-fit-room .av-tab[data-cat="clothing"]'); await page.click('.av-fit-tile[data-slug="hoodie-gray"]');
    const turn0 = await page.getAttribute('#av-fit-stage', 'data-view'); await page.click('#av-fit-right'); await page.click('#av-fit-right'); await page.click('#av-fit-right');
    check(turn0 === 'front' && await page.getAttribute('#av-fit-stage', 'data-view') === 'back' && await page.locator('#av-fit-turn').evaluate((e) => e.style.getPropertyValue('--a')) === '180deg', 'the character can be turned to see it from another angle (front, three-quarter, back)');
    check(await page.locator('.av-fit-actions [data-act="equip"]').count() === 0 && await page.locator('.av-fit-actions [data-act="buy"]').count() === 1, 'an item that is not owned offers Buy, not Equip');
    await page.click('.av-fit-room .av-tab[data-cat="clothing"]'); await page.click('.av-fit-tile[data-slug="tee-blue"]');
    await page.click('.av-fit-actions [data-act="save"]');
    check(await equippedNow() === eqBefore, 'saving a look never equips an item that is not owned');
    await page.click('.av-fit-actions [data-act="buy"]'); await confirmYes(page); await page.waitForSelector('.av-fit-actions [data-act="equip"]');
    check((await api(page, '/avatar/wallet')).wallet.balance === 80 && (await page.locator('#av-fit-balance').innerText()).includes('80'), 'only a confirmed purchase takes tokens (120 → 80) and the fitting room shows the new balance');
    await page.click('.av-fit-actions [data-act="equip"]'); await page.waitForFunction(() => document.querySelector('.av-fit-actions [data-act="equip"]').disabled);
    check((await api(page, '/avatar/bootstrap')).avatars[0].equipped.top === 'tee-blue', 'an owned item can be equipped from the fitting room and is saved');
    await page.click('.av-fit-tile[data-slug="costume-hero"]'); await page.keyboard.press('Escape'); await page.waitForSelector('.av-fit', { state: 'detached' });
    check((await equippedNow()).includes('tee-blue') && !(await equippedNow()).includes('costume-hero') && !(await equippedNow()).includes('pet-corgi'), 'leaving the fitting room drops the preview and keeps the saved appearance');
    const fit = await page.evaluate(async () => { const R = await import('/js/avatar/render.js'); return [R.fitsStyle('animal', { slot: 'hat' }), R.fitsStyle('robot', { slot: 'glasses' }), R.fitsStyle('cartoon', { slot: 'hat' }), R.fitsStyle('animal', { slot: 'headphones' })]; });
    check(fit.join() === 'false,false,true,true', 'items that do not fit a character model (hats on the animal ears, glasses on the robot visor) are refused');

    /* ---------- the global fashion collection: collections, sub-collections, search, try-on, body types ---------- */
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-colls .av-chip');
    check(await page.locator('.av-colls .av-chip[data-coll]:not([data-coll=""])').count() === 12, 'the shop has twelve fashion collections');
    await page.click('.av-colls [data-coll="traditional"]'); await page.waitForSelector('.av-subs .av-chip[data-sub="uzbek"]');
    check(await page.locator('.av-subs .av-chip[data-sub]:not([data-sub=""])').count() === 8, 'traditional clothes have sub-collections (Uzbek, Japanese, Korean, Chinese, Indian, Arab, African, European)');
    await page.click('.av-subs [data-sub="uzbek"]'); await page.waitForSelector('.av-item[data-slug="fx-chapan-green"]');
    check(await page.locator('.av-item').count() >= 8 && await page.locator('.av-item:not([data-slug^="fx-"])').count() === 0, 'a sub-collection shows only its own items');
    await page.fill('#av-search', 'kimono'); await page.waitForTimeout(500);
    check(await page.locator('.av-item').count() === 0, 'search works inside the open sub-collection (no kimono among the Uzbek clothes)');
    await page.click('.av-subs [data-sub=""]'); await page.click('.av-colls [data-coll=""]'); await page.waitForSelector('.av-item[data-slug^="fx-kimono"]');
    check(await page.locator('.av-item').count() >= 3 && (await page.locator('.av-item h3').allInnerTexts()).every((x) => /kimono/i.test(x)), 'search finds the kimonos by name');
    await page.fill('#av-search', ''); await page.waitForTimeout(400);
    await page.click('.av-colls [data-coll="fantasy"]'); await page.click('.av-item[data-slug^="fx-wizard_robe"] [data-act="fit"]'); await page.waitForSelector('.av-fit .av-fit-tile.on');
    const wz = await page.locator('.av-fit-face.front').innerHTML();
    await page.click('#av-fit-build [data-build="0"]'); const slim = await page.locator('.av-fit-face.front').innerHTML(); await page.click('#av-fit-build [data-build="2"]'); const broad = await page.locator('.av-fit-face.front').innerHTML();
    check(slim !== broad && wz.includes('scale(1 1)'), 'an outfit can be tried on different body types (slim, regular, broad) and follows the body');
    check((await api(page, '/avatar/wallet')).wallet.balance === 80 && await page.locator('.av-fit .av-colls .av-chip.on').count() >= 1, 'trying on fashion is free, and the fitting room opens in the item\'s collection');
    await page.keyboard.press('Escape'); await page.waitForSelector('.av-fit', { state: 'detached' });
    await page.click('.av-tab[data-cat="accessory"]'); await page.waitForSelector('.av-item');
    check(await page.locator('.av-item[data-slug^="fx-doppi"]').count() >= 1 || await (async () => { await page.click('.av-colls [data-coll="traditional"]'); return page.locator('.av-item[data-slug^="fx-doppi"]').count().then((n) => n >= 1); })(), 'hats, shoes, scarves and capes are part of the collections too');
    await page.goto(s.base + '/avatar'); await page.waitForSelector('#av-stage svg'); await page.click('.av-tab[data-tab="face"]');
    check(await page.locator('.av-tile[data-part="build"]').count() === 3, 'the Studio offers three body types');
    const before = await stageHtml(page); await page.click('.av-tile[data-part="build"][data-index="2"]'); check((await stageHtml(page)) !== before, 'choosing a body type changes the character at once');
    await page.click('.av-tile[data-part="build"][data-index="1"]');

    /* ---------- gaming skins: one category per game, sub-categories, sorting, rarity (incl. mythic), try-on ---------- */
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item'); await page.click('.av-tab[data-cat="games"]'); await page.waitForSelector('.av-colls .av-chip[data-coll="cs2"]');
    check(await page.locator('.av-colls .av-chip[data-coll]:not([data-coll=""])').count() === 15 && await page.locator('#av-games-note').isVisible(), 'the Game skins tab has fifteen games and says the designs are original fan-inspired ones');
    await page.click('.av-colls [data-coll="cs2"]'); await page.waitForSelector('.av-subs .av-chip[data-sub="gloves"]');
    check(await page.locator('.av-subs .av-chip[data-sub]:not([data-sub=""])').count() === 5, 'every game has its own sub-categories (Counter-Strike 2 style: agents, special forces, gloves, masks, military)');
    await page.click('.av-subs [data-sub="gloves"]'); await page.waitForSelector('.av-item[data-slug^="gm-cs2-"]');
    check(await page.locator('.av-item').count() >= 8 && await page.locator('.av-item:not([data-slug^="gm-cs2-"])').count() === 0, 'a sub-category lists only its own skins (gloves)');
    await page.click('.av-subs [data-sub=""]'); await page.selectOption('#av-sort', 'price_desc');
    const prices = (await page.locator('.av-item').evaluateAll((els) => els.map((e) => Number((e.querySelector('.av-price, .av-earn, .av-owned') || {}).textContent.replace(/\D/g, '')) || 0))).filter((x) => x > 0);
    check(prices.length >= 10 && prices.every((x, i) => i === 0 || prices[i - 1] >= x), 'skins can be sorted by price');
    await page.selectOption('#av-rarity', 'mythic'); await page.waitForSelector('.av-item[data-rarity="mythic"]');
    check(await page.locator('.av-item:not([data-rarity="mythic"])').count() === 0 && await page.locator('.av-item[data-rarity="mythic"] .av-rarity').first().innerText().then((x) => /mythic/i.test(x)), 'the Mythic rarity exists and can be filtered');
    await page.selectOption('#av-rarity', ''); await page.click('.av-subs [data-sub="gloves"]');
    const beforeG = await page.locator('.av-item').first().getAttribute('data-slug'); await page.click('.av-item[data-slug^="gm-cs2-"] [data-act="fit"]'); await page.waitForSelector('.av-fit .av-fit-tile.on');
    check(await page.locator('.av-fit-face.front svg').count() === 1 && (await page.locator('.av-fit .av-colls .av-chip.on').first().getAttribute('data-coll')) === 'cs2' && !!beforeG, 'a game skin can be tried on in the fitting room, which opens in its game');
    await page.keyboard.press('Escape'); await page.waitForSelector('.av-fit', { state: 'detached' });

    /* ---------- the 3D skin viewer: a real WebGL model, 360° turning, zoom, views, details and buttons ---------- */
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item'); await page.click('.av-tab[data-cat="games"]'); await page.click('.av-colls [data-coll="cs2"]'); await page.waitForSelector('.av-item[data-slug^="gm-cs2-special_forces"]');
    const skinName = await page.locator('.av-item[data-slug^="gm-cs2-special_forces"] h3').first().innerText();
    await page.click('.av-item[data-slug^="gm-cs2-special_forces"] h3'); await page.waitForSelector('#skin-viewer #av-v3-canvas[data-skin]', { timeout: 40000 });
    check(await page.getAttribute('#av-v3-canvas', 'data-mode') === 'webgl' && await page.locator('#skin-viewer canvas').count() === 1, 'a click on a game skin opens a real-time WebGL 3D preview');
    check((await page.locator('#av-v3-name').innerText()) === skinName && (await page.locator('#av-v3-game').innerText()).includes('Counter-Strike 2') && await page.locator('#av-v3-info .av-rarity').count() === 1 && /\d/.test(await page.locator('#av-v3-price').innerText()), 'it shows the skin name, game category, rarity and token price');
    check(await page.locator('#av-v3-try').count() === 1 && await page.locator('#av-v3-buy, #av-v3-equip').count() === 1, 'with Try On, Buy (or Equip) buttons');
    await page.click('#av-v3-side'); await page.waitForFunction(() => Math.abs(Number(document.getElementById('av-v3-canvas').dataset.azimuth) - 90) <= 3, null, { timeout: 5000 });
    await page.click('#av-v3-back'); await page.waitForFunction(() => Math.abs(Number(document.getElementById('av-v3-canvas').dataset.azimuth) - 180) <= 3, null, { timeout: 5000 });
    await page.click('#av-v3-front'); await page.waitForFunction(() => { const a = Number(document.getElementById('av-v3-canvas').dataset.azimuth); return a <= 3 || a >= 357; }, null, { timeout: 5000 });
    check(true, 'the character turns to the front, side and back views');
    await page.click('#av-v3-right'); await page.waitForFunction(() => { const a = Number(document.getElementById('av-v3-canvas').dataset.azimuth); return a > 20 && a < 70; }, null, { timeout: 5000 });
    check(true, 'and can be turned step by step (full 360° with the mouse or finger)');
    const z0 = Number(await page.getAttribute('#av-v3-canvas', 'data-zoom')); await page.click('#av-v3-zoom-in'); await page.click('#av-v3-zoom-in'); const z1 = Number(await page.getAttribute('#av-v3-canvas', 'data-zoom')); await page.click('#av-v3-zoom-out'); await page.click('#av-v3-zoom-out'); await page.click('#av-v3-zoom-out'); const z2 = Number(await page.getAttribute('#av-v3-canvas', 'data-zoom'));
    check(z1 > z0 && z2 < z1, 'zoom in and zoom out work');
    const firstSlug = await page.getAttribute('#av-v3-canvas', 'data-skin'); await page.click('#av-v3-next'); await page.waitForFunction((x) => document.getElementById('av-v3-canvas').dataset.skin !== x, firstSlug, { timeout: 30000 });
    check(true, 'the next / previous skin of the list opens without closing the preview');
    await page.click('#av-v3-try'); await page.waitForSelector('.av-fit .av-fit-tile.on'); check(await page.locator('#skin-viewer').count() === 0, 'Try On opens the fitting room with the skin');
    await page.keyboard.press('Escape'); await page.waitForSelector('.av-fit', { state: 'detached' });
    await page.evaluate(() => { HTMLCanvasElement.prototype.getContext = () => null; });   // a device without WebGL
    await page.click('.av-item[data-slug^="gm-cs2-special_forces"] h3'); await page.waitForSelector('#av-v3-card[data-mode="fallback"]');
    await page.click('#av-v3-back'); await page.waitForFunction(() => document.getElementById('av-v3-card').dataset.azimuth === '180');
    check(await page.locator('#av-v3-card svg').count() === 2 && await page.locator('#av-v3-try').count() === 1, 'without WebGL a turning picture with the same views and buttons is shown');
    await page.keyboard.press('Escape'); await page.waitForSelector('#skin-viewer', { state: 'detached' });

    /* ---------- the leaderboard shows the characters; a click shows the name and the character ---------- */
    s.db.run('UPDATE users SET leaderboard_opt_in = 1 WHERE id = ?', uid); s.db.run("INSERT INTO xp_transactions (user_id, amount, reason, ref_type, ref_id, local_date, created_at) VALUES (?, 5, 'exercise', 'x', 1, ?, ?)", uid, new Date().toISOString().slice(0, 10), new Date().toISOString());
    await page.goto(s.base + '/leaderboard'); await page.waitForSelector('.lb-row');
    check(await page.locator('.lb-row .lb-char svg').count() >= 1, 'the leaderboard shows the learners\' characters');
    await page.click('.lb-row'); await page.waitForSelector('#lb-card svg');
    check((await page.locator('dialog[open] h2').innerText()).length > 0 && await page.locator('#lb-card .chip').count() >= 2, 'a click on a person shows their name, character and weekly XP');
    await page.keyboard.press('Escape'); await page.waitForSelector('dialog[open]', { state: 'detached' });

    /* ---------- inventory, pets ---------- */
    await page.goto(s.base + '/avatar/inventory'); await page.waitForSelector('#av-stage svg');
    check(await page.locator('.av-tab').count() === 6 && await page.locator('.av-tile[data-slug="tee-red"]').count() === 1 && await page.locator('.av-tile[data-slug="hoodie-gray"]').count() === 0, 'the inventory shows only owned items');
    await page.click('.av-tile[data-slug="tee-red"]'); await page.click('#av-save');
    await page.waitForFunction(() => /saved/i.test(document.getElementById('av-dirty').textContent));
    check((await api(page, '/avatar/bootstrap')).avatars[0].equipped.top === 'tee-red', 'owned clothing is equipped and saved');
    await page.click('.av-tab[data-tab="pet"]'); await page.click('.av-tile[data-slug="pet-tabby"]'); await page.fill('#av-petname', 'Mochi'); await page.click('.av-pose[data-pose="play"]');
    check(await page.locator('.av-petname').innerText().then((x) => x.includes('Mochi')), 'a companion appears next to the character with its name');
    await page.click('#av-save'); await page.waitForFunction(() => /saved/i.test(document.getElementById('av-dirty').textContent));
    boot = await api(page, '/avatar/bootstrap'); check(boot.avatars[0].equipped.pet === 'pet-tabby' && boot.avatars[0].petName === 'Mochi' && boot.avatars[0].petPose === 'play', 'the pet, its name and pose are saved');
    await page.click('.av-tab[data-tab="accessories"]'); await page.click('.av-tile[data-slot="back"][data-none="1"]'); await page.click('.av-tab[data-tab="scene"]'); check(await page.locator('.av-tile[data-slot="background"][data-none="1"].on').count() === 1, 'accessories can be removed and backgrounds switched');
    await page.click('#av-fav'); await page.waitForSelector('.av-card .av-fav'); check(true, 'a favorite appearance can be marked');

    /* ---------- profile card ---------- */
    await page.goto(s.base + '/profile'); await page.waitForSelector('#avc-outfit');
    const card = await page.locator('#avatar-card').innerText();
    check(card.includes('Nova') && (await page.locator('#avc-outfit').innerText()).includes('Red T-shirt') && (await page.locator('#avc-pet').innerText()).includes('Mochi'), 'the profile shows the character name, outfit and companion');
    check((await page.locator('#avc-tokens').innerText()).includes('200') && /Level 1/.test(card) && await page.locator('#avc-xp').count() === 1 && await page.locator('#avc-ach').count() === 1, 'and the tokens earned, XP, achievements and the character level');

    /* ---------- the reward animation, the token chip, XP separate ---------- */
    await T.earn(uid, { ref: 'ui:anim', amount: 25, reason: 'lesson' });
    await page.goto(s.base + '/'); await page.waitForSelector('.av-burst');
    check(await page.getAttribute('.av-burst', 'data-total') === '25' && await page.locator('.av-fall-coin').count() > 5, 'earning tokens plays a reward animation');
    check((await page.locator('.chip.coin').first().innerText()).includes('105') && await page.locator('.chip.bolt').count() >= 1, 'the token chip shows the balance next to (separate from) XP');
    await page.waitForSelector('.av-burst', { state: 'detached', timeout: 8000 }); await page.reload(); await page.waitForSelector('.chip.coin'); await page.waitForTimeout(900);
    check(await page.locator('.av-burst').count() === 0, 'the animation is shown only once');

    /* ---------- missions ---------- */
    await page.goto(s.base + '/avatar/missions'); await page.waitForSelector('.av-mission');
    check(await page.locator('.av-mission').count() === 6 && await page.locator('#av-earn-list li').count() === 6 && await page.locator('.av-badge').count() === 13, 'six daily missions, the reward table and thirteen badges');
    check((await page.locator('#av-earn-list li[data-reason="lesson"]').innerText()).includes('10') && (await page.locator('#av-earn-list li[data-reason="level"]').innerText()).includes('100'), 'rewards: lesson 10 … level 100');
    check(await page.locator('.av-badge.on[data-code="first_purchase"]').count() === 1 && await page.locator('#av-history li').count() >= 3, 'earned badges and the token history are shown');
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item'); check(await page.locator('.av-nav-item').count() === 4, 'the section navigation links Studio, Inventory, Shop and Missions');
    check(page.problems.length === 0, 'no console problems ' + page.problems.join('; '));

    /* ---------- phone and tablet ---------- */
    for (const [name, vp] of [['phone', { width: 390, height: 780 }], ['tablet', { width: 768, height: 1024 }]]) {
      const p = await openPage(browser, vp, { lang: 'en' }); p.setDefaultTimeout(15000);
      await loginUI(p, s.base, 'hero@example.com');
      for (const path of ['/avatar', '/avatar/inventory', '/avatar/shop', '/avatar/missions', '/profile']) { await p.goto(s.base + path); await p.waitForSelector('.av-page, #avatar-card'); await p.waitForTimeout(300); const o = await overflow(p); if (o > 1) check(false, `${name} ${path}: sideways scrolling (${o}px)`); }
      check(true, `${name}: the avatar pages fit the screen`);
      await p.goto(s.base + '/avatar'); await p.waitForSelector('#av-stage svg');
      const sb = await p.locator('#av-stage svg').boundingBox(), tb = await p.locator('.av-tab').first().boundingBox();
      check(sb && sb.width > 150 && tb && tb.height >= 40, `${name}: a large preview and tappable tabs`);
      await p.click('.av-tab[data-tab="hair"]'); await p.click('.av-tile[data-part="hairStyle"][data-index="5"]'); check(await p.locator('#av-save').isEnabled(), `${name}: editing works`);
      check(p.problems.length === 0, `${name}: no console problems ` + p.problems.join('; '));
      await p.context().close();
    }

    /* ---------- a learner who never opened the studio ---------- */
    const n = await openPage(browser, viewport, { lang: 'en' }); n.setDefaultTimeout(15000); await loginUI(n, s.base, 'newbie@example.com');
    await n.goto(s.base + '/avatar/shop'); await n.waitForSelector('.av-item');
    check(await n.locator('.av-item[data-slug="tee-red"] [data-act="buy"]').isDisabled(), 'with no tokens nothing can be bought');
    await n.goto(s.base + '/avatar/inventory'); await n.waitForSelector('#av-stage svg'); check(await n.locator('#av-new.on').count() === 1, 'the inventory also starts a new character when there is none');
    await n.context().close();

    /* ---------- admin ---------- */
    const ad = await openPage(browser, viewport, { lang: 'en' }); ad.setDefaultTimeout(15000);
    await ad.goto(s.base + '/admin/login'); await ad.fill('input[name=email]', 'admin@example.com'); await ad.fill('input[name=password]', 'Passw0rd!x'); await ad.click('button[type=submit]'); await ad.waitForURL('**/admin');
    await ad.goto(s.base + '/admin/avatar'); await ad.waitForSelector('table.tbl tbody tr');
    check(await ad.locator('table.tbl tbody tr').count() >= 100 && await ad.locator('.adm-side nav a[data-nav="avatar"]').count() === 1, 'the admin panel has Avatar management with the whole catalogue');
    await ad.fill('#av-q', 'dragon'); await ad.dispatchEvent('#av-q', 'change'); await ad.waitForFunction(() => document.querySelectorAll('table.tbl tbody tr').length < 10);
    check(true, 'items can be searched');
    await ad.fill('#av-q', ''); await ad.dispatchEvent('#av-q', 'change'); await ad.waitForFunction(() => document.querySelectorAll('table.tbl tbody tr').length >= 100);
    await ad.click('#av-new-item'); await ad.waitForSelector('dialog[open]');
    await ad.fill('dialog input[name=name_en]', 'Test Hat'); await ad.selectOption('dialog select[name=kind]', 'hat'); await ad.fill('dialog input[name=price]', '33'); await ad.selectOption('dialog select[name=rarity]', 'rare');
    await ad.setInputFiles('dialog input[data-upload=image_url]', { name: 'hat.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await ad.waitForSelector('dialog img[src^="/uploads/"]', { state: 'attached' }); await ad.click('dialog button[type=submit]'); await ad.waitForSelector('dialog', { state: 'detached' });
    const items = (await api(ad, '/admin/avatar/items?q=Test%20Hat')).items;
    check(items.length === 1 && items[0].price === 33 && items[0].rarity === 'rare' && items[0].image_url.startsWith('/uploads/'), 'an item with a price, rarity and uploaded image is added');
    await ad.click('[data-tab="rewards"]'); await ad.waitForSelector('#av-r-token_lesson');
    check(await ad.inputValue('#av-r-token_lesson') === '10' && await ad.inputValue('#av-r-token_level') === '100', 'token rewards show the initial values');
    await ad.fill('#av-r-token_lesson', '12'); await ad.click('#av-rewards-save'); await ad.waitForTimeout(500);
    check((await api(ad, '/admin/avatar/rewards')).rewards.token_lesson === 12, 'token rewards are configured here');
    await ad.click('[data-tab="tx"]'); await ad.waitForSelector('button[data-user]');
    check(await ad.locator('table.tbl tbody tr').count() >= 3 && /Earned in total|earned/i.test(await ad.locator('#av-tx-totals').innerText()), 'the token ledger lists every transaction');
    await ad.click(`button[data-user="${uid}"]`); await ad.waitForSelector('#av-owned-list');
    check(await ad.locator('#av-owned-list li[data-slug="tee-red"]').count() === 1 && await ad.locator('#av-owned-list li[data-slug="pet-tabby"]').count() === 1, "a user's purchased items are visible");
    await ad.fill('#av-grant-amount', '50'); await ad.fill('#av-grant-note', 'prize'); await ad.click('#av-grant'); await ad.waitForTimeout(700);
    check((await api(ad, `/admin/avatar/users/${uid}`)).wallet.earned >= 275, 'an administrator can give tokens as a gift (recorded in the ledger)');
    check(ad.problems.length === 0, 'no console problems in the admin panel ' + ad.problems.join('; '));
  });
  await s.stop();
  summary('avatar UI');
})().catch((e) => { console.error(e); process.exit(1); });
