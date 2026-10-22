# Lexi — Vocabulary Trainer

A fast, private English ↔ Uzbek vocabulary trainer. Add your own words, organise them into collections, and learn them by **typing** answers in randomised quizzes. Runs in any modern browser and as a Windows desktop app. No account, no server, no paid API — everything is stored on your device.

Built with plain HTML, CSS and vanilla JavaScript (no build step, no runtime dependencies).

## Features

### Word Lessons (new): Duolingo-style exercises
A separate **Word Lessons** section (original design, inspired only by the learning method) with 7 exercise types plus a mixed lesson:

| Exercise | What you do |
|---|---|
| Choose the translation | See an English word, pick the right one of 4 Uzbek translations (keys 1–4) |
| Type the answer | An English word *or* an Uzbek translation appears; type the other one |
| Translate the word | `Apple` → type `Olma` |
| Fill in the letters | `B _ _ k` with the meaning as a hint; type the whole word |
| Match the pairs | Pair up to 5 English words with their Uzbek translations |
| Reverse | An Uzbek translation appears; type the English word |
| Review | Only words that are due for review or that you keep missing |

How a lesson works: one question at a time, a progress bar on top, a green/red feedback panel that explains the right answer (plus your example sentence), a *Continue* button (or **Enter**), and a **pause** button. Paused lessons are saved (even across a page reload) and shown as a **Resume** card. A word you miss comes back later in the same lesson. Brand-new words are introduced with a “meet the word” card first. Results page: accuracy, XP, time, new words, best combo, streak, daily goal, level-ups, new achievements and the words to review.

**Motivation system (all computed from real, stored activity):**
- **XP** per correct answer (choose 8, fill 10, typing 12, match pair 4; half XP for a retry), **combo bonus** +5 XP for every 5 correct answers in a row, +10 XP for finishing a lesson.
- **Daily goal** (20–200 XP, default 50), **streak** (consecutive days with practice), **level** (`level = ⌊√(XP/40)⌋ + 1`), **words learned**, accuracy, a 14-day history chart and 15 **achievements** with progress bars.

**Spaced repetition (Leitner boxes):** every word has a box 0–5 with review intervals 10 min / 1 / 3 / 7 / 14 / 30 days. A correct first answer moves a word up one box (a never-seen word goes to box 1); a wrong first answer moves it down two boxes, so it returns sooner. Each lesson uses due words first, then at most 5 new words, then (if needed) the words due soonest. *Word knowledge* shows every word's strength (5-step meter), next review date and accuracy, with filters (due, difficult, new, learning, reviewing, well known). Words you miss also appear on the existing *Difficult Words* page. A word counts as **learned** when it reaches the 7-day interval (box 3).

**Vocabulary management inside the section:** add words with an optional **example/note**, create/rename/delete collections, edit/delete words, and **tick which collections to practise** (nothing ticked = all).

**Ready-made decks:** 4 levels (A1 Beginner, A2 Elementary, B1 Intermediate, B2 Upper-Intermediate) × 9 topics (Daily life, Family, Food and drink, Home and objects, School and education, Work and jobs, Travel, Verbs, Adjectives) × 8 words = **288 English–Uzbek entries**. Add a topic or a whole level to your own collections with one click (existing words are never duplicated).
> **Honest note about the ready-made words:** they were written for this project from common everyday vocabulary and checked automatically (no empty or duplicated entries, consistent format) — but **not reviewed by a professional translator or taken from an official CEFR list**. Levels are approximate. Please let a teacher or native speaker check them before you rely on them for teaching.

**Pronunciation:** a speaker button next to English words uses the browser's built-in Text-to-Speech (it prefers natural-sounding US/UK English voices). If the browser has no speech support the buttons are simply hidden and everything else keeps working. Optional setting: read English words aloud automatically.

### Earlier features

- **My Vocabulary** – add, edit, delete and search words; custom collections (A1, A2, B1, IELTS, Personal…); duplicate and empty-input protection.
- **Practice** – random, non-repeating quiz; type the answer and press **Enter**; instant correct/incorrect feedback with the right answer shown; English → Uzbek, Uzbek → English or mixed; choose collection, length, or *difficult words only*; restart & shuffle; end-of-session summary.
- **Smart checking** – ignores capitalisation and extra spaces; treats `o'`, `oʻ`, `o‘` alike; accepts any of several translations (`salom; assalomu alaykum`), `to go` ≈ `go`, and text in `(parentheses)` is optional.
- **Difficult Words** – every word you miss lands here until you answer it correctly 3 times in a row; practise just those, or mark one as learned.
- **Progress** – accuracy, correct/incorrect totals, 7-day activity, accuracy of recent sessions, per-collection learning progress, session history.
- **Import / export** – CSV or TXT import, CSV export, full JSON backup & restore.
- **Three interface languages** – English, O'zbekcha and Русский. Pick one with the selector in the sidebar (top-right on phones) or in Settings; it is remembered, and the first start follows your browser language.
- **Light / dark theme**, responsive layout (desktop, tablet, phone), keyboard accessible with visible focus states.
- **Persistent storage** – IndexedDB (automatic localStorage fallback). Words, collections, lesson progress, XP, streaks and paused lessons survive reloads and restarts.

## Project structure

```
index.html                 App shell + icon sprite
css/
  base.css                 Design tokens (light/dark), layout, responsive shell
  components.css           Buttons, forms, tables, modals, toasts…
  views.css                Page-specific styles
js/
  utils.js                 Helpers (escape, shuffle, dates…)
  locales.js               All UI text in English / Uzbek / Russian (one row per string)
  i18n.js                  Language switching, placeholders and plural rules
  db.js                    IndexedDB wrapper (+ localStorage fallback)
  store.js                 App state, validation, all data operations
  quiz-engine.js           Answer normalisation/checking, queue building (pure logic)
  csv.js                   CSV/TXT parsing and CSV export
  import-export.js         Import dialog, export, backup/restore, sample loader
  sample-data.js           Built-in sample vocabulary (A1, A2, B1, IELTS)
  ui.js                    Toasts, modals, icons
  app.js                   Router, theme, boot
  decks.js                 288 ready-made words (4 levels x 9 topics)
  learn-engine.js          Spaced repetition, lesson building, exercises, XP, streak, level, achievements (pure logic)
  speech.js                Text-to-Speech pronunciation
  word-dialogs.js          Shared add/edit/delete dialogs for words and collections
  locales-learn.js         Translations for Word Lessons
  views/                   dashboard, vocabulary, learn, practice, difficult, progress, settings
tests/                     Automated browser tests (Playwright)
sample/
  sample-vocabulary.csv    60 words with collections (CSV)
  sample-vocabulary.txt    Simple "english — uzbek" example (TXT)
electron/main.js           Windows desktop wrapper
package.json               Electron scripts
Start-Lexi.bat             Windows: open in browser
Start-Lexi-Desktop.bat     Windows: run as desktop app
```

## Running on Windows

### Option A — in the browser (no install)
Double-click **`Start-Lexi.bat`** (or just open `index.html`). Works in Chrome, Edge and Firefox.
> Your words are saved per browser. Always open Lexi in the same browser to see the same data. Use *Settings → Backup everything* to move data between browsers.

### Option B — desktop app (Electron)
1. Install [Node.js](https://nodejs.org) (LTS).
2. Double-click **`Start-Lexi-Desktop.bat`** (first run installs Electron).
   Or from a terminal in this folder: `npm install` then `npm start`.
3. To build a single portable `.exe`: `npm run dist` (output in `dist/`).

Desktop data is stored in `%APPDATA%\Lexi`.

### Option C — host it
It is a static site: upload the folder to any static host (GitHub Pages, Netlify…), or serve locally with `npx serve .`.

## Importing vocabulary

Use **My Vocabulary → Import** or **Settings → Import…**. Pick a `.csv`/`.txt` file or paste lines, choose a target collection, review the preview (new / duplicate / invalid lines), then confirm.

Accepted line formats (one word per line):

```
apple — olma
apple - olma
apple = olma
apple | olma
apple<TAB>olma
apple,olma
apple;olma
"to run, to jog","yugurmoq",IELTS      <- quoted CSV, optional 3rd column = collection
```

- A first line `english,uzbek` (header) is skipped automatically. Blank lines and lines starting with `#` are ignored.
- Tick **“Use the 3rd column as collection name”** to create/fill collections from the file (this is what the CSV export produces, so exports can be re-imported).
- Several translations in one entry: separate with `;` (e.g. `salom; assalomu alaykum`).
- Optional 4th column = example sentence (CSV exports from this app contain it: `english,uzbek,collection,example`; such files are recognised automatically on import).
- Duplicates (same English word in the same collection) are skipped; invalid lines are listed and ignored.
- Save files as **UTF-8** (Notepad: *Save as → Encoding: UTF-8*). Excel “CSV UTF-8” works.
- Try it with `sample/sample-vocabulary.csv` or `sample/sample-vocabulary.txt`, or use **Load sample vocabulary** on the Dashboard.

## Using the app

1. **Add words** in *My Vocabulary* (Enter in the translation field submits).
2. Open **Practice**, choose a set, direction and length, press **Start quiz**.
3. Type your answer → **Enter** to check → **Enter** again (or *Next word*) to continue. *I don’t know* reveals the answer and counts as a miss.
4. At the end you get a summary, a list of missed words, and one-click *Practise mistakes*.
5. Check **Difficult Words** and **Progress** any time.

How word status works: **New** (never asked) → **Learning** → **Mastered** (3 correct in a row). A wrong answer makes a word **Difficult** until it reaches 3 correct in a row again.

## Data storage and limits (no backend)

There is **no server, account or login**, so everything is stored locally with IndexedDB (localStorage as fallback). That means:
- Data is tied to **this browser on this device**; it does not sync to other devices or browsers.
- Clearing site data / using a private window removes it. Use **Settings → Backup everything** regularly (the JSON backup includes words, collections, XP, streaks and progress).
- The streak and daily goal use your device's local date.
- Learning progress is never sent anywhere. If you later add a backend with accounts, the data model (`js/store.js`, `js/db.js`) is the single place to connect it.

## Tests

`tests/` contains browser tests that drive the real app (add/edit/delete words, import/export, every exercise type, XP/streak/achievements, pause & resume, persistence across reloads, database upgrade from the first release, localStorage fallback, three languages, phone-width layout):

```
npm install --save-dev playwright
npx playwright install chromium     # once
node tests/core.test.js
node tests/lessons.test.js          # ...and language / upgrade / storage-fallback
```

## Notes & limits

- Deleting a collection deletes its words (after confirmation). At least one collection always exists.
- Browser data can be cleared by the user/browser; keep a JSON backup of important vocabulary.
- The Electron build was written for Windows but is not code-signed.

## Adding or fixing translations

Every interface string lives in `js/locales.js` as `[key, English, Uzbek, Russian]`. Edit a row to change a translation; to add a language, add a column and a code in `js/i18n.js`. Your vocabulary itself is never translated — languages only change the interface.
