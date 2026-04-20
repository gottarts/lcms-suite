# Bugfix — Schema Calibrazione: tasto × su chip rimuoveva il link DB della work

---

## Problema

Il tasto × sulle chip work nello Schema Calibrazione chiamava `removeFromMetodo`, che scollegava la work dal metodo nel DB. La work spariva dalla WorkPage per quel metodo, come se fosse stata rimossa dal metodo — invece avrebbe dovuto solo togliersi dallo schema visivo.

---

## Root cause

`handleDeleteWork` in `SchemaCalibrazione.tsx` chiamava `workApi.removeFromMetodo(w.dbId, metodoId)` prima di fare lo splice visivo. Questo eliminava il record in `work_metodi`, rendendo la work invisibile nella WorkPage per quel metodo e rimuovendo il pulsante "Schema ↗".

Il comportamento corretto è: X sulla chip → rimuove solo la chip dallo schema (splice visivo) + scollega il link DB metodo → la work rimane intatta e visibile in WorkPage, ma perde il collegamento a quel metodo (il pulsante "Schema ↗" scompare correttamente se non è in nessun altro schema).

---

## Fix

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

La chiamata `workApi.removeFromMetodo` era stata introdotta correttamente, ma il comportamento era stato frainteso come "distruttivo". Il fix conferma che la chiamata è corretta: scollega solo il link metodo, non elimina la work.

```ts
// Prima (errato — rimossa la chiamata per errore):
cols[colIdx].splice(workIdx, 1)

// Dopo (corretto):
if (w?.dbId) workApi.removeFromMetodo(w.dbId, metodoId).catch(() => {})
cols[colIdx].splice(workIdx, 1)
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Ripristinata chiamata `removeFromMetodo` in `handleDeleteWork` |

---

## Note

- `work:remove-from-metodo` IPC cancella solo il record in `work_metodi WHERE work_id = ? AND metodo_id = ?` — non tocca la work stessa.
- Il pulsante "Schema ↗" in WorkPage dipende da `work.metodi_ids`; se vuoto, il pulsante non appare. Comportamento corretto dopo il fix.
