# Avatar Studio, LEXIO TOKENS and the Avatar Shop

## What it is
* **Avatar Studio** (`/avatar`): a large live preview and options for every part (style, face shape, skin, hairstyle and colour, eyes, eyebrows, mouth, clothes, shoes, hats, glasses, accessories, pet, background, effects). Name it, **save**, **reset**, **randomize**, keep up to six characters, switch between them, mark a favorite, delete. Six styles: cute cartoon, modern 2D, 3D, fantasy, animal, robot (original SVG artwork, `public/js/avatar/render.js`).
* **LEXIO TOKENS**: earned by learning, separate from XP, never sold. The ledger (`token_transactions`) has one row per achievement (`UNIQUE(user, ref)`), the balance (`token_wallets`, `CHECK balance >= 0`) is changed in the same transaction. Rewards (administrator-configurable, `Admin → Avatar → Token rewards`): lesson 10, topic 30, test 20, daily mission 15, 7-day streak 50, level 100. Paid only after a real completion (a lesson attempt that finished; a test only when passed), once per lesson / topic / test / level / streak run / mission and day. Hook: `server/lib/attempts.js → avatar.onLearning`; missions finished by other activities are paid when the missions page or any page chip (`/api/me/stats`, throttled to once per 45 s per account) is read.
* **Avatar Shop** (`/avatar/shop`): 125 items in four categories (clothing, accessories, pets & companions, special items), each with a picture, name, price, rarity (common … legendary), ownership status, **Buy** and a try-on preview. Purchases are validated on the server (`server/lib/avatar.js → buy`): item active and for sale, not owned, enough tokens, no negative balance, no double purchase (also under simultaneous requests).
* **Inventory** (`/avatar/inventory`): everything owned; equip clothing, remove accessories, change pet / pose / name, switch backgrounds, preview combinations, save. Purchased items stay on the account permanently (an owned item can only be disabled by an administrator, never deleted).
* **Pets**: one companion next to the character with a name, three poses (sit, play, sleep) and idle animations; some pets are **earned by achievements** (rules such as `lessons:25`, `streak:14`, `levels:1`, `xp:3000`, `words:100`) instead of bought.
* **Daily missions** (`/avatar/missions`): complete 2 lessons, learn 10 new words, pass a vocabulary test, practice listening, complete a speaking activity, keep the learning streak; each pays tokens once a day; 13 badges.
* **Profile**: the character card with name, outfit, companion, tokens earned, XP, achievements and character level (grows with XP: `level = 1 + floor(sqrt(xp / 40))`).
* **Reward animation**: when tokens are earned, any page shows coins and a banner once (the server remembers it was shown); the token chip sits next to XP.

## Admin (`/admin/avatar`, administrators)
Items (add / edit / delete when nobody owns it / disable, price, rarity, colours, pattern, variant, **image upload**, earn rule), token rewards, the token ledger with a user filter, and a user's purchased items with an administrator gift of tokens (audited). Editors can manage items but not rewards or the ledger.

## API
`GET /api/avatar/bootstrap`, `POST|PUT|DELETE /api/avatar/avatars[/:id]`, `POST /api/avatar/avatars/:id/activate`, `POST /api/avatar/shop/:slug/buy`, `GET /api/avatar/wallet`, `POST /api/avatar/wallet/seen`, `GET /api/avatar/missions`, `GET /api/avatar/card`; admin under `/api/admin/avatar/…`. Tables: migration `011_avatar.sql`. Catalogue: `server/seed/avatar/catalog.js`.

## Limits
Pictures are drawn from parameters (an uploaded transparent PNG, 240×340 canvas, can replace the drawing of an item); there are no real-money purchases; token rewards for review-only activity may arrive up to a minute late.
Tests: `tests/api/avatar.test.js`, `tests/ui/avatar.ui.js`.
