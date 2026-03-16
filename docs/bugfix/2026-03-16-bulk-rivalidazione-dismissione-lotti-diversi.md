# Bugfix Report — 2026-03-16 (sessione pomeriggio)

**Branch:** `master`  
**DB user_version:** 10 (invariato — nessuna migration necessaria)

---

## Bug risolti

### BUG-1 — Rivalidazione/Dismissione bulk su mix non eseguita (Critical)

**File:** `src/renderer/components/shared/ConfirmDialog.tsx`

**Sintomo:** selezionando componenti di mix diversi e avviando rivalidazione o dismissione bulk, il dialog mix-scope appariva correttamente ma alla conferma spariva senza eseguire nulla. La storia non veniva scritta nel DB e lo stato non si aggiornava.

**Causa:** `ConfirmDialog` era basato su `AlertDialog` di Radix UI. `AlertDialogAction` ha un comportamento nativo: al click triggera automaticamente la chiusura del dialog chiamando `onOpenChange(false)`, che nel componente era collegato a `onCancel()` → `handleMixScopeCancel()`. Questo azzerava `pendingBulkOpRef.current = null` e svuotava la coda mix-scope **dopo** il click su "Tutti del mix" o "Solo i selezionati", prima che `execStoria` potesse girare.

**Fix:** sostituito `AlertDialog` con `Dialog` standard di Radix. Con `Dialog`, i bottoni non hanno nessun comportamento nativo di chiusura — la chiusura avviene solo quando il codice chiama esplicitamente `onCancel()` o `onConfirm()`. Aggiunto `onPointerDownOutside={e => e.preventDefault()}` per impedire chiusure accidentali durante il flusso mix-scope.

```tsx
// Prima
<AlertDialog open={open} onOpenChange={v => !v && onCancel()}>
  <AlertDialogContent>
    ...
    <AlertDialogAction onClick={onConfirm}>...</AlertDialogAction>
  </AlertDialogContent>
</AlertDialog>

// Dopo
<Dialog open={open} onOpenChange={v => !v && onCancel()}>
  <DialogContent onPointerDownOutside={e => e.preventDefault()}>
    ...
    <Button onClick={onConfirm}>...</Button>
  </DialogContent>
</Dialog>
```

---

### BUG-2 — `api.ts`: firma `addStoria` incompleta (Medium)

**File:** `src/renderer/lib/api.ts`

**Sintomo:** errori TypeScript su `compostiApi.addStoria(id, { ...payload, propagate: true })` e su payload con `nuova_scadenza` — i campi non erano dichiarati nella firma del metodo.

**Causa:** la firma di `addStoria` in `compostiApi` non includeva `nuova_scadenza` né `propagate`, che erano stati aggiunti al backend IPC in sessioni precedenti ma non aggiornati nel wrapper frontend.

**Fix:** aggiornata la firma con i due campi opzionali:

```ts
// Prima
addStoria: (compostoId: number, data: {
  tipo: string; data: string; note?: string;
  n_registro_qc?: string; batch_analitico?: string; lotto_crm_valido?: string
}) => ...

// Dopo
addStoria: (compostoId: number, data: {
  tipo: string; data: string; note?: string;
  n_registro_qc?: string; batch_analitico?: string; lotto_crm_valido?: string;
  nuova_scadenza?: string;
  propagate?: boolean;
}) => ...
```

---

### BUG-3 — Rivalidazione dal pannello laterale applicava a tutto il mix senza avvertire (Medium)

**File:** `src/renderer/pages/composti/CompostoPanel.tsx`

**Sintomo:** cliccando "Rivalidazione" dal tab Storico del pannello laterale su un componente di un mix, l'evento veniva applicato silenziosamente a tutti i componenti del mix senza chiedere conferma.

**Causa:** `handleStoriaSubmit` chiamava direttamente `composti:storia-add` con `propagate: true` (default backend), che propaga a tutto il mix senza nessun dialog intermedio.

**Fix:** rinominato in `handleStoriaConfirm`. Se il composto ha `mix_id`, prima di salvare apre un `ConfirmDialog` con tre opzioni: "Solo questo componente" (`propagate: false`), "Tutto il mix" (`propagate: true`), "Annulla". Il form si chiude subito e il payload viene tenuto in `pendingStoriaPayload` in attesa della scelta. Un avviso testuale nel form segnala che il composto è parte di un mix.

---

## Feature — Lotto CRM e nuova scadenza per-mix nella rivalidazione bulk

**File:** `src/renderer/pages/composti/CompostiPage.tsx`, `src/renderer/pages/composti/StoriaDialog.tsx`

**Problema:** durante la rivalidazione bulk di mix diversi, tutti i mix ricevevano lo stesso lotto CRM e la stessa nuova scadenza inseriti nel `StoriaDialog` iniziale. Non era possibile differenziare per lotto.

**Soluzione:** flusso a due passi.

**Passo 1 — `StoriaDialog` bulk:** i campi "Lotto CRM valido" e "Nuova data di scadenza" vengono nascosti quando `isBulk={true}` e tipo è Rivalidazione. Al loro posto appare un banner blu che informa che si specificano nel passo successivo. I campi comuni (data, QC, batch, note) restano visibili e si applicano a tutti.

**Passo 2 — `MixRivalidaDialog`:** nuovo componente dedicato che appare in sequenza per ogni mix parzialmente selezionato durante una rivalidazione bulk. Mostra le info del mix (lotto, N selezionati di M totali), carica i lotti CRM validi da DB tramite `composti:lotti-validi` sul primo componente del mix, e presenta:
- Select lotti CRM validi (con fallback input manuale se nessuno disponibile)
- Campo nuova data di scadenza
- Tre bottoni: "Annulla", "Solo i N selezionati", "Tutti gli M del mix"

I valori per-mix vengono salvati in `mixScopeDecisionsRef` insieme alla decisione di scope e usati da `execStoria` al momento dell'esecuzione, con fallback ai valori globali del payload se non specificati.

**Modifiche strutturali a `CompostiPage`:**

Il tipo `MixScopeDecision` è stato esteso da `'selected' | 'all'` a `{ scope, lotto_crm_valido?, nuova_scadenza? }`. Il tipo `MixScopeItem` include ora `firstCompostoId` per caricare i lotti da DB. `startBulkWithMixScope` accetta un flag `isRivalidazione` per instradare il dialog corretto. Per le dismissioni e i delete, continua a usare il `ConfirmDialog` generico.

---

## File modificati

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/renderer/components/shared/ConfirmDialog.tsx` | 🔧 Modificato | Sostituito `AlertDialog` con `Dialog` — fix chiusura automatica Radix |
| `src/renderer/lib/api.ts` | 🔧 Modificato | Aggiunto `nuova_scadenza` e `propagate` alla firma di `addStoria` |
| `src/renderer/pages/composti/CompostoPanel.tsx` | 🔧 Modificato | Dialog conferma mix prima di salvare storia; avviso nel form |
| `src/renderer/pages/composti/CompostiPage.tsx` | 🔧 Modificato | `MixRivalidaDialog`; `MixScopeDecision` esteso; lotto/scadenza per-mix in `execStoria` |
| `src/renderer/pages/composti/StoriaDialog.tsx` | 🔧 Modificato | Prop `isBulk`; lotto/scadenza nascosti in bulk rivalidazione |

---

## Stato Database

```
user_version = 10 (invariato)
```

Nessuna migration necessaria. Tutte le modifiche sono frontend.

---

## Git

```bash
git add src/renderer/components/shared/ConfirmDialog.tsx
git add src/renderer/lib/api.ts
git add src/renderer/pages/composti/CompostoPanel.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/renderer/pages/composti/StoriaDialog.tsx

git commit -m "fix(bulk): rivalidazione/dismissione mix non eseguita; lotto CRM per-mix; conferma mix da pannello laterale"
```