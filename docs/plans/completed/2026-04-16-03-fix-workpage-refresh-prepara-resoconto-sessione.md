# Resoconto sessione — Fix refresh WorkPage dopo Prepara/Rinnova

**Data:** 2026-04-16
**Oggetto:** Fix: dopo la conferma del dialog "Prepara/Rinnova", la lista work non si aggiornava automaticamente

---

## Cosa è stato fatto

Identificata e corretta la root cause per cui dopo il salvataggio di una preparazione in WorkPage la riga non si aggiornava senza ricaricare il modulo. Il fix usa un contatore per work (`prepCount`) per forzare il remount del componente `WorkRow` interessato, garantendo il reload dello storico locale.

---

## Bug risolti / Feature aggiunte

### Fix: refresh immediato lista work dopo Prepara/Rinnova

**Root cause:**
`WorkRow` ha uno stato locale `storico` caricato una sola volta al mount tramite `useEffect(…, [])`. Quando `handlePrepara` completava e chiamava `load(mostraArchivio)`, il padre (`WorkPage`) ricaricava correttamente `works` aggiornando le props di `WorkRow` (badge stato, ultima_preparazione), ma il `useEffect` con dipendenze vuote non si rieseguiva — lo storico espanso restava fermo all'elenco pre-salvataggio.

Il meccanismo `useDbChange` ascolta solo `db:external-change` emesso dal main process quando il file `.db` cambia su disco (sync multi-PC), non per scritture IPC locali — quindi non era di aiuto qui.

**Fix:**
- Aggiunto stato `prepCount: Record<number, number>` in `WorkPage`
- In `handlePrepara`: salvato `workId` prima dell'await, poi dopo il salvataggio incrementato `prepCount[workId]`
- Nella lista `WorkRow`: key cambiata da `w.id` a `` `${w.id}-${prepCount[w.id] ?? 0}` ``

React interpreta il cambio di key come nuovo componente: fa unmount+remount della `WorkRow` interessata, che ricarica `storico` da DB. Le altre righe non vengono toccate (key invariata).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/WorkPage.tsx` | Aggiunto stato `prepCount`, aggiornato `handlePrepara`, aggiornata key di `WorkRow` |

---

## Note per sessioni future

- Il remount via key è intenzionale e corretto qui: `WorkRow` è un componente con stato locale derivato da DB, non da props — il pattern è lo stesso usato altrove per forzare il reset di form.
- Se in futuro si volesse evitare il remount completo, alternativa: esporre una callback `onRefreshStorico` che `WorkRow` registra via `useImperativeHandle` — ma è più complesso senza vantaggi evidenti.
- Piano di sessione: `docs/plans/active/2026-04-16-03-fix-workpage-refresh-prepara-plan.md`
