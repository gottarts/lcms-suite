# Resoconto sessione — Debug ricarica chips work (Windows)

**Data:** 2026-04-16
**Oggetto:** Aggiunta logging diagnostico e fix robusto per la funzionalità "Ricarica ↻" nelle chips work di SchemaCalibrazione, sospettata di non funzionare su Windows.

---

## Cosa è stato fatto

- Analisi del flusso completo di ricarica: `RicaricaDialog` → IPC `work:ricarica` → aggiornamento `schema_json` → `onSuccess` nel renderer
- Identificati 3 problemi potenziali (vedi sotto)
- Aggiunti log diagnostici su tutta la catena (renderer + main process)
- Applicato fix robusto per il caso `metodi_ids` vuoto
- Verificato su macOS: i log mostrano funzionamento corretto (`metodi_ids` popolato, transazione ok, `new_work_id` restituito correttamente)

---

## Bug risolti / Feature aggiunte

### Logging diagnostico completo
**Motivazione:** La funzionalità non aveva alcun logging — impossibile diagnosticare fallimenti su Windows senza DevTools aperte.
**Implementazione:**
- `RicaricaDialog.tsx`: log all'apertura (`workId`, `lotStatus`, `metodi_ids`), log dei params prima di `work:ricarica`, log del risultato, `catch` esplicito con `console.error`
- `SchemaCalibrazione.tsx`: `onSuccess` ora riceve `newWorkId`, log prima di `reload()`, log del `workCols` ricaricato dal DB
- `work.ipc.ts`: log all'ingresso, `try/catch` con `console.error` attorno alla transazione SQLite, log di successo

### Fix robusto: fallback `metodi_ids` nel backend
**Root cause / Motivazione:** Se il renderer passa `metodi_ids` vuoto (per qualsiasi motivo — timing, stato stale), il ciclo `for (const mid of params.metodi_ids)` non esegue nulla. Risultato: la nuova work esiste nel DB ma `schema_json` punta ancora al vecchio `dbId`, e il badge "Ricarica ↻" resta visibile.
**Fix:** In `work.ipc.ts`, se `params.metodi_ids` è vuoto, li recupera autonomamente:
```sql
SELECT metodo_id FROM work_metodi WHERE work_id = old_work_id
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/RicaricaDialog.tsx` | Log apertura dialog + params ricarica + risultato + catch esplicito |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `onSuccess` riceve `newWorkId`, log reload + schema ricaricato |
| `src/main/ipc/work.ipc.ts` | Log ingresso/uscita, try/catch transazione, fallback `metodi_ids` da `work_metodi` |

---

## Note per sessioni future

### Come leggere i log su Windows
- **Main process (backend):** nella finestra terminale da cui è stato lanciato `npm run dev`, oppure DevTools del main process
- **Renderer:** `Ctrl+Shift+I` nella finestra dell'app → tab Console

### Log chiave da controllare su Windows
1. `[work:ricarica] metodi_ids era vuoto` → conferma Problema 2 (metodi_ids non passato)
2. `[work:ricarica] ERRORE transazione:` → conferma Problema 1 (SQLite locking su Windows)
3. `[SchemaCalibrazione] schema ricaricato dal DB:` → verificare che `workCols` contenga il nuovo `dbId`

### Stato su macOS (verificato)
I log mostrano funzionamento corretto: `metodi_ids=["met_mn32t85n"]`, transazione ok, `new_work_id=59`. Il problema su Windows resta da verificare con questa build.

### Piano: `docs/plans/active/2026-04-16-06-debug-ricarica-chips-work-windows-plan.md`
