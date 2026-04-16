# Resoconto sessione — Fix Scenari CRM Mix

**Data:** 2026-04-16
**Oggetto:** Fix sistematico del dialog Scenari che mostrava sempre "Nessun CRM Mix disponibile"

---

## Cosa è stato fatto

Diagnosticati e risolti tre bug che rendevano il dialog Scenari inutilizzabile in tutti gli schemi di calibrazione. Il problema principale era un case mismatch silenzioso tra i nomi degli analiti e i nomi dei componenti delle mix, che faceva scartare tutte le composizioni. Due bug secondari causavano il mancato apertura del dialog con 1 sola mix e un blocco irrecuperabile dell'app dopo "Ricomincia da zero" senza mix disponibili.

---

## Bug risolti

### Bug 1 — Case mismatch nomi analiti/componenti (root cause principale)
**Root cause:** `metodo-analiti:list` restituisce i nomi con il case originale del DB (es. `"PARATHION-ETHYL"`), mentre `composti:list-for-schema` carica i nomi dei componenti CRM con il loro case di salvataggio (es. `"Parathion-ethyl"`). In `buildMixComposizioni` il confronto era case-sensitive: `analitiNomi.has(n)` falliva sempre → `analitiCoperti.size === 0` → tutte le composizioni venivano scartate → `generaScenari()` riceveva array vuoto → dialog sempre vuoto.
**Fix:** In `SchemaCalibrazione.scenari.ts`, normalizzato il confronto in lowercase su entrambi i lati: `new Set(analiti.map(a => a.nome.toLowerCase()))` e `analitiNomi.has(n.toLowerCase())`. Stesso fix applicato in `_buildScenario` dove `analitiNomi` viene usato per costruire la lista analiti coperti per mix.

### Bug 2 — 1 solo scenario veniva saltato silenziosamente
**Root cause:** La condizione `if (scenari.length > 1)` in `SchemaCalibrazione.tsx` apriva il dialog solo con ≥2 scenari. Con una sola mix disponibile, il ramo `else` eseguiva `setScenarioScelto(true)` senza chiamare `handleApplyScenario`, quindi `removedMix` non veniva mai impostato.
**Fix:** Cambiata la soglia a `>= 1`. Il caso `else` (0 scenari = nessuna mix disponibile) imposta `scenarioScelto(true)` senza aprire nulla — comportamento corretto.

### Bug 3 — "Ricomincia da zero" bloccava l'app se no mix
**Root cause:** `handleFullReset` apriva il dialog Scenari incondizionatamente (`setDialogs scenar: true`) con `obbligatorio=true`. Se non c'erano mix, il dialog mostrava "Nessun CRM Mix disponibile" senza possibilità di chiudersi.
**Fix:** Rimossa l'apertura esplicita del dialog nel reset. Cambiato `setSchemaLoaded(true)` → `setSchemaLoaded(false)` in modo che il `useEffect` di caricamento schema si ri-attivi dopo `reload()` e apra il dialog solo se `generaScenari()` restituisce ≥1 scenario.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` | Normalizzazione lowercase in `buildMixComposizioni` e `_buildScenario` per confronto case-insensitive nomi analiti/componenti |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Soglia apertura dialog da `> 1` a `>= 1`; fix `handleFullReset` (rimossa apertura dialog, `schemaLoaded(false)` per ri-trigger useEffect) |

---

## Note per sessioni future

- Il case mismatch era latente dall'inizio: i nomi in `metodo_analiti` vengono inseriti dall'utente con case variabile, i nomi in `composti` anche. La normalizzazione è solo nel layer di confronto — i nomi visualizzati restano invariati.
- Il piano è in `docs/plans/active/2026-04-16-07-fix-scenari-crm-mix-plan.md`.
- Da testare: schema con mix disponibili (dialog deve mostrare scenari), schema con 1 sola mix (dialog si apre con 1 scenario), "Ricomincia da zero" con e senza mix.
