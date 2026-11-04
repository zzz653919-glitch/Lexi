# LEXIO roadmap: A1 → IELTS Band 6.5–7.0

## Levels
`A1 — Beginner · A2 — Elementary · B1 — Pre-Intermediate · B1+ — Intermediate · B2 — Upper-Intermediate · B2+ — IELTS Foundation · C1 — Advanced · IELTS — Band 6.5–7.0 preparation`
Each level has 10–12 topics (units). A topic holds lessons, a topic test, and the last topic of a level holds the **final level examination**.

### Content status (honest)
| Level | Topics in the structure | Published content |
|---|---|---|
| A1 | 10 | **Complete**: 20 lessons (each with objective, simple Uzbek explanation, examples with translations, new words, 14–17 exercises incl. listening, reading, writing, speaking), 10 topic tests, final exam (41 questions) |
| A2 … C1, IELTS (roadmap level) | 11–12 each | Structure only. These levels show as "being prepared" and stay locked; nothing empty can be completed |
| IELTS Preparation Center (`/ielts`) | 6 sections | 14 lessons (format, time management, band descriptors; Listening, Reading, Writing Task 1 & 2 and Speaking Parts 1–3 strategies with Band 6.5 and 7.0 example answers; a Writing self-assessment checklist) + 2 practice tests (Listening 12 questions, Reading 13) with estimated bands. Writing and Speaking tasks use model answers |

Authoring more levels is done in the admin panel (Courses → LEXIO English Roadmap) or by adding specs next to `server/seed/roadmap/a1-*.js` (the same builder validates every exercise with the editor's rules).

## Strict unlocking (server side)
* Every learner starts at A1; all other levels are locked. Choosing a level by hand never unlocks anything.
* Inside a level, lessons are sequential. The level examination opens only when **all** lessons and topic tests of the level are completed.
* A level opens only when the previous level's examination was passed (default **80%**, `levels.exam_pass_pct`, editable per level). A failed examination is saved, completes nothing, and can be retaken as often as wanted.
* A placement test may open levels up to its (capped) result: at most B2, never B2+/C1/IELTS. `buildPath` computes every lesson's state on the server and `lessonAccess` refuses to start a locked lesson (HTTP 403).
* Examinations and topic tests are scored on the server from the stored answers (`exam_results`): one try per question, no hearts, **no answers shown until the end**, then the mistakes with the right answers and a per-skill breakdown. Topic tests pass at 70% (`topic_test_pass_pct`).

## Lesson types
`lesson` (study page + exercises), `topic_test`, `exam`, `practice_test` (IELTS; always completes and reports an *estimated band*). Exercise types: the existing ones plus **writing** (server checks length and key words/phrases; shows a model answer) and **speaking** (read/listen, say it aloud, confirm; nothing is recorded or machine-scored). True/False/Not Given = `reading` with three options; matching headings = `match_pairs`; note completion = `fill_blank` with audio.

## IELTS estimate
Practice tests are original and shorter than the real ones. The share of correct answers is scaled to 40 questions and converted with the usual Academic Listening/Reading ranges (`server/lib/ielts.js`). It is an estimate of readiness only, not an official score or a guarantee. Writing and Speaking use model answers and self-assessment checklists.

## Dashboard
Level strip (completed / current / locked / being prepared), progress of the current level, examination status, four skill indicators (first-try accuracy per skill), recent test results, weak areas (skills under 70% after 5+ answers), completed / remaining lessons, daily goal, streak, achievements, next recommended lesson.

## Admin
Courses → levels (code incl. B1+/B2+, strict flag, exam pass mark), units, lessons (type, skill, study content in en/uz/ru, publish / unpublish), exercises (all types, audio upload, minimum words, skill), exam publishing rules (10+ questions, one examination per level), student results on the user page.

## Seeding
`server/seed/roadmap/` creates the course, levels and topics, then each topic's lessons in its own atomic batch (resumable, never duplicates). It runs at start-up on a local database and in `scripts/vercel-build.js` / `npm run seed` for a hosted one. New learners are placed on the roadmap (`default_course_slug`); existing learners keep their current course.

## Tests
`tests/api/roadmap.test.js` (content integrity, strict unlocking, exams, IELTS, admin, seeding) and `tests/ui/roadmap.ui.js`.
