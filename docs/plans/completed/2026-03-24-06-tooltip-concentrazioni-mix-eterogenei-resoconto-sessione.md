# Resoconto sessione — Tooltip concentrazioni mix eterogenei + fix visualizzazione

**Data:** 2026-03-24
**Oggetto:** Tooltip concentrazioni composti per sorgenti variabili nel form Crea Work + fix visualizzazione concentrazione mix eterogenei

---

## Cosa è stato fatto

- Aggiunto tooltip "ⓘ" con lista composti+concentrazioni in tre punti dove una sorgente/mix a concentrazioni eterogenee veniva mostrata solo come "variabile" senza dettaglio
- Corretto un bug dove la card mix nella griglia mostrava la concentrazione del primo componente come se fosse la concentrazione del mix intero, anche per mix eterogenei
- Corretta la catena di tracciabilità nel drawer delle work (foglie CRM con mix eterogenei mostravano `X mg/L` invece di "variabile")
- Corretto `CrmItem.concVariabile` hardcoded a `false`: ora viene calcolato correttamente dopo il mapping

**Regola fondamentale rafforzata**: un mix con composti a concentrazioni diverse NON ha una concentrazione propria — va mostrata solo la concentrazione per-composto. Questa regola è ora rispettata in tutti i punti della UI.

---

## Bug risolti / Feature aggiunte

### Fix: card mix nella griglia mostrava concentrazione errata per mix eterogenei
**Root cause:** `mixInfo.get(a.mixId)` restituisce il primo `CrmItem` del mix; il codice usava `info?.cv` incondizionatamente, mostrando la cv del primo componente come se fosse la concentrazione omogenea dell'intero mix.
**Fix:** Aggiunta mappa `mixCvSets` che traccia i cv distinti per mix_id. La concentrazione viene mostrata solo se `mixCvSets.get(a.mixId)?.size <= 1` (mix omogeneo).

### Feature: tooltip "ⓘ" nel form ModalCreaWork per sorgenti variabili
**Motivazione:** L'utente vedeva solo "variabile" senza poter sapere quali composti ci sono e a che concentrazione.
**Implementazione:**
- `ModalCreaWork` ora riceve `crmItems: CrmItem[]` come prop aggiuntiva
- Per sorgente di tipo `mix`: lista da `crmItems.filter(c => c.mix_id === s.id)`
- Per sorgente di tipo `work`: lista da `getCompsFromWork(w, workCols, crmItems)` (già disponibile in logic.ts)
- Tooltip nativo (`title`) con "ⓘ" accanto al label "variabile", consistente con lo stile dei pulsanti esistenti

### Fix: catena di tracciabilità nel drawer work
**Root cause:** `ChainNode` renderizzava sempre `{src.cv} mg/L · CRM` per le foglie CRM, senza controllare `src.concVariabile`.
**Fix:** Se `src.concVariabile = true`, mostra `variabile ⓘ · CRM` con tooltip che elenca i composti del mix da `crmItems.filter(c => c.mix_id === src.id)`.

### Bonus fix: CrmItem.concVariabile hardcoded a false
**Root cause:** Nel mapping dei CRM in `useSchemaData`, `concVariabile` era sempre `false`. Non impattava il flusso principale (SorgenteSel.concVariabile è calcolato indipendentemente in `toggleMix`), ma i dati erano scorretti.
**Fix:** Dopo il mapping degli items, si rilevano i mix eterogenei e si aggiorna `concVariabile` correttamente.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Aggiunta mappa `mixCvSets`; fix riga concentrazione mix card; aggiunto `crmItems` a `ModalProps`; import `getCompsFromWork`; tooltip "ⓘ" nel loop sorgenti |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Passato `crmItems` a `<ModalCreaWork>`; fix `ChainNode` foglie CRM con mix eterogenei |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Fix `CrmItem.concVariabile`: calcolato dopo mapping con rilevamento mix eterogenei |

---

## Note per sessioni future

- Tutti e tre i punti di visualizzazione della concentrazione mix erano sbagliati; ora sono tutti corretti. Se si aggiungono nuovi punti di visualizzazione, ricordare la regola: mix eterogeneo → no concentrazione unica.
- Il tooltip usa `title` nativo del browser (non un componente custom). Funziona ma ha aspetto dipendente dall'OS. Se si vuole un tooltip più ricco in futuro, considerare un componente React dedicato.
- Piano di riferimento: `docs/plans/active/2026-03-24-tooltip-concentrazioni-mix-eterogenei-plan.md`
