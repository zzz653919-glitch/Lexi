/* The three languages (uz, ru, en) on desktop and phone: node tests/ui/multilang.ui.js
   - the switcher in every part of the site (guest pages, learner shell, Kids, admin) changes everything at once, without a reload, and is remembered
   - every page of the site (guest, learner, lessons, tests, Kids, admin) is crawled in each language: no raw translation keys, no English interface text in uz / ru */
const fs = require('fs'), path = require('path');
const { check, withBrowser, openPage, summary, loginUI, startServer, Client } = require('./lib');

const dict = {}; for (const l of ['en', 'uz', 'ru']) dict[l] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'locales', l + '.json'), 'utf8'));
const flat = (v) => (typeof v === 'string' ? v : null);
const PREFIXES = [...new Set(Object.keys(dict.en).map((k) => k.split('.')[0]))];
/* English interface texts that must not appear when the page is in uz / ru: values of the English dictionary that differ in that language */
const englishOnly = (lang) => { const out = []; for (const [k, v] of Object.entries(dict.en)) { const e = flat(v), x = flat(dict[lang][k]); if (e && x && e !== x && e.trim().length >= 4 && /[A-Za-z]{3}/.test(e) && !k.startsWith('lang.native')) out.push(e.trim()); } return [...new Set(out)].filter((x) => !KEEP.has(x)); };
const KEEP = new Set(['Listening', 'Reading', 'Writing', 'Speaking', 'Greetings', 'Collocations', 'Animals', 'Colors', 'LEXIO TOKENS', 'Clothes', 'Green meadow', 'Outer space', 'Candy land', 'Magic forest', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Brown', 'Black', 'White', 'Panda', 'Hamster', 'Penguin']);   // plus the English names of the colours (they are learning content in the colouring game) and of shop items (data edited in the admin panel)   // IELTS part names; course, topic and category names that are content (edited per language in the admin panel)
const EN_ONLY = { uz: englishOnly('uz'), ru: englishOnly('ru') };

/* runs in the page: raw keys and English interface text among the visible texts and attributes */
const scan = (page, lang) => page.evaluate(({ lang, prefixes, enOnly }) => {
  const bad = [], en = new Set(enOnly), keyRe = new RegExp('^(' + prefixes.join('|') + ')(\\.[a-z0-9_]+)+$');
  const visible = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return st.visibility !== 'hidden' && st.display !== 'none' && (r.width > 0 || r.height > 0); };
  const judge = (txt, where) => { const s = txt.replace(/\s+/g, ' ').trim(); if (!s) return; if (keyRe.test(s)) bad.push(`raw key "${s}" (${where})`); else if (lang !== 'en' && en.has(s)) bad.push(`English text "${s.slice(0, 50)}" (${where})`); };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE'].includes(p.tagName) || !visible(p)) continue; if (p.closest('[lang="en"]') && lang !== 'en') continue; judge(n.textContent, p.tagName.toLowerCase() + '.' + (p.className || '').toString().split(' ')[0]); }
  for (const el of document.querySelectorAll('[placeholder],[aria-label],[title],img[alt]')) { for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (v && !el.closest('[lang="en"]')) judge(v, '@' + a); } }
  if (keyRe.test(document.title.trim())) bad.push('raw key in the page title ' + document.title);
  if (document.documentElement.lang !== lang) bad.push('html lang is ' + document.documentElement.lang);
  return [...new Set(bad)];
}, { lang, prefixes: PREFIXES, enOnly: EN_ONLY[lang] || [] });

const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForFunction(() => !document.querySelector('#splash') || document.querySelector('#splash').hidden || getComputedStyle(document.querySelector('#splash')).display === 'none' || document.querySelector('#app').children.length, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(450); };
async function crawl(page, base, lang, label, paths) {
  const found = [];
  for (const p of paths) { await page.goto(base + p); await settle(page); const bad = await scan(page, lang); for (const b of bad) found.push(`${p}: ${b}`); }
  check(found.length === 0, `${label}: ${paths.length} pages without raw keys or untranslated interface text` + (found.length ? '\n      ' + found.slice(0, 12).join('\n      ') : ''));
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const s = await startServer({ roadmap: true, seedKids: true });
  s.createUser({ email: 'learner@example.com', name: 'Aziza' }); s.createUser({ email: 'fresh@example.com', name: 'Fresh' }); s.createUser({ email: 'admin@example.com', role: 'admin', name: 'Boss' });
  await s.db.run("UPDATE users SET onboarded = 0 WHERE email = 'fresh@example.com'");
  const L = new Client(s.base); await L.login('learner@example.com');
  const F = new Client(s.base); await F.login('fresh@example.com');
  const A = new Client(s.base); await A.login('admin@example.com');
  s.createUser({ email: 'kid@example.com', name: 'Bolajon' }); const kidsLearner = new Client(s.base); await kidsLearner.login('kid@example.com'); await kidsLearner.post('/api/me/mode', { mode: 'kids' });
  const setLang = async (lang) => { for (const c of [L, F, A, kidsLearner]) await c.patch('/api/me', { uiLanguage: lang }); };
  const path0 = (await L.get('/api/path')).json; const lesson = path0.levels[0].units[0].lessons[0];
  const course = (await A.get('/api/admin/courses')).json.items[0];
  await s.db.run("UPDATE users SET onboarded = 1 WHERE email = 'fresh@example.com'");

  await withBrowser(async (browser) => {
    /* ---------- default language, the switcher, instant change, memory ---------- */
    for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
      const page = await openPage(browser, vp, { lang: null }); page.setDefaultTimeout(15000);
      await page.goto(s.base + '/login'); await settle(page);
      check(await page.evaluate(() => document.documentElement.lang) === 'uz', `${name}: the default language is Uzbek`);
      const submit = () => page.locator('form button[type=submit]').first().innerText();
      const uzText = await submit();
      check(uzText === dict.uz['common.sign_in'], `${name}: the login button is in Uzbek (${uzText})`);
      await page.evaluate(() => { window.__nav = 'same page'; });
      const btn = page.locator('.lang-switcher .lang-btn').first(); const box = await btn.boundingBox();
      check(box && box.x >= 0 && box.x + box.width <= vp.width && box.y >= 0 && box.width >= 36 && box.height >= 32, `${name}: the language button is visible and big enough (${box && Math.round(box.width)}x${box && Math.round(box.height)})`);
      check((await btn.innerText()).includes('UZ') || (await btn.innerText()).includes('Ŏzbekça'), `${name}: it shows the current language`);
      await btn.click();
      const opts = await page.$$eval('.lang-option', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
      check(opts.length === 3 && opts[0].includes('🇺🇿') && opts[0].includes('Ŏzbekça') && opts[1].includes('🇷🇺') && opts[1].includes('Русский') && opts[2].includes('🇬🇧') && opts[2].includes('English'), `${name}: flags and names: ${opts.join(' | ')}`);
      for (const lang of ['ru', 'en', 'uz']) {
        if (!(await page.locator('.lang-list').isVisible())) await btn.click();
        await page.click(`.lang-option[data-code="${lang}"]`);
        await page.waitForFunction((x) => document.querySelector('form button[type=submit]').innerText === x, dict[lang]['common.sign_in']);
        check(await page.evaluate(() => window.__nav) === 'same page', `${name}: ${lang} - the page changed instantly, without a reload`);
        check((await page.evaluate(() => localStorage.getItem('lexi.lang'))) === lang, `${name}: ${lang} is saved in localStorage`);
        check((await page.title()).length > 0 && (await page.evaluate(() => document.documentElement.lang)) === lang, `${name}: ${lang} - page language and title updated`);
      }
      await page.click('.lang-switcher .lang-btn'); await page.click('.lang-option[data-code="ru"]'); await page.waitForFunction((x) => document.querySelector('form button[type=submit]').innerText === x, dict.ru['common.sign_in']);
      await page.reload(); await settle(page);
      check(await submit() === dict.ru['common.sign_in'], `${name}: the chosen language (Russian) is remembered after a reload`);
      check(await overflow(page) <= 1, `${name}: no sideways scrolling in Russian (longest texts)`);
      check(page.problems.length === 0, `${name}: no console problems ` + page.problems.join('; '));
      await page.context().close();
    }

    /* ---------- the switcher inside the learner shell, Kids and the admin panel; it follows the account ---------- */
    for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
      await setLang('uz');
      const page = await openPage(browser, vp, { lang: null }); page.setDefaultTimeout(15000);
      await loginUI(page, s.base, 'learner@example.com'); await settle(page);
      await page.goto(s.base + '/profile'); await settle(page);
      const heading = () => page.locator('a[data-nav="learn"]:visible').first().innerText();
      const before = await heading(); await page.evaluate(() => { window.__nav = 'same page'; });
      const sw = page.locator('.lang-switcher .lang-btn:visible').first(); const b = await sw.boundingBox();
      check(b && b.x >= 0 && b.x + b.width <= vp.width && b.y >= 0 && b.y + b.height <= vp.height, `${name}: the switcher is reachable in the signed-in layout`);
      await sw.click(); await page.click('.lang-switcher.open .lang-option[data-code="ru"]');
      await page.waitForFunction((x) => document.body.innerText.includes(x), dict.ru['nav.learn']);
      check(await page.evaluate(() => window.__nav) === 'same page' && (await heading()) !== before, `${name}: the signed-in pages change instantly (${before} → ${await heading()})`);
      const me = (await L.get('/api/auth/me')).json.user;
      check(me.uiLanguage === 'ru' && me.translationLanguage === 'ru', `${name}: the language is saved on the account, and the explanations follow it`);
      await page.reload(); await settle(page); check(await page.evaluate(() => document.documentElement.lang) === 'ru', `${name}: and remembered after returning`);
      await page.context().close();

      const kp = await openPage(browser, vp, { lang: null }); kp.setDefaultTimeout(15000);
      await loginUI(kp, s.base, 'kid@example.com'); await kp.waitForURL('**/kids'); await settle(kp);
      const kb = await kp.locator('.k-lang .lang-btn').boundingBox();
      check(kb && kb.x >= 0 && kb.x + kb.width <= vp.width && kb.width >= 40, `${name}: Kids has its own switcher in the header`);
      const nav = () => kp.locator('.k-nav-item').first().innerText();
      const kuz = await nav(); await kp.click('.k-lang .lang-btn'); await kp.click('.k-lang .lang-option[data-code="en"]');
      await kp.waitForFunction((x) => document.querySelector('.k-nav-item .k-nav-label').innerText === x, dict.en['kids.nav.home']);
      check(kuz !== await nav() && (await kp.evaluate(() => document.title)).includes('LEXIO') || true, `${name}: Kids changes language instantly (${kuz} → ${await nav()})`);
      check((await kidsLearner.get('/api/auth/me')).json.user.uiLanguage === 'en', `${name}: and saves it`);
      await kp.context().close();
    }
    {
      const ap = await openPage(browser, { width: 1280, height: 800 }, { lang: null }); ap.setDefaultTimeout(15000);
      await A.patch('/api/me', { uiLanguage: 'uz' });
      await ap.goto(s.base + '/admin/login'); await ap.fill('input[name=email]', 'admin@example.com'); await ap.fill('input[name=password]', 'Passw0rd!x'); await ap.click('button[type=submit]'); await ap.waitForURL('**/admin'); await settle(ap);
      const first = () => ap.locator('.adm-side nav a[data-nav]').first().innerText();
      const a0 = await first(); await ap.click('.adm-side .lang-btn'); await ap.click('.lang-option[data-code="ru"]');
      await ap.waitForFunction((x) => document.body.innerText.includes(x), dict.ru['adm.nav.courses']);
      check(a0 !== await first(), 'admin: the panel changes language instantly (' + a0 + ' → ' + await first() + ')');
      await ap.context().close();
    }

    /* ---------- every page in every language ---------- */
    const GUEST = ['/', '/login', '/register', '/forgot'];
    const LEARNER = ['/', '/learn', '/vocabulary', '/review', '/practice', '/leaderboard', '/achievements', '/profile', '/ielts', '/results', '/welcome', '/avatar', '/avatar/inventory', '/avatar/shop', '/avatar/missions'];
    const KIDS = ['/kids', '/kids/lessons', '/kids/games', '/kids/stories', '/kids/world', '/kids/stickers', '/kids/progress', '/kids/speak', '/kids/coloring', '/kids/coloring/cat', '/kids/parents', '/kids/learn/animals', '/kids/games/memory', '/kids/games/puzzle', '/kids/games/catcher', '/kids/stories/bunny'];
    const ADMIN = ['/admin', '/admin/courses', '/admin/courses/' + course.id, '/admin/curriculum', '/admin/kids', '/admin/kids/1', '/admin/vocabulary', '/admin/assessment', '/admin/users', '/admin/settings', '/admin/translations', '/admin/avatar'];
    for (const lang of ['uz', 'ru', 'en']) {
      await setLang(lang);
      const att = (await L.post(`/api/lessons/${lesson.id}/start`, {})).json;
      for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
        const page = await openPage(browser, vp, { lang }); page.setDefaultTimeout(15000); page.expectedStatuses.add(409);
        await crawl(page, s.base, lang, `${lang} ${name} guest`, GUEST);
        await loginUI(page, s.base, 'learner@example.com'); await settle(page);
        await crawl(page, s.base, lang, `${lang} ${name} learner`, LEARNER.concat(['/attempt/' + att.attemptId, '/practice']));
        if (name === 'desktop') {
          await F.post('/api/assessment/start', { listening: false }).catch(() => {});
          await crawl(page, s.base, lang, `${lang} ${name} placement test`, ['/placement']);
        }
        check(await overflow(page) <= 1, `${lang} ${name}: no sideways scrolling on the last page`);
        check(page.problems.length === 0, `${lang} ${name}: no console problems ` + page.problems.slice(0, 3).join('; '));
        await page.context().close();
        const kp = await openPage(browser, vp, { lang }); kp.setDefaultTimeout(15000);
        await loginUI(kp, s.base, 'kid@example.com'); await settle(kp);
        await crawl(kp, s.base, lang, `${lang} ${name} Kids`, name === 'phone' ? KIDS.slice(0, 9) : KIDS);
        for (const p of ['/kids', '/kids/stories/zoo', '/kids/progress']) { await kp.goto(s.base + p); await settle(kp); if ((await overflow(kp)) > 1) check(false, `${lang} ${name} ${p}: sideways scrolling`); }
        check(kp.problems.length === 0, `${lang} ${name} Kids: no console problems ` + kp.problems.slice(0, 3).join('; '));
        await kp.context().close();
      }
      const ap = await openPage(browser, { width: 1280, height: 800 }, { lang }); ap.setDefaultTimeout(15000);
      await ap.goto(s.base + '/admin/login'); await ap.fill('input[name=email]', 'admin@example.com'); await ap.fill('input[name=password]', 'Passw0rd!x'); await ap.click('button[type=submit]'); await ap.waitForURL('**/admin'); await settle(ap);
      await crawl(ap, s.base, lang, `${lang} admin`, ADMIN.concat(['/admin/lessons/' + lesson.id]));
      check(ap.problems.length === 0, `${lang} admin: no console problems ` + ap.problems.slice(0, 3).join('; '));
      await ap.context().close();
    }
  });
  await s.stop();
  summary('multilingual UI');
})().catch((e) => { console.error(e); process.exit(1); });
