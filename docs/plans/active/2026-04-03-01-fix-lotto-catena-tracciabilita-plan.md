# Piano: Fix lotto mancante nella catena di tracciabilità

## Context

Il lotto non compare nella catena di tracciabilità né in SchemaCalibrazione né in WorkPage, né per mix né per CRM singoli.

## Bug certi nel codice

### Bug 1 — CRM singoli: codice mai scritto

In entrambe le ChainNode il lotto viene renderizzato **solo** quando `src.tipo === 'mix'`:

`SchemaCalibrazione.tsx:491`:
```typescript
{src.tipo === 'mix' && (() => {
  const lotto = crmItems.find(c => c.mix_id === src.id)?.lotto
  ...
```

`WorkDrawer.tsx:302`:
```typescript
{src.tipo === 'mix' && (() => {
  const lotto = crmItems.find(c => c.mix_id === src.id)?.lotto
  ...
```

Per `src.tipo === 'sng'` non esiste nessun blocco lotto — non è mai stato scritto.

### Bug 2 — WorkDrawer: `lotto_usato` ignorato

`WorkDrawer.tsx:53` in `buildCrmItems`:
```typescript
lotto: ing.source_lotto ?? null,
```

`source_lotto` viene dalla query SQL in `work.ipc.ts:124`:
```sql
WHEN wi.source_type = 'crm' THEN (SELECT lotto FROM composti WHERE id = wi.source_id)
```
Questo legge il lotto **corrente** dal composto. Se il composto è stato sostituito/ricaricato il valore può cambiare o essere null.

La colonna `lotto_usato` (snapshot al momento della creazione work) è già inclusa in `wi.*` ma viene ignorata. Usarla come fallback garantisce la tracciabilità storica.

## Soluzione

### Fix Bug 1 — aggiungere blocco lotto per `'sng'`

**`src/renderer/pages/metodi/SchemaCalibrazione.tsx`** — dopo riga 497, dentro la ChainNode:
```typescript
{src.tipo === 'sng' && (() => {
  const lotto = crmItems.find(c => String(c.id) === src.id)?.lotto
  return lotto
    ? <div style={{ fontSize:9, color:C.page.t2, fontFamily:'IBM Plex Mono, monospace' }}>{lotto}</div>
    : null
})()}
```

**`src/renderer/pages/work/WorkDrawer.tsx`** — dopo riga 308, dentro la ChainNode:
```typescript
{src.tipo === 'sng' && (() => {
  const lotto = crmItems.find(c => String(c.id) === src.id)?.lotto
  return lotto
    ? <div style={{ fontSize:9, color:C.page.t2, fontFamily:'IBM Plex Mono, monospace' }}>{lotto}</div>
    : null
})()}
```

### Fix Bug 2 — fallback su `lotto_usato`

**`src/renderer/pages/work/WorkDrawer.tsx:53`**:
```typescript
// prima:
lotto: ing.source_lotto ?? null,
// dopo:
lotto: ing.source_lotto ?? ing.lotto_usato ?? null,
```

## File da modificare

| File | Riga | Modifica |
|---|---|---|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | dopo 497 | aggiungi blocco lotto per `'sng'` |
| `src/renderer/pages/work/WorkDrawer.tsx` | 53 | fallback `lotto_usato` |
| `src/renderer/pages/work/WorkDrawer.tsx` | dopo 308 | aggiungi blocco lotto per `'sng'` |

## Verifica

1. Schema con mix → drawer → catena: lotto compare sotto il nome del mix
2. Schema con CRM singolo → drawer → catena: lotto compare
3. WorkPage → WorkDrawer con mix: lotto compare
4. WorkPage → WorkDrawer con CRM singolo: lotto compare
