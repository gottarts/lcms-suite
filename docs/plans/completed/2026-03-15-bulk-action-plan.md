# Plan — Bulk Actions su Selezione Filtrata

**Branch:** `feat/bulk-actions`  
**File modificati:** `CompostiPage.tsx`, `CompostiTable.tsx`, `StoriaDialog.tsx`  
**Nessuna modifica backend necessaria** — usa IPC già esistenti in loop.

---

## UX scelta

`DataTable` non supporta `headerRender` per colonna, quindi il checkbox
"seleziona tutti" non può stare nell'intestazione della tabella.

**Soluzione adottata:**
- Ogni riga ha un **checkbox** a sinistra (colonna `__select__` in `CompostiTable`)
- Sopra la tabella compare una **barra bulk** fissa (sempre visibile) con:
  - checkbox "Seleziona tutti (N)" — seleziona/deseleziona tutti i `filtered`
  - contatore righe selezionate
  - pulsanti: Nuovo lotto, Rivalidazione, Dismetti, Cancella (visibili solo se selectedIds.size > 0)
  - link "Deseleziona" (visibile solo se selectedIds.size > 0)
- La barra è visibile **sempre**, non solo con filtri attivi, perché la selezione
  manuale riga per riga è utile anche senza filtri

---

## File 1 — `CompostiTable.tsx`

### 1a — Nuove props

```ts
interface CompostiTableProps {
  // ...invariato
  selectedIds?: Set<number>
  onSelectionChange?: (ids: Set<number>) => void
}
```

### 1b — Import aggiuntivo

```ts
import { Checkbox } from '@/components/ui/checkbox'
```

### 1c — Prima colonna nel useMemo columns

Inserire **prima** di `{ key: 'nome', ... }`:

```tsx
{
  key: '__select__',
  label: '',
  sortable: false,
  className: 'w-8 pr-0',
  render: (_: unknown, row: any) => (
    <div onClick={e => e.stopPropagation()}>
      <Checkbox
        checked={selectedIds?.has(row.id) ?? false}
        onCheckedChange={(checked) => {
          const next = new Set(selectedIds)
          if (checked) next.add(row.id)
          else next.delete(row.id)
          onSelectionChange?.(next)
        }}
      />
    </div>
  ),
},
```

### 1d — Deps del useMemo aggiornate

Rimuovere il commento `eslint-disable` e aggiungere le nuove deps:

```tsx
], [onRowClick, onNewLotto, onRivalida, onDismetti, onOpenStorico, onOpenPreparazioni,
    selectedIds, onSelectionChange])
```

---

## File 2 — `CompostiPage.tsx`

### 2a — Import lucide aggiuntivi

Aggiungere `Copy, RotateCcw, Archive, Trash2` agli import lucide esistenti.

### 2b — Nuovi stati (dopo `storiaTarget`)

```ts
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
const [bulkStoriaAction, setBulkStoriaAction] = useState<'Rivalidazione' | 'Dismissione' | null>(null)
```

### 2c — useEffect reset selezione al cambio filtri

```ts
useEffect(() => {
  setSelectedIds(new Set())
}, [debouncedSearch, filtroStati, filtroWorks, filtroDestinazioni, filtroMetodi,
    filtroAttenzione, filtroInScadenza, mostraDismessi, mostraDaAprire])
```

### 2d — Handler bulk delete

```ts
const handleBulkDelete = useCallback(async () => {
  for (const id of selectedIds) {
    await compostiApi.delete(id)
  }
  setSelectedIds(new Set())
  setBulkDeleteOpen(false)
  load()
}, [selectedIds, load])
```

### 2e — Handler bulk storia

```ts
const handleBulkStoria = useCallback(async (payload: any) => {
  for (const id of selectedIds) {
    await compostiApi.addStoria(id, payload)
  }
  setSelectedIds(new Set())
  setBulkStoriaAction(null)
  load()
}, [selectedIds, load])
```

### 2f — Barra bulk (tra `<CompostiStats>` e `<CompostiTable>`)

```tsx
<div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-muted border text-sm min-h-[44px]">
  <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
    <input
      type="checkbox"
      className="rounded"
      checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
      onChange={e =>
        setSelectedIds(e.target.checked ? new Set(filtered.map(c => c.id)) : new Set())
      }
    />
    <span className="text-muted-foreground text-xs">
      {selectedIds.size > 0
        ? `${selectedIds.size} selezionat${selectedIds.size === 1 ? 'o' : 'i'}`
        : `Seleziona tutti (${filtered.length})`}
    </span>
  </label>
  {selectedIds.size > 0 && (
    <>
      <div className="border-l h-4 mx-1" />
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="h-7 text-xs"
          onClick={() => {
            const first = composti.find(c => selectedIds.has(c.id))
            if (first) handleNewLotto(first)
          }}>
          <Copy className="h-3 w-3 mr-1" /> Nuovo lotto
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs"
          onClick={() => setBulkStoriaAction('Rivalidazione')}>
          <RotateCcw className="h-3 w-3 mr-1" /> Rivalidazione
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs"
          onClick={() => setBulkStoriaAction('Dismissione')}>
          <Archive className="h-3 w-3 mr-1" /> Dismetti
        </Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs"
          onClick={() => setBulkDeleteOpen(true)}>
          <Trash2 className="h-3 w-3 mr-1" /> Cancella
        </Button>
      </div>
      <button className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setSelectedIds(new Set())}>
        Deseleziona
      </button>
    </>
  )}
</div>
```

### 2g — Props aggiuntive su `<CompostiTable>`

```tsx
selectedIds={selectedIds}
onSelectionChange={setSelectedIds}
```

### 2h — ConfirmDialog bulk delete (dopo quello esistente)

```tsx
<ConfirmDialog
  open={bulkDeleteOpen}
  title="Elimina composti selezionati"
  message={`Stai per eliminare ${selectedIds.size} compost${selectedIds.size === 1 ? 'o' : 'i'} e tutti i dati correlati. L'operazione non è reversibile.`}
  confirmLabel={`Elimina ${selectedIds.size} compost${selectedIds.size === 1 ? 'o' : 'i'}`}
  variant="danger"
  onConfirm={handleBulkDelete}
  onCancel={() => setBulkDeleteOpen(false)}
/>
```

### 2i — StoriaDialog bulk (dopo quello esistente)

```tsx
<StoriaDialog
  open={bulkStoriaAction !== null}
  onOpenChange={v => !v && setBulkStoriaAction(null)}
  compostoId={[...selectedIds][0] ?? null}
  compostoNome={`${selectedIds.size} compost${selectedIds.size === 1 ? 'o' : 'i'} selezionat${selectedIds.size === 1 ? 'o' : 'i'}`}
  tipo={bulkStoriaAction ?? ''}
  onSaved={() => {}}
  onSavedBulk={handleBulkStoria}
/>
```

---

## File 3 — `StoriaDialog.tsx`

### 3a — Nuova prop opzionale

```ts
onSavedBulk?: (payload: any) => void
```

### 3b — Modificare `handleConfirm`

```ts
const handleConfirm = async () => {
  if (!tipo) return
  const payload = {
    tipo,
    data,
    note: note || undefined,
    n_registro_qc: nRegistroQc || undefined,
    batch_analitico: batchAnalitico || undefined,
    lotto_crm_valido: lottoCrmValido || undefined,
    nuova_scadenza: nuovaScadenza || undefined,
  }
  if (onSavedBulk) {
    await onSavedBulk(payload)
    onOpenChange(false)
  } else {
    if (!compostoId) return
    await compostiApi.addStoria(compostoId, payload)
    onOpenChange(false)
    onSaved()
  }
}
```

---

## Note su "Nuovo lotto" bulk

Semanticamente ambiguo su selezione multipla. Il pulsante apre il form del
**primo composto selezionato** — comportamento identico al "Nuovo lotto" da riga singola.

---

## Branch e commit

```bash

git add src/renderer/pages/composti/CompostiPage.tsx
git add src/renderer/pages/composti/CompostiTable.tsx
git add src/renderer/pages/composti/StoriaDialog.tsx
git commit -m "feat(bulk): selezione multipla con azioni bulk (cancella, rivalidazione, dismetti, nuovo lotto)"
git checkout master
git merge feat/bulk-actions
git push
```

---

## Checklist verifica

1. Checkbox su ogni riga — click seleziona/deseleziona senza aprire il pannello
2. Checkbox "Seleziona tutti" nella barra — seleziona/deseleziona tutti i `filtered`
3. Cambio filtro o ricerca → selezione si azzera automaticamente
4. **Cancella**: dialog con conteggio → elimina tutti → tabella aggiornata
5. **Rivalidazione**: `StoriaDialog` con nome "N composti selezionati" → conferma → storia applicata a tutti
6. **Dismetti**: idem tipo Dismissione
7. **Nuovo lotto**: apre form sul primo composto selezionato
8. "Deseleziona" → selezione svuotata, pulsanti scompaiono