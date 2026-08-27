ALTER TABLE guest_messages ADD COLUMN note_color TEXT;
ALTER TABLE guest_messages ADD COLUMN note_size TEXT;
ALTER TABLE guest_messages ADD COLUMN pos_x REAL;
ALTER TABLE guest_messages ADD COLUMN pos_y REAL;
ALTER TABLE guest_messages ADD COLUMN rotation REAL;
ALTER TABLE guest_messages ADD COLUMN author_token_hash TEXT;
ALTER TABLE guest_messages ADD COLUMN updated_at INTEGER;

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
ON message_reactions(message_id);
