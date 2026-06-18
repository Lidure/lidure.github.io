CREATE TABLE IF NOT EXISTS guest_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_messages_created_at
ON guest_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_messages_ip_hash_created_at
ON guest_messages(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (target_type IN ('moment', 'message'))
);

CREATE INDEX IF NOT EXISTS idx_comments_target_created_at
ON comments(target_type, target_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_comments_ip_hash_created_at
ON comments(ip_hash, created_at);
