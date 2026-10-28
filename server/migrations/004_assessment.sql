-- Placement test, personalised learning and continuous level adjustment.
-- Existing accounts keep everything: they are marked as onboarded and start with the level they had chosen.
ALTER TABLE users ADD COLUMN cefr_level TEXT;
ALTER TABLE users ADD COLUMN level_source TEXT NOT NULL DEFAULT 'default';
ALTER TABLE users ADD COLUMN level_changed_at TEXT;
ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN lesson_length TEXT NOT NULL DEFAULT 'normal';
UPDATE users SET onboarded = 1, cefr_level = start_level, level_source = 'legacy', level_changed_at = created_at;
ALTER TABLE exercises ADD COLUMN skill TEXT;
ALTER TABLE lesson_attempts ADD COLUMN variant TEXT;

CREATE TABLE assessment_questions (
  id INTEGER PRIMARY KEY,
  skill TEXT NOT NULL CHECK (skill IN ('vocabulary','grammar','reading','usage','completion','expressions','listening')),
  level TEXT NOT NULL CHECK (level IN ('A0','A1','A2','B1','B2','C1','C2')),
  format TEXT NOT NULL DEFAULT 'choice' CHECK (format IN ('choice','type')),
  prompt TEXT NOT NULL,
  passage TEXT NOT NULL DEFAULT '',
  sentence TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  audio_text TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  times_asked INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_aq_pick ON assessment_questions(status, level, skill);

CREATE TABLE assessment_options (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ao_question ON assessment_options(question_id, position);

CREATE TABLE assessments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'placement' CHECK (kind IN ('placement','reassessment')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  listening INTEGER NOT NULL DEFAULT 0,
  seed INTEGER NOT NULL DEFAULT 1,
  asked INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  theta REAL,
  sd REAL,
  result_level TEXT,
  result TEXT NOT NULL DEFAULT '{}',
  config TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_assess_user ON assessments(user_id, status);
CREATE UNIQUE INDEX idx_assess_one_open ON assessments(user_id) WHERE status = 'in_progress';

CREATE TABLE assessment_responses (
  id INTEGER PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  skill TEXT NOT NULL,
  level TEXT NOT NULL,
  format TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  is_correct INTEGER NOT NULL,
  dont_know INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (assessment_id, slot)
);

CREATE TABLE user_skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  score REAL NOT NULL,
  samples INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, skill)
);

CREATE TABLE skill_evidence (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  level TEXT NOT NULL,
  correct INTEGER NOT NULL,
  source TEXT NOT NULL,
  attempt_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_evidence_user ON skill_evidence(user_id, id);

CREATE TABLE user_level_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  previous TEXT,
  source TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  assessment_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_level_history_user ON user_level_history(user_id, id);

CREATE TABLE learning_plans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  plan TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE grammar_points (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('A0','A1','A2','B1','B2','C1','C2')),
  slug TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  examples TEXT NOT NULL DEFAULT '[]',
  practice TEXT NOT NULL DEFAULT '[]',
  translations TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_grammar_level ON grammar_points(status, level, position);

CREATE TABLE user_grammar (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grammar_id INTEGER NOT NULL REFERENCES grammar_points(id) ON DELETE CASCADE,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  PRIMARY KEY (user_id, grammar_id)
);

CREATE TABLE item_responses (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES lesson_attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  slot INTEGER NOT NULL,
  answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  is_retry INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '{}',
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (attempt_id, slot)
);
