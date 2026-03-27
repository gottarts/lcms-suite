# Fix: chips MIX in SchemaCalibrazione mostrano lotto invece di forma commerciale

## Context

Alcune chips MIX in SchemaCalibrazione mostrano il numero di lotto al posto del nome commerciale (es. "CRM Mix IA16"). Il DB Composti è corretto — CompostiTable mostra il campo `forma_commerciale` giusto per tutti i record. Il bug è nella mappatura in SchemaCalibrazione: il `CrmItem.mix` viene popolato dal campo `composti.mix` del DB, che per alcuni vecchi record contiene il lotto invece del nome commerciale. Il campo `forma_commerciale` è invece sempre corretto.

## Causa radice

In `SchemaCalibrazione.logic.ts:57`:
```typescript
mix: r.mix ?? null,
```
La query `composti:list-for-schema` usa `SELECT c.*` che ritorna entrambi i campi (`mix` e `forma_commerciale`). Il codice usa solo `r.mix`, che per alcuni record storici è stato compilato con il lotto.

I due punti di display che dipendono da `CrmItem.mix`:
- `SchemaCalibrazione.grid.tsx:430` → `{info?.mix ?? info?.mix_id ?? a.mixId}` (header della card MIX)
- `SchemaCalibrazione.tsx:739` → `nome: crm?.mix ?? mixId` (tracciabilità sorgenti)

## Fix applicato

**File 1:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` riga 57
```typescript
mix: r.forma_commerciale ?? r.mix ?? null,
```

**File 2:** `src/main/ipc/work.ipc.ts` riga 101 (source_mix_nome per WorkDrawer)
```sql
(SELECT COALESCE(forma_commerciale, mix) FROM composti WHERE id = wi.source_id)
```

## Verifica

1. Aprire uno schema di calibrazione con MIX affette dal bug
2. Verificare che le chips MIX mostrino il nome commerciale invece del lotto
3. Verificare che il lotto continui ad apparire nella riga separata sotto il nome
4. Verificare nel WorkDrawer (WorkPage) che il nome MIX sia corretto
