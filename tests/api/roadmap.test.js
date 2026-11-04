const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client, playAttempt } = require('./helpers');
const X = require('../../server/lib/exercises');

async function learner(s, email) {
  s.createUser({ email });
  const c = new Client(s.base); await c.login(email);
  return c;
}
const levels = async (c) => (await c.get('/api/path')).json;
const lessonsOf = (p, code, kinds) => p.levels.find((l) => l.code === code).units.flatMap((u) => u.lessons).filter((l) => !kinds || kinds.includes(l.kind));

test('roadmap content: eight levels, A1 complete with ten topics, tests and an examination; no duplicate or empty exercises', async () => {
  const s = await startServer({ roadmap: true });
  try {
    const course = s.db.get("SELECT * FROM courses WHERE slug = 'lexio-roadmap'");
    const lv = s.db.all('SELECT * FROM levels WHERE course_id = ? ORDER BY position', course.id);
    assert.deepStrictEqual(lv.map((l) => l.code), ['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'IELTS']);
    assert.ok(lv.every((l) => l.strict === 1 && l.exam_pass_pct === 80), 'strict levels with an 80% pass mark');
    for (const l of lv) assert.ok(s.db.get('SELECT COUNT(*) n FROM units WHERE level_id = ?', l.id).n >= 10, l.code + ' has 10+ topics');
    const a1 = lv[0];
    const units = s.db.all('SELECT * FROM units WHERE level_id = ? ORDER BY position', a1.id);
    assert.strictEqual(units.length, 10);
    for (const u of units) {
      const ls = s.db.all("SELECT * FROM lessons WHERE unit_id = ? ORDER BY position", u.id);
      assert.ok(ls.filter((x) => x.kind === 'lesson').length >= 2, u.title + ': 2+ lessons');
      assert.ok(ls.some((x) => x.kind === 'topic_test'), u.title + ': topic test');
      for (const x of ls.filter((y) => y.kind === 'lesson')) {
        const n = s.db.get('SELECT COUNT(*) n FROM exercises WHERE lesson_id = ?', x.id).n;
        assert.ok(n >= 14, `${x.title}: ${n} exercises`);
        const c = JSON.parse(x.content);
        assert.ok(c.objective.uz && c.objective.en && c.explanation.uz.length > 80 && c.examples.length >= 4 && c.vocabulary.length >= 6, x.title + ' has real study content');
        const types = new Set(s.db.all('SELECT type FROM exercises WHERE lesson_id = ?', x.id).map((e) => e.type));
        for (const t of ['translation_choice', 'match_pairs', 'listen_choice', 'reading', 'multiple_choice', 'writing', 'speaking']) assert.ok(types.has(t), `${x.title}: ${t}`);
      }
    }
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM lessons WHERE kind = 'exam'").n, 1);
    const exam = s.db.get("SELECT * FROM lessons WHERE kind = 'exam'");
    const exQ = s.db.all('SELECT * FROM exercises WHERE lesson_id = ?', exam.id);
    assert.ok(exQ.length >= 35); for (const m of ['grammar', 'vocabulary', 'listening', 'reading', 'writing']) assert.ok(exQ.some((e) => e.module === m), 'exam covers ' + m);
    // no duplicate questions anywhere in the roadmap (same text and same options)
    const seen = new Map();
    for (const e of s.db.all('SELECT e.* FROM exercises e JOIN lessons l ON l.id = e.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels v ON v.id = u.level_id WHERE v.course_id = ?', course.id)) {
      const opts = s.db.all('SELECT text FROM exercise_options WHERE exercise_id = ? ORDER BY text', e.id).map((o) => o.text).join('|');
      const key = [e.type, e.prompt, e.sentence, e.passage.slice(0, 40), e.audio_text, e.answer, opts].join('¦');
      assert.ok(!seen.has(key), `duplicate exercise: ${e.type} ${e.prompt || e.sentence}`); seen.set(key, e.id);
      assert.deepStrictEqual(X.validate({ ...X.normalizeInput({ ...e, options: s.db.all('SELECT text, match_text, is_correct FROM exercise_options WHERE exercise_id = ?', e.id).map((o) => ({ ...o, is_correct: !!o.is_correct })) }) }), [], 'valid: ' + e.type);
    }
  } finally { await s.stop(); }
});

test('strict unlocking: a new learner has only A1; a chosen level opens nothing; A2 needs the A1 examination', async () => {
  const s = await startServer({ roadmap: true });
  try {
    const c = await learner(s, 'new@example.com');
    let p = await levels(c);
    assert.strictEqual(p.course.slug, 'lexio-roadmap'); assert.strictEqual(p.course.strict, true);
    assert.deepStrictEqual(p.levels.map((l) => l.code), ['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'IELTS']);
    assert.strictEqual(p.levels[0].unlocked, true);
    assert.ok(p.levels.slice(1).every((l) => !l.unlocked && l.comingSoon), 'later levels are locked and "being prepared"');
    // choosing a level by hand, even C2, unlocks nothing
    await c.post('/api/me/level', { level: 'C2' });
    p = await levels(c); assert.ok(p.levels.slice(1).every((l) => !l.unlocked));
    // the lessons of A1 are sequential and the exam is locked
    const a1 = lessonsOf(p, 'A1');
    assert.strictEqual(a1.filter((l) => l.state === 'available').length, 1, 'only the first lesson is open');
    const exam = a1.find((l) => l.kind === 'exam');
    assert.strictEqual(exam.state, 'locked'); assert.strictEqual(exam.lockReason.key, 'path.lock_exam_lessons');
    const r = await c.post(`/api/lessons/${exam.id}/start`);
    assert.strictEqual(r.status, 403, 'the server refuses to start a locked exam');
    assert.strictEqual((await c.post(`/api/lessons/${a1[3].id}/start`)).status, 403, 'and a locked lesson');
  } finally { await s.stop(); }
});

test('a lesson shows its study page; writing and speaking are graded on the server; completion is saved', async () => {
  const s = await startServer({ roadmap: true });
  try {
    const c = await learner(s, 'l1@example.com');
    const first = lessonsOf(await levels(c), 'A1')[0];
    const st = (await c.post(`/api/lessons/${first.id}/start`)).json;
    assert.ok(st.lesson.content && st.lesson.content.objective && st.lesson.content.examples.length >= 4, 'study content is sent with a new attempt');
    assert.ok(!JSON.stringify(st).includes('"answer"'), 'no answers');
    // Russian learners get the Russian objective
    const ru = await c.req('GET', '/api/attempts/' + st.attemptId, undefined, { headers: { 'X-Lang': 'ru' } });
    assert.match(ru.json.lesson.content.objective, /[А-Яа-я]/);
    const uz = await c.req('GET', '/api/attempts/' + st.attemptId, undefined, { headers: { 'X-Lang': 'uz' } });
    assert.match(uz.json.lesson.content.explanation, /Ŏ|ŏ|Ş|ş|Ç|ç|Ğ|ğ/, 'Uzbek texts use the new alphabet');
    assert.ok(!/[a-z]o‘|g‘/i.test(uz.json.lesson.content.explanation.replace(/“[^”]*”/g, '')), 'no old-spelling letters outside the English quotes');
    const out = await playAttempt(c, st, s.db, { wrongAt: new Set([1]) });
    assert.strictEqual(out.state.status, 'completed');
    const p = await levels(c);
    assert.strictEqual(lessonsOf(p, 'A1')[0].state, 'completed');
    assert.strictEqual(lessonsOf(p, 'A1')[1].state, 'available', 'the next lesson opens');
    assert.ok(s.db.get('SELECT COUNT(*) n FROM item_responses').n === 0 && s.db.get('SELECT COUNT(*) n FROM exercise_responses').n > 14);
  } finally { await s.stop(); }
});

test('writing and speaking grading rules', () => {
  const ex = { id: 1, type: 'writing', answer: 'my name|i am|from', min_words: 8, translation: 'Model.' };
  assert.strictEqual(X.grade(ex, [], 'My name is Ali. I am from Uzbekistan and I am a student.', 1).correct, true);
  const short = X.grade(ex, [], 'My name is Ali.', 1); assert.strictEqual(short.correct, false); assert.strictEqual(short.detail.words, 4);
  const off = X.grade(ex, [], 'The weather is nice today and the sky is very blue and clear.', 1); assert.strictEqual(off.correct, false, 'long enough but off topic');
  assert.deepStrictEqual(X.grade(ex, [], 'one two', 1).detail.missing, ['my name', 'i am', 'from']);
  assert.strictEqual(X.grade(ex, [], '   ', 1).invalid, true);
  const sp = { id: 2, type: 'speaking', translation: 'Hello.' };
  assert.strictEqual(X.grade(sp, [], true, 1).correct, true); assert.strictEqual(X.grade(sp, [], 'yes', 1).invalid, true);
  // validation of authored tasks
  assert.ok(X.validate(X.normalizeInput({ type: 'writing', prompt: 'Write.', answer: '', min_words: 2 })).length >= 3);
  assert.deepStrictEqual(X.validate(X.normalizeInput({ type: 'speaking', prompt: 'Say hi.', translation: 'Hi.' })), []);
});

test('examinations: scored on the server, 80% to pass, answers hidden until the end, retake allowed, A2 opens only after a pass', async () => {
  const s = await startServer({ roadmap: true });
  try {
    const c = await learner(s, 'ex@example.com');
    const uid = s.db.get("SELECT id FROM users WHERE email = 'ex@example.com'").id;
    // make A2 playable (the authored A2 content comes later): one lesson with one exercise
    const a2 = s.db.get("SELECT u.id FROM units u JOIN levels l ON l.id = u.level_id WHERE l.code = 'A2' ORDER BY u.position LIMIT 1");
    const t = new Date().toISOString();
    const lid = s.db.run("INSERT INTO lessons (unit_id, title, position, status, created_at, updated_at) VALUES (?,?,?,?,?,?)", a2.id, 'A2 test lesson', 0, 'published', t, t).id;
    const eid = s.db.run("INSERT INTO exercises (lesson_id, type, prompt, status, created_at, updated_at) VALUES (?,?,?,?,?,?)", lid, 'multiple_choice', 'Pick', 'published', t, t).id;
    s.db.run("INSERT INTO exercise_options (exercise_id, text, is_correct, position) VALUES (?,?,?,?)", eid, 'a', 1, 0); s.db.run("INSERT INTO exercise_options (exercise_id, text, is_correct, position) VALUES (?,?,?,?)", eid, 'b', 0, 1);
    // finish every A1 lesson and topic test through the API
    let guard = 0;
    for (;;) {
      const p = await levels(c);
      const next = lessonsOf(p, 'A1', ['lesson', 'topic_test']).find((l) => l.state === 'available');
      if (!next) break;
      const st = (await c.post(`/api/lessons/${next.id}/start`)).json;
      const o = await playAttempt(c, st, s.db);
      assert.strictEqual(o.state.status, 'completed', next.title);
      if (next.kind === 'topic_test') assert.strictEqual(o.state.result.exam.passed, true);
      assert.ok(++guard < 40);
    }
    let p = await levels(c);
    const exam = lessonsOf(p, 'A1', ['exam'])[0];
    assert.strictEqual(exam.state, 'available', 'all lessons done: the exam opens');
    assert.strictEqual(p.levels[1].unlocked, false, 'but A2 is still locked');
    assert.strictEqual(p.levels[1].lockReason.key, 'path.lock_level_exam');
    // first attempt: fail on purpose (about half wrong)
    let st = (await c.post(`/api/lessons/${exam.id}/start`)).json;
    assert.strictEqual(st.heartsEnabled, false, 'an exam never costs hearts');
    const first = await c.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: require('./helpers').answerFor(s.db, st, true) });
    assert.strictEqual(first.json.feedback.exam, true); assert.strictEqual(first.json.feedback.correctAnswer, undefined, 'an exam reveals no answers while it runs');
    const wrongOut = await playAttempt(c, first.json.state, s.db, { wrongAt: new Set(Array.from({ length: 30 }, (_, i) => i + 1).filter((i) => i % 2 === 0)) });
    const res = wrongOut.state.result;
    assert.strictEqual(wrongOut.state.status, 'completed'); assert.strictEqual(res.exam.passed, false); assert.ok(res.exam.score < 80 && res.exam.passPct === 80);
    assert.ok(res.mistakes.length > 0 && res.mistakes.every((m) => m.answer !== undefined), 'mistakes are listed after the exam');
    assert.ok(Object.keys(res.exam.skills).length >= 4, 'results by skill');
    assert.strictEqual(s.db.get('SELECT passed FROM exam_results WHERE user_id = ? ORDER BY id DESC LIMIT 1', uid).passed, 0);
    p = await levels(c);
    assert.strictEqual(lessonsOf(p, 'A1', ['exam'])[0].state, 'available', 'a failed exam is not completed and can be retaken');
    assert.strictEqual(p.levels[1].unlocked, false); assert.strictEqual(p.levels[0].exam.passed, false);
    // retake and pass
    st = (await c.post(`/api/lessons/${exam.id}/start`)).json;
    const ok = await playAttempt(c, st, s.db);
    assert.strictEqual(ok.state.result.exam.passed, true); assert.strictEqual(ok.state.result.exam.score, 100);
    p = await levels(c);
    assert.strictEqual(p.levels[0].completed, true); assert.strictEqual(p.levels[0].exam.bestScore, 100);
    assert.strictEqual(p.levels[1].unlocked, true, 'passing the A1 examination unlocks A2');
    assert.strictEqual(lessonsOf(p, 'A2')[0].state, 'available');
    assert.strictEqual(p.levels[2].unlocked, false, 'and nothing beyond');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exam_results WHERE user_id = ?', uid).n >= 12, true, 'every result is saved');
  } finally { await s.stop(); }
});

test('a placement test cannot grant advanced roadmap levels', async () => {
  const s = await startServer({ roadmap: true });
  try {
    // a placement result of C2 still opens at most up to B2 (and the levels beyond A1 have no published lessons yet)
    const c = await learner(s, 'pl@example.com');
    s.db.run("UPDATE users SET cefr_level = 'C2', level_source = 'placement' WHERE email = 'pl@example.com'");
    const p = await levels(c);
    assert.ok(!p.levels.find((l) => l.code === 'C1').unlocked && !p.levels.find((l) => l.code === 'IELTS').unlocked);
  } finally { await s.stop(); }
});

test('IELTS center: original materials, practice tests with estimated bands, nothing locked', async () => {
  const IELTS = require('../../server/lib/ielts');
  assert.strictEqual(IELTS.bandFromPercent(100), 9); assert.strictEqual(IELTS.bandFromPercent(75), 7); assert.strictEqual(IELTS.bandFromPercent(50), 5.5); assert.strictEqual(IELTS.bandFromPercent(0), 2);
  assert.strictEqual(IELTS.overall([6.5, 7]), 7); assert.strictEqual(IELTS.overall([null, null]), null);
  const s = await startServer({ roadmap: true });
  try {
    const c = await learner(s, 'ielts@example.com');
    const d = (await c.get('/api/ielts')).json;
    assert.strictEqual(d.course.title, 'IELTS Preparation Center');
    assert.deepStrictEqual(d.units.map((u) => u.title), ['Format and strategies', 'Listening practice', 'Reading practice', 'Writing practice', 'Speaking practice', 'Practice examinations']);
    const all = d.units.flatMap((u) => u.lessons);
    assert.ok(all.every((l) => l.state !== 'locked'), 'the center is never locked');
    assert.ok(all.filter((l) => l.kind === 'practice_test').length >= 2);
    // the writing lessons carry Band 6.5 and 7.0 example answers and time-management advice exists
    const wl = s.db.get("SELECT content FROM lessons WHERE title LIKE 'Writing Task 1%'");
    assert.match(JSON.parse(wl.content).explanation.en, /Band 6\.5 example[\s\S]*Band 7\.0 example/);
    assert.ok(s.db.get("SELECT 1 x FROM lessons WHERE title = 'Time management strategies'"));
    // note completion has audio and typed answers
    const lis = all.find((l) => l.title === 'Note completion and forms');
    const st = (await c.post(`/api/lessons/${lis.id}/start`)).json;
    const out = await playAttempt(c, st, s.db);
    assert.strictEqual(out.state.status, 'completed');
    // a full practice test: perfect run gives a high estimated band; a poor run a lower one; both are saved
    const test = all.find((l) => l.title === 'Listening practice test 1');
    let a = (await c.post(`/api/lessons/${test.id}/start`)).json;
    assert.strictEqual(a.lesson.kind, 'practice_test'); assert.strictEqual(a.heartsEnabled, false);
    const first = await c.post(`/api/attempts/${a.attemptId}/answer`, { exerciseId: a.exercise.id, answer: require('./helpers').answerFor(s.db, a, false) });
    assert.strictEqual(first.json.feedback.correctAnswer, undefined, 'a practice test shows answers only at the end');
    const good = await playAttempt(c, first.json.state, s.db);
    assert.strictEqual(good.state.result.exam.band, 9); assert.strictEqual(good.state.result.exam.score, 100);
    a = (await c.post(`/api/lessons/${test.id}/start`)).json;
    const poor = await playAttempt(c, a, s.db, { wrongAt: new Set([1, 2, 3, 4, 5, 6, 7, 8]) });
    assert.ok(poor.state.result.exam.band < 9 && poor.state.result.exam.score < 100);
    assert.ok(poor.state.result.mistakes.length >= 6 && poor.state.result.mistakes.some((m) => m.explanation), 'detailed answer explanations after the test');
    const after = (await c.get('/api/ielts')).json;
    assert.strictEqual(after.bands.listening, 9, 'the best estimated band is kept'); assert.strictEqual(after.bands.reading, null);
    assert.strictEqual(after.bands.overall, 9);
    assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM exam_results WHERE band IS NOT NULL").n, 2);
    // reading test
    const rt = all.find((l) => l.title === 'Reading practice test 1');
    const r2 = await playAttempt(c, (await c.post(`/api/lessons/${rt.id}/start`)).json, s.db, { wrongAt: new Set([2, 5, 9]) });
    assert.ok(r2.state.result.exam.band >= 6 && r2.state.result.exam.band <= 8.5, 'band ' + r2.state.result.exam.band);
  } finally { await s.stop(); }
});

test('roadmap seeding is resumable and does not duplicate content', async () => {
  const s = await startServer({ roadmap: true });
  try {
    const before = s.db.get('SELECT COUNT(*) n FROM lessons').n;
    s.db.run("DELETE FROM settings WHERE key LIKE 'seeded_roadmap%' OR key LIKE 'seeded_ielts%'");
    const again = await require('../../server/seed').ensureRoadmap(s.appDb);
    assert.deepStrictEqual(again, { lessons: 0, exercises: 0 }, 'nothing is created twice');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM lessons').n, before);
    // an interrupted run: a topic that lost its lessons is rebuilt, the others are untouched
    const unit = s.db.get("SELECT u.id FROM units u JOIN levels l ON l.id = u.level_id WHERE l.code = 'A1' ORDER BY u.position LIMIT 1");
    s.db.run('DELETE FROM lessons WHERE unit_id = ?', unit.id);
    s.db.run("DELETE FROM settings WHERE key LIKE 'seeded_roadmap%'");
    const resumed = await require('../../server/seed').ensureRoadmap(s.appDb);
    assert.ok(resumed.lessons >= 3, 'the missing topic was recreated');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM lessons').n, before);
  } finally { await s.stop(); }
});

test('admin: pass mark, lesson type and study content, publishing rules, unpublishing, student exam results', async () => {
  const s = await startServer({ roadmap: true });
  try {
    s.createUser({ email: 'adm@example.com', role: 'admin' });
    const a = new Client(s.base); await a.login('adm@example.com');
    const course = s.db.get("SELECT id FROM courses WHERE slug = 'lexio-roadmap'");
    const lv = s.db.get("SELECT * FROM levels WHERE course_id = ? AND code = 'A1'", course.id);
    // pass mark
    assert.strictEqual((await a.patch('/api/admin/levels/' + lv.id, { exam_pass_pct: 20 })).status, 400);
    assert.strictEqual((await a.patch('/api/admin/levels/' + lv.id, { exam_pass_pct: 85 })).status, 200);
    const c = await learner(s, 'stud@example.com');
    assert.strictEqual((await levels(c)).levels[0].examPassPct, 85, 'the new pass mark is used');
    // level codes with a plus sign, strict flag
    const nl = await a.post(`/api/admin/courses/${course.id}/levels`, { code: 'B1+', title: 'Test level', strict: true, exam_pass_pct: 75 });
    assert.ok([201, 400].includes(nl.status)); if (nl.status === 400) assert.ok(nl.json.fields.code, 'B1+ already exists in the roadmap');
    // one examination per level
    const examLesson = s.db.get("SELECT * FROM lessons WHERE kind = 'exam'");
    const other = s.db.get("SELECT l.id FROM lessons l JOIN units u ON u.id = l.unit_id WHERE u.level_id = ? AND l.kind = 'lesson' LIMIT 1", lv.id);
    assert.strictEqual((await a.patch('/api/admin/lessons/' + other.id, { kind: 'exam' })).status, 400);
    assert.strictEqual((await a.patch('/api/admin/lessons/' + other.id, { kind: 'banana' })).status, 400);
    // study content is cleaned and shown to learners
    const body = { content: { objective: { en: 'New <b>goal</b>', uz: 'Yangi maqsad' }, explanation: { en: 'Line one\nLine two' }, examples: [{ en: 'Hello', tr: { uz: 'Salom' } }, { en: '' }], vocabulary: [{ en: 'cat', uz: 'mushuk', ru: 'кошка' }] }, skill: 'listening' };
    const up = await a.patch('/api/admin/lessons/' + other.id, body); assert.strictEqual(up.status, 200);
    const stored = JSON.parse(s.db.get('SELECT content FROM lessons WHERE id = ?', other.id).content);
    assert.strictEqual(stored.examples.length, 1, 'empty examples are dropped'); assert.strictEqual(s.db.get('SELECT skill FROM lessons WHERE id = ?', other.id).skill, 'listening');
    // publishing rules: an examination or practice test needs 10+ questions
    const unit = s.db.get('SELECT id FROM units WHERE level_id = ? LIMIT 1', lv.id);
    const nlsn = (await a.post(`/api/admin/units/${unit.id}/lessons`, { title: 'Extra test', kind: 'practice_test', skill: 'reading' })).json;
    assert.strictEqual(nlsn.kind, 'practice_test');
    for (let i = 0; i < 3; i++) await a.post(`/api/admin/lessons/${nlsn.id}/exercises`, { type: 'multiple_choice', prompt: 'Q' + i, options: [{ text: 'a', is_correct: true }, { text: 'b' }] });
    assert.strictEqual((await a.post(`/api/admin/lessons/${nlsn.id}/status`, { status: 'published' })).status, 400);
    for (let i = 3; i < 10; i++) await a.post(`/api/admin/lessons/${nlsn.id}/exercises`, { type: 'multiple_choice', prompt: 'Q' + i, options: [{ text: 'a', is_correct: true }, { text: 'b' }] });
    assert.strictEqual((await a.post(`/api/admin/lessons/${nlsn.id}/status`, { status: 'published' })).status, 200);
    // unpublishing removes a lesson from learners' paths
    const before = lessonsOf(await levels(c), 'A1').length;
    assert.strictEqual((await a.post(`/api/admin/lessons/${other.id}/status`, { status: 'draft' })).status, 200);
    assert.strictEqual(lessonsOf(await levels(c), 'A1').length, before - 1, 'the unpublished lesson is gone');
    assert.ok(!lessonsOf(await levels(c), 'A1').some((l) => l.id === other.id));
    // student results visible to the administrator (no personal data beyond what the user page already shows)
    const uid = s.db.get("SELECT id FROM users WHERE email = 'stud@example.com'").id;
    s.db.run("INSERT INTO exam_results (user_id, lesson_id, kind, correct, total, score_pct, pass_pct, passed, created_at) VALUES (?,?,?,?,?,?,?,?,?)", uid, examLesson.id, 'exam', 30, 41, 73, 85, 0, new Date().toISOString());
    const det = (await a.get('/api/admin/users/' + uid)).json;
    assert.strictEqual(det.exams[0].score, 73); assert.strictEqual(det.exams[0].passed, false);
  } finally { await s.stop(); }
});
