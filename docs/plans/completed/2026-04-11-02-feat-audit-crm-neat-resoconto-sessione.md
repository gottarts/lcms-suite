# Resoconto sessione — Audit CRM: inclusione CRM Neat e preparazioni stock

**Data:** 2026-04-11
**Oggetto:** Fix catena audit per work che usano CRM Neat — i CRM Neat e i loro analiti non venivano inclusi nell'audit

---

## Cosa è stato fatto

Identificato e risolto un gap nella catena audit CRM del dashboard: le work che usano preparazioni stock da CRM Neat (`source_type='prep'`) non apparivano correttamente nell'audit — i loro analiti venivano classificati come "Scoperti" anche quando coperti.

La fix è stata implementata su 3 file in 4 punti chirurgici, senza toccare nulla fuori dallo scope.

---

## Bug risolti / Feature aggiunte

### Audit CRM — catena interrotta per CRM Neat

**Root cause:**
I CRM Neat vengono salvati come `work_ingredienti.source_type='prep'` con `prep_id` che punta a `preparazioni.id`. Tre livelli del codice non gestivano questo caso:

1. **Backend (CTE `ids_rilevanti`):** la query che popola `crm_validi` considerava solo `source_type='crm'` — i CRM Neat non entravano mai nella lista
2. **Backend (`stmtIngredienti`):** i campi `source_cv` e un nuovo campo `source_composto_id` (id del CRM padre) non venivano calcolati per `source_type='prep'`
3. **`ricostruisciWorkInSchema`:** il loop ingredienti terminava dopo il caso `'work'`, senza gestire `'prep'` — il CRM Neat non veniva mai aggiunto come sorgente
4. **`auditModel.ts` loop CRM:** usava `if (source_type !== 'crm') continue`, saltando completamente i `'prep'`

**Fix:**
- `dashboard.ipc.ts` — aggiunta clausola **(d)** nella CTE: `JOIN preparazioni → composti` per `source_type='prep'`
- `dashboard.ipc.ts` — `stmtIngredienti` esteso: `source_cv` per `prep` (via join su preparazioni→composti), nuovo campo `source_composto_id` (id CRM Neat padre)
- `SchemaCalibrazione.logic.ts` — `ricostruisciWorkInSchema`: aggiunto `else if (source_type === 'prep')` che cerca il CRM padre in `crmItems` via `source_composto_id` e lo inserisce come `tipo: 'prep'`
- `auditModel.ts` — loop `crmUsatiInWork` ristrutturato da `continue` a `if/else if`: il caso `'prep'` aggiunge il CRM Neat padre alla mappa, rendendolo visibile nella colonna "CRM sottostanti"

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/dashboard.ipc.ts` | CTE: clausola (d) CRM Neat; `stmtIngredienti`: +`source_cv` per prep, +`source_composto_id` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `ricostruisciWorkInSchema`: gestione `source_type='prep'` |
| `src/renderer/pages/dashboard/lib/auditModel.ts` | Loop `crmUsatiInWork`: aggiunto caso `source_type='prep'` |

---

## Note per sessioni future

- Ci sono altri bug rilevati durante la sessione da affrontare nelle prossime sessioni (non dettagliati qui — l'utente ha indicato che li tratterà separatamente).
- Il piano della sessione è in `docs/plans/active/2026-04-11-02-feat-audit-crm-neat-plan.md`.
- `getCompsFromWork` (SchemaCalibrazione.logic.ts:351) gestiva già `tipo: 'prep'` — non ha richiesto modifiche.
- Il campo `source_composto_id` è nuovo nell'output di `stmtIngredienti` e viene usato solo dal frontend audit; nessun altro consumer ne è impattato.
