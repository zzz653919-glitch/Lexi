-- Lexi Learn: initial schema. All timestamps are ISO-8601 UTC strings, dates are local YYYY-MM-DD in the user's timezone.

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner','editor','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  avatar TEXT NOT NULL DEFAULT 'sprout',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  ui_language TEXT NOT NULL DEFAULT 'en',
  course_id INTEGER,
  start_level TEXT NOT NULL DEFAULT 'A1',
  daily_goal_xp INTEGER NOT NULL DEFAULT 30 CHECK (daily_goal_xp BETWEEN 5 AND 500),
  xp_total INTEGER NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  hearts INTEGER NOT NULL DEFAULT 5 CHECK (hearts >= 0),
  hearts_updated_at TEXT NOT NULL,
  leaderboard_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_active_at TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  track TEXT NOT NULL DEFAULT 'general' CHECK (track IN ('general','ielts')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE levels (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                       -- A1, A2, B1, B2, C1 or IELTS
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  unlock_rule TEXT NOT NULL DEFAULT 'sequential' CHECK (unlock_rule IN ('sequential','open')),
  unlock_threshold_pct INTEGER NOT NULL DEFAULT 60 CHECK (unlock_threshold_pct BETWEEN 0 AND 100),
  UNIQUE (course_id, code)
);

CREATE TABLE units (
  id INTEGER PRIMARY KEY,
  level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_units_level ON units(level_id, position);

CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  unlock_rule TEXT NOT NULL DEFAULT 'sequential' CHECK (unlock_rule IN ('sequential','open','prerequisite')),
  prerequisite_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  xp_reward INTEGER NOT NULL DEFAULT 20 CHECK (xp_reward BETWEEN 0 AND 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_lessons_unit ON lessons(unit_id, position);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  prompt TEXT NOT NULL DEFAULT '',          -- the question / instruction shown to the learner
  answer TEXT NOT NULL DEFAULT '',          -- accepted answer(s), alternatives separated by |  (typed, scramble, order, listen_type, fix_spelling)
  sentence TEXT NOT NULL DEFAULT '',        -- sentence with ____ (fill_blank), misspelled text (fix_spelling), target sentence (order_words)
  passage TEXT NOT NULL DEFAULT '',         -- reading passage
  audio_text TEXT NOT NULL DEFAULT '',      -- text read by text-to-speech for listening exercises
  audio_url TEXT NOT NULL DEFAULT '',       -- uploaded audio (preferred over text-to-speech)
  translation TEXT NOT NULL DEFAULT '',     -- translation shown after answering
  explanation TEXT NOT NULL DEFAULT '',
  hint TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'en-uz' CHECK (direction IN ('en-uz','uz-en')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  vocabulary_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_exercises_lesson ON exercises(lesson_id, position);

CREATE TABLE exercise_options (
  id INTEGER PRIMARY KEY,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  match_text TEXT NOT NULL DEFAULT '',      -- match_pairs: the right-hand side of the pair
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_options_exercise ON exercise_options(exercise_id, position);

CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  level_id INTEGER REFERENCES levels(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  en TEXT NOT NULL,
  uz TEXT NOT NULL,
  translations TEXT NOT NULL DEFAULT '{}',  -- JSON object: language code -> translation (e.g. {"ru":"..."})
  pos TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  example_uz TEXT NOT NULL DEFAULT '',
  audio_url TEXT NOT NULL DEFAULT '',
  cefr TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_vocab_course ON vocabulary(course_id, status);
CREATE UNIQUE INDEX idx_vocab_unique ON vocabulary(en COLLATE NOCASE, uz COLLATE NOCASE);

-- a learner's run through one lesson (or a "review my mistakes" run when lesson_id is NULL)
CREATE TABLE lesson_attempts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'lesson' CHECK (kind IN ('lesson','mistakes')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned','out_of_hearts')),
  queue TEXT NOT NULL,                      -- JSON array of exercise ids still to be asked, in order (wrong answers are re-queued once)
  position INTEGER NOT NULL DEFAULT 0,      -- index into queue of the exercise being asked
  total_planned INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  incorrect INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  seed INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_attempts_user ON lesson_attempts(user_id, status);
-- at most one unfinished attempt per learner and lesson
CREATE UNIQUE INDEX idx_attempts_one_open ON lesson_attempts(user_id, COALESCE(lesson_id, 0), kind) WHERE status = 'in_progress';

CREATE TABLE exercise_responses (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES lesson_attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,                    -- queue position this response belongs to (makes a double submit idempotent)
  answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  is_retry INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '{}',      -- JSON: what was shown to the learner (stored so a repeated submit returns the same result)
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (attempt_id, slot)
);
CREATE INDEX idx_responses_user ON exercise_responses(user_id, exercise_id, is_correct);

CREATE TABLE user_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completions INTEGER NOT NULL DEFAULT 0,
  best_accuracy INTEGER NOT NULL DEFAULT 0,
  first_completed_at TEXT,
  last_completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE xp_transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,                     -- exercise, lesson_complete, perfect_bonus, review, mistakes, achievement
  ref_type TEXT NOT NULL,
  ref_id INTEGER NOT NULL,
  local_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, reason, ref_type, ref_id)   -- the same activity can never pay out twice
);
CREATE INDEX idx_xp_user_date ON xp_transactions(user_id, local_date);

CREATE TABLE user_streaks (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT
);

CREATE TABLE user_days (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  lessons INTEGER NOT NULL DEFAULT 0,
  answers INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  review_correct INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, local_date)
);

CREATE TABLE user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, code)
);

-- spaced repetition (Leitner boxes) for vocabulary
CREATE TABLE review_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  box INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  is_difficult INTEGER NOT NULL DEFAULT 0,
  last_result INTEGER,
  last_reviewed_at TEXT,
  PRIMARY KEY (user_id, vocabulary_id)
);
CREATE INDEX idx_review_due ON review_items(user_id, due_at);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_log(created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
