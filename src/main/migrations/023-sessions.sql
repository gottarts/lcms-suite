CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT PRIMARY KEY,
  hostname  TEXT NOT NULL,
  last_seen INTEGER NOT NULL  -- Unix timestamp in secondi
);
