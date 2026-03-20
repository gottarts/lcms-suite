# Bugfix — SchemaCalibrazione: work con sorgente Mix non salvata nel DB

---

## Problema

Le Work create dallo Schema Calibrazione con almeno una sorgente di tipo **Mix CRM** non venivano mai salvate nel DB e quindi non comparivano in WorkPage. L'errore era silenzioso (catturato dal try/catch) e la work appariva comunque nello schema locale, mascherando il problema.

---

## Root cause

In `salvaWorkNelDb` (`SchemaCalibrazione.logic.ts`), gli ingredienti venivano costruiti così:

```ts
ingredienti: w.vols.map((ing, i) => ({
  source_type: w.srcs[i]?.tipo === 'work' ? 'work' : 'crm',
  source_id:   w.srcs[i]?.tipo === 'work'
                 ? ((w.srcs[i] as any).dbId ?? 0)
                 : parseInt(w.srcs[i]?.id ?? '0'),   // ← BUG
  ...
}))
```

Per le sorgenti di tipo `'mix'`, `src.id` è il `mix_id` (es. `"mix-uuid-abc"`), non un intero. `parseInt("mix-uuid-abc")` restituisce `NaN`. La tabella `work_ingredienti` ha `source_id INTEGER NOT NULL` — SQLite rifiutava l'insert → la transazione falliva → il try/catch in `handleSaveWork` la catturava silenziosamente → `dbId` rimaneva `undefined` → la work non veniva mai persistita nel DB.

---

## Fix

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

La firma di `salvaWorkNelDb` ora accetta `crmItems` come terzo parametro. La costruzione degli ingredienti usa `flatMap` con gestione per tipo:

- **`'work'`**: usa `dbId` come prima
- **`'mix'`**: espande il mix nei suoi composti (`crmItems.filter(c => c.mix_id === src.id)`), inserisce un ingrediente per ciascun composto con `source_id = c.id` (INTEGER valido)
- **`'sng'`**: come prima ma con guard su `parseInt` (skip se NaN)

```ts
// prima
ingredienti: w.vols.map((ing, i) => ({
  source_type: w.srcs[i]?.tipo === 'work' ? 'work' : 'crm',
  source_id:   w.srcs[i]?.tipo === 'work'
                 ? ((w.srcs[i] as any).dbId ?? 0)
                 : parseInt(w.srcs[i]?.id ?? '0'),  // NaN per i mix!
  ...
}))

// dopo
const ingredienti = w.vols.flatMap((ing, i) => {
  const src = w.srcs[i]
  if (!src) return []
  if (src.tipo === 'work') { ... }
  if (src.tipo === 'mix') {
    const comps = crmItems.filter(c => c.mix_id === src.id)
    return comps.map(c => ({ source_type: 'crm', source_id: c.id, ... }))
  }
  // sng
  const srcId = parseInt(src.id ?? '0')
  if (!srcId) return []
  return [{ source_type: 'crm', source_id: srcId, ... }]
})
```

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

Aggiornata la chiamata a `salvaWorkNelDb` per passare `crmItems`:

```ts
// prima
const result = await salvaWorkNelDb(work, metodoId)

// dopo
const result = await salvaWorkNelDb(work, metodoId, crmItems)
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `salvaWorkNelDb` accetta `crmItems`; ingredienti costruiti con `flatMap` con gestione corretta per `mix`/`sng`/`work` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Chiamata a `salvaWorkNelDb` aggiornata con terzo argomento `crmItems` |

---

## Note

- Il bug era presente dall'introduzione dello Schema Calibrazione ma emergeva solo usando sorgenti Mix (non singoli o work intermedie).
- Un mix con sorgente Mix senza validità (`validitaMesi = null`) non arriva mai a `salvaWorkNelDb` (guard `if (!w.validitaMesi) return null`), quindi il bug si manifestava solo per work tracciate con validità.
- La scelta di espandere il mix nei suoi composti singoli è coerente con la schema del DB (`work_ingredienti.source_type IN ('crm', 'work')` — non esiste un tipo `'mix'`).
