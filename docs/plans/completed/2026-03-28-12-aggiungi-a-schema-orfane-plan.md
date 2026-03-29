# Piano: "Aggiungi a Schema" per Work Orfane + Valutazione Sistema

**Data:** 2026-03-28
**Piano salvato in:** `docs/plans/active/2026-03-28-aggiungi-a-schema-orfane-plan.md`

---

## Context

Una **work orfana** (`primo_metodo_id = NULL`) non ha nessun pulsante "Schema ↗" in WorkPage. L'unico modo per collegarla a uno schema è dall'interno di SchemaCalibrazione tramite `ImportaWorkDialog`, che però:
1. Filtra per analiti condivisi → potrebbe non mostrare la work
2. Richiede di navigare prima allo schema giusto a mano
3. Non è accessibile dalla WorkPage

La feature richiesta: dalla WorkCard orfana, un pulsante "Aggiungi a Schema ↗" apre un dialog che permette di selezionare uno schema, verifica la compatibilità, aggiunge la work al canvas e salva — senza ricreare la work nel DB, solo aggiungendo il link.

---

## Valutazione stato sistema (summa sessioni recenti)

### ✅ Flow operativi funzionanti
- **Bloccata → Ricarica**: work con CRM dismessi → badge rosso → nav a schema → RicaricaDialog → nuova work + archivia vecchia. Flow robusto, testato.
- **Import tra metodi**: `ImportaWorkDialog` + analiti comuni + CRM check. Funziona per work già collegate.
- **Archiviazione esplicita**: pulsante "Archivia" in WorkDrawer. Corretto da sessione 2026-03-28.
- **Extra analiti fuori schema**: `extraSrcs` + chip ambra ⚠ in DrawerDettaglioWork. Parzialmente implementato.
- **Sincronizzazione work_metodi ↔ schema_json**: cleanup spurie in `schema-cal:get` e `schema-cal:save`. Stabile.

### 🔴 Problemi aperti rilevanti
1. **Work orfane senza percorso di aggancio** — il problema principale di questa sessione.
2. **Tabella volumi extra incompleta** (DrawerDettaglioWork): `extraSrcs` vengono raccolte ma le righe della tabella "Volumi di prelievo" non includono ingredienti extra; `usedVol` risulta errato se ci sono sorgenti fuori schema. Bug visivo, non bloccante. *Incluso in questa sessione come fix secondario.*
3. **`work:list-for-import` filtro WIP**: mostra work senza metodi associati come importabili. Fix semplice, incluso.

### 🟡 Rimandati a sessioni future
- Archivio schemi calibrazione (versioning storico)
- Filtro per metodo in WorkPage
- `salvaWorkNelDb` che chiama sempre `work:create` invece di `work:update` per modifiche parametri-only

---

## Soluzione proposta: AggiungiASchemaDialog

### Flusso utente
```
WorkCard orfana (primo_metodo_id = null)
  ↓
Nuovo pulsante "Aggiungi a Schema ↗"
  ↓
AggiungiASchemaDialog:
  - Lista tutti i metodi (metodiApi.list())
  - Selezione metodo
  - Caricamento schema + CRM del metodo selezionato
  - Ricostruzione WorkInSchema via ricostruisciWorkInSchema()
  - Mostra warnings: CRM extra, dipendenze work mancanti
  ↓
Conferma:
  1. workApi.addToMetodo(workId, metodoId) — link DB
  2. schemaCalApi.save() con workCols aggiornate — visual canvas
  3. navigate('/metodi', { schemaMetodoId: metodoId }) — navigazione
```

### Architettura tecnica

**Differenza da ImportaWorkDialog:**
- ImportaWorkDialog: è dentro SchemaCalibrazione, ha già crmItems e workCols in props, filtra per analiti comuni
- AggiungiASchemaDialog: è in WorkPage, deve caricare tutto da sola, NON filtra per analiti comuni (bypass del constraint — la work deve poter essere aggiunta a qualsiasi schema)

**Caricamento dati per lo schema selezionato:**
```typescript
// 1. Lista metodi
const metodi = await metodiApi.list()

// 2. Schema corrente del metodo selezionato
const schemaRaw = await schemaCalApi.get(metodoId)
const workCols: WorkInSchema[][] = schemaRaw ? JSON.parse(schemaRaw.schema_json).workCols : [[], []]
const removedCon: string[] = schemaRaw ? JSON.parse(schemaRaw.schema_json).removedCon ?? [] : []
const removedMix: string[] = schemaRaw ? JSON.parse(schemaRaw.schema_json).removedMix ?? [] : []

// 3. CRM disponibili per il metodo (stesso pattern di useSchemaData)
const crmRows = await (window as any).electronAPI.invoke('composti:list-for-schema', metodoId)
const crmItems: CrmItem[] = buildCrmItems(crmRows) // logica identica a useSchemaData linee 36-85

// 4. Work con ingredienti — VERIFICARE se work:get restituisce ingredienti
//    Se sì: workApi.get(workId)
//    Se no: aggiungere work:get-with-ingredienti o riusare work:list-for-import bypass
```

**⚠ Punto critico da verificare prima di implementare:**
Controllare in `src/main/ipc/work.ipc.ts` il handler `work:get` — se include `ingredienti` come fa `work:list-for-import`. Se no, aggiungere un parametro o endpoint dedicato.

**Ricostruzione WorkInSchema:**
```typescript
const workColsFlat = workCols.flat()
const rebuilt = ricostruisciWorkInSchema(dbWork, crmItems, workColsFlat, workCols)

// Colonna target (identico a ImportaWorkDialog linee 84-91)
let colIdx = 0
if (rebuilt.srcs.some(s => s.tipo === 'work')) {
  const maxCol = Math.max(...rebuilt.srcs.filter(s => s.tipo === 'work').map(s => s.colSrc ?? 0))
  colIdx = maxCol + 1
}
```

**Salvataggio:**
```typescript
const newWorkCols = workCols.map((col, i) => i === colIdx ? [...col, rebuilt] : col)
// Aggiungere colonna se colIdx >= workCols.length
await workApi.addToMetodo(workId, metodoId)
await schemaCalApi.save(metodoId, newWorkCols, removedCon, removedMix)
navigate('/metodi', { state: { schemaMetodoId: metodoId } })
```

---

## File da creare/modificare

| File | Azione | Dettaglio |
|------|--------|-----------|
| `src/renderer/pages/work/AggiungiASchemaDialog.tsx` | CREA | Nuovo dialog |
| `src/renderer/pages/work/WorkPage.tsx` | MODIFICA | Button su WorkCard orfana + state dialog |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | LEGGI | Estrarre helper buildCrmItems (linee 36-85 di useSchemaData) se serve |
| `src/main/ipc/work.ipc.ts` | VERIFICA/FIX | Handler `work:get` — include ingredienti? |
| `src/main/ipc/work.ipc.ts` | FIX | `work:list-for-import` — escludere work completamente orfane (senza metodi) |

---

## Fix secondario: Tabella volumi extra (DrawerDettaglioWork)

**Problema:** `extraSrcs` in WorkInSchema sono raccolte ma non renderizzate nella tabella "Volumi di prelievo" di `DrawerDettaglioWork` in SchemaCalibrazione.tsx. Il `usedVol` risulta errato quando ci sono sorgenti extra.

**Fix:** In `DrawerDettaglioWork` (SchemaCalibrazione.tsx), aggiungere righe per `work.extraSrcs` nella tabella volumi — con stile ambra, marcate con ⚠, usando i dati da `dbWork.ingredienti` (già fetchato nel drawer).

**Scope limitato:** Toccare solo la sezione tabella volumi in DrawerDettaglioWork, non la logica di caricamento.

---

## Fix terziario: work:list-for-import filtro WIP

**Problema:** La query include work orfane (senza `work_metodi` entries) come candidati all'import.

**Fix:** Aggiungere `AND EXISTS (SELECT 1 FROM work_metodi WHERE work_id = w.id)` alla query `work:list-for-import` — oppure semplificare: escludere work già prive di metodi (che avranno il loro percorso tramite AggiungiASchemaDialog).

---

## Ordine di implementazione

1. Verifica `work:get` IPC (ha ingredienti?)
2. Fix `work:list-for-import` filtro (piccolo, diretto)
3. `AggiungiASchemaDialog.tsx` (componente principale)
4. `WorkPage.tsx` wiring (button + state)
5. Fix tabella volumi extra in DrawerDettaglioWork (se tempo)

---

## Verifica end-to-end

1. Creare una work da WorkPage senza agganciare a nessuno schema
2. Verificare: WorkPage mostra "Aggiungi a Schema ↗" sulla card orfana
3. Cliccare → dialog apre, mostra lista metodi
4. Selezionare un metodo → compatibilità calcolata (CRM / dipendenze)
5. Confermare → navigazione automatica a SchemaCalibrazione
6. In SchemaCalibrazione: la work è visibile nel canvas
7. Salvare schema → riapri: work ancora presente, `primo_metodo_id` non più null
8. In WorkPage (dopo navigate back): la work non è più orfana, mostra "Schema ↗" normale
