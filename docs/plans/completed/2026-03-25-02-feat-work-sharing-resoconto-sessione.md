# Resoconto sessione — Feature B: Work Sharing tra Metodi

**Data:** 2026-03-25
**Oggetto:** Implementazione UI per importare work esistenti da altri metodi nello schema di calibrazione corrente

---

## Cosa è stato fatto

Implementata la Feature B (work sharing tra metodi) prevista nel piano `2026-03-25-feat-gestione-lotti-work-plan.md`. L'infrastruttura DB (`work_metodi` molti-a-molti) era già pronta dalla sessione precedente; in questa sessione è stata costruita tutta l'UI e la logica necessaria per importare una work esistente nello schema di un nuovo metodo.

---

## Feature aggiunte

### Importa Work esistente in SchemaCalibrazione
**Motivazione:** Una work (soluzione di lavoro) può servire più metodi analitici. Senza questa feature, l'operatore doveva ricreare manualmente una work identica in ogni schema, duplicando dati e perdendo la tracciabilità condivisa.

**Implementazione:**
- **Backend:** 2 nuovi handler IPC:
  - `work:list-for-import(metodoId)` — ritorna tutte le work non-archiviate non ancora collegate al metodo, con ingredienti e nomi metodi (JOIN su tabella `metodi`)
  - `work:add-to-metodo(workId, metodoId)` — INSERT OR IGNORE nella junction table `work_metodi`
- **Logica:** 2 nuove funzioni in `SchemaCalibrazione.logic.ts`:
  - `verificaCompatibilitaCrm()` — verifica quali CRM della work sono presenti nello schema corrente
  - `ricostruisciWorkInSchema()` — converte un record DB work in un oggetto `WorkInSchema` in-memory, ricostruendo `srcs` (SorgenteSel) e `vols` (Ingrediente) dagli ingredienti DB. Gestisce deduplicazione mix, mapping sng, e dipendenze da altre work.
- **UI:** Nuovo componente `ImportaWorkDialog.tsx` — dialog modale con:
  - Lista filtrata per nome delle work importabili
  - Chip con nomi metodi associati (non ID tecnici)
  - Check compatibilità CRM: verde se tutti presenti, arancione warning se la work ha CRM extra non nello schema (importazione permessa comunque), rosso bloccante solo per dipendenze work mancanti
  - Bottone "Importa" che crea il link DB e inserisce la work nella colonna corretta dello schema
- **Integrazione:** Bottone "Importa Work" (stile outline) nella barra inferiore di SchemaCalibrazione, accanto a "+ Crea Work". Sempre abilitato (non richiede selezione sorgenti). L'auto-save su `workCols` persiste automaticamente la work importata.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | +2 handler: `work:list-for-import`, `work:add-to-metodo` |
| `src/renderer/lib/api.ts` | +2 metodi: `listForImport`, `addToMetodo` in `workApi` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | +2 funzioni: `verificaCompatibilitaCrm`, `ricostruisciWorkInSchema` |
| `src/renderer/pages/metodi/ImportaWorkDialog.tsx` | **Nuovo** — dialog di importazione work |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | +stato `importOpen`, +handler `handleImportWork`, +bottone e render dialog |

---

## Note per sessioni future

- **CRM extra warning:** quando una work ha CRM non presenti nello schema del metodo target, l'importazione è permessa con warning arancione. I CRM extra non avranno connessioni SVG nello schema — questo è intenzionale e documentato nel dialog.
- **Dipendenze work gerarchiche:** se una work dipende da un'altra work (source_type='work') non presente nello schema, l'import è bloccato. L'utente deve importare prima la dipendenza. Un'evoluzione futura potrebbe implementare import ricorsivo automatico.
- **Piano originale:** `docs/plans/active/2026-03-25-feat-gestione-lotti-work-plan.md` — la sezione "Feature B" è ora implementata.
- **Errore TS pre-esistente:** `SchemaCalibrazione.logic.ts:256` ha un errore di tipo nel `flatMap` di `salvaWorkNelDb` — pre-esistente, non introdotto in questa sessione.
