# Piano — Criticità aperte sistema Work

**Data:** 2026-03-28
**Sessione precedente:** `2026-03-28-feat-flusso-operatore-blocco-ambiguita-resoconto-sessione.md`

## Context

Dopo le sessioni del 2026-03-28, rimangono 4 criticità aperte nel sistema Work:
1. Le work card in SchemaCalibrazione non mostrano lo stato lab (bloccata / CRM scaduti)
2. Eliminare una work dallo schema non la archivia nel DB → work orfane (duplicati accumulati)
3. Dead code in `salvaWorkNelDb` (linee 263-269) che non viene mai raggiunto
4. Pulsante "Vai allo Schema ↗" in WorkDrawer naviga sempre a `metodi_ids[0]`, ignorando work condivise tra più metodi

Issue 7 del resoconto (vincolo DB una work per slot) è esclusa: richiede DB migration, troppo architetturale per questa sessione.

---

## Fix 1 — Badge stato work in SchemaCalibrazione card

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

**Situazione attuale:**
- `blockedMap: Map<number, boolean>` è già popolata da un `useEffect` (linee 679-696) che chiama `workApi.get(id)` per ogni dbId in workCols
- `bloccata` è già estratto; `ha_crm_scaduti` è già nel tipo `Work` (shared/types.ts) ma ignorato

**Cambiamenti:**
1. Cambia tipo da `Map<number, boolean>` a `Map<number, { bloccata: boolean; haScaduti: boolean }>`
   - In `useState` (linea 654)
   - In `ColonneWorkProps.blockedMap` (linea 120)
   - Nel `useEffect` popolamento (linea 690): `map.set(w.id, { bloccata: !!w.bloccata, haScaduti: !!w.ha_crm_scaduti })`
2. In card rendering (linea 182): estrai entrambi:
   ```typescript
   const entry      = w.dbId ? (blockedMap.get(w.dbId) ?? null) : null
   const isBloccata = entry?.bloccata ?? false
   const haScaduti  = entry?.haScaduti ?? false
   ```
3. Aggiungi badge giallo sotto il badge rosso bloccata (simile a WorkCard in WorkPage):
   ```tsx
   {haScaduti && !isBloccata && (
     <div style={{ fontSize:9, color:'#92400e', fontWeight:600, marginTop:1 }}>
       ⚠ CRM scaduti
     </div>
   )}
   ```

---

## Fix 2 — Archivia work con dbId quando eliminata dallo schema

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

**Situazione attuale:**
`handleDeleteWork` (linea 813) rimuove la work dall'array in memoria ma non archivia il record DB. Risultato: ogni volta che si ricrea una work, il vecchio record resta attivo → duplicati orfani.

**Cambiamento in `handleDeleteWork`:**
```typescript
const handleDeleteWork = useCallback((colIdx: number, workIdx: number) => {
  setWorkCols(prev => {
    const cols = prev.map(c => [...c])
    const w    = cols[colIdx]?.[workIdx]
    const wid  = w?.id
    // Archivia il record DB se esiste
    if (w?.dbId) {
      workApi.archivia(w.dbId, 'Rimossa dallo schema').catch(() => {})
    }
    cols[colIdx].splice(workIdx, 1)
    ...
```

**Nota:** `workApi` è già importato in SchemaCalibrazione.tsx (usato per `workApi.get` nel useEffect).

---

## Fix 3 — Rimozione dead code in salvaWorkNelDb

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

**Linee da rimuovere (263-269 e 330-337):**
```typescript
// DA RIMUOVERE — w.dbId è sempre undefined quando chiamata da handleSaveWork
let vecchioIdBloccato: number | null = null
if (w.dbId) {
  const vecchia: any = await (window as any).electronAPI.invoke('work:get', w.dbId)
  if (vecchia?.bloccata) {
    vecchioIdBloccato = w.dbId
  }
}
```
e:
```typescript
// DA RIMUOVERE — vecchioIdBloccato è sempre null
if (vecchioIdBloccato && newId) {
  await (window as any).electronAPI.invoke(
    'work:archivia', vecchioIdBloccato,
    `Sostituita da work '${w.nome}' — lotti aggiornati`
  )
}
```

**Perché è dead code:** `handleSaveWork` chiama `salvaWorkNelDb(work, ...)` dove `work = { ...data, id }` con `data: Omit<WorkInSchema, 'id' | 'dbId'>`. Il `dbId` è sempre assente. Il caso bloccata-sostituzione è gestito via `RicaricaDialog` (path separato in SchemaCalibrazione.tsx, linea 1055).

---

## Fix 4 — Picker metodo per work condivise in WorkDrawer

**File:** `src/renderer/pages/work/WorkDrawer.tsx`

**Situazione attuale:**
Il banner "bloccata" chiama `onVaiASchema(metodi_ids[0])`. Se la work è condivisa tra più metodi, l'operatore viene sempre portato al primo metodo dell'array, che potrebbe essere quello sbagliato.

**Cambiamento:**
Nel banner bloccata, se `metodi_ids.length === 1` comportamento invariato. Se `metodi_ids.length > 1`, mostrare un bottone per ciascun metodo invece del singolo pulsante "Vai allo Schema ↗". Serve il nome del metodo: aggiungere `metodi?: { id: string; nome: string }[]` alla Work oppure passare `metodiNomi: Record<string, string>` come prop a WorkDrawer.

**Approccio consigliato:** Passare `metodiNomi: Record<string, string>` come prop (già disponibile in WorkPage dal `useState` dei metodi), evitando di modificare l'IPC.

**File coinvolti:**
- `src/renderer/pages/work/WorkDrawer.tsx` — prop `metodiNomi`, rendering condizionale bottoni
- `src/renderer/pages/work/WorkPage.tsx` — passare `metodiNomi` alla WorkDrawer

---

## Ordine di esecuzione

1. Fix 3 (dead code) — triviale, nessun rischio
2. Fix 1 (badge stato) — nessun impatto su logica
3. Fix 2 (archivia su delete) — impatta handleDeleteWork
4. Fix 4 (picker metodo) — impatta WorkPage/WorkDrawer, area separata

---

## Verifica end-to-end

- **Fix 1:** Caricare schema con work che hanno dbId. Verificare che le card mostrino il badge bloccata (rosso) e CRM scaduti (giallo) in modo coerente con WorkPage.
- **Fix 2:** Creare una work in schema (ottiene dbId). Eliminarla. Verificare nel DB (`work:list`) che la work risulti archiviata, non attiva.
- **Fix 3:** Verificare che `salvaWorkNelDb` crei ancora correttamente nuove work dopo la rimozione del dead code.
- **Fix 4:** Aprire WorkDrawer di una work bloccata condivisa tra 2 metodi. Verificare che appaiano 2 bottoni distinti con i nomi dei metodi.
