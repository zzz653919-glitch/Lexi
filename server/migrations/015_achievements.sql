-- Achievements and rewards: the definitions (managed in the admin panel), the progress of every learner, and what unlocking one paid.
CREATE TABLE IF NOT EXISTS achievement_defs (
  code TEXT PRIMARY KEY,
  category TEXT NOT NULL,                        -- learning | streak | performance | level | special | milestone
  rarity TEXT NOT NULL DEFAULT 'common',         -- common | rare | epic | legendary | mythic
  metric TEXT NOT NULL,                          -- what is measured (lessons, words, streak, level:B1 ...): always taken from real activity
  target INTEGER NOT NULL DEFAULT 1 CHECK (target >= 1),
  icon TEXT NOT NULL DEFAULT 'star',
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  tokens INTEGER NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  item_slug TEXT NOT NULL DEFAULT '',            -- an avatar item given with the achievement
  badge INTEGER NOT NULL DEFAULT 1,              -- shown as a badge on the profile
  status TEXT NOT NULL DEFAULT 'active',         -- active | hidden
  position INTEGER NOT NULL DEFAULT 0,
  title_en TEXT NOT NULL, title_uz TEXT NOT NULL DEFAULT '', title_ru TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '', desc_uz TEXT NOT NULL DEFAULT '', desc_ru TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_achievement_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, code)
);
-- what an unlock paid (the rows that existed before this feature keep their state and are marked as already settled)
ALTER TABLE user_achievements ADD COLUMN xp_awarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_achievements ADD COLUMN tokens_awarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_achievements ADD COLUMN item_slug TEXT NOT NULL DEFAULT '';
ALTER TABLE user_achievements ADD COLUMN seen INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_achievements ADD COLUMN rewarded INTEGER NOT NULL DEFAULT 1;
-- the interface languages a learner has really used (Polyglot Journey) and the parts of the day they studied in (Early Bird, Night Owl)
CREATE TABLE IF NOT EXISTS user_ui_languages (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  first_used_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lang)
);
INSERT OR IGNORE INTO user_ui_languages (user_id, lang, first_used_at) SELECT id, ui_language, created_at FROM users WHERE ui_language IN ('uz', 'ru', 'en');
CREATE TABLE IF NOT EXISTS user_time_marks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mark TEXT NOT NULL,                            -- morning | evening
  local_date TEXT NOT NULL,
  PRIMARY KEY (user_id, mark, local_date)
);
