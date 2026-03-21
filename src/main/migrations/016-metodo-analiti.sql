CREATE TABLE IF NOT EXISTS metodo_analiti (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  metodo_id TEXT    NOT NULL REFERENCES metodi(id) ON DELETE CASCADE,
  nome      TEXT    NOT NULL,
  ordine    INTEGER,
  UNIQUE(metodo_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_metodo_analiti_metodo ON metodo_analiti(metodo_id);

-- Migrazione dati esistenti: popola metodo_analiti dai composti attualmente collegati
-- Usa DISTINCT su nome per eliminare duplicati di lotto
INSERT OR IGNORE INTO metodo_analiti (metodo_id, nome)
SELECT DISTINCT cm.metodo_id, c.nome
FROM composti_metodi cm
JOIN composti c ON c.id = cm.composto_id;
