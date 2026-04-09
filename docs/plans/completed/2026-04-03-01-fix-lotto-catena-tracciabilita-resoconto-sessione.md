# Resoconto sessione — Fix lotto mancante nella catena di tracciabilità

**Data:** 2026-04-03
**Oggetto:** Lotto non visibile nella catena di tracciabilità (mix e CRM singoli) in SchemaCalibrazione e WorkPage

---

## Cosa è stato fatto

Diagnosticato e risolto il problema per cui il lotto non compariva mai nella sezione "Catena di tracciabilità" del drawer work, né in SchemaCalibrazione né in WorkPage, né per mix né per CRM singoli.

---

## Bug risolti

### Bug 1 — CRM singoli: codice mai scritto

**Root cause:** In entrambe le `ChainNode` (`SchemaCalibrazione.tsx` e `WorkDrawer.tsx`) il blocco di rendering del lotto era condizionato solo a `src.tipo === 'mix'`. Per `src.tipo === 'sng'` non esisteva nessun blocco — non era mai stato scritto quando il lotto per i mix era stato aggiunto con il commit `e91f90b`.

**Fix:** Aggiunto il blocco identico per `'sng'` dopo quello per `'mix'` in entrambe le ChainNode:
```typescript
{src.tipo === 'sng' && (() => {
  const lotto = crmItems.find(c => String(c.id) === src.id)?.lotto
  return lotto
    ? <div style={{ fontSize:9, color:C.page.t2, fontFamily:'IBM Plex Mono, monospace' }}>{lotto}</div>
    : null
})()}
```

### Bug 2 — WorkDrawer: `lotto_usato` ignorato

**Root cause:** In `buildCrmItems` (`WorkDrawer.tsx:53`) il lotto veniva letto solo da `ing.source_lotto`, che nella query SQL corrisponde a `(SELECT lotto FROM composti WHERE id = wi.source_id)` — cioè il lotto **corrente** del composto nel DB. La colonna `lotto_usato` (snapshot del lotto al momento della creazione della work, già inclusa in `wi.*`) veniva ignorata.

**Fix:**
```typescript
// prima:
lotto: ing.source_lotto ?? null,
// dopo:
lotto: ing.source_lotto ?? ing.lotto_usato ?? null,
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto blocco lotto per `src.tipo === 'sng'` nella ChainNode di DrawerDettaglioWork |
| `src/renderer/pages/work/WorkDrawer.tsx` | Fallback su `lotto_usato` in `buildCrmItems` + blocco lotto per `'sng'` nella ChainNode |

---

## Note per sessioni future

- Il lotto per i **mix** era già implementato (commit `e91f90b`), ma dipende da `composti.lotto` nel DB — se il campo è null, non compare nulla. Questo è corretto.
- La ricerca del lotto per `'sng'` usa `crmItems.find(c => String(c.id) === src.id)` — `src.id` per un singolo è `String(crm.id)` (vedi `ricostruisciWorkInSchema` riga 461).
- Il piano di questa sessione è in `docs/plans/active/2026-04-03-01-fix-lotto-catena-tracciabilita-plan.md`.
