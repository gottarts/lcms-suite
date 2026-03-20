CREATE TABLE IF NOT EXISTS work_preparazioni (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES work(id) ON DELETE CASCADE,
  data_prep  TEXT NOT NULL,
  note       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_preparazioni_work ON work_preparazioni(work_id);
