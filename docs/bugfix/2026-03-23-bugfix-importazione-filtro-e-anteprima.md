# Bugfix — Importazione include righe senza nome (Name)

---

## Problema

Nelle importazioni DB Composti (`ImportDialog`) e Aggiungi Mix (`TextImportDialog` → `MixPesticidiForm`), l'anteprima e il conteggio includevano tutte le righe del file, anche quelle senza valore nella colonna "Nome"/"Name". Questo causava:
- Conteggio gonfiato nel preview ("Verranno importati N composti" con N maggiore dei composti reali)
- In `TextImportDialog`, righe vuote venivano concatenate nel risultato `;` passato a `MixPesticidiForm`

L'import effettivo di `ImportDialog` già saltava le righe senza nome (`if (!composto.nome) continue`), ma il conteggio e l'anteprima erano fuorvianti.

---

## Root cause

**ImportDialog:** `csvRows` conteneva tutte le righe dati del file senza filtro sul nome. Il conteggio `csvRows.length` e `previewRows = csvRows.slice(0, 5)` mostravano anche righe senza nome.

**TextImportDialog:** `handleImport()` raccoglieva tutti i valori dalla colonna mappata a `nomi` senza filtrare le righe con cella vuota, producendo separatori `;` consecutivi o entry vuote.

---

## Fix

**File:** `src/renderer/pages/composti/ImportDialog.tsx`

Aggiunto calcolo `filteredRows` basato sulla mappatura corrente della colonna "nome":

```tsx
const nomeColHeader = Object.entries(mapping).find(([, v]) => v === 'nome')?.[0]
const nomeColIdx = nomeColHeader ? csvHeaders.indexOf(nomeColHeader) : -1
const filteredRows = nomeColIdx >= 0
  ? csvRows.filter(r => (r[nomeColIdx] ?? '').trim() !== '')
  : csvRows
```

Tutti i riferimenti a `csvRows.length` nel preview/mapping e `previewRows` ora usano `filteredRows`.

**File:** `src/renderer/components/shared/TextImportDialog.tsx`

In `handleImport()`, le righe vengono filtrate in base alla colonna mappata a `nomi` prima di costruire il risultato:

```tsx
const nomiColName = Object.entries(mapping).find(([, v]) => v === 'nomi')?.[0]
const nomiColIdx = nomiColName ? headers.indexOf(nomiColName) : -1
const filteredRows = nomiColIdx >= 0
  ? dataRows.filter(row => (row[nomiColIdx] ?? '').trim() !== '')
  : dataRows
```

Rimosso anche il limite `.slice(0, 20)` nell'anteprima header di `ImportDialog` (richiesta utente separata).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/composti/ImportDialog.tsx` | Aggiunto `filteredRows` per escludere righe senza nome da conteggio, anteprima e preview. Rimosso `.slice(0, 20)` nell'anteprima header. |
| `src/renderer/components/shared/TextImportDialog.tsx` | Filtro righe senza nome in `handleImport()` prima di costruire il risultato da passare al form. |

---

## Note

- Il filtro è reattivo: se l'utente cambia la mappatura della colonna "nome" nello step mapping, `filteredRows` si ricalcola automaticamente.
- L'import effettivo di `ImportDialog` aveva già il guard `if (!composto.nome) continue` — il fix allinea conteggio e anteprima al comportamento reale dell'import.
