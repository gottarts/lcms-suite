# Piano: Semplificazione Import Work + Pulsante Archivia

## Context
Il sistema attuale distingue work "native" vs "importate" tramite un flag `isImported` in memoria, causando comportamenti complessi e bug (work inaccessibile dopo de-link). L'utente vuole due semplificazioni:

1. **Import rule**: una work è importabile se non è archiviata E condivide almeno un analita con il metodo corrente (via `metodo_analiti`). Nessun flag in memoria, nessuna distinzione native/imported.
2. **Archivio**: avviene solo tramite ricarica (già funziona) o tramite un pulsante "Archivia" esplicito nel WorkDrawer. Il pulsante ✕ nello schema rimuove solo il link (`work_metodi`) — non archivia mai.

---

## Cambiamenti richiesti

### 1. `src/main/ipc/work.ipc.ts` — Nuovo filtro `work:list-for-import`

**Riga ~542**: riscrivere la query SQL per usare un JOIN con `metodo_analiti`:

```sql
SELECT DISTINCT w.*,
  (SELECT GROUP_CONCAT(wm.metodo_id) FROM work_metodi wm WHERE wm.work_id = w.id) AS metodi_csv,
  (SELECT COUNT(*) FROM work_ingredienti WHERE work_id = w.id) AS n_ingredienti
FROM work w
JOIN work_ingredienti wi ON wi.work_id = w.id AND wi.source_type = 'crm'
JOIN composti c ON c.id = wi.source_id
JOIN metodo_analiti ma ON LOWER(ma.nome) = LOWER(c.nome) AND ma.metodo_id = ?
WHERE (w.archiviato = 0 OR w.archiviato IS NULL)
  AND w.id NOT IN (SELECT work_id FROM work_metodi WHERE metodo_id = ?)
ORDER BY w.created_at DESC
```

Il filtro client-side in `ImportaWorkDialog.tsx` (schemaDbIds) rimane per escludere work già presenti nella sessione ma non ancora salvate.

### 2. `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — Semplificare handleDeleteWork

**Righe 956-977**: rimuovere la branch `isImported`. Quando `w.dbId` esiste, chiamare sempre `removeFromMetodo()`. Non chiamare mai `archivia()` da qui.

```ts
if (w?.dbId) {
  workApi.removeFromMetodo(w.dbId, metodoId).catch(() => {})
}
```

**Rimuovere** `recentlyArchivedByCol` ref (riga 789) e il suo utilizzo in `handleSaveWork` (righe 929-935): il link `sostituito_da_id` è già gestito dal backend nella ricarica, non serve più qui.

**Rimuovere** `isImported: true` dall'oggetto work in `handleImportWork` (riga ~984).

### 3. `src/renderer/pages/metodi/SchemaCalibrazione.types.ts`

Rimuovere `isImported?: boolean` da `WorkInSchema` (riga ~40).

### 4. `src/renderer/pages/work/WorkDrawer.tsx` — Pulsante "Archivia"

**Aggiungere prop** `onArchivia?: (workId: number) => void` all'interfaccia.

**Aggiungere il pulsante** accanto a "Elimina" nella sezione azioni (riga ~356):
```tsx
{onArchivia && (
  <Button size="sm" variant="outline" className="text-amber-700" onClick={() => onArchivia(work.id)}>
    <Archive className="h-3.5 w-3.5 mr-1" /> Archivia
  </Button>
)}
```

### 5. `src/renderer/pages/work/WorkPage.tsx` — Gestire archivio

**Aggiungere stato** `archiviaId: number | null`.

**Aggiungere handler**:
```ts
const handleArchivia = async () => {
  if (archiviaId !== null) {
    await workApi.archivia(archiviaId, 'Archiviata manualmente')
    setArchiviaId(null)
    setDrawerId(null)
    load(false)
  }
}
```

**Aggiungere** `onArchivia={id => setArchiviaId(id)}` al `<WorkDrawer>`.

**Aggiungere ConfirmDialog** per archivio (separato da quello per eliminazione), mostrato solo quando `!mostraArchivio`.

---

## File critici

- [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts) — riga ~542 (handler `work:list-for-import`)
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — righe 789, 929-935, 956-977, ~984
- [src/renderer/pages/metodi/SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) — riga ~40
- [src/renderer/pages/work/WorkDrawer.tsx](src/renderer/pages/work/WorkDrawer.tsx) — sezione props + riga ~356
- [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx) — handler archivia + ConfirmDialog

## Note importanti

- **`workApi.archivia`** esiste già (usata in SchemaCalibrazione). Usarla in WorkPage non richiede nuovi IPC.
- **Import vuota**: se un metodo non ha analiti in `metodo_analiti`, il dialog import non mostrerà nessuna work — comportamento corretto.
- **`recentlyArchivedByCol`**: rimosso completamente. Il `sostituito_da_id` è già gestito lato backend nella ricarica (`work.ipc.ts` riga ~534).
- Non aggiungere `is_native` al DB — rimane minimale come richiesto.

## Verifica

1. Aprire SchemaCalibrazione di un metodo con analiti → Import Work → verificare che compaiono solo work che condividono almeno un CRM con il metodo
2. Importare una work, salvarla, uscire e riaprire → ✕ sulla work → verificare che non viene archiviata ma rimane in WorkPage
3. Aprire WorkPage → click su una card → verificare presenza pulsante "Archivia" → conferma → work sparisce dalla lista attiva e compare in Archivio
4. Dopo archiviazione manuale, aprire Import Work → work non compare più
