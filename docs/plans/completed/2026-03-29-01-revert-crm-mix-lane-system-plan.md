# Piano: Semplificazione CRM Mix — rimozione gestione miscele a composizione diversa

## Contesto

Nelle ultime sessioni è stato implementato un sistema a "corsie" (lane) per gestire miscele CRM con composizione diversa (mix sovrapposti che condividono analiti). Questo sistema aggiunge:
- Multi-lane con colonne dinamiche che si allargano
- Colori diversi per ogni mix (`CONN_COLORS`)
- Linee tratteggiate SVG tra frammenti non contigui dello stesso mix
- Bordi colorati per distinguere i mix diversi
- `computeMixFragmentsAndLanes()` in logic.ts

L'utente vuole tornare a qualcosa di più semplice: **una sola composizione per schema, ma con la possibilità di avere più lotti (colonne) della stessa miscela.** Tutto il codice legato a mix a composizione diversa va rimosso.

## Cosa eliminare

### `SchemaCalibrazione.logic.ts`
- Rimuovere tutta la funzione `computeMixFragmentsAndLanes()` (righe 460–565)
- Rimuovere il tipo `MixFragment` dall'import (il tipo rimane nei types per ora, o si rimuove)

### `SchemaCalibrazione.types.ts`
- Rimuovere l'interfaccia `MixFragment` (righe 68–74) — non più usata

### `SchemaCalibrazione.grid.tsx`
- Rimuovere import di `computeMixFragmentsAndLanes` (riga 15)
- Rimuovere `CONN_COLORS` array (righe 18–21)
- Rimuovere tutto il blocco lane assignment (righe 187–206):
  - `computeMixFragmentsAndLanes(...)` call
  - `LANE_W` costante
  - `fragmentsByMix` map
  - `fragColorIdx` map
- Nell'header: rimpiazzare `270 * totalLanes` con `270` fisso
- Nel placeholder mix: rimpiazzare `270 * totalLanes` con `270` fisso
- Nel container blocchi mix assoluto: rimpiazzare `LANE_W * Math.min(totalLanes, 4)` con `254`
- **Rendere il rendering mix semplice**: invece del sistema a frammenti, renderizzare un solo blocco per mix (il blocco che copre tutte le righe del mix, anche non contigue — ma siccome ora c'è un solo mix per analita, ogni analita ha al massimo `mixIds[0]`)

## Approccio semplificato per i blocchi mix

**Attuale**: sistema a frammenti con lane, posizioni assolute, connettori SVG, colori multipli.

**Target**: un blocco mix per ogni mix_id, posizione assoluta nella colonna (stesso approccio di prima del lane system). Il blocco copre dall'analita più alto all'analita più basso di quel mix (come faceva prima, senza frammenti multipli e senza linee tratteggiate).

### Algoritmo semplificato:
```
Per ogni mix_id distinto:
  - Trova primo e ultimo indice riga che contiene questo mix
  - top = rowTops[firstIdx]
  - height = rowTops[lastIdx] + rowHeights[lastIdx] - rowTops[firstIdx]
  - Renderizza un singolo blocco assoluto (left=8, width=254)
  - Colore bordo: sempre C.mix.border (nessun CONN_COLORS)
```

Questo lascia intatto il supporto per più lotti dello stesso mix (più mix_id diversi in mixIds[] di un analita) — ma per ora siccome l'utente vuole "solo la stessa composizione", possiamo gestirlo mostrando comunque un blocco unico per il primo mix_id di ogni analita. Se ci sono più mix_id, si mostra solo il primo (o entrambi in colonne separate — vedere nota sotto).

> **Nota**: L'utente dice "lascia la possibilità di avere miscele di lotti diversi in più colonne". Questo vuol dire: stesso mix commerciale, lotti diversi → due colonne affiancate nella colonna CRM Mix. Questo è un caso molto più semplice: stessa composizione ma `mix_id` diversi perché lotti diversi. Il sistema a colonne semplici (senza lane complesse) gestisce questo già naturalmente mostrando N blocchi affiancati, uno per `mix_id`. Il piano è di **mantenere una versione semplificata del lane system** (senza colori multipli, senza linee SVG, senza frammenti non contigui) che mostra tanti blocchi affiancati quanti sono i mix_id distinti.

## Piano d'azione dettagliato

### 1. `SchemaCalibrazione.types.ts`
- Rimuovere `MixFragment` interface

### 2. `SchemaCalibrazione.logic.ts`
- Rimuovere import di `MixFragment`
- Rimuovere funzione `computeMixFragmentsAndLanes()`

### 3. `SchemaCalibrazione.grid.tsx` — riscrivere il rendering mix

**Rimuovere:**
- Import `computeMixFragmentsAndLanes`
- `CONN_COLORS` array
- Calcolo lane assignment (fragsByMix, fragColorIdx, fragments, totalLanes, LANE_W)
- L'intero blocco `{/* Blocchi Mix in position:absolute — lane system */}` con SVG connectors

**Introdurre:**
- Una versione semplice: calcola per ogni `mix_id` distinto il range di righe [firstRow, lastRow] → top/height
- N blocchi affiancati (uno per `mix_id`), larghezza fissa 254px, senza CONN_COLORS
- La larghezza della colonna CRM Mix diventa `270 * nMixIds` dove `nMixIds` = numero di mix_id distinti
- Bordo: sempre `C.mix.border` (nessun colore dinamico)
- Nessuna linea SVG tratteggiata

**Il rendering di ogni blocco mix** rimane uguale all'attuale rendering del "primo frammento" (nome, produttore, lotto, cv, scadenza, chips) — senza logica `isFirst/isNotFirst`.

### File critici
- [SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts)
- [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts)
- [SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx)

## Verifica
1. Avviare l'app in dev
2. Aprire uno schema di calibrazione con un mix
3. Verificare: colonna CRM Mix mostra il blocco mix normalmente, nessun colore extra, nessuna linea tratteggiata
4. Se ci sono più lotti dello stesso mix: verificare che appaiano N blocchi affiancati (larghezza adattiva)
5. Verificare che la selezione del mix funzioni (click → toggle)
6. Verificare che le connessioni SVG sorgente→work (le frecce, non i connettori tra frammenti) funzionino ancora
