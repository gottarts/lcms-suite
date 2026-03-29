# Resoconto sessione — 2026-03-29
## Selettore lotto CRM Mix nello Schema Calibrazione

---

## Obiettivo

Aggiungere la possibilità di scegliere il lotto quando per una mix esistono più lotti disponibili in DB Composti. La soluzione richiesta: minima, pulita, senza sistema multi-colonna (già revertito nella sessione precedente).

---

## Analisi preliminare

### Come sono strutturati i dati nel DB

Nel database, ogni mix è identificata da un `mix_id` univoco. Un mix con due lotti diversi esiste come **due gruppi di righe distinti** con `mix_id` diversi — non come righe con stesso `mix_id` ma lotto diverso. Il `lotto` è un campo del composto, non una chiave primaria del mix.

La query IPC `composti:list-for-schema` restituisce tutti i componenti dei mix che contengono almeno un analita del metodo — quindi entrambi i gruppi vengono caricati.

### Problema nella logic pre-sessione

In `SchemaCalibrazione.logic.ts`, la costruzione di `AnalitoItem.mixId` usava:
```ts
mixMap.set(item.nome, item.mix_id)  // sovrascriveva ad ogni iterazione
```
Risultato: per ogni analita veniva tenuto solo l'**ultimo** `mix_id` trovato. Se l'analita era in due mix con composizioni diverse, un mix veniva comunque mostrato (l'ultimo); se era in due lotti della stessa mix, veniva mostrato solo uno dei due lotti.

---

## Soluzione implementata

### Approccio: `<select>` nativo inline nel blocco mix

Un solo file UI modificato (`SchemaCalibrazione.grid.tsx`). Il selettore appare solo quando ci sono più lotti disponibili per la stessa composizione.

### Criterio "stesso mix, lotto diverso"

Due `mix_id` rappresentano lotti diversi della stessa mix se e solo se hanno **identica composizione** — cioè lo stesso insieme di nomi componenti.

Implementato con una **firma**: `Array.from(nomi).sort().join('|')` per ogni `mix_id`. Mix con stessa firma → stesso gruppo → selettore lotto.

### File modificati

#### `SchemaCalibrazione.types.ts`
- Aggiunto campo `mixIds: string[]` ad `AnalitoItem` — array di tutti i `mix_id` con stessa composizione disponibili per quell'analita

#### `SchemaCalibrazione.logic.ts`
- Costruisce `mixNomiMap` (mix_id → set nomi componenti)
- Calcola `mixFirma` (mix_id → firma stringa)
- Raggruppa per firma con `firmaToMixIds`
- Logica `mixMap` per nome analita:
  - Se tutti i mix_id dell'analita hanno **stessa firma** → `mixIds = tutti i mix_id del gruppo` → selettore attivo
  - Se ci sono **composizioni diverse** → comportamento originale: ultimo mix_id vince, `mixIds = [ultimo]`, nessun selettore

#### `SchemaCalibrazione.grid.tsx`
- Rimossa mappa `mixLotti` (errata: raggruppava per campo `lotto` dentro lo stesso `mix_id`, che è sempre uguale per un mix)
- Aggiunto stato locale `mixLottoSel: Map<string, string>` — mappa `mix_id_ref → mix_id_attivo`
- Nel blocco mix assoluto: `mixIdAttivo = mixLottoSel.get(a.mixId) ?? a.mixId`
- `info`, `sel`, `isRmMx`, `onToggleMix`, `onRemoveMix` tutti usano `mixIdAttivo`
- Selettore `<select>`: appare se `a.mixIds.length > 1`, opzioni = lotto di ogni mix_id (`mixInfo.get(mid)?.lotto`)
- Se lotto singolo → div con lotto testuale come prima

---

## Bug noti / problemi aperti

### Mix C con composizione diversa

**Scenario**: un analita (es. Atrazina) è presente in:
- Mix A (Atrazina + Simazina + Terbutilazina) — lotto 1
- Mix B (Atrazina + Simazina + Terbutilazina) — lotto 2 → stessa firma → selettore ✓
- Mix C (Atrazina + Endrin) — composizione diversa → firma diversa

**Comportamento attuale**: quando le firme sono diverse, la logica fa `mixMap.set(item.nome, [item.mix_id])` ad ogni iterazione (senza guardia `has`), quindi il **last-write vince**. Mix C appare solo se è l'ultimo a essere processato nell'iterazione — l'ordine dipende dall'ordine dei record nel DB (`ORDER BY c.id ASC`).

**Problema**: in presenza di mix A/B (stessa firma, selettore) + mix C (firma diversa), il ramo "composizioni diverse" si attiva, e Mix A o Mix B o Mix C appare a seconda dell'ordine — non deterministico e non corretto.

**Causa radice**: `AnalitoItem.mixId` è `string | null` — un singolo valore. Non supporta "analita in due mix con composizioni diverse contemporaneamente". Questo era già un limite pre-esistente (la vecchia logica sovrascriveva silenziosamente), ma la nuova logica lo gestisce in modo altrettanto impreciso.

**Soluzione futura da valutare**: supportare `mixId: string[]` in `AnalitoItem` (più mix_id per composizioni diverse), con due blocchi distinti nella colonna CRM Mix per lo stesso analita. Richiede refactor significativo del rendering e della logica di layout (calcolo altezze righe, mixTopPx, mixHeightPx).

---

## Percorso iterativo della sessione

1. Prima implementazione: `mixLotti` raggruppava per campo `lotto` dentro stesso `mix_id` — **sbagliato** (il lotto è sempre uguale dentro un mix_id)
2. Correzione: `a.mixIds` da `logic.ts` con tutti i `mix_id` per nome — **troppo largo** (includeva mix con composizioni diverse)
3. Correzione: firma per composizione — **corretta** per il caso lotti multipli stessa composizione
4. Bug reintrodotto: mix C spariva con il `if (!mixMap.has)` — fix con logica distinta per firme diverse vs uguali
5. Stato finale: selettore funziona per lotti multipli stessa composizione; mix C con composizione diversa ha comportamento non deterministico (problema pre-esistente, documentato)

---

## Verifica

1. Mix con un solo lotto → nessun selettore, lotto testuale come prima ✓
2. Mix con due lotti stessa composizione → selettore dropdown, cambio lotto aggiorna info (scadenza, rivalidazione, toggle) ✓
3. Mix con composizioni diverse per stesso analita → comportamento pre-esistente (last-write wins), da rivedere in sessione futura
