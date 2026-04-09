# Resoconto sessione — Fix tracciabilità preparazioni Neat: progressivo e altezza chip griglia

**Data:** 2026-04-09
**Oggetto:** Aggiunta del numero progressivo (#N) alle prep stock Neat, fix aggregazione analiti duplicati nel drawer, fix altezza righe griglia SchemaCalibrazione

---

## Cosa è stato fatto

- Aggiunto numero progressivo (`prep #N`) per identificare univocamente ogni preparazione stock di un CRM Neat, sostituendo il campo `flacone` (volume mL) che non era discriminatorio
- Risolto bug per cui analiti uguali provenienti da sorgenti diverse apparivano duplicati nel drawer invece di essere sommati
- Risolto problema di altezza righe nella griglia: chip schiacciate perché `ROW=48` era insufficiente e il calcolo `sngCardH` non includeva padding cella e margine respiro

---

## Bug risolti / Feature aggiunte

### Progressivo prep stock Neat (#N)
**Root cause / Motivazione:** Il campo `flacone` (volume in mL) non identifica univocamente una preparazione — due prep dello stesso CRM possono avere lo stesso volume. Serviva un identificatore stabile e ordinale.

**Fix / Implementazione:**
- `preparazioni:list-for-schema`: aggiunta subquery `COUNT(*)` con alias esplicito `p` per calcolare il progressivo (numero d'ordine per `composto_id` basato su `id` crescente). L'alias esplicito era necessario per evitare ambiguità SQLite nella subquery correlata (senza alias mostrava `#?`).
- `work:get`: aggiunto `source_progressivo` via COUNT subquery correlata, calcolato al volo senza persistere in DB (stabile perché basato su PK crescente).
- Propagato attraverso: `PrepStockItem.progressivo`, `SorgenteSel.progressivo`, mapping in `logic.ts`, callback `onTogglePrepStock`, `togglePrepStock`, `buildWorkSchema` in WorkDrawer.
- Testo risultante: `prep #N da lotto {lotto} · Neat` in card griglia, drawer SchemaCalibrazione, drawer WorkDrawer.

### Analiti duplicati nel drawer (composizione work)
**Root cause:** `getCompsFromWork` in `SchemaCalibrazione.logic.ts` accumulava tutti i composti in un array senza deduplicazione. Se lo stesso analita proveniva da due sorgenti diverse, appariva due volte.

**Fix:** Aggiunta aggregazione per nome (case-insensitive) con `Map` prima del `return result`: somma `concInWork` e concatena `srcPath` distinti con `, `.

### Altezza righe griglia schiacciata
**Root cause:** Tre problemi sovrapposti:
1. `ROW = 48` insufficiente: una chip Solution tipica (lotto + scadenza) è già 50px + 6px padding cella = 56px.
2. `sngCardH` per chip non-Neat non includeva padding cella (`+6`) né margine respiro (`+8`).
3. `sngCardH` per chip Neat idem.
4. La condizione di altezza riga della chip Neat usava `p.flacone` (spesso null) invece di `p.progressivo != null || crm.lotto`.

**Fix:**
- `ROW` alzato da 48 a 62px.
- `sngCardH` non-Neat: aggiunto `+ 6 + 8` (padding cella + respiro).
- `sngCardH` Neat: aggiunto `+ 6 + 8`, ricalcolato con costanti esplicite (`GAP=6`, `PADDING_V=14`), corretto gap da per-chip a per-figlio-flex.
- Chip Neat nel JSX: `padding` contenitore `5px→7px`, `gap` `4→6`, chip singola `padding` `4px→6px`.
- Condizione visibilità riga progressivo: `p.progressivo != null || crm.lotto` (allineata al rendering).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/preparazioni.ipc.ts` | Aggiunto `progressivo` (COUNT subquery) a `preparazioni:list-for-schema`; alias esplicito `p` sulla tabella |
| `src/main/ipc/work.ipc.ts` | Aggiunto `source_progressivo` (COUNT subquery) a `work:get` |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | `PrepStockItem.progressivo: number \| null`; `SorgenteSel.progressivo?: number \| null` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Mapping `r.progressivo`; aggregazione per nome in `getCompsFromWork` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Callback con `progressivo`, chip testo `prep #N`, fix `sngCardH` completo, `ROW=62`, padding/gap chip Neat |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `togglePrepStock` con `progressivo`, drawer testo `prep #N` |
| `src/renderer/pages/work/WorkDrawer.tsx` | `buildWorkSchema` con `progressivo`, drawer testo `prep #N` |

---

## Note per sessioni future

- Il progressivo è calcolato al volo via COUNT e non persiste in DB: è stabile finché le prep non vengono cancellate fisicamente (ma vengono solo dismesse). Se in futuro si aggiunge la cancellazione fisica di prep, il progressivo potrebbe cambiare per le prep successive.
- Il calcolo `sngCardH` è ancora manuale e fragile: qualsiasi modifica ai padding/font nel JSX deve essere rispecchiata nella funzione. Considerare in futuro un approccio con `ResizeObserver` per misurare l'altezza reale delle celle dopo il render.
- Il piano di questa sessione è in `docs/plans/active/2026-04-09-03-fix-tracciabilita-prep-neat-progressivo-plan.md`.
