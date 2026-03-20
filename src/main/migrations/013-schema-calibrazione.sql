CREATE TABLE IF NOT EXISTS schema_calibrazione (
  metodo_id   TEXT PRIMARY KEY REFERENCES metodi(id) ON DELETE CASCADE,
  schema_json TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);
