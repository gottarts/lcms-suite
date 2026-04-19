# Piano: Work con problemi — badge con link, lotto in audit, progressivo ricetta in PDF

## Context

Tre miglioramenti alla dashboard di tracciabilità e al modulo audit CRM:

1. **"Work con problemi"** nella `TracciabilitaCard` mostra i badge come testo statico — il click naviga a `/work` genericamente senza filtrare per quella work specifica.
2. **Audit dashboard** (`AuditCrmSection`) mostra i dettagli della work ma non mostra il **lotto** associato alla work stessa nell'header (già visibile nei badge CRM degli analiti, ma non nell'intestazione della riga work).
3. **Audit PDF** (`auditReport.ts`) — nell'intestazione della scheda work, non viene mostrato il **progressivo ricetta** (cioè il `codice` della work, campo `WS-YYYYMMDD-XXX` introdotto nella migration 028).

---

## Task 1 — Badge "Work con problemi" con link diretto alla work

**File:** [src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx](src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx)

**Situazione attuale (riga 235):**
```tsx
onClick={() => nav('/work')}
```
Il click apre la pagina work senza filtro.

**Modifica:** Cambiare il `onClick` del badge per navigare con `state: { openWorkId: w.id, searchWork: w.nome }`, identico al pattern già usato in `AuditCrmSection.tsx:100`:
```tsx
onClick={() => nav('/work', { state: { openWorkId: w.id, archiviata: false, searchWork: w.nome } })}
```

Verificare che `WorkPage` supporti già `openWorkId` nello state (lo fa, lo si vede in AuditCrmSection riga 100).

---

## Task 2 — Lotto work nell'header della riga work in Audit

**File:** [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx)

**Situazione attuale:** `AuditWorkRow` non ha un campo `work_lotto`. Il lotto è già presente nei `CrmUsato` degli analiti, ma non nell'header della riga.

**Approccio:** Il "lotto" di una work non è un campo diretto della `work` ma è il `codice` (WS-YYYYMMDD-XXX). Verificare cosa intende l'utente — potrebbe essere il `codice` della work. Aggiungere `work_codice: string | null` a `AuditWorkRow` in auditModel.ts e popolarlo dalla raw data, poi mostrarlo nell'header della riga work in `WorkRowBlock`.

**Passi:**
1. In `auditModel.ts`: aggiungere `work_codice: string | null` ad `AuditWorkRow` (riga ~48-61)
2. In `auditModel.ts` nella funzione `buildAuditModel`: estrarre `work_codice` dai `works_registrati` grezzi (campo `codice`)
3. In `AuditCrmSection.tsx` in `WorkRowBlock`: mostrare il codice/lotto dopo il nome work nell'header (piccolo, muted)

---

## Task 3 — Progressivo ricetta work nel PDF Audit

**File:** [src/renderer/pages/dashboard/lib/auditReport.ts](src/renderer/pages/dashboard/lib/auditReport.ts)

**Situazione attuale (riga ~442):**
```ts
`Scadenza work: ${w.work_scadenza ?? '—'}   |   Analiti coperti: ${w.analiti_coperti.length}`
```
Non è incluso il codice/progressivo della work.

**Modifica:** Dopo aver aggiunto `work_codice` ad `AuditWorkRow` (Task 2), includere il codice nell'header della scheda PDF:
```ts
`${w.work_codice ? `Codice: ${w.work_codice}   |   ` : ''}Scadenza work: ${w.work_scadenza ?? '—'}   |   Analiti coperti: ${w.analiti_coperti.length}`
```

---

## Confermato

**"Lotto del work"** = campo `codice` della work (WS-YYYYMMDD-XXX, migration 028). Usare `work_codice` come nome nel modello TypeScript.

---

## File critici da modificare

| File | Modifica |
|------|----------|
| [src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx](src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx) | onClick badge con openWorkId |
| [src/renderer/pages/dashboard/lib/auditModel.ts](src/renderer/pages/dashboard/lib/auditModel.ts) | Aggiungere `work_codice` ad AuditWorkRow |
| [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx) | Mostrare codice work nell'header |
| [src/renderer/pages/dashboard/lib/auditReport.ts](src/renderer/pages/dashboard/lib/auditReport.ts) | Codice work nel PDF header scheda |

---

## Verifica

1. Dashboard → "Work con problemi" → cliccare un badge → si apre WorkPage con la work già selezionata/filtrata
2. Audit CRM → eseguire audit → header riga work mostra il codice `WS-...`
3. Audit CRM → Esporta PDF → scheda work mostra il codice in alto a destra
