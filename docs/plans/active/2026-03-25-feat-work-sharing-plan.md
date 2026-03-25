# Feature B: Work Sharing tra Metodi — Importa Work Esistente

## Context

Una work (soluzione di lavoro) può servire più metodi analitici. L'infrastruttura DB (`work_metodi` molti-a-molti) è già pronta, ma manca l'UI per importare una work esistente (creata in un altro metodo) nello schema di calibrazione corrente. Questa feature permette il riutilizzo senza duplicare work identiche.

---

## File da modificare

| File | Cosa |
|------|------|
| `src/main/ipc/work.ipc.ts` | 2 nuovi handler IPC |
| `src/renderer/lib/api.ts` | 2 nuovi metodi in `workApi` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | 2 funzioni: ricostruzione + compatibilità |
| `src/renderer/pages/metodi/ImportaWorkDialog.tsx` | **Nuovo file** — dialog di importazione |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Stato + bottone + render dialog (~3 punti chirurgici) |

---

## Step 1 — Backend: 2 nuovi handler IPC

**File:** `src/main/ipc/work.ipc.ts`

### `work:list-for-import(metodoId)`
Ritorna tutte le work non-archiviate NON già collegate al metodo corrente, con ingredienti allegati.

```sql
SELECT w.*,
  (SELECT GROUP_CONCAT(wm.metodo_id) FROM work_metodi wm WHERE wm.work_id = w.id) AS metodi_csv
FROM work w
WHERE (w.archiviato = 0 OR w.archiviato IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM work_metodi wm2 WHERE wm2.work_id = w.id AND wm2.metodo_id = ?
  )
ORDER BY w.created_at DESC
```

Per ogni work, allega `ingredienti` (join su `composti.nome` / `work.nome` per `source_nome`).

### `work:add-to-metodo(workId, metodoId)`
Una sola riga:
```sql
INSERT OR IGNORE INTO work_metodi (work_id, metodo_id) VALUES (?, ?)
```
Ritorna `{ ok: true }`.

---

## Step 2 — API layer

**File:** `src/renderer/lib/api.ts` — aggiungere a `workApi` (riga ~119):

```typescript
listForImport: (metodoId: string) =>
  api.invoke('work:list-for-import', metodoId) as Promise<any[]>,
addToMetodo: (workId: number, metodoId: string) =>
  api.invoke('work:add-to-metodo', workId, metodoId) as Promise<{ ok: boolean }>,
```

---

## Step 3 — Logica di ricostruzione e compatibilità

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

### `verificaCompatibilitaCrm(dbWork, crmItems)`
Per ogni ingrediente `source_type='crm'`, verifica che `source_id` esista in `crmItems`. Ritorna `{ compatibile: boolean, mancanti: string[] }`.

### `ricostruisciWorkInSchema(dbWork, crmItems, workColsFlat)`
Converte un record DB in `WorkInSchema`:

1. **Genera `id`** con `nanoid()`, imposta `dbId = dbWork.id`
2. **Ricostruisci `srcs: SorgenteSel[]`** dagli ingredienti:
   - `source_type='crm'` → cerca CrmItem per `source_id`:
     - Se ha `mix_id` → `SorgenteSel { tipo:'mix', id: mix_id }` (deduplicare per mix_id)
     - Se non ha `mix_id` → `SorgenteSel { tipo:'sng', id: String(source_id) }`
   - `source_type='work'` → cerca in `workColsFlat` per `dbId === source_id`:
     - Se trovato → `SorgenteSel { tipo:'work', id: existingWork.id, colSrc }`
     - Se non trovato → **incompatibile** (work dipendente mancante)
3. **Ricostruisci `vols: Ingrediente[]`** — uno per SorgenteSel, con `vol`, `concTarget`, `dilFactor`, `modo` dal primo ingrediente del gruppo
4. **Mappa campi restanti**: `nome`, `conc`, `concVariabile`, `unitaConc`, `volFin`, `solv`, `validitaMesi`, `op`

---

## Step 4 — ImportaWorkDialog (nuovo componente)

**File:** `src/renderer/pages/metodi/ImportaWorkDialog.tsx`

### Props
```typescript
interface ImportaWorkDialogProps {
  open: boolean
  metodoId: string
  crmItems: CrmItem[]
  workCols: WorkInSchema[][]
  onClose: () => void
  onImported: (work: WorkInSchema, colIdx: number) => void
}
```

### Flusso UI
1. **Apertura** → chiama `workApi.listForImport(metodoId)` → popola lista
2. **Lista filtrata** — campo di ricerca per nome. Ogni riga mostra:
   - Nome (bold) + concentrazione + unità + volume
   - Chip metodi associati (piccoli)
   - N. ingredienti
3. **Selezione** → esegue `verificaCompatibilitaCrm` → mostra esito:
   - Verde: "Tutti i CRM compatibili"
   - Rosso: "CRM mancanti: X, Y" + pulsante Importa disabilitato
4. **Importa** →
   - `workApi.addToMetodo(workId, metodoId)` — link DB
   - `ricostruisciWorkInSchema(...)` — costruisce `WorkInSchema`
   - Determina `colIdx` (= 0 per work lv0, oppure colonna in base alle dipendenze)
   - `onImported(work, colIdx)`

### Filtraggio works già nello schema
Oltre al filtro DB (`NOT EXISTS work_metodi`), filtrare anche le work il cui `dbId` è già presente in `workCols` (potrebbe essere già nello schema ma non linkato al metodo).

### Edge case: work con dipendenze da altre work
Prima iterazione: se una work ha `source_type='work'` e la dipendenza non è in `workCols`, mostrare avviso "Questa work dipende da {nome_dipendenza} che non è presente nello schema. Importala prima." e disabilitare il pulsante.

---

## Step 5 — Integrazione in SchemaCalibrazione.tsx

**3 modifiche chirurgiche:**

### 5a. Stato (riga ~647)
```typescript
const [importOpen, setImportOpen] = useState(false)
```

### 5b. Handler (dopo handleSaveWork)
```typescript
const handleImportWork = useCallback((work: WorkInSchema, colIdx: number) => {
  setWorkCols(prev => {
    const cols = prev.map(c => [...c])
    while (cols.length <= colIdx) cols.push([])
    cols[colIdx] = [...cols[colIdx], work]
    if (cols.length <= colIdx + 1) cols.push([])
    return cols
  })
  setImportOpen(false)
}, [])
```

### 5c. Bottone + Dialog (riga ~989-1002)
Bottone "Importa Work" accanto a "+ Crea Work" (sempre abilitato, a differenza di Crea Work che richiede selezione sorgenti).

```tsx
<button onClick={() => setImportOpen(true)} style={{...}}>
  Importa Work
</button>

<ImportaWorkDialog
  open={importOpen}
  metodoId={metodoId}
  crmItems={crmItems}
  workCols={workCols}
  onClose={() => setImportOpen(false)}
  onImported={handleImportWork}
/>
```

L'auto-save su `workCols` (useEffect riga 661-667) persiste automaticamente la work importata.

---

## Verifica end-to-end

1. Creare una work nello schema del Metodo A (con validitaMesi > 0)
2. Aprire lo schema del Metodo B → cliccare "Importa Work"
3. Verificare che la work del Metodo A appaia nella lista
4. Selezionarla → verificare check compatibilità CRM (verde se i CRM corrispondono)
5. Importarla → verificare:
   - Card appare nella colonna corretta dello schema
   - Connessioni SVG si disegnano verso i CRM corretti
   - `work_metodi` ha il nuovo link (Metodo B)
   - Ricaricando la pagina, la work persiste nello schema
6. In WorkDrawer della work: verificare che mostri sia Metodo A che Metodo B
