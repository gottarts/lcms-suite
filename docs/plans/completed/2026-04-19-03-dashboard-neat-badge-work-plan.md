# Piano: Dashboard Neat + Badge Work su CompostiTable

## Context

Due feature richieste dall'utente (riferimento: `docs/plans/active/new draft.md` righe 31-32):

1. **Dashboard**: rendere visibili in testata le preparazioni Neat scadute/in scadenza (oggi sono nascoste dentro l'accordion "Preparati" di ScadenzeTimeline, che è collassato di default). Riorganizzare la testata per mostrare contemporaneamente KPI e timeline 60gg.

2. **DB Composti**: indicatore dei Work in cui una CRM è coinvolta (sia come ingrediente diretto, sia via una sua preparazione). La cella "Nome" è già molto affollata (checkbox, MIX, RIVAL., prep N, ⚠ prep scadute, ⚠ campi mancanti, fiale) → scelta utente: **nuova colonna dedicata "Work"** (solo lettura), più ordinata e scopribile.

Obiettivo: aumentare la visibilità delle scadenze Neat (oggi troppo nascoste) e dare immediata consapevolezza di quali CRM sono "vive" nei work correnti.

---

## Feature 1 — Dashboard: testata a 2 colonne + KPI Prep Neat

### Design (scelto dall'utente)
- Layout a **2 colonne** nella testata:
  - **Sinistra**: `KpiCards` attuali (CRM attivi / in scadenza / scaduti / da aprire / dismessi) + nuova card **"Prep Neat ⚠"** (conteggio scadute + urgenti ≤7gg).
  - **Destra**: `ScadenzeTimeline` (con sezione "Preparati" rinominata **"Preparati Neat"**).
- `TracciabilitaCard` e `AuditCrmSection` restano sotto, full-width.

### Modifiche file

**`src/main/ipc/dashboard.ipc.ts`** — SELECT preparazioni (riga 42-53): aggiungere `c.forma AS composto_forma` al result (JOIN `composti` già presente). Nessun filtro SQL — il filtro `forma='Neat'` è applicato lato renderer (difensivo).

**`src/renderer/pages/dashboard/lib/scadenzeModel.ts`**:
- Estendere il tipo `preparazione` con `forma: string | null`.
- Propagare `p.composto_forma` in `buildScadenzeItems` (riga 148-158).

**`src/renderer/pages/dashboard/sections/KpiCards.tsx`** (da leggere prima): aggiungere una card "Prep Neat ⚠" calcolata da `summary.preparazioni` filtrando `composto_forma === 'Neat'` e `giorni ≤ 7` (usa helper `giorniTra` / `bucketOf` già in `scadenzeModel.ts`). Riusare lo stile delle card esistenti.

**`src/renderer/pages/dashboard/DashboardPage.tsx`**: sostituire la sequenza verticale con un grid a 2 colonne in testata:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <KpiCards />
  <ScadenzeTimeline />
</div>
<TracciabilitaCard />
<AuditCrmSection />
```
Se le `KpiCards` non sono impilabili verticalmente in una singola colonna, valutare adattamento minimale (grid interno a 1 colonna su `lg:` e 2-3 sotto).

**`src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx`**: rinominare titolo sezione "Preparati" → "Preparati Neat" (riga 295). Nessun'altra modifica — la sezione già mostra di fatto solo prep Neat (verificato: in tutto il codice le preparazioni si generano solo da CRM con `forma === 'Neat'`, vedi `CompostiTable.tsx:96`, `CompostoPanel.tsx:223,277`).

### File critici
- [src/main/ipc/dashboard.ipc.ts](src/main/ipc/dashboard.ipc.ts)
- [src/renderer/pages/dashboard/lib/scadenzeModel.ts](src/renderer/pages/dashboard/lib/scadenzeModel.ts)
- [src/renderer/pages/dashboard/DashboardPage.tsx](src/renderer/pages/dashboard/DashboardPage.tsx)
- [src/renderer/pages/dashboard/sections/KpiCards.tsx](src/renderer/pages/dashboard/sections/KpiCards.tsx)
- [src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx](src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx)

### Verifica end-to-end
1. Avvio app → Dashboard. Testata mostra KpiCards a sinistra e ScadenzeTimeline a destra affiancati (su schermi `lg:`).
2. Card "Prep Neat ⚠" mostra il numero corretto (scadute + entro 7gg) incrociando con la sezione "Preparati Neat" sotto i bucket `Scadute` + `Entro 7 giorni`.
3. Dismettendo una prep Neat scaduta → la card cala di 1 (verifica via `useDbChange`).
4. Responsive: su viewport `<lg` le due colonne si impilano (fallback `grid-cols-1`).

---

## Feature 2 — Colonna "Work" in CompostiTable

### Design (scelto dall'utente)
**Scope: uso diretto + via preparazione**. Una CRM è "coinvolta" in un Work se è ingrediente diretto (`work_ingredienti.source_type='crm' AND source_id=c.id`) **oppure** se uno dei suoi `preparazioni.id` è usato come ingrediente (`source_type='prep' AND source_id=prep.id WHERE prep.composto_id=c.id`). Semantica naturale per le Neat, che entrano nei work tipicamente via preparazione.

**Presentazione: nuova colonna dedicata "Work"** (sola lettura). La cella Nome è già affollata di badge (MIX, RIVAL., prep N, ⚠, fiale) — una nuova colonna mantiene tutto ordinato e scopribile.

### Modifiche file

**`src/main/ipc/composti.ipc.ts`** — `composti:list` (riga 60-74): aggiungere 2 subquery scalari (indice `idx_work_ingredienti_source (source_id, source_type)` già presente in `012-work.sql:34`, performance OK).

```sql
(SELECT COUNT(DISTINCT w.id)
 FROM work w
 WHERE (w.archiviato = 0 OR w.archiviato IS NULL)
   AND w.id IN (
     SELECT wi.work_id FROM work_ingredienti wi
     WHERE wi.source_type = 'crm' AND wi.source_id = c.id
     UNION
     SELECT wi.work_id FROM work_ingredienti wi
     JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
     WHERE wi.source_type = 'prep' AND p.composto_id = c.id
   ))                                                      AS work_count,
(SELECT GROUP_CONCAT(nome, ', ') FROM (
   SELECT DISTINCT w.nome FROM work w
   WHERE (w.archiviato = 0 OR w.archiviato IS NULL)
     AND w.id IN (
       SELECT wi.work_id FROM work_ingredienti wi
       WHERE wi.source_type = 'crm' AND wi.source_id = c.id
       UNION
       SELECT wi.work_id FROM work_ingredienti wi
       JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
       WHERE wi.source_type = 'prep' AND p.composto_id = c.id
     )
   ORDER BY w.nome LIMIT 10
))                                                         AS work_nomi,
```

Nota: `COALESCE(wi.prep_id, wi.source_id)` è il pattern già usato in `dashboard.ipc.ts:199,275` per compatibilità con lo schema pre/post migrazione `020-work-ingredienti-prep.sql`.

**`src/renderer/pages/composti/CompostiTable.tsx`** (file critico — aggiunta additiva di una nuova `Column`): inserire tra le `dataCols` (dopo "Metodi", riga 150) una colonna `work`:

```tsx
{
  key: 'work', label: 'Work', sortable: true,
  render: (_, row) => {
    if (!row.work_count || row.work_count === 0) return <span className="text-muted-foreground">—</span>
    return (
      <Badge
        title={row.work_nomi || ''}
        className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-100 cursor-help"
      >
        W {row.work_count}
      </Badge>
    )
  },
},
```

Colore **teal** coerente con `ScadenzeTimeline.tsx:317` (sezione Work). Tooltip nativo via `title`.

**`src/renderer/pages/composti/CompostiPage.tsx`** — registrare la nuova colonna in `COL_DEFS` (riga 43-65) e `DEFAULT_COL_VISIBLE` (riga 67+):
```ts
{ key: 'work', label: 'Work' },
// in DEFAULT_COL_VISIBLE:
work: true,
```
Così la colonna è visibile di default ma utente può nasconderla dal column toggle.

### File critici
- [src/main/ipc/composti.ipc.ts](src/main/ipc/composti.ipc.ts)
- [src/renderer/pages/composti/CompostiTable.tsx](src/renderer/pages/composti/CompostiTable.tsx) — **file protetto da CLAUDE.md**: aggiunta additiva di una `Column` nelle `dataCols`, nessuna modifica al resto.
- [src/renderer/pages/composti/CompostiPage.tsx](src/renderer/pages/composti/CompostiPage.tsx) — 2 righe in `COL_DEFS` + `DEFAULT_COL_VISIBLE`.

### Verifica end-to-end
1. CRM usata direttamente in 2 work attivi → badge "W 2", tooltip "WorkA, WorkB".
2. CRM Neat con 1 preparazione usata in 1 work → badge "W 1" (ramo via prep).
3. CRM usata in diretto in WorkA e via prep in WorkB → badge "W 2" (DISTINCT).
4. CRM usata solo in work archiviato → nessun badge.
5. CRM mai usata → nessun badge.
6. Performance: apertura DB Composti con ~2000 righe, nessun rallentamento visibile (indice già presente).

---

## Rischi / edge case

- **Feature 1**: se in futuro si creassero preparazioni da CRM non-Neat, il filtro `composto_forma === 'Neat'` lato renderer le escluderebbe silenziosamente dalla KPI Neat — comportamento voluto ("Prep Neat"). In sezione "Preparati Neat" (ScadenzeTimeline) comparirebbero invece — da valutare in quel momento se aggiungere filtro lato renderer anche lì.
- **Feature 2**: work archiviati esclusi per coerenza con `dashboard:summary`. `GROUP_CONCAT` con subquery annidata e `ORDER BY` per ordinamento stabile.
- **Feature 2 — scope CompostiTable.tsx**: file segnalato come critico in CLAUDE.md. La modifica è additiva (nuova `Column` ~15 LOC) e non tocca props, selezione bulk, filtri, render cella nome, StoriaDialog. Rileggere il file prima di modificare, come da istruzioni.
- **Feature 2 — colonna in DataTable**: verificare che il componente `DataTable` (`src/renderer/components/shared/DataTable.tsx`) supporti già nativamente le colonne `sortable` con render custom che ritorna un Badge (tutte le altre colonne lo fanno). Nessun rischio specifico atteso.

---

## Ordine di implementazione
1. **Feature 2** (contenuta, 2 file, rischio basso) — convalida in UI immediata.
2. **Feature 1** (5 file ma tutti nuovi/localizzati, nessuna rimozione).

## Stima LOC
- Feature 1: ~80 LOC (grid + KPI card + rename + 2 LOC SQL + tipi).
- Feature 2: ~30 LOC (15 SQL + 15 renderer tra Column + COL_DEFS + default).
