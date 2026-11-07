-- Avatar Studio, LEXIO TOKENS and the Avatar Shop. Tokens are a ledger (every change is a row) next to XP; they are never bought with money.
CREATE TABLE IF NOT EXISTS token_wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  earned_total INTEGER NOT NULL DEFAULT 0,
  spent_total INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS token_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,                      -- + earned, - spent
  kind TEXT NOT NULL,                           -- earn | spend | grant
  reason TEXT NOT NULL,                         -- lesson | topic | test | mission | streak | level | purchase | admin
  ref TEXT NOT NULL,                            -- the achievement or purchase this row is for: one row per (user, ref), so a reward can never be paid twice
  balance_after INTEGER NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  seen INTEGER NOT NULL DEFAULT 0,              -- the reward animation has been shown
  created_at TEXT NOT NULL,
  UNIQUE (user_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_token_tx_user ON token_transactions(user_id, id);

CREATE TABLE IF NOT EXISTS avatar_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL, name_uz TEXT NOT NULL DEFAULT '', name_ru TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,                           -- tee, hoodie, hat, cat, background, effect ...
  slot TEXT NOT NULL,                           -- the place on the character (derived from the kind)
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  rarity TEXT NOT NULL DEFAULT 'common',
  art TEXT NOT NULL DEFAULT '{}',               -- JSON drawing parameters (colours, pattern)
  image_url TEXT NOT NULL DEFAULT '',           -- an uploaded picture replaces the drawing
  earn_rule TEXT NOT NULL DEFAULT '',           -- "lessons:50": earned by learning instead of bought
  starter INTEGER NOT NULL DEFAULT 0,           -- every account owns it
  status TEXT NOT NULL DEFAULT 'active',        -- active | disabled (owners keep it)
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS avatar_owned (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES avatar_items(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                         -- shop | reward | starter
  price_paid INTEGER NOT NULL DEFAULT 0,
  acquired_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cartoon',
  look TEXT NOT NULL DEFAULT '{}',              -- JSON: face shape, skin, hair, eyes, brows, mouth
  equipped TEXT NOT NULL DEFAULT '{}',          -- JSON: slot -> item slug
  pet_name TEXT NOT NULL DEFAULT '',
  pet_pose TEXT NOT NULL DEFAULT 'sit',
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_avatars_user ON avatars(user_id);
CREATE TABLE IF NOT EXISTS avatar_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_avatar_id INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS avatar_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, code)
);
