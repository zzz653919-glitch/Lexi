const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, Client } = require('./helpers');
const core = require('../../shared/i18n-core');

const ROOT = path.join(__dirname, '..', '..');
const dict = Object.fromEntries(['en', 'uz', 'ru'].map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', l + '.json'), 'utf8'))]));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('every language has exactly the same keys, placeholders and plural forms as English', () => {
  const keys = Object.keys(dict.en);
  for (const l of ['uz', 'ru']) {
    assert.deepStrictEqual(Object.keys(dict[l]).sort(), keys.slice().sort(), `${l} has the same keys as en`);
    for (const k of keys) {
      assert.deepStrictEqual(core.placeholdersOf(dict[l][k]).sort(), core.placeholdersOf(dict.en[k]).sort(), `${l}:${k} placeholders`);
      assert.strictEqual(typeof dict[l][k], typeof dict.en[k], `${l}:${k} is plural like English`);
      if (typeof dict[l][k] === 'object') { assert.ok('other' in dict[l][k], `${l}:${k} has "other"`); for (const c of Object.keys(dict[l][k])) assert.ok(core.PLURAL_CATEGORIES[l].includes(c), `${l}:${k} category ${c}`); }
      else assert.ok(String(dict[l][k]).trim() && (k === 'val.i18n_bad_encoding' || !/�/.test(dict[l][k])), `${l}:${k} is not empty or broken`);
    }
  }
});

test('every translation key used in the source code exists in the dictionaries', () => {
  const files = walk(path.join(ROOT, 'public')).filter((f) => f.endsWith('.js')).concat(walk(path.join(ROOT, 'server')).filter((f) => f.endsWith('.js')));
  const used = new Set(), prefixes = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:t|n|T|tr|has|msg)\(\s*'([a-z_]+(?:\.[A-Za-z0-9_]+)+)'/g)) (/[._]$/.test(m[1]) ? prefixes : used).add(m[1]);
    for (const m of src.matchAll(/'((?:err|val|msg|path)\.[a-z_0-9]+)'/g)) used.add(m[1]);
  }
  const missing = [...used].filter((k) => !(k in dict.en));
  assert.deepStrictEqual(missing, [], 'keys used in code but missing from locales/en.json');
  for (const p of prefixes) assert.ok(Object.keys(dict.en).some((k) => k.startsWith(p)), `a key starting with ${p} exists`);
});

test('plurals, interpolation and the English fallback', () => {
  const d = { en: { x: { one: '{n} word', other: '{n} words' }, only_en: 'Hello {name}' }, ru: { x: { one: '{n} слово', few: '{n} слова', many: '{n} слов', other: '{n} слова' } } };
  const r = (n) => core.translate(d, 'ru', 'x', { n });
  assert.deepStrictEqual([1, 2, 5, 21, 22, 25].map(r), ['1 слово', '2 слова', '5 слов', '21 слово', '22 слова', '25 слов']);
  assert.strictEqual(core.translate(d, 'ru', 'only_en', { name: 'Ann' }), 'Hello Ann', 'a missing translation falls back to English');
  assert.strictEqual(core.translate(d, 'uz', 'nope'), 'nope', 'an unknown key shows the key, never undefined');
  assert.strictEqual(core.translate(d, 'en', 'x', { n: 1 }), '1 word');
});

test('default language, language list and texts endpoint', async () => {
  const s = await startServer();
  try {
    const c = new Client(s.base);
    const cfg = (await c.get('/api/public/config')).json;
    assert.strictEqual(cfg.defaultLanguage, 'uz');
    assert.deepStrictEqual(cfg.languages.map((l) => l.label), ['🇺🇿 O‘zbekcha', '🇷🇺 Русский', '🇬🇧 English']);
    const ru = (await c.get('/api/i18n/ru')).json;
    assert.strictEqual(ru.messages['nav.home'], dict.ru['nav.home']);
    assert.strictEqual((await c.get('/api/i18n/xx')).status, 404);
    // server messages follow the request language
    const bad = (lang) => c.req('POST', '/api/auth/login', { email: 'no@x.com', password: 'x' }, { headers: { 'X-Lang': lang } });
    assert.strictEqual((await bad('uz')).json.error, dict.uz['err.login_failed']);
    assert.strictEqual((await bad('ru')).json.error, dict.ru['err.login_failed']);
    assert.strictEqual((await bad('en')).json.error, dict.en['err.login_failed']);
  } finally { await s.stop(); }
});

test('the language is stored per account, restored after sign-in and never leaks between accounts', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'a@x.com' }); s.createUser({ email: 'b@x.com' });
    const a = new Client(s.base); await a.login('a@x.com', 'Passw0rd!x');
    assert.strictEqual((await a.patch('/api/me', { uiLanguage: 'ru' })).status, 200);
    assert.strictEqual((await a.patch('/api/me', { uiLanguage: 'de' })).status, 400, 'unsupported languages are rejected');
    const dev2 = new Client(s.base); await dev2.login('a@x.com', 'Passw0rd!x');
    assert.strictEqual((await dev2.get('/api/auth/me')).json.user.uiLanguage, 'ru', 'another device sees the saved language');
    const b = new Client(s.base); await b.login('b@x.com', 'Passw0rd!x');
    assert.notStrictEqual((await b.get('/api/auth/me')).json.user.uiLanguage, 'ru', 'another account is unaffected');
  } finally { await s.stop(); }
});

test('switching the interface language does not change course, progress, XP or vocabulary; content follows the right language', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'l@x.com' }); const c = new Client(s.base); await c.login('l@x.com', 'Passw0rd!x');
    const snap = async () => ({ me: (await c.get('/api/auth/me')).json.user, words: (await c.get('/api/vocabulary?pageSize=5')).json, stats: (await c.get('/api/me/stats')).json });
    const before = await snap();
    const titles = {};
    for (const l of ['uz', 'ru', 'en']) { await c.patch('/api/me', { uiLanguage: l }); titles[l] = (await c.req('GET', '/api/path', undefined, { headers: { 'X-Lang': l } })).json.course.title; }
    assert.strictEqual(titles.en, 'English Foundations'); assert.strictEqual(titles.uz, 'Ingliz tili asoslari'); assert.strictEqual(titles.ru, 'Основы английского');
    const after = await snap();
    assert.strictEqual(after.me.courseId, before.me.courseId); assert.strictEqual(after.me.xpTotal, before.me.xpTotal);
    assert.deepStrictEqual(after.words.items.map((w) => [w.id, w.en, w.translation]), before.words.items.map((w) => [w.id, w.en, w.translation]), 'vocabulary translations follow the translation language, not the interface language');
    assert.deepStrictEqual(after.stats.streak, before.stats.streak); assert.strictEqual(after.stats.xp, before.stats.xp);
    // the translation language is a separate setting
    await c.patch('/api/me', { translationLanguage: 'ru' });
    const ruWords = (await c.get('/api/vocabulary?pageSize=2')).json.items;
    assert.ok(/[а-я]/i.test(ruWords[0].translation) && ruWords[0].translationLanguage === 'ru');
    assert.strictEqual((await c.get('/api/auth/me')).json.user.uiLanguage, 'en', 'and does not touch the interface language');
  } finally { await s.stop(); }
});

test('administrators review, validate, edit and reset interface translations', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'adm@x.com', role: 'admin' }); s.createUser({ email: 'ed@x.com', role: 'editor' });
    const a = new Client(s.base); await a.login('adm@x.com', 'Passw0rd!x');
    const info = (await a.get('/api/admin/i18n')).json;
    assert.deepStrictEqual(info.languages.map((l) => [l.code, l.percent]), [['uz', 100], ['ru', 100], ['en', 100]]);
    const put = (body) => a.put('/api/admin/i18n/ru', body);
    assert.strictEqual((await put({ key: 'nope.key', value: 'x' })).status, 400, 'unknown key');
    assert.strictEqual((await put({ key: 'lesson.xp_gain', value: 'без числа' })).status, 400, 'placeholders must match');
    assert.strictEqual((await put({ key: 'lesson.check', value: '<b>x</b>' })).status, 400, 'markup is refused');
    assert.strictEqual((await put({ key: 'lesson.check', value: '' })).status, 400, 'empty is refused');
    assert.strictEqual((await put({ key: 'count.words', value: 'plain' })).status, 400, 'plural keys need plural forms');
    assert.strictEqual((await put({ key: 'lesson.check', value: 'Сверить', dryRun: true })).json.dryRun, true);
    assert.strictEqual((await a.get('/api/i18n/ru')).json.messages['lesson.check'], dict.ru['lesson.check'], 'a dry run stores nothing');
    assert.strictEqual((await put({ key: 'lesson.check', value: 'Сверить' })).status, 200);
    assert.strictEqual((await a.get('/api/i18n/ru')).json.messages['lesson.check'], 'Сверить', 'the edit is live');
    assert.strictEqual((await a.get('/api/admin/i18n/ru?filter=overridden')).json.total, 1);
    assert.ok(s.db.get("SELECT 1 x FROM audit_log WHERE action = 'i18n.update'"), 'edits are audited');
    assert.strictEqual((await a.del('/api/admin/i18n/ru/lesson.check')).status, 200);
    assert.strictEqual((await a.get('/api/i18n/ru')).json.messages['lesson.check'], dict.ru['lesson.check'], 'reset restores the file text');
    // default language is configurable and validated
    assert.strictEqual((await a.put('/api/admin/settings', { default_language: 'ru' })).status, 200);
    assert.strictEqual((await new Client(s.base).get('/api/public/config')).json.defaultLanguage, 'ru');
    assert.strictEqual((await a.put('/api/admin/settings', { default_language: 'de' })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { supported_languages: ['uz'], default_language: 'ru' })).status, 400, 'the default must be offered');
    const e = new Client(s.base); await e.login('ed@x.com', 'Passw0rd!x');
    assert.strictEqual((await e.get('/api/admin/i18n')).status, 403, 'editors cannot change translations');
  } finally { await s.stop(); }
});
