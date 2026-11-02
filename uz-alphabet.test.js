const test = require('node:test');
const assert = require('node:assert');
const UZ = require('../../shared/uz-alphabet');
const X = require('../../server/lib/exercises');
const { convertDatabase } = require('../../server/lib/uz-convert');
const { startServer } = require('./helpers');

test('the four letters of the new Uzbek alphabet', () => {
  assert.strictEqual(UZ.toNew('O‘zbekcha'), 'Özbekça');
  assert.strictEqual(UZ.toNew("To'g'ri, shu choyni ichaman"), 'Töğri, şu çoyni içaman');
  assert.strictEqual(UZ.toNew('SHAHAR Chiroyli'), 'ŞAHAR Çiroyli');
  assert.strictEqual(UZ.toNew('ma’no, a’lo, Is’hoq'), 'ma’no, a’lo, Is’hoq', 'the tutuq belgisi stays');
  assert.strictEqual(UZ.toNew('{n} ta so‘z <b>shu</b> Asia/Tashkent'), '{n} ta söz <b>şu</b> Asia/Tashkent', 'placeholders, tags and time zones are kept');
  assert.strictEqual(UZ.toNew(UZ.toNew('o‘qish')), 'öqiş', 'converting twice changes nothing');
});

test('interface texts are in the new alphabet', () => {
  const uz = require('../../locales/uz.json');
  const text = JSON.stringify(Object.entries(uz).filter(([k]) => !k.startsWith('lang.native.')).map(([, v]) => v)).replace(/Asia\/Tashkent/g, '');
  assert.doesNotMatch(text, /[oOgG][‘ʻ'`]|sh|ch/i);
  assert.strictEqual(uz['lang.native.uz'], 'Özbekça');
});

test('answers are accepted in both the old and the new spelling', () => {
  assert.strictEqual(X.norm('öqituvçi'), X.norm("o'qituvchi"));
  assert.strictEqual(X.norm('Şahar'), X.norm('shahar'));
  assert.strictEqual(X.norm('yiğiliş'), X.norm('yig‘ilish'));
});

test('an existing database is converted once, keeping English words', async () => {
  const s = await startServer();
  try {
    const t = new Date().toISOString();
    s.db.run('INSERT INTO vocabulary (en, uz, example, example_uz, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)', 'corner shop', "ko'cha do'koni", 'She goes to the corner shop.', "U do'konga boradi, shu yerda choy bor.", 'published', t, t);
    s.db.run("INSERT INTO translation_overrides (lang, key, value, updated_at) VALUES ('uz', 'nav.home', ?, ?)", JSON.stringify('Bosh sahifa'), t);
    const first = await convertDatabase(s.appDb);
    assert.ok(first.vocabulary >= 1 && first.overrides === 1);
    const w = s.db.get("SELECT uz, example_uz FROM vocabulary WHERE en = 'corner shop'");
    assert.deepStrictEqual([w.uz, w.example_uz], ['köça dökoni', 'U dökonga boradi, şu yerda çoy bor.']);
    assert.strictEqual(JSON.parse(s.db.get("SELECT value FROM translation_overrides WHERE key = 'nav.home'").value), 'Boş sahifa');
    const g = JSON.parse(s.db.get("SELECT translations FROM grammar_points WHERE slug = 'to-be-present'").translations).uz.explanation;
    assert.match(g, /\bshe\b/, 'English grammar words inside Uzbek text are kept');
    assert.match(g, /işlatiladi/);
    const again = await convertDatabase(s.appDb);
    assert.ok(Object.values(again).every((n) => n === 0), 'a second run changes nothing');
  } finally { await s.stop(); }
});
