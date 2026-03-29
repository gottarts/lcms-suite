# Piano: Risoluzione punti #6 e #7 — RicaricaDialog MANCANTE + traceability sostituito_da_id

## Context

Dalla sessione 2026-03-28 rimangono aperti due punti nel resoconto `2026-03-28-feat-flusso-operatore-blocco-ambiguita-resoconto-sessione.md`:

- **#6 ⚠️ Parzialmente risolto** — `RicaricaDialog` funziona per i casi AUTO e AMBIGUO, ma il caso MANCANTE (nessun lotto sostituto nel DB) è un **vicolo cieco**: il pulsante "Conferma e Ricarica" è disabilitato e l'utente non ha indicazioni su cosa fare.
- **#7 🔴 Aperto** — Quando una work viene eliminata dallo schema e ricreata nella stessa colonna (flusso di modifica implicito), la work archiviata non riceve `sostituito_da_id`. La catena di tracciabilità è spezzata.

---

## Punto #6 — RicaricaDialog: caso MANCANTE (dead-end UX)

### Cos'è e perché è un problema

Il `RicaricaDialog` analizza i lotti CRM di una work bloccata e li categorizza:
- **OK** — lotto ancora attivo, nessuna azione
- **AUTO** — 1 sostituto trovato → sostituzione automatica
- **AMBIGUO** — 2+ sostituti → l'utente sceglie dal dropdown
- **MANCANTE** — nessun lotto attivo nel DB per quel composto

**Esempio pratico:**
Il chimico ha la work "Std Mix Metalli 100 μg/L" nello schema ICP-MS. Usa 3 CRM:
- Arsenico L-2022-01 → dismesso, c'è 1 sostituto → **AUTO** ✅
- Piombo L-2022-05 → dismesso, ci sono 2 sostituti → **AMBIGUO** ⚠️ (sceglie dal dropdown)
- Mercurio L-2021-99 → dismesso, **nessun lotto di mercurio nel DB** → **MANCANTE** ❌

L'utente sceglie il Piombo, ma "Conferma e Ricarica" resta grigio per il Mercurio. Il dialog mostra "Nessun lotto attivo nel DB. Inserire un nuovo lotto prima di procedere." — ma non c'è nessun bottone per farlo. L'unica azione disponibile è "Annulla". Il chimico deve chiudere, ricordarsi il nome del composto, andare nel DB Composti, aggiungere il lotto, tornare allo schema e riaprire il dialog.

### Risoluzione

**Aggiungere per ogni ingrediente MANCANTE una riga di navigazione diretta:**

Per ciascun composto MANCANTE, mostrare accanto al nome un pulsante/link "Apri nel DB Composti" che naviga (o segnala) alla pagina Composti filtrata sul nome del composto. Il dialog si chiude automaticamente dopo il click (o rimane aperto con un messaggio "Torna qui dopo aver aggiunto il lotto").

Se la navigazione cross-pagina è complessa da implementare dal dialog, la soluzione minima è:
- Mostrare esplicitamente il **nome esatto del composto** mancante nella sezione (già visibile ma poco leggibile)
- Aggiungere un bottone "Chiudi e vai al DB Composti" che chiama `onClose()` e naviga a `/composti?cerca=<nome_composto>`

**File coinvolti:**
- `src/renderer/pages/work/RicaricaDialog.tsx` — UI del caso MANCANTE (linee 182-200)
- Router/navigation del renderer (da verificare il meccanismo di navigate) per passare il parametro cerca a CompostiPage
- SchemaCalibrazione.tsx — eventuale callback `onNavigateAway` da aggiungere alle props di `RicaricaDialog` se la navigazione richiede di chiudere la pagina

---

## Punto #7 — Traceability: sostituito_da_id nel flusso delete+create

### Cos'è e perché è un problema

Quando `work:ricarica` viene usato (caso CRM dismesso), il link è mantenuto correttamente:
```
work id=42 → archiviato_motivo='Lotti dismessi', sostituito_da_id=43  ✅
work id=43 → nuova work attiva, ingredienti aggiornati               ✅
```

Ma quando il chimico **modifica manualmente** una work (non c'è edit in-place: deve eliminare e ricreare), il flusso è:
1. Click ❌ sulla card → `handleDeleteWork` → `workApi.archivia(42, 'Rimossa dallo schema')` → **sostituito_da_id=NULL** ❌
2. Crea nuova work → `handleSaveWork` → `work:create` → work id=43 senza riferimento al 42

**Esempio pratico:**
- Operatore ha preparato "Std A 100 μg/L" in data 2026-03-01 → `work_preparazione id=7, work_id=42`
- Chimico vuole cambiare volume: elimina work 42, crea work 43 (stessa colonna)
- Risultato: prep. 7 punta a work 42 (archiviata, `sostituito_da_id=NULL`). Non si sa che 43 l'ha sostituita.

Il problema non è che la prep. venga persa (rimane nel DB), ma che non è tracciabile la catena: "questa work è stata modificata e sostituita dalla work X".

### Risoluzione (3 parti)

#### Parte A — Nuovo IPC `work:set-sostituito-da`
```typescript
// src/main/ipc/work.ipc.ts
ipcMain.handle('work:set-sostituito-da', (_, oldId: number, newId: number) => {
  getDb().prepare(`
    UPDATE work SET sostituito_da_id = ? WHERE id = ?
  `).run(newId, oldId)
  return { ok: true }
})
```

#### Parte B — Aggiunta a workApi
```typescript
// src/renderer/lib/api.ts
setSostituitoDa: (oldId: number, newId: number) =>
  api.invoke('work:set-sostituito-da', oldId, newId) as Promise<{ ok: boolean }>,
```

#### Parte C — SchemaCalibrazione: traccia la work rimossa per colonna

Usare un `useRef` (non state, per non causare re-render) che mappa `colIdx → old dbId` delle work recentemente archiviate. Quando viene creata una nuova work nella stessa colonna, chiamare `setSostituitoDa` dopo aver ottenuto il `newDbId`.

```typescript
// src/renderer/pages/metodi/SchemaCalibrazione.tsx

// Aggiungere dopo gli altri ref/state:
const recentlyArchivedByCol = useRef<Map<number, number>>(new Map()) // colIdx → old dbId

// In handleDeleteWork, dopo workApi.archivia():
if (w?.dbId) {
  workApi.archivia(w.dbId, 'Rimossa dallo schema').catch(() => {})
  recentlyArchivedByCol.current.set(colIdx, w.dbId)  // ← NEW
}

// In handleSaveWork, dopo aver ottenuto dbId:
if (dbId) {
  const oldDbId = recentlyArchivedByCol.current.get(tgtCol)
  if (oldDbId) {
    workApi.setSostituitoDa(oldDbId, dbId).catch(() => {})  // ← NEW
    recentlyArchivedByCol.current.delete(tgtCol)
  }
}
```

**Edge case:** Se l'utente elimina una work ma poi NON crea nulla nella stessa colonna (la elimina e basta), la entry nel `ref` rimane ma non causa problemi: la work è già archiviata correttamente senza `sostituito_da_id` (comportamento attuale, accettabile per questo caso). Il `ref` si svuota al prossimo rimount del componente.

---

## File critici da modificare

| File | Modifica |
|---|---|
| `src/main/ipc/work.ipc.ts` | Aggiungere handler `work:set-sostituito-da` |
| `src/renderer/lib/api.ts` | Aggiungere `setSostituitoDa` a `workApi` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiungere `recentlyArchivedByCol` ref + logiche in handleDeleteWork e handleSaveWork |
| `src/renderer/pages/work/RicaricaDialog.tsx` | Migliorare UI del caso MANCANTE con navigazione a CompostiPage |

---

## Verifica (end-to-end)

### Test #7 (traceability)
1. Aprire schema di un metodo con una work salvata (con dbId)
2. Eliminare la work dalla schema (click ❌)
3. Ricreare una work nella stessa colonna
4. Aprire SQLite DB (o aggiungere log) e verificare: `SELECT id, archiviato, sostituito_da_id FROM work ORDER BY id DESC LIMIT 5`
5. La work eliminata deve avere `sostituito_da_id = <id della nuova work>`

### Test #6 (MANCANTE)
1. Creare/trovare una work che ha un ingrediente CRM senza lotti attivi nel DB
2. Dal schema, cliccare "Ricarica ↻"
3. Verificare che nel dialog il composto MANCANTE mostri il bottone/link di navigazione e che il click porti alla pagina Composti con il filtro sul nome composto
