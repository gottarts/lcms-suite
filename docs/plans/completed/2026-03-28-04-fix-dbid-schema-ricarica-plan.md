# Piano: Fix dbId schema dopo RicaricaDialog

## Context

Il resoconto di sessione del 2026-03-28 segnala un rischio: dopo che `work:ricarica` crea una nuova work e archivia la vecchia, il `dbId` nello schema JSON viene aggiornato via `setWorkCols` ma il salvataggio a DB dipende solo dal debounce auto-save di 500ms. Se l'utente naviga via (clicca "← Chiudi schema") entro quel finestra, il timer del debounce viene cancellato (`clearTimeout`) e lo schema rimane con il vecchio `dbId` (che ora punta a una work archiviata).

La "soluzione ipotetica" del resoconto è esatta: dopo aver aggiornato `w.dbId`, il chiamante deve richiamare `schema-cal:save` esplicitamente.

## Analisi del flusso attuale

**`RicaricaDialog.onSuccess`** (SchemaCalibrazione.tsx ~L1059):
```javascript
onSuccess={newWorkId => {
  if (ricaricaSchemaWorkId != null) {
    setWorkCols(prev => prev.map(col =>
      col.map(w => w.dbId === ricaricaSchemaWorkId ? { ...w, dbId: newWorkId } : w)
    ))
  }
  setRicaricaSchemaWorkId(null)
}}
```
- ✅ `dbId` viene aggiornato in `workCols`
- ❌ `schema-cal:save` NON viene chiamato esplicitamente
- ❌ Il salvataggio dipende dal debounce (500ms) → se l'utente chiude lo schema subito, il timer viene cancellato e la modifica è persa

**Auto-save debounce** (SchemaCalibrazione.tsx ~L669):
```javascript
useEffect(() => {
  if (!schemaLoaded) return
  const timer = setTimeout(() => {
    schemaCalApi.save(metodoId, workCols, ...)
  }, 500)
  return () => clearTimeout(timer)
}, [workCols, ...])
```
- Il cleanup (`clearTimeout`) si attiva ad ogni re-render, quindi navigare via prima dei 500ms perde il salvataggio.

**`handleSaveWork`** — flow non affetto: crea nuova work senza `dbId`, la aggiunge a `workCols`, auto-save la persiste correttamente. Il percorso "archivia bloccata" in `salvaWorkNelDb` è dead code (il parametro `w.dbId` non viene mai passato da `handleSaveWork`). Questo è un problema separato, fuori scope.

## Fix

File: `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

Nel callback `onSuccess` del `RicaricaDialog`, chiamare `schemaCalApi.save` con i valori aggiornati all'interno dell'updater di `setWorkCols`, in modo da avere accesso allo stato aggiornato senza attendere il debounce.

```diff
- onSuccess={newWorkId => {
-   if (ricaricaSchemaWorkId != null) {
-     setWorkCols(prev => prev.map(col =>
-       col.map(w => w.dbId === ricaricaSchemaWorkId ? { ...w, dbId: newWorkId } : w)
-     ))
-   }
-   setRicaricaSchemaWorkId(null)
- }}
+ onSuccess={newWorkId => {
+   if (ricaricaSchemaWorkId != null) {
+     setWorkCols(prev => {
+       const updated = prev.map(col =>
+         col.map(w => w.dbId === ricaricaSchemaWorkId ? { ...w, dbId: newWorkId } : w)
+       )
+       schemaCalApi.save(metodoId, updated, Array.from(removedCon), Array.from(removedMix))
+       return updated
+     })
+   }
+   setRicaricaSchemaWorkId(null)
+ }}
```

## File critici

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — unico file da modificare (~L1059)

## Verifica

1. Aprire SchemaCalibrazione per un metodo con una work avente lotti CRM aggiornabili
2. Cliccare "Ricarica lotti" su una work → compare `RicaricaDialog`
3. Confermare → `onSuccess` scatta
4. **Immediatamente** (entro 500ms) cliccare "← Chiudi schema" per navigare via
5. Riaprire lo schema
6. La work deve mostrare il nuovo `dbId` (puntare alla work nuova, non a quella archiviata)
