# Bugfix — Work non appare in WorkPage + operatore mancante nelle preparazioni

---

## Problema

1. Le Work create dallo Schema Calibrazione non comparivano in WorkPage.
2. Il campo operatore non era presente nella registrazione delle preparazioni in laboratorio (WorkDrawer).

---

## Root cause

### Bug 1 — Work non salvata nel DB

`salvaWorkNelDb` in `SchemaCalibrazione.logic.ts` veniva chiamata **sempre**, ma mancava il guard che impedisce il salvataggio per le work "al momento" (senza `validitaMesi`). Il commento nel codice recitava "solo se ha validitaMesi" ma la condizione non era implementata. Di conseguenza le work senza validità venivano create nel DB (dove non devono stare) e probabilmente causavano un crash silenzioso che impediva anche la visualizzazione delle work tracciate.

```ts
// prima — nessun guard
export async function salvaWorkNelDb(w, metodoId) {
  const payload = { ... }
  ...
}

// dopo
export async function salvaWorkNelDb(w, metodoId) {
  if (!w.validitaMesi) return null   // "al momento" → non salvare nel DB
  const payload = { ... }
  ...
}
```

### Bug 2 — Operatore mancante nelle preparazioni

La tabella `work_preparazioni` non aveva la colonna `operatore`. Il backend `work:prepara` non accettava né salvava l'operatore. Il frontend `WorkDrawer` non aveva il campo nel form di preparazione. Il tipo condiviso `WorkPreparazione` non includeva il campo.

---

## Fix

### Bug 1

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

Aggiunto guard all'inizio di `salvaWorkNelDb`:
```ts
if (!w.validitaMesi) return null
```

### Bug 2

**File:** `src/main/migrations/015-prep-operatore.sql` *(nuovo)*
```sql
ALTER TABLE work_preparazioni ADD COLUMN operatore TEXT;
```

**File:** `src/shared/types.ts`
```ts
// aggiunto campo al tipo WorkPreparazione
operatore: string | null
```

**File:** `src/main/ipc/work.ipc.ts`
- `work:prepara` accetta `operatore` e lo inserisce in DB
- `work:list` include `_up_operatore` nella subquery dell'ultima preparazione e lo mappa nell'oggetto `ultimaPrep`

**File:** `src/renderer/lib/api.ts`
- Tipo di `prepara` aggiornato con `operatore?: string | null`

**File:** `src/renderer/pages/work/WorkDrawer.tsx`
- Aggiunto stato `prepOp` + campo input "Operatore *" nel form di preparazione (obbligatorio)
- Operatore mostrato nell'ultima preparazione e nello storico

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Guard `if (!w.validitaMesi) return null` in `salvaWorkNelDb` |
| `src/main/migrations/015-prep-operatore.sql` | Nuova migration: `ALTER TABLE work_preparazioni ADD COLUMN operatore TEXT` |
| `src/shared/types.ts` | Aggiunto `operatore: string | null` a `WorkPreparazione` |
| `src/main/ipc/work.ipc.ts` | `work:prepara` salva operatore; `work:list` include operatore dell'ultima prep |
| `src/renderer/lib/api.ts` | Tipo `prepara` aggiornato |
| `src/renderer/pages/work/WorkDrawer.tsx` | Campo operatore nel form prepara + visualizzazione storico |

---

## Note

- L'operatore va nella **preparazione** (`work_preparazioni`), NON nella creazione della work (SchemaCalibrazione). La preparazione è l'atto fisico in lab; la work è la ricetta.
- Il campo operatore è obbligatorio nel form di preparazione (pulsante Registra disabilitato se vuoto).
