# Piano: WorkDrawer identico a DrawerDettaglioWork

## Context

Il drawer delle work in WorkPage mostra solo metadati base, una tracciabilità semplificata e una composizione che espone `conc_target_mgL` raw invece delle concentrazioni finali calcolate. L'utente richiede che il drawer di WorkPage sia **identico** a `DrawerDettaglioWork` di SchemaCalibrazione: stessa tabella volumi, stessa catena tracciabilità ricorsiva, stessa lista composti con concentrazioni finali.

Le work in WorkPage sono versioni congelate di quelle negli schemi: tutti i dati calcolati (volumi di prelievo, fattori di diluizione, concentrazioni target) sono già memorizzati in `work_ingredienti`. Non servono ricalcoli, solo ricostruzione degli oggetti `WorkInSchema` dai dati DB.

Esiste già `ricostruisciWorkInSchema()` in `SchemaCalibrazione.logic.ts` che fa esattamente questo, ma richiede `CrmItem[]` precaricati. La soluzione è aggiungere i dati CRM necessari alla query `work:get`, poi ricostruire `WorkInSchema` in WorkDrawer.

---

## File critici da modificare

1. `src/main/ipc/work.ipc.ts` — aggiunta campi alla query `work:get`
2. `src/renderer/pages/work/WorkDrawer.tsx` — sostituzione sezioni tracciabilità e composizione

## File da importare (sola lettura)

- `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — `getCompsFromWork`, `CompostoInWork`
- `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` — `WorkInSchema`, `SorgenteSel`, `Ingrediente`, `CrmItem`, `C`

---

## Implementazione

### Step 1 — `work.ipc.ts`: aggiunta campi alla query ingredienti di `work:get`

Aggiungere 4 colonne al SELECT della query ingredienti (già fa JOIN su `composti`):

```sql
CASE WHEN wi.source_type = 'crm' THEN (SELECT concentrazione FROM composti WHERE id = wi.source_id) ELSE NULL END AS source_cv,
CASE WHEN wi.source_type = 'crm' THEN (SELECT mix_id       FROM composti WHERE id = wi.source_id) ELSE NULL END AS source_mix_id,
CASE WHEN wi.source_type = 'crm' THEN (SELECT mix          FROM composti WHERE id = wi.source_id) ELSE NULL END AS source_mix_nome,
CASE WHEN wi.source_type = 'crm' THEN (SELECT unita_conc   FROM composti WHERE id = wi.source_id) ELSE NULL END AS source_unita_conc
```

Il campo esistente `source_mix` (= `forma_commerciale`) rimane per compatibilità con il display esistente.

### Step 2 — `WorkDrawer.tsx`: caricamento catena e ricostruzione WorkInSchema

**Nuovo stato:**
```typescript
const [workChain, setWorkChain] = useState<Map<number, any>>(new Map())
```

**Caricamento ricorsivo nella `reload()`:**
```typescript
async function loadChain(id: number, map: Map<number, any>) {
  if (map.has(id)) return
  const w = await workApi.get(id)
  if (!w) return
  map.set(id, w)
  for (const ing of w.ingredienti ?? []) {
    if (ing.source_type === 'work') await loadChain(ing.source_id, map)
  }
}
```

**Helper `buildCrmItems(allDbWorks)`** — estrae `CrmItem[]` dagli ingredienti di tutte le work nella catena:
- Deduplica per `source_id`
- Imposta `concVariabile` se mix ha componenti con cv diversi
- Usa `source_cv`, `source_mix_id`, `source_mix_nome`, `source_unita_conc` dai dati ingrediente

**Helper `buildWorkSchema(dbWork, allDbWorks)`** — costruisce `WorkInSchema` da record DB:
- Per ogni ingrediente CRM: raggruppa i mix per `source_mix_id` (usa `seenMix`), crea `SorgenteSel` con `tipo='mix'` o `tipo='sng'`, crea `Ingrediente` con `vol`, `concTarget`/`dilFactor`, `modo`
- Per ogni ingrediente work: richiama ricorsivamente `buildWorkSchema` per trovare il `WorkInSchema` dipendente, crea `SorgenteSel` con `tipo='work'`
- Usa `id: String(dbWork.id)` come id locale (così `workCols` è ricercabile per id)
- **Nessun nuovo calcolo**: tutti i valori (vol, concTarget, dilFactor, modo) sono già in DB

**`workCols`** — array flat a colonna singola: `[[...allWorkSchemas]]` con tutti gli schemi ricostruiti, in modo che `getCompsFromWork` e `ChainNode` possano trovare le dipendenze per id.

### Step 3 — `WorkDrawer.tsx`: sostituzione sezioni rendering

Mantenere **invariate**: badge stato, sezione preparazione, sezione dettagli, metodi associati, azioni (Modifica/Elimina).

**Sostituire** le sezioni "Sorgenti/Tracciabilità" e "Composizione" con:

#### Tabella volumi (copiata da DrawerDettaglioWork)
```
| Sorgente | Diluizione | Preleva (mL) |
per ogni v in workSchema.vols: nome | dilFactor o concTarget | vol.toFixed(3)
+ riga solvente con volume di completamento
+ riga "Totale prelievi"
+ warning se prelievi > volume finale
```

#### Catena tracciabilità (ChainNode identica a DrawerDettaglioWork)
- Nodo root: la work corrente (dot arancione, nome, conc/vol)
- Per ogni `src` in `workSchema.srcs`:
  - Se `tipo='work'`: `ChainNode` ricorsivo trovando il lavoro in `workCols`
  - Se `tipo='mix'` o `tipo='sng'`: foglia CRM (dot verde, nome, cv o "variabile")

#### Lista composti (getCompsFromWork identico a DrawerDettaglioWork)
```typescript
const allComps = getCompsFromWork(workSchema, workCols, crmItems)
// Render: nome + srcPath + concInWork.toFixed(4) unita
```
Con campo di ricerca/filtro per nome composto.

### Import da aggiungere in WorkDrawer
```typescript
import { getCompsFromWork } from '../metodi/SchemaCalibrazione.logic'
import type { WorkInSchema, SorgenteSel, Ingrediente, CrmItem } from '../metodi/SchemaCalibrazione.types'
import { C } from '../metodi/SchemaCalibrazione.types'
```

---

## Flusso dati completo

```
workApi.get(id) → ingredienti con source_cv, source_mix_id, source_mix_nome, source_unita_conc
  ↓ (per ogni work-type ingredient)
workApi.get(source_id) → ingredienti... (ricorsivo)
  ↓
buildCrmItems(workChain) → CrmItem[]
buildWorkSchema(work, workChain) → WorkInSchema (con srcs, vols)
  ↓
workCols = [[...allWorkSchemas]]
  ↓
getCompsFromWork(workSchema, workCols, crmItems) → CompostoInWork[]  (identico a SchemaCalibrazione)
ChainNode rendering  (identico a DrawerDettaglioWork)
```

---

## Verifica

1. Aprire una work dal DB che ha ingredienti CRM singoli → verificare tabella volumi, tracciabilità, concentrazioni
2. Aprire una work con CRM mix → verificare che i componenti del mix appaiano nella lista composti con concentrazioni calcolate
3. Aprire una work che dipende da un'altra work (catena) → verificare che la catena tracciabilità mostri entrambi i livelli
4. Confrontare visivamente WorkDrawer vs DrawerDettaglioWork sullo stesso set di dati → devono corrispondere
