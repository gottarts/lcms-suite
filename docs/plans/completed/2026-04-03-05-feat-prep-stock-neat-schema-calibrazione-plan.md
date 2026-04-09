# Piano: Preparazioni Stock come Sorgenti nei CRM Neat (Schema Calibrazione)

## Context

I CRM di forma "Neat" sono sostanze pure (solide o liquide) senza una concentrazione in soluzione direttamente utilizzabile. Per usarli come sorgente di una work di calibrazione, l'operatore deve prima preparare una **soluzione stock** (pesata + calcolo concentrazione reale), che viene già registrata nella tabella `preparazioni` via la pagina DB Composti.

Attualmente nello schema di calibrazione i CRM Neat appaiono nella colonna "Singoli / Neat" con `cv = concentrazione` (che per un Neat è la concentrazione nominale, non utilizzabile direttamente), e sono selezionabili come sorgenti di work come se fossero Solution. Questo è scorretto.

**Obiettivo:** Quando un CRM è Neat, mostrare nella colonna le sue preparazioni stock attive (da tabella `preparazioni`) come sorgenti selezionabili al posto del CRM stesso. Se non ci sono prep stock attive, mostrare il CRM disabilitato con un link alla pagina DB Composti.

---

## Approccio

### 1. Nuovo tipo sorgente `'prep'` in SchemaCalibrazione.types.ts

Aggiungere `'prep'` a `SorgenteTipo` e al tipo `WorkIngrediente` nel backend:

```typescript
// SchemaCalibrazione.types.ts
export type SorgenteTipo = 'mix' | 'sng' | 'work' | 'prep'

// Estendere CrmItem con le sue preparazioni stock
export interface CrmItem {
  // ... campi esistenti ...
  prepStock?: PrepStockItem[]  // solo per Neat
}

export interface PrepStockItem {
  id: number
  flacone: string | null
  concReale: number | null
  concTarget: number | null
  unitaConc: string
  scadenza: string | null
  dataDismissione: string | null
}
```

### 2. Migration DB: `source_type` in `work_ingredienti` esteso a `'prep'`

**File:** `src/main/migrations/019-work-ingredienti-prep.sql`

```sql
-- SQLite non supporta ALTER COLUMN CHECK, si ricrea la tabella
-- Aggiunge support per source_type = 'prep' (preparazione stock da CRM Neat)
-- e prep_id come snapshot dell'id della preparazione usata
ALTER TABLE work_ingredienti ADD COLUMN prep_id INTEGER REFERENCES preparazioni(id);
-- La CHECK su source_type è già permissiva in SQLite (non enforcement runtime),
-- quindi basta aggiornare la logica applicativa.
```

> Nota: SQLite non fa enforcement delle CHECK constraint a runtime, quindi non serve ricreazione tabella — basta aggiungere `prep_id` e aggiornare la logica.

### 3. Nuovo IPC handler: `preparazioni:list-for-schema`

**File:** `src/main/ipc/preparazioni.ipc.ts`

Aggiungere handler che carica, per un dato `composto_id`, le preparazioni attive (non dismesse, non scadute):

```typescript
ipcMain.handle('preparazioni:list-for-schema', (_, compostoId: number) => {
  const oggi = new Date().toISOString().slice(0, 10)
  return db.prepare(`
    SELECT id, flacone, concentrazione_reale, concentrazione_target, unita_conc,
           scadenza, data_dismissione
    FROM preparazioni
    WHERE composto_id = ?
      AND data_dismissione IS NULL
      AND (scadenza IS NULL OR scadenza >= ?)
    ORDER BY data_prep DESC
  `).all(compostoId, oggi)
})
```

### 4. `useSchemaData()` carica le prep stock per i CRM Neat

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

Dopo aver costruito `crmItems`, per ogni item con `forma === 'Neat'` (e `mix_id === null`), fare una chiamata `preparazioni:list-for-schema` e popolare `crm.prepStock[]`.

```typescript
// Dopo linea ~165 in useSchemaData()
for (const crm of items) {
  if (crm.mix_id === null && String(crm.forma ?? '').toLowerCase() === 'neat') {
    const rows = await invoke('preparazioni:list-for-schema', crm.id)
    crm.prepStock = rows.map((r: any) => ({
      id: r.id,
      flacone: r.flacone ?? null,
      concReale: r.concentrazione_reale ?? null,
      concTarget: r.concentrazione_target ?? null,
      unitaConc: r.unita_conc ?? 'mg/L',
      scadenza: r.scadenza ?? null,
      dataDismissione: r.data_dismissione ?? null,
    }))
  }
}
```

### 5. Griglia: rendering Neat con prep stock

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`

Nella mappa `a.sngIds.map(sngId => ...)` (intorno alla linea 300):

- Se `crm.forma?.toLowerCase() === 'neat'`:
  - Se `crm.prepStock` è vuoto → mostrare la card del CRM disabilitata (opacity ridotta, non cliccabile) con un bottone "Crea prep stock ↗" che chiama `onOpenComposto(crm.id)` (funzione già esistente usata per il bottone "↗")
  - Se `crm.prepStock` ha elementi → mostrare la card del CRM come header non-selezionabile (grigio/neutro) + sotto, per ogni prep stock, una sub-card selezionabile con:
    - concentrazione reale (o target se reale assente) in mg/L
    - flacone (se presente)
    - scadenza
    - Stesso stile della card sng (verde) ma con un indicatore visivo "P" o "Stock" per distinguerla

- Le prep stock selezionabili hanno id = `"prep_${prep.id}"` nella mappa `selSrcs`

### 6. SorgenteSel per prep stock

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.types.ts`

```typescript
export interface SorgenteSel {
  id: string        // "prep_123" per prep stock, numero stringa per crm/work
  nome: string
  cv: number        // concReale ?? concTarget
  tipo: SorgenteTipo
  colSrc?: number
  concVariabile?: boolean
  prepId?: number   // populated quando tipo === 'prep'
}
```

### 7. `salvaWorkNelDb()`: gestione sorgenti 'prep'

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

Nella funzione `salvaWorkNelDb()` (intorno alla linea 356), aggiungere il ramo per `tipo === 'prep'`:

```typescript
} else if (src.tipo === 'prep') {
  return [{
    source_type: 'prep' as const,
    source_id: src.prepId!,   // id della preparazione
    volume_prelievo_ml: ing.vol,
    fattore_diluizione: ing.dilFactor ?? null,
    conc_target_mgL: ing.concTarget ?? null,
    modo_calcolo: ing.modo,
  }]
}
```

### 8. Backend `work:create`: gestisce `source_type = 'prep'`

**File:** `src/main/ipc/work.ipc.ts`

- Aggiornare il tipo del parametro `ingredienti` per accettare `source_type: 'crm' | 'work' | 'prep'`
- Nel loop di inserimento (intorno alla linea 261), quando `source_type === 'prep'`:
  - Recuperare `flacone` dalla preparazione come snapshot lotto (analogo al `lotto` del CRM)
  - Salvare `prep_id` nella nuova colonna di `work_ingredienti`

```typescript
// Aggiornare getLotto per gestire prep
if (ing.source_type === 'prep') {
  const row = db.prepare('SELECT flacone, concentrazione_reale FROM preparazioni WHERE id = ?').get(ing.source_id) as any
  lottoUsato = row?.flacone ?? null
  // Aggiungere prep_id
}
// Aggiornare insertIngr per includere prep_id
```

### 9. `work:check-lot-status` e `work:ricarica`: aggiornare per `'prep'`

**File:** `src/main/ipc/work.ipc.ts`

- `work:check-lot-status` (linea ~440): ignorare gli ingredienti `source_type='prep'` nella verifica lotti CRM (le prep hanno la propria scadenza gestita separatamente) — o mostrare avviso se la prep è scaduta/dismessa
- `work:ricarica`: non toccare ingredienti prep (non hanno sostituti automatici)

### 10. `WorkDrawer.tsx`: visualizzazione ingredienti prep

**File:** `src/renderer/pages/work/WorkDrawer.tsx`

Nel componente `ChainNode`, aggiungere gestione per `src.tipo === 'prep'`:
- Mostrare con pallino dello stesso colore di `sng` (verde)
- Label: nome CRM + "(stock)" o flacone
- Concentrazione: cv in mg/L

---

## File critici da modificare

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | `SorgenteTipo`, `CrmItem`, `SorgenteSel` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `useSchemaData()`, `salvaWorkNelDb()` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rendering Neat con prep stock |
| `src/main/ipc/preparazioni.ipc.ts` | Nuovo handler `preparazioni:list-for-schema` |
| `src/main/ipc/work.ipc.ts` | `work:create`, `work:check-lot-status`, `work:ricarica` |
| `src/main/migrations/019-work-ingredienti-prep.sql` | Nuova colonna `prep_id` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Visualizzazione ingredienti prep |

---

## Ordine di implementazione

1. Migration SQL `019-work-ingredienti-prep.sql`
2. `SchemaCalibrazione.types.ts` — tipi aggiornati
3. `preparazioni.ipc.ts` — nuovo handler
4. `SchemaCalibrazione.logic.ts` — caricamento prep stock in `useSchemaData()` + `salvaWorkNelDb()`
5. `SchemaCalibrazione.grid.tsx` — rendering Neat
6. `work.ipc.ts` — gestione `source_type='prep'` in create/check/ricarica
7. `WorkDrawer.tsx` — visualizzazione ingredienti prep

---

## Verifica end-to-end

1. Aprire un metodo con un CRM Neat associato
2. Nella tab Schema Calibrazione:
   - Se il Neat ha prep stock attive → le card stock appaiono nella colonna "Singoli / Neat" sotto il nome del CRM, selezionabili
   - Se non ha prep stock → il CRM appare disabilitato con bottone "Crea prep stock ↗"
3. Selezionare una prep stock → si comporta come sorgente sng per il calcolo del cv
4. Creare una work con sorgente prep → si salva in DB con `source_type='prep'` e `prep_id`
5. Aprire WorkDrawer → la catena mostra il nome CRM + "(stock)" come sorgente
6. Verificare `work:check-lot-status` non rompe per ingredienti prep
