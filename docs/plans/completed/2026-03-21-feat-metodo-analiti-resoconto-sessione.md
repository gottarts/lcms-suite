# Resoconto sessione — Feature: analiti persistenti per metodo

**Data:** 2026-03-21
**Oggetto:** Implementazione tabella `metodo_analiti` — lista analiti immutabile per metodo, svincolata dal DB Composti

---

## Cosa è stato fatto

È stata implementata la feature richiesta: gli analiti di un metodo sono ora gestiti come una **lista persistente e indipendente** dal DB Composti. La sincronizzazione DB Composti → metodo è **solo in aggiunta** (by design): aggiungere un composto a un metodo aggiunge l'analita; eliminare un composto dal DB non tocca la lista analiti del metodo.

Il lavoro ha coperto backend, IPC, API frontend, logica dello schema calibrazione e UI nel form metodo.

---

## Feature aggiunte

### `metodo_analiti` — lista persistente analiti per metodo

**Motivazione:** Gli analiti nei metodi devono essere immutabili rispetto alle cancellazioni nel DB Composti. La lista analiti è "proprietà" del modulo Metodi, non del DB Composti.

**Implementazione:**
- **Migration** `016-metodo-analiti.sql`: crea tabella `metodo_analiti (id, metodo_id, nome, ordine)` con `UNIQUE(metodo_id, nome)` e `ON DELETE CASCADE` su metodi. Popola con migrazione dati dai composti esistenti.
- **IPC** `src/main/ipc/metodo-analiti.ipc.ts`: handler `metodo-analiti:list`, `metodo-analiti:add`, `metodo-analiti:remove`
- **IPC** `src/main/ipc/metodi.ipc.ts`: aggiornato `metodi:create`, `metodi:update`, `metodi:merge` per inserire automaticamente analiti quando vengono aggiunti composti al metodo
- **API** `src/renderer/lib/api.ts`: aggiunto `metodoAnalitiApi` (list/add/remove)
- **SchemaCalibrazione.logic.ts**: `useSchemaData` ora carica gli analiti da `metodo-analiti:list` (fonte autorevole), non da `composti:list`. I CRM del DB restano usati solo per mappare le sorgenti disponibili.
- **MetodoForm.tsx**: aggiunta sezione UI "Analiti del metodo" visibile solo in modalità edit — lista con checkbox, rimozione selezionati, campo aggiunta con autocomplete dal DB Composti.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/migrations/016-metodo-analiti.sql` | Nuovo — crea tabella + migrazione dati |
| `src/main/ipc/metodo-analiti.ipc.ts` | Nuovo — IPC list/add/remove |
| `src/main/index.ts` | Aggiunto `registerMetodoAnalitiIpc()` |
| `src/main/ipc/metodi.ipc.ts` | Aggiornato create/update/merge per popolare metodo_analiti |
| `src/renderer/lib/api.ts` | Aggiunto `metodoAnalitiApi` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `useSchemaData` usa lista persistente come fonte analiti |
| `src/renderer/pages/metodi/MetodoForm.tsx` | Aggiunta sezione UI gestione analiti |

---

## Bug risolti in sessione successiva (stessa giornata)

### Fix: rimozione analita scollega anche il composto dal metodo

**Root cause identificata:** Due problemi distinti:
1. In `metodi:update`/`metodi:merge`, mancava `DELETE FROM metodo_analiti` prima del reinserimento → analiti orfani se si rimuoveva un composto dal form metodo.
2. Il pulsante "Rimuovi selezionati" nel form chiamava solo `metodo-analiti:remove` (cancellava l'analita) ma non scollegava il composto da `composti_metodi` → al salvataggio successivo del form, il composto veniva reinserito e l'analita tornava.
3. `MetodiPage.handleEdit` passava il metodo dalla lista (senza `composti_ids`) → al salvataggio il backend riceveva `compostiIds = []` e svuotava tutti i composti.

**Fix applicati:**
- `metodi:update` e `metodi:merge`: aggiunto `DELETE FROM metodo_analiti` + reinserimento da zero — stesso pattern di `composti_metodi`.
- `metodo-analiti:remove`: ora fa anche `DELETE FROM composti_metodi` per i composti con quel nome, oltre a cancellare da `metodo_analiti`.
- `MetodoForm.handleRimuoviSelezionati`: dopo la rimozione, ricarica `composti_ids` aggiornati e li aggiorna nel form.
- `MetodiPage.handleEdit`: ora carica il metodo completo via `metodiApi.get()` prima di aprire il form.

---

## Note per sessioni future

- Il campo `ordine` in `metodo_analiti` è definito nello schema SQL ma non ancora usato — potrebbe servire per ordinamento drag-and-drop in futuro.
- La migrazione dati nella 016 usa `DISTINCT` su nome per evitare duplicati di lotto — verificare che non ci siano casi edge con nomi identici su composti diversi.
