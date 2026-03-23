# Bugfix — Filtri colonna DB Composti: perdita focus durante digitazione

---

## Problema

Nei filtri per colonna della tabella DB Composti, durante la digitazione il cursore si perdeva e l'input smetteva di ricevere caratteri. L'utente doveva ricliccare sul campo per continuare a scrivere, rendendo impossibile digitare parole intere.

---

## Root cause

Due fattori causavano la perdita di focus:

1. **Input DOM ricreato ad ogni keystroke.** Ogni cambio di `colFilters` in `CompostiPage` ricostruiva l'array `columns` in `CompostiTable` (via `useMemo` con `colFilters` nelle dipendenze, riga 209). Questo causava la ricreazione degli `<input>` inline nel `renderTh` di `DataTable` — React smontava e rimontava il DOM element, perdendo il focus.

2. **Switch di branch rendering.** `DataTable` ha due branch: uno non-virtualizzato (`<Table>` shadcn) per <50 righe, uno virtualizzato (`<table>` nativo) per >=50. Quando la digitazione nel filtro faceva scendere i risultati sotto la soglia di 50, l'intero albero DOM veniva smontato e rimontato nel branch alternativo, distruggendo gli input.

---

## Fix

**File:** `src/renderer/components/shared/DataTable.tsx`

### 1. Componente `ColumnFilterInput` con stato locale

Creato componente `memo` dedicato per l'input filtro. Mantiene il proprio stato locale e sincronizza verso l'alto, così React aggiorna il componente esistente senza smontarlo:

```tsx
const ColumnFilterInput = memo(function ColumnFilterInput({
  value, onChange,
}: { value: string; onChange: (value: string) => void }) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => { setLocalValue(value) }, [value])

  const handleChange = useCallback((e) => {
    setLocalValue(e.target.value)
    onChange(e.target.value)
  }, [onChange])

  return <input value={localValue} onChange={handleChange} ... />
})
```

### 2. Ref stabile per scelta branch virtualizzazione

Aggiunta ref `useVirtual` che "blocca" la scelta del branch di rendering mentre un filtro è attivo, evitando switch durante la digitazione:

```tsx
const isFilterActive = columns.some(col => col.filterValue)
const useVirtual = useRef(data.length >= VIRTUALIZE_THRESHOLD)
if (!isFilterActive) {
  useVirtual.current = data.length >= VIRTUALIZE_THRESHOLD
}
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/components/shared/DataTable.tsx` | Aggiunto `ColumnFilterInput` memo + ref `useVirtual` per branch stabile |

---

## Note

- Il fix è generico in `DataTable`, quindi beneficia qualsiasi tabella che usa i filtri colonna, non solo DB Composti.
- Il `ColumnFilterInput` sincronizza il valore esterno via `useEffect` per gestire il reset filtri da bottone esterno.
