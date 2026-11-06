const test = require('node:test');
const assert = require('node:assert');
const { startServer } = require('./helpers');
const mailer = require('../../server/lib/mailer');

test('password recovery sends an account-confirmation e-mail from Lexio in the user language', async () => {
  const sent = [];
  const s = await startServer({ mailer: async (m) => { sent.push(m); } });
  try {
    s.createUser({ email: 'forgot@example.com' });
    for (const lang of ['en', 'uz', 'ru']) {
      sent.length = 0;
      const r = await fetch(s.base + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': lang, 'X-Lang': lang, Cookie: 'lexi_lang=' + lang }, body: JSON.stringify({ email: 'forgot@example.com' }) });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(sent.length, 1, 'one e-mail is sent: ' + lang);
      const m = sent[0];
      assert.strictEqual(m.to, 'forgot@example.com');
      assert.ok(/Lexio/.test(m.subject) && /Lexio/.test(m.text) && /Lexio/.test(m.html), 'the message comes from the Lexio site');
      assert.ok(m.link.includes('/confirm?token='), 'it contains the reset link');
      assert.ok(m.text.includes(m.link) && m.html.includes('/confirm?token='));
      assert.ok(!/\{brand\}|\{minutes\}|mail\./.test(m.subject + m.text), 'no unresolved placeholders or keys');
    }
    // an unknown address gets the same answer and no e-mail
    sent.length = 0;
    const r2 = await fetch(s.base + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.com' }) });
    assert.strictEqual(r2.status, 200); assert.strictEqual(sent.length, 0);
  } finally { await s.stop(); }
});

test('a failing mail provider does not change the answer or reveal the account', async () => {
  const s = await startServer({ mailer: async () => { throw new Error('provider down'); } });
  try {
    s.createUser({ email: 'f2@example.com' });
    const a = await fetch(s.base + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'f2@example.com' }) });
    const b = await fetch(s.base + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.com' }) });
    assert.strictEqual(a.status, 200); assert.strictEqual(b.status, 200);
    assert.deepStrictEqual(await a.json(), await b.json());
  } finally { await s.stop(); }
});

test('mailer: sends through the provider API with the Lexio sender name; no key means no provider', async () => {
  assert.strictEqual(mailer.fromEnv({}), null);
  const calls = [];
  const send = mailer.fromEnv({ RESEND_API_KEY: 'test-key', MAIL_FROM: 'no-reply@example.com' }, async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; });
  await send({ to: 'a@example.com', subject: 'S', text: 'T', html: '<p>H</p>' });
  assert.strictEqual(calls[0].url, 'https://api.resend.com/emails');
  const body = JSON.parse(calls[0].init.body);
  assert.strictEqual(body.from, 'Lexio <no-reply@example.com>'); assert.deepStrictEqual(body.to, ['a@example.com']);
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer test-key');
  const failing = mailer.fromEnv({ RESEND_API_KEY: 'k' }, async () => ({ ok: false, status: 403 }));
  await assert.rejects(() => failing({ to: 'a@example.com', subject: 'S', text: 'T', html: 'H' }));
  assert.ok(!mailer.recoveryMessage({ t: (k) => k, link: 'https://x/?a=1&b=<2>' }).html.includes('<2>'), 'the link is escaped in the HTML');
});
