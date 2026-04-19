# Resoconto sessione — Operatore da Anagrafiche, Fix Aggiungi Metodo (Neat/IS), Pulsante Schemi

**Data:** 2026-04-19
**Oggetto:** Tre interventi su WorkDrawer e backend: autocomplete operatore, fix bug work con ingredienti Neat in AggiungiASchemaDialog, pulsante Schemi nel drawer

---

## Cosa è stato fatto

- Campo operatore nel form di registrazione preparazione (WorkDrawer) ora usa AutocompleteInput con suggerimenti dall'anagrafica `'operatori'`
- Fix bug: work con ingredienti `source_type='prep'` (CRM Neat, inclusi Standard Interno) non trovavano metodi nel dialog "Aggiungi a Metodo" — query backend estesa
- Aggiunto pulsante "Schemi" nel WorkDrawer (vicino a Modifica), con DropdownMenu se la work è in più metodi; Elimina/Archivia spostati in riga separata sotto

---

## Bug risolti / Feature aggiunte

### Fix: AggiungiASchemaDialog — work con CRM Neat non trova metodi

**Root cause:** `metodi:list-for-work` (backend) filtrava `work_ingredienti` solo per `source_type = 'crm'`. Una work che usa un CRM come preparazione Neat (`source_type = 'prep'`) non ha ingredienti `crm` → il JOIN su `metodo_analiti` non trovava match → dropdown metodi vuoto. Si manifesta tipicamente con CRM Standard Interno (usati come Neat), ma il difetto è generale per qualsiasi work con ingredienti Neat.

**Fix:** Query estesa con `OR` per includere anche `source_type = 'prep'`, risalendo al composto padre via `preparazioni JOIN composti`. Fix generalizzato indipendente dalla `destinazione_uso`.

### Feature: Operatore da Anagrafiche in WorkDrawer

**Motivazione:** Il campo operatore nel form "Nuova preparazione" del WorkDrawer era un `<input>` libero senza suggerimenti. Stesso pattern già usato in `PreparazioniTab.tsx`.

**Implementazione:** Aggiunto state `suggestOperatore`, `useEffect` che carica l'anagrafica `'operatori'` all'avvio del componente, sostituito `<input>` con `<AutocompleteInput>`.

### Feature: Pulsante "Schemi" in WorkDrawer

**Motivazione:** Per navigare allo schema dal drawer senza dover chiudere e cercare il pulsante nella riga della work.

**Implementazione:** Pulsante nella riga superiore delle azioni (accanto a Modifica). Se 1 metodo: pulsante diretto. Se >1 metodi: DropdownMenu con lista metodi (pattern già esistente per banner CRM scaduti). Elimina e Archivia spostati in riga separata sotto.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/metodi.ipc.ts` | Query `metodi:list-for-work` estesa per `source_type='prep'` oltre a `'crm'` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Autocomplete operatore (state + useEffect + AutocompleteInput), pulsante Schemi, riorganizzazione azioni |

---

## Note per sessioni future

- Il fix alla query `metodi:list-for-work` è generale: funziona per qualsiasi work con ingredienti Neat (non solo IS). Se in futuro si aggiungono altri `source_type`, valutare se estendere ulteriormente.
- Il `useEffect` per le anagrafiche in WorkDrawer carica una sola volta al mount (array dipendenze vuoto `[]`) — corretto perché le anagrafiche cambiano raramente durante una sessione.
- Piano di sessione: `docs/plans/active/2026-04-19-01-feat-operatore-anagrafiche-fix-aggiungi-metodo-schemi-drawer-plan.md`
