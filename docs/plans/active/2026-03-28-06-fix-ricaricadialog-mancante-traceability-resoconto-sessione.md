# Resoconto sessione — Fix RicaricaDialog MANCANTE + traceability sostituito_da_id

**Data:** 2026-03-28
**Oggetto:** Chiusura punti #6 e #7 aperti dal resoconto precedente: UX dead-end nel caso MANCANTE di RicaricaDialog e catena di tracciabilità `sostituito_da_id` spezzata nel flusso manuale delete+create.

---

## Cosa è stato fatto

- **Piano in plan mode** per i due punti: identificazione root cause, esempi pratici, design della soluzione.
- **Fix #6 (RicaricaDialog MANCANTE):** aggiunto pulsante "Vai al DB Composti →" per ogni ingrediente senza lotti sostituti, con navigazione diretta al DB Composti filtrato sul nome del composto e con il flag "mostra dismessi" attivo.
- **Fix #7 (traceability sostituito_da_id):** aggiunto IPC `work:set-sostituito-da`, wrapper API e logica in `SchemaCalibrazione` per linkare automaticamente la work archiviata alla nuova quando si fa delete+create nella stessa colonna.

---

## Feature aggiunte / Bug risolti

### Fix #6 — RicaricaDialog: caso MANCANTE non aveva uscita

**Root cause:** Quando un ingrediente CRM non ha nessun lotto sostituto nel DB (stato `mancante`), il pulsante "Conferma e Ricarica" è disabilitato. Non c'era alcuna indicazione su come procedere né navigazione verso la pagina dove aggiungere il lotto mancante. L'utente doveva chiudere, ricordarsi il nome del composto, navigare a mano al DB Composti, aggiungere il lotto, tornare allo schema e riaprire il dialog.

**Fix:** Per ogni ingrediente in stato `mancante`, la sezione del dialog ora mostra un pulsante "Vai al DB Composti →" che:
1. Chiude il dialog (`onClose()`)
2. Naviga a `/composti` con `state: { searchFilter: ing.nome, mostraDismessi: true }`

Il `mostraDismessi: true` è essenziale: il composto il cui lotto è stato dismesso è esso stesso contrassegnato come dismesso nel DB, quindi senza il filtro la tabella risulterebbe vuota.

`CompostiPage` già leggeva `location.state?.searchFilter` per il filtro ricerca; aggiunto analogo per `mostraDismessi`.

### Fix #7 — Traceability: sostituito_da_id spezzato nel flusso manuale

**Root cause:** `workApi.archivia(id, motivo)` non accettava `sostituito_da_id`. Quando il chimico eliminava una work dallo schema e ne creava una nuova nella stessa colonna, la vecchia work veniva archiviata con `motivo='Rimossa dallo schema'` ma `sostituito_da_id=NULL`. La catena di tracciabilità era interrotta.

Contrasto con `work:ricarica` che invece impostava correttamente `sostituito_da_id` nella stessa transazione.

**Fix (3 parti):**
1. Nuovo IPC `work:set-sostituito-da(oldId, newId)`: aggiorna `sostituito_da_id` su una work già archiviata.
2. `workApi.setSostituitoDa(oldId, newId)` aggiunto in `api.ts`.
3. In `SchemaCalibrazione.tsx`: aggiunto `recentlyArchivedByCol = useRef<Map<number, number>>()` che traccia `colIdx → old dbId` al momento della rimozione. Quando viene creata una nuova work nella stessa colonna e si ottiene il `dbId`, viene chiamato `setSostituitoDa(oldDbId, newDbId)` e la entry nel ref viene pulita.

Edge case gestito: se l'utente elimina una work ma non ricrea nulla nella stessa colonna, il ref rimane con la entry ma non causa problemi — la work è già archiviata correttamente senza `sostituito_da_id` (comportamento attuale accettabile). Il ref si svuota al rimount del componente.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Aggiunto handler `work:set-sostituito-da` |
| `src/renderer/lib/api.ts` | Aggiunto `workApi.setSostituitoDa(oldId, newId)` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto `recentlyArchivedByCol` ref; `handleDeleteWork` registra old dbId; `handleSaveWork` chiama `setSostituitoDa` se c'è match di colonna |
| `src/renderer/pages/work/RicaricaDialog.tsx` | Importato `useNavigate`; sezione MANCANTE: aggiunto pulsante "Vai al DB Composti →" con navigazione filtrata |
| `src/renderer/pages/composti/CompostiPage.tsx` | `useState(mostraDismessi)` ora legge `location.state?.mostraDismessi` come valore iniziale |
| `docs/plans/active/2026-03-28-feat-flusso-operatore-blocco-ambiguita-resoconto-sessione.md` | Aggiornati punti #6 e #7: da ⚠️/🔴 a ✅ con descrizione implementazione |

---

## Note per sessioni future

- La catena `sostituito_da_id` è ora mantenuta sia nel flusso automatico (ricarica lotti) che in quello manuale (delete+create). Il vincolo rimane solo applicativo (non DB).
- `salvaWorkNelDb` chiama ancora sempre `work:create` anche per lavori di sola modifica parametri — nessun path UI di edit in-place esposto; lasciato aperto.
- Riferimento piano sessione: `docs/plans/active/2026-03-28-fix-ricaricadialog-mancante-traceability-plan.md`
