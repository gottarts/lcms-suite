# Resoconto sessione — Preparazioni Stock Neat come sorgenti Schema Calibrazione

**Data:** 2026-04-03
**Oggetto:** Piano per collegare le preparazioni stock dei CRM Neat al flusso schema calibrazione → work

---

## Cosa è stato fatto

Sessione di solo planning (nessun codice scritto). Analisi approfondita del problema aperto
indicato nel draft: "resta aperta la questione neat nei crm degli schemi calibrazione e come
utilizzarli come sorgenti di work".

Il problema è stato chiarito: i CRM Neat non hanno una concentrazione in soluzione direttamente
utilizzabile, quindi non possono essere sorgenti dirette di una work. Serve prima una
"preparazione stock" (soluzione derivata dal Neat con massa pesata e concentrazione reale
calcolata), che viene già registrata nella tabella `preparazioni`.

Attualmente nello schema i CRM Neat appaiono selezionabili come i normali Solution, con cv =
concentrazione nominale — comportamento scorretto.

---

## Feature pianificata

### Prep Stock come sorgenti dirette per CRM Neat

**Motivazione:** I CRM di forma "Neat" non hanno concentrazione in soluzione — occorre passare
per una preparazione stock (tabella `preparazioni`) che ha `concentrazione_reale` e `scadenza`.

**Approccio scelto dall'utente:**
- Nella colonna "Singoli / Neat" dello schema: se il CRM è Neat, mostrare le sue preparazioni
  stock attive come sub-card selezionabili (non il CRM direttamente)
- Se nessuna prep stock attiva: CRM Neat disabilitato con bottone "Crea prep stock ↗" che
  apre la pagina DB Composti

**Implementazione pianificata (7 step):**
1. Migration `019-work-ingredienti-prep.sql` — aggiunge colonna `prep_id` in `work_ingredienti`
2. `SchemaCalibrazione.types.ts` — nuovo tipo `'prep'` in `SorgenteTipo`, `PrepStockItem` in `CrmItem`, `prepId` in `SorgenteSel`
3. `preparazioni.ipc.ts` — nuovo handler `preparazioni:list-for-schema` (filtra attive/non scadute)
4. `SchemaCalibrazione.logic.ts` — `useSchemaData()` carica prep stock per Neat; `salvaWorkNelDb()` gestisce sorgenti prep
5. `SchemaCalibrazione.grid.tsx` — rendering Neat: header non-selezionabile + sub-card per ogni prep stock
6. `work.ipc.ts` — `work:create` accetta `source_type='prep'`; aggiornare `check-lot-status` e `ricarica`
7. `WorkDrawer.tsx` — visualizzazione ingredienti prep nella catena

---

## File modificati

Nessun file di codice modificato in questa sessione — solo piano.

---

## Note per sessioni future

- Il piano completo è in `docs/plans/active/2026-04-03-05-feat-prep-stock-neat-schema-calibrazione-plan.md`
- La tabella `preparazioni` esiste già con tutti i campi necessari (`concentrazione_reale`,
  `concentrazione_target`, `scadenza`, `data_dismissione`, `flacone`)
- Il handler `preparazioni:list` esistente carica TUTTO senza filtri — serve il nuovo
  `preparazioni:list-for-schema` con filtro per `data_dismissione IS NULL AND scadenza >= oggi`
- SQLite non fa enforcement delle CHECK constraint → non serve ricreare `work_ingredienti`,
  basta aggiungere la colonna `prep_id` e aggiornare la logica applicativa
- Attenzione in `work:check-lot-status`: gli ingredienti `source_type='prep'` non hanno
  sostituti automatici — gestire separatamente o ignorare nel check lotti CRM
- Il campo `cv` per le prep stock = `concentrazione_reale ?? concentrazione_target`
