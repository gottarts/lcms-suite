# Piano: Refactoring Audit CRM — logica basata sulle preparazioni

## Context

L'Audit CRM ha un bug concettuale grave: l'unità di riferimento temporale è la **work** (oggetto ricetta), mentre dovrebbe essere la **preparazione** (`work_preparazioni`). Il problema si manifesta in due modi:

1. **Work archiviate escluse**: la query filtra `archiviato = 0`, quindi una work archiviata dopo la data di audit non viene mostrata, anche se aveva preparazioni valide a quella data.
2. **Work create dopo la data di audit incluse**: una work creata oggi è visibile nell'audit di ieri (non c'è filtro su `created_at <= @data`), perché il JOIN si basa solo su `work_metodi.metodo_id`.

Lo schema corretto è:
> **Audit metodo X alla data Y** → trova tutte le `work_preparazioni` con `data_prep <= Y` e `data_prep + validita_mesi >= Y` associate a work del metodo X (sia work attive che archiviate) → per ognuna, estrai info (lotti CRM, lotti CRM Neat/prep stock, info di preparazione).

La work è un contenitore di ricetta e tracciabilità; la preparazione è l'evento temporale che determina la copertura alla data di audit.

---

## Bug identificati

### Bug 1 — Work archiviate escluse (riga 182, dashboard.ipc.ts)
```sql
AND (w.archiviato = 0 OR w.archiviato IS NULL)  -- ← esclude work archiviate post-data
```
Una work archiviata il 2026-03-01 ha preparazioni valide al 2026-02-01: non appare nell'audit.

### Bug 2 — Work create dopo la data di audit incluse (nessun filtro su created_at)
Nessun controllo impedisce di includere una work creata oggi in un audit di ieri. Se non ha `work_preparazioni` con `data_prep <= @data`, risulta `ultima_prep_data = NULL` → stato `non_preparata`. Appare comunque nell'audit con stato fuorviante.

---

## File critici

- `src/main/ipc/dashboard.ipc.ts` — righe 153–184 (query works), 258–315 (query crm_validi)
- `src/renderer/pages/dashboard/lib/auditModel.ts` — `buildAuditModel()`, nessuna modifica necessaria
- `src/renderer/pages/dashboard/lib/scadenzeModel.ts` — `calcolaStatoLabAllaData()`, nessuna modifica

---

## Approccio — modifica monolitica alla query SQL nel main

### Soluzione

Modificare la query works in `dashboard.ipc.ts` con due interventi chirurgici:

**1. Rimuovere il filtro `archiviato`** — includere sia work attive che archiviate, purché abbiano almeno una preparazione valida alla data di audit.

**2. Aggiungere un filtro di esistenza preparazione** — una work appare nell'audit solo se esiste almeno una `work_preparazioni` con `data_prep <= @data` (cioè aveva una preparazione al momento dell'audit).

Questo è l'unico vincolo temporale corretto: se una work non aveva ancora nessuna preparazione alla data di audit, non deve essere mostrata. Se aveva preparazioni (anche se archiviata), deve apparire.

### Query modificata (sostituzione righe 178–184)

```sql
FROM work w
JOIN work_metodi wm ON wm.work_id = w.id
WHERE wm.metodo_id = @metodo_id
  AND w.validita_mesi IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM work_preparazioni wp2
    WHERE wp2.work_id = w.id AND wp2.data_prep <= @data
  )
ORDER BY w.nome ASC
```

Eliminati:
- `AND (w.archiviato = 0 OR w.archiviato IS NULL)` — sostituito dal filtro EXISTS
- Il filtro EXISTS garantisce: "alla data di audit questa work aveva almeno una preparazione registrata"

### Aggiornamento query crm_validi (righe 266–315)

Le CTE `mix_usati` e `ids_rilevanti` fanno JOIN su `work_metodi` senza filtro `archiviato` — questo è già corretto. Nessuna modifica necessaria.

---

## Comportamento risultante

| Scenario | Prima | Dopo |
|----------|-------|------|
| Work archiviata con prep valide alla data | Non vista | Vista correttamente |
| Work creata dopo la data di audit | Vista come `non_preparata` | Non vista (nessuna prep <= data) |
| Work attiva con prep alla data | Vista | Vista (invariato) |
| Work attiva senza prep alla data | Vista come `non_preparata` | Non vista (corretta esclusione) |

> **Nota**: le work senza preparazioni (`non_preparata`) spariscono dall'audit. Questo è semanticamente corretto: se una work non era ancora stata preparata, non copriva nulla a quella data. Se si vuole mantenerle visibili per completezza, si può discutere dopo.

---

## Verifica

1. Creare una work oggi associata a un metodo.
2. Eseguire audit del metodo per ieri → la work NON deve apparire.
3. Registrare una preparazione con `data_prep = ieri` → la work DEVE apparire nell'audit di ieri.
4. Archiviare la work → la work DEVE continuare ad apparire nell'audit di ieri.
5. Eseguire audit per una data precedente alla prima prep → la work NON deve apparire.
