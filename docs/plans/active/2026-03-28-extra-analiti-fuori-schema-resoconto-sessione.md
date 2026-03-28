# Resoconto sessione — Extra analiti fuori schema in Work

**Data:** 2026-03-28
**Oggetto:** Visualizzazione parziale degli analiti non presenti nel metodo ma inclusi nelle work importate

---

## Cosa è stato fatto

- Analisi della root cause per cui i composti "fuori schema" sparivano nella vista SchemaCalibrazione
- Implementazione parziale: `extraSrcs` + sezione composti extra nel `DrawerDettaglioWork` + chip ambra nella work card
- Identificazione del TODO rimanente (vedi Note per sessioni future)
- Chiarimento archivio: la work archiviata è "congelata" nei parametri operativi (`work_ingredienti` persiste), concentrazioni fetchate live ma composti non vengono fisicamente cancellati nel workflow normale

---

## Feature aggiunta (parziale)

### Extra analiti fuori schema — fix parziale

**Motivazione:** Quando si usa una work che contiene Mix o singoli CRM non presenti nella lista analiti dello schema corrente, `ricostruisciWorkInSchema` saltava quegli ingredienti (`if (!crm) continue`). In SchemaCalibrazione la work appariva con solo i composti dello schema, nascondendo completamente gli altri.

**Fix implementato:**

- **`SchemaCalibrazione.types.ts`**: aggiunto `extraSrcs?: Array<{ id, nome, tipo }>` a `WorkInSchema`
- **`SchemaCalibrazione.logic.ts`** — `ricostruisciWorkInSchema`: invece di `continue`, raccoglie i sorgenti skippati in `extraSrcs` (con deduplicazione mix via `seenExtraMix`)
- **`SchemaCalibrazione.tsx`** — work card chips: chip ambra `⚠ NomeSorgente` per `extraSrcs`
- **`SchemaCalibrazione.tsx`** — `DrawerDettaglioWork`: fetch dinamico del `dbWork` via `workApi.get(dbId)`, calcolo extra composti confrontando `work_ingredienti` con `crmIds` schema, sezione "Non in questo schema" con sfondo ambra; nodi extra nella catena tracciabilità

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Aggiunto `extraSrcs?` a `WorkInSchema` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `ricostruisciWorkInSchema` raccoglie `extraSrcs` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Chip ambra + sezione extra drawer + catena extra |

---

## Note per sessioni future

### TODO rimasto: chips + drawer completamente coerenti con WorkPage

**Problema aperto (segnalato dall'utente a fine sessione):**

Le chips work e il drawer (catena tracciabilità e tabella volumi di prelievo) devono essere completamente coerenti con quanto mostrato nel `WorkDrawer` di WorkPage.

Attualmente:
- `DrawerDettaglioWork` (in SchemaCalibrazione) mostra `work.srcs` e `work.vols` che derivano da `ricostruisciWorkInSchema`, il quale ricostruisce solo i sorgenti presenti in `crmItems` (filtrati per metodo)
- `WorkDrawer` (in WorkPage) usa `buildWorkSchema(dbWork, workChain)` che legge direttamente da `work_ingredienti` DB → mostra TUTTI i sorgenti e tutti i volumi

Risultato: la **tabella "Volumi di prelievo"** in `DrawerDettaglioWork` è incompleta — mancano le righe dei sorgenti extra (il prelievo fisico in laboratorio include quelle sorgenti). Anche `usedVol` e il calcolo del solvente risultano errati se ci sono sorgenti extra.

**Fix da implementare nella prossima sessione:**
- Nella tabella "Volumi di prelievo" di `DrawerDettaglioWork`: aggiungere righe extra con stile ambra per i sorgenti fuori schema, utilizzando i dati già fetchati da `dbWork.ingredienti` (il fetch dinamico è già in place dopo questa sessione)
- `usedVol` dovrebbe includere i volumi extra per mostrare il volume totale reale
- La catena tracciabilità dovrebbe integrare i nodi extra inline (non in coda separata) per rispecchiare l'ordine reale di preparazione, come fa `buildWorkSchema` in WorkPage

**Root del problema:** `ricostruisciWorkInSchema` produce un `WorkInSchema` deliberatamente filtrato per lo schema corrente (per il calcolo concentrazioni schema-specifico), ma questo stesso oggetto viene riusato per mostrare i dettagli operativi della preparazione fisica, che invece deve essere completa.

- Piano di sessione: [2026-03-28-extra-analiti-fuori-schema-plan.md](2026-03-28-extra-analiti-fuori-schema-plan.md)
