-- Migration 020: aggiunge colonna prep_id in work_ingredienti e aggiorna
-- il CHECK constraint source_type per supportare 'prep' (preparazione stock da CRM Neat).
-- La ricreazione della tabella è necessaria perché SQLite non supporta ALTER COLUMN.
-- foreign_keys viene disabilitato/riabilitato da db.ts prima/dopo db.exec().

DROP TABLE IF EXISTS work_ingredienti_new;

CREATE TABLE work_ingredienti_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id             INTEGER REFERENCES work(id) ON DELETE CASCADE,
  source_type         TEXT NOT NULL CHECK (source_type IN ('crm', 'work', 'prep')),
  source_id           INTEGER NOT NULL,
  volume_prelievo_ml  REAL,
  fattore_diluizione  REAL,
  conc_target_mgL     REAL,
  modo_calcolo        TEXT CHECK (modo_calcolo IN ('conc', 'dil')),
  lotto_usato         TEXT,
  prep_id             INTEGER REFERENCES preparazioni(id)
);

INSERT INTO work_ingredienti_new
  SELECT id, work_id, source_type, source_id, volume_prelievo_ml,
         fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato, NULL
  FROM work_ingredienti;

DROP TABLE work_ingredienti;

ALTER TABLE work_ingredienti_new RENAME TO work_ingredienti;

CREATE INDEX IF NOT EXISTS idx_work_ingredienti_work   ON work_ingredienti(work_id);
CREATE INDEX IF NOT EXISTS idx_work_ingredienti_source ON work_ingredienti(source_id, source_type);
