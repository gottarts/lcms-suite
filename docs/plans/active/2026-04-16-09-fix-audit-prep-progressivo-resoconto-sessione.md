# Resoconto sessione — Fix Audit CRM: progressivo prep e allineamento tracciabilità

**Data:** 2026-04-16
**Oggetto:** Correzione discrepanza tra dati prep mostrati nell'Audit CRM e nella Catena di Tracciabilità di WorkPage

---

## Cosa è stato fatto

Investigazione e fix di una discrepanza segnalata dall'utente: l'Audit CRM mostrava `prep: 5` mentre WorkPage mostrava `prep #3` per la stessa preparazione Neat della work archiviata `is`.

L'indagine ha richiesto query dirette al DB SQLite per isolare la causa, dopo vari tentativi basati su ipotesi errate (bug di logica in auditModel, dati corrotti, prep diverse).

---

## Bug risolti

### Audit CRM mostra numero flacone invece di progressivo preparazione

**Root cause:**
L'Audit CRM mostrava `preparazioni.flacone` (il numero fisico del flacone, es. `'5'`) per identificare la preparazione Neat, mentre WorkPage mostra il **progressivo calcolato** (COUNT delle prep dello stesso composto con `id <= prep_id`, es. `#3`). Erano due rappresentazioni diverse della stessa prep.

La query in `dashboard.ipc.ts` non calcolava il progressivo (`source_prep_progressivo`), a differenza di `work.ipc.ts` che lo aveva già. Il rendering in `AuditCrmSection.tsx` e `auditReport.ts` usava direttamente `prep_flacone`.

**Fix:**
- Aggiunto `source_prep_progressivo` alla query `stmtIngredienti` in `dashboard.ipc.ts`, con la stessa logica COUNT di `work.ipc.ts`
- Aggiunto `prep_progressivo` al tipo `CrmUsato` in `auditModel.ts` e propagato nel modello
- Sostituito `prep: {flacone}` con `prep #{progressivo}` in `AuditCrmSection.tsx`
- Stessa sostituzione in `auditReport.ts` per il PDF

### Indagine approfondita su discrepanza date scadenza

Durante l'indagine sono emerse altre ipotesi (poi scartate):
- Ipotesi iniziale: bug di logica in `auditModel.ts` (precedenza prep scaduta su quella valida) → applicato e poi revertito un fix errato
- Ipotesi intermedia: dati corrotti nel DB (prep `id=4` ha `scadenza='2026-04-05'` con `data_prep='2026-04-08'`) → confermato essere un dato errato storicamente, ma non la causa della discrepanza UI
- Causa vera identificata solo con query dirette al DB: la work mostrata in audit (`56`, archiviata) era diversa da quella in WorkPage (`59`, attiva), stessa spiegazione per la scadenza `05/04/2026` vs `10/05/2026`

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/dashboard.ipc.ts` | Aggiunto `source_prep_progressivo` nella query `stmtIngredienti` |
| `src/renderer/pages/dashboard/lib/auditModel.ts` | Aggiunto `prep_progressivo` a tipo `CrmUsato` e `PrepInfo`; propagato nel modello |
| `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx` | Sostituito `prep: {flacone}` con `prep #{progressivo}` |
| `src/renderer/pages/dashboard/lib/auditReport.ts` | Stessa sostituzione per il PDF |

---

## Note per sessioni future

- La prep `id=4` nel DB ha una scadenza (`2026-04-05`) antecedente alla data di preparazione (`2026-04-08`) — dato errato, probabilmente inserito manualmente. Non impatta il codice ma potrebbe confondere audit futuri.
- Il campo `preparazioni.flacone` contiene il numero fisico del flacone (es. `'1'`, `'5'`), mentre il progressivo è calcolato dinamicamente come COUNT. I due valori NON coincidono necessariamente — `flacone='5'` può avere progressivo `3` se alcune prep dello stesso composto sono state eliminate o hanno ID non contigui.
- L'Audit CRM mostra solo work con almeno una riga in `work_preparazioni` con `data_prep <= @data` — work attive non ancora preparate fisicamente non compaiono nell'audit.
