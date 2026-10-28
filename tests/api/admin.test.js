const test = require('node:test');
const assert = require('node:assert');
const { startServer, Client } = require('./helpers');

async function as(s, role, email) { s.createUser({ email, role }); const c = new Client(s.base); await c.login(email); return c; }

/* every admin endpoint: [method, url, body] */
const ADMIN_ENDPOINTS = [
  ['GET', '/api/admin/stats'], ['GET', '/api/admin/users'], ['GET', '/api/admin/users/1'], ['POST', '/api/admin/users/1/suspend'], ['POST', '/api/admin/users/1/reactivate'], ['POST', '/api/admin/users/1/role', { role: 'admin' }], ['POST', '/api/admin/users/1/reset-progress', {}],
  ['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings', { site_name: 'x' }], ['GET', '/api/admin/audit'],
  ['GET', '/api/admin/courses'], ['POST', '/api/admin/courses', { title: 'Hack' }], ['GET', '/api/admin/courses/1'], ['PATCH', '/api/admin/courses/1', { title: 'Hack' }], ['POST', '/api/admin/courses/1/status', { status: 'draft' }], ['DELETE', '/api/admin/courses/1', { confirm: true }],
  ['POST', '/api/admin/courses/1/levels', {}], ['PATCH', '/api/admin/levels/1', {}], ['DELETE', '/api/admin/levels/1', { confirm: true }], ['POST', '/api/admin/levels/1/units', {}], ['PATCH', '/api/admin/units/1', {}], ['DELETE', '/api/admin/units/1', { confirm: true }],
  ['POST', '/api/admin/units/1/lessons', {}], ['GET', '/api/admin/lessons/1'], ['PATCH', '/api/admin/lessons/1', {}], ['POST', '/api/admin/lessons/1/status', { status: 'draft' }], ['POST', '/api/admin/lessons/1/duplicate'], ['DELETE', '/api/admin/lessons/1', { confirm: true }],
  ['GET', '/api/admin/exercises/1'], ['POST', '/api/admin/lessons/1/exercises', {}], ['PUT', '/api/admin/exercises/1', {}], ['DELETE', '/api/admin/exercises/1', { confirm: true }], ['GET', '/api/admin/exercises/1/preview'], ['POST', '/api/admin/exercises/validate', {}],
  ['GET', '/api/admin/lessons/1/export?format=json'], ['POST', '/api/admin/lessons/1/import', { format: 'json', content: '[]' }], ['GET', '/api/admin/courses/1/export'],
  ['GET', '/api/admin/vocabulary'], ['POST', '/api/admin/vocabulary', {}], ['PATCH', '/api/admin/vocabulary/1', {}], ['POST', '/api/admin/vocabulary/import', { format: 'csv', content: 'en,uz' }], ['GET', '/api/admin/vocabulary/export'], ['POST', '/api/admin/vocabulary/bulk-status', { ids: [1], status: 'draft' }],
];
const ADMIN_ONLY = /^\/api\/admin\/(stats|users|settings|audit)/;

test('permission matrix: anonymous and learners are refused everywhere; editors only get content tools', async () => {
  const s = await startServer();
  try {
    const learner = await as(s, 'learner', 'l@example.com'), editor = await as(s, 'editor', 'e@example.com'), anon = new Client(s.base);
    for (const [m, u, b] of ADMIN_ENDPOINTS) {
      const a = await anon.req(m, u, b); assert.strictEqual(a.status, 401, `anonymous ${m} ${u} -> ${a.status}`);
      const l = await learner.req(m, u, b); assert.strictEqual(l.status, 403, `learner ${m} ${u} -> ${l.status}`);
      if (ADMIN_ONLY.test(u)) { const e = await editor.req(m, u, b); assert.strictEqual(e.status, 403, `editor ${m} ${u} -> ${e.status}`); }
    }
    assert.strictEqual((await editor.get('/api/admin/courses')).status, 200);
    assert.strictEqual((await editor.get('/api/admin/vocabulary')).status, 200);
    assert.strictEqual((await editor.del('/api/admin/courses/2', { confirm: true, title: 'x' })).status, 403, 'deleting a whole course is administrator-only');
  } finally { await s.stop(); }
});

test('the admin app shell and its assets are only served to staff', async () => {
  const s = await startServer();
  try {
    const learner = await as(s, 'learner', 'l@example.com'), admin = await as(s, 'admin', 'a@example.com');
    for (const url of ['/admin', '/admin/courses', '/admin/assets/admin.js']) {
      const anon = await new Client(s.base).get(url); assert.ok([302, 404].includes(anon.status), `anon ${url} ${anon.status}`);
      const l = await learner.get(url); assert.ok([302, 404].includes(l.status), `learner ${url} ${l.status}`);
    }
    assert.strictEqual((await new Client(s.base).get('/admin/login')).status, 200);
    assert.strictEqual((await admin.get('/admin')).status, 200); assert.strictEqual((await admin.get('/admin/assets/admin.js')).status, 200);
    assert.ok(!(await new Client(s.base).get('/')).text.includes('admin.js'), 'the learner site does not load admin code');
  } finally { await s.stop(); }
});

test('course management: create, edit, publish rules, archive, delete with confirmation', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com');
    let r = await a.post('/api/admin/courses', { title: 'X' }); assert.strictEqual(r.status, 400);
    r = await a.post('/api/admin/courses', { title: 'Business English', description: 'Meetings and e-mails', track: 'general' }); assert.strictEqual(r.status, 201);
    const course = r.json; assert.strictEqual(course.status, 'draft'); assert.ok(course.slug.startsWith('business'));
    assert.strictEqual((await a.post('/api/admin/courses', { title: 'Business English' })).json.slug, 'business-english-2', 'slugs stay unique');
    assert.strictEqual((await a.post(`/api/admin/courses/${course.id}/status`, { status: 'published' })).status, 400, 'an empty course cannot be published');
    const lv = (await a.post(`/api/admin/courses/${course.id}/levels`, { code: 'B2', title: 'Work' })).json;
    assert.strictEqual((await a.post(`/api/admin/courses/${course.id}/levels`, { code: 'B2', title: 'Dupe' })).status, 400, 'one level code per course');
    assert.strictEqual((await a.post(`/api/admin/courses/${course.id}/levels`, { code: 'ZZ', title: 'x' })).status, 400, 'only configured levels');
    const unit = (await a.post(`/api/admin/levels/${lv.id}/units`, { title: 'Meetings' })).json;
    const lesson = (await a.post(`/api/admin/units/${unit.id}/lessons`, { title: 'Agree and disagree', xp_reward: 25 })).json;
    assert.strictEqual(lesson.status, 'draft');
    assert.strictEqual((await a.post(`/api/admin/lessons/${lesson.id}/status`, { status: 'published' })).status, 400, 'a lesson without exercises cannot be published');
    const ex = await a.post(`/api/admin/lessons/${lesson.id}/exercises`, { type: 'multiple_choice', prompt: 'Pick', options: [{ text: 'a', is_correct: true }, { text: 'b' }] }); assert.strictEqual(ex.status, 201);
    assert.strictEqual((await a.post(`/api/admin/lessons/${lesson.id}/status`, { status: 'published' })).status, 200);
    assert.strictEqual((await a.post(`/api/admin/courses/${course.id}/status`, { status: 'published' })).status, 200);
    // learners see it now
    const l = new Client(s.base); s.createUser({ email: 'l@example.com' }); await l.login('l@example.com');
    await l.patch('/api/me', { courseId: course.id });
    assert.strictEqual((await l.get('/api/path')).json.course.title, 'Business English');
    // unpublish hides it again
    await a.post(`/api/admin/courses/${course.id}/status`, { status: 'draft' });
    assert.notStrictEqual((await l.get('/api/path')).json.course.title, 'Business English');
    // delete needs confirmation and the exact title
    assert.strictEqual((await a.del(`/api/admin/courses/${course.id}`, {})).status, 400);
    assert.strictEqual((await a.del(`/api/admin/courses/${course.id}`, { confirm: true, title: 'wrong' })).status, 400);
    assert.strictEqual((await a.del(`/api/admin/courses/${course.id}`, { confirm: true, title: 'Business English' })).status, 200);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM lessons WHERE id = ?', lesson.id).n, 0, 'children are removed with the course');
    // published courses cannot be deleted
    assert.strictEqual((await a.del('/api/admin/courses/1', { confirm: true, title: 'English Foundations' })).status, 400);
  } finally { await s.stop(); }
});

test('units and lessons: reorder, duplicate, prerequisites (no cycles), delete needs confirm', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com');
    const tree = (await a.get('/api/admin/courses/1')).json;
    const unit = tree.levels[0].units[0]; const ids = unit.lessons.map((x) => x.id);
    assert.strictEqual((await a.post(`/api/admin/units/${unit.id}/lessons/reorder`, { ids: ids.slice(1) })).status, 400, 'every lesson must be listed');
    assert.strictEqual((await a.post(`/api/admin/units/${unit.id}/lessons/reorder`, { ids: ids.slice().reverse() })).status, 200);
    assert.deepStrictEqual((await a.get('/api/admin/courses/1')).json.levels[0].units[0].lessons.map((x) => x.id), ids.slice().reverse());
    const dup = await a.post(`/api/admin/lessons/${ids[0]}/duplicate`); assert.strictEqual(dup.status, 201);
    assert.strictEqual(dup.json.status, 'draft'); assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exercises WHERE lesson_id = ?', dup.json.id).n, 12, 'exercises are copied');
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exercise_options WHERE exercise_id IN (SELECT id FROM exercises WHERE lesson_id = ?)', dup.json.id).n > 10, true);
    // prerequisites
    let r = await a.patch(`/api/admin/lessons/${ids[0]}`, { unlock_rule: 'prerequisite', prerequisite_lesson_id: ids[1] }); assert.strictEqual(r.status, 200);
    r = await a.patch(`/api/admin/lessons/${ids[1]}`, { unlock_rule: 'prerequisite', prerequisite_lesson_id: ids[0] }); assert.strictEqual(r.status, 400, 'a loop of prerequisites is refused'); assert.ok(r.json.fields.prerequisite_lesson_id);
    assert.strictEqual((await a.patch(`/api/admin/lessons/${ids[1]}`, { unlock_rule: 'prerequisite' })).status, 400, 'prerequisite rule needs a lesson');
    const other = s.db.get('SELECT id FROM lessons WHERE unit_id IN (SELECT u.id FROM units u JOIN levels l ON l.id = u.level_id WHERE l.course_id = 2) LIMIT 1').id;
    assert.strictEqual((await a.patch(`/api/admin/lessons/${ids[1]}`, { unlock_rule: 'prerequisite', prerequisite_lesson_id: other })).status, 400, 'prerequisite must be in the same course');
    assert.strictEqual((await a.patch(`/api/admin/lessons/${ids[1]}`, { xp_reward: 9999 })).status, 400);
    assert.strictEqual((await a.del(`/api/admin/lessons/${dup.json.id}`, {})).status, 400, 'delete needs confirmation');
    assert.strictEqual((await a.del(`/api/admin/lessons/${dup.json.id}`, { confirm: true })).status, 200);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exercises WHERE lesson_id = ?', dup.json.id).n, 0);
  } finally { await s.stop(); }
});

test('exercise editor API: every type can be created, edited, previewed and checked', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com'); const lessonId = 1;
    const T = [
      { type: 'multiple_choice', prompt: 'Pick', options: [{ text: 'a', is_correct: true }, { text: 'b' }] },
      { type: 'translation_choice', sentence: 'cat', options: [{ text: 'mushuk', is_correct: true }, { text: 'it' }] },
      { type: 'fill_blank', sentence: 'A ____ barks.', answer: 'dog' }, { type: 'translate_type', sentence: 'it', answer: 'dog', direction: 'uz-en' },
      { type: 'scramble_letters', answer: 'apple', sentence: 'olma' }, { type: 'order_words', sentence: 'I like apples.', prompt: 'Men olmani yoqtiraman.' },
      { type: 'match_pairs', options: [{ text: 'a', match_text: 'A' }, { text: 'b', match_text: 'B' }, { text: 'c', match_text: 'C' }] },
      { type: 'listen_choice', audio_text: 'cat', options: [{ text: 'cat', is_correct: true }, { text: 'cut' }] }, { type: 'listen_type', audio_text: 'cat', answer: 'cat' },
      { type: 'reading', passage: 'The cat sat on the mat all day.', prompt: 'Where did it sit?', options: [{ text: 'On the mat', is_correct: true }, { text: 'On the bed' }] }, { type: 'fix_spelling', sentence: 'I lik tea.', answer: 'I like tea.' },
    ];
    for (const t of T) {
      const c = await a.post(`/api/admin/lessons/${lessonId}/exercises`, t); assert.strictEqual(c.status, 201, `${t.type}: ${c.text}`);
      const p = await a.get(`/api/admin/exercises/${c.json.id}/preview`); assert.strictEqual(p.status, 200); assert.deepStrictEqual(p.json.problems, [], t.type); assert.strictEqual(p.json.exercise.type, t.type);
      const ed = await a.put(`/api/admin/exercises/${c.json.id}`, { ...c.json, difficulty: 3, explanation: 'Because.' }); assert.strictEqual(ed.status, 200, `${t.type} edit: ${ed.text}`); assert.strictEqual(ed.json.difficulty, 3);
    }
    const bad = await a.post(`/api/admin/lessons/${lessonId}/exercises`, { type: 'fill_blank', sentence: 'no blank', answer: 'x' }); assert.strictEqual(bad.status, 400); assert.ok(bad.json.fields.sentence);
    const draft = await a.post(`/api/admin/lessons/${lessonId}/exercises`, { type: 'fill_blank', sentence: 'no blank', answer: 'x', status: 'draft' }); assert.strictEqual(draft.status, 201, 'incomplete exercises can be saved as drafts');
    const chk = await a.post(`/api/admin/exercises/${draft.json.id}/preview-check`, { answer: 'x' }); assert.ok([200, 400].includes(chk.status));
    const before = s.db.get('SELECT COUNT(*) n FROM exercise_responses').n;
    const pc = await a.post(`/api/admin/exercises/${(await a.post(`/api/admin/lessons/${lessonId}/exercises`, T[0])).json.id}/preview-check`, { answer: 1 });
    assert.strictEqual(pc.status === 200 || pc.status === 400, true); assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exercise_responses').n, before, 'previews store nothing');
    // reorder + duplicate + delete
    const list = (await a.get(`/api/admin/lessons/${lessonId}`)).json.exercises; const ids = list.map((x) => x.id);
    assert.strictEqual((await a.post(`/api/admin/lessons/${lessonId}/exercises/reorder`, { ids: ids.slice().reverse() })).status, 200);
    const d = await a.post(`/api/admin/exercises/${ids[0]}/duplicate`); assert.strictEqual(d.status, 201);
    assert.strictEqual((await a.del(`/api/admin/exercises/${d.json.id}`, {})).status, 400);
    assert.strictEqual((await a.del(`/api/admin/exercises/${d.json.id}`, { confirm: true })).status, 200);
    assert.strictEqual((await a.get('/api/admin/exercise-types')).json.types.length, 11);
  } finally { await s.stop(); }
});

test('import/export: JSON and CSV round-trip, invalid files are rejected as a whole', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com');
    const json = (await a.get('/api/admin/lessons/1/export?format=json')).json;
    assert.strictEqual(json.format, 'lexi-exercises'); assert.strictEqual(json.exercises.length, 12);
    const csvRes = await a.get('/api/admin/lessons/1/export?format=csv'); assert.match(csvRes.headers.get('content-type'), /text\/csv/);
    assert.ok(csvRes.text.split('\r\n')[0].startsWith('type,prompt,sentence,answer'));
    const target = (await a.post('/api/admin/units/1/lessons', { title: 'Import target' })).json;
    let r = await a.post(`/api/admin/lessons/${target.id}/import`, { format: 'json', content: JSON.stringify(json) }); assert.strictEqual(r.status, 201); assert.strictEqual(r.json.imported, 12);
    const target2 = (await a.post('/api/admin/units/1/lessons', { title: 'CSV target' })).json;
    r = await a.post(`/api/admin/lessons/${target2.id}/import`, { format: 'csv', content: csvRes.text }); assert.strictEqual(r.status, 201, r.text); assert.strictEqual(r.json.imported, 12);
    const a1 = (await a.get(`/api/admin/lessons/${target.id}`)).json.exercises.map((x) => x.type), a2 = (await a.get(`/api/admin/lessons/${target2.id}`)).json.exercises.map((x) => x.type);
    assert.deepStrictEqual(a1, a2); assert.deepStrictEqual(a1, (await a.get('/api/admin/lessons/1')).json.exercises.map((x) => x.type));
    // one bad row -> nothing imported
    const mixed = JSON.stringify({ exercises: [json.exercises[0], { type: 'fill_blank', sentence: 'no blank', answer: 'x' }] });
    const t3 = (await a.post('/api/admin/units/1/lessons', { title: 'Bad' })).json;
    r = await a.post(`/api/admin/lessons/${t3.id}/import`, { format: 'json', content: mixed }); assert.strictEqual(r.status, 422); assert.strictEqual(r.json.problems[0].row, 2);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM exercises WHERE lesson_id = ?', t3.id).n, 0, 'all or nothing');
    assert.strictEqual((await a.post(`/api/admin/lessons/${t3.id}/import`, { format: 'json', content: '{not json' })).status, 400);
    assert.strictEqual((await a.post(`/api/admin/lessons/${t3.id}/import`, { format: 'json', content: '[]' })).status, 400);
    assert.strictEqual((await a.get('/api/admin/courses/1/export')).json.format, 'lexi-course');
    // CSV formula injection is neutralised on export
    const evil = (await a.post('/api/admin/lessons/1/exercises', { type: 'multiple_choice', prompt: '=HYPERLINK("http://evil.example")', options: [{ text: 'a', is_correct: true }, { text: 'b' }] })).json;
    assert.ok((await a.get('/api/admin/lessons/1/export?format=csv')).text.includes(`"'=HYPERLINK`), 'cells starting with = are prefixed');
  } finally { await s.stop(); }
});

test('vocabulary management: CRUD, validation, duplicates, bulk status, import, export, search', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'editor', 'e@example.com');
    let r = await a.post('/api/admin/vocabulary', { en: '', uz: 'x' }); assert.strictEqual(r.status, 400); assert.ok(r.json.fields.en);
    r = await a.post('/api/admin/vocabulary', { en: 'umbrella', uz: 'soyabon', pos: 'noun', cefr: 'A2', example: 'Take an umbrella.', example_uz: 'Soyabon oling.', translations: { ru: 'зонт' }, course_id: 1 }); assert.strictEqual(r.status, 201);
    const id = r.json.id; assert.deepStrictEqual(r.json.translations, { ru: 'зонт' });
    assert.strictEqual((await a.post('/api/admin/vocabulary', { en: 'UMBRELLA', uz: 'Soyabon' })).status, 400, 'duplicates rejected case-insensitively');
    assert.strictEqual((await a.post('/api/admin/vocabulary', { en: 'x', uz: 'y', pos: 'weird' })).status, 400);
    assert.strictEqual((await a.post('/api/admin/vocabulary', { en: 'x', uz: 'y', audio_url: 'http://evil.example/a.mp3' })).status, 400);
    r = await a.patch(`/api/admin/vocabulary/${id}`, { uz: 'yomg‘ir soyabon' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.json.uz, 'yomg‘ir soyabon');
    const found = (await a.get('/api/admin/vocabulary?q=umbr&status=published')).json; assert.strictEqual(found.total, 1);
    r = await a.post('/api/admin/vocabulary/bulk-status', { ids: [id], status: 'archived' }); assert.strictEqual(r.json.updated, 1);
    assert.strictEqual((await a.get('/api/admin/vocabulary?q=umbr&status=published')).json.total, 0);
    const imp = 'en,uz,pos,cefr,example,example_uz,ru,status\r\nlibrary,kutubxona,noun,A2,"I go to the library, often.",Men tez-tez kutubxonaga boraman.,библиотека,published\r\ncinema,kino,noun,A1,,,,draft\r\nlibrary,kutubxona,noun,A2,,,,published\r\n';
    r = await a.post('/api/admin/vocabulary/import', { format: 'csv', content: imp, courseId: 1 }); assert.strictEqual(r.status, 201); assert.deepStrictEqual([r.json.added, r.json.skipped], [2, 1], 'the duplicate row is skipped');
    assert.strictEqual(s.db.get("SELECT example FROM vocabulary WHERE en = 'library'").example, 'I go to the library, often.', 'quoted CSV commas survive');
    r = await a.post('/api/admin/vocabulary/import', { format: 'csv', content: 'en,uz\r\nok,fine\r\n,missing' }); assert.strictEqual(r.status, 422); assert.strictEqual(s.db.get("SELECT COUNT(*) n FROM vocabulary WHERE en = 'ok'").n, 0, 'invalid files import nothing');
    r = await a.post('/api/admin/vocabulary/import', { format: 'json', content: JSON.stringify({ items: [{ en: 'bridge', uz: 'ko‘prik' }] }) }); assert.strictEqual(r.json.added, 1);
    const ex = await a.get('/api/admin/vocabulary/export?format=csv'); assert.ok(ex.text.includes('kutubxona')); assert.strictEqual((await a.get('/api/admin/vocabulary/export?format=json')).json.format, 'lexi-vocabulary');
    // search is injection-safe and the page size is bounded
    assert.strictEqual((await a.get("/api/admin/vocabulary?q=' OR 1=1 --")).json.total, 0);
    const page = (await a.get('/api/admin/vocabulary?pageSize=5&page=2')).json; assert.strictEqual(page.items.length, 5); assert.strictEqual(page.page, 2);
    assert.ok((await a.get('/api/admin/vocabulary?pageSize=100000')).json.pageSize <= 100);
    // XSS payloads are stored as plain text and returned as JSON strings (the UI renders text only)
    r = await a.post('/api/admin/vocabulary', { en: '<img src=x onerror=alert(1)>', uz: '<script>alert(1)</script>' }); assert.strictEqual(r.status, 201); assert.strictEqual(r.json.en, '<img src=x onerror=alert(1)>');
  } finally { await s.stop(); }
});

test('uploads: only real small audio files are accepted', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com'); const l = await as(s, 'learner', 'l@example.com');
    const up = (c, buf, name, type = 'application/octet-stream') => c.req('POST', '/api/admin/uploads', buf, { raw: true, headers: { 'Content-Type': type, 'X-Filename': name } });
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([36, 0, 0, 0]), Buffer.from('WAVEfmt '), Buffer.alloc(40)]);
    assert.strictEqual((await up(l, wav, 'a.wav')).status, 403);
    let r = await up(a, wav, 'hello.wav'); assert.strictEqual(r.status, 201); assert.match(r.json.url, /^\/uploads\/[\w-]+$/);
    const served = await fetch(s.base + r.json.url); assert.strictEqual(served.status, 200); assert.strictEqual(served.headers.get('content-type'), 'audio/wav'); assert.strictEqual(served.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual((await up(a, Buffer.from('<?php echo 1; ?>'), 'shell.mp3')).status, 400, 'content must match the extension');
    assert.strictEqual((await up(a, Buffer.from('<script>alert(1)</script>'), 'x.html')).status, 400, 'only audio extensions');
    assert.strictEqual((await up(a, Buffer.concat([Buffer.from('OggS'), Buffer.alloc(2.2 * 1024 * 1024)]), 'big.ogg')).status, 400, 'over 2 MB is refused');
    assert.strictEqual((await fetch(s.base + '/uploads/..%2f..%2fetc%2fpasswd')).status, 404, 'no path traversal'); assert.strictEqual((await fetch(s.base + '/uploads/nonexistent1')).status, 404);
    // an exercise can reference an uploaded file but not an arbitrary URL
    const ex = await a.post('/api/admin/lessons/1/exercises', { type: 'listen_type', answer: 'hi', audio_url: r.json.url }); assert.strictEqual(ex.status, 201);
    assert.strictEqual((await a.post('/api/admin/lessons/1/exercises', { type: 'listen_type', answer: 'hi', audio_url: 'https://evil.example/x.mp3' })).status, 400);
  } finally { await s.stop(); }
});

test('user management: rules for roles, suspension and progress reset', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com');
    const meId = s.db.get("SELECT id FROM users WHERE email = 'a@example.com'").id;
    const lid = s.createUser({ email: 'l@example.com' }); const l = new Client(s.base); await l.login('l@example.com');
    assert.strictEqual((await a.post(`/api/admin/users/${meId}/role`, { role: 'learner' })).status, 400, 'nobody changes their own role');
    assert.strictEqual((await a.post(`/api/admin/users/${meId}/suspend`)).status, 400, 'nobody suspends themselves');
    assert.strictEqual((await a.post(`/api/admin/users/${lid}/role`, { role: 'superuser' })).status, 400);
    assert.strictEqual((await a.post(`/api/admin/users/${lid}/role`, { role: 'editor' })).json.role, 'editor');
    assert.strictEqual((await l.get('/api/admin/courses')).status, 200, 'the new role applies immediately');
    await a.post(`/api/admin/users/${lid}/role`, { role: 'admin' });
    const b = await a.post(`/api/admin/users/${meId}/role`, { role: 'learner' }); assert.strictEqual(b.status, 400);
    // the other admin cannot demote the last remaining admin... there are two now; demote one, then the last one is protected
    assert.strictEqual((await l.post(`/api/admin/users/${meId}/role`, { role: 'learner' })).status, 200);
    assert.strictEqual((await l.post(`/api/admin/users/${lid}/role`, { role: 'learner' })).status, 400, 'self change refused; and there is only one admin left');
    assert.strictEqual((await a.get('/api/admin/users')).status, 403, 'the demoted admin lost access at once');
  } finally { await s.stop(); }
});

test('user management: suspend, reactivate, list, detail, reset progress with confirmation', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com');
    const lid = s.createUser({ email: 'learner@example.com', name: 'Lea' }); const l = new Client(s.base); await l.login('learner@example.com');
    const path = (await l.get('/api/path')).json; const st = (await l.post(`/api/lessons/${path.levels[0].units[0].lessons[0].id}/start`)).json;
    const { playAttempt } = require('./helpers'); await playAttempt(l, st, s.db);
    const detail = (await a.get(`/api/admin/users/${lid}`)).json;
    assert.strictEqual(detail.lessonsCompleted, 1); assert.strictEqual(detail.user.xpTotal, 150); assert.ok(!JSON.stringify(detail).includes('password'), 'never any password data');
    assert.strictEqual(detail.week.length, 7); assert.ok(detail.recent.length >= 1);
    const list = (await a.get('/api/admin/users?q=lea&role=learner&status=active&pageSize=5')).json; assert.strictEqual(list.total, 1); assert.ok(!JSON.stringify(list).includes('password'));
    assert.strictEqual((await a.post(`/api/admin/users/${lid}/suspend`)).json.status, 'suspended');
    assert.strictEqual((await l.get('/api/me/stats')).status, 401, 'suspension ends the session');
    assert.strictEqual((await new Client(s.base).post('/api/auth/login', { email: 'learner@example.com', password: 'Passw0rd!x' })).status, 403);
    await a.post(`/api/admin/users/${lid}/reactivate`); await l.login('learner@example.com');
    assert.strictEqual((await a.post(`/api/admin/users/${lid}/reset-progress`, {})).status, 400);
    assert.strictEqual((await a.post(`/api/admin/users/${lid}/reset-progress`, { confirmEmail: 'wrong@example.com' })).status, 400);
    assert.strictEqual((await a.post(`/api/admin/users/${lid}/reset-progress`, { confirmEmail: 'learner@example.com' })).status, 200);
    const after = (await a.get(`/api/admin/users/${lid}`)).json; assert.strictEqual(after.user.xpTotal, 0); assert.strictEqual(after.lessonsCompleted, 0);
    assert.strictEqual(s.db.get('SELECT COUNT(*) n FROM users WHERE id = ?', lid).n, 1, 'the account stays');
  } finally { await s.stop(); }
});

test('settings are validated, applied and audited; maintenance mode blocks learners only', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com'); const l = await as(s, 'learner', 'l@example.com');
    assert.strictEqual((await a.put('/api/admin/settings', { default_daily_goal_xp: 3 })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { brand_color: 'red' })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { unknown_key: 1 })).status, 400);
    assert.strictEqual((await a.put('/api/admin/settings', { max_hearts: 'many' })).status, 400);
    let r = await a.put('/api/admin/settings', { site_name: 'Tashkent English', brand_color: '#3366ff', max_hearts: 3, xp_per_correct: 12, available_levels: ['A1', 'A2'] }); assert.strictEqual(r.status, 200);
    const cfg = (await new Client(s.base).get('/api/public/config')).json; assert.strictEqual(cfg.siteName, 'Tashkent English'); assert.strictEqual(cfg.brandColor, '#3366ff');
    // XP setting is used by the server
    const path = (await l.get('/api/path')).json; const st = (await l.post(`/api/lessons/${path.levels[0].units[0].lessons[0].id}/start`)).json;
    assert.strictEqual(st.maxHearts, 3);
    const { answerFor } = require('./helpers'); const first = await l.post(`/api/attempts/${st.attemptId}/answer`, { exerciseId: st.exercise.id, answer: answerFor(s.db, st) });
    assert.strictEqual(first.json.feedback.xp, 12);
    // maintenance
    await a.put('/api/admin/settings', { maintenance_mode: true, maintenance_message: 'Back at noon' });
    const blocked = await l.get('/api/path'); assert.strictEqual(blocked.status, 503); assert.strictEqual(blocked.json.error, 'Back at noon');
    assert.strictEqual((await a.get('/api/admin/courses')).status, 200, 'staff keep working');
    assert.strictEqual((await new Client(s.base).get('/api/public/config')).json.maintenance, 'Back at noon');
    await a.put('/api/admin/settings', { maintenance_mode: false });
    assert.strictEqual((await l.get('/api/path')).status, 200);
    // registration can be closed
    await a.put('/api/admin/settings', { registration_open: false });
    assert.strictEqual((await new Client(s.base).post('/api/auth/register', { email: 'n@example.com', password: 'Passw0rd1', displayName: 'New' })).status, 403);
    // hearts can be switched off
    await a.put('/api/admin/settings', { hearts_enabled: false });
    assert.strictEqual((await l.get('/api/me/stats')).json.hearts.enabled, false);
  } finally { await s.stop(); }
});

test('every administrative change is written to the audit log', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com');
    const course = (await a.post('/api/admin/courses', { title: 'Audited course' })).json;
    await a.patch(`/api/admin/courses/${course.id}`, { description: 'x' });
    await a.put('/api/admin/settings', { tagline: 'New tagline' });
    await a.post('/api/admin/vocabulary', { en: 'audit', uz: 'tekshiruv' });
    await a.del(`/api/admin/courses/${course.id}`, { confirm: true, title: 'Audited course' });
    const log = (await a.get('/api/admin/audit?pageSize=50')).json;
    const actions = log.items.map((x) => x.action);
    for (const want of ['course.create', 'course.update', 'settings.update', 'vocabulary.create', 'course.delete']) assert.ok(actions.includes(want), want);
    assert.ok(log.items.every((x) => x.admin_email === 'a@example.com' && x.created_at));
    assert.strictEqual((await a.get('/api/admin/audit?action=course.')).json.items.every((x) => x.action.startsWith('course.')), true);
    assert.strictEqual((await a.get('/api/admin/audit?pageSize=5&page=2')).json.page, 2);
    // reads are not logged, failed (validation) writes are not logged
    const n = log.total; await a.get('/api/admin/courses'); await a.post('/api/admin/courses', { title: 'x' });
    assert.strictEqual((await a.get('/api/admin/audit')).json.total, n);
  } finally { await s.stop(); }
});

test('admin statistics come from real records', async () => {
  const s = await startServer();
  try {
    const a = await as(s, 'admin', 'a@example.com'); const l = await as(s, 'learner', 'l@example.com');
    const before = (await a.get('/api/admin/stats?days=7')).json;
    assert.strictEqual(before.totals.users, 2); assert.strictEqual(before.totals.completedLessons, 0); assert.strictEqual(before.totals.exercises, 144); assert.strictEqual(before.totals.courses, 2);
    assert.strictEqual(before.signups.length, 7); assert.strictEqual(before.signups.reduce((n, x) => n + x.value, 0), 2);
    const { playAttempt } = require('./helpers');
    const path = (await l.get('/api/path')).json; await playAttempt(l, (await l.post(`/api/lessons/${path.levels[0].units[0].lessons[0].id}/start`)).json, s.db);
    const after = (await a.get('/api/admin/stats?days=30')).json;
    assert.strictEqual(after.totals.completedLessons, 1); assert.strictEqual(after.totals.exerciseAttempts, 12); assert.strictEqual(after.totals.accuracy, 100); assert.strictEqual(after.active.d1, 1);
    assert.strictEqual(after.completions.reduce((n, x) => n + x.value, 0), 1); assert.strictEqual(after.attemptsPerDay.reduce((n, x) => n + x.value, 0), 12);
    const c1 = after.courses.find((c) => c.id === 1); assert.strictEqual(c1.learners, 1); assert.strictEqual(c1.completed_lessons, 1); assert.strictEqual(c1.finished_learners, 0);
    assert.strictEqual(after.days, 30);
  } finally { await s.stop(); }
});
