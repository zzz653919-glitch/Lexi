-- The vocabulary database: pronunciation (IPA), synonyms, difficulty, topic and kind (word, collocation, phrasal verb, idiom, academic).
ALTER TABLE vocabulary ADD COLUMN ipa TEXT NOT NULL DEFAULT '';
ALTER TABLE vocabulary ADD COLUMN synonyms TEXT NOT NULL DEFAULT '';
ALTER TABLE vocabulary ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vocabulary ADD COLUMN topic TEXT NOT NULL DEFAULT '';
ALTER TABLE vocabulary ADD COLUMN kind TEXT NOT NULL DEFAULT 'word';
CREATE INDEX idx_vocab_level ON vocabulary(cefr, kind, status);
