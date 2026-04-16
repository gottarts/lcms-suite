-- Rimuove duplicati case-insensitive già presenti (mantiene il primo per id)
DELETE FROM metodo_analiti
WHERE id NOT IN (
  SELECT MIN(id) FROM metodo_analiti GROUP BY metodo_id, LOWER(nome)
);

-- Normalizza tutti i nomi esistenti in UPPERCASE
UPDATE metodo_analiti SET nome = UPPER(nome);

-- Ricrea la tabella con COLLATE NOCASE sulla colonna nome
-- (rende la UNIQUE constraint automaticamente case-insensitive)
CREATE TABLE metodo_analiti_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  metodo_id        TEXT    NOT NULL REFERENCES metodi(id) ON DELETE CASCADE,
  nome             TEXT    NOT NULL COLLATE NOCASE,
  ordine           INTEGER,
  accreditato      INTEGER NOT NULL DEFAULT 0,
  alias_strumento  TEXT,
  alias_lims       TEXT,
  alias_oqlab      TEXT,
  UNIQUE(metodo_id, nome)
);

INSERT INTO metodo_analiti_new
  SELECT id, metodo_id, nome, ordine, accreditato, alias_strumento, alias_lims, alias_oqlab
  FROM metodo_analiti;

DROP TABLE metodo_analiti;
ALTER TABLE metodo_analiti_new RENAME TO metodo_analiti;

CREATE INDEX IF NOT EXISTS idx_metodo_analiti_metodo ON metodo_analiti(metodo_id);
