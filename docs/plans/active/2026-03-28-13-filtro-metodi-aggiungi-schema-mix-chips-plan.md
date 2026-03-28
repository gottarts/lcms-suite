# Piano — Due fix su AggiungiASchemaDialog + Chips mix extraSrcs

**Data:** 2026-03-28
**Issue:** Filtro metodi in AggiungiASchemaDialog + raggruppamento mix nelle chips extra

---

## Context

Due miglioramenti alla feature "Aggiungi a Schema" (commit `43d4b9c`):

1. **Filtro metodi**: il dialog mostra TUTTI i metodi — dovrebbe mostrare solo quelli con analiti condivisi con la work orfana (stesso comportamento di `ImportaWorkDialog` ma invertito: dato una work, quali metodi la accettano).

2. **Chips mix**: nella visualizzazione chips di `SchemaCalibrazione`, le work che usano una mix mostrano i singoli composti come extra (⚠ Atrazina, ⚠ Simazina) anziché il nome commerciale della mix (⚠ MIX-ARPA). Stesso problema nel messaggio "CRM non in schema" in `AggiungiASchemaDialog`.

---

## Modifica 1 — Filtro metodi: solo quelli con analiti condivisi

### File: `src/main/ipc/metodi.ipc.ts`

Aggiungere handler `metodi:list-for-work`:

```typescript
ipcMain.handle('metodi:list-for-work', (_, workId: number) => {
  return getDb().prepare(`
    SELECT DISTINCT m.*, s.codice AS strumento_codice
    FROM metodi m
    LEFT JOIN strumenti s ON s.id = m.strumento_id
    JOIN metodo_analiti ma ON ma.metodo_id = m.id
    JOIN work_ingredienti wi
      ON wi.work_id = ?
      AND wi.source_type = 'crm'
      AND LOWER((SELECT nome FROM composti WHERE id = wi.source_id)) = LOWER(ma.nome)
    ORDER BY m.nome
  `).all(workId)
})
```

**Nota critica**: `source_nome` NON è una colonna fisica di `work_ingredienti`. Bisogna usare la subquery `(SELECT nome FROM composti WHERE id = wi.source_id)`.

### File: `src/renderer/lib/api.ts`

```typescript
listForWork: (workId: number) => api.invoke('metodi:list-for-work', workId) as Promise<any[]>,
```

### File: `src/renderer/pages/work/AggiungiASchemaDialog.tsx`

```typescript
useEffect(() => {
  if (!open || !workId) return
  setSelectedMetodoId('')
  setSchemaState(null)
  setError(null)
  metodiApi.listForWork(workId).then(setMetodi).catch(() => setMetodi([]))
}, [open, workId])
```

---

## Modifica 2 — Chips mix: mostrare forma_commerciale invece dei singoli composti

### File: `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

**In `ricostruisciWorkInSchema`** — aggiunto ramo per `source_mix_nome` senza `source_mix_id`:

```typescript
if (ing.source_mix_id) {
  if (!seenExtraMix.has(ing.source_mix_id)) {
    seenExtraMix.add(ing.source_mix_id)
    extraSrcs.push({ id: ing.source_mix_id, nome: ing.source_mix_nome ?? ing.source_nome ?? '', tipo: 'mix' })
  }
} else if (ing.source_mix_nome) {
  const key = `fc:${ing.source_mix_nome}`
  if (!seenExtraMix.has(key)) {
    seenExtraMix.add(key)
    extraSrcs.push({ id: key, nome: ing.source_mix_nome, tipo: 'mix' })
  }
} else {
  extraSrcs.push({ id: String(ing.source_id), nome: ing.source_nome ?? `ID ${ing.source_id}`, tipo: 'sng' })
}
```

**In `verificaCompatibilitaCrm`**:

```typescript
const label = ing.source_mix_nome ?? ing.source_nome ?? `ID ${ing.source_id}`
if (!mancanti.includes(label))
  mancanti.push(label)
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/metodi.ipc.ts` | Nuovo handler `metodi:list-for-work` |
| `src/renderer/lib/api.ts` | `metodiApi.listForWork()` |
| `src/renderer/pages/work/AggiungiASchemaDialog.tsx` | Usa `listForWork` anziché `list` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Fix `ricostruisciWorkInSchema` + `verificaCompatibilitaCrm` |
