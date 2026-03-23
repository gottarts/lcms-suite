# Bugfix — MetodoForm: analiti manuali cancellati al salvataggio + CRM rivalidati esclusi dallo schema

---

## Problema

1. Aggiungendo un analita manualmente dalla sezione "Analiti del metodo" (MetodoForm, modalità edit) e poi cliccando "Salva", l'analita spariva. Riaprendo il metodo non era più in lista e non compariva in SchemaCalibrazione.

2. Il campo Metodo nel DB Composti non si popolava dopo aver aggiunto un analita manuale che corrispondeva a un composto esistente.

3. I CRM in stato "Rivalidato — Attivo" o "Rivalidato — In scadenza" non venivano agganciati dallo SchemaCalibrazione.

---

## Root cause

### Bug 1 — Analiti manuali cancellati al salvataggio

**File:** `src/main/ipc/metodi.ipc.ts` — handler `metodi:update`

L'handler cancellava **tutti** i `metodo_analiti` del metodo e li ricreava solo dai `composti_ids` passati dal form:

```typescript
deleteAllAnaliti.run(id)           // cancella tutto, inclusi gli analiti manuali
for (const cid of compostiIds) {
  if (c?.nome) insertAnalitaUpd.run(id, c.nome)  // ricrea solo da composti_ids
}
```

Gli analiti aggiunti manualmente (non legati a un composto in DB) venivano distrutti ad ogni salvataggio.

### Bug 2 — composti_ids non aggiornati dopo add manuale

**File:** `src/renderer/pages/metodi/MetodoForm.tsx` — `handleAddAnalita`

Dopo `metodoAnalitiApi.add()`, il form state `composti_ids` non veniva ricaricato dal backend. Al salvataggio, `metodi:update` riceveva i vecchi `composti_ids` e ricreava i link sovrascrivendo quelli appena creati dall'add. `handleRimuoviSelezionati` faceva già correttamente il refresh dei `composti_ids`, ma `handleAddAnalita` no.

### Bug 3 — CRM rivalidati esclusi

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

Il filtro escludeva i singoli scaduti basandosi solo su `scadenza_prodotto`, senza controllare `ultima_rivalidazione`:

```typescript
if (!r.mix_id && r.scadenza_prodotto && r.scadenza_prodotto < oggi) return false
```

Inoltre la query `composti:list-for-schema` usava `SELECT c.*` che non include `ultima_rivalidazione` (è una subquery calcolata, non una colonna della tabella).

---

## Fix

### Fix 1 — `metodi.ipc.ts`

Prima di `deleteAllAnaliti`, legge gli analiti esistenti e calcola quelli "manuali" (non coperti dai nuovi `composti_ids`). Dopo il reinsert da composti, li ripristina.

```typescript
// Legge analiti esistenti PRIMA di cancellare
const analitiEsistenti = db.prepare(
  'SELECT nome FROM metodo_analiti WHERE metodo_id = ?'
).all(id).map((r: any) => r.nome as string)

const nomiDaNuoviComposti = new Set<string>()
for (const cid of compostiIds) {
  const c = getNomeCompostoUpd.get(cid) as { nome: string } | undefined
  if (c?.nome) nomiDaNuoviComposti.add(c.nome)
}
const analitiManuali = analitiEsistenti.filter(n => !nomiDaNuoviComposti.has(n))

// ... deleteAllAnaliti + loop composti_ids come prima ...

// Ripristina i manuali
for (const nome of analitiManuali) {
  insertAnalitaUpd.run(id, nome)
}
```

### Fix 2 — `MetodoForm.tsx`

Aggiunto reload dei `composti_ids` in `handleAddAnalita`, speculare a quanto già fatto in `handleRimuoviSelezionati`:

```typescript
const updated = await metodiApi.get(metodo.id)
setForm(f => ({ ...f, composti_ids: updated?.composti_ids ?? [] }))
```

### Fix 3 — SchemaCalibrazione

**`composti.ipc.ts`:** aggiunta subquery `ultima_rivalidazione` nella query `list-for-schema`.

**`SchemaCalibrazione.logic.ts`:** il filtro ora permette i singoli con scadenza originale superata se hanno `ultima_rivalidazione` ancora valida:

```typescript
if (!r.mix_id && r.scadenza_prodotto && r.scadenza_prodotto < oggi) {
  if (!r.ultima_rivalidazione || r.ultima_rivalidazione < oggi) return false
}
```

**`SchemaCalibrazione.types.ts`:** aggiunto campo `ultima_rivalidazione: string | null` a `CrmItem`.

**`SchemaCalibrazione.grid.tsx`:** aggiunta riga arancione `Rivalidato · scad. est. <data>` nelle card CRM singolo e mix.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/metodi.ipc.ts` | Preserva analiti manuali nel handler `metodi:update` |
| `src/main/ipc/metodo-analiti.ipc.ts` | `metodo-analiti:add` crea anche il link in `composti_metodi` se il composto esiste |
| `src/renderer/pages/metodi/MetodoForm.tsx` | `handleAddAnalita` ricarica `composti_ids` dal backend dopo l'add |
| `src/main/ipc/composti.ipc.ts` | Aggiunta subquery `ultima_rivalidazione` in `list-for-schema` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Filtro CRM rispetta rivalidazione; mappa `ultima_rivalidazione` su `CrmItem` |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Aggiunto `ultima_rivalidazione` a `CrmItem` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Card CRM mostra badge rivalidazione con scadenza estesa |

---

## Note

- La rimozione esplicita via "Rimuovi selezionati" già aggiornava i `composti_ids` (bug 2 era asimmetrico solo per l'add).
- `metodi:merge` ha una cancellazione analoga di `metodo_analiti` ma è intenzionale (merge completo) — non modificato.
- I CRM in stato `rivalidato_scaduto` restano esclusi dallo schema (scadenza estesa anch'essa superata).
