# Fix layout clipping + Aggiungi restart schema

## Context

Le card Work in basso vengono tagliate (clipped) perché la catena di altezze CSS non si propaga correttamente. `SchemaCalibrazione` usa `height:'100%'` ma il suo parent `<main class="flex-1 overflow-auto p-4">` è un scroll container — il `100%` si risolve rispetto al contenuto, non all'area vincolata. Quindi il workspace non riceve mai un vincolo di altezza reale, e `overflowY:'auto'` nelle colonne Work non attiva lo scroll.

Inoltre manca un modo per "ricaricare" lo schema dopo modifiche, l'utente non può tornare indietro.

---

## Piano di implementazione

### 1. Fix layout: `height: 100%` → `height: calc(100vh - 48px - 32px)`

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (riga ~728)

Il Topbar è `h-12` (48px). Il `<main>` ha `p-4` (16px × 2 = 32px padding top+bottom).

Cambiare il root container di SchemaCalibrazione da:
```tsx
height:'100%', minHeight:0,
```
a:
```tsx
height:'calc(100vh - 48px - 32px)', minHeight:0,
```

Questo dà al componente un'altezza **assoluta** calcolata dallo spazio realmente disponibile, indipendente dalla catena `overflow-auto`. L'altezza è: viewport - topbar - padding del main.

> Nota: i tentativi precedenti con `calc` sono falliti perché usavano un wrapper extra con margin negativo. Qui la modifica è solo sull'altezza del root div, nessun wrapper aggiuntivo.

### 2. Aggiungi pulsante "Ricarica Schema" nella bottom bar

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

**2a.** Destructure `reload` dal hook (riga ~572):
```tsx
const { crmItems, analiti, loading, error, reload } = useSchemaData(metodoId)
```

**2b.** Aggiungere stato per conferma reset:
```tsx
const [confirmReset, setConfirmReset] = useState(false)
```

**2c.** Aggiungere funzione `handleRestart`:
```tsx
const handleRestart = useCallback(async () => {
  setSchemaLoaded(false)
  setWorkCols([[]])
  setRemovedCon(new Set())
  setRemovedMix(new Set())
  setSelSrcs(new Map())
  await reload()
  // schemaLoaded=false + loading→false trigger il useEffect che ri-carica lo schema dal DB
}, [reload])
```

Questo:
- Resetta lo stato locale
- Ricarica i dati CRM dal DB (nuovi composti, dismissioni, rivalidazioni)
- Il `useEffect` a riga 594 ri-carica `workCols/removedCon/removedMix` dal DB (l'ultimo auto-save)

**2d.** Aggiungere pulsante nella bottom bar (a sinistra, vicino al warning):
```tsx
<button onClick={() => setConfirmReset(true)} style={{...}}>
  ↻ Ricarica
</button>
```

**2e.** Dialog di conferma (semplice `window.confirm` o inline):
```tsx
{confirmReset && (
  <ConfirmDialog
    open={confirmReset}
    title="Ricarica schema?"
    message="Ricarica i dati CRM dal database e ripristina lo schema dall'ultimo salvataggio."
    onConfirm={() => { setConfirmReset(false); handleRestart() }}
    onCancel={() => setConfirmReset(false)}
  />
)}
```

Verificare se `ConfirmDialog` è già importato o disponibile nel progetto.

### 3. Opzione "Reset completo" (cancella tutto e ricomincia da zero)

Aggiungere un secondo pulsante o opzione nel dialog: **"Ricomincia da zero"** che:
```tsx
const handleFullReset = useCallback(async () => {
  // Salva schema vuoto nel DB
  await schemaCalApi.save(metodoId, [[]], [], [])
  // Poi ricarica
  setSchemaLoaded(false)
  setWorkCols([[]])
  setRemovedCon(new Set())
  setRemovedMix(new Set())
  setSelSrcs(new Map())
  await reload()
  setSchemaLoaded(true) // non ri-caricare dal DB, lo stato è già pulito
}, [metodoId, reload])
```

Per il dialog si può usare un dialog con due pulsanti:
- **"Ricarica"** → `handleRestart` (ricarica CRM + ripristina ultimo salvataggio)
- **"Ricomincia da zero"** → `handleFullReset` (cancella tutto)

---

## File da modificare

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Fix height, destructure reload, stati reset, funzioni restart/fullReset, pulsante + dialog nella bottom bar |

Nessun altro file da modificare.

---

## Verifica

1. Aprire SchemaCalibrazione con un metodo che ha molti analiti (>15) per verificare che le card Work siano scrollabili e non tagliate
2. Verificare che header, step bar e bottom bar restino visibili
3. Verificare che lo scroll orizzontale del workspace funzioni ancora
4. Cliccare "Ricarica" → confermare → verificare che lo schema si ricarichi dall'ultimo salvataggio
5. Cliccare "Ricomincia da zero" → verificare che work e rimozioni vengano cancellate
6. Ridimensionare la finestra per verificare che il layout si adatti (il `calc(100vh - ...)` è reattivo)
