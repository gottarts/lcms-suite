# Resoconto sessione — Fix DrawerDettaglioWork: volumi extra + re-import work

**Data:** 2026-03-28
**Oggetto:** Completamento visualizzazione sorgenti extra in DrawerDettaglioWork + fix impossibilità re-import work precedentemente cancellata

---

## Cosa è stato fatto

Due bug risolti su `SchemaCalibrazione`:

1. **DrawerDettaglioWork incompleto per sorgenti fuori schema** (TODO dalla sessione precedente): la tabella "Volumi di prelievo" e la catena tracciabilità non mostravano i sorgenti non presenti nel metodo corrente. Fix completo con righe amber e nodi inline.

2. **Bug re-import work**: una work importata e poi eliminata dallo schema veniva archiviata, quindi spariva da `listForImport` e non poteva essere re-importata. Fix con distinzione tra work native (archiviate) e work importate (de-linkate senza archiviare).

---

## Bug risolti / Feature aggiunte

### 1. DrawerDettaglioWork — volumi extra + catena tracciabilità inline

**Root cause:** `DrawerDettaglioWork` riusava il `WorkInSchema` prodotto da `ricostruisciWorkInSchema`, che filtra deliberatamente solo i sorgenti dello schema. Questo causava tre problemi: (a) tabella volumi incompleta, (b) `usedVol` sottostimato → solvente gonfiato, (c) nodi extra in coda separata fuori da `ChainNode`.

**Fix:**
- `extraVols` calcolato da `dbWork.ingredienti` (sorgenti crm non in schema, deduplicate per mix), posizionato prima di `usedVol`
- `usedVol = work.vols + extraVols` → solvente e totale prelievi ora corretti
- Righe amber (⚠ nome, background `#fffbeb`) aggiunte nella tabella dopo le righe schema
- `ChainNode` aggiornato: `w.extraSrcs` renderizzati inline come figli indentati al depth corretto, rimosso il blocco esterno che li appendeva dopo il nodo radice

### 2. Fix re-import work precedentemente cancellata

**Root cause:** `handleDeleteWork` chiamava sempre `workApi.archivia()` per qualsiasi work con `dbId`, incluse quelle importate. `archivia` imposta `archiviato = 1`; `listForImport` filtra `WHERE archiviato = 0 OR archiviato IS NULL`, quindi la work scompariva definitivamente dal dialog di import.

**Fix:**
- Aggiunto `isImported?: boolean` a `WorkInSchema`
- `handleImportWork` imposta `isImported: true` sulla work aggiunta a `workCols`
- `handleDeleteWork` distingue: se `isImported` → `workApi.removeFromMetodo()` (rimuove solo il link `work_metodi`); se nativa → `workApi.archivia()` (comportamento precedente, preserva traceability `sostituito_da_id`)
- Aggiunto IPC handler `work:remove-from-metodo` (DELETE su `work_metodi`)
- Aggiunto `removeFromMetodo` a `workApi` in `api.ts`

**Limitazione nota:** `isImported` è in memoria per la sessione corrente. Una work importata in sessioni precedenti, ricaricata dal DB, non ha il flag e verrebbe comunque archiviata se eliminata. Fix completo richiederebbe una colonna in `work_metodi` (migration).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `extraVols` + righe amber tabella + `ChainNode` inline + `handleDeleteWork` con branch `isImported` + `handleImportWork` imposta flag |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | `isImported?: boolean` aggiunto a `WorkInSchema` |
| `src/renderer/lib/api.ts` | `removeFromMetodo` aggiunto a `workApi` |
| `src/main/ipc/work.ipc.ts` | Handler `work:remove-from-metodo` |

---

## Note per sessioni future

- La limitazione di `isImported` (solo in-sessione) potrebbe essere risolta aggiungendo una colonna `is_native INTEGER DEFAULT 1` a `work_metodi` con una migration. Al momento non prioritario.
- Il calcolo `usedVol` in `DrawerDettaglioWork` ora rispecchia fedelmente il prelievo fisico reale (inclusi sorgenti fuori schema).
- Piano di sessione: [2026-03-28-fix-drawer-work-volumi-extra-reimport-plan.md](2026-03-28-fix-drawer-work-volumi-extra-reimport-plan.md)
