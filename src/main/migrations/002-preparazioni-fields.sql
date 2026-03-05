ALTER TABLE preparazioni ADD COLUMN forma TEXT;
ALTER TABLE preparazioni ADD COLUMN stato TEXT DEFAULT 'Attiva';
ALTER TABLE preparazioni ADD COLUMN posizione TEXT;
ALTER TABLE preparazioni ADD COLUMN data_dismissione TEXT;
