CREATE TABLE IF NOT EXISTS work (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  concentrazione  REAL,
  conc_variabile  INTEGER DEFAULT 0,
  unita_conc      TEXT DEFAULT 'mg/L',
  volume_ml       REAL,
  solvente        TEXT,
  validita_mesi   INTEGER,
  operatore       TEXT,
  note            TEXT,
  livello         INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_ingredienti (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id             INTEGER REFERENCES work(id) ON DELETE CASCADE,
  source_type         TEXT NOT NULL CHECK (source_type IN ('crm', 'work')),
  source_id           INTEGER NOT NULL,
  volume_prelievo_ml  REAL,
  fattore_diluizione  REAL,
  conc_target_mgL     REAL,
  modo_calcolo        TEXT CHECK (modo_calcolo IN ('conc', 'dil'))
);

CREATE TABLE IF NOT EXISTS work_metodi (
  work_id   INTEGER REFERENCES work(id) ON DELETE CASCADE,
  metodo_id TEXT    REFERENCES metodi(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, metodo_id)
);

CREATE INDEX IF NOT EXISTS idx_work_ingredienti_work   ON work_ingredienti(work_id);
CREATE INDEX IF NOT EXISTS idx_work_ingredienti_source ON work_ingredienti(source_id, source_type);