-- Multilingual support: separate interface / translation / learning languages, translated course content, editable interface texts.

-- who the learner is: interface language (users.ui_language, already present), the language translations are shown in, and the language being learned
ALTER TABLE users ADD COLUMN translation_language TEXT NOT NULL DEFAULT 'uz';
ALTER TABLE users ADD COLUMN learning_language TEXT NOT NULL DEFAULT 'en';

-- translated course content (JSON: {"ru": {"title": "...", "description": "..."}, "uz": {...}}); the base columns keep the original text
ALTER TABLE courses ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
ALTER TABLE levels ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
ALTER TABLE units ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
ALTER TABLE lessons ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
-- exercise variants per translation language (JSON: {"ru": {"sentence": "...", "answer": "...", "options": [{"text": "...", "match_text": "..."}], ...}})
ALTER TABLE exercises ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';

-- interface texts edited in the admin panel; they override the files in /locales and can be removed again
CREATE TABLE translation_overrides (
  lang TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (lang, key)
);
