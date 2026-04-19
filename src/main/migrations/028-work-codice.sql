ALTER TABLE work ADD COLUMN codice TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_codice ON work (codice) WHERE codice IS NOT NULL;
