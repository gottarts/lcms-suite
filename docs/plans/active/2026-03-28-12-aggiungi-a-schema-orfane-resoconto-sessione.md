# Resoconto sessione — Aggiungi Work Orfana a Schema

**Data:** 2026-03-28
**Oggetto:** Feature "Aggiungi a Schema ↗" per work orfane in WorkPage

---

## Cosa è stato fatto

Implementata la feature richiesta nel resoconto sessione precedente come "Feature idea per sessione futura": le work orfane (senza metodo collegato, `primo_metodo_id = NULL`) ora mostrano un pulsante "**+ Schema ↗**" nella WorkCard che apre un dialog per aggiungere la work direttamente a uno schema di calibrazione esistente.

Contestualmente è stata fatta una valutazione completa dello stato del sistema (schemi, work, flussi operativi) con una summa delle sessioni recenti.

---

## Bug risolti / Feature aggiunte

### Feature: AggiungiASchemaDialog — aggiungi work orfana a schema senza ricrearla

**Motivazione:**
Le work orfane non avevano nessun percorso UI per entrare in uno schema. `ImportaWorkDialog` era inaccessibile da WorkPage, e anche se accessibile filtra per analiti condivisi (vincolante). L'unica alternativa era ricreare la work dall'interno di SchemaCalibrazione — distruttivo e ridondante.

**Implementazione:**
- Nuovo componente `AggiungiASchemaDialog.tsx` in `src/renderer/pages/work/`
- Differenza rispetto a `ImportaWorkDialog`: non filtra per analiti condivisi (la work orfana può entrare in qualsiasi schema), carica tutti i dati autonomamente senza dipendere dallo stato di SchemaCalibrazione
- Flusso: selezione metodo → carica schema JSON (`schemaCalApi.get`) + CRM (`compostiApi.listForSchema`) + ricostruisce `WorkInSchema` via `ricostruisciWorkInSchema()` → mostra compatibilità → on confirm: `schemaCalApi.save()` (che auto-sincronizza `work_metodi`) + naviga a SchemaCalibrazione
- Controlli: work già presente nello schema / dipendenza work mancante (blocca) / CRM non in schema (warning, non blocca)
- `schemaCalApi.save()` già gestisce `work_metodi` in autonomia — nessuna chiamata separata ad `addToMetodo` necessaria

**In WorkPage:**
- Aggiunto stato `addToSchemaWork`
- `WorkCard` riceve `onAddToSchema` quando `!w.primo_metodo_id`; è mutuamente esclusivo con `onGoSchema`
- Pulsante blu "**+ Schema ↗**" appare solo su card orfane

### Valutazione issue secondarie (nessuna modifica necessaria)

- **`work:list-for-import` filtro WIP**: la query usa già `JOIN work_metodi` che esclude naturalmente le orfane — nessun fix necessario, il bug era già risolto.
- **Tabella volumi extra in DrawerDettaglioWork**: `extraVols` e `usedVol` erano già corretti nel codice (fix in commit `3b14b6a`) — la nota nel resoconto precedente era obsoleta.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/AggiungiASchemaDialog.tsx` | NUOVO — dialog per aggiungere work orfana a schema |
| `src/renderer/pages/work/WorkPage.tsx` | Aggiunto import, stato, prop `onAddToSchema` su WorkCard, pulsante, mount dialog |
| `docs/plans/active/2026-03-28-aggiungi-a-schema-orfane-plan.md` | Piano della sessione |

---

## Note per sessioni future

- **`schemaCalApi.get()` fa cleanup passivo di `work_metodi`**: quando si chiama `schema-cal:get`, le entries spurie vengono rimosse. Quindi se si aggiunge `work_metodi` prima di fare `schema-cal:save`, potrebbe venire rimossa. L'ordine corretto è sempre: modifica workCols → `schema-cal:save` → sincronizzazione automatica.
- **Work orfane create da WorkPage**: dopo aver usato `AggiungiASchemaDialog`, la work non è più orfana (ha un metodo collegato) e torna a mostrare "Schema ↗" normale al prossimo reload.
- **Nessuna modifica al DB/IPC**: la feature usa esclusivamente API già esistenti (`workApi.get`, `schemaCalApi.get/save`, `compostiApi.listForSchema`, `metodiApi.list`).
- **Rimandato a sessioni future**: archivio schemi calibrazione (versioning storico), filtro per metodo in WorkPage, `salvaWorkNelDb` che chiama sempre `work:create` invece di `work:update`.
