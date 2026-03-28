# Bugfix & Feature Report — 2026-03-16 (sessione serale)

**Branch:** `master`  
**DB user_version:** 10 (invariato — nessuna migration necessaria)

---

## Feature — Rivalidazione bulk: lotto CRM e nuova scadenza per-lotto

**File:** `src/renderer/pages/composti/CompostiPage.tsx`, `src/renderer/pages/composti/StoriaDialog.tsx`

**Problema:** la rivalidazione bulk applicava lo stesso lotto CRM e la stessa nuova scadenza a tutti i composti selezionati, indipendentemente dal lotto. Non era possibile differenziare per lotto.

**Soluzione:** il flusso di rivalidazione bulk è stato esteso a **tre fasi sequenziali**.

### Fase 1 — `StoriaDialog` (invariata)
L'utente compila i campi comuni a tutti i lotti: Data, N° Registro QC, Batch analitico, Note. I campi Lotto CRM e Nuova scadenza vengono nascosti con un banner blu che informa del passo successivo.

### Fase 2 — Mix-scope (invariata)
Per ogni mix **parzialmente** selezionato appare il dialog "Solo i N selezionati / Tutti gli M del mix". Nessun lotto/scadenza qui — separazione netta di responsabilità.

### Fase 3 — Lotto-scope (nuova)
Per ogni **lotto distinto** nella selezione appare `LottoRivalidaDialog` che chiede:
- Lotto CRM valido (con select da DB via `composti:lotti-validi` + fallback input manuale)
- Nuova data di scadenza

La chiave di raggruppamento è `comp.lotto` — stesso lotto = un solo dialog, anche se i composti appartengono a mix diversi.

`execStoria` legge le decisioni per-lotto da `lottoScopeDecisionsRef` e le applica al payload di ogni gruppo, con fallback al payload globale se non specificate.

### Struttura dati aggiornata

```ts
// Nuovi tipi
interface LottoScopeItem {
  lotto: string
  ids: number[]
  firstCompostoId: number  // per caricare i lotti CRM validi
}

interface LottoScopeDecision {
  lotto_crm_valido?: string
  nuova_scadenza?: string
}

// MixScopeDecision semplificato (lotto/scadenza spostati in LottoScopeDecision)
interface MixScopeDecision {
  scope: 'selected' | 'all'
}

// pendingBulkOpRef ora riceve entrambe le mappe
pendingBulkOpRef: (mixDecisions, lottoDecisions) => Promise<void>
```

### Separazione dismissione/delete

Per dismissione e delete la fase lotto-scope non esiste — usano solo la fase mix-scope come prima. La flag `isRivalidazione` controlla se costruire `lottoQueue`.

---

## Feature — Banner avviso lotti multipli in `StoriaDialog`

**File:** `src/renderer/pages/composti/StoriaDialog.tsx`, `src/renderer/pages/composti/CompostiPage.tsx`

Aggiunto banner ambra visibile solo quando la selezione bulk contiene **più di un lotto distinto**. Il banner avvisa che Data, QC, Batch e Note si applicano a tutti i lotti e invita a compilarli solo se la rivalidazione è stata effettuata con lo stesso QC.

**Implementazione:**
- `StoriaDialog` — nuova prop `bulkLottiDistinti?: number`. Il banner appare solo se `isBulk && tipo === 'Rivalidazione' && bulkLottiDistinti > 1`
- `CompostiPage` — `useMemo` che conta i lotti distinti in `selectedIds` e li passa come `bulkLottiDistinti` al `StoriaDialog` bulk

---

## Fix — Campo `volume_ml`: label dinamica per Neat

**File:** `src/renderer/pages/composti/CompostoForm.tsx`

**Sintomo:** il campo `volume_ml` non appariva per i composti Neat e aveva label fissa "Volume mL" anche per le Solution.

**Fix:** la condizione di visibilità è stata cambiata da `form.forma === 'Solution' || form.forma === 'Mix'` a `form.forma` (qualsiasi forma selezionata). Label e placeholder cambiano dinamicamente in base alla forma:

| Forma | Label | Placeholder |
|-------|-------|-------------|
| Neat | Quantità (mg) | es. 100 |
| Solution | Volume (mL) | es. 1.2 |
| Mix | Volume (mL) | es. 1.2 |

Il campo DB `volume_ml` rimane invariato — è solo presentazione.

---

## File modificati

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/renderer/pages/composti/CompostiPage.tsx` | 🔧 Modificato | `LottoRivalidaDialog`; `MixScopeDialog`; tipi `LottoScopeItem/Decision`; fasi mix-scope e lotto-scope separate; `buildLottoQueue`; `handleLottoScopeDecision`; `cancelBulk`; `bulkLottiDistinti` useMemo |
| `src/renderer/pages/composti/StoriaDialog.tsx` | 🔧 Modificato | Prop `bulkLottiDistinti`; banner ambra avviso lotti multipli condizionato |
| `src/renderer/pages/composti/CompostoForm.tsx` | 🔧 Modificato | Label `volume_ml` dinamica; campo visibile anche per Neat |

---

## Stato Database

```
user_version = 10 (invariato)
```

Nessuna migration necessaria. Tutte le modifiche sono frontend.

---

## Git

```bash
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/renderer/pages/composti/StoriaDialog.tsx
git add src/renderer/pages/composti/CompostoForm.tsx

git commit -m "feat(bulk): lotto CRM e nuova scadenza per-lotto nella rivalidazione bulk; banner avviso lotti multipli; label volume/quantità dinamica per Neat"
```