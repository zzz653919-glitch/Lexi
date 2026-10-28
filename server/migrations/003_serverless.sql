-- rate limiting that works across several server instances
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL);
-- uploaded audio is stored in the database (serverless hosts have no persistent disk)
ALTER TABLE uploads ADD COLUMN data TEXT;
