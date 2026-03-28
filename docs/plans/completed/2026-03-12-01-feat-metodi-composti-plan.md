# Piano — `feat/metodi-campo-composto`
**Data:** 2026-03-12  
**Branch:** `feat/metodi-campo-composto`  
**DB user_version:** nessuna migration necessaria — la tabella `composti_metodi` esiste già

---

## Contesto

La feature permette di associare uno o più metodi a un composto direttamente dal form composto, con queste regole:

- Il campo Metodi mostra un **menu a tendina** con i metodi già esistenti nel DB
- Si può **digitare il nome di un metodo nuovo** → viene creato automaticamente come metodo vuoto
- I metodi selezionati appaiono come **chip/tag rimovibili** nel campo
- Il collegamento viene salvato in `composti_metodi` (già esistente)
- Il campo Metodi si trova **in cima al form**, è considerato un campo importante
- Nel **pannello laterale → tab Dettaglio**, i metodi associati appaiono in fondo (posizione rivedibile in seguito)
- **Non** serve una colonna visiva nella tabella (per ora)
- Quando si crea un nuovo metodo appare un **toast di conferma** tipo `'Metodo pos_098 creato'`

---

## File coinvolti

| File | Tipo modifica |
|------|--------------|
| `src/main/ipc/metodi.ipc.ts` | Aggiunta handler `metodi:get-or-create` |
| `src/renderer/pages/composti/CompostoForm.tsx` | Campo Metodi con combobox multi-select |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | Stesso campo Metodi |
| `src/renderer/pages/composti/CompostoPanel.tsx` | Sezione Metodi in fondo al tab Dettaglio |

---

## TASK 1 — Backend: handler `metodi:get-or-create`

### File: `src/main/ipc/metodi.ipc.ts`

### Situazione attuale

Il file ha già questi handler: `metodi:list`, `metodi:get`, `metodi:create`, `metodi:update`, `metodi:delete`.

Non esiste un handler che crea un metodo se non esiste già.

### Modifica

Aggiungere **in fondo** alla funzione `registerMetodiIpc()`, prima della chiusura `}`:

```typescript
// FEAT-metodi-campo: crea il metodo se non esiste già (ricerca per nome, case-insensitive)
// Usato dal form composto quando l'utente digita un nuovo nome metodo
ipcMain.handle('metodi:get-or-create', (_, nome: string) => {
  const db = getDb()
  // Cerca prima per nome (case-insensitive)
  const existing = db.prepare(
    `SELECT * FROM metodi WHERE LOWER(nome) = LOWER(?)`
  ).get(nome) as any
  if (existing) return existing

  // Non esiste: crea metodo vuoto
  const id = 'met_' + Date.now().toString(36)
  db.prepare(
    `INSERT INTO metodi (id, nome) VALUES (?, ?)`
  ).run(id, nome)
  return db.prepare('SELECT * FROM metodi WHERE id = ?').get(id)
})
```

### Verifica
- Apri il form composto, digita `pos_test_123` come nuovo metodo → nell'app metodi deve comparire `pos_test_123` come metodo vuoto
- Se digiti di nuovo `pos_test_123` su un altro composto → non deve creare un duplicato

---

## TASK 2 — Frontend: campo Metodi in `CompostoForm.tsx`

### File: `src/renderer/pages/composti/CompostoForm.tsx`

### Situazione attuale

Il form gestisce già `metodi_ids` nello stato (array di stringhe). Questo array viene passato a `composti:create` / `composti:update` e salvato in `composti_metodi`. Tuttavia **non esiste un campo visivo** nel JSX per modificare questo array. L'utente non può associare metodi dal form.

### Modifiche

#### Modifica A — Import aggiuntivi in cima al file

Aggiungere agli import esistenti (dopo gli import attuali di `compostiApi`):

```typescript
import { useState as useStateLocal } from 'react' // già presente come useState
import { X } from 'lucide-react'
```

> ⚠️ `X` serve per il bottone di rimozione chip. Verifica se `lucide-react` è già importato nel file — se sì, aggiungi solo `X` alla lista degli import esistenti da lucide.

#### Modifica B — Stato aggiuntivo nel componente

Trovare il blocco degli `useState` all'inizio di `CompostoForm`. Dopo gli stati esistenti aggiungere:

```typescript
const [metodi, setMetodi] = useState<any[]>([])         // lista tutti i metodi disponibili
const [metodiInput, setMetodiInput] = useState('')       // testo digitato nella input
const [metodiSuggerimenti, setMetodiSuggerimenti] = useState<any[]>([]) // suggerimenti filtrati
const [metodiDropdownOpen, setMetodiDropdownOpen] = useState(false)
const [metodiToast, setMetodiToast] = useState('')       // messaggio conferma creazione metodo
```

#### Modifica C — Caricamento metodi disponibili nel `useEffect`

Il file ha già un `useEffect` che carica le voci di stoccaggio da anagrafiche. **Aggiungere** il caricamento dei metodi **nello stesso useEffect** (o in uno nuovo, indifferente), dopo il caricamento delle anagrafiche:

```typescript
// Carica la lista metodi disponibili
window.electronAPI.invoke('metodi:list').then((result: unknown) => {
  setMetodi(result as any[])
}).catch(err => console.error('Error loading metodi:', err))
```

#### Modifica D — Funzioni di gestione del campo Metodi

Aggiungere queste funzioni **prima del `return`** del componente:

```typescript
// Filtra i suggerimenti in base al testo digitato
const handleMetodiInput = (val: string) => {
  setMetodiInput(val)
  if (val.trim().length === 0) {
    setMetodiSuggerimenti([])
    setMetodiDropdownOpen(false)
    return
  }
  const currentIds = (form.metodi_ids || []) as string[]
  const filtered = metodi.filter(m =>
    m.nome.toLowerCase().includes(val.toLowerCase()) &&
    !currentIds.includes(m.id)
  )
  setMetodiSuggerimenti(filtered)
  setMetodiDropdownOpen(true)
}

// Seleziona un metodo esistente dal dropdown
const handleMetodoSelect = (metodo: any) => {
  const currentIds = (form.metodi_ids || []) as string[]
  if (!currentIds.includes(metodo.id)) {
    setForm(f => ({ ...f, metodi_ids: [...currentIds, metodo.id] }))
  }
  setMetodiInput('')
  setMetodiSuggerimenti([])
  setMetodiDropdownOpen(false)
}

// Crea un metodo nuovo (o recupera esistente) e lo aggiunge
// Se il metodo è nuovo mostra il toast di conferma per 2 secondi
const handleMetodoCreateOrAdd = async () => {
  const nome = metodiInput.trim()
  if (!nome) return
  try {
    const esistente = metodi.find(m => m.nome.toLowerCase() === nome.toLowerCase())
    const metodo = await window.electronAPI.invoke('metodi:get-or-create', nome) as any
    handleMetodoSelect(metodo)
    // Aggiorna la lista locale dei metodi disponibili
    setMetodi(prev => prev.find(m => m.id === metodo.id) ? prev : [...prev, metodo])
    // Toast solo se il metodo è stato appena creato (non esisteva prima)
    if (!esistente) {
      setMetodiToast(`Metodo "${nome}" creato`)
      setTimeout(() => setMetodiToast(''), 2500)
    }
  } catch (err) {
    console.error('Errore creazione metodo:', err)
  }
}

// Rimuove un metodo dai selezionati
const handleMetodoRemove = (metodoId: string) => {
  const currentIds = (form.metodi_ids || []) as string[]
  setForm(f => ({ ...f, metodi_ids: currentIds.filter(id => id !== metodoId) }))
}
```

#### Modifica E — JSX: campo Metodi in CIMA al form

Il form è diviso in sezioni (griglia a 2 colonne). Il campo Metodi è considerato importante e va posizionato **in cima**, come primo campo visibile dopo l'header del Dialog.

Trovare il primo campo del form nel JSX (tipicamente il campo `Nome` o la prima griglia). Aggiungere il blocco Metodi **prima** di quel primo campo:

```tsx
{/* Campo Metodi associati — IN CIMA al form, prima di tutti gli altri campi */}
<div className="mb-4">
  <Label className="text-xs">Metodi Analitici</Label>

  {/* Toast conferma creazione metodo */}
  {metodiToast && (
    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-1 mb-1">
      ✓ {metodiToast}
    </div>
  )}

  {/* Chip dei metodi selezionati */}
  {((form.metodi_ids || []) as string[]).length > 0 && (
    <div className="flex flex-wrap gap-1 mb-2 mt-1">
      {((form.metodi_ids || []) as string[]).map((mid: string) => {
        const m = metodi.find(m => m.id === mid)
        return (
          <span key={mid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs border border-blue-200">
            {m ? m.nome : mid}
            <button
              type="button"
              onClick={() => handleMetodoRemove(mid)}
              className="hover:text-blue-600"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )}

  {/* Input con dropdown suggerimenti */}
  <div className="relative">
    <Input
      value={metodiInput}
      onChange={e => handleMetodiInput(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (metodiSuggerimenti.length === 1) {
            handleMetodoSelect(metodiSuggerimenti[0])
          } else {
            handleMetodoCreateOrAdd()
          }
        }
        if (e.key === 'Escape') {
          setMetodiDropdownOpen(false)
          setMetodiInput('')
        }
      }}
      placeholder="Cerca o crea metodo (es. pos_098)..."
      className="text-sm"
    />

    {/* Dropdown suggerimenti */}
    {metodiDropdownOpen && (metodiSuggerimenti.length > 0 || metodiInput.trim().length > 0) && (
      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
        {metodiSuggerimenti.map(m => (
          <button
            key={m.id}
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => handleMetodoSelect(m)}
          >
            {m.nome}
          </button>
        ))}
        {metodiInput.trim() && !metodi.find(m => m.nome.toLowerCase() === metodiInput.toLowerCase()) && (
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-blue-600 border-t"
            onClick={handleMetodoCreateOrAdd}
          >
            + Crea metodo "{metodiInput.trim()}"
          </button>
        )}
      </div>
    )}
  </div>
  <p className="text-[11px] text-muted-foreground mt-1">
    Digita per cercare tra i metodi esistenti o premi Invio / clicca "+ Crea" per aggiungerne uno nuovo.
  </p>
</div>
```

### Verifica
- Apri form su un composto esistente → i metodi già associati devono essere visibili come chip
- Digita parte di un nome metodo esistente → compare il dropdown con suggerimenti
- Seleziona un metodo dal dropdown → appare come chip, il dropdown si chiude
- Digita un nome che non esiste → compare l'opzione "+ Crea metodo"
- Clicca "+ Crea metodo" → chip aggiunto, silenzioso
- Clicca X su un chip → chip rimosso
- Salva → i metodi sono salvati correttamente (verificare in `composti_metodi`)

---

## TASK 3 — Frontend: campo Metodi in `MixPesticidiForm.tsx`

### File: `src/renderer/pages/composti/MixPesticidiForm.tsx`

### Situazione attuale

Il form Mix non ha alcun campo per i metodi. Il payload inviato a `composti:create-mix` non include `metodi_ids`.

### Modifiche

#### Modifica A — Import `X` da lucide-react

Aggiungere `X` agli import lucide esistenti nel file.

#### Modifica B — Stato aggiuntivo

Trovare il blocco `useState` del form Mix. Aggiungere dopo gli stati esistenti:

```typescript
const [metodi, setMetodi] = useState<any[]>([])
const [metodiIds, setMetodiIds] = useState<string[]>([])
const [metodiInput, setMetodiInput] = useState('')
const [metodiSuggerimenti, setMetodiSuggerimenti] = useState<any[]>([])
const [metodiDropdownOpen, setMetodiDropdownOpen] = useState(false)
```

#### Modifica C — Caricamento metodi nel `useEffect` esistente

Il file ha già un `useEffect` per caricare le anagrafiche. Aggiungere alla fine dello stesso `useEffect`:

```typescript
window.electronAPI.invoke('metodi:list').then((result: unknown) => {
  setMetodi(result as any[])
}).catch(err => console.error('Error loading metodi:', err))
```

#### Modifica D — Stesse funzioni di gestione di TASK 2

Aggiungere le stesse funzioni `handleMetodiInput`, `handleMetodoSelect`, `handleMetodoCreateOrAdd` di TASK 2 — ma operando su `metodiIds` / `setMetodiIds` invece di `form.metodi_ids`.

#### Modifica E — Aggiungere `metodi_ids` nel reset

Trovare la funzione `reset()`. Aggiungere al reset:
```typescript
setMetodiIds([])
setMetodiInput('')
```

#### Modifica F — Passare `metodi_ids` al payload di salvataggio

Trovare la chiamata a `compostiApi.createMix(...)` nella funzione di salvataggio. Aggiungere `metodi_ids: metodiIds` al payload.

> ⚠️ **Attenzione**: `composti:create-mix` attualmente NON gestisce `metodi_ids`. Vedere TASK 4.

#### Modifica G — JSX: campo Metodi in fondo al form Mix

Aggiungere lo stesso blocco JSX di TASK 2 (Modifica E), adattando i riferimenti da `form.metodi_ids` a `metodiIds` e da `setForm(f => ({...f, metodi_ids: ...}))` a `setMetodiIds(...)`.

---

## TASK 4 — Backend: `metodi_ids` in `composti:create-mix`

### File: `src/main/ipc/composti.ipc.ts`

### Situazione attuale

L'handler `composti:create-mix` crea N composti con gli stessi metadati ma **non gestisce `metodi_ids`**. Anche se il form li passa, vengono ignorati.

### Modifica

**Parte A — Aggiungere `metodi_ids` al tipo dell'handler**

Trovare la definizione del tipo nell'handler `composti:create-mix`:
```typescript
ipcMain.handle('composti:create-mix', (_, data: {
  forma_commerciale: string
  forma: string
  // ... altri campi ...
  fiala?: string | null
  nomi: string[]
}) => {
```

Aggiungere `metodi_ids?: string[]` prima di `nomi: string[]`:
```typescript
  metodi_ids?: string[]   // ← aggiungere questa riga
  nomi: string[]
```

**Parte B — Estrarre `metodi_ids` e usarli**

Trovare il blocco `db.transaction(() => {` dentro `composti:create-mix`. Attualmente inserisce i composti in un loop `for (const nome of data.nomi)`. La transazione è:

```typescript
db.transaction(() => {
  for (const nome of data.nomi) {
    insert.run({ ...common, nome, mix_id })
  }
})()
```

Sostituire con:

```typescript
const insertLink = db.prepare(
  'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
)
db.transaction(() => {
  for (const nome of data.nomi) {
    const result = insert.run({ ...common, nome, mix_id })
    const newId = result.lastInsertRowid
    for (const mid of (data.metodi_ids || [])) {
      insertLink.run(newId, mid)
    }
  }
})()
```

> ⚠️ Verifica che `insert.run(...)` restituisca il risultato — la variabile `insert` è un `db.prepare(...)`. La chiamata `.run()` restituisce `{ lastInsertRowid, changes }`. Assegna il risultato a una variabile `result` e usa `result.lastInsertRowid`.

### Verifica
- Crea un Mix con un metodo associato → tutti i composti del mix devono avere quel metodo associato (verificabile nel pannello laterale di ciascuno)

---

## TASK 5 — Frontend: Metodi nel pannello laterale `CompostoPanel.tsx`

### File: `src/renderer/pages/composti/CompostoPanel.tsx`

### Situazione attuale

Il tab Dettaglio mostra i campi readonly del composto ma **non mostra i metodi associati**. Questi sono già presenti in `composto.metodi_ids` (array di ID) perché `composti:get` li carica.

Il problema è che `metodi_ids` è un array di ID stringa, ma per mostrare il **nome** del metodo serve fare una join. Attualmente il pannello non ha accesso ai nomi dei metodi.

### Modifica

#### Modifica A — Stato per i nomi dei metodi

Aggiungere dopo gli `useState` esistenti:

```typescript
const [metodiAssociati, setMetodiAssociati] = useState<any[]>([])
```

#### Modifica B — Caricare i nomi dei metodi quando cambia il composto

Il pannello ha già un `useEffect` che scatta quando cambia `compostoId` (la funzione `load()`). Aggiungere il caricamento dei metodi **dentro la funzione `load()`**, dopo che il composto è stato caricato:

```typescript
// Carica i nomi dei metodi associati
if (c.metodi_ids && c.metodi_ids.length > 0) {
  window.electronAPI.invoke('metodi:list').then((result: unknown) => {
    const tutti = result as any[]
    setMetodiAssociati(tutti.filter(m => c.metodi_ids.includes(m.id)))
  }).catch(() => setMetodiAssociati([]))
} else {
  setMetodiAssociati([])
}
```

#### Modifica C — JSX: sezione Metodi in fondo al tab Dettaglio

Nel tab Dettaglio (`<TabsContent value="dettaglio">`), trovare l'ultimo campo/riga prima della chiusura `</TabsContent>`. Aggiungere in fondo:

```tsx
{metodiAssociati.length > 0 && (
  <>
    <Separator />
    <div>
      <span className="text-xs text-muted-foreground">Metodi Analitici</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {metodiAssociati.map(m => (
          <Badge key={m.id} variant="outline" className="text-xs">{m.nome}</Badge>
        ))}
      </div>
    </div>
  </>
)}
```

### Verifica
- Apri un composto con metodi associati → nel tab Dettaglio, in fondo, compaiono i badge dei metodi
- Apri un composto senza metodi associati → la sezione non compare

---

## Ordine di esecuzione consigliato

| # | Task | Complessità | Verifica |
|---|------|-------------|----------|
| 1 | TASK 1 — Backend `metodi:get-or-create` | Bassa | Controllare in sezione Metodi che il metodo vuoto appaia |
| 2 | TASK 2 — Campo Metodi in `CompostoForm` | Alta | Test completo inserimento/rimozione chip, nuovo metodo |
| 3 | TASK 5 — Metodi nel pannello laterale | Bassa | Visivo, solo lettura |
| 4 | TASK 3 — Campo Metodi in `MixPesticidiForm` | Media | Come TASK 2 ma per i Mix |
| 5 | TASK 4 — Backend `create-mix` con metodi_ids | Media | Verifica associazione su tutti i composti del mix |

---

## Commit (dopo verifica completa di tutti i task)

```bash
git add src/main/ipc/metodi.ipc.ts
git add src/main/ipc/composti.ipc.ts
git add src/renderer/pages/composti/CompostoForm.tsx
git add src/renderer/pages/composti/MixPesticidiForm.tsx
git add src/renderer/pages/composti/CompostoPanel.tsx
git commit -m "feat(composti): campo metodi con combobox, creazione automatica metodo vuoto, badge nel pannello"
```

> ⚠️ **Non eseguire il commit** prima di avermi confermato che tutto funziona correttamente nell'app.

---

## Note e rischi

- **TASK 4**: `insert.run()` restituisce `lastInsertRowid` — verificare che la variabile `insert` sia effettivamente il `db.prepare(INSERT ...)`. Se il codice attuale fa `insert.run(...)` senza assegnare il risultato, basta aggiungere `const result =` davanti.
- **Dropdown accessibilità**: il dropdown dei suggerimenti si chiude premendo Escape o selezionando un elemento. Non ha gestione click-fuori (blur) per semplicità — se necessario si può aggiungere in seguito.
- **Metodi vuoti**: i metodi creati automaticamente hanno solo `id` e `nome`. Tutti gli altri campi (matrice, colonna, ecc.) sono null. Sono completamente editabili dalla sezione Metodi Analitici.
