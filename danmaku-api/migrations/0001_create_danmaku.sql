CREATE TABLE IF NOT EXISTS danmaku (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL,
  text TEXT NOT NULL,
  time REAL NOT NULL,
  color TEXT,
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_danmaku_track_time
ON danmaku(track, time);

CREATE INDEX IF NOT EXISTS idx_danmaku_track_created_at
ON danmaku(track, created_at);

CREATE INDEX IF NOT EXISTS idx_danmaku_ip_hash_created_at
ON danmaku(ip_hash, created_at);
