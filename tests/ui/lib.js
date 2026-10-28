const { chromium } = require('playwright');
const { startServer, Client } = require('../api/helpers');

let passed = 0, failed = 0;
const failures = [];
function check(cond, message) {
  if (cond) { passed++; console.log('  ok  -', message); } else { failed++; failures.push(message); console.error('  FAIL -', message); }
}
async function withBrowser(fn, { viewport = { width: 1280, height: 800 }, ...ctxOpts } = {}) {
  const browser = await chromium.launch();
  try { return await fn(browser, viewport, ctxOpts); } finally { await browser.close(); }
}
/* a page that records every console error, uncaught exception and failed (>=400, unexpected) request */
async function openPage(browser, viewport, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport, ...ctxOpts });
  const page = await ctx.newPage();
  page.problems = [];
  page.expectedStatuses = new Set();
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.problems.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !page.expectedStatuses.has(r.status())) page.problems.push(`HTTP ${r.status()} ${r.url()}`); });
  return page;
}
function summary(title) { console.log(`\n${title}: ${passed} passed, ${failed} failed`); if (failed) { console.error(failures.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; } return failed === 0; }
async function loginUI(page, base, email, password = 'Passw0rd!x', url = '/login') {
  await page.goto(base + url);
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', password); await page.click('button[type=submit]');
}
module.exports = { check, withBrowser, openPage, summary, loginUI, startServer, Client };
