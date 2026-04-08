# Piano: Fix CHECK constraint source_type in work_ingredienti

## Context

Il bug: le work create da SchemaCalibrazione con ingredienti `source_type = 'prep'` non vengono salvate.

**Root cause confermata:** La migration `019-work-ingredienti-prep.sql` aggiunge la colonna `prep_id` alla tabella `work_ingredienti`, ma **non aggiorna il CHECK constraint** che ancora limita `source_type` a `('crm', 'work')`. Quando l'handler `work:create` esegue `insertIngrPrep` con `source_type = 'prep'`, SQLite lancia una `CHECK constraint failed` exception — la transazione intera va in rollback silenzioso e la work non viene salvata.

Il codice in `work.ipc.ts` (il fix della sessione precedente con `insertIngr`/`insertIngrPrep` separati) è corretto. Il problema è esclusivamente nel DB schema.

## Soluzione: Migration 020

SQLite non supporta `ALTER TABLE ... DROP CONSTRAINT` né `ALTER TABLE ... MODIFY COLUMN`. L'unico modo per modificare un CHECK constraint è ricreare la tabella.

**File da creare:** `src/main/migrations/020-work-ingredienti-source-type-prep.sql`

```sql
-- Migration 020: aggiorna CHECK constraint source_type in work_ingredienti
-- per permettere 'prep' oltre a 'crm' e 'work'

PRAGMA foreign_keys = OFF;

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
         fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato, prep_id
  FROM work_ingredienti;

DROP TABLE work_ingredienti;

ALTER TABLE work_ingredienti_new RENAME TO work_ingredienti;

CREATE INDEX IF NOT EXISTS idx_work_ingredienti_work   ON work_ingredienti(work_id);
CREATE INDEX IF NOT EXISTS idx_work_ingredienti_source ON work_ingredienti(source_id, source_type);

PRAGMA foreign_keys = ON;
```

## File coinvolti

- **Crea:** `src/main/migrations/020-work-ingredienti-source-type-prep.sql`
- **Nessun'altra modifica** — il codice in `work.ipc.ts` è già corretto.

## Verifica

1. Riavviare l'app (la migration `020` gira automaticamente via `runMigrations()` in `db.ts`)
2. Aprire SchemaCalibrazione, configurare uno schema con sorgenti prep stock Neat
3. Salvare una work → deve apparire nella pagina Work con tutti gli ingredienti
4. Verificare che le work esistenti (crm/work normali) non siano state danneggiate
