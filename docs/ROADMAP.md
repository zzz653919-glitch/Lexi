# LEXIO roadmap: A1 → IELTS Band 6.5–7.0

The course `lexio-roadmap` is the default course for new learners. It has **six levels, 60 topics and 240 lessons**, plus a topic test for every topic of A1–C1 and a final examination for every level.

| Level | Name | Topics | Lessons | Topic tests | Final exam |
|---|---|---|---|---|---|
| A1 | Beginner | 10 | 40 | 10 | yes |
| A2 | Elementary | 10 | 40 | 10 | yes |
| B1 | Intermediate | 10 | 40 | 10 | yes |
| B2 | Upper-Intermediate | 10 | 40 | 10 | yes |
| C1 | Advanced | 10 | 40 | 10 | yes |
| IELTS | Preparation, Band 6.5–7.0 | 10 | 40 (incl. practice tests and four mock examinations) | – | yes |

The order and titles of all 240 lessons are in `server/seed/roadmap/curriculum.js`.

## What every A1–C1 lesson contains
Objective, an Uzbek explanation (new alphabet), English examples with Uzbek translations, six vocabulary items with IPA, a grammar point, and 14–17 exercises: translation, matching, spelling, listening (with generated audio), fill-in-the-blank, MCQ, reading (including True / False / Not Given), sentence building, **writing** and **speaking** tasks with model answers. Each topic ends with a topic test; each level ends with an examination covering grammar, vocabulary, listening, reading and writing.

## IELTS course
Original materials only (no official papers). Format and scoring, what Band 6.5 and 7.0 mean, registration and test day, study plan; Listening (forms, multiple choice, maps, lectures, four practice tests); Reading (skimming and scanning, TFNG, headings, summary completion, practice tests, timing); Writing Task 1 (data, tables and pie charts, maps and processes, Band 6.5 / 7.0 samples) and Task 2 (opinion, discussion, problem–solution, samples); Speaking Parts 1–3, pronunciation, difficult questions; strategy, common mistakes; four mock examinations. Practice tests report an *estimated* band (`server/lib/ielts.js`); no score is guaranteed. Writing and speaking answers are checked for length and key structure only: an examiner is needed for a real assessment.

## Strict unlocking (server side)
* Every learner starts at A1; the other levels are locked. Choosing a level by hand never unlocks anything.
* Inside a level, lessons are sequential. The level examination opens only when **all** lessons and topic tests of the level are completed.
* A level opens only when the previous level's examination was passed (default **80%**, `levels.exam_pass_pct`, editable per level). A failed examination is saved, completes nothing, and can be retaken.
* A placement test may open levels up to its (capped) result: at most B2. `buildPath` computes every lesson's state on the server and `lessonAccess` refuses to start a locked lesson.
* Examinations and topic tests are scored on the server from the stored answers (`exam_results`): one try per question, no hearts, no answers shown until the end, then the mistakes with the right answers.

## Lesson types
`lesson` (study page + exercises), `topic_test`, `exam`, `practice_test` (IELTS; reports an estimated band).

## Vocabulary database (5,000+ words)
`server/seed/vocab/*.js` (one text per file, one line per entry): English, Uzbek, IPA, part of speech, example, synonyms, difficulty, topic and kind (word, collocation, phrasal verb, idiom, academic) for A1–C1 and IELTS, on top of the words inside the lessons. The loader (`server/seed/vocab/index.js`) skips words that already exist and writes in batches; `parse()` reports incomplete lines and duplicates, which the tests require to be empty. The learner's vocabulary page shows IPA, synonyms and kind; the admin editor and the CSV / JSON import support all fields.

## Dashboard
Level strip (completed / current / locked / being prepared), progress of the current level, examination status, four skill indicators (first-try accuracy per skill), the last ten test results with dates, weak areas, **vocabulary progress by level** (words practised and mastered), remaining lessons, the daily goal, the next lesson and the IELTS link.

## Admin
* Courses → levels (strict flag, exam pass mark), topics, lessons (type, skill, study content in en/uz/ru, publish / unpublish), exercises (all types, audio upload, minimum words), student exam results.
* **Curriculum status** (`/admin/curriculum`, `GET /api/admin/curriculum`): per level the written / published / draft lessons, topic tests, examination, exercises, words, learners and passes, published lessons by skill, and the vocabulary database by kind.

## Seeding
`server/seed/roadmap/` creates the course, levels and topics, then each topic's lessons in its own atomic batch (resumable, never duplicates; `db.batch`). It runs at start-up on a local database and in `scripts/vercel-build.js` / `npm run seed` on a hosted one. The vocabulary files are loaded after it with their own version flag. Typed exercises (spelling, listening dictation, translation) never repeat a word that already has the same exercise in an earlier level.

## Tests
`tests/api/roadmap.test.js` (content integrity, 240 lessons, strict unlocking, exams, IELTS, admin, vocabulary database, dashboard, curriculum status) and `tests/ui/roadmap.ui.js`.
