CREATE TABLE IF NOT EXISTS moment_reactions (
  moment_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (moment_id, emoji, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_moment_reactions_moment_id
ON moment_reactions(moment_id);
