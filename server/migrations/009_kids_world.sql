-- LEXIO KIDS, part 2: companion, mini games, stories, rewards (stickers, places, accessories), daily missions, drawings, parent settings.
CREATE TABLE IF NOT EXISTS kids_profile (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  character TEXT NOT NULL DEFAULT 'lion',
  accessory TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT 'sky',
  sound INTEGER NOT NULL DEFAULT 1,
  narration INTEGER NOT NULL DEFAULT 1,
  reminders INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT NOT NULL DEFAULT '17:00',
  age TEXT NOT NULL DEFAULT 'older',            -- young (3-5): fewer choices | older (6-8)
  daily_limit_min INTEGER NOT NULL DEFAULT 0,   -- 0 = no limit
  mic INTEGER NOT NULL DEFAULT 0,               -- speech recognition is OFF until a parent allows it
  pin_hash TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
ALTER TABLE kids_days ADD COLUMN games INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN listens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN quizzes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN newwords INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN speaks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN arts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kids_days ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS kids_known (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES kids_words(id) ON DELETE CASCADE,
  first_at TEXT NOT NULL,
  PRIMARY KEY (user_id, word_id)
);
CREATE TABLE IF NOT EXISTS kids_games (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, best_pct INTEGER NOT NULL DEFAULT 0, plays INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, game)
);
CREATE TABLE IF NOT EXISTS kids_story_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, best_pct INTEGER NOT NULL DEFAULT 0, reads INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, slug)
);
-- everything a child has earned (never bought): sticker, animal, accessory, background, character, place, decoration
CREATE TABLE IF NOT EXISTS kids_rewards (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, code TEXT NOT NULL, earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind, code)
);
CREATE TABLE IF NOT EXISTS kids_art (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  picture TEXT NOT NULL, fills TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, picture)
);
