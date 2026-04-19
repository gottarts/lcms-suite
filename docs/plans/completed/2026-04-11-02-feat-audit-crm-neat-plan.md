# Piano: Audit CRM — inclusione CRM Neat e preparazioni stock

## Context

La catena audit (Work → CRM → analiti accreditati) è incompleta per le work che usano **CRM Neat** come sorgente. I CRM Neat vengono salvati nel DB come `work_ingredienti.source_type='prep'` con riferimento a `preparazioni.id` (migration 020). Tuttavia:

1. Il backend (`dashboard:audit-crm`) non estrae i CRM Neat nella lista `crm_validi`
2. `auditModel.ts` salta gli ingredienti `source_type='prep'` nel loop CRM
3. `ricostruisciWorkInSchema` non gestisce `source_type='prep'`

Risultato: le work che contengono Neat mostrano analiti scoperti anche se coperti.

---

## File critici da modificare

- `src/main/ipc/dashboard.ipc.ts` — righe 260–300 (query `crm_validi`)
- `src/main/ipc/dashboard.ipc.ts` — righe 187–239 (query `stmtIngredienti` usata per arricchire ingredienti)
- `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — righe 480–583 (`ricostruisciWorkInSchema`)
- `src/renderer/pages/dashboard/lib/auditModel.ts` — righe 74–95 (`toCrmItem`), 177–198 (loop CRM in work)

---

## Piano di implementazione

### Step 1 — Backend: aggiungere clausola (d) nella CTE `ids_rilevanti` (dashboard.ipc.ts ~riga 282)

Aggiungere una 4ª clausola UNION alla CTE `ids_rilevanti` per includere i CRM Neat che hanno preparazioni usate dai work del metodo:

```sql
UNION
-- (d) CRM Neat che hanno preparazioni usate dai work del metodo
SELECT DISTINCT c.id
FROM work_ingredienti wi
JOIN work_metodi wm ON wm.work_id = wi.work_id
JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
JOIN composti c ON c.id = p.composto_id
WHERE wm.metodo_id = @metodo_id
  AND wi.source_type = 'prep'
```

### Step 2 — Backend: arricchire ingredienti `source_type='prep'` con `source_cv` e `source_composto_id` (dashboard.ipc.ts ~riga 205)

Lo `stmtIngredienti` già estrae `source_nome` e `source_lotto` per `source_type='prep'`, ma manca:
- `source_cv`: la concentrazione del CRM Neat (da `composti.concentrazione`)
- `source_composto_id`: l'id del CRM Neat padre (necessario al frontend per collegarlo a `crmItems`)

Aggiungere alle CASE nel `stmtIngredienti`:

```sql
CASE
  WHEN wi.source_type = 'crm'  THEN wi.source_id
  WHEN wi.source_type = 'prep' THEN (SELECT c.id FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
  ELSE NULL
END AS source_composto_id,
CASE
  WHEN wi.source_type = 'crm'  THEN (SELECT concentrazione FROM composti WHERE id = wi.source_id)
  WHEN wi.source_type = 'prep' THEN (SELECT c.concentrazione FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
  ELSE NULL
END AS source_cv
```

> Nota: `source_cv` per `crm` esiste già come `source_cv` (riga 208-211). Va esteso per `prep`.

### Step 3 — Frontend: `ricostruisciWorkInSchema` — gestire `source_type='prep'` (SchemaCalibrazione.logic.ts ~riga 564)

Aggiungere il caso `else if (ing.source_type === 'prep')` nel loop degli ingredienti, subito dopo il caso `'work'`. L'ingrediente ha `source_composto_id` (CRM Neat padre) e `source_nome` (nome del CRM Neat):

```typescript
} else if (ing.source_type === 'prep') {
  // Cerca il CRM Neat padre nei crmItems tramite source_composto_id
  const crm = crmItems.find(c => c.id === ing.source_composto_id)
  if (crm) {
    srcs.push({
      id: String(crm.id),
      nome: crm.nome,
      cv: crm.cv,
      tipo: 'prep',
      concVariabile: false,
    })
    vols.push({
      nome: crm.nome,
      vol: ing.volume_prelievo_ml ?? 0,
      concTarget: ing.conc_target_mgL ?? undefined,
      dilFactor: ing.fattore_diluizione ?? undefined,
      modo: ing.modo_calcolo ?? 'conc',
    })
  }
}
```

> `tipo: 'prep'` è già un valore gestito da `getCompsFromWork` (riga 351): usa `src.nome` e `src.cv` per derivare il compostoInWork → matching con analiti accreditati funzionerà.

### Step 4 — Frontend: `auditModel.ts` — aggiungere caso `'prep'` nel loop CRM (righe 178–190)

Nel loop che popola `crmUsatiInWork`, aggiungere il caso `source_type='prep'`: risalire al CRM Neat tramite `source_composto_id` e aggiungerlo alla mappa:

```typescript
} else if (ing.source_type === 'prep') {
  // CRM Neat: risali al composto padre tramite source_composto_id
  const found = crmItems.find(c => c.id === ing.source_composto_id)
  if (found) crmUsatiInWork.set(String(found.id), found)
}
```

---

## Verifica end-to-end

1. Aprire il dashboard audit
2. Selezionare un metodo con work che usano CRM Neat (prep stock)
3. Verificare che la colonna "CRM sottostanti" mostri il CRM Neat per gli analiti coperti via prep
4. Verificare che gli analiti coperti via Neat non appaiano nelle righe "Scoperto"
5. Verificare che work con solo CRM normali (non Neat) siano invariate
