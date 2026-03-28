# Piano: Gestione Lotti Work + Work Sharing tra Metodi

**Data:** 2026-03-24
**Scope:** Feature A (lotti/blocco/ricarica) + Feature B (condivisione work tra metodi, design)

---

## Context

Quando un CRM cambia lotto (il vecchio viene dismesso e ne viene creato uno nuovo), le work che lo referenziano diventano invalide. L'operatore non deve poter fare preparazioni con lotti dismessi. Il sistema deve:
1. Bloccare le preparazioni delle work con CRM dismessi
2. Mostrare warning in WorkPage e SchemaCalibrazione
3. Permettere di "ricaricare" lo schema (creare nuova work con lotti attuali, archiviare la vecchia)
4. (Feature B, più difficile) Condividere work identiche tra più metodi

**Stato attuale rilevante:**
- `work_ingredienti.source_id` referenzia `composti.id` ma NON snapshotta il lotto al momento della creazione
- `work` table: nessun meccanismo di archiviazione (nessun soft-delete)
- `work_metodi` molti-a-molti EXISTS in DB ma nessuna UI per condivisione
- SchemaCalibrazione: CrmItem ha campo `lotto` ma non è visibile nella griglia
- WorkPage: nessun warning per lotti dismessi, nessun blocco preparazioni

---

## File critici

- [src/shared/types.ts](src/shared/types.ts) — interfacce Work, WorkIngrediente
- [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts) — tutti gli handler IPC
- [src/renderer/lib/api.ts](src/renderer/lib/api.ts) — workApi client
- [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx)
- [src/renderer/pages/work/WorkDrawer.tsx](src/renderer/pages/work/WorkDrawer.tsx)
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx)
- [src/renderer/pages/metodi/SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts)

---

## Feature A: Lotti + Blocco + Ricarica Schema

### Step 1 — Migrazione DB (`src/main/migrations/017-work-lot-snapshot.sql`)

```sql
ALTER TABLE work_ingredienti ADD COLUMN lotto_usato TEXT;

ALTER TABLE work ADD COLUMN archiviato        INTEGER DEFAULT 0;
ALTER TABLE work ADD COLUMN archiviato_at     TEXT;
ALTER TABLE work ADD COLUMN archiviato_motivo TEXT;
ALTER TABLE work ADD COLUMN sostituito_da_id  INTEGER REFERENCES work(id);

CREATE INDEX IF NOT EXISTS idx_work_archiviato ON work(archiviato);
```

- `lotto_usato`: snapshot del lotto CRM al momento della creazione della work
- `archiviato + archiviato_at + archiviato_motivo`: soft-delete
- `sostituito_da_id`: link old→new per audit trail

### Step 2 — Tipi TypeScript (`src/shared/types.ts`)

**WorkIngrediente** — aggiungere:
```typescript
lotto_usato: string | null          // snapshot lotto alla creazione
source_dismissione?: string | null  // data_dismissione attuale da composti (joined)
```

**Work** — aggiungere:
```typescript
archiviato?: number
archiviato_at?: string | null
archiviato_motivo?: string | null
sostituito_da_id?: number | null
bloccata?: boolean                  // true se almeno 1 CRM ingrediente è dismesso
```

**Nuovo tipo** `WorkIngredienteLotStatus`:
```typescript
export interface WorkIngredienteLotStatus {
  id: number; source_id: number; nome: string
  lotto_usato: string | null; lotto_corrente: string | null
  data_dismissione: string | null
  stato: 'ok' | 'auto' | 'ambiguo' | 'mancante'
  sostituti: Array<{ id: number; lotto: string | null; concentrazione: number | null; unita_conc: string }>
}
```

### Step 3 — Backend `work.ipc.ts`

**`work:create` e `work:update`** — popolare `lotto_usato`:
- Dentro la transazione, prima di inserire ogni ingrediente `source_type='crm'`: `SELECT lotto FROM composti WHERE id = ?`
- Aggiungere `lotto_usato` nell'INSERT statement di `work_ingredienti`

**`work:list`** — filtro archiviati + flag bloccata:
- Aggiungere `WHERE w.archiviato = 0` (o IS NULL per retrocompatibilità)
- Subquery: `SELECT COUNT(*) FROM work_ingredienti wi JOIN composti c ON c.id = wi.source_id WHERE wi.work_id = w.id AND wi.source_type='crm' AND c.data_dismissione IS NOT NULL` → `n_ingredienti_bloccati`
- Mapping JS: `bloccata: w.n_ingredienti_bloccati > 0`

**`work:get`** — aggiungere per ogni ingrediente:
- `wi.lotto_usato`
- `(SELECT data_dismissione FROM composti WHERE id=wi.source_id) AS source_dismissione`

**Nuovo handler `work:archivia`**:
```typescript
UPDATE work SET archiviato=1, archiviato_at=datetime('now'), archiviato_motivo=? WHERE id=?
```

**Nuovo handler `work:check-lot-status`**:
- Per ogni ingrediente CRM della work: verifica se `data_dismissione IS NOT NULL`
- Se dismesso: cerca `composti` con stesso `nome` e `data_dismissione IS NULL`
- Ritorna array `WorkIngredienteLotStatus[]` con stato: `ok | auto | ambiguo | mancante`
  - `auto`: esattamente 1 sostituto attivo
  - `ambiguo`: >1 sostituti attivi
  - `mancante`: 0 sostituti

**Nuovo handler `work:ricarica`**:
- Parametri: `{ old_work_id, nuovi_ingredienti: [{old_source_id, new_source_id}], metodi_ids }`
- Transazione atomica:
  1. Crea nuova work con stessi campi (nome, conc, volume, solvente, validità, livello)
  2. Copia `work_ingredienti` con `source_id` sostituiti + `lotto_usato` aggiornato
  3. Inserisce in `work_metodi` per gli stessi metodi
  4. Archivia la vecchia work con motivo "Lotto dismesso — sostituito da work {newId}"
- Ritorna `{ ok: true, new_work_id }`

### Step 4 — `src/renderer/lib/api.ts`

Aggiungere a `workApi`:
```typescript
archivia: (id, motivo) => api.invoke('work:archivia', id, motivo),
checkLotStatus: (workId) => api.invoke('work:check-lot-status', workId),
ricarica: (params) => api.invoke('work:ricarica', params),
```

### Step 5 — WorkPage (`WorkPage.tsx`)

In `WorkCard`:
- Badge rosso "CRM dismessi" quando `work.bloccata`
- Disable "Prepara/Rinnova" quando `work.bloccata`
- Pulsante "Ricarica lotti" (arancione outline) visibile quando `work.bloccata` → apre `RicaricaDialog`

In `WorkPage`:
- Stato `[ricaricaWorkId, setRicaricaWorkId]`
- Monta `<RicaricaDialog>` in fondo alla pagina
- On success: ricarica la lista works

### Step 6 — WorkDrawer (`WorkDrawer.tsx`)

- Banner arancione quando `work.bloccata`: "Uno o più lotti CRM sono stati dismessi. Le preparazioni sono bloccate."
- Disable pulsante "Registra/Rinnova preparazione" quando `work.bloccata`
- In sezione Composizione: per ogni ingrediente con `source_dismissione !== null` → tag rosso "Lotto dismesso" + riga `lotto_usato` in font mono piccolo
- Fix bug `metodi_ids`: cambiare condizione da `work.metodi` a `work.metodi_ids` e renderizzare come Badge

### Step 7 — Nuovo componente `RicaricaDialog.tsx`

`src/renderer/pages/work/RicaricaDialog.tsx`

Flusso:
1. Apre → chiama `workApi.checkLotStatus(workId)` + `workApi.get(workId)` per i `metodi_ids`
2. Mostra per ogni ingrediente:
   - `ok`: lista verde compatta
   - `auto`: "Lotto {vecchio} → {nuovo}" (automatico, grigio)
   - `ambiguo`: `<select>` dropdown con scelta tra sostituti (nome lotto + concentrazione)
   - `mancante`: warning rosso "Nessun lotto attivo per {nome}" — il pulsante Conferma resta disabilitato
3. Pulsante "Conferma e Ricarica": chiama `workApi.ricarica(...)` → `onSuccess(newWorkId)`

### Step 8 — SchemaCalibrazione (`SchemaCalibrazione.tsx`)

- Aggiungere `blockedMap: Map<number, boolean>` nello stato del componente
- `useEffect` che si attiva dopo il caricamento dello schema: per ogni work con `dbId`, chiama `workApi.get(dbId)` e popola la mappa
- In `ColonneWork` card: se `blockedMap.get(w.dbId)` → mostrare pulsante "Ricarica ↻" (arancione)
- Il pulsante apre `RicaricaDialog`; on success chiama `handleReloadSchema` per aggiornare la colonna

**Mostrare lotto in SchemaCalibrazione:** il `CrmItem` ha già il campo `lotto` — aggiungere riga piccola con lotto nelle chip CRM nella griglia (modifica minima in `SchemaCalibrazione.grid.tsx`)

---

## Feature B: Work Sharing tra Metodi (design, non implementare ora)

**Stato DB:** `work_metodi` many-to-many già esiste.

**Approccio UI proposto:**
- In SchemaCalibrazione: pulsante "Importa Work esistente" accanto a "Crea Work"
- Picker: mostra works dal DB filtrate per metodo corrente (escluse quelle già nello schema), con check che i CRM ingredienti siano compatibili con il metodo attuale
- Selezionando: crea `WorkInSchema` dal DB + aggiunge entry `work_metodi` per il metodo corrente
- Difficoltà principale: mappare i `source_id` DB (composti.id) agli oggetti `SorgenteSel` in memoria

**Fix WorkDrawer metodi:** `work:get` può unire `metodi` table: `SELECT m.id, m.nome FROM metodi m JOIN work_metodi wm ON wm.metodo_id=m.id WHERE wm.work_id=?` → ritorna `metodi: {id, nome}[]` invece di `metodi_ids`

---

## Ordine di implementazione

| # | Step | Dipende da |
|---|------|-----------|
| 1 | Migrazione DB (017) | — |
| 2 | TypeScript types | 1 |
| 3 | Backend create/update (lotto_usato) | 1 |
| 4 | Backend list/get (bloccata flag) | 1 |
| 5 | Backend archivia + check-lot-status + ricarica | 1, 3, 4 |
| 6 | api.ts additions | 5 |
| 7 | WorkPage + WorkDrawer UI | 4, 6 |
| 8 | RicaricaDialog | 5, 6, 7 |
| 9 | SchemaCalibrazione (blockedMap + pulsante Ricarica) | 4, 6, 8 |

---

## Verifica end-to-end

1. Creare una work da SchemaCalibrazione → verificare in DB che `work_ingredienti.lotto_usato` sia popolato
2. Impostare `data_dismissione` su un CRM usato da quella work → verificare che WorkPage mostri badge "CRM dismessi" e il pulsante "Prepara" sia disabilitato
3. Aprire WorkDrawer → verificare banner arancione e tag "Lotto dismesso" sull'ingrediente
4. Cliccare "Ricarica lotti" → verificare dialog con ingrediente in stato `auto` (1 sostituto) o `ambiguo`
5. Confermare ricarica → verificare nuova work creata, vecchia archiviata, WorkPage aggiornata
6. Aprire SchemaCalibrazione del metodo → verificare pulsante "Ricarica" sulla work column bloccata
