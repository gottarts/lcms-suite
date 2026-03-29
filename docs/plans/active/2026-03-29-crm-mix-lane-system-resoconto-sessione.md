# Resoconto sessione — CRM Mix: lane system per mix sovrapposti

**Data:** 2026-03-29
**Oggetto:** Gestione mix CRM con analiti in comune — sub-colonne dinamiche (lane system) nella griglia Schema Calibrazione

---

## Cosa è stato fatto

Refactor completo del sistema di visualizzazione CRM Mix nello Schema Calibrazione per supportare il caso in cui più mix commerciali contengono gli stessi analiti (composizioni sovrapposte).

Il modello precedente (`AnalitoItem.mixId: string | null`) assumeva un solo mix per analita. Il nuovo modello (`mixIds: string[]`) è many-to-many.

La griglia ora calcola dinamicamente quante "corsie" (sub-colonne) servono nella colonna CRM Mix, mostra ogni mix nella sua corsia con larghezza fissa 270px, e permette lo scorrimento orizzontale quando servono più corsie.

---

## Feature aggiunte

### `AnalitoItem.mixIds: string[]` — modello many-to-many

**Motivazione:** Un analita può comparire in più mix commerciali diversi. Il campo singolo `mixId` ignorava silenziosamente tutti i mix oltre il primo.

**Implementazione:**
- `SchemaCalibrazione.types.ts`: `mixId: string | null` → `mixIds: string[]`, aggiunto tipo `MixFragment`
- `SchemaCalibrazione.logic.ts`: `mixMap` (1:1) → `mixesMap` (1:N); costruzione `AnalitoItem` e ordinamento aggiornati
- `SchemaCalibrazione.tsx`: unico riferimento `a.mixId` aggiornato a `a.mixIds`

### Lane assignment — sub-colonne dinamiche

**Motivazione:** Con mix sovrapposti, le card mix si sovrapporrebbero nella stessa colonna. Serve un sistema che assegni corsie separate mantenendo ogni mix nella stessa corsia per tutti i suoi frammenti.

**Implementazione (`computeMixFragmentsAndLanes` in logic.ts):**
1. Per ogni mix, calcola i "frammenti" (blocchi contigui di righe nella griglia)
2. Assegnazione corsie **per mix** (non per frammento): cerca la prima corsia dove *tutti* i frammenti del mix entrano senza sovrapporsi con niente già occupato — usa `laneIntervals: Array<{start, end}[]>` per tracciare le occupazioni
3. Restituisce `fragments: MixFragment[]` con `lane` e `isFirst` già calcolati, e `totalLanes`

Il vincolo chiave: un mix deve stare *tutto* nella stessa corsia per evitare che i frammenti si disallineino.

### Rendering lane-aware con scorrimento orizzontale

**Implementazione (`SchemaCalibrazione.grid.tsx`):**
- `LANE_W = 270` fisso (non compresso) — la colonna si allarga
- Header "CRM Mix": `270 * totalLanes`
- Placeholder righe: `270 * totalLanes`
- `overflowX: 'auto'` sul body → scorrimento orizzontale automatico
- Card posizionate con `left: frag.lane * 270 + 8`
- Frammenti non-primi mostrano il nome del mix a opacity ridotta
- Chip analiti mostrati solo se `heightPx > 60`

### Connettori SVG tra frammenti — colore + offset per mix diversi nella stessa corsia

**Motivazione:** Con più mix nella stessa corsia, le linee tratteggiate si sovrapponevano (stesso colore, stesso x).

**Implementazione:**
- Palette di 8 colori distinti per i connettori
- Ogni mix ha il suo colore assegnato per indice
- X offset proporzionale entro la corsia: se N mix hanno connettori nella stessa corsia, le linee stanno a `1/(N+1)`, `2/(N+1)`, ... della larghezza

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | `AnalitoItem.mixId → mixIds[]`, aggiunto `MixFragment` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `mixMap → mixesMap`, aggiornato `AnalitoItem`, aggiunta `computeMixFragmentsAndLanes` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Lane rendering, scorrimento orizzontale, SVG connettori con colore/offset |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Riga 856: `a.mixId → a.mixIds` |

---

## Note per sessioni future

- **TODO aperto:** L'ordine di assegnazione delle corsie è per posizione verticale (topPx del primo frammento). L'utente ha segnalato di voler eventualmente ordinare per numero di analiti decrescente (mix con più analiti → corsia 0). Da valutare se necessario in produzione.
- **Caso base garantito:** se `totalLanes === 1` (nessun overlap), il rendering è identico a prima — nessuna regressione visiva.
- **Errore TS preesistente** in `salvaWorkNelDb` (riga ~267, `flatMap` con tipi incompatibili) — non introdotto da questa sessione, da gestire separatamente.
- Il piano dettagliato di questa sessione è in `docs/plans/active/2026-03-29-crm-mix-lane-system-plan.md`.
