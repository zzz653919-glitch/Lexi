# Lexi Learn

An English-learning platform with a game-like learning path, interactive exercises, XP / streaks / hearts, a vocabulary trainer with spaced repetition,
and a separate administrator panel for managing courses, exercises, vocabulary and users.

* **Server:** Node.js (≥ 22.5) + Express, SQLite through the built-in `node:sqlite` module for a local file, or a hosted Turso/libSQL database (HTTP client `@libsql/client`, no native add-ons) on serverless hosts. All database access is asynchronous. Runtime dependencies: `express`, `@libsql/client`.
* **Front-end:** plain ES modules, no build step. Learner app at `/`, admin panel at `/admin`.
* **Brand:** original name, mascot ("Sprig" the sprout) and artwork. It is *inspired by* the learning flow of apps like Duolingo but copies none of their code, logos, characters or lessons.

> The previous project (Lexi v1, a local-first vocabulary trainer) is preserved untouched in [`legacy/lexi-v1/`](legacy/lexi-v1) and in the git tag `lexi-v1-backup`.
> It is no longer served or linked. See [docs/AUDIT-AND-MIGRATION.md](docs/AUDIT-AND-MIGRATION.md).

## Quick start

```bash
npm install
npm run create-admin        # asks for an e-mail and a password (typed hidden); creates the first administrator
npm start                   # http://127.0.0.1:3000   (sample course is created on first start)
```

Open `http://127.0.0.1:3000` for the learner site and `http://127.0.0.1:3000/admin` for the admin panel.

### Creating the first administrator securely

Nobody can become an administrator through the website: registration always creates plain learners, and only an administrator can change roles.
The first administrator is created on the server's command line:

```bash
npm run create-admin
```

The password is read from a hidden prompt (or from the `ADMIN_PASSWORD` environment variable for scripted setups) and is stored only as a salted scrypt hash.
It is never printed or written to a file. Running the command for an existing e-mail promotes that account and replaces its password.

### Using the admin panel (`/admin`)

Sign in at `/admin/login`. Roles: **admin** (everything) and **editor** (courses, lessons, exercises, vocabulary – no users, settings or audit log).
The panel's HTML and JavaScript are only served to signed-in staff; every API call is checked on the server as well.

| Section | What you can do |
|---|---|
| Dashboard | Users, active users (1 / 7 / 30 days), courses, lessons, completed lessons, exercise attempts, answer accuracy, charts of sign-ups / activity / completions / attempts, per-course completion table, recent administrative activity. |
| Courses | Create, edit, publish, unpublish, archive, export (JSON) and delete (typed confirmation) courses. Add / edit / reorder / delete **levels** (A1–C1 and an IELTS practice track), **units** and **lessons**; duplicate lessons; set **unlock rules** (sequential / open / prerequisite lesson, level threshold %). |
| Lesson editor | Add, edit, preview (exactly as a learner sees it), duplicate, reorder and delete exercises of all 11 types; validation before publishing; **import / export** JSON or CSV; publish the lesson. |
| Vocabulary | Add / edit / archive words (English, Uzbek, other-language translations, part of speech, level, example + translation, uploaded pronunciation audio), assign to a course, search, filter, paginate, bulk status change, **CSV / JSON bulk import** and export. |
| Users | Search and filter, view progress (XP, streak, accuracy, activity), suspend / reactivate, change roles (rules below), reset progress (typed confirmation). |
| Settings | Site name, tagline, brand colour, default translation language, supported languages, available levels, default daily goal, all XP values, hearts on/off + count + regeneration time, leaderboard on/off, registration open/closed, **maintenance mode**. |
| Audit log | Every administrative change (who, what, when, details), filterable and paginated. |

Role rules enforced by the server: only administrators change roles; nobody changes or suspends their own account; the last active administrator can never be demoted or suspended.

## What learners get

* Registration, login, logout, password change and password recovery; avatar, display name, time zone, daily goal, starting level, course choice.
* **Learning path:** Course → CEFR-style level (A1–C1, optional IELTS practice track) → Unit → Lesson → Exercise, drawn as a path with *completed*, *available*, *in progress* and *locked* lessons and the reason a lesson is locked.
* **11 exercise types:** multiple choice · select the translation · type the missing word · translate (typed) · arrange scrambled letters · arrange words into a sentence · match pairs · listen and choose · listen and type · read a passage and answer · correct a spelling mistake – plus the **mistakes review** mode (twelfth requested type), which replays exercises answered wrongly.
* Lesson flow: one question at a time, progress bar, Check, instant feedback with the correct answer and explanation, Continue, completion screen (right / wrong, accuracy, XP, words to review, mistakes). Touch, mouse and keyboard (number keys choose options, Enter checks / continues, Backspace removes tiles, letter keys place letters). Progress is saved on the server after every answer, so a reload resumes the lesson.
* **Vocabulary:** searchable list, flashcards, multiple choice, typed answers, spelling (listen & type), spaced repetition (Leitner boxes 1 / 2 / 4 / 8 / 16 / 32 days), a difficult-words list (automatic after repeated misses or manual), words that are missed more often are asked first.
* **Gamification:** XP, daily goal ring, streak, hearts, 14 achievements, weekly leaderboard (opt-in, display name + avatar only).
* **Dashboard** with continue-learning, current unit, level and course progress, today's XP and goal, streak, hearts, recent achievements, words due for review and the recommended next lesson – all computed from stored data.

## Languages
The interface is available in Uzbek (default), Russian and English, switchable from the header or Profile; translations are editable by administrators. See [docs/I18N.md](docs/I18N.md).

## Animations
A start-up screen, loading animations, page transitions and answer / lesson-completion effects (all tied to real loading and real results; can be reduced or turned off in Profile). See [docs/ANIMATIONS.md](docs/ANIMATIONS.md).

## Rules (all calculated on the server)

* **XP:** 10 per exercise answered correctly on the first try, 5 for a correct retry (a wrong exercise comes back once at the end of the lesson), the lesson's completion XP (default 20) and a perfect-lesson bonus (10). Vocabulary review pays 2 XP per correct typed / multiple-choice / spelling answer (capped per day, each word at most once a day and only when it was due); flashcards are self-graded and never pay XP. All values are editable in Settings.
* **Double submissions:** each answer is stored once per question slot (`UNIQUE (attempt_id, slot)`), XP rows are unique per activity (`UNIQUE (user_id, reason, ref_type, ref_id)`) and writes run in `BEGIN IMMEDIATE` transactions, so repeated or parallel submissions return the stored result and never pay twice. The browser never receives correct answers, only the exercise content.
* **Streak:** a day counts when the learner *completes* an activity that day – a lesson, a mistakes review, or 5 correct vocabulary-review answers. Days are calendar days in the learner's own time zone (profile setting). Consecutive days extend the streak, a missed day resets it (a broken streak shows as 0 immediately). Answering questions without finishing earns per-answer XP but no streak day or completion bonus.
* **Hearts:** a wrong answer in a lesson costs a heart (switchable). At 0 hearts the lesson stops (nothing is marked complete). Hearts regenerate (default 1 per 30 minutes) and every 10 correct review answers earn one.
* **Unlocking:** a level opens when the previous level has the configured percentage of lessons finished (default 60 %), or its rule is "open", or it is at/below the learner's chosen starting level. Inside a level a lesson is *sequential* (previous lesson done), *open*, or *prerequisite* (a chosen lesson done; loops are refused).
* **Leaderboard:** weekly XP, week starts Monday 00:00 UTC for everyone.
* Levels are *indicative CEFR-style labels*. Nothing in this project is an official CEFR placement, certificate or IELTS assessment or score prediction; the IELTS track is clearly labelled practice material.

## Security model

* Passwords: scrypt with a random salt, timing-safe comparison, minimum 8 characters with letters and a digit; unknown e-mails cost the same time as wrong passwords; login (8 failures / 10 min per address + e-mail) and registration / reset requests are rate limited.
* Sessions: random 256-bit token in an `HttpOnly; SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=1`); only the token's SHA-256 is stored; 30-day expiry; suspension, password reset and role changes take effect immediately.
* CSRF: every state-changing request needs the per-session `X-CSRF-Token` and a same-origin `Origin`; cross-site logins are refused.
* SQL injection: every query is a prepared statement with bound parameters; `LIKE` wildcards in searches are escaped.
* XSS: the front-end builds the DOM with `textContent` (no `innerHTML` with data); a strict Content-Security-Policy (`script-src 'self'`, no inline scripts, `frame-ancestors 'none'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
* Authorisation: role checks run on the server for every admin route (`requireRole`), the admin app and its assets are only served to staff, learners can only touch their own attempts.
* Input: every field is validated on the server (the browser's checks are only a convenience). Uploads: audio only (`.mp3 .ogg .wav`), ≤ 2 MB, file signature must match the extension, stored under random names and served with a fixed content type. Imports are validated row by row and are all-or-nothing; CSV cells starting with `= + - @` are neutralised on export.
* Errors: internals are never sent to the browser; unexpected failures return a reference id that is also written to the server log.

## Configuration

Environment variables (all optional): `PORT` (3000), `HOST` (127.0.0.1 locally, 0.0.0.0 when `NODE_ENV=production` or `PORT` is set), `COOKIE_SECURE=1` (set behind HTTPS), `TRUST_PROXY=1` (behind a reverse proxy), `PUBLIC_URL` (used in password-reset links), `LEXI_NO_SEED=1` (do not create the sample course), and for the CLI `LEXI_DB` (database file) / `LEXI_DATA_DIR` (database directory, default `data/`), `DATABASE_URL` + `DATABASE_AUTH_TOKEN` (a hosted Turso/libSQL database instead of the local file – needed on Vercel). To publish the site see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
Site behaviour (names, XP, hearts, registration, maintenance mode …) is configured in the admin panel, not in files.

Commands: `npm run migrate` · `npm run seed` · `npm run create-admin` · `npm run backup` (consistent copy into `backups/`) · `npm run import-legacy-vocab` (imports the ~4,200 old Lexi v1 words as **draft** entries for review).

## Project layout

```
server/            Express app, routes, database logic (lib/), SQL migrations (migrations/), sample content (seed/), CLI
public/            learner app (index.html, js/, css/, img/) and admin panel (admin/)
tests/api/         server tests (node:test): auth, lessons, gamification, exercises, admin, security
tests/ui/          browser tests (Playwright): learner journey, admin panel, responsive layout + accessibility
legacy/lexi-v1/    the previous app, kept for reference (not served)
docs/              audit and migration notes
```

## Tests

```bash
npm test             # server tests (real HTTP server + temporary SQLite database per test)
npm run test:ui      # 3 browser test files; needs Playwright with Chromium installed
npm run test:legacy  # the preserved v1 app's data / answer-checking tests
```

The browser tests drive the real UI at 320, 360, 390, 430, 768, 1024 and 1440 px: no horizontal overflow, clipped text or overlapping controls on learner and admin pages, 44 px lesson controls, labels / names / landmarks, WCAG AA text contrast in light and dark mode, visible focus rings, reduced-motion support.

## Known limitations

* **No e-mail delivery is configured.** Password-reset links are written to `data/outbox/password-resets.log` and the server log; connect a mailer by passing `mailer` to `createApp` (see `server/routes/auth.js`).
* **Audio** uses the browser's speech synthesis unless a recording is uploaded. For listening exercises that use text-to-speech the text to be spoken is part of the exercise data, so a determined learner could read the answer from the network response; use uploaded recordings where that matters.
* The sample curriculum is small (2 courses, 12 lessons, 144 exercises, 72 words, written for this project). Uzbek translations were not reviewed by a professional translator; the same is true of the optional legacy word import.
* `node:sqlite` is marked experimental in Node 22 (the warning is silenced by the npm scripts). A single SQLite file in one process suits small and medium deployments (use Turso for serverless hosting); there are no "down" migrations, so use `npm run backup` before upgrading.
* The interface is in English; the translation language of vocabulary is Uzbek (Russian is stored optionally). Progress from the old browser-only app is not migrated automatically.
* Whole-course *import* is not implemented (courses can be exported; lessons and vocabulary can be imported).
* HTTPS must be provided by a reverse proxy / hosting platform.
