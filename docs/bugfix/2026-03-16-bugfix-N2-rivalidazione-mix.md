# Bugfix Report — 2026-03-16

---

## Bug 1 — Bulk storia: N² record per mix (Critical)

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

**Sintomo:** selezionando N componenti dello stesso mix e applicando Rivalidazione o Dismissione in bulk, venivano creati N² record in `composti_storia`. Con 5 componenti selezionati su 5: 25 record invece di 5.

**Causa:** `handleBulkStoria` chiamava `compostiApi.addStoria(id, payload)` per ogni ID selezionato. Il backend `composti:storia-add` propaga già la storia a tutti i componenti del mix per ogni chiamata. N chiamate × N propagazioni = N² record.

**Fix:** riscrittura completa della logica bulk con sistema di coda mix-scope sequenziale (vedi Bug 3). Per il caso "tutto il mix", viene inviata una sola chiamata per mix — il backend propaga. Per il caso "solo i selezionati", viene passato `propagate: false` su ciascun ID selezionato.

---

## Bug 2 — Import dialog: success screen su fallimento totale (Medium)

**File:** `src/renderer/pages/composti/ImportDialog.tsx`

**Sintomo:** se tutte le righe del CSV falliscono l'import (`count === 0`, `errori > 0`), il dialog mostrava comunque lo step `done` con schermata verde "✓ Importazione completata" e badge "0 composti aggiunti". Il pulsante "Riprova" non era raggiungibile.

**Causa:** `handleImport` chiamava sempre `setStep('done')` e `onSave()` alla fine del loop, indipendentemente dal risultato. Il controllo `errori > 0` impostava solo il messaggio di testo, non il passo.

**Causa secondaria:** mancava la parentesi graffa di chiusura di `handleImport` — le variabili `mappedCols`, `mixRilevatiCount` e il `return` del JSX erano finite dentro la funzione asincrona, causando un errore di parsing Babel a runtime.

**Fix:** aggiunto controllo `if (count === 0 && errori > 0)` che porta allo step `error` invece di `done`. `onSave()` non viene chiamato in caso di fallimento totale. Ripristinata la parentesi graffa di chiusura nella posizione corretta.

---

## Bug 3 — Bulk delete: orfani nei mix (Medium)

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

**Sintomo:** `handleBulkDelete` chiamava `compostiApi.delete(id)` per ogni ID selezionato. Il backend `composti:delete` fa `DELETE WHERE id = ?` — elimina solo il singolo record. Selezionando 3 componenti su 5 di un mix, i 2 rimanenti diventavano orfani con `mix_id` impostato ma gruppo incompleto.

**Fix:** vedi sistema mix-scope sotto.

---

## Soluzione unificata: sistema mix-scope sequenziale

**File:** `src/renderer/pages/composti/CompostiPage.tsx`, `src/renderer/components/shared/ConfirmDialog.tsx`, `src/main/ipc/composti.ipc.ts`

Per i bug 1 e 3 è stato implementato un sistema che, prima di eseguire qualsiasi operazione bulk, identifica i mix parzialmente selezionati e chiede all'utente come procedere — separatamente per ogni mix coinvolto.

### Comportamento

Quando l'utente avvia un'operazione bulk (Rivalidazione, Dismissione, Cancellazione):

1. Il sistema analizza gli ID selezionati e identifica i mix parzialmente selezionati (quelli in cui non tutti i componenti sono stati selezionati).
2. Per ogni mix parzialmente selezionato appare un dialog sequenziale:
   > *"Hai selezionato 2 componenti del mix "Pesticidi Lotto 24A" (5 totali). Applica l'azione solo ai selezionati o a tutto il mix?"*
   - `Annulla` — interrompe l'intera operazione
   - `Solo i 2 selezionati` — applica solo agli ID selezionati
   - `Tutto il mix (5)` — applica a tutti i componenti del mix
3. Se tutti i componenti di un mix sono già selezionati, il dialog non appare — si applica direttamente a tutto il mix.
4. Se non ci sono mix coinvolti (tutti composti singoli), si procede direttamente senza dialog.

### Logica per operazione

| Operazione | "Solo i selezionati" | "Tutto il mix" |
|---|---|---|
| Rivalidazione / Dismissione | `addStoria` con `propagate: false` su ogni ID | `addStoria` con `propagate: true` su un ID — backend propaga |
| Cancellazione | `delete` su ogni ID selezionato | `delete-by-lotto` — elimina l'intero mix |

### Modifiche backend: flag `propagate` su `composti:storia-add`

**File:** `src/main/ipc/composti.ipc.ts`

Aggiunto parametro opzionale `propagate?: boolean` (default `true`) all'handler `composti:storia-add`.

- `propagate: true` (default) — comportamento invariato: se il composto appartiene a un mix, inserisce la storia su tutti i componenti del mix e aggiorna `data_dismissione` su tutto il mix per la Dismissione.
- `propagate: false` — inserisce la storia solo sul `compostoId` passato, senza espandere al mix. Per la Dismissione aggiorna `data_dismissione` solo sui target effettivi.

Nessuna migration necessaria. Tutti i caller esistenti non passano il flag e mantengono il comportamento originale.

### Modifiche a `ConfirmDialog`

**File:** `src/renderer/components/shared/ConfirmDialog.tsx`

Aggiunta prop opzionale `secondaryAction?: { label: string; onClick: () => void }`. Quando presente, appare un terzo bottone tra "Annulla" e il bottone primario di conferma. Nessuna rottura per i caller esistenti.

### Nuovi stati in `CompostiPage`

```ts
const [mixScopeQueue, setMixScopeQueue] = useState<MixScopeItem[]>([])
const [mixScopeIndex, setMixScopeIndex] = useState(0)
const [mixScopeDecisions, setMixScopeDecisions] = useState<Map<string, 'selected' | 'all'>>(new Map())
const [pendingBulkOp, setPendingBulkOp] = useState<((decisions: Map<string, 'selected' | 'all'>) => Promise<void>) | null>(null)
```

---

## File modificati

| File | Tipo | Descrizione |
|---|---|---|
| `src/renderer/pages/composti/CompostiPage.tsx` | Modificato | Logica bulk riscritta con coda mix-scope |
| `src/renderer/components/shared/ConfirmDialog.tsx` | Modificato | Aggiunta prop `secondaryAction` |
| `src/main/ipc/composti.ipc.ts` | Modificato | Flag `propagate` su `storia-add` |
| `src/renderer/pages/composti/ImportDialog.tsx` | Modificato | Fix step `error` su fallimento totale, fix parentesi graffa |