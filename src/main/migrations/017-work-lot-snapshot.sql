-- Snapshot del lotto CRM al momento della creazione della work
ALTER TABLE work_ingredienti ADD COLUMN lotto_usato TEXT;

-- Soft-delete per work archiviate
ALTER TABLE work ADD COLUMN archiviato        INTEGER DEFAULT 0;
ALTER TABLE work ADD COLUMN archiviato_at     TEXT;
ALTER TABLE work ADD COLUMN archiviato_motivo TEXT;
ALTER TABLE work ADD COLUMN sostituito_da_id  INTEGER REFERENCES work(id);

CREATE INDEX IF NOT EXISTS idx_work_archiviato ON work(archiviato);
