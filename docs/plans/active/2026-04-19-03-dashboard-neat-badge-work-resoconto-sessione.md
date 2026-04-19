# Resoconto sessione — Dashboard Prep Neat + Badge Work su CompostiTable

**Data:** 2026-04-19
**Oggetto:** Due feature: (1) Dashboard riorganizzata con evidenza prep Neat scadute/in scadenza; (2) Colonna "Work" in DB Composti che mostra i work coinvolti per ogni CRM.

---

## Cosa è stato fatto

- **Dashboard riorganizzata a 2 colonne**: KpiCards (sinistra) + ScadenzeTimeline (destra) affiancati con `lg:grid-cols-2`.
- **KpiCards ristrutturate in 3 aree tematiche**: riga "Stato CRM" (in scadenza / scaduti / rivalidati), riga "Preparazioni Neat" (in scadenza / scadute), riepilogo testuale (totali / attivi / da aprire / dismessi).
- **Card Prep Neat cliccabili**: navigano a DB Composti mostrando solo i composti con preparazioni problematiche (filtro per ID preciso, non per forma generica).
- **Colonna "Work" in CompostiTable**: badge `W N` in teal che mostra quanti work attivi coinvolgono quella CRM (sia come ingrediente diretto che via preparazione). Tooltip con i nomi.
- **Sezione "Preparati" → "Preparati Neat"** in ScadenzeTimeline per chiarezza terminologica.
- **PreparazioniTab**: apertura di default su "tutte" invece di "attive".
- **ScadenzeTimeline**: `h-full` per allineare altezze colonne con KpiCards.

---

## Bug risolti / Feature aggiunte

### Feature: Dashboard layout 2 colonne + KpiCards tematiche
**Motivazione:** Le prep Neat scadute erano nascoste dentro l'accordion "Preparati" collassato di default — non visibili a colpo d'occhio.
**Implementazione:** Layout `grid grid-cols-1 lg:grid-cols-2` in DashboardPage. KpiCards ristrutturate con 2 righe di card + riepilogo testuale. Dati Neat calcolati da `dashboardApi.summary()` usando `giorniTra` + `bucketOf` esportati da `scadenzeModel.ts`.

### Feature: Colonna "Work" in CompostiTable
**Motivazione:** L'utente voleva vedere a colpo d'occhio quali CRM sono coinvolte in work attivi.
**Implementazione:** 2 subquery scalari in `composti:list` (`work_count`, `work_nomi`) che usano l'indice già esistente `idx_work_ingredienti_source`. Scope: uso diretto CRM + uso via preparazione (UNION). Colonna registrata in `COL_DEFS` e visibile di default.

### Fix: Filtro card Neat porta a tutte le Neat invece delle sole problematiche
**Root cause:** Il click navigava con `filtroForma: 'Neat'` mostrando tutte le Neat incluse quelle senza preparazioni.
**Fix:** KpiCards raccoglie i `composto_id` distinti dalle prep problematiche e li passa come `filtroCompostoIds`. CompostiPage filtra per ID se questo stato è presente.

### Fix: Prep scaduta oggi contava come "in scadenza" nella KPI
**Root cause:** `bucketOf(0)` = `'urgenti'`, ma la card contava "in scadenza" solo bucket `urgenti`/`prossime`.
**Fix:** Aggiunta condizione `|| giorni === 0` nel conteggio "scadute" della KPI card.

### Fix: Calcolo giorni buggy (UTC vs locale)
**Root cause:** Il calcolo inline usava `new Date(isoDate).setHours(0,0,0,0)` che parsa le date ISO come UTC, causando sfasamento di 1 giorno in certi fusi orari.
**Fix:** Esportata `giorniTra` da `scadenzeModel.ts` e usata in KpiCards invece del calcolo inline.

### UX: PreparazioniTab apre su "tutte" invece di "attive"
**Motivazione:** L'utente vuole vedere subito tutte le preparazioni all'apertura del drawer.
**Fix:** `useState('attive')` → `useState('tutte')` in PreparazioniTab (1 riga).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/composti.ipc.ts` | Aggiunta subquery `work_count` e `work_nomi` con UNION diretto+via prep |
| `src/main/ipc/dashboard.ipc.ts` | Aggiunto `c.forma AS composto_forma` nella SELECT preparazioni |
| `src/renderer/pages/composti/CompostiPage.tsx` | Colonna Work in COL_DEFS + DEFAULT_COL_VISIBLE; filtri `filtroFormaNav` e `filtroCompostoIds` da location.state |
| `src/renderer/pages/composti/CompostiTable.tsx` | Nuova Column `work` con badge teal dopo "Metodi" |
| `src/renderer/pages/composti/PreparazioniTab.tsx` | Default filtro `'attive'` → `'tutte'` |
| `src/renderer/pages/dashboard/DashboardPage.tsx` | Layout 2 colonne `lg:grid-cols-2` con KpiCards+ScadenzeTimeline affiancati |
| `src/renderer/pages/dashboard/lib/scadenzeModel.ts` | Tipo `preparazione` esteso con `composto_forma`; `giorniTra` esportata |
| `src/renderer/pages/dashboard/sections/KpiCards.tsx` | Completa riscrittura: 3 aree tematiche, card Neat cliccabili con filtro per ID |
| `src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx` | Rename "Preparati" → "Preparati Neat"; `h-full` per allineamento altezze |

---

## Note per sessioni future

- **Piano di riferimento:** `docs/plans/active/2026-04-19-03-dashboard-neat-badge-work-plan.md`
- Il `filtroCompostoIds` in CompostiPage è uno stato read-only da `location.state` — se l'utente naviga manualmente alla pagina, non si attiva. Non c'è un modo nell'UI per rimuoverlo una volta attivo (navigazione a `/composti` diretta risolve).
- La colonna "Work" in CompostiTable usa `sortable: true` ma il campo `work` non è una colonna reale del DB — il sort avviene lato renderer su `work_count`. Verificare che DataTable gestisca correttamente il sort su campi calcolati.
- La card "Prep Neat scadute" è sempre rossa anche se il valore è 0 — scelta intenzionale per coerenza visiva come metrica di allerta (discussa con l'utente).
- Se in futuro si volessero creare preparazioni da CRM non-Neat, il filtro `composto_forma === 'Neat'` in KpiCards le escluderebbe silenziosamente.
