# Resoconto sessione — Refactoring e bug fix SchemaCalibrazione

**Data:** 2026-04-15
**Oggetto:** Analisi completa della sezione SchemaCalibrazione, correzione di 4 bug critici e refactoring della manutenibilità in 9 step incrementali.

---

## Cosa è stato fatto

Sessione di analisi profonda + intervento sulla sezione SchemaCalibrazione (~3940 righe su 8 file). Il lavoro si è articolato in:

1. **Analisi con Explore/Plan agents** per mappare tutti i file, i flussi dati, i bug e i problemi di manutenibilità.
2. **Fase 1 — 4 bug critici corretti** (tutti a rischio molto basso/basso, nessun comportamento visibile cambiato).
3. **Fase 2 — 5 refactoring di manutenibilità** (costanti, memoizzazione, deduplicazione logica, raggruppamento stato).

---

## Bug risolti / Feature aggiunte

### BUG 1.1 — `splice(-1)` su elemento non trovato in `_greedy` e `_greedyFill`
**Root cause:** `rimanenti.splice(rimanenti.indexOf(bestComp), 1)` — se `indexOf` restituisce -1 (elemento non trovato), `splice(-1, 1)` rimuove silenziosamente l'ultimo elemento dell'array.
**Fix:** Guard `const idx = rimanenti.indexOf(bestComp); if (idx >= 0) rimanenti.splice(idx, 1)` in entrambe le funzioni (`_greedy` ~riga 194, `_greedyFill` ~riga 305 di `scenari.ts`).

### BUG 1.2 — `getCompsFromWork` ricorsiva senza protezione cicli
**Root cause:** La funzione si chiama ricorsivamente per sorgenti di tipo `'work'`. Se Work A → Work B → Work A, stack overflow.
**Fix:** Parametro opzionale `visited: Set<string> = new Set()` aggiunto alla firma. Ogni chiamata ricorsiva verifica `!visited.has(srcWork.id)` prima di procedere, propagando un nuovo Set con l'id della work corrente. La firma è retrocompatibile (parametro opzionale con default).

### BUG 1.3 — `removedMix` caricato dal DB senza validazione
**Root cause:** Al caricamento dello schema dal DB, i `mix_id` salvati in `removedMix` venivano deserializzati senza verificare se i mix esistessero ancora in `crmItems`. Mix dismessi successivamente al salvataggio lasciavano `mix_id` fantasma che rompevano le frecce SVG e producevano card non renderizzabili.
**Fix:** Prima di assegnare `setRemovedMix`, si costruisce `mixIdDisponibili = new Set(crmItems.map(c => c.mix_id).filter(...))` e si filtra `saved.removedMix` contro questo set. Solo i mix_id ancora presenti vengono caricati.

### BUG 1.4 — `useEffect blockedMap` con dipendenze stale (`eslint-disable`)
**Root cause:** L'effect che controlla work bloccate/scadute aveva un `// eslint-disable-next-line react-hooks/exhaustive-deps` per silenziare il warning su `workCols` come dipendenza. Il problema reale era che `workCols` come array di array triggera re-fetch ad ogni render perché cambia sempre riferimento, anche quando il contenuto non cambia.
**Fix:** `workDbIds = useMemo(() => workCols.flatMap(...), [workCols])` stabilizza la dipendenza su un array di id primitivi. L'effect ora dipende da `[schemaLoaded, workDbIds]` (numero di id confrontato stabilmente). Rimosso il commento `eslint-disable`.

### REFACT 2.1 — Costanti layout in `grid.tsx`
**Motivazione:** Magic numbers `62`, `6`, `14`, `22`, `236`, `18`, `20` erano inline nelle funzioni `sngCardH`, `sngCellH`, `mixChipsH`. Una modifica CSS richiedeva aggiornamenti in più punti.
**Implementazione:** Costante `LAYOUT` con 9 chiavi named aggiunta in cima al file, subito dopo `const ROW`. Tutte le occorrenze inline sostituite con `LAYOUT.*`.

### REFACT 2.2 — `useMemo` per le 7 mappe in `GrigliaAnalitiCrm`
**Motivazione:** Le 7 mappe di lookup (`mixAnaliti`, `mixAllComps`, `mixInfo`, `mixCvSets`, `mixItemByNome`, `sngById`, `mixLottoSel`) venivano ricostruite ad ogni render anche quando `analiti` e `crmItems` non cambiavano.
**Implementazione:** `useMemo` aggiunto all'import di React in `grid.tsx`. Ogni mappa avvolta con dipendenze conservative `[analiti]` o `[crmItems]`.

### REFACT 2.3 — Funzione `buildSorgenteMix` estratta
**Motivazione:** La logica "filtra CRM per mix_id → calcola cvSet → costruisci SorgenteSel" era duplicata identicamente in `toggleMix`, `handleChangeMixLotto` e `handleAutoSelect`.
**Implementazione:** Funzione pura `buildSorgenteMix(mixId, crmItems): SorgenteSel` esportata da `logic.ts`. I 3 handler in `tsx` ora la chiamano. Importata nel barrel di import di `tsx`.

### REFACT 2.4 — Decomposizione di `buildAnalitiData` (93 righe → 3 funzioni)
**Motivazione:** La funzione aveva 93 righe con 5 responsabilità distinte, difficile da leggere e testare in isolamento.
**Implementazione:** Due funzioni private (non esportate) nello stesso file: `_buildMixMaps` (costruisce mixNomiMap, mixFirma, firmaToMixIds, mixMap, mixIdsByNome) e `_buildSngMaps` (costruisce sngMap, isMap). `buildAnalitiData` diventa un orchestratore di ~20 righe. Firma pubblica e valore di ritorno **identici**.

### REFACT 2.5 — Raggruppamento 5 dialog-useState in oggetto `dialogs`
**Motivazione:** 5 `useState` separati per dialog (`importOpen`, `scenarOpen`, `autoSelectOpen`, `confirmReset`, `ricaricaSchemaWorkId`) frammentavano lo stato UI.
**Implementazione:** Singolo `useState<{ import, scenar, autoSelect, confirmReset, ricaricaWorkId }>` chiamato `dialogs`. Tutti i 20+ punti di accesso aggiornati con `setDialogs(d => ({ ...d, ... }))`. Bonus: corretto bug spurio `setSelSrcs(new Set())` → `setSelSrcs(new Map())` scoperto durante la migrazione.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` | Guard `splice(-1)` in `_greedy` e `_greedyFill` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Protezione cicli in `getCompsFromWork`; funzione `buildSorgenteMix` esportata; decomposizione `buildAnalitiData` in `_buildMixMaps` + `_buildSngMaps` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Fix `removedMix` al caricamento; fix `blockedMap` useEffect con `workDbIds useMemo`; import `buildSorgenteMix`; 3 handler deduplicati; 5 dialog-useState → oggetto `dialogs`; fix `setSelSrcs(new Map())` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Costante `LAYOUT`; `useMemo` aggiunto all'import; 7 mappe avvolte in `useMemo` |

---

## Note per sessioni future

- **Verifica visiva richiesta:** tutti i flussi dialog (scenari, auto-select, importa, ricarica, reset), le frecce SVG dopo dismiss mix, e la barra avvisi work bloccate/scadute devono essere testati manualmente su dati reali.
- **Cosa NON è stato toccato (per scelta):** `useSchemaData` hook, `computeConnections`, `ricostruisciWorkInSchema`, i 3 dialog component (ScenarDialog, AutoSelectDialog, ImportaWorkDialog), `ConnectionsOverlay`.
- **Step non eseguiti del piano originale:** nessuno — tutti i 9 step sono stati completati.
- **Possibili sessioni future:**
  - Aggiungere `z.object()` validation al caricamento schema (JSON blob non tipizzato)
  - Considerare union discriminata per `SorgenteSel` (alta complessità, richiede sessione dedicata con TS strict)
  - Virtual scrolling se i metodi crescono a >300 CRM
- **Piano di riferimento:** `docs/plans/active/2026-04-15-03-refactor-schema-calibrazione-plan.md`
