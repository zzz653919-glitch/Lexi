-- Blocking a user: the reason is shown to the person when they try to sign in, and the time is kept for the administrators.
ALTER TABLE users ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN blocked_at TEXT;
