# Piano: Rinomina UI + Bug scadenza giorno medesimo

## Context

Quattro richieste dal draft note:
1. **"Forma commerciale" → "Nome CRM"** — label UI in DB Composti (la colonna DB `forma_commerciale` resta invariata)
2. **"Forma" → "Forma neat"** — label nel dialog "Nuova preparazione stock"
3. **Bug operatore Windows** — non riproducibile ora (DB identico su Mac/Win), rimandato
4. **Bug scadenza giorno medesimo** — stock solution scadente oggi appare "Scaduta" nel dialog ma senza badge ⚠ in CompostiTable

---

## Task 1 — Rinomina label "Forma commerciale" → "Nome CRM"

Solo le etichette UI visibili all'utente, **non** i nomi di campo DB/TypeScript.

| File | Riga | Cambio |
|------|------|--------|
| `src/renderer/pages/composti/CompostoPanel.tsx` | 232 | `"Forma Commerciale"` → `"Nome CRM"` |
| `src/renderer/pages/composti/CompostiTable.tsx` | 133 | label `'Forma comm.'` → `'Nome CRM'` |
| `src/renderer/pages/composti/CompostiPage.tsx` | 60 | label `'Forma comm.'` → `'Nome CRM'` |
| `src/renderer/pages/composti/ExportDialog.tsx` | 57, 214 | `'Forma commerciale'` → `'Nome CRM'` |
| `src/renderer/pages/composti/ImportDialog.tsx` | 13 | `'Forma Commerciale'` → `'Nome CRM'` |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | 221 | `'Forma Commerciale (per riga)'` → `'Nome CRM (per riga)'` |
| `src/renderer/pages/dashboard/lib/auditReport.ts` | 287 | `'Forma commerciale'` → `'Nome CRM'` |

**Non toccare:** `forma_commerciale` in types.ts, ipc, SQL, migration — solo label UI.

---

## Task 2 — Rinomina label "Forma" → "Forma neat" nel dialog preparazione

| File | Riga | Cambio |
|------|------|--------|
| `src/renderer/pages/composti/PreparazioniTab.tsx` | 296 | `<Label className="text-xs">Forma</Label>` → `<Label className="text-xs">Forma neat</Label>` |

---

## Task 3 — Bug: scadenza giorno medesimo

**Causa radice:** Inconsistenza tra frontend JS e SQL SQLite:
- Frontend (`PreparazioniTab.tsx:56`): `new Date(p.scadenza) < new Date()` → oggi è scaduta (midnight UTC < ora attuale)
- SQL (`composti.ipc.ts:65,126`): `scadenza < date('now')` → oggi **non** è scaduta (stringa uguale)

**Soluzione:** Uniformare entrambi su "scaduto se scadenza ≤ oggi".

### Fix frontend (PreparazioniTab.tsx:56)
```ts
// Prima:
if (p.scadenza && new Date(p.scadenza) < new Date()) return 'Scaduta'
// Dopo:
if (p.scadenza && p.scadenza <= new Date().toISOString().split('T')[0]) return 'Scaduta'
```

### Fix SQL (composti.ipc.ts righe 65 e 126, work.ipc.ts riga 63)
```sql
-- Prima:
scadenza < date('now')
-- Dopo:
scadenza <= date('now')
```

Questo allinea il comportamento: una preparazione che scade oggi appare "Scaduta" nel dialog **e** genera il badge ⚠ in CompostiTable.

---

## Task 4 — Operatore Windows (rimandato)

Bug non riproducibile in piano mode. Il DB è identico su Mac/Win, quindi il problema non è il nome anagrafica. Da investigare a runtime su Windows con console DevTools aperta per vedere errori IPC.

---

## File critici modificati

- `src/renderer/pages/composti/PreparazioniTab.tsx` (Task 2 + Task 3 fix frontend)
- `src/main/ipc/composti.ipc.ts` (Task 3 fix SQL ×2)
- `src/main/ipc/work.ipc.ts` (Task 3 fix SQL ×1)
- `src/renderer/pages/composti/CompostoPanel.tsx` (Task 1)
- `src/renderer/pages/composti/CompostiTable.tsx` (Task 1)
- `src/renderer/pages/composti/CompostiPage.tsx` (Task 1)
- `src/renderer/pages/composti/ExportDialog.tsx` (Task 1)
- `src/renderer/pages/composti/ImportDialog.tsx` (Task 1)
- `src/renderer/pages/composti/MixPesticidiForm.tsx` (Task 1)
- `src/renderer/pages/dashboard/lib/auditReport.ts` (Task 1)

## Verifica

1. Aprire DB Composti → colonna "Nome CRM" visibile al posto di "Forma comm."
2. Panel laterale composto → "Nome CRM" al posto di "Forma Commerciale"
3. Export CSV → header "Nome CRM"
4. Aprire dialog "Nuova preparazione stock" → label "Forma neat"
5. Creare preparazione con scadenza = oggi → deve apparire "Scaduta" nel dialog E badge ⚠ in CompostiTable
