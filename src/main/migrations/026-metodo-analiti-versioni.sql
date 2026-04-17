-- Tabella per il versionamento degli analiti di un metodo.
-- Ogni mutazione della lista analiti genera uno snapshot JSON completo,
-- usato dall'audit per ricostruire la lista attiva a una data passata.

CREATE TABLE IF NOT EXISTS metodo_analiti_versioni (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metodo_id   TEXT    NOT NULL REFERENCES metodi(id) ON DELETE CASCADE,
  snapshot    TEXT    NOT NULL,
  motivo      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mav_metodo_data
  ON metodo_analiti_versioni(metodo_id, created_at);

-- Seed iniziale: snapshot dello stato corrente per ogni metodo esistente
INSERT INTO metodo_analiti_versioni (metodo_id, snapshot, motivo, created_at)
SELECT
  ma_agg.metodo_id,
  ma_agg.snapshot,
  'migration-seed',
  COALESCE(m.updated_at, m.created_at, datetime('now'))
FROM (
  SELECT metodo_id,
    '[' || GROUP_CONCAT(
      json_object(
        'nome', nome,
        'ordine', ordine,
        'accreditato', accreditato,
        'alias_strumento', alias_strumento,
        'alias_lims', alias_lims,
        'alias_oqlab', alias_oqlab
      )
    ) || ']' AS snapshot
  FROM metodo_analiti
  GROUP BY metodo_id
) ma_agg
JOIN metodi m ON m.id = ma_agg.metodo_id;
