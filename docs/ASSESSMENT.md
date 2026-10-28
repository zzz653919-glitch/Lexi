# Placement test, personalised learning and level adjustment

## What learners see
1. **Welcome** (right after sign-up): *take the placement test* (recommended) or *choose my level* (Pre-A1 … C2).
2. **Placement test**: 20–35 adaptive questions on vocabulary, grammar, reading, word usage and (optionally) listening.
   No right/wrong feedback during the test; progress is saved, so it can be left and resumed on any device.
3. **Result**: estimated level, score, confidence, skill breakdown, strengths / areas to improve, an explanation of the level and a
   personalised plan. It is always labelled as an *estimate*, not a certificate.
4. **Dashboard**: the *daily lesson* card, the level badge and, when appropriate, a *retake the test* suggestion or a *level up* message.
5. **Profile**: the level, where it came from, the last test result, retake, manual level change, level history, daily lesson length.

Existing accounts are migrated automatically (`004_assessment.sql`): they are marked as onboarded and keep the level they chose.

## Levels
`A0` is shown as **Pre-A1**, then `A1 A2 B1 B2 C1 C2`. A learner's level is stored in `users.cefr_level` (and the source in `level_source`:
`placement`, `reassessment`, `manual`, `auto`, `legacy`). The sample course has levels A1–C1, so Pre-A1 learners start on A1 and C2 learners on C1
(`users.start_level` holds that clamped value); their daily lessons use the real level.

## How the level is calculated (`server/lib/irt.js`, `server/lib/assessment.js`)
* Every question has a difficulty `b = level index − 0.5` (Pre-A1 = 0 … C2 = 6). A learner has an ability θ on the same 0–6 scale.
* P(correct) = g + (1 − g)·sigmoid(1.6·(θ − b)), with g the guessing chance (1 / number of options, 2 % for typed answers, 0 for "I don't know").
* After each answer the probability of every θ on a 0–7 grid is updated with Bayes' rule (prior mean A1, wide). The estimate is the posterior
  mean; its uncertainty is the posterior standard deviation. **One answer can therefore never decide the level.**
* Level = number of cut-offs (default 0.5, 1.5, 2.5, 3.5, 4.5, 5.5) that θ reaches (setting `placement_cutoffs`).
* **Question choice**: the least-asked skill first (so every skill is sampled), a question of the level nearest the current estimate
  (moving at most one level per step), never the same question twice, deterministic for the same answers. The first question is at
  `placement_start_level`.
* **Stopping**: never before `placement_min_questions`; always at `placement_max_questions` (or when the bank is exhausted); in between
  only when vocabulary, grammar and reading each have `placement_min_per_skill` answers, the uncertainty is below `placement_precision`/100 and
  the level was the same for the last three estimates.
* The rules in force when a test starts are stored with it, so editing the settings never changes a running test.
* **Skill report**: answers are grouped (vocabulary; grammar + completion; reading; word usage + expressions; listening). A group with ≥ 3 answers
  gets its own ability estimate (prior = the overall estimate); a skill ≥ 0.35 levels above/below the overall estimate is a strength/weakness.
* `node scripts/simulate-placement.js [n]` simulates learners of known ability: with 40 per level the level was within one step 100 %
  of the time and exactly right ~70 % of the time (borderline learners are unavoidable), using 20–35 questions (avg ≈ 23).

## Personalised daily lesson (`server/lib/daily.js`)
Built when started and stored with the attempt (reload shows the same lesson; answers are graded on the server):
review of due words → new words (card, then a question) → one grammar point (card + 2 practice questions) → sentence building →
reading → final quiz (weighted to the weakest skill, one listening question). Length: 12 / 18 / 26 questions (profile setting).
* **Spaced repetition**: words that are taught or answered join the Leitner schedule; wrong answers reset the box; due words return first.
* **No re-teaching**: new words are only words that are not yet in the learner's schedule; grammar points rotate by "seen" count; quiz
  questions seen in the last 14 days are avoided while unseen ones exist.
* XP per correct answer, a daily bonus once per local day, streak, achievements – like ordinary lessons.

## Continuous adjustment (`server/lib/learning.js`)
Every graded answer (lessons, daily lessons, vocabulary review) is stored as evidence for a skill and moves that skill's score (Elo-style).
A learner is **raised one level automatically** when, since reaching the level: ≥ `adapt_min_answers` recent answers with accuracy ≥
`adapt_up_accuracy` %, ≥ `adapt_min_lessons` completed lessons and ≥ `adapt_min_days` days (and `adapt_enabled`). Levels are never lowered
automatically. A **retest is recommended** when recent accuracy is below `adapt_low_accuracy` %, when the last test is older than
`placement_valid_days`, or when no test was taken. A manual level change keeps all test results and is added to the level history.

## Database (migration `004_assessment.sql`)
`users` (+ `cefr_level`, `level_source`, `level_changed_at`, `onboarded`, `lesson_length`), `exercises.skill`, `lesson_attempts.variant`,
new tables `assessment_questions`, `assessment_options`, `assessments`, `assessment_responses`, `user_skills`, `skill_evidence`,
`user_level_history`, `learning_plans`, `grammar_points`, `user_grammar`, `item_responses`. Built-in content (147 questions, 21 grammar
lessons, extra vocabulary) is added once by `server/seed/assessment-content.js` and never overwrites administrators' edits.

## Admin panel → "Placement & grammar"
Questions (CRUD, level + skill, draft/published, validation before publishing), coverage check, grammar lessons (with Uzbek/Russian text),
rules and thresholds (administrators), anonymised statistics (no names or e-mails) including questions that look too easy/hard.
Lessons per level are managed in *Courses* (level codes A0 … C2 are allowed).

## Tests
`node --test "tests/api/*.test.js"` (adds `assessment.test.js`, `learning.test.js`) and `node tests/ui/assessment.ui.js` (part of `npm run test:ui`).
