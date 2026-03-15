-- Migration: indici per ottimizzare composti:list
-- Applicare manualmente al DB di sviluppo e incrementare user_version:
--
--   sqlite3 /path/al/lcms.db < 00X-perf-indexes.sql
--
-- Oppure via PRAGMA in una riga:
--   sqlite3 /path/al/lcms.db "
--     CREATE INDEX IF NOT EXISTS idx_prep_composto_id     ON preparazioni(composto_id);
--     CREATE INDEX IF NOT EXISTS idx_storia_composto_id   ON composti_storia(composto_id);
--     CREATE INDEX IF NOT EXISTS idx_metodi_cm_composto   ON composti_metodi(composto_id);
--   "
--
-- Questi tre indici coprono le 5 subquery scalari introdotte nella query composti:list.
-- SQLite li usa automaticamente — nessuna modifica al codice applicativo necessaria.
-- IF NOT EXISTS garantisce idempotenza: sicuro da rieseguire.

CREATE INDEX IF NOT EXISTS idx_prep_composto_id   ON preparazioni(composto_id);
CREATE INDEX IF NOT EXISTS idx_storia_composto_id ON composti_storia(composto_id);
CREATE INDEX IF NOT EXISTS idx_metodi_cm_composto ON composti_metodi(composto_id);