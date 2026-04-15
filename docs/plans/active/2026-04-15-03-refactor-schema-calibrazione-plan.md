# Piano: Bug fix + refactoring SchemaCalibrazione

## Context

La sezione SchemaCalibrazione (~3940 righe su 8 file) gestisce la composizione degli schemi di calibrazione con CRM. L'analisi ha rilevato 4 bug critici (tra cui un potenziale stack overflow e un'inconsistenza nel caricamento dati) e vari problemi di manutenibilità. Il piano prevede interventi chirurgici graduali, ciascuno lascia il codice funzionante.

---

## File critici

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (~1036 righe)
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` (~935 righe)
- `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` (~643 righe)
- `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` (~342 righe)
- `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` (~116 righe)

---

## FASE 1 — Bug critici (eseguire nell'ordine)

### Step 1.1 — `_greedyFill` e `_greedy`: splice su indice -1 *(rischio: molto basso)*

**File:** `SchemaCalibrazione.scenari.ts`

Sia `_greedy` (~riga 194) che `_greedyFill` (~riga 305) fanno:
```ts
rimanenti.splice(rimanenti.indexOf(bestComp), 1)
```
Se `indexOf` restituisce -1 (edge case futuro), `splice(-1, 1)` rimuove l'ultimo elemento per errore.

**Fix in entrambi i punti:**
```ts
const idx = rimanenti.indexOf(bestComp)
if (idx >= 0) rimanenti.splice(idx, 1)
```

**Verifica:** aprire dialog Scenari su un metodo con 3+ mix distinti → stessi scenari di prima, nessun errore in console.

---

### Step 1.2 — `getCompsFromWork`: ricorsione infinita senza protezione cicli *(rischio: molto basso)*

**File:** `SchemaCalibrazione.logic.ts` righe 320-372

La funzione si chiama ricorsivamente sulle work di tipo `'work'`. Se due work si referenziano a vicenda → stack overflow.

**Fix:** aggiungere parametro opzionale `visited: Set<string> = new Set()`:
```ts
export function getCompsFromWork(
  w: WorkInSchema,
  workCols: WorkInSchema[][],
  crmItems: CrmItem[],
  visited: Set<string> = new Set()
): CompostoInWork[] {
```
Nella chiamata ricorsiva (~riga 343):
```ts
if (!visited.has(srcWork.id)) {
  const nextVisited = new Set(visited)
  nextVisited.add(w.id)
  getCompsFromWork(srcWork, workCols, crmItems, nextVisited).forEach(sc =>
    result.push({ ...sc, concInWork: sc.concInWork * dilFactor })
  )
}
```
Il parametro è opzionale → tutte le chiamate esistenti in `grid.tsx` rimangono invariate.

**Verifica:** comportamento identico al normale (nessun ciclo in uso). Nel caso estremo non si blocca più.

---

### Step 1.3 — `removedMix`: caricamento senza validazione contro crmItems disponibili *(rischio: basso)*

**File:** `SchemaCalibrazione.tsx` righe 489-511 (useEffect di caricamento schema)

`removedMix` viene deserializzato da DB senza verificare che i `mix_id` esistano ancora in `crmItems`. Se un mix è stato dismesso dopo il salvataggio, rimangono `mix_id` fantasma che rompono le frecce SVG e le card.

**Fix:** filtrare al caricamento:
```ts
const mixIdDisponibili = new Set(
  crmItems.map(c => c.mix_id).filter((id): id is string => id != null)
)
const savedRemovedMix = new Set<string>(
  (saved?.removedMix ?? []).filter((mid: string) => mixIdDisponibili.has(mid))
)
```

**Verifica:**
1. Salvare schema con un mix selezionato.
2. Dismettere tutti i composti di quel mix dal pannello CRM.
3. Riaprire lo schema → nessuna card fantasma, frecce SVG integre.

---

### Step 1.4 — `blockedMap` useEffect: dipendenze stale *(rischio: basso-medio)*

**File:** `SchemaCalibrazione.tsx` righe 522-540

Il commento `// eslint-disable-next-line react-hooks/exhaustive-deps` nasconde che `workCols` manca dalle dipendenze. `blockedMap` può risultare stale dopo modifiche a `workCols`.

**Fix:** stabilizzare la dipendenza con `useMemo`:
```ts
// Prima del useEffect:
const workDbIds = useMemo(
  () => workCols.flatMap(col =>
    col.map(w => w.dbId).filter((id): id is number => id != null)
  ),
  [workCols]
)
```
Poi nel `useEffect`, sostituire `workCols.flat()` con `workDbIds` come array di id, e aggiornare le dipendenze a `[schemaLoaded, workDbIds]`. Rimuovere il commento `eslint-disable`.

**Verifica:** creare una Work → la barra avvisi (scadenza/blocco) si aggiorna subito, senza ricaricare la pagina.

---

## FASE 2 — Refactoring manutenibilità (ordine consigliato)

### Step 2.1 — Costanti layout in `grid.tsx` *(rischio: molto basso)*

**File:** `SchemaCalibrazione.grid.tsx` righe 103-191

I magic numbers `62`, `6`, `14`, `22`, `236`, `18` sono sparsi nelle funzioni `sngCardH`, `sngCellH`, `mixChipsH`. Aggiungere in cima al file:
```ts
const LAYOUT = {
  ROW_HEIGHT: 62,
  CHIP_GAP: 6,
  PADDING_V: 14,
  HEADER_H: 22,
  CHIP_AREA: 236,
  CHIP_ROW_H: 18,
  MIX_CARD_PAD: 20,
} as const
```
Sostituire le occorrenze inline con `LAYOUT.*`. Il comportamento è identico.

**Verifica:** visual check altezze righe griglia invariate.

---

### Step 2.2 — `useMemo` per le 7 mappe in `GrigliaAnalitiCrm` *(rischio: basso)*

**File:** `SchemaCalibrazione.grid.tsx` righe 54-101

Le sette mappe (`mixAnaliti`, `mixAllComps`, `mixInfo`, `mixCvSets`, `mixItemByNome`, `sngById`, `mixLottoSel`) vengono ricostruite ad ogni render. Aggiungere `useMemo` all'import React e avvolgerle con `[analiti, crmItems]` come dipendenze conservative.

**Verifica:** griglia risponde normalmente al toggle CRM, nessuna differenza visibile.

---

### Step 2.3 — Estrarre `buildSorgenteMix` per eliminare logica duplicata *(rischio: basso)*

**File:** `SchemaCalibrazione.logic.ts` + `SchemaCalibrazione.tsx`

La logica `crmItems.filter(c => c.mix_id === mixId)` + calcolo `cvSet` + costruzione `SorgenteSel` è duplicata in `toggleMix`, `handleApplyScenario`, `handleAutoSelect`.

**Fix:** aggiungere in `logic.ts`:
```ts
export function buildSorgenteMix(mixId: string, crmItems: CrmItem[]): SorgenteSel {
  const comps = crmItems.filter(c => c.mix_id === mixId)
  const crm = comps[0]
  const cvSet = new Set(comps.map(c => c.cv))
  return {
    id: mixId,
    nome: crm?.mix ?? mixId,
    cv: crm?.cv ?? 0,
    tipo: 'mix',
    concVariabile: cvSet.size > 1,
  }
}
```
Sostituire i 3 punti duplicati in `tsx` con `buildSorgenteMix(mixId, crmItems)`.

**Verifica:** toggle mix, auto-select, cambio lotto → comportamento identico.

---

### Step 2.4 — Decomporre `buildAnalitiData` (93 righe) *(rischio: medio)*

**File:** `SchemaCalibrazione.logic.ts` righe 25-118

Estrarre due funzioni private (non esportate) nello stesso file:
- `_buildMixMaps(itemsFiltrati)` → restituisce `mixNomiMap`, `mixFirma`, `firmaToMixIds`, `mixMap`, `mixIdsByNome`
- `_buildSngMaps(itemsFiltrati)` → restituisce `sngMap`, `isMap`

`buildAnalitiData` diventa un orchestratore. La firma pubblica e il valore di ritorno rimangono **identici**.

**Verifica:** la griglia analiti si mostra identica per tutti i valori di `filtroDestUso`.

---

### Step 2.5 — Raggruppare 5 dialog-useState in un oggetto *(rischio: medio)*

**File:** `SchemaCalibrazione.tsx` righe 389-405

I 5 useState per dialog (`importOpen`, `scenarOpen`, `autoSelectOpen`, `confirmReset`, `ricaricaSchemaWorkId`) si unificano:
```ts
const [dialogs, setDialogs] = useState({
  import: false,
  scenar: false,
  autoSelect: false,
  confirmReset: null as 'full' | null,
  ricaricaWorkId: null as number | null,
})
```
Aggiornare tutti i setter. `selSrcs`, `removedMix`, `workCols` rimangono useState separati.

**Verifica:** ogni flusso dialog (importa, scenari, auto-select, reset, ricarica) deve funzionare identicamente.

---

## Cosa NON toccare

- `useSchemaData` hook — unica fonte di verità per i dati DB, stabile
- `computeConnections` — algoritmo SVG delicato, non coinvolto nei bug
- `ricostruisciWorkInSchema` — logica di import complessa, funzionante
- `ScenarDialog.tsx`, `AutoSelectDialog.tsx`, `ImportaWorkDialog.tsx` — fuori scope
- `ConnectionsOverlay` component — SVG + ResizeObserver funzionante
- Auto-save debounced (payload e timing) — compatibilità con `schemaCalApi`
- Tutti i file fuori dalla cartella `metodi/` (CompostiTable, StoriaDialog, ecc.)

---

## Verifica end-to-end (dopo tutte le fasi)

1. Aprire schema calibrazione su un metodo con 3+ mix distinti e singoli
2. Aprire dialog Scenari → selezionare uno scenario
3. Usare Auto-Select → verificare che selSrcs si popoli correttamente
4. Creare una Work con più sorgenti → verificare frecce SVG e salvataggio
5. Importare work da un altro metodo → verifica compatibilità
6. Chiudere e riaprire il metodo → schema deve essere identico (auto-save ok)
7. Dismettere un mix, riaprire → nessuna card fantasma (fix 1.3)
