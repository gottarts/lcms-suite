# Plan — Filtro Scaduti + Filtri per Colonna + Toggle Colonne
**Data:** 2026-03-15  
**Branch:** `feat/filtri-colonne`  
**File modificati:** `CompostiPage.tsx`, `CompostiTable.tsx`, `DataTable.tsx`  
**Nessuna modifica backend / DB necessaria**

---

## Riepilogo modifiche

| ID | Tipo | Priorità | Descrizione |
|----|------|----------|-------------|
| FEAT-A | Feature | 🔴 Alta | Tasto "Escludi scaduti" (toggle rapido) |
| FEAT-B | Feature | 🟡 Media | Filtri testuali per colonna (input nell'header) |
| FEAT-C | Feature | 🟡 Media | Toggle visibilità colonne (scegli quali vedere) |

---

## FEAT-A — Tasto "Escludi scaduti"

### Obiettivo
Aggiungere un toggle rapido nella toolbar che nasconde i composti con stato
`scaduto` e `rivalidato_scaduto`. Lo stato default è **OFF** (scaduti visibili)
per non nascondere dati per sbaglio.

Il pulsante si comporta come gli altri toggle già presenti (`mostraDismessi`,
`mostraDaAprire`) ma è posizionato in modo più prominente perché è la
funzione più richiesta.

### Modifica — `CompostiPage.tsx`

#### 1. Nuovo stato

Aggiungere con gli altri `useState` iniziali:

```tsx
const [nascondiScaduti, setNascondiScaduti] = useState(false)
```

#### 2. Logica filtro nel `useMemo filtered`

Aggiungere **dopo** `if (!mostraDaAprire)` e prima di `return result`:

```tsx
if (nascondiScaduti) {
  result = result.filter(c => {
    const s = computeStato(c)
    return s !== 'scaduto' && s !== 'rivalidato_scaduto'
  })
}
```

Aggiungere `nascondiScaduti` nell'array dipendenze del `useMemo`.

#### 3. JSX — pulsante nella toolbar filtri

Inserire accanto agli altri `MultiSelectDropdown`, dopo il separatore `border-l`:

```tsx
<Button
  variant={nascondiScaduti ? 'default' : 'outline'}
  size="sm"
  className="h-8 text-sm gap-1.5"
  onClick={() => setNascondiScaduti(v => !v)}
>
  {nascondiScaduti ? (
    <>
      <EyeOff className="h-3.5 w-3.5" />
      Scaduti esclusi
    </>
  ) : (
    <>
      <Eye className="h-3.5 w-3.5" />
      Mostra scaduti
    </>
  )}
</Button>
```

> Aggiungere `Eye, EyeOff` agli import da `lucide-react`.

---

## FEAT-B — Filtri testuali per colonna

### Obiettivo
Aggiungere sotto ogni intestazione di colonna un input di ricerca contestuale.
Il filtro è **in AND** con la ricerca globale già esistente.

L'approccio scelto è tenere i filtri-per-colonna **in `CompostiPage`** (stato
centralizzato) e passarli a `CompostiTable` / `DataTable` come prop, così
la logica di filtraggio resta tutta in un posto.

### Struttura dati

```tsx
// In CompostiPage.tsx
type ColFilters = Record<string, string>
const [colFilters, setColFilters] = useState<ColFilters>({})
```

### Modifica — `CompostiPage.tsx`

#### 1. Nuovo stato

```tsx
const [colFilters, setColFilters] = useState<Record<string, string>>({})
```

#### 2. Handler

```tsx
const handleColFilter = useCallback((key: string, value: string) => {
  setColFilters(prev => {
    if (!value) {
      const next = { ...prev }
      delete next[key]
      return next
    }
    return { ...prev, [key]: value }
  })
}, [])
```

#### 3. Filtro nel `useMemo filtered`

Aggiungere **dopo** la ricerca globale (`debouncedSearch`) e prima dei filtri
multi-select:

```tsx
if (Object.keys(colFilters).length > 0) {
  result = result.filter(c =>
    Object.entries(colFilters).every(([key, val]) => {
      const cellVal = String(c[key] ?? '').toLowerCase()
      return cellVal.includes(val.toLowerCase())
    })
  )
}
```

Aggiungere `colFilters` nell'array dipendenze del `useMemo`.

#### 4. Passare le prop a `CompostiTable`

```tsx
<CompostiTable
  ...props esistenti...
  colFilters={colFilters}
  onColFilter={handleColFilter}
/>
```

### Modifica — `CompostiTable.tsx`

#### 1. Nuove props

```tsx
interface CompostiTableProps {
  // ...invariato
  colFilters?: Record<string, string>
  onColFilter?: (key: string, value: string) => void
}
```

#### 2. Input nell'header di ogni colonna

In `DataTable` (vedi FEAT-C), l'header renderizza già `col.label`. Estendere
l'interfaccia `Column` in `DataTable.tsx` con la prop `filterValue` e
`onFilterChange` opzionali, così ogni colonna può opzionalmente mostrare
un input.

In `CompostiTable.tsx`, nel `useMemo columns`, aggiungere a ogni colonna
che deve essere filtrabile:

```tsx
filterValue: colFilters?.['nome'] ?? '',
onFilterChange: (v: string) => onColFilter?.('nome', v),
```

> La lista delle colonne filtrabili consigliata (quelle testuali):
> `nome`, `codice_interno`, `classe`, `produttore`, `lotto`, `ubicazione`,
> `solvente`, `forma_commerciale`, `destinazione_uso`, `work_standard`.
>
> Le colonne con render speciale (fiale, stato, metodi, azioni) **non** avranno
> il filtro-per-colonna — useranno i multi-select già esistenti.

### Modifica — `DataTable.tsx`

#### 1. Estendere interfaccia `Column`

```tsx
export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  className?: string
  render?: (value: unknown, row: T) => React.ReactNode
  // Nuovo — filtro per colonna
  filterValue?: string
  onFilterChange?: (value: string) => void
}
```

#### 2. Render header con input opzionale

Nell'`<th>` di ogni colonna, dopo il label+icona sort, aggiungere
condizionalmente l'input:

```tsx
<th key={col.key} className={...} onClick={...}>
  <div className="flex items-center gap-1">
    {col.label}
    {sortKey === col.key && (...icone...)}
  </div>
  {col.onFilterChange && (
    <div onClick={e => e.stopPropagation()} className="mt-1">
      <input
        type="text"
        value={col.filterValue ?? ''}
        onChange={e => col.onFilterChange!(e.target.value)}
        placeholder="Filtra..."
        className="w-full h-6 px-1.5 text-xs rounded border border-input bg-background
                   text-foreground placeholder:text-muted-foreground focus:outline-none
                   focus:ring-1 focus:ring-ring font-normal"
      />
    </div>
  )}
</th>
```

> ⚠️ `onClick={e => e.stopPropagation()}` nel wrapper dell'input è
> **obbligatorio** per evitare che la digitazione triggeri l'ordinamento.

#### 3. Adattare l'altezza della riga header

L'header diventa più alto con gli input. Cambiare la classe dell'`<th>` da
`h-10` a `h-auto py-2` (o semplicemente rimuovere `h-10` e lasciare che il
contenuto determini l'altezza).

---

## FEAT-C — Toggle visibilità colonne

### Obiettivo
Un pannello (popover) raggiungibile con un pulsante "Colonne" nella toolbar
che permette di attivare/disattivare la visibilità di ogni colonna della
tabella. Lo stato viene persistito in `localStorage`.

### Colonne di sistema e default visibili

| Key | Label | Default visibile |
|-----|-------|-----------------|
| `nome` | Nome | ✅ |
| `codice_interno` | Codice | ✅ |
| `classe` | Classe | ✅ |
| `forma` | Forma | ✅ |
| `concentrazione` | Conc. | ✅ |
| `solvente` | Solvente | ✅ |
| `produttore` | Produttore | ✅ |
| `lotto` | Lotto | ✅ |
| `ubicazione` | Ubicazione | ✅ |
| `scadenza_prodotto` | Scadenza | ✅ |
| `work_standard` | Work | ✅ |
| `destinazione_uso` | Destinazione | ❌ (nascosta di default) |
| `forma_commerciale` | Forma comm. | ❌ |
| `matrice` | Matrice | ❌ |
| `mw` | MW | ❌ |
| `formula` | Formula | ❌ |
| `fiala` (pallini) | Fiale | ✅ |
| `stato` (badge) | Stato | ✅ |
| `metodi` (badge) | Metodi | ✅ |

### Modifica — `CompostiPage.tsx`

#### 1. Stato con persistenza localStorage

```tsx
const DEFAULT_COL_VISIBLE: Record<string, boolean> = {
  nome: true, codice_interno: true, classe: true, forma: true,
  concentrazione: true, solvente: true, produttore: true, lotto: true,
  ubicazione: true, scadenza_prodotto: true, work_standard: true,
  destinazione_uso: false, forma_commerciale: false, matrice: false,
  mw: false, formula: false, fiala: true, stato: true, metodi: true,
}

const [colVisible, setColVisible] = useState<Record<string, boolean>>(() => {
  try {
    const saved = localStorage.getItem('composti-col-visible')
    return saved ? { ...DEFAULT_COL_VISIBLE, ...JSON.parse(saved) } : DEFAULT_COL_VISIBLE
  } catch {
    return DEFAULT_COL_VISIBLE
  }
})

const handleColVisibleChange = useCallback((key: string, visible: boolean) => {
  setColVisible(prev => {
    const next = { ...prev, [key]: visible }
    localStorage.setItem('composti-col-visible', JSON.stringify(next))
    return next
  })
}, [])
```

#### 2. Pulsante "Colonne" nella toolbar (accanto a Esporta)

```tsx
<div className="relative" ref={colMenuRef}>
  <Button
    size="sm"
    variant="outline"
    onClick={() => setColMenuOpen(v => !v)}
  >
    <Columns className="h-4 w-4 mr-1" />
    Colonne
    {Object.values(colVisible).filter(v => !v).length > 0 && (
      <Badge className="ml-1 h-4 px-1 text-xs bg-muted text-muted-foreground">
        {Object.values(colVisible).filter(v => !v).length} nascoste
      </Badge>
    )}
  </Button>

  {colMenuOpen && (
    <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border bg-popover shadow-md p-2">
      <div className="text-xs font-medium text-muted-foreground px-1 mb-2">
        Colonne visibili
      </div>
      {COL_DEFS.map(({ key, label }) => (
        <label key={key}
          className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-accent rounded">
          <input
            type="checkbox"
            checked={colVisible[key] ?? true}
            onChange={e => handleColVisibleChange(key, e.target.checked)}
          />
          {label}
        </label>
      ))}
      <div className="border-t mt-2 pt-2">
        <button
          className="w-full text-xs text-muted-foreground px-1 py-1 hover:text-foreground text-left"
          onClick={() => {
            setColVisible(DEFAULT_COL_VISIBLE)
            localStorage.removeItem('composti-col-visible')
          }}
        >
          Ripristina default
        </button>
      </div>
    </div>
  )}
</div>
```

> Aggiungere `Columns` agli import da `lucide-react`.  
> `COL_DEFS` è un array `{ key, label }[]` derivato da `DEFAULT_COL_VISIBLE`.

#### 3. Passare `colVisible` a `CompostiTable`

```tsx
<CompostiTable
  ...props esistenti...
  colVisible={colVisible}
/>
```

### Modifica — `CompostiTable.tsx`

#### 1. Nuova prop

```tsx
interface CompostiTableProps {
  // ...invariato
  colVisible?: Record<string, boolean>
}
```

#### 2. Filtrare le colonne nel `useMemo`

Alla fine del `useMemo columns`, prima del `return`, aggiungere:

```tsx
const visibleColumns = colVisible
  ? allColumns.filter(col => colVisible[col.key] !== false)
  : allColumns
return visibleColumns
```

> Le colonne speciali come `__select__` (checkbox bulk) e `__actions__`
> (dropdown azioni) vanno **sempre** incluse — aggiungerle con
> `colVisible[col.key] !== false` funziona già perché non sono in
> `DEFAULT_COL_VISIBLE` e quindi `colVisible['__select__']` è `undefined`,
> che con `!== false` è `true`.

---

## Badge filtri attivi — aggiornamento

Se `nascondiScaduti` è attivo, aggiungere un badge rimovibile coerente con
gli altri già presenti:

```tsx
{nascondiScaduti && (
  <Badge variant="secondary" className="cursor-pointer gap-1"
    onClick={() => setNascondiScaduti(false)}>
    Scaduti esclusi ×
  </Badge>
)}
```

Se `colFilters` ha valori, aggiungere badge per ogni filtro attivo:

```tsx
{Object.entries(colFilters).map(([key, val]) => (
  <Badge key={key} variant="secondary" className="cursor-pointer gap-1"
    onClick={() => handleColFilter(key, '')}>
    {key}: "{val}" ×
  </Badge>
))}
```

---

## Ordine implementazione consigliato

1. **FEAT-A** — è la modifica più semplice e la più richiesta. Sola modifica a `CompostiPage.tsx`, 0 rischi di regressione.
2. **FEAT-C** — aggiunge `colVisible` come prop passata a valle, non tocca la logica di filtro.
3. **FEAT-B** — richiede modifica a `DataTable.tsx` (shared component) e quindi va testata con attenzione per non rompere altri usi di `DataTable` (consumabili, eluenti, diario).

> ⚠️ Prima di modificare `DataTable.tsx` in FEAT-B, verificare quali altri
> componenti lo usano (`grep -r "DataTable" src/`). Le props nuove
> (`filterValue`, `onFilterChange`) sono **opzionali**, quindi i componenti
> esistenti non si rompono — ma vale la pena fare una verifica visiva rapida.

---

## Commit suggeriti

```bash
# FEAT-A
git commit -m "feat(composti): toggle nascondi scaduti nella toolbar filtri"

# FEAT-C
git commit -m "feat(composti): toggle visibilità colonne con persistenza localStorage"

# FEAT-B
git commit -m "feat(composti): filtri testuali per colonna nell'header tabella"
```