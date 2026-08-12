CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('游戏', '音乐', '生活', '吐槽')),
  text TEXT NOT NULL,
  link TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moment_media (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'poster')),
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moments_date ON moments(date DESC);

CREATE INDEX IF NOT EXISTS idx_moment_media_moment_order
ON moment_media(moment_id, sort_order);
