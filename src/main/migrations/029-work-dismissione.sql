-- Aggiungi campi per dismissione delle work, separato da archiviazione ricetta
ALTER TABLE work ADD COLUMN data_dismissione TEXT;
ALTER TABLE work ADD COLUMN motivo_dismissione TEXT;

CREATE INDEX IF NOT EXISTS idx_work_dismissione ON work (data_dismissione) WHERE data_dismissione IS NOT NULL;
