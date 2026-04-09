# Piano: Progressivo preparazione nelle card e nei drawer

## Context

Nei work con ingredienti `source_type='prep'`, la card nella griglia e i drawer mostrano il flacone (volume mL) come identificatore della preparazione. Questo non è un codice discriminatorio: due preparazioni dello stesso CRM Neat possono avere lo stesso volume. Serve aggiungere un numero progressivo (`#N`) per identificare univocamente ogni prep stock, calcolato come `ROW_NUMBER() OVER (PARTITION BY composto_id ORDER BY id)`.

Il testo attuale:
- Card griglia: `prep {flacone} da lotto {crm.lotto} · Neat`
- Drawer SchemaCalibrazione: `prep {flacone} da lotto {lotto} · Neat`
- Drawer WorkDrawer: `prep {flacone} da lotto {lotto} · Neat`

Il testo obiettivo:
- `prep #N da lotto {crm.lotto} · Neat`  (il flacone rimane come info secondaria se utile)

---

## File critici da modificare

1. `src/main/ipc/preparazioni.ipc.ts` (handler `preparazioni:list-for-schema`)
2. `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` (interfaccia `PrepStockItem`)
3. `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` (mapping PrepStockItem)
4. `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` (card chip + callback)
5. `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (togglePrepStock + drawer)
6. `src/renderer/pages/work/WorkDrawer.tsx` (buildWorkSchema + rendering)

---

## Passi di implementazione

### 1. preparazioni.ipc.ts — aggiungere `progressivo`

Nella query `preparazioni:list-for-schema`, aggiungere `ROW_NUMBER()`:

```sql
SELECT id, flacone, concentrazione, concentrazione_reale, concentrazione_target, unita_conc,
       scadenza, data_dismissione,
       ROW_NUMBER() OVER (PARTITION BY composto_id ORDER BY id) AS progressivo
FROM preparazioni
WHERE composto_id = ?
  AND data_dismissione IS NULL
  AND (scadenza IS NULL OR scadenza >= ?)
ORDER BY data_prep DESC
```

### 2. SchemaCalibrazione.types.ts — aggiungere campo a PrepStockItem

Aggiungere `progressivo: number | null` a `PrepStockItem`.

Aggiungere `progressivo?: number | null` a `SorgenteSel`.

### 3. SchemaCalibrazione.logic.ts — propagare nel mapping

Nel loop che mappa le righe raw in `PrepStockItem`:
```typescript
progressivo: r.progressivo ?? null,
```

### 4. SchemaCalibrazione.grid.tsx — callback e card chip

Callback `onTogglePrepStock`: aggiungere parametro `progressivo: number | null`.

Card chip: cambiare testo da `prep ${prep.flacone}` a `prep #${prep.progressivo ?? '?'}`.

Nel `onClick`: passare `prep.progressivo ?? null` al callback.

### 5. SchemaCalibrazione.tsx — togglePrepStock e drawer

`togglePrepStock`: aggiungere parametro `progressivo: number | null`, salvarlo in `SorgenteSel`.

Drawer testo: cambiare da `prep${src.flacone ? ` ${src.flacone}` : ''}` a `` `prep #${src.progressivo ?? '?'}` ``.

### 6. WorkDrawer.tsx — buildWorkSchema e rendering

In `buildWorkSchema`, aggiungere `progressivo: ing.source_progressivo ?? null` nella sorgente `prep`.

**Nota:** `source_progressivo` non esiste ancora in `work_ingredienti`. La colonna `progressivo` è calcolata al volo via ROW_NUMBER e non va persistita — è stabile perché basata sull'`id` (PRIMARY KEY crescente). 

Calcolo tramite COUNT subquery correlata (semplice, leggibile, compatibile SQLite):

```sql
CASE WHEN wi.source_type = 'prep'
     THEN (SELECT COUNT(*) FROM preparazioni p2
           WHERE p2.composto_id = prep_comp.composto_id
             AND p2.id <= COALESCE(wi.prep_id, wi.source_id))
     ELSE NULL END AS source_progressivo
```
dove `prep_comp` è l'alias JOIN della preparazione già esistente nella query `work:get`.

Rendering drawer WorkDrawer: cambiare da `prep${src.flacone ? ` ${src.flacone}` : ''}` a `` `prep #${src.progressivo ?? '?'}` ``.

---

## Verifica

1. Aprire uno schema di calibrazione con un CRM Neat che ha ≥2 preparazioni attive
2. Verificare che le card mostrino `prep #1`, `prep #2`, ecc.
3. Selezionare una prep e aprire il drawer in SchemaCalibrazione — verificare `prep #N da lotto ... · Neat`
4. Salvare il work, aprire WorkDrawer — verificare la stessa stringa `prep #N da lotto ... · Neat`
5. Verificare che la catena di tracciabilità funzioni correttamente
