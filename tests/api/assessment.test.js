const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, Client } = require('./helpers');
const IRT = require('../../server/lib/irt');
const LV = require('../../server/lib/levels');

let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

async function register(s, email = 'new@example.com', extra = {}) {
  const c = new Client(s.base);
  const r = await c.post('/api/auth/register', { displayName: 'New Learner', email, password: 'Passw0rd!x', timezone: 'UTC', ...extra });
  assert.strictEqual(r.status, 201, r.text);
  return { c, user: r.json.user };
}
/* answers the current question as a learner of ability theta would */
function respond(s, q, theta, { unknown = false } = {}) {
  const row = s.db.get('SELECT * FROM assessment_questions WHERE id = ?', q.id);
  if (unknown) return { questionId: q.id, dontKnow: true };
  const ok = rand() < IRT.pCorrect(theta, LV.index(row.level), { format: row.format, options: q.options ? q.options.length : 4 });
  if (row.format === 'type') return { questionId: q.id, answer: ok ? row.answer.split('|')[0] : 'zzz' };
  const opts = s.db.all('SELECT id, is_correct FROM assessment_options WHERE question_id = ?', q.id);
  const pick = ok ? opts.find((o) => o.is_correct) : opts.find((o) => !o.is_correct);
  return { questionId: q.id, answer: pick.id };
}
async function runTest(s, c, theta, opts = {}) {
  let st = (await c.post('/api/assessment/start', { listening: opts.listening !== false })).json;
  const asked = [];
  while (st.status === 'in_progress') {
    asked.push(st.question);
    const r = await c.post(`/api/assessment/${st.assessmentId}/answer`, respond(s, st.question, theta, opts));
    assert.strictEqual(r.status, 200, r.text);
    st = r.json;
    assert.ok(asked.length <= 40, 'test must end');
  }
  return { st, asked };
}

test('a new account sees the welcome flow: not onboarded, no level, and can choose a level manually', async () => {
  const s = await startServer();
  try {
    const { c, user } = await register(s);
    assert.strictEqual(user.onboarded, false); assert.strictEqual(user.cefrLevel, null);
    const r = await c.post('/api/me/level', { level: 'B1' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.level, 'B1'); assert.strictEqual(r.json.source, 'manual');
    const me = (await c.get('/api/auth/me')).json.user;
    assert.strictEqual(me.onboarded, true); assert.strictEqual(me.cefrLevel, 'B1'); assert.strictEqual(me.startLevel, 'B1');
    assert.strictEqual((await c.post('/api/me/level', { level: 'Z9' })).status, 400, 'unknown level refused');
    // Pre-A1 and C2 are valid choices; the learning path clamps to the course levels
    await c.post('/api/me/level', { level: 'C2' });
    assert.strictEqual((await c.get('/api/auth/me')).json.user.startLevel, 'C1');
    await c.post('/api/me/level', { level: 'A0' });
    assert.strictEqual((await c.get('/api/auth/me')).json.user.startLevel, 'A1');
  } finally { await s.stop(); }
});

test('registering with an explicit level (older clients) skips the welcome screen', async () => {
  const s = await startServer();
  try {
    const { user } = await register(s, 'old@example.com', { startLevel: 'A2' });
    assert.strictEqual(user.onboarded, true); assert.strictEqual(user.cefrLevel, 'A2');
  } finally { await s.stop(); }
});

test('the placement test never reveals answers, enforces the question order and is idempotent', async () => {
  const s = await startServer();
  try {
    const { c } = await register(s);
    const st = (await c.post('/api/assessment/start', { listening: true })).json;
    assert.strictEqual(st.status, 'in_progress');
    const q = st.question;
    assert.ok(!JSON.stringify(st).match(/is_correct|"correct"|difficulty|"level"/), 'no hints about the answer or difficulty');
    // starting again resumes the same test
    assert.strictEqual((await c.post('/api/assessment/start', {})).json.assessmentId, st.assessmentId);
    assert.strictEqual((await c.get('/api/assessment/current')).json.question.id, q.id, 'reloading shows the same question');
    // answering some other question is refused
    const other = s.db.get('SELECT id FROM assessment_questions WHERE id != ? LIMIT 1', q.id).id;
    assert.strictEqual((await c.post(`/api/assessment/${st.assessmentId}/answer`, { questionId: other, answer: 1 })).status, 409);
    // another learner cannot touch this test
    const { c: c2 } = await register(s, 'other@example.com');
    assert.strictEqual((await c2.post(`/api/assessment/${st.assessmentId}/answer`, { questionId: q.id, dontKnow: true })).status, 404);
    // a repeated submit counts once
    const body = respond(s, q, 3);
    const a1 = await c.post(`/api/assessment/${st.assessmentId}/answer`, body), a2 = await c.post(`/api/assessment/${st.assessmentId}/answer`, body);
    assert.strictEqual(a1.status, 200); assert.strictEqual(a2.status, 200);
    assert.strictEqual(s.db.get('SELECT asked FROM assessments WHERE id = ?', st.assessmentId).asked, 1);
    assert.strictEqual((await c.post(`/api/assessment/${st.assessmentId}/answer`, { questionId: a1.json.question.id, answer: 999999 })).status, 400, 'an option that is not part of the question is refused');
  } finally { await s.stop(); }
});

test('scoring: strong, middle and weak learners get matching levels in 20-35 questions with full skill coverage', async () => {
  const s = await startServer();
  try {
    const cases = [[0.2, 'A0'], [2, 'A2'], [3, 'B1'], [5, 'C1']];
    let n = 0;
    for (const [theta, expected] of cases) {
      const { c } = await register(s, `sim${n++}@example.com`);
      const { st, asked } = await runTest(s, c, theta);
      assert.ok(asked.length >= 20 && asked.length <= 35, `questions ${asked.length}`);
      const got = LV.index(st.result.level), want = LV.index(expected);
      assert.ok(Math.abs(got - want) <= 1, `theta ${theta}: expected ~${expected}, got ${st.result.level}`);
      // every core skill was sampled, no question twice
      const rows = s.db.all('SELECT question_id, skill FROM assessment_responses WHERE assessment_id = ?', st.assessmentId);
      assert.strictEqual(new Set(rows.map((r) => r.question_id)).size, rows.length);
      for (const g of ['vocabulary', 'grammar', 'reading']) assert.ok(rows.filter((r) => LV.REPORT_GROUPS[g].includes(r.skill)).length >= 3, g);
      assert.ok(rows.some((r) => r.skill === 'listening'), 'listening included when requested');
      // the result is saved on the account and the plan exists
      const lv = (await c.get('/api/me/level')).json;
      assert.strictEqual(lv.level, st.result.level); assert.strictEqual(lv.source, 'placement'); assert.ok(lv.plan.steps.length >= 3);
      assert.strictEqual((await c.get('/api/auth/me')).json.user.onboarded, true);
      assert.ok(st.result.percent >= 0 && st.result.percent <= 100 && st.result.skills.vocabulary);
    }
  } finally { await s.stop(); }
});

test('one lucky or unlucky answer cannot decide the level; "I don\'t know" lowers the estimate; no listening when not requested', async () => {
  // pure statistics
  const lowQ = { level: 2, correct: true, format: 'choice', options: 4 };
  const one = IRT.estimate([{ level: 6, correct: true, format: 'choice', options: 4 }]);
  assert.ok(LV.code(Math.round(one.mean)) !== 'C2', 'a single correct C2 answer does not give C2');
  assert.ok(one.sd > 1, 'a single answer leaves large uncertainty');
  const many = IRT.estimate(Array.from({ length: 20 }, () => lowQ));
  assert.ok(many.sd < one.sd);
  const guess = IRT.estimate(Array.from({ length: 8 }, () => ({ level: 4, correct: true, format: 'choice', options: 4 })));
  const sure = IRT.estimate(Array.from({ length: 8 }, () => ({ level: 4, correct: true, format: 'type', options: 0 })));
  assert.ok(sure.mean >= guess.mean, 'typed answers are stronger evidence than guessable ones');
  const s = await startServer();
  try {
    const { c } = await register(s);
    const { st } = await runTest(s, c, 3, { unknown: true, listening: false });
    assert.strictEqual(st.result.level, 'A0', 'answering "I don\'t know" everywhere gives the lowest level');
    assert.strictEqual(s.db.all("SELECT 1 FROM assessment_responses WHERE assessment_id = ? AND skill = 'listening'", st.assessmentId).length, 0);
    assert.ok(st.asked >= 20);
  } finally { await s.stop(); }
});

test('settings drive the test: thresholds are validated and a stored config is not changed by later edits', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'adm@example.com', role: 'admin' });
    const a = new Client(s.base); await a.login('adm@example.com');
    assert.strictEqual((await a.put('/api/admin/settings', { placement_cutoffs: [3, 2, 1, 4, 5, 6] })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { placement_min_questions: 30, placement_max_questions: 20 })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { placement_start_level: 'Q1' })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { placement_min_questions: 24, placement_max_questions: 26 })).status, 200);
    const { c } = await register(s);
    const first = (await c.post('/api/assessment/start', {})).json;
    await a.put('/api/admin/settings', { placement_min_questions: 10, placement_max_questions: 12 });
    assert.strictEqual((await c.get('/api/assessment/current')).json.max, 26, 'a running test keeps the rules it started with');
    let st = first;
    while (st.status === 'in_progress') st = (await c.post(`/api/assessment/${st.assessmentId}/answer`, respond(s, st.question, 3))).json;
    assert.ok(st.asked >= 24 && st.asked <= 26, 'asked ' + st.asked);
    s.appDb && assert.ok(true);
  } finally { await s.stop(); }
});

test('retake keeps the old result, changes the level and records history; a manual change keeps the test result', async () => {
  const s = await startServer();
  try {
    const { c } = await register(s);
    const r1 = await runTest(s, c, 1.5);
    const lvl1 = r1.st.result.level;
    const r2 = await runTest(s, c, 4.5);
    assert.strictEqual(s.db.get('SELECT kind FROM assessments WHERE id = ?', r2.st.assessmentId).kind, 'reassessment');
    assert.ok(LV.index(r2.st.result.level) > LV.index(lvl1));
    assert.strictEqual(s.db.all("SELECT 1 FROM assessments WHERE user_id = ? AND status = 'completed'", s.db.get('SELECT id FROM users WHERE email = ?', 'new@example.com').id).length, 2, 'both results kept');
    await c.post('/api/me/level', { level: 'A2' });
    const lv = (await c.get('/api/me/level')).json;
    assert.strictEqual(lv.level, 'A2'); assert.strictEqual(lv.source, 'manual');
    assert.strictEqual(lv.assessment.level, r2.st.result.level, 'the placement result is still available');
    assert.deepStrictEqual(lv.history.map((h) => h.source).slice(0, 3), ['manual', 'reassessment', 'placement']);
    const hist = (await c.get('/api/assessment/history')).json.items;
    assert.strictEqual(hist.length, 2);
    // abandoning an unfinished test leaves the level alone
    const st = (await c.post('/api/assessment/start', {})).json;
    await c.post(`/api/assessment/${st.assessmentId}/abandon`);
    assert.strictEqual((await c.get('/api/assessment/current')).json.status, 'none');
    assert.strictEqual((await c.get('/api/me/level')).json.level, 'A2');
  } finally { await s.stop(); }
});

test('progress and level are restored on another device (new session)', async () => {
  const s = await startServer();
  try {
    const { c } = await register(s, 'dev@example.com');
    const st = (await c.post('/api/assessment/start', {})).json;
    await c.post(`/api/assessment/${st.assessmentId}/answer`, respond(s, st.question, 3));
    const phone = new Client(s.base); await phone.login('dev@example.com');
    const cur = (await phone.get('/api/assessment/current')).json;
    assert.strictEqual(cur.assessmentId, st.assessmentId); assert.strictEqual(cur.asked, 1);
    let x = cur;
    while (x.status === 'in_progress') x = (await phone.post(`/api/assessment/${x.assessmentId}/answer`, respond(s, x.question, 3))).json;
    const laptop = new Client(s.base); await laptop.login('dev@example.com');
    assert.strictEqual((await laptop.get('/api/me/level')).json.level, x.result.level);
  } finally { await s.stop(); }
});

test('migration: existing accounts keep their data, are marked onboarded and keep their chosen level', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-mig-'));
  const file = path.join(dir, 'old.sqlite');
  const sync = require('./syncdb').open(file);
  const migDir = path.join(__dirname, '..', '..', 'server', 'migrations');
  sync.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for (const f of fs.readdirSync(migDir).filter((f) => /^00[1-3]_/.test(f)).sort()) { sync.exec(fs.readFileSync(path.join(migDir, f), 'utf8')); sync.run('INSERT INTO schema_migrations VALUES (?,?)', f, 'x'); }
  const t = new Date().toISOString();
  sync.run("INSERT INTO users (email, display_name, password_hash, role, start_level, xp_total, hearts, hearts_updated_at, created_at) VALUES ('old@x.com','Old','h','learner','B2',321,5,?,?)", t, t);
  sync.close();
  const dbLib = require('../../server/lib/db');
  const db = dbLib.open(file);
  try {
    assert.deepStrictEqual(await dbLib.migrate(db), ['004_assessment.sql']);
    const u = await db.get("SELECT * FROM users WHERE email = 'old@x.com'");
    assert.strictEqual(u.onboarded, 1); assert.strictEqual(u.cefr_level, 'B2'); assert.strictEqual(u.level_source, 'legacy'); assert.strictEqual(u.xp_total, 321); assert.strictEqual(u.start_level, 'B2');
  } finally { await db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the built-in question bank is valid and covers every level and skill', async () => {
  const s = await startServer();
  try {
    const rows = s.db.all("SELECT level, skill, COUNT(*) n FROM assessment_questions WHERE status = 'published' GROUP BY level, skill");
    for (const l of LV.LEVELS) for (const k of LV.SKILLS) assert.ok(rows.find((r) => r.level === l && r.skill === k), `${l}/${k}`);
    for (const q of s.db.all("SELECT * FROM assessment_questions WHERE format = 'choice'")) {
      const o = s.db.all('SELECT * FROM assessment_options WHERE question_id = ?', q.id);
      assert.strictEqual(o.filter((x) => x.is_correct).length, 1, q.prompt); assert.ok(o.length >= 3);
    }
    s.createUser({ email: 'adm@example.com', role: 'admin' });
    const a = new Client(s.base); await a.login('adm@example.com');
    const cov = (await a.get('/api/admin/assessment/coverage')).json;
    assert.strictEqual(cov.ready, true); assert.deepStrictEqual(cov.warnings, []);
  } finally { await s.stop(); }
});

test('admin: question CRUD with validation before publishing, coverage, anonymised stats, grammar lessons', async () => {
  const s = await startServer();
  try {
    s.createUser({ email: 'adm@example.com', role: 'admin' }); s.createUser({ email: 'learner@example.com' });
    const a = new Client(s.base); await a.login('adm@example.com');
    const l = new Client(s.base); await l.login('learner@example.com');
    assert.strictEqual((await l.get('/api/admin/assessment/questions')).status, 403, 'learners have no access');
    const good = { skill: 'grammar', level: 'B1', format: 'choice', prompt: 'She ___ to school yesterday.', status: 'published', options: [{ text: 'went', is_correct: true }, { text: 'goes', is_correct: false }, { text: 'going', is_correct: false }] };
    // validation before publishing
    let r = await a.post('/api/admin/assessment/questions', { ...good, options: [{ text: 'went', is_correct: true }, { text: 'goes' }] });
    assert.strictEqual(r.status, 400, 'too few options cannot be published');
    r = await a.post('/api/admin/assessment/questions', { ...good, options: good.options.map((o) => ({ ...o, is_correct: false })) });
    assert.strictEqual(r.status, 400, 'needs exactly one correct option');
    r = await a.post('/api/admin/assessment/questions', { ...good, skill: 'reading' });
    assert.strictEqual(r.status, 400, 'reading needs a passage');
    r = await a.post('/api/admin/assessment/questions', { ...good, level: 'Z' });
    assert.strictEqual(r.status, 400);
    r = await a.post('/api/admin/assessment/questions', { ...good, status: 'draft', options: [] });
    assert.strictEqual(r.status, 201, 'an incomplete DRAFT can be saved');
    const draft = r.json;
    r = await a.put('/api/admin/assessment/questions/' + draft.id, good);
    assert.strictEqual(r.status, 200); assert.strictEqual(r.json.status, 'published'); assert.strictEqual(r.json.options.length, 3);
    // drafts are never asked
    const before = s.db.get("SELECT COUNT(*) n FROM assessment_questions WHERE status = 'published'").n;
    await a.put('/api/admin/assessment/questions/' + draft.id, { ...good, status: 'draft' });
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM assessment_questions WHERE status = 'published'").n, before - 1);
    assert.strictEqual((await a.get('/api/admin/assessment/questions?level=B1&skill=grammar')).json.items.some((q) => q.id === draft.id), true);
    assert.strictEqual((await a.del('/api/admin/assessment/questions/' + draft.id, {})).status, 400, 'deleting needs confirmation');
    assert.strictEqual((await a.del('/api/admin/assessment/questions/' + draft.id, { confirm: true })).status, 200);
    // coverage reports gaps
    s.db.run("UPDATE assessment_questions SET status = 'draft' WHERE level = 'C2' AND skill = 'reading'");
    const cov = (await a.get('/api/admin/assessment/coverage')).json;
    assert.strictEqual(cov.ready, false); assert.ok(cov.warnings.some((w) => w.level === 'C2' && w.skill === 'reading'));
    // statistics contain no personal data
    const { c } = await register(s, 'someone@example.com'); await runTest(s, c, 3);
    const stats = await a.get('/api/admin/assessment/stats');
    assert.strictEqual(stats.json.assessments.completed, 1);
    assert.ok(!/someone@example|New Learner/.test(stats.text));
    // grammar lessons
    const g = { level: 'A2', title: 'Test point', explanation: 'Explain.', examples: ['One.'], practice: [['Q ___', 'right', 'wrong']], status: 'published', translations: { uz: { title: 'Sinov' } } };
    r = await a.post('/api/admin/grammar', { ...g, practice: [['Q only']] }); assert.strictEqual(r.status, 400);
    r = await a.post('/api/admin/grammar', g); assert.strictEqual(r.status, 201);
    assert.strictEqual((await a.put('/api/admin/grammar/' + r.json.id, { ...g, title: 'Renamed' })).json.title, 'Renamed');
    assert.strictEqual((await a.del('/api/admin/grammar/' + r.json.id, { confirm: true })).status, 200);
    // rules are admin-only settings; editors cannot change them
    s.createUser({ email: 'ed@example.com', role: 'editor' });
    const e = new Client(s.base); await e.login('ed@example.com');
    assert.strictEqual((await e.put('/api/admin/settings', { placement_min_questions: 22 })).status, 403);
  } finally { await s.stop(); }
});

test('health check: plain, and the full diagnostic reports that start-up works', async () => {
  const s = await startServer();
  try {
    assert.deepStrictEqual((await new Client(s.base).get('/healthz')).json, { ok: true });
    const f = (await new Client(s.base).get('/healthz?full=1')).json;
    assert.strictEqual(f.ok, true); assert.strictEqual(f.ready, true);
  } finally { await s.stop(); }
});
