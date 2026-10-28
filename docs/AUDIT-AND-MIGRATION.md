# Project audit, backup and migration notes

## Audit of the project before the rebuild (git tag `lexi-v1-backup`)

* **Stack:** a static front-end (vanilla JS in `js/`, CSS in `css/`, `index.html`) with an optional Electron wrapper (`electron/main.js`) and Windows `.bat` launchers. Data lived only in each browser (IndexedDB with a localStorage fallback).
* **No server, no database, no accounts, no routes beyond the single page, no deployment configuration, no environment files, no CI.** The only "infrastructure" was `package.json` (Electron build settings) and the Git repository.
* **User-generated content:** none on a server. Learners' words and progress existed only in their own browsers. The old app has a *Backup* function; that file format is **not** imported by the new platform.

## Classification

| Old files | Decision |
|---|---|
| `index.html`, `css/`, `js/`, `img/`, `sample/`, `tests/`, `README.md` | The old user-facing site. Moved with `git mv` to `legacy/lexi-v1/` (history preserved). Not served, not linked. |
| `electron/`, `*.bat`, old `package.json` | Desktop wrapper of the old site. Moved to `legacy/lexi-v1/` (a copy of the old `package.json` is there too). |
| `.git`, `.gitignore` | Kept; `.gitignore` extended (`data/`, `.env`, backups). |
| `js/data/words-*.js` (≈ 4,900 vocabulary entries) | Reusable content. Available through `npm run import-legacy-vocab` (draft status, needs review). |

## Backup

* Git tag **`lexi-v1-backup`** points at the last commit of the old site; `git checkout lexi-v1-backup` restores it exactly.
* The full old implementation also lives in `legacy/lexi-v1/` (runs by opening its `index.html`; its tests: `npm run test:legacy`).
* Nothing was deleted from the repository and no production data existed to migrate.

## Verification that no obsolete pages remain

`tests/api/security.test.js` ("the legacy v1 app is not reachable") requests the old entry points and internal files and checks that only the new app shell or a 404 is returned; `tests/ui/learner.ui.js` opens the old routes (`/lessons`, `/sessions`, `/topics`, `/path`, …) and checks for the 404 page and the absence of old-site text. The navigation of the new app contains only the new sections.

## Database migrations

`server/migrations/001_init.sql` creates the schema in one transaction and is recorded in `schema_migrations`; `npm run migrate` (also run automatically at start-up) applies pending files in order and never re-applies one.

Tables: `users`, `sessions`, `password_resets`, `courses`, `levels`, `units`, `lessons`, `exercises`, `exercise_options`, `vocabulary`, `lesson_attempts`, `exercise_responses`, `user_progress`, `xp_transactions`, `user_streaks`, `user_days`, `user_achievements`, `review_items`, `audit_log`, `settings`, `uploads`.
Foreign keys are enforced (`PRAGMA foreign_keys = ON`), values are constrained with `CHECK`s, and double payouts / double answers are prevented by `UNIQUE` constraints (see the README).

To change the schema later add `002_something.sql`; take `npm run backup` first.
