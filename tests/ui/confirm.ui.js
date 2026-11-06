/* "Yes, it is me": the e-mail link signs the person in automatically, then a new password is set without the old one */
const fs = require('fs'), path = require('path');
const { withBrowser, openPage, check, summary, startServer } = require('./lib');
(async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'who@example.com', password: 'OldPassw0rd1' });
    await withBrowser(async (browser, viewport) => {
      const page = await openPage(browser, viewport, { lang: 'uz' });
      await page.goto(s.base + '/forgot');
      await page.fill('input[name=email]', 'who@example.com'); await page.click('button[type=submit]');
      await page.waitForTimeout(800);
      const log = fs.readFileSync(path.join(s.dir, 'outbox', 'password-resets.log'), 'utf8');
      const link = /(https?:\/\/\S+\/confirm\?token=[\w-]+)/.exec(log)[1];
      await page.goto(link);
      await page.waitForURL('**/profile', { timeout: 8000 });
      check(true, 'the link signs the person in and opens the profile');
      check(await page.locator('input[name=currentPassword]').count() === 0, 'no old-password field is asked');
      await page.fill('input[name=newPassword]', 'BrandNew1Pass'); await page.click('form:has(input[name=newPassword]) button[type=submit]');
      await page.waitForTimeout(800);
      const c = await (await fetch(s.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: s.base }, body: JSON.stringify({ email: 'who@example.com', password: 'BrandNew1Pass' }) })).status;
      check(c === 200, 'the new password works');
      const p2 = await openPage(browser, viewport, { lang: 'uz' });
      await p2.goto(link); await p2.waitForTimeout(1200);
      check(/login|confirm/.test(p2.url()) && await p2.locator('.form-error').count() === 1, 'a used link shows an error');
      check(page.problems.length === 0, 'no console problems ' + page.problems.join('; '));
    });
  } finally { await s.stop(); }
  summary('confirm UI');
})();
