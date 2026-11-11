-- Level-based lessons: every lesson carries the id of its level, and every learner has a saved, selected level.
ALTER TABLE lessons ADD COLUMN level_id INTEGER REFERENCES levels(id);
UPDATE lessons SET level_id = (SELECT u.level_id FROM units u WHERE u.id = lessons.unit_id);
CREATE INDEX IF NOT EXISTS idx_lessons_level ON lessons(level_id, position);
ALTER TABLE users ADD COLUMN selected_level TEXT;
ALTER TABLE users ADD COLUMN selected_level_at TEXT;
-- learners who chose their level by hand keep it as the selected level
UPDATE users SET selected_level = start_level WHERE level_source = 'manual' AND start_level IN (SELECT code FROM levels);
