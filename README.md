# Lexi — Vocabulary Trainer

A fast, private English ↔ Uzbek vocabulary trainer. Add your own words, organise them into collections, and learn them by **typing** answers in randomised quizzes. Runs in any modern browser and as a Windows desktop app. No account, no server, no paid API — everything is stored on your device.

Built with plain HTML, CSS and vanilla JavaScript (no build step, no runtime dependencies).

## Features

### Word Lessons: one guided lesson, ten kinds of exercises
Open **Word Lessons** and press **Start lesson** (*Mashqni boshlash*). A lesson of 10–15 exercises opens in its own full-screen player (progress bar and a `4 / 12` counter on top, a pause/exit button, the exercise in the middle, **Check** at the bottom). You solve one exercise at a time: answer → **Check** → a green or red panel explains the answer → **Continue**. Nothing advances by itself. The kinds of exercises change from step to step and the order differs from lesson to lesson:

| # | Exercise | What you do |
|---|---|---|
| 1 | **Learn the word** | See the word big, its Uzbek translation, a pronunciation (🔊) button and, if you saved one, the pronunciation note / transcription; then type the word yourself |
| 2 | **Choose the translation** | A) B) C) D) options, shuffled so the right one is not always in the same place; short explanation afterwards |
| 3 | **Build the word from letters** | Mixed-up letter tiles; tap to place, tap a placed tile to take it back, *Undo*, *Reset*, keyboard letters/Backspace; repeated letters are separate tiles; success animation |
| 4 | **Translate a sentence EN → UZ** | `I am at home.` → type the Uzbek; several correct translations are accepted (e.g. with or without “Men”) |
| 5 | **Translate a sentence UZ → EN** | `Men uyda turibman.` → type the English; contractions (`I'm` = `I am`), capital letters and punctuation do not matter; a short grammar note follows |
| 6 | **Build the sentence** | Tap word tiles into order; remove, put back, **drag** or use the arrow keys to re-order |
| 7 | **Listen and answer** | Text-to-speech plays a word or sentence (replay and slow replay); type or choose what you heard |
| 8 | **Fill in the blank** | `I ___ a student.` → am / is / are; the grammar rule is explained |
| 9 | **Match pairs** | Pair English words with their Uzbek translations |
| 10 | **Review mistakes** | Words and sentences you got wrong come back near the end of the lesson as a *different* kind of exercise (never the same one twice in a row); the results page has a *Review mistakes* button for an extra round |

How the lesson is put together: new words are introduced first (“learn”), then used in different exercises; the next exercise never has the same type or the same word as the previous one; sentences are picked to match your words and level when possible and recently used ones are avoided. The “Practise one exercise type” cards below the Start button run a single kind of exercise only (plus the older word exercises: type the answer, fill in missing letters, reverse, review). Quit with the ✕ button any time: *Save and exit* keeps your progress (even across a page reload) and shows a **Resume** card.

**Results page:** exercises done, correct / wrong, accuracy %, XP, time, best combo, streak, daily goal, level-ups, new achievements, *well learned words*, *words and sentences to review*, and the buttons **Review mistakes**, **Next lesson** and **Back to the lesson list**.

**Pronunciation and honesty notes**
- Audio uses the browser's built-in Text-to-Speech (US/UK English voices are preferred). There is no recorded audio and no fake audio: if the browser has no speech support, listening exercises and speaker buttons are simply not offered and every other exercise works as usual. “I can't listen right now” skips a listening exercise without counting a mistake.
- Pronunciation notes / phonetic transcription are shown **only if you typed one** (field *Pronunciation* in the word dialog, e.g. `/ˈæp.əl/`). The 288 ready-made words do not include transcriptions because I would have to invent them.
- Sentence exercises use a built-in bank of 54 simple sentences (A1–B1) with Uzbek translations, accepted alternatives and short grammar notes (20 rules). They were written for this project and are not reviewed by a professional translator; please have a teacher or native speaker check them.

**Motivation system (all computed from real, stored activity):**
- **XP** per correct answer (choose 8, fill 10, typing 12, match pair 4; half XP for a retry), **combo bonus** +5 XP for every 5 correct answers in a row, +10 XP for finishing a lesson.
- **Daily goal** (20–200 XP, default 50), **streak** (consecutive days with practice), **level** (`level = ⌊√(XP/40)⌋ + 1`), **words learned**, accuracy, a 14-day history chart and 15 **achievements** with progress bars.

**Spaced repetition (Leitner boxes):** every word has a box 0–5 with review intervals 10 min / 1 / 3 / 7 / 14 / 30 days. A correct first answer moves a word up one box (a never-seen word goes to box 1); a wrong first answer moves it down two boxes, so it returns sooner. Each lesson uses due words first, then at most 5 new words, then (if needed) the words due soonest. *Word knowledge* shows every word's strength (5-step meter), next review date and accuracy, with filters (due, difficult, new, learning, reviewing, well known). Words you miss also appear on the existing *Difficult Words* page. A word counts as **learned** when it reaches the 7-day interval (box 3).

**Vocabulary management inside the section:** add words with an optional **example/note**, create/rename/delete collections, edit/delete words, and **tick which collections to practise** (nothing ticked = all).

**Ready-made decks:** 4 levels (A1 Beginner, A2 Elementary, B1 Intermediate, B2 Upper-Intermediate) × 9 topics (Daily life, Family, Food and drink, Home and objects, School and education, Work and jobs, Travel, Verbs, Adjectives) × 8 words = **288 English–Uzbek entries**. Add a topic or a whole level to your own collections with one click (existing words are never duplicated).
> **Honest note about the ready-made words:** they were written for this project from common everyday vocabulary and checked automatically (no empty or duplicated entries, consistent format) — but **not reviewed by a professional translator or taken from an official CEFR list**. Levels are approximate. Please let a teacher or native speaker check them before you rely on them for teaching.

**Pronunciation:** a speaker button next to English words uses the browser's built-in Text-to-Speech (it prefers natural-sounding US/UK English voices). If the browser has no speech support the buttons are simply hidden and everything else keeps working. Optional setting: read English words aloud automatically.

### Bulk Vocabulary Import (new)
Open **My Vocabulary → Bulk add** (or the same button in *Word Lessons → My collections*). Paste 10, 20, 50, 100 or thousands of words at once; every line becomes its own vocabulary card.

1. **Paste** (straight from Excel / Google Sheets / a text file) or open a `.csv`, `.tsv` or `.txt` file. Two formats:
   - English only, one word or phrase per line (`look for`, `have a row with` stay in one piece), or
   - English + translation separated by a **tab, `;`, `,`, `—`/`-`/`=` or `|`**. A header row, a `№` column and numbering such as `1.` are removed automatically. A third column becomes the example sentence. The separator is detected automatically and can be forced.
2. **Check and edit** the table: every row shows *Ready*, *Missing translation*, *Missing English word*, *Too long*, *Repeats row N* or *Already saved as …*; rows with problems are highlighted. Edit any cell, add/delete rows, swap the two columns, tick which rows to save, 25/50/100 rows per page (lists up to 5000 rows stay fast).
   **Duplicates are never removed automatically.** They stay in the table, unticked; tick one to replace the saved translation of an existing word. Two ticked rows with the same English word are blocked until you untick one.
3. **Save** into a new collection (give it a name such as “Unit 5”) or an existing one. The result tells you how many words were saved, or that saving failed. The words then show up as their own collection in *My Vocabulary*, *Practice* and *Word Lessons* (*Practise these words* starts a lesson with only them).

**English-only lists:** translations stay empty so you can type them. **Automatic AI translation is not available** (the app is offline and has no AI service), so there is no such button. Instead *Fill empty translations from my words and ready-made decks* looks words up in your own vocabulary and the 288 ready-made entries, and marks every filled cell “from library” so you can check it.

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
  bulk-parse.js            Bulk import parser and row checks (pure logic)
  locales-bulk.js          Translations for Bulk Import
  learn-engine.js          Spaced repetition, word exercises, XP, streak, level, achievements (pure logic)
  lesson-engine.js         Guided-lesson builder, exercise item factories, sentence checking, mistake review (pure logic)
  sentences.js             Sentence bank (A1-B1) with Uzbek translations and grammar rules
  exercises.js             One reusable component per exercise type (render / mount / check / reveal)
  lesson-player.js         The lesson player: Check -> result panel -> Continue, XP, pause/resume, results page
  locales-lesson.js        Translations for the player and grammar notes
  speech.js                Text-to-Speech pronunciation
  word-dialogs.js          Shared add/edit/delete dialogs for words and collections
  locales-learn.js         Translations for Word Lessons
  views/                   dashboard, vocabulary, learn, bulk, practice, difficult, progress, settings
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
node tests/lessons.test.js          # ...and lesson-engine / exercises / bulk-parser / bulk / language / upgrade / storage-fallback
```

## Notes & limits

- Deleting a collection deletes its words (after confirmation). At least one collection always exists.
- Browser data can be cleared by the user/browser; keep a JSON backup of important vocabulary.
- The Electron build was written for Windows but is not code-signed.

## Adding or fixing translations

Every interface string lives in `js/locales.js` as `[key, English, Uzbek, Russian]`. Edit a row to change a translation; to add a language, add a column and a code in `js/i18n.js`. Your vocabulary itself is never translated — languages only change the interface.
