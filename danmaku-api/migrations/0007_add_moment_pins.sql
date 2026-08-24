ALTER TABLE moments ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE moments ADD COLUMN pinned_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_moments_pinned_at ON moments(pinned, pinned_at DESC);
