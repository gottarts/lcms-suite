-- Migration 019: aggiunge colonna prep_id in work_ingredienti per supportare
-- source_type = 'prep' (preparazione stock da CRM Neat)
ALTER TABLE work_ingredienti ADD COLUMN prep_id INTEGER REFERENCES preparazioni(id);
