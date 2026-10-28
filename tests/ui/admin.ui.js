/* Administrator panel through the real UI: node tests/ui/admin.ui.js */
const { check, withBrowser, openPage, summary, loginUI, startServer, Client } = require('./lib');

(async () => {
  const s = await startServer();
  s.createUser({ email: 'admin@example.com', role: 'admin', name: 'Boss' });
  s.createUser({ email: 'editor@example.com', role: 'editor', name: 'Edie' });
  s.createUser({ email: 'learner@example.com', role: 'learner', name: 'Lena' });
  await withBrowser(async (browser, viewport) => {
    const page = await openPage(browser, viewport); page.setDefaultTimeout(15000);

    /* ---------- access control in the browser ---------- */
    page.expectedStatuses.add(401); page.expectedStatuses.add(403);
    await page.goto(s.base + '/admin'); await page.waitForURL('**/admin/login');
    check(true, 'visiting /admin while signed out redirects to the admin sign-in');
    await page.fill('input[name=email]', 'learner@example.com'); await page.fill('input[name=password]', 'Passw0rd!x'); await page.click('button[type=submit]');
    await page.waitForSelector('.form-error:not([hidden])');
    check((await page.locator('.form-error').innerText()).includes('does not have access'), 'a learner account cannot use the admin panel');
    check((await page.goto(s.base + '/admin')).url().includes('/admin/login'), 'and /admin still redirects them');
    page.expectedStatuses.add(404);
    check((await page.goto(s.base + '/admin/assets/admin.js')).status() === 404, 'admin JavaScript returns 404 for a signed-out/learner browser');

    // editor
    const ed = await openPage(browser, viewport); ed.setDefaultTimeout(15000); ed.expectedStatuses.add(403);
    await loginUI(ed, s.base, 'editor@example.com', 'Passw0rd!x', '/admin/login'); await ed.waitForSelector('.adm');
    const edNav = await ed.locator('.adm-side nav a[data-nav]').allInnerTexts();
    check(edNav.join(',') === 'Courses,Vocabulary,Placement & grammar', 'editors see only content sections (Courses, Vocabulary, Placement & grammar) (' + edNav.join(',') + ')');
    await ed.goto(s.base + '/admin/users'); await ed.waitForURL('**/admin/courses');
    check(true, 'an editor opening /admin/users is sent back to Courses');
    check((await ed.request.get(s.base + '/api/admin/users')).status() === 403, 'and the API refuses them too');

    // admin
    await loginUI(page, s.base, 'admin@example.com', 'Passw0rd!x', '/admin/login'); await page.waitForSelector('.stat-grid');
    check(new URL(page.url()).pathname === '/admin', 'administrator lands on the dashboard');
    const stat = async (label) => Number(await page.locator('.stat-card', { hasText: label }).first().locator('b').innerText());
    check((await stat('Registered users')) === 3 && (await stat('Exercises')) === 144 && (await stat('Lessons')) === 12, 'dashboard numbers equal the database');
    check((await page.locator('svg.chart').count()) === 4, 'four charts are drawn from real records');
    check((await page.locator('.adm-side nav a[data-nav]').count()) === 8, 'administrator sees all 8 sections');

    /* ---------- course -> level -> unit -> lesson -> exercise ---------- */
    await page.click('.adm-side a:has-text("Courses")'); await page.waitForSelector('.tbl');
    check((await page.locator('.tbl tbody tr').count()) === 2, 'course list shows the two sample courses');
    await page.click('button:has-text("New course")'); await page.waitForSelector('dialog');
    page.expectedStatuses.add(400);
    await page.fill('dialog input[name=title]', 'X'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('dialog .form-error:not([hidden])'); check(true, 'course title is validated');
    await page.fill('dialog input[name=title]', 'Business English'); await page.fill('dialog textarea[name=description]', 'Emails and meetings'); await page.click('dialog button[type=submit]');
    await page.waitForURL('**/admin/courses/*'); await page.waitForSelector('h1:has-text("Business English")');
    check((await page.locator('.badge.tag-draft').first().innerText()) === 'Draft', 'a new course starts as a draft');
    await page.click('button:has-text("Publish")'); await page.waitForSelector('.toast.error'); check((await page.locator('.toast.error').innerText()).includes('Publish at least one lesson'), 'an empty course cannot be published');
    await page.click('button:has-text("Add level")'); await page.selectOption('dialog select[name=code]', 'B1'); await page.fill('dialog input[name=title]', 'Intermediate work English'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('.tree-level');
    await page.click('.tree-level button:has-text("Unit")'); await page.fill('dialog input[name=title]', 'Meetings'); await page.click('dialog button[type=submit]'); await page.waitForSelector('.tree-unit');
    await page.click('.tree-unit button:has-text("Lesson")'); await page.fill('dialog input[name=title]', 'Agreeing politely'); await page.click('dialog button[type=submit]');
    await page.waitForURL('**/admin/lessons/*'); await page.waitForSelector('h1:has-text("Agreeing politely")');
    const lessonId = Number(new URL(page.url()).pathname.split('/').pop());
    check(s.db.get('SELECT status n FROM lessons WHERE id = ?', lessonId).n === 'draft', 'new lessons are drafts');

    // build one exercise of every type through the editor, checking validation messages
    const openNew = async () => { await page.click('button:has-text("Add exercise")'); await page.waitForSelector('dialog select[name=type]'); };
    const save = async () => { await page.click('dialog button[type=submit]'); };
    // multiple choice: invalid then valid
    await openNew(); await page.fill('dialog input[name=prompt]', 'Choose the polite reply'); await save();
    await page.waitForSelector('dialog .form-error:not([hidden])');
    check((await page.locator('dialog .form-error').innerText()).includes('cannot be published'), 'an incomplete exercise cannot be published (server message)');
    const optInputs = page.locator('dialog .opt-row input.input');
    await optInputs.nth(0).fill('I see your point.'); await optInputs.nth(1).fill('Nonsense!'); await optInputs.nth(2).fill('Be quiet.');
    await page.check('dialog .opt-row input[type=radio] >> nth=0');
    await page.click('dialog button:has-text("Check for problems")'); await page.waitForSelector('dialog .ok-box');
    check(true, 'the editor confirms a valid exercise'); await save(); await page.waitForSelector('.tbl tbody tr');
    check((await page.locator('.tbl tbody tr').count()) === 1, 'exercise saved and listed');
    const addVia = async (type, fill) => { const rows0 = await page.locator('.tbl tbody tr').count(); await openNew(); await page.selectOption('dialog select[name=type]', type); await fill(); await save(); await page.waitForFunction((n) => document.querySelectorAll('.tbl tbody tr').length === n, rows0 + 1); };
    await addVia('fill_blank', async () => { await page.fill('dialog input[name=sentence]', 'I ____ with you.'); await page.fill('dialog textarea[name=answer]', 'agree'); });
    await addVia('scramble_letters', async () => { await page.fill('dialog input[name=sentence]', 'rozi bo‘lmoq'); await page.fill('dialog textarea[name=answer]', 'agree'); });
    await addVia('order_words', async () => { await page.fill('dialog input[name=prompt]', 'Men siz bilan roziman.'); await page.fill('dialog input[name=sentence]', 'I agree with you.'); });
    await addVia('match_pairs', async () => { const p = page.locator('dialog .opt-row.pair input'); const v = [['agree', 'rozi bo‘lmoq'], ['point', 'fikr'], ['meeting', 'yig‘ilish'], ['reply', 'javob']]; for (let i = 0; i < 4; i++) { await p.nth(i * 2).fill(v[i][0]); await p.nth(i * 2 + 1).fill(v[i][1]); } });
    await addVia('reading', async () => { await page.fill('dialog textarea[name=passage]', 'Dilya listened carefully in the meeting and then said she agreed with the plan.'); await page.fill('dialog input[name=prompt]', 'What did Dilya say?'); const o = page.locator('dialog .opt-row input.input'); await o.nth(0).fill('She agreed.'); await o.nth(1).fill('She left.'); await o.nth(2).fill('She slept.'); await page.check('dialog .opt-row input[type=radio] >> nth=0'); });
    await addVia('listen_type', async () => { await page.fill('dialog input[name=audio_text]', 'agree'); await page.fill('dialog textarea[name=answer]', 'agree'); });
    await addVia('fix_spelling', async () => { await page.fill('dialog input[name=sentence]', 'I agre with you.'); await page.fill('dialog textarea[name=answer]', 'I agree with you.'); });
    check(s.db.get('SELECT COUNT(*) n FROM exercises WHERE lesson_id = ?', lessonId).n === 8, 'eight exercises created through the editor');
    // preview as learner
    await page.click('button[aria-label="Preview as learner"] >> nth=0'); await page.waitForSelector('.preview-box .option');
    await page.click('.preview-box .option >> nth=0'); await page.click('dialog button:text-is("Check")'); await page.waitForSelector('.preview-box .lesson-foot:not([hidden])');
    check((await page.locator('.preview-box .lesson-foot').innerText()).length > 3, 'the preview behaves like the learner exercise');
    check(s.db.get('SELECT COUNT(*) n FROM exercise_responses').n === 0, 'preview stores no learner data');
    await page.click('dialog button:has-text("Close")');
    // reorder, duplicate, delete with confirmation
    const firstPrompt = async () => (await page.locator('.tbl tbody tr').first().innerText());
    const before = await firstPrompt();
    await page.click('button[aria-label="Move down"] >> nth=0'); await page.waitForFunction((b) => document.querySelector('.tbl tbody tr').innerText !== b, before);
    check(true, 'exercises can be reordered');
    await page.click('button[aria-label="Duplicate"] >> nth=0'); await page.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length === 9);
    await page.click('button[aria-label="Delete"] >> nth=0'); await page.waitForSelector('dialog');
    await page.click('dialog button:has-text("Cancel")'); check((await page.locator('.tbl tbody tr').count()) === 9, 'cancelling a delete keeps the exercise');
    await page.click('button[aria-label="Delete"] >> nth=0'); await page.click('dialog button.danger'); await page.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length === 8);
    check(true, 'deleting asks for confirmation and then removes it');
    // import with errors, then valid
    await page.click('button:has-text("Import")'); await page.waitForSelector('dialog textarea[name=content]');
    page.expectedStatuses.add(422);
    await page.fill('dialog textarea[name=content]', JSON.stringify({ exercises: [{ type: 'fill_blank', sentence: 'no blank', answer: 'x' }] })); await page.click('dialog button[type=submit]');
    await page.waitForSelector('dialog .problems'); check((await page.locator('dialog .problems').innerText()).includes('Row 1'), 'import errors name the failing row');
    await page.fill('dialog textarea[name=content]', JSON.stringify({ exercises: [{ type: 'multiple_choice', prompt: 'Imported?', options: [{ text: 'yes', correct: true }, { text: 'no' }] }] })); await page.click('dialog button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length === 9); check(true, 'a valid import adds the exercise');
    // publish lesson & course
    await page.click('button:has-text("Publish")'); await page.waitForSelector('.badge.tag-published');
    check(s.db.get('SELECT status n FROM lessons WHERE id = ?', lessonId).n === 'published', 'lesson published');
    await page.click('.crumbs a:text-is("Business English")'); await page.waitForSelector('.tree-level'); await page.click('button:has-text("Publish")'); await page.waitForSelector('.badge.tag-published');
    check(s.db.get("SELECT status n FROM courses WHERE title = 'Business English'").n === 'published', 'course published');
    // …and a learner can now study it
    const learner = new Client(s.base); await learner.login('learner@example.com');
    const cid = s.db.get("SELECT id n FROM courses WHERE title = 'Business English'").n;
    await learner.patch('/api/me', { courseId: cid });
    const lp = (await learner.get('/api/path')).json; check(lp.course.title === 'Business English' && lp.levels[0].units[0].lessons[0].title === 'Agreeing politely' && lp.levels[0].units[0].lessons[0].state === 'available', 'the new course appears for learners with the new lesson unlocked');

    /* ---------- vocabulary ---------- */
    await page.click('.adm-side a:has-text("Vocabulary")'); await page.waitForSelector('.tbl');
    check((await page.locator('.tbl tbody tr').count()) === 20, 'vocabulary table is paginated (20 per page)');
    await page.click('button:has-text("Add word")'); await page.fill('dialog input[name=en]', 'meeting'); await page.fill('dialog input[name=uz]', 'yig‘ilish'); await page.fill('dialog input[name=example]', 'We have a meeting at ten.'); await page.click('dialog button[type=submit]');
    await page.waitForFunction(() => !document.querySelector('dialog')); await page.fill('input[type=search]', 'meeting'); await page.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length >= 1);
    check(s.db.get("SELECT COUNT(*) n FROM vocabulary WHERE en = 'meeting' COLLATE NOCASE").n >= 1, 'a word was added');
    await page.click('button:has-text("Add word")'); await page.fill('dialog input[name=en]', 'meeting'); await page.fill('dialog input[name=uz]', 'yig‘ilish'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('dialog .form-error:not([hidden])'); check(true, 'duplicate words are rejected'); await page.click('dialog button:has-text("Cancel")');
    await page.click('button:has-text("Import")'); await page.selectOption('dialog select[name=format]', 'csv'); await page.fill('dialog textarea[name=content]', 'en,uz,pos,cefr\nlibrary,kutubxona,noun,A2\nbridge,ko‘prik,noun,B1'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('.toast'); check(s.db.get("SELECT COUNT(*) n FROM vocabulary WHERE en IN ('library','bridge')").n === 2, 'CSV vocabulary import works');
    await page.fill('input[type=search]', 'library'); await page.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length === 1);
    await page.check('input[aria-label="Select library"]'); await page.click('button:has-text("Set archived")'); await page.waitForSelector('.toast');
    check(s.db.get("SELECT status n FROM vocabulary WHERE en = 'library'").n === 'archived', 'bulk status change works');
    await page.click('button[aria-label="Edit library"]'); await page.waitForSelector('dialog input[name=uz]'); await page.fill('dialog input[name=ru]', 'библиотека'); await page.click('dialog button[type=submit]'); await page.waitForSelector('.toast');
    check(JSON.parse(s.db.get("SELECT translations n FROM vocabulary WHERE en = 'library'").n).ru === 'библиотека', 'translations in other languages are stored');

    /* ---------- users ---------- */
    await page.click('.adm-side a:has-text("Users")'); await page.waitForSelector('.tbl');
    await page.fill('input[type=search]', 'lena'); await page.waitForFunction(() => document.querySelectorAll('.tbl tbody tr').length === 1);
    await page.click('.tbl a:has-text("Lena")'); await page.waitForSelector('.stat-grid');
    check((await page.locator('body').innerText()).includes('learner@example.com') && !(await page.content()).includes('scrypt'), 'user detail shows activity but never password data');
    await page.click('button:has-text("Suspend")'); await page.click('dialog button.danger'); await page.waitForSelector('.badge.tag-suspended');
    check(s.db.get("SELECT status n FROM users WHERE email = 'learner@example.com'").n === 'suspended', 'a user can be suspended (with confirmation)');
    await page.click('button:has-text("Reactivate")'); await page.waitForSelector('.badge.tag-active'); check(true, 'and reactivated');
    await page.selectOption('select[aria-label=Role]', 'editor'); await page.click('button:has-text("Change role")'); await page.waitForSelector('.toast');
    check(s.db.get("SELECT role n FROM users WHERE email = 'learner@example.com'").n === 'editor', 'roles are changed by an administrator');
    await page.selectOption('select[aria-label=Role]', 'learner'); await page.click('button:has-text("Change role")');
    await page.click('button:has-text("Reset progress…")'); await page.waitForSelector('dialog input');
    await page.click('dialog button.danger'); await page.waitForFunction(() => !document.querySelector('dialog'));
    check(s.db.get("SELECT COUNT(*) n FROM audit_log WHERE action = 'user.reset_progress'").n === 0, 'confirming without typing the e-mail does nothing');
    await page.click('button:has-text("Reset progress…")'); await page.waitForSelector('dialog input');
    await page.fill('dialog input', 'learner@example.com'); await page.click('dialog button.danger'); await page.waitForSelector('.toast');
    check(true, 'progress reset after typed confirmation');
    // own row cannot be demoted
    await page.goto(s.base + '/admin/users'); await page.click('.tbl a:has-text("Boss")'); await page.waitForSelector('.stat-grid');
    check(await page.locator('button:has-text("Suspend")').isDisabled() && await page.locator('button:has-text("Change role")').isDisabled(), 'an administrator cannot suspend or demote themselves in the UI either');

    /* ---------- settings ---------- */
    await page.click('.adm-side a:has-text("Settings")'); await page.waitForSelector('input[name=site_name]');
    await page.fill('input[name=site_name]', 'Tashkent English'); await page.fill('input[name=max_hearts]', '3'); await page.fill('input[name=default_daily_goal_xp]', '3'); await page.click('button:has-text("Save settings")');
    await page.waitForSelector('.error-text:not([hidden])'); check(true, 'invalid settings are rejected with a field message');
    await page.fill('input[name=default_daily_goal_xp]', '40'); await page.click('button:has-text("Save settings")'); await page.waitForSelector('.toast.success');
    check((await (await page.request.get(s.base + '/api/public/config')).json()).siteName === 'Tashkent English', 'site name saved');
    const pub = await openPage(browser, viewport); await pub.goto(s.base + '/'); await pub.waitForSelector('.landing');
    check((await pub.locator('.brand').innerText()).includes('Tashkent English'), 'the learner site shows the new name');

    /* ---------- audit log ---------- */
    await page.click('.adm-side a:has-text("Audit log")'); await page.waitForSelector('.tbl');
    const log = await page.locator('.tbl tbody').innerText();
    check(['course.create', 'lesson.publish', 'exercise.create', 'vocabulary.import', 'user.suspend', 'user.role', 'user.reset_progress', 'settings.update'].every((a) => log.includes(a) || s.db.get('SELECT COUNT(*) n FROM audit_log WHERE action = ?', a).n > 0), 'important actions appear in the audit log');
    await page.fill('input[type=search]', 'user.'); await page.waitForFunction(() => [...document.querySelectorAll('.tbl tbody tr')].every((r) => r.innerText.includes('user.')));
    check(true, 'the audit log can be filtered');
    check(page.problems.length === 0, 'no console errors or failed requests (' + page.problems.slice(0, 3).join(' | ') + ')');
  });
  await s.stop();
  summary('admin UI');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
