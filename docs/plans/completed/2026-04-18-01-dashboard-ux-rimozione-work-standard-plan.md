# Piano — 3 interventi Dashboard + rimozione `work_standard`

## Context

Tre migliorie UX nella Dashboard e una pulizia di schema nel DB Composti, raggruppate in un unico piano perché toccano aree contigue. Il task originale "warning analiti accreditati scoperti" è stato **escluso** su richiesta dell'utente (sarà affrontato in sessione separata con design dedicato).

Interventi:

1. **Scadenze prossimi 60 giorni — collapse di default**: oggi le sotto-sezioni CRM/Preparati/Work si aprono automaticamente se hanno elementi ≤30 giorni, rendendo la card rumorosa all'apertura della Dashboard. Vogliamo che restino chiuse all'ingresso, lasciando i controlli "Espandi/Comprimi tutto" già presenti.
2. **Ritorno al modulo precedente via freccia**: da Dashboard l'utente clicca link che lo portano in `/composti`, `/work`, ecc. Al ritorno manuale perde il contesto (scroll, filtri inseriti al volo). Soluzione semplice richiesta: un bottone **freccia "indietro"** visibile nelle pagine di destinazione che riporta al modulo precedente (senza alcuna persistenza di stato).
3. **Rimozione campo `work_standard` dal DB Composti**: il campo non ha più senso nell'app attuale. Va eliminato da schema DB, tipi, UI tabella, form (CompostoForm, MixPesticidiForm), dialog import/export, handler IPC, logica dashboard/audit. **NON toccare** `destinazione_uso` (che resta — usato in SchemaCalibrazione per matching CRM→mix).

---

## Task 1 — Collapse di default scadenze

### File

- [src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx](src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx)

### Modifiche

1. [ScadenzeTimeline.tsx:236-238](src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx#L236-L238): cambiare `useState(true)` → `useState(false)` per `openCrm`, `openPrep`, `openWork`.
2. [ScadenzeTimeline.tsx:240-247](src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx#L240-L247): **eliminare completamente** il `useEffect` che auto-apre sezioni con elementi ≤30 giorni. È l'unica fonte di apertura automatica; rimuovendolo le sezioni restano chiuse.
3. I pulsanti "Espandi tutto"/"Comprimi tutto" e il toggle per-sezione restano invariati (già agiscono sui setter).

---

## Task 2 — Freccia "indietro" nelle pagine di destinazione

### Idea

Un componente leggero riusabile `<BackButton />` che usa `useNavigate()` di React Router per tornare indietro nella history:

```tsx
const navigate = useNavigate()
<Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
  ← Indietro
</Button>
```

`navigate(-1)` sfrutta la history nativa del browser/Electron — non serve localStorage, Context, né `location.state`. Se l'utente arriva direttamente (no history) si può nascondere il bottone quando `window.history.length <= 1`.

### File nuovo

- `src/renderer/components/shared/BackButton.tsx` — componente stateless (~20 righe). Props: `label?: string` (default "Indietro"), `className?: string`. Usa `Button` shadcn già presente nel repo, icona freccia in ASCII `←` o `ArrowLeft` da `lucide-react` se già usato altrove.

### File da modificare

Le pagine principali raggiungibili dai link Dashboard. Dall'esplorazione, i link Dashboard portano a `/composti`, `/work`, `/composti` con `state`. Integro il `<BackButton />` nell'header di:

- [src/renderer/pages/composti/CompostiPage.tsx](src/renderer/pages/composti/CompostiPage.tsx) — aggiungere in cima al contenuto pagina, accanto al titolo.
- [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx) — stesso trattamento (verificare path esatto al momento dell'implementazione).

Il bottone compare solo quando `window.history.length > 1`, così sulla prima apertura diretta (F5/deep-link) non appare.

### Alternativa da valutare a implementazione

Se l'utente già ha una TopBar/Header globale condivisa, meglio aggiungere il `<BackButton />` lì una volta sola invece che pagina per pagina. Da confermare durante l'implementazione leggendo il layout root (`App.tsx` / `MainLayout.tsx`).

---

## Task 3 — Rimuovere campo `work_standard` da DB Composti

### Scope — rimuovere SOLO `work_standard`

**`destinazione_uso` resta intatto** (usato in SchemaCalibrazione).

### Schema DB

- [src/main/migrations/001-initial.sql:50-51](src/main/migrations/001-initial.sql#L50-L51): rimuovere la riga `work_standard` dalla CREATE TABLE composti.
- **Nuova migration** `src/main/migrations/NNN-drop-work-standard.sql`: `ALTER TABLE composti DROP COLUMN work_standard;` — SQLite supporta `DROP COLUMN` da 3.35 (2021); verificare la versione di better-sqlite3 usata. Se non supportato, usare pattern recreate-table (create temp, copy, drop, rename).

### Tipi TypeScript

- [src/shared/types.ts:58-59](src/shared/types.ts#L58-L59): rimuovere solo il campo `work_standard` dall'interface `Composto`.

### UI — tabella composti

- [src/renderer/pages/composti/CompostiTable.tsx:132](src/renderer/pages/composti/CompostiTable.tsx#L132): rimuovere la column definition di `work_standard` (key, label, filterValue, onFilterChange, render).
- [src/renderer/pages/composti/CompostiPage.tsx:58](src/renderer/pages/composti/CompostiPage.tsx#L58): rimuovere entry in `COL_DEFS`.
- [src/renderer/pages/composti/CompostiPage.tsx:83](src/renderer/pages/composti/CompostiPage.tsx#L83): rimuovere da `DEFAULT_COL_VISIBLE`.
- [src/renderer/pages/composti/CompostiPage.tsx:502](src/renderer/pages/composti/CompostiPage.tsx#L502): rimuovere distinct values per filter dropdown.
- [src/renderer/pages/composti/CompostiPage.tsx:518-539](src/renderer/pages/composti/CompostiPage.tsx#L518-L539): rimuovere inclusione nella search e nel filter chain (tenendo `destinazione_uso`).
- [src/renderer/pages/composti/CompostiPage.tsx:819](src/renderer/pages/composti/CompostiPage.tsx#L819): rimuovere dal data loading form template.
- [src/renderer/pages/composti/CompostoPanel.tsx:250](src/renderer/pages/composti/CompostoPanel.tsx#L250): rimuovere la Field row del panel dettaglio.

> **Regola CLAUDE.md**: `CompostiTable.tsx` e `CompostiPage.tsx` sono file critici. Modifiche **chirurgiche** — solo la colonna/filtro di `work_standard`, nulla più.

### Form di creazione/modifica

- [src/renderer/pages/composti/CompostoForm.tsx:88-89](src/renderer/pages/composti/CompostoForm.tsx#L88-L89): rimuovere `work_standard` dal default state.
- [src/renderer/pages/composti/CompostoForm.tsx:575](src/renderer/pages/composti/CompostoForm.tsx#L575): rimuovere l'Input field.
- [src/renderer/pages/composti/MixPesticidiForm.tsx:42-43](src/renderer/pages/composti/MixPesticidiForm.tsx#L42-L43): rimuovere dal `ComponenteImportato` interface.
- [src/renderer/pages/composti/MixPesticidiForm.tsx:65-67](src/renderer/pages/composti/MixPesticidiForm.tsx#L65-L67): default state.
- [src/renderer/pages/composti/MixPesticidiForm.tsx:144,150](src/renderer/pages/composti/MixPesticidiForm.tsx#L144): template pre-populate.
- [src/renderer/pages/composti/MixPesticidiForm.tsx:231,239,342](src/renderer/pages/composti/MixPesticidiForm.tsx#L231): columns array, form keys, data assignment.
- [src/renderer/pages/composti/MixPesticidiForm.tsx:621](src/renderer/pages/composti/MixPesticidiForm.tsx#L621): Input UI.

### Import/Export

- [src/renderer/pages/composti/ImportDialog.tsx:25-26](src/renderer/pages/composti/ImportDialog.tsx#L25-L26): rimuovere `work_standard` da `DB_FIELDS`.
- [src/renderer/pages/composti/ImportDialog.tsx:191-192](src/renderer/pages/composti/ImportDialog.tsx#L191-L192): rimuovere aliases autoMap.
- [src/renderer/pages/composti/ExportDialog.tsx:80-81](src/renderer/pages/composti/ExportDialog.tsx#L80-L81): rimuovere da CSV export order.
- [src/renderer/pages/composti/ExportDialog.tsx:219](src/renderer/pages/composti/ExportDialog.tsx#L219): rimuovere da PDF export.

### IPC handlers

- [src/main/ipc/composti.ipc.ts:202-203](src/main/ipc/composti.ipc.ts#L202-L203): rimuovere `work_standard` da `composti:create` handler.
- [src/main/ipc/composti.ipc.ts:233](src/main/ipc/composti.ipc.ts#L233): rimuovere da INSERT columns list.
- [src/main/ipc/composti.ipc.ts:294-295,314,359](src/main/ipc/composti.ipc.ts#L294-L295): `composti:edit` field assignment + UPDATE SQL.
- [src/main/ipc/composti.ipc.ts:396-397,412-413](src/main/ipc/composti.ipc.ts#L396-L397): bulk import UPDATE.
- [src/main/ipc/composti.ipc.ts:543-545,577,607-608](src/main/ipc/composti.ipc.ts#L543-L545): interface signatures.
- [src/main/ipc/dashboard.ipc.ts:359](src/main/ipc/dashboard.ipc.ts#L359): SELECT columns.
- [src/main/ipc/migration.ipc.ts:197-198,203-204,235-236](src/main/ipc/migration.ipc.ts#L197-L198): INSERT columns + data mapping per migrazione da DB legacy (attenzione: se il DB legacy aveva `work_standard`, qui lo si ignora semplicemente).

### Logica audit/dashboard

- [src/renderer/pages/dashboard/lib/auditReport.ts:291](src/renderer/pages/dashboard/lib/auditReport.ts#L291): rimuovere dalla PDF table.
- [src/renderer/pages/dashboard/lib/auditModel.ts:115](src/renderer/pages/dashboard/lib/auditModel.ts#L115): rimuovere dal raw field mapping `buildAuditModel`.
- [src/renderer/components/shared/StatusBadge.tsx:92](src/renderer/components/shared/StatusBadge.tsx#L92): se `work_standard` è nei campi richiesti di `getCampiMancanti`, toglierlo (altrimenti un composto valido verrà marcato "mancante" a vuoto).

### Riferimenti Work

- [src/renderer/pages/work/WorkDrawer.tsx:61](src/renderer/pages/work/WorkDrawer.tsx#L61): rimuovere null initialization.

### Non toccare (= `destinazione_uso`, fuori scope)

- Tutti i riferimenti a `destinazione_uso` in CompostoForm, MixPesticidiForm, SchemaCalibrazione, auditModel ecc. **restano invariati**.

---

## Verifica end-to-end

### Setup

1. `npm run dev` per avviare l'app.
2. Backup del DB prima di lanciare la migration (precauzione standard).

### Task 1 — Scadenze collapse

1. Aprire la pagina **Dashboard** da cold-start.
2. Verificare che la card "Scadenze prossimi 60 giorni" mostri **tutte e tre** le sotto-sezioni chiuse (chevron `▼`), anche con CRM/work in scadenza imminente.
3. Toggle per-sezione → apre/chiude correttamente.
4. "Espandi tutto" / "Comprimi tutto" funzionano.
5. Uscire dalla Dashboard, rientrare → di nuovo tutte chiuse.

### Task 2 — Back button

1. Dashboard → cliccare un link (es. su un CRM in scadenza → `/composti`).
2. In `/composti` verificare che appaia la freccia "← Indietro" nell'header.
3. Click sulla freccia → torna in Dashboard (history back).
4. Aprire direttamente `/composti` (refresh o deep-link) → la freccia **non** appare (history vuota).
5. Ripetere per `/work`.

### Task 3 — Rimozione `work_standard`

1. Avviare app → migration auto-esegue → colonna droppata dal DB.
2. **TypeScript**: `npm run typecheck` (o `tsc --noEmit`) → nessun errore.
3. DB Composti: la colonna "Work standard" non è più visibile in tabella, non appare nei filtri, non è nella barra di ricerca. La colonna "Destinazione uso" resta.
4. Aprire "Nuovo composto" → il campo `work_standard` non c'è più nel form. `destinazione_uso` rimane.
5. Mix pesticidi: stesso controllo nel form dedicato.
6. Importazione Excel: il campo non è più nella lista mappabile. Ri-importando un file storico che aveva la colonna, l'import la ignora senza errori.
7. Esportazione CSV/PDF: il campo non compare.
8. Dashboard → sezione Audit CRM: si apre senza errori; report PDF audit non contiene più la colonna.
9. SchemaCalibrazione (pagina Metodi) → matching CRM→mix **continua a funzionare** (usa `destinazione_uso`, non `work_standard`).
10. Migrazione da DB legacy: se disponibile un file legacy con `work_standard`, lanciare import → gli altri campi si migrano correttamente, `work_standard` viene silenziosamente ignorato.

### Checklist regressioni

- CompostiTable: selezione bulk con checkbox, shift+click, filtri per colonna, visibilità/ordine colonne, badge RIVALIDATO, ApriAperturaDialog, FialeSelector, indicatori campi mancanti → **tutti funzionanti**.
- StoriaDialog: dismissione/rivalidazione singola e bulk → ok.
- Nessun altro campo DB Composti modificato.

---

## Note operative

- Ordine consigliato implementazione: **Task 1 (5 min)** → **Task 2 (20 min)** → **Task 3 (1-2 h, il più invasivo)**. Committare ciascun task separatamente per poter isolare eventuali regressioni.
- Il task 3 tocca file critici elencati in CLAUDE.md: ogni modifica deve limitarsi a rimuovere `work_standard` — nessuna pulizia collaterale.
