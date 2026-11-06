-- A session opened through the e-mail "Yes, it is me" link may set a new password without the old one.
ALTER TABLE sessions ADD COLUMN recovery INTEGER NOT NULL DEFAULT 0;
