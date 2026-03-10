# Plan — Storico Apertura + Fix Dismissione
**Data:** 2026-03-10
**Branch:** main
**DB user_version attuale:** 8 (dopo migration 008-rivalidazione-scadenza)

---

## Riepilogo modifiche

| ID | Tipo | Stato | Descrizione |
|----|------|-------|-------------|
| BUG-2A | Bug fix | ✅ Fatto e testato | Backend: `storia-add` aggiorna `data_dismissione` |
| BUG-2B | Bug fix | ⬜ Da fare | Frontend: riga grigia + toggle "Mostra dismessi" |
| FEAT-G | Feature | ⬜ Da fare | Storico: mostrare `data_apertura` come evento |

---

## BUG-2A — ✅ Già completato

Aggiunto blocco `if (data.tipo === 'Dismissione')` prima del `return` in `composti:storia-add`.
Se il composto ha `mix_id`, aggiorna tutti i componenti del mix. Altrimenti solo il singolo.

---

## TASK BUG-2B — Frontend: riga grigia + toggle "Mostra dismessi" ⬜

Tre file da modificare, nell'ordine:
1. `DataTable.tsx` — aggiungere supporto per colorare righe
2. `CompostiTable.tsx` — usare quella prop per le righe dismesse
3. `CompostiPage.tsx` — aggiungere lo stato toggle e il JSX del toggle

---

### BUG-2B — File 1: `src/renderer/components/shared/DataTable.tsx`

**Cosa fare:** aggiungere la prop `rowClassName` che permette di applicare classi CSS a singole righe.

**Modifica 1 di 3 — nell'interfaccia `DataTableProps`:**

Trova questo blocco:
```typescript
interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
}
```
Sostituiscilo con:
```typescript
interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  rowClassName?: (row: T) => string
}
```

**Modifica 2 di 3 — nei parametri della funzione `DataTable`:**

Trova questo blocco (i parametri destructurati):
```typescript
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'Nessun elemento',
}: DataTableProps<T>) {
```
Sostituiscilo con:
```typescript
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'Nessun elemento',
  rowClassName,
}: DataTableProps<T>) {
```

**Modifica 3 di 3 — nel render del `<TableRow>`:**

Trova questa riga (dentro il `.map` delle righe):
```tsx
className={cn(onRowClick && 'cursor-pointer')}
```
Sostituiscila con:
```tsx
className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
```

---

### BUG-2B — File 2: `src/renderer/pages/composti/CompostiTable.tsx`

**Cosa fare:** passare la prop `rowClassName` a `<DataTable>` in fondo al file.

Trova questa riga (l'ultima `<DataTable ...>` prima della chiusura del `return`):
```tsx
<DataTable columns={columns} data={data} onRowClick={onRowClick} emptyMessage="Nessun composto trovato" />
```
Sostituiscila con:
```tsx
<DataTable
  columns={columns}
  data={data}
  onRowClick={onRowClick}
  emptyMessage="Nessun composto trovato"
  rowClassName={(row) => computeStato(row) === 'dismesso' ? 'opacity-40 text-muted-foreground' : ''}
/>
```

---

### BUG-2B — File 3: `src/renderer/pages/composti/CompostiPage.tsx`

Tre modifiche separate in questo file.

**Modifica 1 di 3 — aggiungere lo stato `mostraDismessi`:**

Cerca il blocco degli `useState` all'inizio del componente. Si trova subito dopo la riga:
```typescript
export function CompostiPage() {
  const [composti, setComposti] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('Tutti')
  const [filtroWork, setFiltroWork] = useState('Tutti')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [filtroAttenzione, setFiltroAttenzione] = useState(false)
  const [filtroInScadenza, setFiltroInScadenza] = useState(false)
```
Aggiungi **una riga in fondo a questo gruppo**, dopo `filtroInScadenza`:
```typescript
  const [mostraDismessi, setMostraDismessi] = useState(true)
```

**Modifica 2 di 3 — aggiungere il filtro nel `useMemo filtered`:**

Trova la chiusura del `useMemo filtered`. Le ultime righe prima del `return result` sono:
```typescript
    if (filtroAttenzione) {
      result = result.filter(c => {
        const s = computeStato(c)
        return s === 'scaduto' || s === 'rivalidato_scaduto'
      })
    }

    return result
  }, [composti, search, filtroStato, filtroWork, filtroMetodo, filtroAttenzione, filtroInScadenza])
```
Sostituisci con:
```typescript
    if (filtroAttenzione) {
      result = result.filter(c => {
        const s = computeStato(c)
        return s === 'scaduto' || s === 'rivalidato_scaduto'
      })
    }

    if (!mostraDismessi) {
      result = result.filter(c => computeStato(c) !== 'dismesso')
    }

    return result
  }, [composti, search, filtroStato, filtroWork, filtroMetodo, filtroAttenzione, filtroInScadenza, mostraDismessi])
```

> ⚠️ Nota: `mostraDismessi` va aggiunto anche nell'array delle dipendenze del `useMemo` (l'ultima riga che inizia con `}, [`).

**Modifica 3 di 3 — aggiungere il toggle nel JSX:**

Trova il blocco dei filtri nel JSX. Inizia con:
```tsx
<div className="flex items-center gap-3">
  <div className="relative w-80">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input value={search} ...
```
e finisce con la chiusura `</div>` del blocco che contiene i badge `filtroStato` e `filtroWork`.

Aggiungi il toggle **dopo** la chiusura di quel `</div>` (cioè come elemento fratello, non dentro):
```tsx
<div className="flex items-center gap-2 mt-2">
  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
    <input
      type="checkbox"
      checked={mostraDismessi}
      onChange={e => setMostraDismessi(e.target.checked)}
      className="rounded"
    />
    Mostra dismessi
  </label>
</div>
```

> ℹ️ Si usa una `<input type="checkbox">` semplice per evitare di dover aggiungere il componente `Switch` di Shadcn. Se in futuro vuoi lo switch, basta sostituire questo blocco.

---

#### 🧪 Test manuale BUG-2B

**Prerequisiti:** BUG-2A completato, almeno un composto dismesso nel DB.

**Test 1 — Riga grigia**
1. Avvia l'app
2. ✅ **Atteso:** i composti dismessi sono visibili ma con testo grigio e opacità ridotta

**Test 2 — Toggle nasconde i dismessi**
1. Togli la spunta a "Mostra dismessi"
2. ✅ **Atteso:** le righe dismesse spariscono
3. ✅ **Atteso:** il contatore "Visualizzati: X / Totali: Y" diminuisce

**Test 3 — Toggle riporta i dismessi**
1. Rimetti la spunta a "Mostra dismessi"
2. ✅ **Atteso:** le righe dismesse riappaiono grigie

**Test 4 — Filtro Stato funziona ancora**
1. Con toggle attivo, seleziona "Dismesso" dal filtro Stato
2. ✅ **Atteso:** mostra solo i dismessi (grigi)

---

## FEAT-G — Data apertura nello storico (singoli e mix) ⬜

### Obiettivo
Nel tab **Storico** del pannello laterale (`CompostoPanel`), mostrare la data di apertura
del flacone come primo evento della cronologia, senza modificare il DB.

### TASK FEAT-G — `src/renderer/pages/composti/CompostoPanel.tsx`

Trovare `<TabsContent value="storico"` nel JSX e il `.map` su `composto.storia`.
Aggiungere **sopra** quel `.map`:

```tsx
{composto.data_apertura && (
  <div className="flex items-start gap-2 py-2 border-b opacity-75">
    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 shrink-0 pt-0.5">
      Apertura
    </span>
    <div className="flex-1">
      <div className="text-xs font-medium">
        {composto.mix_id
          ? `Apertura mix ${composto.mix}`
          : 'Apertura flacone'}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {formatDate(composto.data_apertura)}
        {composto.operatore_apertura && ` — ${composto.operatore_apertura}`}
      </div>
    </div>
  </div>
)}
```

#### 🧪 Test manuale FEAT-G

**Test 1 — Composto singolo con data apertura**
1. Clicca su un composto con "Data Apertura" valorizzata (visibile nel tab Dettaglio)
2. Apri il tab **Storico**
3. ✅ **Atteso:** in cima appare "Apertura flacone" con data e operatore (se presente)

**Test 2 — Composto MIX**
1. Clicca su un composto con badge MIX → tab Storico
2. ✅ **Atteso:** in cima appare "Apertura mix [nome]" con la data

**Test 3 — Composto senza data apertura**
1. Clicca su un composto senza "Data Apertura" → tab Storico
2. ✅ **Atteso:** nessun evento "Apertura"

---

## Ordine di esecuzione

```
1. BUG-2A  ✅ fatto e testato
2. BUG-2B  ⬜ → DataTable.tsx → CompostiTable.tsx → CompostiPage.tsx → poi test
3. FEAT-G  ⬜ → CompostoPanel.tsx → poi test
```

---

## Git — commit finale

```bash
git status

git add src/main/ipc/composti.ipc.ts
git add src/renderer/components/shared/DataTable.tsx
git add src/renderer/pages/composti/CompostiTable.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/renderer/pages/composti/CompostoPanel.tsx

git commit -m "fix: dismissione aggiorna stato; riga grigia con toggle mostra/nascondi; storico mostra apertura flacone"

git push
```

---

*Piano aggiornato il 2026-03-10.*