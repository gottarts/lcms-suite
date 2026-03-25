# Bugfix — WorkPage: impossibile eliminare la prima work (FK constraint)

---

## Problema

Cliccando "Elimina" nel WorkDrawer e confermando il dialog, la cancellazione non avveniva silenziosamente. L'errore in console era:

```
Uncaught (in promise) Error: Error invoking remote method 'work:delete': SqliteError: FOREIGN KEY constraint failed
```

Il problema si manifestava solo sulla prima work creata (la più vecchia), che era quella usata come sorgente per una "Ricarica lotti".

---

## Root cause

La colonna `sostituito_da_id` nella tabella `work` (aggiunta in migrazione `017-work-lot-snapshot.sql`) è una FK su `work(id)` **senza** `ON DELETE CASCADE` o `ON DELETE SET NULL`:

```sql
ALTER TABLE work ADD COLUMN sostituito_da_id INTEGER REFERENCES work(id);
```

Quando si fa "Ricarica lotti", viene creata una nuova work con `sostituito_da_id` che punta alla work originale. Tentare di cancellare la work originale fallisce perché la FK è violata.

---

## Fix

**File:** `src/main/ipc/work.ipc.ts`

Prima di eseguire la `DELETE`, si azzera `sostituito_da_id` in tutte le work che puntano alla work da eliminare:

```ts
// Prima
ipcMain.handle('work:delete', (_, id: number) => {
  getDb().prepare('DELETE FROM work WHERE id = ?').run(id)
  return { ok: true }
})

// Dopo
ipcMain.handle('work:delete', (_, id: number) => {
  const db = getDb()
  db.prepare('UPDATE work SET sostituito_da_id = NULL WHERE sostituito_da_id = ?').run(id)
  db.prepare('DELETE FROM work WHERE id = ?').run(id)
  return { ok: true }
})
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Aggiunto `UPDATE ... SET sostituito_da_id = NULL` prima della DELETE |

---

## Note

- Le altre FK di `work_ingredienti`, `work_metodi`, `work_preparazioni` hanno già `ON DELETE CASCADE` e non erano il problema.
- La work "originale" (la prima della lista, la più vecchia) è sempre quella che funge da sorgente per le work ricaricate, per questo il bug si manifestava solo su di essa.
