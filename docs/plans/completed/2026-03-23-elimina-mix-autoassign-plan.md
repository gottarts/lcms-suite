# Piano: Elimina singolo/mix + auto-assign mix_id per lotto

## Contesto

Due feature richieste per il DB Composti:

1. **Elimina da drawer**: quando si elimina un composto che fa parte di una mix, il dialog deve chiedere se eliminare solo quel composto o l'intera mix (come fa già la cancellazione bulk con MixScopeDialog).
2. **Auto-assign mix_id**: aggiungendo nuovi composti con forma=Mix e lotto di una mix già esistente, il sistema deve assegnare automaticamente il `mix_id` esistente, collegandoli a quella mix.

---

## Feature 1: Elimina singolo — "Solo questo" vs "Tutto il mix"

### Stato attuale
- `handleRequestDelete` (CompostiPage:826) chiama `composti:count-by-lotto` → `{ count, lotto }`
- Se `count > 1`, ConfirmDialog avvisa che verranno eliminati tutti, **senza scelta**
- `handleDelete` (CompostiPage:653) usa `delete-by-lotto` → cancella tutto il lotto

### Modifiche

**1. Backend — `composti.ipc.ts` ~linea 429**
Aggiungere `mix_id` al return di `composti:count-by-lotto`:
```ts
return { count: result.count, lotto: row.lotto, mix_id: row.mix_id }
```
(Il handler già legge `mix_id` dalla query a linea 424, basta aggiungerlo al return)

**2. Frontend — `CompostiPage.tsx` linea 437**
Estendere il tipo dello state `deleteMixInfo`:
```ts
useState<{ count: number; lotto: string | null; mix_id: string | null } | null>(null)
```

**3. Frontend — `CompostiPage.tsx` dopo linea 663**
Nuovo callback `handleDeleteSingle`:
```ts
const handleDeleteSingle = useCallback(async () => {
  if (deleteId !== null) {
    await compostiApi.delete(deleteId)
    setDeleteId(null); setDeleteMixInfo(null); setPanelId(null); load()
  }
}, [deleteId, load])
```

**4. Frontend — `CompostiPage.tsx` linea 656-657**
`handleDelete` usa `delete-by-mix-id` invece di `delete-by-lotto` (più preciso, coerente con bulk delete):
```ts
if (deleteMixInfo && deleteMixInfo.mix_id && deleteMixInfo.count > 1) {
  await window.electronAPI.invoke('composti:delete-by-mix-id', deleteMixInfo.mix_id)
}
```

**5. Frontend — `CompostiPage.tsx` linee 1125-1135**
ConfirmDialog con `secondaryAction` per mix:
- Messaggio: "Vuoi eliminare solo questo composto o tutto il mix ({count} composti)?"
- `secondaryAction`: "Solo questo composto" → `handleDeleteSingle`
- `confirmLabel`: "Tutto il mix ({count})" → `handleDelete`
- Per non-mix: comportamento invariato (conferma semplice)

Nota: `ConfirmDialog` già supporta `secondaryAction` — nessuna modifica a quel componente.

---

## Feature 2: Auto-assign mix_id per lotto esistente

### Stato attuale
- CSV Import genera mix_id nuovi per gruppi intra-batch con stesso lotto (ImportDialog:85-120)
- `composti:create` (ipc:177) inserisce con qualsiasi mix_id passato (o null)
- `composti:create-mix` (ipc:449) genera sempre un mix_id nuovo
- **Nessun check** contro mix esistenti nel DB

### Modifiche

**1. Backend — `composti.ipc.ts` dopo ~linea 447**
Nuovo handler:
```ts
ipcMain.handle('composti:find-mix-id-by-lotto', (_, lotto: string) => {
  const row = getDb().prepare(
    'SELECT mix_id FROM composti WHERE lotto = ? AND mix_id IS NOT NULL LIMIT 1'
  ).get(lotto) as { mix_id: string } | undefined
  return row?.mix_id ?? null
})
```

**2. Backend — `composti:create` (ipc:177-251) ~dopo linea 211**
Auto-assign quando forma=Mix, lotto presente, mix_id assente:
```ts
if (row.forma?.toLowerCase() === 'mix' && row.lotto && !row.mix_id) {
  const existing = db.prepare(
    'SELECT mix_id FROM composti WHERE lotto = ? AND mix_id IS NOT NULL LIMIT 1'
  ).get(row.lotto) as { mix_id: string } | undefined
  if (existing) {
    row.mix_id = existing.mix_id
    row.mix = row.mix || row.lotto
  }
}
```

**3. Backend — `composti:create-mix` (ipc:478-479)**
Riusa mix_id esistente se lotto corrisponde:
```ts
let mix_id: string
if (data.lotto) {
  const existing = db.prepare(
    'SELECT mix_id FROM composti WHERE lotto = ? AND mix_id IS NOT NULL LIMIT 1'
  ).get(data.lotto) as { mix_id: string } | undefined
  mix_id = existing?.mix_id ?? ('mix_' + Date.now().toString(36))
} else {
  mix_id = 'mix_' + Date.now().toString(36)
}
```

**4. Frontend — `ImportDialog.tsx` dopo linea 354**
Sostituire mix_id generati con quelli esistenti dal DB:
```ts
for (const [lotto, generatedMixId] of mixIdMap.entries()) {
  const existingMixId = await window.electronAPI.invoke('composti:find-mix-id-by-lotto', lotto)
  if (existingMixId) {
    mixIdMap.set(lotto, existingMixId)
  }
}
```
Questo copre il caso: import batch con N righe stesso lotto → mix_id viene dal DB se esiste.

---

## File da modificare

| File | Modifica |
|------|----------|
| `src/main/ipc/composti.ipc.ts` | (1) mix_id nel return di count-by-lotto, (2) nuovo handler find-mix-id-by-lotto, (3) auto-assign in create, (4) riuso in create-mix |
| `src/renderer/pages/composti/CompostiPage.tsx` | (1) tipo state deleteMixInfo, (2) handleDeleteSingle, (3) handleDelete usa mix_id, (4) ConfirmDialog secondaryAction |
| `src/renderer/pages/composti/ImportDialog.tsx` | (1) check DB per mix_id esistenti nel post-processing |

---

## Ordine di implementazione

1. Backend: tutte le modifiche a `composti.ipc.ts`
2. Frontend Feature 1: `CompostiPage.tsx`
3. Frontend Feature 2: `ImportDialog.tsx`

## Verifica

1. **Feature 1**: Aprire un composto che fa parte di una mix → Elimina → verificare che il dialog mostri 3 opzioni (Annulla / Solo questo / Tutto il mix). Testare entrambi i percorsi.
2. **Feature 2**: Creare una mix con lotto "TEST1". Poi importare un CSV con un composto forma=Mix lotto="TEST1" → verificare che il composto importato abbia lo stesso mix_id della mix esistente. Testare anche con MixPesticidiForm.
