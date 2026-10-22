# Lexi — Vocabulary Trainer

A fast, private English ↔ Uzbek vocabulary trainer. Add your own words, organise them into collections, and learn them by **typing** answers in randomised quizzes. Runs in any modern browser and as a Windows desktop app. No account, no server, no paid API — everything is stored on your device.

Built with plain HTML, CSS and vanilla JavaScript (no build step, no runtime dependencies).

## Features

- **My Vocabulary** – add, edit, delete and search words; custom collections (A1, A2, B1, IELTS, Personal…); duplicate and empty-input protection.
- **Practice** – random, non-repeating quiz; type the answer and press **Enter**; instant correct/incorrect feedback with the right answer shown; English → Uzbek, Uzbek → English or mixed; choose collection, length, or *difficult words only*; restart & shuffle; end-of-session summary.
- **Smart checking** – ignores capitalisation and extra spaces; treats `o'`, `oʻ`, `o‘` alike; accepts any of several translations (`salom; assalomu alaykum`), `to go` ≈ `go`, and text in `(parentheses)` is optional.
- **Difficult Words** – every word you miss lands here until you answer it correctly 3 times in a row; practise just those, or mark one as learned.
- **Progress** – accuracy, correct/incorrect totals, 7-day activity, accuracy of recent sessions, per-collection learning progress, session history.
- **Import / export** – CSV or TXT import, CSV export, full JSON backup & restore.
- **Three interface languages** – English, O'zbekcha and Русский. Pick one with the selector in the sidebar (top-right on phones) or in Settings; it is remembered, and the first start follows your browser language.
- **Light / dark theme**, responsive layout (desktop, tablet, phone), keyboard accessible with visible focus states.
- **Persistent storage** – IndexedDB (automatic localStorage fallback).

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
  views/                   dashboard, vocabulary, practice, difficult, progress, settings
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

## Notes & limits

- Deleting a collection deletes its words (after confirmation). At least one collection always exists.
- Browser data can be cleared by the user/browser; keep a JSON backup of important vocabulary.
- The Electron build was written for Windows but is not code-signed.

## Adding or fixing translations

Every interface string lives in `js/locales.js` as `[key, English, Uzbek, Russian]`. Edit a row to change a translation; to add a language, add a column and a code in `js/i18n.js`. Your vocabulary itself is never translated — languages only change the interface.
