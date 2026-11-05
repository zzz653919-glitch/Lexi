-- The LEXIO roadmap: strict level unlocking with a final examination per level, richer lessons, writing / speaking tasks, exam history.
ALTER TABLE levels ADD COLUMN exam_pass_pct INTEGER NOT NULL DEFAULT 80;
ALTER TABLE levels ADD COLUMN strict INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lessons ADD COLUMN kind TEXT NOT NULL DEFAULT 'lesson';
ALTER TABLE lessons ADD COLUMN skill TEXT;
ALTER TABLE lessons ADD COLUMN content TEXT NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN min_words INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exercises ADD COLUMN module TEXT;
CREATE TABLE exam_results (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  attempt_id INTEGER,
  kind TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  score_pct INTEGER NOT NULL,
  pass_pct INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  skills TEXT NOT NULL DEFAULT '{}',
  band REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_exam_user ON exam_results(user_id, lesson_id, id);
CREATE TABLE writing_submissions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  attempt_id INTEGER,
  text TEXT NOT NULL,
  words INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  needed INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_writing_user ON writing_submissions(user_id, exercise_id);
