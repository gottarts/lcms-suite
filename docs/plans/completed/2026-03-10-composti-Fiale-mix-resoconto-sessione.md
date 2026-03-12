# Resoconto Sessione — FEAT-G: Fiale nei Mix e sincronizzazione per lotto
**Data:** 2026-03-10  
**Branch base:** master  
**DB user_version:** 7 (nessuna migration necessaria)

---

## ✅ Task completati

### G-1 — Campo N fiale nel form Mix
**File modificati:** `MixPesticidiForm.tsx`, `composti.ipc.ts`  
Aggiunto campo "N fiale" al form Mix con valore precompilato `'1'`. Al salvataggio il valore viene propagato come campo `fiala` a tutti i composti generati dal file .txt. Modificato il tipo del payload di `composti:create-mix` per accettare `fiala?: string | null` e aggiornato l'oggetto `common`.

### G-2 — Sincronizzazione fiale per lotto (backend)
**File modificati:** `composti.ipc.ts`  
Aggiunta sincronizzazione automatica dentro la transazione di `composti:update`: quando viene modificato il campo `fiala` su un composto con `lotto` valorizzato, tutti i composti con lo stesso lotto vengono aggiornati allo stesso valore. Se `lotto` è null la sincronizzazione non parte.

### G-3 — Campo fiale nel form edit composto
**File modificati:** nessuno  
Verifica completata: il campo `fiala` era già presente in `CompostoForm.tsx` (label "N° Fiale") e il payload usa `...form`, quindi viene già incluso nell'update. Caso A — nessuna modifica necessaria.

### G-4 — Apertura fiala condivisa per lotto
**File modificati:** `composti.ipc.ts`, `ApriAperturaDialog.tsx`, `CompostiTable.tsx`  
L'handler `composti:apri-fiala` ora legge il lotto del composto e, se valorizzato, crea un evento `apertura_fiala` in `composti_storia` per tutti i composti con lo stesso lotto in una singola transazione. `ApriAperturaDialog` esteso con le prop `compostoLotto` e `conteggioLotto`; mostra un avviso ambra prima dei bottoni quando l'apertura riguarda più di un composto. `CompostiTable` aggiornato per passare lotto e conteggio al dialog.

---

## ⏳ Task non ancora eseguiti

| Task | Note |
|------|------|
| G-5 — Nuovi composti in coda | Una riga in `composti.ipc.ts`: `ORDER BY c.nome` → `ORDER BY c.id ASC` |
| G-6 — Reset sort al terzo click | Una funzione in `DataTable.tsx`: aggiungere il terzo stato `null` a `handleSort` |

---

## 📁 File modificati in questa sessione

| File | Modifica |
|------|----------|
| `src/main/ipc/composti.ipc.ts` | G-1 (create-mix fiala), G-2 (sync lotto), G-4 (apri-fiala per lotto) |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | G-1 (campo N fiale, stato, reset, payload) |
| `src/renderer/pages/composti/ApriAperturaDialog.tsx` | G-4 (prop lotto/conteggio, avviso ambra) |
| `src/renderer/pages/composti/CompostiTable.tsx` | G-4 (lotto in apriTarget, passaggio prop al dialog) |
| `src/renderer/pages/composti/CompostoForm.tsx` | nessuna modifica (campo già presente) |