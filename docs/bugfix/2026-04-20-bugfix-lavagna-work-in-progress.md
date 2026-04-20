# Bugfix — 2026-04-20-lavagna-selezione-sorgenti

## Problema

Nella vista “Lavagna” dello Schema di Calibrazione, la selezione delle card per creare una nuova Work (tramite `selSrcs`) non era visivamente distinguibile dalla selezione temporanea per ispezionare le dipendenze (nodo cliccato). Entrambe utilizzavano lo stesso stile (bordo blu spesso), causando confusione.

## Root cause

Il componente `SchemaLavagna` gestiva un unico stato `selectedId` che determinava sia il bordo blu (`selected`) sia l’evidenziazione (`highlighted`). La mappa `selSrcs` (selezione persistente) non influenzava direttamente `selected`, ma solo un’ombra leggera. Cliccando su un nodo, il bordo blu si spostava, cancellando l’indicazione delle sorgenti selezionate.

## Fix

Separazione netta:
- **`selected`** (bordo blu spesso) → nodi in `selSrcs` (selezione persistente)
- **`highlighted`** (ombra viola) → nodo cliccato (`selectedId`) e connessioni

### Modifiche in `SchemaCalibrazione.lavagna.tsx`

**1. Nuovo effetto per `selected` basato su `selSrcs`**

```ts
useEffect(() => {
  if (isDraggingRef.current) return
  setRfNodes(prev => prev.map(node => {
    let shouldBeSelected = false
    if (node.type === 'mix') {
      const mixId = (node.data as MixNodeData)?.meta?.mixId
      if (mixId && selSrcs.has(mixId)) shouldBeSelected = true
    } else if (node.type === 'sng') {
      const sngId = (node.data as SngNodeData)?.meta?.id
      if (sngId && selSrcs.has(sngId)) shouldBeSelected = true
    } else if (node.type === 'work') {
      const workId = (node.data as WorkNodeData)?.meta?.id
      if (workId && selSrcs.has(workId)) shouldBeSelected = true
    }
    const currentSelected = (node.data as any).selected ?? false
    if (shouldBeSelected === currentSelected) return node
    return { ...node, data: { ...node.data, selected: shouldBeSelected } }
  }))
}, [selSrcs, setRfNodes])
```

**2. L’effetto per `highlighted` ora aggiorna SOLO `highlighted`** (nessuna modifica a `selected`)

**3. `highlightedIdsWithSel` include `selectedId`**

```ts
const highlightedIdsWithSel = useMemo(() => {
  const out = new Set(highlightedIds)
  for (const m of moduli) {
    if (m.kind === 'mix' && selSrcs.has(m.mixId)) out.add(m.id)
    if (m.kind === 'sng' && selSrcs.has(m.id)) out.add(m.id)
    if (m.kind === 'work' && selSrcs.has(m.id)) out.add(m.id)
  }
  if (selectedId) out.add(selectedId)
  return out
}, [highlightedIds, selSrcs, moduli, selectedId])
```

**4. Inizializzazione nodi strutturali con `selected: false`**

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | Separazione logica `selected` vs `highlighted`; nuovo effetto per `selSrcs`; `selectedId` aggiunto a `highlightedIdsWithSel`. |

## Note

- **Bordo blu spesso** → sorgenti selezionate per creare Work (persistente)
- **Ombra viola** → nodo cliccato per ispezione (temporaneo)
- Archi evidenziati solo per il nodo cliccato
- La selezione persistente rimane sempre visibile