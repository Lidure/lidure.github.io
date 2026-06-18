CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, emoji, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id
ON comment_reactions(comment_id);
