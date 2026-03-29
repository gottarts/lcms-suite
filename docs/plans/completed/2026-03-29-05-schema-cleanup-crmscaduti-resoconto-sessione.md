# Resoconto sessione — Schema Calibrazione: cleanup UI + CRM scaduti ricaricabili + toast archiviazione

**Data:** 2026-03-29
**Oggetto:** Pulizia feature superate nello Schema Calibrazione, estensione Ricarica ai CRM scaduti, toast post-archiviazione

---

## Cosa è stato fatto

Tre aree di intervento indipendenti:

1. **Pulizia UI Schema Calibrazione** — rimossa la step bar (step 1-4) e il pulsante "Ricarica ↻" dalla bottom bar in quanto ritenuti superati dal flusso attuale. Rimosso anche il meccanismo di cancellazione manuale delle chip CRM (pulsante × su mix e singoli) e il warning "Ci sono analiti con sia mix che singolo".

2. **CRM scaduti ricaricabili** — esteso il backend `work:check-lot-status` per trattare i CRM scaduti (non solo quelli dismessi) come candidati alla sostituzione. Il pulsante "Ricarica ↻" sulle card Work nello Schema ora appare anche per `haScaduti` (colore ambra anziché arancione).

3. **Toast post-archiviazione** — dopo che la RicaricaDialog completa con successo (archivia la vecchia work e crea la nuova), viene mostrato un toast non bloccante: "Work aggiornata. La precedente versione è stata archiviata."

---

## Feature aggiunte / Rimozioni

### Rimozione step bar Schema Calibrazione
**Motivazione:** La step bar (Lettura CRM → Rimuovi CRM indesiderati → Seleziona sorgenti → Crea Work) non riflette più il flusso attuale basato su selezione.
**Implementazione:** Rimossi `stepStatus`, `steps`, il blocco JSX step bar, il pulsante "Ricarica ↻" dalla bottom bar, `handleReloadSchema`, e il ConfirmDialog era stato semplificato per gestire solo 'full'.

### Rimozione meccanismo cancellazione chip CRM (×)
**Motivazione:** Il flusso corretto è selezionare le sorgenti per creare work, non rimuovere manualmente chip. Il meccanismo era una feature superata che creava confusione.
**Implementazione:**
- `removedCon` (Set singoli rimossi manualmente) completamente eliminato da state, caricamento, salvataggio, interfacce.
- `removeCon`, `removeMix` callbacks eliminate.
- Pulsante `×` rimosso dalle card singoli e dai blocchi mix nella `GrigliaAnalitiCrm`.
- `hasCon` computed e warning nella bottom bar eliminati.
- `canBeSrc` (che bloccava il click se `hasCon`) eliminato — le work sono sempre clickabili.
- Stile "duplicato" (`C.con.*`) sulle card singoli rimosso.
- `removedMix` **mantenuto**: serve allo scenario per nascondere i mix non selezionati dallo `ScenarDialog`. Solo il pulsante × manuale è stato rimosso.

### CRM scaduti ricaricabili
**Motivazione:** La Ricarica funzionava solo per CRM dismessi; i CRM scaduti mostravano solo un banner informativo senza azione possibile.
**Root cause:** `work:check-lot-status` restituiva `stato: 'ok'` per tutti gli ingredienti non dismessi, ignorando lo stato di scadenza.
**Implementazione:**
- Aggiunta query `scadenza_prodotto` e `ultima_rivalidazione` nella SELECT di `work:check-lot-status`.
- Logica `isScaduto`: CRM è "da sostituire" se `scadenza_prodotto < oggi` E nessuna rivalidazione attiva valida.
- Query sostituti ora filtra anche i candidati scaduti (stessa formula).
- Pulsante "Ricarica ↻" nelle card Work dello Schema: condizione `(isBloccata || haScaduti) && w.dbId`. Colore: arancione per dismessi, ambra per scaduti.

### Toast post-archiviazione da Ricarica
**Motivazione:** Dopo la Ricarica, la vecchia work spariva silenziosamente. L'utente non aveva conferma visiva dell'archiviazione.
**Implementazione:** Aggiunto state `toastMsg`, impostato nell'`onSuccess` di RicaricaDialog con `setTimeout` da 4 secondi. Overlay fisso in fondo allo schermo, stile dark con ✓ verde.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Rimossi step bar, pulsante Ricarica, removedCon, hasCon, removeCon, removeMix, canBeSrc, warning; aggiunto toast; esteso pulsante Ricarica a haScaduti |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rimossi props removedCon, onRemoveCon, onRemoveMix; rimosso pulsante × da singoli e mix; rimosso stile isCon; rimosso isCon dal render singoli |
| `src/main/ipc/work.ipc.ts` | `work:check-lot-status`: aggiunta logica scaduti; query sostituti filtra scaduti |
| `docs/plans/active/new draft.md` | File note future (preesistente, non modificato in sessione) |

---

## Note per sessioni future

- `removedMix` è ancora nello state e nel salvataggio schema — serve per il filtraggio post-scenario. Non rimuoverlo.
- Il meccanismo di ricarica per scaduti usa la stessa `RicaricaDialog` dei dismessi: se la dialog dovesse essere specializzata in futuro (es. messaggio diverso), andrà biforcata.
- Il toast è implementato in-component senza sistema globale. Se si aggiungono altri punti che richiedono notifiche, valutare l'introduzione di un toast provider condiviso.
- Piano di sessione: `~/.claude/plans/noble-roaming-forest.md` (copiato in `docs/plans/active/2026-03-29-schema-cleanup-crmscaduti-plan.md`).
