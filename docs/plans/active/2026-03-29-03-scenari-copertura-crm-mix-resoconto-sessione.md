# Resoconto sessione — Scenari di copertura CRM Mix nello Schema Calibrazione

**Data:** 2026-03-29
**Oggetto:** Dialog scenari per selezione ottimale CRM Mix con filtraggio per composizione

---

## Cosa è stato fatto

Implementata la feature "Scenari di copertura CRM Mix" per risolvere il problema storico degli analiti che compaiono in più mix con composizioni diverse (sovrapposizione tra mix). La feature:

- Aggiunge un pulsante `◎ Scenari` nell'intestazione della colonna CRM Mix
- Genera algoritmicamente una sequenza ordinata di scenari disgiunti (nessun analita in due mix contemporaneamente)
- All'apertura dello schema, se non è stato scelto uno scenario, il dialog si apre automaticamente (obbligatorio)
- Scegliere uno scenario **filtra** (non seleziona) le mix: le composizioni non nello scenario vengono rimosse permanentemente dalla griglia, ricalcolando `analiti` e `crmItems` da zero
- Il flag `scenarioScelto` viene persistito in `schema_json` per non riaprire il dialog ad ogni apertura

---

## Feature aggiunte

### Algoritmo scenari (`SchemaCalibrazione.scenari.ts`)
**Motivazione:** Necessità di un algoritmo che generi scenari ottimali di copertura con mix disgiunti.

**Implementazione:**
- `buildMixComposizioni`: raggruppa i CRM mix per firma (composizione), intersecandoli con gli analiti del metodo
- `generaScenari`: sequenza di scenari secondo l'algoritmo concordato:
  - Scenario 1: miglior sottoinsieme disgiunto su tutte le mix (backtracking esatto ≤20, greedy oltre)
  - Scenari successivi: base = miglior sottoinsieme delle sole mix residue, poi riempimento greedy con mix già usate; tutte le mix residue nella base vengono marcate usate in un colpo
- `trovaScenarioMigliore`: backtracking con pruning per istanze piccole, greedy per grandi
- `_greedyFill`: funzione separata per il riempimento con mix già usate

### Dialog scenari (`ScenarDialog.tsx`)
**Implementazione:**
- Lista compatta: barra di copertura, `N/tot (X%)`, chip nomi mix
- Click sulla riga → applica subito e chiude
- Pulsante `▼` espande il dettaglio (analiti per mix + non coperti) senza applicare
- Prop `obbligatorio`: quando `true` (scenario non ancora scelto) lo sfondo è più scuro, non si può chiudere cliccando fuori, il `×` non appare

### Filtraggio per composizione (non per lotto)
**Root cause:** Il filtraggio iniziale era per `mix_id` singolo, ma ogni composizione ha più lotti (più `mix_id`). Applicare uno scenario aggiungeva a `removedMix` i lotti non scelti, cancellando anche il selettore lotti.

**Fix:**
- `useMemo` in `SchemaCalibrazione.tsx` calcola le firme ammesse (composizioni nello scenario), poi espande a tutti i `mix_id` di quelle firme
- `removedMixFiltrato`: versione ripulita di `removedMix` da passare alla griglia, senza i `mix_id` di firme ammesse (così non appaiono barrati)
- `GrigliaAnalitiCrm` riceve `crmItemsFiltrati` (solo le mix dello scenario, con tutti i loro lotti) e `removedMixFiltrato`

### Persistenza flag `scenarioScelto`
**Implementazione:**
- Aggiunto campo `scenarioScelto: boolean` al payload di `schemaCalApi.save`
- All'apertura: se `scenarioScelto === false`, il dialog si apre automaticamente
- `handleFullReset` resetta anche `scenarioScelto = false` e riapre il dialog

### Refactor `buildAnalitiData` (funzione pura estratta)
**Motivazione:** Per ricalcolare `analiti` dopo il filtraggio delle mix escluse, senza rifare la chiamata IPC.

**Implementazione:** Estratta da `useSchemaData` la logica di costruzione di `analiti`/mappe in `buildAnalitiData(items, analitiRows)`. Il hook la usa internamente; `SchemaCalibrazione.tsx` la richiama nel `useMemo` con i CRM filtrati. Il hook espone anche `analitiRows` (raw) per permettere il ricalcolo esterno.

---

## Bug risolti

### Schermata bianca all'apertura schema
**Root cause:** `useMemo` restituiva `removedMixFiltrato` ma la destructuring non lo includeva → `undefined` passato come `Set` alla griglia → crash.
**Fix:** Aggiunto `removedMixFiltrato` alla destructuring del `useMemo`.

### Badge/selettore lotti scomparso dopo applicazione scenario
**Root cause:** `removedMix` conteneva i `mix_id` dei lotti non scelti come "primo lotto"; il filtraggio per `mix_id` escludeva tutti i lotti tranne uno, eliminando il selettore.
**Fix:** Filtraggio per **firma** (composizione), non per `mix_id`; tutti i lotti di una firma ammessa vengono mantenuti.

### Mix appaiono barrate (come se cliccata ×) dopo scenario
**Root cause:** `removedMixFiltrato` non veniva passato alla griglia; la griglia usava `removedMix` grezzo che conteneva i `mix_id` dei lotti esclusi → card mostrate barrate.
**Fix:** `removedMixFiltrato` passato esplicitamente a `GrigliaAnalitiCrm`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` | **NUOVO** — algoritmo puro: `buildMixComposizioni`, `generaScenari`, `trovaScenarioMigliore`, `_greedyFill` |
| `src/renderer/pages/metodi/ScenarDialog.tsx` | **NUOVO** — dialog UI con lista scenari, barra copertura, expand dettaglio, prop `obbligatorio` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Estratta `buildAnalitiData` (funzione pura); hook espone `firmaToMixIds`, `mixNomiMap`, `analitiRows` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Aggiunto prop `onOpenScenar`; pulsante `◎ Scenari` nell'header CRM Mix |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Wiring completo: stato `scenarioScelto`, `useMemo` filtraggio per firma, `handleApplyScenario`, auto-apertura dialog, `removedMixFiltrato` |
| `src/renderer/lib/api.ts` | `schemaCalApi.save` aggiunto param `scenarioScelto: boolean` |

---

## Note per sessioni future

- **Algoritmo scenari successivi (logica definitiva):** base = miglior sottoinsieme delle sole mix residue (ottimale), poi riempimento greedy con mix già usate. Tutte le mix residue nella base vengono marcate usate. Questa logica è diversa dalla spec originale `scenari_idea.txt` (che usava una sola mix obbligatoria per volta) — la versione implementata è quella concordata con l'utente in sessione.
- **`removedMix` contiene firme escluse, non solo quelle manuali:** dopo la scelta dello scenario, `removedMix` viene popolato con tutti i `mix_id` delle composizioni non nello scenario. Il `useMemo` e `removedMixFiltrato` gestiscono la distinzione tra "rimosso manualmente" e "escluso da scenario".
- **`ScenarDialog` riceve `analitiAll` e `crmItems` non filtrati** — deve vedere tutte le mix per calcolare gli scenari, non solo quelle già scelte.
- **`scenari_idea.txt`** nella root del progetto è il documento di spec originale dell'algoritmo (può essere rimosso o spostato in `docs/`).
- Piano di sessione: `docs/plans/active/2026-03-29-scenari-copertura-crm-mix-plan.md`
