/* Browser test: without IndexedDB the app falls back to localStorage and keeps progress: node tests/storage-fallback.test.js */
const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { playLesson } = require('./helpers/lesson-solver');
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

(async () => {
  const b = await playwright.chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(APP + '#/learn'); await p.waitForSelector('.strip');
  assert((await p.evaluate(() => VL.db.backend)) === 'localstorage', 'backend is localStorage');
  await p.evaluate(() => VL.io.loadSample()); await p.waitForTimeout(400);
  await p.evaluate(() => VL.views.learn.startType('translate')); await p.waitForSelector('.lesson');
  const r = await playLesson(p, { wrongEvery: 0, stopAfter: 3, maxSteps: 20 });
  assert(r.answered === 3 && r.mismatches.length === 0, 'three typed answers checked');
  const before = await p.evaluate(() => ({ xp: VL.store.state.days.reduce((a, d) => a + d.xp, 0), words: VL.store.state.words.length, lesson: !!VL.store.state.lesson }));
  await p.waitForTimeout(500); await p.reload(); await p.waitForSelector('.strip');
  const after = await p.evaluate(() => ({ xp: VL.store.state.days.reduce((a, d) => a + d.xp, 0), words: VL.store.state.words.length, lesson: !!VL.store.state.lesson }));
  assert(after.words === before.words && after.words > 0, 'words survive a reload (' + after.words + ')');
  assert(after.xp === before.xp && after.xp > 0, 'XP survives a reload (' + after.xp + ')');
  assert(after.lesson === true, 'the paused lesson is saved');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
