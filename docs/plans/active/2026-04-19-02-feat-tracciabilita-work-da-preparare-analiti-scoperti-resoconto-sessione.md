# Resoconto sessione — Ristrutturazione blocco Stato Tracciabilità dashboard

**Data:** 2026-04-19
**Oggetto:** Nuova card "Work da preparare", lista analiti accreditati scoperti/non coperti 17034, filtro WorkPage

---

## Cosa è stato fatto

- Sostituita la card "Analiti accreditati scoperti" (solo numero, non azionabile) con card "Work da preparare" nel blocco Stato Tracciabilità della dashboard
- Aggiunto elenco dettagliato analiti accreditati scoperti e analiti senza CRM accreditato 17034, in stile lista collassabile con raggruppamento per metodo
- Ristrutturato il layout del blocco Tracciabilità in 2 colonne (lg): sinistra KPI + work con problemi, destra le due liste analiti
- Aggiunto filtro "Da preparare" direttamente in WorkPage (pulsante toggle nella barra filtri metodo)
- Corretto margine superiore di SchemaCalibrazione per eliminare lo spazio lasciato dal BackButton del layout

---

## Feature aggiunte

### Card "Work da preparare"
**Motivazione:** La card "Analiti accreditati scoperti" mostrava solo un numero senza info utili su quali analiti fossero scoperti. La card "Work da preparare" è più azionabile: click → apre WorkPage filtrata.
**Implementazione:** Query SQL in `dashboard:summary` che conta work attive, tracciate, non bloccate con `stato_lab ∈ {non_preparata, scaduta, in_scadenza}`. Logica soglia in_scadenza replicata in SQL (20% della validità). Click naviga a `/work` con `location.state.filtroStatoLab: 'da_preparare'`.

### Lista analiti accreditati scoperti
**Motivazione:** Sostituisce il singolo numero "Analiti accreditati scoperti" con un elenco dettagliato per metodo, cliccabile verso DB Composti.
**Implementazione:** Query SQL lista `(metodo, analita, composto_dismesso_id, composto_scaduto_id)`. La condizione "scoperto" = nessun CRM con quel nome che sia **non dismesso E non scaduto** (correzione rispetto alla versione iniziale che non escludeva i CRM scaduti). Righe cliccabili → `/composti` con `searchFilter`.

### Lista analiti senza CRM accreditamento 17034
**Motivazione:** Richiesta esplicita di evidenziare analiti accreditati coperti da un CRM attivo ma senza `accreditamento_crm LIKE '%17034%'`.
**Implementazione:** Query SQL analoga, raggruppata per metodo. Stessa struttura visuale della lista scoperti.

### Filtro "Da preparare" in WorkPage
**Motivazione:** Permettere il filtraggio direttamente da WorkPage senza passare dalla dashboard.
**Implementazione:** Pulsante toggle nella barra filtri metodo (stile pill ambra). Supporta anche attivazione via `location.state.filtroStatoLab` (dalla dashboard). Reset automatico al toggle archivio.

### Fix spazio superiore SchemaCalibrazione
**Motivazione:** Aprendo lo schema calibrazione in MetodiPage, compariva uno spazio in alto con il BackButton visibile, confondente.
**Root cause:** `AppLayout` ha `p-4` + un `<div className="mb-2"><BackButton /></div>` sopra l'Outlet. SchemaCalibrazione compensava solo il `p-4` con `margin: -16px`.
**Fix:** Aumentato il `marginTop` a `-60px` (16px padding + 44px div BackButton).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/dashboard.ipc.ts` | Rimosso `analiti_accreditati_scoperti` count, aggiunti `work_da_preparare`, `analiti_scoperti[]`, `analiti_non_coperti_17034[]` |
| `src/renderer/lib/api.ts` | Tipo `stats_tracciabilita` aggiornato con i nuovi campi |
| `src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx` | Riscritta: layout 2 colonne, card "Work da preparare", componenti `Sezione` e `AnalitiList` |
| `src/renderer/pages/work/WorkPage.tsx` | Aggiunto `filtroStatoLab` state, filtro in `useMemo`, pulsante toggle "Da preparare" nella barra filtri |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `marginTop: -60` per coprire BackButton div del layout |

---

## Note per sessioni future

- La condizione "analita scoperto" usa `NOT EXISTS (... data_dismissione IS NULL AND scadenza_prodotto >= oggi)` — se in futuro si introduce la rivalidazione dei CRM, considerare se una rivalidazione valida debba "coprire" l'analita anche dopo la scadenza prodotto.
- Il `marginTop: -60` in SchemaCalibrazione è un valore hard-coded basato su `h-9` (36px) + `mb-2` (8px) + `p-4` (16px). Se il layout AppLayout cambia (BackButton rimosso o ridimensionato), va aggiustato.
- Piano di riferimento: `~/.claude/plans/in-stato-tracciabilita-della-groovy-cloud.md`
