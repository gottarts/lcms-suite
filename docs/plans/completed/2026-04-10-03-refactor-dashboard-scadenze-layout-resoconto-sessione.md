# Resoconto sessione — Riorganizzazione Dashboard: layout e scadenze

**Data:** 2026-04-10
**Oggetto:** Riordino sezioni dashboard, separazione scadenze per tipo, navigazione filtrata da KPI cards

---

## Cosa è stato fatto

- Spostato Tracciabilità e Audit CRM più in alto nella dashboard (subito dopo i KPI)
- Sezione scadenze separata in tre pannelli collassabili: CRM, Preparati, Work
- KPI cards collegano a DB Composti con filtro stato pre-applicato
- Aggiunto controllo "Espandi tutto / Comprimi tutto" nella card scadenze
- Preparati mostrano link cliccabile al CRM di origine
- Fix bug filtri: le chiavi passate via `location.state` erano valori interni invece delle chiavi UI di STATO_MAP

---

## Bug risolti / Feature aggiunte

### Fix: filtri KPI non funzionavano (nessun composto visibile)
**Root cause:** `KpiCards.tsx` passava i valori interni di stato (`'scaduto'`, `'rivalidato_scaduto'`) via `location.state.filtroStati`, ma `CompostiPage.tsx` usa `STATO_MAP[s]` per tradurre `filtroStati` — le chiavi di STATO_MAP sono le etichette UI (`'Scaduto'`, `'Rivalidato — Scaduto'`). Il mismatch causava `STATO_MAP[s] === undefined` e nessun composto passava il filtro.
**Fix:** Corrette le chiavi passate in `KpiCards.tsx` per usare le etichette UI esatte di STATO_MAP. `CompostiPage.tsx` inizializza `filtroStati` da `location.state.filtroStati` (aggiunta minimale alla riga di useState).

### Feature: Scadenze separate per tipo
**Motivazione:** La timeline unificata mescolava CRM, preparati e work rendendo difficile capire cosa scade e di che tipo.
**Implementazione:** `ScadenzeTimeline.tsx` riscritto con tre sezioni collassabili (`Sezione` component con `open`/`onToggle` controllati dall'esterno). Ogni sezione ha i propri bucket temporali. Le sezioni si aprono di default solo se hanno elementi entro 30 giorni.

### Feature: Espandi tutto / Comprimi tutto
**Motivazione:** Con tre sezioni separabili serve un controllo rapido globale.
**Implementazione:** Stato `openCrm/openPrep/openWork` nel componente principale. I pulsanti "Espandi tutto" / "Comprimi tutto" compaiono solo quando serve (es. "Espandi tutto" nascosto se tutte già aperte).

### Feature: Navigazione filtrata da KPI cards
**Motivazione:** Cliccare "CRM scaduti" portava a DB Composti senza nessun filtro.
**Implementazione:** Ogni card passa `{ state: { filtroStati: [...] } }` via React Router. La card "CRM dismessi" passa anche `mostraDismessi: true`.

### Riordino layout dashboard
**Motivazione:** Audit trail e Tracciabilità erano troppo in basso.
**Implementazione:** Nuovo ordine in `DashboardPage.tsx`: KpiCards → TracciabilitaCard → AuditCrmSection → ScadenzeTimeline.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/dashboard/DashboardPage.tsx` | Riordino sezioni |
| `src/renderer/pages/dashboard/sections/KpiCards.tsx` | Navigazione con state filtrato (chiavi UI corrette) |
| `src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx` | Separazione per tipo, collassabile, espandi/comprimi tutto, link CRM origine per preparati |
| `src/renderer/pages/composti/CompostiPage.tsx` | Inizializzazione `filtroStati` da `location.state` |

---

## Note per sessioni future

- Il piano approvato è in `docs/plans/active/2026-04-10-03-refactor-dashboard-scadenze-layout-plan.md`
- I pulsanti "CRM attivi" / "CRM dismessi" erano stati aggiunti nella card scadenze ma l'utente li ha giudicati inutili — rimossi. Non riproporre.
- `filtroStati` in `CompostiPage` usa le chiavi di `STATO_MAP` (etichette UI), non i valori interni — attenzione se si aggiungono altri punti di navigazione filtrata.
- La sezione Preparati mostra `→ NomeCRM` come link al CRM di origine: sia `onClickPrep` che `onClickCrm` navigano allo stesso posto (ricerca per `composto_nome`). Se in futuro si vuole distinguere, `onClickPrep` potrebbe navigare alla preparazione stessa.
