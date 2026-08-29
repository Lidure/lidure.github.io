CREATE TABLE IF NOT EXISTS message_stickers (
  id TEXT PRIMARY KEY,
  sticker_key TEXT NOT NULL,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  owner_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_stickers_owner
ON message_stickers(owner_token_hash);

CREATE INDEX IF NOT EXISTS idx_message_stickers_updated
ON message_stickers(updated_at);
