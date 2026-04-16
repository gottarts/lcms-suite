# Piano: Fix refresh lista work dopo Prepara/Rinnova

## Context

Dopo aver salvato una preparazione tramite il dialog "Prepara/Rinnova" in WorkPage, la lista work non si aggiornava automaticamente. L'utente doveva cambiare modulo e tornare su WorkPage per vedere la nuova preparazione.

**Causa radice identificata — doppio problema:**

1. **Badge/stato della riga**: `handlePrepara` (riga 134) chiama `load(mostraArchivio)` che aggiorna `works`. La funzione `load` però cattura `mostraArchivio` tramite closure normale (non `useCallback`) — quando chiamata, legge il valore corretto perché è `async` e lo legge al momento della chiamata. Questa parte funziona.

2. **Storico espanso non si aggiorna**: `WorkRow` ha stato locale `storico` caricato una sola volta in `useEffect(() => { ... }, [])` (riga 480-487). Dopo `handlePrepara`, il padre ri-carica `works` e aggiorna le props `work`, ma `WorkRow` non sa che deve ricaricare il proprio `storico` locale — il `useEffect` con array di dipendenze vuoto non si riesegue. La nuova preparazione non appare nello storico espanso.

3. **`useDbChange`** ascolta solo `db:external-change` che viene emesso solo quando il file `.db` cambia su disco (da altro processo, multi-PC). Una scrittura IPC locale **non** emette quell'evento.

---

## File critici

- `src/renderer/pages/work/WorkPage.tsx`
  - `handlePrepara`: righe 123-135
  - `WorkRow` component: righe 453-728
  - `storico` state in WorkRow: riga 475
  - `useEffect` che carica storico: righe 480-487

---

## Fix implementato

**Approccio: contatore per work**

```typescript
const [prepCount, setPrepCount] = useState<Record<number, number>>({})
```

In `handlePrepara`:
```typescript
const workId = preparaWorkId
await workApi.prepara({ work_id: workId, ... })
setPreparaSaving(false)
setPreparaWorkId(null)
setPrepCount(prev => ({ ...prev, [workId]: (prev[workId] ?? 0) + 1 }))
load(mostraArchivio)
```

Nella lista WorkRow:
```typescript
<WorkRow key={`${w.id}-${prepCount[w.id] ?? 0}`} ... />
```

---

## Verifica

1. Aprire WorkPage, espandere una work tracciata (con `validita_mesi`)
2. Cliccare "Prepara" o "Rinnova", compilare e confermare
3. La riga si aggiorna immediatamente: badge stato aggiornato + nuova riga nello storico espanso
4. Ripetere per la stessa work — il contatore garantisce remount anche al secondo salvataggio
5. Altre work non vengono remountate inutilmente (key invariata)
