ALTER TABLE moments ADD COLUMN updated_at TEXT;
UPDATE moments SET updated_at = datetime(created_at / 1000, 'unixepoch') WHERE updated_at IS NULL;
