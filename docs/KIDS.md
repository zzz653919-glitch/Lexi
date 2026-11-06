# LEXIO KIDS

A separate children's section: its own content, its own progress, its own look (Fredoka font, bright colours, mascots). Nothing in it is shared with the standard course.

## Choosing the mode
* The first screen (`/welcome`) offers: **placement test**, **choose a level**, **LEXIO KIDS**.
* The choice is saved on the account (`users.mode`: `standard` | `kids`). Profile → *Learning mode* changes it at any time; the parents panel (⚙️ on the Kids dashboard) switches back. Progress of both modes is kept.
* A Kids account opens on `/kids` instead of the standard dashboard. Placement results stay in the account as before.

## Content (14 categories, 159 picture cards)
Alphabet (26 letters, 3 parts), Animals, Colors, Numbers, Fruits, Family, Body parts, Food, Toys, Vehicles, Clothes, Nature, Everyday words, Simple sentences. A category with more than 10 cards is split into equal parts. Source: `server/seed/kids/data.js` (seeded once; administrators can then change everything). Pictures are emoji (or colour swatches, or an uploaded image); words have English, Uzbek (new alphabet) and Russian.

## A game (per category part)
1. **Look and listen**: big picture, word, translation, 🔊 Listen, “I said it!” (listen and repeat)
2. **Match** pictures with words
3. **Tap the right picture** after hearing the word
4. **Spell the word** (tap letters) or **put the words in order** (phrases and sentences)
5. **Quiz**: what is this / which letter / how do you say… (+ up to 2 questions written by administrators)

Stars: ≥90% first-try answers = 3, ≥60% = 2, otherwise 1. A better retry raises the stars, a worse one never lowers them. Badges (11) and the daily activity (7 days, streak) are computed on the server. Audio: uploaded audio if present, otherwise the browser's speech voice; the sound can be switched off.

## Dashboard
Stars, games done, progress path with the bunny, today and the last 7 days, the recommended next game, all categories (with stars per part) and the badges.

## Administration (`/admin/kids`, editors and administrators)
Categories (titles in en/uz/ru, emoji, colour, type, order, status) → cards (words, translations, picture, example/digit, order, status, **image upload** png/jpg/webp/gif ≤ 1 MB, **audio upload** mp3/ogg/wav ≤ 2 MB) → extra quiz questions. Drafts are hidden from children. SVG is refused; uploads are stored in the database and served with `nosniff`.

## Safe by design
No advertisements, no external links, frames or requests (the font is bundled); the Content-Security-Policy of the site applies. Progress API: `GET /api/kids/overview`, `GET /api/kids/categories/:slug`, `POST /api/kids/categories/:slug/complete`, `POST /api/me/mode`. Tests: `tests/api/kids.test.js`, `tests/ui/kids.ui.js`.
