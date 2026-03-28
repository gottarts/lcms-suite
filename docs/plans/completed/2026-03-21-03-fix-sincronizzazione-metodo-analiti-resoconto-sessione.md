# Resoconto sessione — Fix sincronizzazione metodo_analiti al salvataggio metodo

**Data:** 2026-03-21
**Oggetto:** Bug `metodo_analiti` — analiti orfani dopo rimozione composto dal form metodo

---

## Contesto

La feature `metodo_analiti` (lista persistente analiti per metodo, implementata nella stessa giornata) era stata implementata con una logica **solo-aggiunta**: i composti venivano aggiunti a `metodo_analiti` al salvataggio del metodo, ma non venivano mai rimossi. Questo causava analiti orfani visibili in SchemaCalibrazione come "analita senza CRM disponibile".

---

## Bug risolti

### Bug 1 — Analiti orfani in `metodi:update` / `metodi:merge`

**Root cause:** In `metodi:update` (e analogamente `metodi:merge`), la transazione cancellava e ricreava correttamente i link `composti_metodi`, ma non faceva lo stesso per `metodo_analiti`. Gli analiti dei composti rimossi sopravvivevano nel DB.

**Fix:** Aggiunto `DELETE FROM metodo_analiti WHERE metodo_id = ?` prima del loop di reinserimento — stesso pattern già usato per `composti_metodi`. Gli analiti vengono ricalcolati da zero ad ogni salvataggio.

**File modificato:** `src/main/ipc/metodi.ipc.ts` — handler `metodi:update` e `metodi:merge`

---

### Bug 2 — Rimozione analita non scollegava il composto da `composti_metodi`

**Root cause:** Il pulsante "Rimuovi selezionati" nel form chiamava solo `metodo-analiti:remove` (cancellava l'analita dalla lista) ma non toccava `composti_metodi`. Al salvataggio successivo del form metodo, il composto veniva reinserito automaticamente e l'analita tornava.

**Fix:** `metodo-analiti:remove` ora esegue anche `DELETE FROM composti_metodi` per i composti con quel nome analita, oltre alla cancellazione da `metodo_analiti`.

**File modificato:** `src/main/ipc/metodo-analiti.ipc.ts` — handler `metodo-analiti:remove`

---

### Bug 3 — `handleRimuoviSelezionati` non aggiornava i `composti_ids` nel form

**Root cause:** Dopo la rimozione di analiti, il form conservava in memoria i `composti_ids` originali. Al salvataggio, il backend riceveva ancora i composti rimossi e li reinseriva.

**Fix:** `MetodoForm.handleRimuoviSelezionati` ricarica i `composti_ids` aggiornati dopo la rimozione e li aggiorna nello stato del form.

**File modificato:** `src/renderer/pages/metodi/MetodoForm.tsx`

---

### Bug 4 — `MetodiPage.handleEdit` apriva il form senza `composti_ids`

**Root cause:** `handleEdit` passava il metodo direttamente dalla lista (oggetto parziale, senza `composti_ids`). Il backend riceveva `compostiIds = []` e svuotava tutti i composti al primo salvataggio.

**Fix:** `MetodiPage.handleEdit` ora carica il metodo completo via `metodiApi.get()` prima di aprire il form.

**File modificato:** `src/renderer/pages/metodi/MetodiPage.tsx`

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/metodi.ipc.ts` | `metodi:update` e `metodi:merge`: DELETE metodo_analiti prima del reinserimento |
| `src/main/ipc/metodo-analiti.ipc.ts` | `metodo-analiti:remove`: aggiunto DELETE composti_metodi |
| `src/renderer/pages/metodi/MetodoForm.tsx` | `handleRimuoviSelezionati`: ricarica e aggiorna `composti_ids` dopo rimozione |
| `src/renderer/pages/metodi/MetodiPage.tsx` | `handleEdit`: carica metodo completo prima di aprire il form |

---

## Nota di design

La cancellazione automatica via form metodo si applica anche agli analiti aggiunti manualmente (tramite il campo autocomplete nel form). Questo è accettabile: se il composto viene aggiunto al DB e collegato al metodo, l'analita viene reinserito automaticamente. L'utente può sempre riaggiungere analiti manualmente dopo il salvataggio.

---

## Commit

`c25b031` — `feat: metodo_analiti — lista analiti persistente per metodo + fix sincronizzazione`
