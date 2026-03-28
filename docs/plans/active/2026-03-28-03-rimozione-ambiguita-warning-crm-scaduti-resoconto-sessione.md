# Resoconto sessione — Rimozione blocco ambiguità + warning CRM scaduti nelle Work

**Data:** 2026-03-28
**Oggetto:** Semplificazione meccanismo di blocco delle Work: rimosso il falso blocco "ambiguo", aggiunto warning per CRM scaduti in works esistenti.

---

## Cosa è stato fatto

- Analizzato il meccanismo di blocco Work esistente: identificato che il caso `ambiguo` (più lotti attivi stesso nome) era un falso positivo perché la work punta già via `source_id` al CRM specifico scelto dall'operatore.
- Rimosso il blocco `ambiguo` — le work ora sono bloccate solo se un CRM è stato **dismesso**.
- Aggiunto rilevamento di CRM scaduti in works esistenti (`ha_crm_scaduti`): warning non bloccante, visibile come badge giallo nella card e banner giallo nel drawer.
- Bugfix scoperto in corso: la query scaduti escludeva i componenti di mix (`mix_id IS NULL`) copiando la logica di SchemaCalibrazione che era per un contesto diverso. Rimossa la condizione — i mix scaduti vengono rilevati correttamente.

---

## Feature aggiunte / Bug risolti

### Rimozione blocco "ambiguo"
**Root cause:** La logica contava quante work avevano più CRM attivi con lo stesso nome e le bloccava. Questa condizione era superflua: `work_ingredienti.source_id` identifica già univocamente il CRM usato. L'operatore aveva scelto volutamente quel CRM alla creazione.
**Fix:** Rimossa subquery `n_ingredienti_ambigui` dalla query LIST e la logica corrispondente dal mapping. Nel GET, rimosso calcolo `nAmbigui`. `motivo_blocco` ora ha solo valori `'dismesso' | null`.

### Warning CRM scaduti
**Motivazione:** Un CRM può scadere dopo la creazione della work senza essere dismesso. Questo caso non era segnalato. Unica ambiguità sensata rimasta secondo l'analisi dell'utente.
**Implementazione:**
- `work.ipc.ts` LIST: aggiunta subquery `n_ingredienti_scaduti` (CRM non dismessi, `scadenza_prodotto < oggi`, nessuna rivalidazione valida)
- `work.ipc.ts` GET: aggiunta query SQL equivalente, risultato in `work.ha_crm_scaduti`
- `WorkPage.tsx`: badge giallo "CRM scaduti" sulla card (solo se non bloccata)
- `WorkDrawer.tsx`: banner giallo "Uno o più CRM risultano scaduti" (non blocca la preparazione)
- `types.ts`: aggiunto `ha_crm_scaduti?: boolean`, rimosso `'ambiguo'` dall'union di `motivo_blocco`

### Bugfix: mix escluse dal rilevamento scadenza
**Root cause:** La query `n_ingredienti_scaduti` includeva `AND c.mix_id IS NULL` copiato dalla logica di `SchemaCalibrazione.logic.ts`. In SchemaCalibrazione quel filtro serve per non escludere le mix scadute dallo schema (le mix scadute possono ancora essere usate). Nelle work invece volevamo rilevare anche i componenti di mix scaduti.
**Fix:** Rimossa la condizione `AND c.mix_id IS NULL` da entrambe le query (LIST e GET). Verificato sul DB reale: la mix IA16 lotto 25DILC190A (scadenza 2026-03-13) è in una work e ora viene rilevata correttamente.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Rimossa logica ambiguo (LIST + GET), aggiunta logica scaduti con `ha_crm_scaduti` |
| `src/shared/types.ts` | `Work.motivo_blocco` senza `'ambiguo'`, aggiunto `ha_crm_scaduti` |
| `src/renderer/pages/work/WorkPage.tsx` | Badge giallo CRM scaduti in WorkCard |
| `src/renderer/pages/work/WorkDrawer.tsx` | Banner giallo CRM scaduti, rimosso ramo ambiguo |
| `docs/plans/active/new draft.md` | Modificato durante la sessione (note utente) |

---

## Note per sessioni future

- Il campo `n_lotti_validi_stesso_nome` resta nella query GET ingredienti (non usato attivamente ora che `ambiguo` è rimosso) — non causa problemi ma potrebbe essere pulito in futuro se mai si facesse un refactor della query.
- Il flusso "Ricarica lotti" (`RicaricaDialog.tsx`) rimane invariato: gestisce correttamente il caso CRM dismesso, creando una nuova work e archiviando la vecchia.
- La segnalazione CRM scaduti è intenzionalmente un **warning** (giallo), non un **blocco** (rosso). L'utente può ancora preparare la work — sta a lui valutare se procedere o aggiornare il CRM.
- Piano di sessione: `docs/plans/active/2026-03-28-rimozione-ambiguita-warning-crm-scaduti-plan.md`
