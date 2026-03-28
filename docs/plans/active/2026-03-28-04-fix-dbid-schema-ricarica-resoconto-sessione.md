# Resoconto sessione — Fix dbId schema dopo RicaricaDialog

**Data:** 2026-03-28
**Oggetto:** Fix race condition: dbId non persistito nello schema dopo sostituzione work con RicaricaDialog

---

## Cosa è stato fatto

Sessione di indagine e fix del rischio segnalato nel resoconto di sessione precedente (flusso operatore blocco preparazione). Il problema: dopo che `RicaricaDialog` completa la sostituzione di una work (crea nuova, archivia vecchia), il `dbId` aggiornato in `workCols` veniva persistito a DB solo tramite il debounce auto-save (500ms). Se l'utente navigava via dallo schema in quella finestra, il timer veniva cancellato e lo schema rimaneva con il vecchio `dbId` puntante a una work archiviata.

Fix chirurgico: in `RicaricaDialog.onSuccess`, la chiamata a `schemaCalApi.save` ora avviene **immediatamente**, dentro l'updater di `setWorkCols`, dove è disponibile lo stato aggiornato.

---

## Bug risolti

### dbId non persistito dopo RicaricaDialog (race condition 500ms)

**Root cause:** `RicaricaDialog.onSuccess` aggiornava `workCols` via `setWorkCols`, lasciando al debounce auto-save (500ms) il compito di persistere. Il cleanup `clearTimeout` nel `useEffect` auto-save si attiva ad ogni re-render — navigando via prima di 500ms, il timer veniva cancellato e la modifica non raggiungeva il DB.

**Fix:** Dentro l'updater di `setWorkCols`, si calcola `updated` e si chiama direttamente `schemaCalApi.save(metodoId, updated, ...)`. Il salvataggio esplicito precede il return dello stato aggiornato e non dipende dal debounce.

```diff
- setWorkCols(prev => prev.map(col =>
-   col.map(w => w.dbId === ricaricaSchemaWorkId ? { ...w, dbId: newWorkId } : w)
- ))
+ setWorkCols(prev => {
+   const updated = prev.map(col =>
+     col.map(w => w.dbId === ricaricaSchemaWorkId ? { ...w, dbId: newWorkId } : w)
+   )
+   schemaCalApi.save(metodoId, updated, Array.from(removedCon), Array.from(removedMix))
+   return updated
+ })
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `RicaricaDialog.onSuccess`: aggiunto save esplicito dello schema dopo aggiornamento dbId |

---

## Analisi: archiving path in salvaWorkNelDb — dead code

Investigazione collaterale: il path di archiviazione in `salvaWorkNelDb` (controlla `w.dbId`, se bloccata archivia) è **dead code** nel flusso corrente. `handleSaveWork` crea sempre una work con `Omit<WorkInSchema, 'id' | 'dbId'>` — quindi `w.dbId` è sempre undefined e il blocco non si attiva mai. Il fix dell'archiviazione automatica quindi avviene solo via `RicaricaDialog` (che usa `work:ricarica`), non via `salvaWorkNelDb`.

Questo è fuori scope per questa sessione ma va tenuto presente: se in futuro si vuole che `handleSaveWork` archivi automaticamente la work bloccata, bisogna passare il `dbId` della work da sostituire.

---

## Note per sessioni future

- **Chiuso**: il rischio segnalato al punto 3 del resoconto flusso operatore (dbId non aggiornato dopo archiviazione) è risolto per il flusso `RicaricaDialog`.
- **Ancora aperto**: il path di archiviazione in `salvaWorkNelDb` (linee 263–269 di `SchemaCalibrazione.logic.ts`) è dead code — `handleSaveWork` non passa mai `w.dbId`.
- **Ancora aperto**: `salvaWorkNelDb` crea sempre una nuova work anche se la work non è bloccata (duplicati invece di update in-place).
- **Riferimento piano**: `docs/plans/active/2026-03-28-fix-dbid-schema-ricarica-plan.md`
