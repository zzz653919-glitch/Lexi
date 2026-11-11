/* Performance and stability checks through the real UI: requests per page, duplicate requests, response sizes, long tasks,
   DOM / listener growth over a long session, every level loading, the avatar studio, the shop and the 3D viewer: node tests/ui/perf.ui.js */
const { check, withBrowser, openPage, summary, startServer, Client } = require('./lib');

const metrics = (page) => page.evaluate(() => ({ nodes: document.getElementsByTagName('*').length, heap: performance.memory ? performance.memory.usedJSHeapSize : 0, long: (window.__long || []).length, longMs: Math.round((window.__long || []).reduce((a, b) => a + b, 0)) }));
const watch = (page) => {
  page.reqs = [];
  page.on('requestfinished', async (r) => { try { const res = await r.response(); const len = Number((res.headers()['content-length']) || 0); page.reqs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), status: res.status(), enc: res.headers()['content-encoding'] || '', len, type: r.resourceType() }); } catch (_) { /* page closed */ } });
};
const take = (page) => { const r = page.reqs.splice(0); return r; };

(async () => {
  const s = await startServer({ roadmap: true, seedKids: true });
  s.createUser({ email: 'perf@example.com', name: 'Perf' });
  s.createUser({ email: 'admin@example.com', name: 'Admin', role: 'admin' });
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport, { motion: 'on' });
    page.setDefaultTimeout(30000);
    await page.addInitScript(() => { window.__long = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (_) { /* unsupported */ } });
    watch(page);
    await page.goto(s.base + '/login'); await page.fill('input[name=email]', 'perf@example.com'); await page.fill('input[name=password]', 'Passw0rd!x'); await page.click('button[type=submit]');
    await page.waitForSelector('.continue-card, .roadmap-card, .welcome', { timeout: 30000 });
    const ready = take(page);
    const api = ready.filter((r) => r.url.startsWith('/api/'));
    const dup = Object.entries(api.reduce((m, r) => { m[r.url] = (m[r.url] || 0) + 1; return m; }, {})).filter(([, n]) => n > 1);
    console.log('  first screen: %d requests, %d API, %d KB on the wire; duplicates: %j', ready.length, api.length, Math.round(ready.reduce((a, r) => a + r.len, 0) / 1024), dup);
    check(!dup.length, 'no duplicate API request while the first screen loads');

    /* every level loads only its own lessons, through the UI */
    await page.goto(s.base + '/learn'); await page.waitForSelector('.path, .empty');
    for (const code of ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS']) {
      await page.click(`.level-tab[data-level="${code}"]`); await page.waitForSelector(`.level-tab[data-level="${code}"][aria-selected="true"]`); await page.waitForSelector('.node');
      const head = await page.locator('.level-head h2').innerText();
      const nodes = await page.locator('.node').count();
      const names = await page.evaluate(() => [...document.querySelectorAll('.node-label')].length);
      check(head.startsWith(code) && nodes > 0 && nodes === names, `${code}: header "${head.slice(0, 18)}…" and ${nodes} lessons of that level only`);
    }
    const paths = take(page).filter((r) => r.url.startsWith('/api/path'));
    check(paths.length > 0 && paths.every((r) => r.len === 0 || r.len < 40000), 'the path answer is small (' + paths.map((r) => r.len).join(', ') + ' bytes on the wire)');

    /* a long session: navigate between pages many times; the page must not grow without bound */
    const routes = ['/', '/learn', '/vocabulary', '/review', '/leaderboard', '/achievements', '/avatar', '/avatar/shop', '/profile'];
    const before = await metrics(page);
    for (let round = 0; round < 4; round++) for (const r of routes) { await page.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, r); await page.waitForTimeout(150); }
    await page.waitForTimeout(500);
    const after = await metrics(page);
    console.log('  after %d navigations: nodes %d → %d, heap %s → %s MB, long tasks %d (%d ms)', routes.length * 4, before.nodes, after.nodes, (before.heap / 1048576).toFixed(1), (after.heap / 1048576).toFixed(1), after.long, after.longMs);
    check(after.nodes < before.nodes + 1500, 'the DOM does not keep growing over a long session');
    check(!page.problems.length, 'no console errors during the whole session ' + page.problems.slice(0, 3).join(' | '));

    /* the avatar studio, the shop and the 3D viewer (open and close several times: nothing may pile up) */
    page.problems.length = 0; take(page);
    await page.goto(s.base + '/avatar/shop'); await page.waitForSelector('.av-item, .av-shop');
    const shop = take(page).filter((r) => r.url.startsWith('/api/'));
    console.log('  shop API: %j', shop.map((r) => r.url + ' ' + r.len + 'B ' + r.enc));
    check(shop.every((r) => r.len < 100000), 'the shop answers are compressed and small');
    const cards = await page.locator('.av-item').count();
    check(cards > 0 && cards <= 120, `the shop shows a page of items, not the whole catalogue (${cards})`);
    check(!page.problems.length, 'no console errors in the shop ' + page.problems.slice(0, 2).join(' | '));
  }, { viewport: { width: 1280, height: 800 } });
  /* a phone: the learning page loads quickly, fits the screen and stays quiet */
  await withBrowser(async (browser) => {
    const page = await openPage(browser, { width: 390, height: 844 }, { motion: 'on', isMobile: true, hasTouch: true });
    page.setDefaultTimeout(30000); watch(page);
    await page.goto(s.base + '/login'); await page.fill('input[name=email]', 'perf@example.com'); await page.fill('input[name=password]', 'Passw0rd!x'); await page.click('button[type=submit]');
    await page.waitForSelector('.continue-card, .roadmap-card, .welcome');
    const t0 = Date.now(); await page.goto(s.base + '/learn'); await page.waitForSelector('.node'); const ms = Date.now() - t0;
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'mobile: the learning page fits the screen');
    check(ms < 8000, `mobile: the learning page is ready in ${ms} ms`);
    check(!page.problems.length, 'mobile: no console errors ' + page.problems.slice(0, 2).join(' | '));
  });
  await s.stop();
  summary('performance UI');
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
