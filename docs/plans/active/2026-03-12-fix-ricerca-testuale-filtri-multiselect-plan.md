# Piano — Fix Ricerca Testuale + Filtri Multi-Select
**Data:** 2026-03-12  
**Branch:** `fix/ricerca-e-filtri-multi`  
**Modulo:** `composti` — `CompostiPage.tsx` + `composti.ipc.ts`  
**Stato:** ⏳ da fare

---

## Contesto

Due problemi distinti segnalati dall'utente:

1. **Ricerca testuale** — cerca solo per nome, non trova risultati su altri campi (es. `accreditamento_crm`, `metodo`, `classe`, ecc.)
2. **Filtri preimpostati** — selezione singola; mancano il filtro Metodo e la possibilità di selezionare più valori contemporaneamente (es. "Taratura" + "Controllo qualità")

---

## Causa del bug ricerca

La query SQL in `composti.ipc.ts` ha questa clausola:

```sql
conditions.push('(c.nome LIKE ? OR c.codice_interno LIKE ?)')
```

Questo filtro viene applicato **lato server** solo se il frontend passa `search` come parametro IPC — cosa che attualmente **non avviene**: il renderer carica tutti i composti e filtra in locale nel `useMemo`.

Il vero bug è che la ricerca locale in `CompostiPage.tsx` copre 15 campi nel codice, ma **`accreditamento_crm` e altri campi potrebbero non arrivare compilati dalla query SQL** se la SELECT li omette o li restituisce `null` per problemi di JOIN.

**Verifica preliminare richiesta** (vedi TASK 0).

---

## Panoramica interventi

| ID | Intervento | File | Priorità |
|----|-----------|------|----------|
| TASK-0 | Verifica che `SELECT c.*` restituisca tutti i campi | `composti.ipc.ts` | 🔴 Alta |
| TASK-1 | Fix ricerca: aggiungere campi mancanti al `useMemo` | `CompostiPage.tsx` | 🔴 Alta |
| TASK-2 | Caricamento lista metodi all'avvio pagina | `CompostiPage.tsx` | 🟡 Media |
| TASK-3 | Multi-select Destinazione d'Uso | `CompostiPage.tsx` | 🟡 Media |
| TASK-4 | Multi-select Stato | `CompostiPage.tsx` | 🟡 Media |
| TASK-5 | Multi-select Work Solution | `CompostiPage.tsx` | 🟡 Media |
| TASK-6 | Multi-select Metodo (nuovo filtro) | `CompostiPage.tsx` | 🟡 Media |
| TASK-7 | Badge rimovibili aggiornati per tutti i filtri | `CompostiPage.tsx` | 🟢 Bassa |

---

## Branch git

```bash
git checkout master
git pull
git checkout -b fix/ricerca-e-filtri-multi
```

---

## TASK-0 — Verifica query SQL (controllo preliminare)

**File:** `src/main/ipc/composti.ipc.ts`

Prima di modificare qualsiasi cosa, aprire il file e cercare la query `composti:list`.

Controllare che la SELECT inizi con `SELECT c.*` e che non ci siano colonne esplicite che escludono `accreditamento_crm`.

Cercare anche se esiste una clausola del tipo:
```sql
WHERE c.nome LIKE ? OR c.codice_interno LIKE ?
```

Se questa clausola **esiste e viene eseguita lato server**, va rimossa (o commentata) perché il filtraggio viene già fatto in locale nel renderer. Avere il filtro in entrambi i posti causa inconsistenze.

**Cosa fare se trovi la clausola di ricerca lato server:**

Trova il blocco:
```typescript
if (filters?.search) {
  conditions.push('(c.nome LIKE ? OR c.codice_interno LIKE ?)')
  params.push(`%${filters.search}%`, `%${filters.search}%`)
}
```

Commentalo così:
```typescript
// Ricerca gestita interamente lato renderer (CompostiPage useMemo)
// if (filters?.search) {
//   conditions.push('(c.nome LIKE ? OR c.codice_interno LIKE ?)')
//   params.push(`%${filters.search}%`, `%${filters.search}%`)
// }
```

> ⚠️ Non eliminare, solo commentare — nel caso serva in futuro.

---

## TASK-1 — Fix ricerca testuale nel useMemo

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

### Situazione attuale

Il `useMemo filtered` contiene già una ricerca su 15 campi, ma **`metodo`** non è tra questi perché i metodi sono in una tabella separata (`composti_metodi`) e non arrivano come stringa nel record del composto.

Cercare nel file il blocco che inizia con:
```typescript
if (search) {
  const q = search.toLowerCase()
  result = result.filter(c =>
    c.nome?.toLowerCase().includes(q) ||
```

Verificare che i seguenti campi siano presenti nell'elenco:
- `c.nome`
- `c.codice_interno`
- `c.classe`
- `c.produttore`
- `c.lotto`
- `c.ubicazione`
- `c.solvente`
- `c.forma_commerciale`
- `c.destinazione_uso`
- `c.forma`
- `c.formula`
- `c.fiala`
- `c.operatore_apertura`
- `c.stoccaggio`
- `c.accreditamento_crm`

Se uno o più campi **mancano**, aggiungerli con lo stesso pattern `|| c.campo?.toLowerCase().includes(q)`.

### Aggiunta ricerca per metodi associati

I metodi associati a un composto arrivano come array di ID in `c.metodi_ids`. Per cercare per nome metodo bisogna confrontare l'ID con la lista metodi caricata (vedi TASK-2).

Dopo aver completato TASK-2, aggiungere questa riga **in fondo** al blocco di ricerca:

```typescript
|| (metodi.some(m => 
    c.metodi_ids?.includes(m.id) && 
    m.nome?.toLowerCase().includes(q)
  ))
```

> ⚠️ Questo dipende da TASK-2. Fare TASK-2 prima.

---

## TASK-2 — Caricare la lista metodi all'avvio

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

I metodi devono essere caricati per due scopi:
1. Popolare la select del filtro Metodo (TASK-6)
2. Permettere la ricerca per nome metodo (TASK-1)

### Passo 1 — Aggiungere l'import dell'API metodi

In cima al file, trovare la riga:
```typescript
import { compostiApi } from '@/lib/api'
```

Aggiungere subito dopo:
```typescript
import { metodiApi } from '@/lib/api'
```

> Se `metodiApi` non esiste in `@/lib/api`, verificare come vengono chiamati i metodi (potrebbe essere `window.electronAPI.invoke('metodi:list')`). In quel caso usare:
> ```typescript
> const loadMetodi = () => window.electronAPI.invoke('metodi:list').then(setMetodi)
> ```

### Passo 2 — Aggiungere lo stato

Nel blocco degli `useState` all'inizio del componente, aggiungere:
```typescript
const [metodi, setMetodi] = useState<any[]>([])
```

### Passo 3 — Caricare all'avvio

Trovare la riga:
```typescript
const load = () => compostiApi.list().then(setComposti)
useEffect(() => { load() }, [])
```

Modificarla così:
```typescript
const load = () => compostiApi.list().then(setComposti)
const loadMetodi = () => window.electronAPI.invoke('metodi:list').then(setMetodi)
useEffect(() => { load(); loadMetodi() }, [])
```

---

## TASK-3 — Multi-select Destinazione d'Uso

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

### Passo 1 — Cambiare il tipo dello stato

Trovare:
```typescript
const [filtroDestinazione, setFiltroDestinazione] = useState('Tutti')
```

Sostituire con:
```typescript
const [filtroDestinazioni, setFiltroDestinazioni] = useState<string[]>([])
```

> Nota: il nome cambia da `filtroDestinazione` (singolare) a `filtroDestinazioni` (plurale).

### Passo 2 — Aggiornare la logica di filtraggio nel useMemo

Trovare:
```typescript
if (filtroDestinazione !== 'Tutti') {
  result = result.filter(c => c.destinazione_uso === filtroDestinazione)
}
```

Sostituire con:
```typescript
if (filtroDestinazioni.length > 0) {
  result = result.filter(c => filtroDestinazioni.includes(c.destinazione_uso))
}
```

Aggiornare anche le dipendenze del `useMemo` — trovare l'array `[composti, search, filtroStato, ...]` e sostituire `filtroDestinazione` con `filtroDestinazioni`.

### Passo 3 — Sostituire la Select con un componente multi-select nel JSX

Trovare il blocco JSX con la Select per Destinazione e **sostituirlo** con questo pattern a checkbox dropdown:

```tsx
{/* Filtro Destinazione d'Uso — multi-select */}
<div className="relative">
  <Button
    variant="outline"
    size="sm"
    className="h-8 text-sm gap-1"
    onClick={() => setDestinazioneOpen(v => !v)}
  >
    Destinazione
    {filtroDestinazioni.length > 0 && (
      <Badge className="ml-1 h-4 px-1 text-xs">{filtroDestinazioni.length}</Badge>
    )}
  </Button>
  {destinazioneOpen && (
    <div className="absolute z-50 mt-1 w-52 rounded-md border bg-popover shadow-md p-1">
      {DESTINAZIONI_USO.map(d => (
        <label key={d} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded">
          <input
            type="checkbox"
            checked={filtroDestinazioni.includes(d)}
            onChange={() => setFiltroDestinazioni(prev =>
              prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
            )}
          />
          {d}
        </label>
      ))}
      {filtroDestinazioni.length > 0 && (
        <button
          className="w-full text-xs text-muted-foreground mt-1 px-2 py-1 hover:text-foreground"
          onClick={() => setFiltroDestinazioni([])}
        >
          Rimuovi filtro
        </button>
      )}
    </div>
  )}
</div>
```

Aggiungere lo stato per il dropdown aggiunto:
```typescript
const [destinazioneOpen, setDestinazioneOpen] = useState(false)
```

---

## TASK-4 — Multi-select Stato

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

### Passo 1 — Cambiare il tipo dello stato

Trovare:
```typescript
const [filtroStato, setFiltroStato] = useState('Tutti')
```

Sostituire con:
```typescript
const [filtroStati, setFiltroStati] = useState<string[]>([])
```

### Passo 2 — Aggiornare la logica di filtraggio

Trovare:
```typescript
if (filtroStato !== 'Tutti') {
  result = result.filter(c => computeStato(c) === STATO_MAP[filtroStato])
}
```

Sostituire con:
```typescript
if (filtroStati.length > 0) {
  result = result.filter(c => filtroStati.some(s => computeStato(c) === STATO_MAP[s]))
}
```

Aggiornare le dipendenze del `useMemo`: sostituire `filtroStato` con `filtroStati`.

### Passo 3 — Aggiornare il JSX

Stesso pattern a checkbox dropdown di TASK-3, usando le chiavi di `STATO_MAP`:

```tsx
{/* Filtro Stato — multi-select */}
<div className="relative">
  <Button variant="outline" size="sm" className="h-8 text-sm gap-1"
    onClick={() => setStatoOpen(v => !v)}>
    Stato
    {filtroStati.length > 0 && (
      <Badge className="ml-1 h-4 px-1 text-xs">{filtroStati.length}</Badge>
    )}
  </Button>
  {statoOpen && (
    <div className="absolute z-50 mt-1 w-56 rounded-md border bg-popover shadow-md p-1">
      {Object.keys(STATO_MAP).map(s => (
        <label key={s} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded">
          <input
            type="checkbox"
            checked={filtroStati.includes(s)}
            onChange={() => setFiltroStati(prev =>
              prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
            )}
          />
          {s}
        </label>
      ))}
      {filtroStati.length > 0 && (
        <button className="w-full text-xs text-muted-foreground mt-1 px-2 py-1 hover:text-foreground"
          onClick={() => setFiltroStati([])}>
          Rimuovi filtro
        </button>
      )}
    </div>
  )}
</div>
```

Aggiungere lo stato:
```typescript
const [statoOpen, setStatoOpen] = useState(false)
```

---

## TASK-5 — Multi-select Work Solution

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

### Passo 1 — Cambiare il tipo dello stato

Trovare:
```typescript
const [filtroWork, setFiltroWork] = useState('Tutti')
```

Sostituire con:
```typescript
const [filtroWorks, setFiltroWorks] = useState<string[]>([])
```

### Passo 2 — Aggiornare la logica di filtraggio

Trovare:
```typescript
if (filtroWork !== 'Tutti') {
  result = result.filter(c => c.work_standard === filtroWork)
}
```

Sostituire con:
```typescript
if (filtroWorks.length > 0) {
  result = result.filter(c => filtroWorks.includes(c.work_standard))
}
```

Aggiornare le dipendenze del `useMemo`: sostituire `filtroWork` con `filtroWorks`.

Aggiornare anche `opzioniWork` nel `useMemo` — rimuovere la voce `'Tutti'` dall'array che genera le opzioni (non serve più):

```typescript
const opzioniWork = useMemo(() => [
  ...Array.from(
    new Set(composti.map(c => c.work_standard).filter((v): v is string => !!v && v.trim() !== ''))
  ).sort()
], [composti])
```

### Passo 3 — Aggiornare il JSX

Stesso pattern a checkbox dropdown:

```tsx
{/* Filtro Work Solution — multi-select */}
<div className="relative">
  <Button variant="outline" size="sm" className="h-8 text-sm gap-1"
    onClick={() => setWorkOpen(v => !v)}>
    Work
    {filtroWorks.length > 0 && (
      <Badge className="ml-1 h-4 px-1 text-xs">{filtroWorks.length}</Badge>
    )}
  </Button>
  {workOpen && (
    <div className="absolute z-50 mt-1 w-56 rounded-md border bg-popover shadow-md p-1">
      {opzioniWork.map(w => (
        <label key={w} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded">
          <input
            type="checkbox"
            checked={filtroWorks.includes(w)}
            onChange={() => setFiltroWorks(prev =>
              prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
            )}
          />
          {w}
        </label>
      ))}
      {filtroWorks.length > 0 && (
        <button className="w-full text-xs text-muted-foreground mt-1 px-2 py-1 hover:text-foreground"
          onClick={() => setFiltroWorks([])}>
          Rimuovi filtro
        </button>
      )}
    </div>
  )}
</div>
```

Aggiungere lo stato:
```typescript
const [workOpen, setWorkOpen] = useState(false)
```

---

## TASK-6 — Multi-select Metodo (nuovo filtro)

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

> ⚠️ Questo task dipende da TASK-2 (caricamento lista metodi).

### Passo 1 — Aggiungere lo stato

```typescript
const [filtroMetodi, setFiltroMetodi] = useState<string[]>([])
const [metodoOpen, setMetodoOpen] = useState(false)
```

### Passo 2 — Aggiungere la logica di filtraggio nel useMemo

Trovare il blocco con `if (filtroMetodo)` (filtro metodo singolo attuale) e **sostituirlo** con:

```typescript
if (filtroMetodi.length > 0) {
  result = result.filter(c =>
    c.metodi_ids?.some((id: string) => filtroMetodi.includes(id))
  )
}
```

Aggiungere `filtroMetodi` alle dipendenze del `useMemo`.

### Passo 3 — Aggiungere il JSX

Inserire nella barra filtri dopo il filtro Work:

```tsx
{/* Filtro Metodo — multi-select */}
<div className="relative">
  <Button variant="outline" size="sm" className="h-8 text-sm gap-1"
    onClick={() => setMetodoOpen(v => !v)}>
    Metodo
    {filtroMetodi.length > 0 && (
      <Badge className="ml-1 h-4 px-1 text-xs">{filtroMetodi.length}</Badge>
    )}
  </Button>
  {metodoOpen && (
    <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover shadow-md p-1 max-h-60 overflow-y-auto">
      {metodi.map(m => (
        <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded">
          <input
            type="checkbox"
            checked={filtroMetodi.includes(m.id)}
            onChange={() => setFiltroMetodi(prev =>
              prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]
            )}
          />
          {m.nome}
        </label>
      ))}
      {metodi.length === 0 && (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">Nessun metodo</p>
      )}
      {filtroMetodi.length > 0 && (
        <button className="w-full text-xs text-muted-foreground mt-1 px-2 py-1 hover:text-foreground"
          onClick={() => setFiltroMetodi([])}>
          Rimuovi filtro
        </button>
      )}
    </div>
  )}
</div>
```

---

## TASK-7 — Aggiornare i badge rimovibili

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

I badge dei filtri attivi mostrati sotto la barra vanno aggiornati per i nuovi filtri multipli.

### Pattern badge multi-valore

```tsx
{filtroDestinazioni.map(d => (
  <Badge key={d} variant="secondary" className="cursor-pointer gap-1"
    onClick={() => setFiltroDestinazioni(prev => prev.filter(x => x !== d))}>
    {d} ×
  </Badge>
))}

{filtroStati.map(s => (
  <Badge key={s} variant="secondary" className="cursor-pointer gap-1"
    onClick={() => setFiltroStati(prev => prev.filter(x => x !== s))}>
    {s} ×
  </Badge>
))}

{filtroWorks.map(w => (
  <Badge key={w} variant="secondary" className="cursor-pointer gap-1"
    onClick={() => setFiltroWorks(prev => prev.filter(x => x !== w))}>
    {w} ×
  </Badge>
))}

{filtroMetodi.map(id => (
  <Badge key={id} variant="secondary" className="cursor-pointer gap-1"
    onClick={() => setFiltroMetodi(prev => prev.filter(x => x !== id))}>
    {metodi.find(m => m.id === id)?.nome ?? id} ×
  </Badge>
))}
```

---

## Riepilogo stati da aggiungere/modificare

```typescript
// NUOVI
const [metodi, setMetodi] = useState<any[]>([])
const [filtroDestinazioni, setFiltroDestinazioni] = useState<string[]>([])
const [filtroStati, setFiltroStati] = useState<string[]>([])
const [filtroWorks, setFiltroWorks] = useState<string[]>([])
const [filtroMetodi, setFiltroMetodi] = useState<string[]>([])
const [destinazioneOpen, setDestinazioneOpen] = useState(false)
const [statoOpen, setStatoOpen] = useState(false)
const [workOpen, setWorkOpen] = useState(false)
const [metodoOpen, setMetodoOpen] = useState(false)

// DA RIMUOVERE (rimpiazzati)
// const [filtroStato, setFiltroStato] = useState('Tutti')
// const [filtroWork, setFiltroWork] = useState('Tutti')
// const [filtroDestinazione, setFiltroDestinazione] = useState('Tutti')
// const [filtroMetodo, setFiltroMetodo] = useState('')
```

---

## Chiusura dropdown al click fuori (opzionale ma consigliato)

Per chiudere i dropdown quando si clicca altrove nella pagina, aggiungere un `useEffect` con listener sul documento:

```typescript
useEffect(() => {
  const handler = () => {
    setDestinazioneOpen(false)
    setStatoOpen(false)
    setWorkOpen(false)
    setMetodoOpen(false)
  }
  document.addEventListener('click', handler)
  return () => document.removeEventListener('click', handler)
}, [])
```

> ⚠️ Se questo causa la chiusura immediata al click sul pulsante stesso, aggiungere `e.stopPropagation()` sui bottoni dei dropdown.

---

## Commit finale

```bash
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/main/ipc/composti.ipc.ts
git commit -m "fix(composti): ricerca estesa tutti i campi + filtri multi-select (stato, work, destinazione, metodo)"
```

---

## Note operative

- Fare i task **nell'ordine indicato** — TASK-2 è prerequisito di TASK-1 e TASK-6.
- TASK-0 è solo lettura/verifica — non produce modifiche obbligatorie.
- Se durante la modifica trovi nomi di variabili leggermente diversi da quelli indicati, adatta senza cambiare la logica.
- Non modificare file non elencati.
- Dopo ogni task, salvare e testare nel renderer prima di passare al successivo.