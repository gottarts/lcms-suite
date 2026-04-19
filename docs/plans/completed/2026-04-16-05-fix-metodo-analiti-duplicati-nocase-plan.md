# Piano: Fix duplicati parametri metodo da composti

## Context

Quando si aggiunge un composto al DB Composti (con metodo associato) — tramite "Nuovo composto", import CSV, o "Aggiungi Mix" — il backend inserisce il nome del composto come parametro in `metodo_analiti`. Si verificano duplicati perché:

1. La migration `016-metodo-analiti.sql` ha popolato `metodo_analiti` da `composti.nome` **senza normalizzare in uppercase**, quindi nei DB esistenti potrebbero esserci nomi con case misto (es. `"Paraquat"`)
2. Tutti i percorsi IPC (`composti:create`, `composti:update`, `metodo-analiti:add`, ecc.) inseriscono in **UPPERCASE** (es. `"PARAQUAT"`)
3. La UNIQUE constraint `UNIQUE(metodo_id, nome)` in SQLite è **case-sensitive** (BINARY collation di default): `"Paraquat"` ≠ `"PARAQUAT"`, quindi l'INSERT OR IGNORE non blocca il duplicato
4. `composti:create-mix` (riga 615) inserisce `comp.nome` **senza `.toUpperCase()`** — unico percorso non normalizzato

In pratica: se nella tabella esiste `"Paraquat"` e si aggiunge un composto con nome `"Paraquat"`, viene inserito `"PARAQUAT"` → 2 righe distinte per la UNIQUE constraint case-sensitive → duplicato visibile in MetodiPage.

## Soluzione

### Step 1 — Migration SQL: normalizzare in UPPERCASE + ricreare UNIQUE con COLLATE NOCASE

File da creare: `src/main/migrations/024-metodo-analiti-nocase.sql`

La migration deve:
1. Eliminare le righe duplicate case-insensitive (tenere quella con id più basso)
2. Normalizzare tutti i nomi esistenti in UPPERCASE
3. Ricreare la tabella con `nome TEXT NOT NULL COLLATE NOCASE` — così la UNIQUE constraint diventa case-insensitive permanentemente

```sql
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
```

Con `COLLATE NOCASE` sulla colonna, la UNIQUE constraint diventa case-insensitive: "paraquat", "Paraquat", "PARAQUAT" sono tutti lo stesso valore e l'INSERT OR IGNORE funzionerà correttamente in tutti i percorsi.

### Step 2 — Fix in composti.ipc.ts: normalizzare nome in create-mix

File: `src/main/ipc/composti.ipc.ts`, riga 615

Cambiare:
```typescript
insertAnalitaMix.run(mid, comp.nome)
```
In:
```typescript
insertAnalitaMix.run(mid, comp.nome.toUpperCase())
```

Questo allinea `create-mix` agli altri percorsi che già usano `.toUpperCase()`.

## File critici

- `src/main/migrations/016-metodo-analiti.sql` — schema originale + popolazione senza uppercase
- `src/main/migrations/023-sessions.sql` — migration più recente (usare 024 per la nuova)
- `src/main/ipc/composti.ipc.ts` — riga 615 (create-mix senza uppercase); righe 252, 431, 444 già uppercase
- `src/main/ipc/metodi.ipc.ts` — righe 61, 116, 201 già ok
- `src/main/ipc/metodo-analiti.ipc.ts` — riga 68 già ok

## Cosa NON cambia

- La logica applicativa nei vari IPC handlers non va modificata (INSERT OR IGNORE già presenti)
- Non si toccano i file frontend (MetodiPage, ParametriMetodoPage, ecc.)
- La deduplication è gestita interamente a livello DB

## Verifica

1. Creare un composto CRM "Paraquat" associato a un metodo → parametro appare come "PARAQUAT" (uno solo)
2. Creare secondo composto "PARAQUAT" stesso metodo → nessun duplicato in MetodiPage
3. Creare Mix con componente "paraquat" su metodo che ha già "PARAQUAT" → nessun duplicato
4. Aggiungere manualmente "paraquat" a metodo con "PARAQUAT" → nessun duplicato
5. Import CSV con "Paraquat" su metodo con "PARAQUAT" già presente → nessun duplicato
