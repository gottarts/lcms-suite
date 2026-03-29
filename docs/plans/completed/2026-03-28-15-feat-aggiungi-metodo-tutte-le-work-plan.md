# Piano: "+ Metodo ↗" per tutte le work in WorkPage

## Context
Attualmente il pulsante "+ Metodo ↗" nelle card di WorkPage compare solo per le work orfane (`primo_metodo_id === null`). Le work già associate a un metodo mostrano solo "Schema ↗". L'utente vuole poter aggiungere qualsiasi work a un metodo direttamente dalla card — incluse work già associate ad altri metodi (per associazioni multiple).

La logica del dialog (`AggiungiASchemaDialog`) e dell'IPC `metodi:list-for-work` è già generica. La restrizione è solo nella condizione di rendering in `WorkPage.tsx`. Aggiunta: escludere dalla lista i metodi a cui la work è già associata (tabella `work_metodi`, esposta tramite `workApi.get().metodi_ids`).

## Cambiamenti

### 1. `src/renderer/pages/work/WorkPage.tsx` — riga 132

Rimuovere la condizione `!w.primo_metodo_id`:

```tsx
// PRIMA
onAddToSchema={!w.primo_metodo_id ? () => setAddToSchemaWork({ id: w.id, nome: w.nome }) : undefined}

// DOPO
onAddToSchema={() => setAddToSchemaWork({ id: w.id, nome: w.nome })}
```

Effetto UX per work con metodo: "Prepara?" + "Schema ↗" + "+ Metodo ↗" (3 pulsanti in flex).

### 2. `src/renderer/pages/work/AggiungiASchemaDialog.tsx` — primo `useEffect` (righe 89-95)

Caricare in parallelo la lista metodi E i `metodi_ids` già associati alla work, poi filtrare:

```typescript
// PRIMA
useEffect(() => {
  if (!open || !workId) return
  setSelectedMetodoId('')
  setSchemaState(null)
  setError(null)
  metodiApi.listForWork(workId).then(setMetodi).catch(() => setMetodi([]))
}, [open, workId])

// DOPO
useEffect(() => {
  if (!open || !workId) return
  setSelectedMetodoId('')
  setSchemaState(null)
  setError(null)
  Promise.all([
    metodiApi.listForWork(workId),
    workApi.get(workId),
  ]).then(([all, dbWork]) => {
    const assoc = new Set<string>((dbWork?.metodi_ids ?? []))
    setMetodi(all.filter((m: any) => !assoc.has(m.id)))
  }).catch(() => setMetodi([]))
}, [open, workId])
```

`workApi.get()` è già importato nel file (usato alla riga 105 nel secondo `useEffect`). Nessuna nuova dipendenza.

### 3. `src/renderer/pages/work/AggiungiASchemaDialog.tsx` — commento header (righe 2-6)

```typescript
// PRIMA
// Usato da WorkPage quando una work non è collegata ad alcun metodo
// (primo_metodo_id = null). A differenza di ImportaWorkDialog, non filtra per
// analiti condivisi: la work può entrare in qualsiasi schema.

// DOPO
// Usato da WorkPage per aggiungere qualsiasi work a un metodo di calibrazione.
// Filtra i metodi per analiti condivisi (metodi:list-for-work) ed esclude quelli
// a cui la work è già associata (work_metodi via workApi.get().metodi_ids).
```

## File critici
- [WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx) — riga 132
- [AggiungiASchemaDialog.tsx](src/renderer/pages/work/AggiungiASchemaDialog.tsx) — primo `useEffect` + commento

## Verifica
1. Work orfana: pulsante "+ Metodo ↗" compare e funziona come prima
2. Work con metodo X: appare sia "Schema ↗" che "+ Metodo ↗"; aprendo il dialog, metodo X NON è in lista
3. Work associata a più metodi: tutti i metodi già associati sono esclusi dalla lista
4. Work con metodi associati ma analiti NON condivisi con altri metodi: lista vuota → dialog mostra "Nessun metodo disponibile"
