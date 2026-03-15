# Resoconto Sessione — 2026-03-15 (pomeriggio)

**Branch:** `master`
**DB user_version:** 10 (migration 010 aggiunta)

---

## Obiettivo della sessione

Ottimizzazione performance del modulo Reference Standards, che con ~2000 composti
risultava lento sia al caricamento iniziale (~loading percepibile) sia all'apertura
del pannello laterale (~2-3 secondi di latenza).

---

## Interventi eseguiti

### PERF-1 — Query `composti:list` riscritta ✅

**File:** `src/main/ipc/composti.ipc.ts`

**Causa:** la query originale usava due `LEFT JOIN` su `preparazioni` e `composti_storia`
seguiti da `GROUP BY c.id`. Con 2000 composti, ogni composto con N preparazioni e M
eventi storia produceva un prodotto cartesiano N×M di righe intermedie prima
dell'aggregazione — complessità effettiva O(N²).

**Fix:** sostituiti i `LEFT JOIN` con 5 subquery scalari correlate, una per ciascun
valore aggregato. SQLite ottimizza le subquery correlate su colonna indicizzata (PK)
con una index scan per subquery — complessità O(N log N).
Rimosso il `GROUP BY c.id` (non più necessario).

**Prima:**
```sql
SELECT c.*,
  COUNT(CASE WHEN p.stato = 'Attiva' THEN 1 END) AS prep_attive_count,
  ...
FROM composti c
LEFT JOIN preparazioni p ON p.composto_id = c.id
LEFT JOIN composti_storia cs ON cs.composto_id = c.id
GROUP BY c.id
```

**Dopo:**
```sql
SELECT c.*,
  (SELECT COUNT(*) FROM preparazioni
   WHERE composto_id = c.id AND stato = 'Attiva') AS prep_attive_count,
  ...
FROM composti c
```

---

### PERF-2 — Migration 010: indici su `composto_id` ✅

**File:** `src/main/migrations/010-perf-indexes.sql`

Aggiunti 3 indici sulle colonne `composto_id` delle tabelle correlate,
che coprono tutte le 5 subquery introdotte in PERF-1.
SQLite li applica automaticamente — nessuna modifica al codice applicativo.

```sql
CREATE INDEX IF NOT EXISTS idx_prep_composto_id   ON preparazioni(composto_id);
CREATE INDEX IF NOT EXISTS idx_storia_composto_id ON composti_storia(composto_id);
CREATE INDEX IF NOT EXISTS idx_metodi_cm_composto ON composti_metodi(composto_id);
```

La migration viene applicata automaticamente da `runMigrations()` al primo avvio
dopo l'aggiornamento (confronto `010 > user_version attuale`).

---

### PERF-3 — `CompostiTable`: memo + useMemo su columns ✅

**File:** `src/renderer/pages/composti/CompostiTable.tsx`

**Causa:** ogni volta che `setPanelId` cambiava stato in `CompostiPage`,
React re-renderizzava l'intero albero inclusa `CompostiTable` con 2000 righe,
bloccando il thread UI per 2-3 secondi prima che il pannello apparisse.

**Fix 1:** `export const CompostiTable = memo(...)` — il componente salta
il re-render se le props non sono cambiate.

**Fix 2:** `columns` spostato dentro `useMemo([...deps])` — la definizione
delle colonne non veniva ricreata ad ogni render, permettendo a `memo` di
fare confronto stabile sulle props.

---

### PERF-4 — `CompostiPage`: useCallback sugli handler ✅

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

**Causa:** senza `useCallback`, tutte le funzioni passate come props a
`CompostiTable` venivano ricreate ad ogni render — `memo` su `CompostiTable`
le vedeva come props cambiate e re-renderizzava comunque.

**Fix:** aggiunto `useCallback` su tutti gli handler passati a `CompostiTable`:

| Handler | Note |
|---------|------|
| `load` | Dipendenze: `[]` — stabile per tutta la vita del componente |
| `loadMetodi` | Dipendenze: `[]` |
| `handleRowClick` | Estratto dall'inline `row => { setPanelTab...; setPanelId... }` |
| `handleRivalida` | Dipendenze: `[]` |
| `handleDismetti` | Dipendenze: `[]` |
| `handleOpenStorico` | Dipendenze: `[]` |
| `handleOpenPreparazioni` | Dipendenze: `[]` |
| `handleNewLotto` | Dipendenze: `[]` |
| `handleEdit` | Dipendenze: `[]` |
| `handleRequestDelete` | Dipendenze: `[]` |
| `handleDelete` | Dipendenze: `[deleteId, deleteMixInfo, load]` |

---

### PERF-5 — `DataTable`: virtualizzazione con @tanstack/react-virtual ✅

**File:** `src/renderer/components/shared/DataTable.tsx`
**Dipendenza installata:** `@tanstack/react-virtual`

**Causa:** `DataTable` renderizzava tutte le righe nel DOM — con 2000 composti
il browser gestiva 2000 `<tr>` con badge, dropdown e FialeSelector,
causando paint e layout lenti ad ogni interazione.

**Fix:** virtualizzazione con `useVirtualizer`. Il DOM contiene ora solo le
~20 righe visibili + 10 di overscan (sopra e sotto). Le righe non visibili
sono simulate da due righe di padding (`<tr style={{ height: N }}>`) che
mantengono il comportamento della scrollbar identico all'originale.

**Dettagli implementativi:**
- `ROW_HEIGHT = 41px` — altezza fissa per riga (p-2 + border-b)
- `overscan = 10` — righe extra renderizzate fuori viewport per scroll fluido
- `VIRTUALIZE_THRESHOLD = 50` — sotto questa soglia usa rendering classico,
  senza overhead del virtualizer (tutte le altre tabelle del progetto non subiscono modifiche)
- Header `sticky top-0` — rimane visibile durante lo scroll
- `maxHeight: 75vh` — altezza massima del contenitore scrollabile
- Aspetto visivo e comportamento identici all'originale

**Prima:** 2000 `<tr>` nel DOM
**Dopo:** ~30 `<tr>` nel DOM

---

## Stato Database

```
user_version = 10
```

Migration aggiunta: `010-perf-indexes.sql`

---

## File modificati

| File | Tipo |
|------|------|
| `src/main/ipc/composti.ipc.ts` | Modificato |
| `src/main/migrations/010-perf-indexes.sql` | **Nuovo** |
| `src/renderer/pages/composti/CompostiPage.tsx` | Modificato |
| `src/renderer/pages/composti/CompostiTable.tsx` | Modificato |
| `src/renderer/components/shared/DataTable.tsx` | Modificato |

---

## Git

```bash
git add src/main/ipc/composti.ipc.ts
git add src/main/migrations/010-perf-indexes.sql
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/renderer/pages/composti/CompostiTable.tsx
git add src/renderer/components/shared/DataTable.tsx

git commit -m "perf: virtualizzazione tabella, memo+useCallback su Composti, query list riscritta senza JOIN"
```