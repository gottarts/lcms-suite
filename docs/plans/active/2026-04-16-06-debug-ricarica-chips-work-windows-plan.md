# Piano: Logging + fix ricarica chips work (Windows)

## Context

La funzionalità "Ricarica ↻" nelle chips work di SchemaCalibrazione potrebbe non funzionare su Windows. L'ipotesi principale è che la transazione SQLite in `work:ricarica` fallisca silenziosamente su Windows (file locking più aggressivo), oppure che il `schema_json` venga aggiornato ma il renderer non lo rilegga correttamente. Serve logging per diagnosticare e una soluzione robusta.

---

## Problemi identificati

### Problema 1 — Errori silenti nel backend (`work:ricarica`)
L'handler non logga nulla. Se la transazione SQLite fallisce su Windows (locking, constraint, ecc.), `onSuccess` nel renderer viene chiamato comunque se l'errore viene inghiottito, oppure il renderer non gestisce l'errore IPC in modo visibile.

### Problema 2 — `metodi_ids` vuoto → schema_json non aggiornato
In `RicaricaDialog.tsx`, `metodi_ids` viene passato come array dei metodi della work. Se per qualsiasi motivo è vuoto, il ciclo `for (const mid of params.metodi_ids)` non esegue nulla: la nuova work esiste nel DB ma `schema_json` punta ancora al vecchio `dbId`. Il renderer ricarica il vecchio schema e mostra ancora il badge "Ricarica ↻".

### Problema 3 — `onSuccess` non passa `newWorkId` al renderer
`onSuccess` in SchemaCalibrazione.tsx non riceve il `new_work_id` restituito dal backend — non è un bug bloccante ma impedisce di verificare che il nuovo id sia effettivamente diverso.

---

## Soluzione

### 1. Logging backend — `src/main/ipc/work.ipc.ts` (riga 676)

Aggiungere `console.log` attorno all'handler `work:ricarica`:
- Log all'ingresso con `params`
- Log dopo la transazione con `newId`
- `try/catch` esplicito con `console.error` (attualmente la transazione lancia ma l'errore non è loggato)

### 2. Logging frontend — `src/renderer/pages/work/RicaricaDialog.tsx`

Nel `handleConferma` (chiamata `workApi.ricarica`):
- Log prima della chiamata con i params
- Log del risultato (incluso `new_work_id`)
- Log dell'errore in caso di catch

### 3. Logging frontend — `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (riga 977)

Nel `onSuccess` di `RicaricaDialog`:
- Log prima di `reload()`
- Log del risultato di `schemaCalApi.get(metodoId)` (verifica che `workCols` abbia il nuovo `dbId`)

### 4. Fix robusto: fallback `metodi_ids` nel backend

Se `params.metodi_ids` è vuoto, cercare autonomamente i metodi collegati alla vecchia work via `work_metodi`:
```sql
SELECT metodo_id FROM work_metodi WHERE work_id = ?
```
Questo evita il caso in cui il renderer passi un array vuoto.

---

## File da modificare

| File | Righe chiave | Cosa cambia |
|------|-------------|-------------|
| `src/main/ipc/work.ipc.ts` | 676–901 | try/catch + console.log/error + fallback metodi_ids |
| `src/renderer/pages/work/RicaricaDialog.tsx` | ~200–230 (handleConferma) | console.log params + risultato + errore |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | 977–989 (onSuccess) | console.log reload + saved.workCols |

---

## Verifica

1. Su macOS: aprire DevTools → Console, fare una ricarica work → verificare i log
2. Su Windows: stessa procedura → confrontare se il backend lancia errori
3. Controllare che `saved.workCols` dopo `schemaCalApi.get()` contenga il nuovo `dbId` (diverso da quello vecchio)
4. Controllare che `metodi_ids` nel log del renderer non sia mai `[]`
