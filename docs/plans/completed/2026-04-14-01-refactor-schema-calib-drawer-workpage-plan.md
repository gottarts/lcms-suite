# Piano: Sostituire DrawerDettaglioWork con WorkDrawer in SchemaCalibrazione

## Contesto

Esiste incongruenza tra il drawer delle work in SchemaCalibrazione e il WorkDrawer della WorkPage:
- `DrawerDettaglioWork` è un componente interno a `SchemaCalibrazione.tsx` (~400 righe) duplicando logica già presente in `WorkDrawer.tsx`
- I due drawer mostrano informazioni simili (volumi, catena tracciabilità, composti) ma con UI e comportamenti leggermente diversi
- L'obiettivo è eliminare `DrawerDettaglioWork` e usare direttamente `WorkDrawer` anche da SchemaCalibrazione, aggiungendo solo le prop necessarie per adattarlo al contesto schema

## Differenze chiave da gestire

| Aspetto | DrawerDettaglioWork | WorkDrawer |
|---------|---------------------|------------|
| Input | `work: WorkInSchema` + `colIdx` | `workId: number \| null` |
| Elimina | Rimuove dalla colonna schema (non DB) | Elimina dal DB |
| Azioni extra | Solo Elimina schema | Modifica, Elimina DB, Archivia, Vai a Schema |

## Approccio

### 1. Aggiungere props opzionali a `WorkDrawer`

In [WorkDrawer.tsx](src/renderer/pages/work/WorkDrawer.tsx), estendere l'interfaccia `WorkDrawerProps`:

```typescript
interface WorkDrawerProps {
  workId: number | null
  onClose: () => void
  onEdit: (work: any) => void
  onDelete: (id: number) => void
  onArchivia?: (id: number) => void
  onVaiASchema?: (metodoId: string) => void
  metodiNomi?: Record<string, string>
  // Nuove props per contesto schema:
  onDeleteFromSchema?: (colIdx: number, workIdx: number) => void  // se presente, sostituisce onDelete nel bottone
  schemaColIdx?: number        // colonna nello schema (0 = work finale, >0 = intermedia)
}
```

- Se `onDeleteFromSchema` è presente, il pulsante "Elimina" chiama `onDeleteFromSchema(schemaColIdx, workIdx)` invece di `onDelete(id)`
- Se `schemaColIdx` è definito e > 0, il subtitle diventa `Intermedia lv.${schemaColIdx}` (come ora)
- Le azioni Modifica/Archivia si nascondono se `onDeleteFromSchema` è presente (siamo in contesto schema, non WorkPage)

### 2. Modificare SchemaCalibrazione per usare WorkDrawer

In [SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx):

- Rimuovere il componente interno `DrawerDettaglioWork` (righe ~375–788)
- Rimuovere l'interfaccia `DrawerProps` (righe ~377–385)
- Aggiungere import di `WorkDrawer`
- Nel render (righe ~1389–1399), sostituire `<DrawerDettaglioWork>` con `<WorkDrawer>`:

```tsx
{drawerWork?.dbId && (
  <WorkDrawer
    workId={drawerWork.dbId}
    onClose={() => setDrawerWork(null)}
    onEdit={() => {}}            // no-op: modifica non disponibile da schema
    onDelete={() => {}}          // no-op: usa onDeleteFromSchema
    onDeleteFromSchema={(ci, wi) => { handleDeleteWork(ci, wi); setDrawerWork(null) }}
    schemaColIdx={drawerCol}
  />
)}
```

Nota: se `drawerWork.dbId` è undefined (work non ancora salvata nel DB), il drawer non si apre — questo è il comportamento corretto perché una work senza dbId non ha dati caricabili.

### 3. Controllare visibilità pulsanti in WorkDrawer

Nella sezione azioni di `WorkDrawer`, la logica di rendering dei pulsanti diventa:

- **Elimina da schema**: mostra solo se `onDeleteFromSchema` è presente
- **Modifica / Archivia**: mostra solo se `onDeleteFromSchema` è assente (contesto WorkPage normale)
- **Elimina DB**: mostra solo se `onDeleteFromSchema` è assente

## File critici

- [src/renderer/pages/work/WorkDrawer.tsx](src/renderer/pages/work/WorkDrawer.tsx) — aggiungere props `onDeleteFromSchema`, `schemaColIdx`; condizionare visibilità pulsanti
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — rimuovere `DrawerDettaglioWork` (~413 righe), aggiungere import e uso di `WorkDrawer`

## Verifica

1. Aprire uno schema calibrazione con work esistenti (con dbId)
2. Cliccare "⊙" su una work → deve aprirsi il WorkDrawer con le stesse info di prima (volumi, tracciabilità, composti)
3. Il drawer deve mostrare solo il pulsante "Elimina" (dal schema), non Modifica né Archivia
4. Cliccare Elimina → la work deve sparire dalla colonna dello schema (non dal DB)
5. Aprire una work dalla WorkPage → il drawer deve funzionare come prima (Modifica, Elimina DB, Archivia)
6. Work senza dbId nello schema: il click "⊙" non apre nessun drawer (gestito da `drawerWork?.dbId`)
