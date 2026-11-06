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


## Part 2: fun interactive features
**Navigation.** Seven big illustrated buttons (bottom bar on phones): Home, Lessons, Games, Stories, My World, Stickers, My Progress. Speaking (`/kids/speak`) and Coloring (`/kids/coloring`) open from Home and Games.

**Learning friends.** Six original SVG characters (lion, fox, bunny, cat, dino, robot) with moods (happy, cheer, oops, think, sleep) and accessories. The friend greets the child, explains each step and reacts to right and wrong answers. The child picks a favorite (button at the top right or the Stickers → Dress-up tab); lion, fox and bunny are free, cat (6 stars), dino (15) and robot (30) are earned.

**Eight mini games** (`/kids/games/:code`): Word Catcher, Picture Match, Bubble Pop, Memory Cards, Animal Sounds, Color Hunt, Letter Builder, Word Puzzle. Each ends with 1–3 stars, new words and rewards (`POST /api/kids/games/:code/complete`). Animal Sounds uses the browser voice to say the sound ("Meow, meow") unless an administrator uploaded audio for the card; Color Hunt uses a built-in set of coloured objects.

**Storybooks** (`/kids/stories/:slug`, content in `server/seed/kids/stories.js`): The Little Bunny, A Day at the Zoo, The Magic Garden, My First School, The Lost Puppy, A Trip to the Moon. Illustrated scenes (emoji art on painted backgrounds), simple English with Uzbek / Russian translation, narration by the browser voice with the words highlighted one by one (tap any word to hear it), two questions at the end.

**My World.** Six places (house, garden, zoo, playground, space station, magical forest) open at 0 / 5 / 15 / 30 / 50 / 75 stars; each grows with decorations (18) and the zoo and forest fill with the animals the child has learned. **Stars** = lesson stars + game stars + story stars.

**Rewards are earned, never bought.** Stickers (36: 14 categories, 8 games, 6 stories, stars, missions, speaking, drawing, streaks), 12 collectible animals (learn the word), 6 accessories, 6 backgrounds, 6 friends, 6 places, 18 decorations. Earned rewards are remembered in `kids_rewards`; the album shows locked ones with what to do. There is no shop and no price anywhere.

**Daily missions** (progress bars): learn 5 new words · complete one lesson · play one game · listen to 3 English words · finish one mini quiz (a story's questions or a quiz game). All five in one day = a sticker.

**Speaking and listening.** Repeat words, greetings, animal names or sentences, or listen and tap the picture. Speech recognition is optional and **off until a parent allows it**; with it a close match gets a cheer, otherwise a gentle "nice try, listen once more" — nothing is ever marked wrong or blocked. Voices are not recorded by LEXIO.

**Coloring.** Eight outline pictures (apple, cat, fish, ball, car, house, flower, teddy bear), 10 colours whose English names are spoken, the object's name is spoken too; colouring is saved on the account.

**Parent area** (`/kids/parents`): opens with a grown-up sum (or a 4-digit PIN once set); a signed token (20 min) protects the API. Shows lessons completed, words learned, learning time (today / week / total), progress by category, recommended next lessons; controls sound, story narration, microphone permission, reminders (a note on the Kids home page — no e-mails or push messages are sent), age group (3–5 = fewer answer choices), a daily time limit and the PIN. Defaults are privacy-friendly: microphone off, reminders off, no limit.

Tests: `tests/api/kids-play.test.js`, `tests/ui/kids.ui.js` (plays every game, story, lesson, speaking and colouring through the page; phone / tablet / desktop).
