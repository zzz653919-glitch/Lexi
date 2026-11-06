-- LEXIO KIDS: a separate children's section (own content, own progress). users.mode remembers which experience the account uses.
ALTER TABLE users ADD COLUMN mode TEXT NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS kids_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL, title_uz TEXT NOT NULL DEFAULT '', title_ru TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '⭐', color TEXT NOT NULL DEFAULT '#ffb703',
  kind TEXT NOT NULL DEFAULT 'words',            -- words | letters | numbers | sentences
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kids_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES kids_categories(id) ON DELETE CASCADE,
  en TEXT NOT NULL, uz TEXT NOT NULL DEFAULT '', ru TEXT NOT NULL DEFAULT '',
  pic TEXT NOT NULL DEFAULT '',                   -- emoji, a row of emoji, or #rrggbb (colour swatch)
  extra TEXT NOT NULL DEFAULT '',                 -- letters: example word, numbers: the digit
  image_url TEXT NOT NULL DEFAULT '', audio_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kids_words_cat ON kids_words(category_id, position);
-- extra quiz questions written by administrators (shown in the quiz step of a category)
CREATE TABLE IF NOT EXISTS kids_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES kids_categories(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL, prompt_uz TEXT NOT NULL DEFAULT '', prompt_ru TEXT NOT NULL DEFAULT '',
  pic TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', audio_url TEXT NOT NULL DEFAULT '',
  correct TEXT NOT NULL, wrong1 TEXT NOT NULL, wrong2 TEXT NOT NULL DEFAULT '', wrong3 TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- one row per learner and lesson part (a category is split into parts of at most 10 cards)
CREATE TABLE IF NOT EXISTS kids_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES kids_categories(id) ON DELETE CASCADE,
  part INTEGER NOT NULL DEFAULT 1,
  stars INTEGER NOT NULL DEFAULT 0,               -- best result, 1..3
  best_pct INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, category_id, part)
);
CREATE TABLE IF NOT EXISTS kids_days (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  lessons INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, local_date)
);
CREATE TABLE IF NOT EXISTS kids_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, code)
);
