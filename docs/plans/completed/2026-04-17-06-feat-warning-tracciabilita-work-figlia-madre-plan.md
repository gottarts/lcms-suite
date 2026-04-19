# Plan — Warning "Work figlia preparata prima della madre rinnovata"

## Context

**Problema funzionale.** Una Work madre (sorgente) può esaurirsi fisicamente prima della sua scadenza teorica. L'operatore ne registra una nuova preparazione (stessa `work_id`, nuova riga in `work_preparazioni`). Ma le **Work figlie** che la usano come sorgente non vengono automaticamente ri-preparate: restano con la loro ultima `data_prep` antecedente alla nuova `data_prep` della madre.

**Regola di laboratorio.** Una Work figlia è valida solo se è stata preparata **dopo** l'ultima preparazione della sua madre: altrimenti la figlia contiene materiale dalla madre "vecchia" (tracciabilità rotta).

**Obiettivo.** Rilevare la condizione `figlia.data_prep < madre.data_prep` (stretto) e mostrare un warning visivo (non bloccante) **in entrambi i drawer**: dal lato madre (lista delle figlie obsolete) e dal lato figlia (indicazione della sorgente rinnovata).

## Decisioni di scope (confermate con l'utente)

1. Ambito: **entrambi i drawer** (madre e figlia).
2. Soglia: confronto **strettamente `<`** sulla `data_prep` (nessuna tolleranza).
3. Severità: **warning visivo soltanto** (banner giallo/viola), non blocca uso in Schema Calibrazione.

## Stato attuale (già presente)

- Tabella `work_preparazioni (work_id, data_prep, operatore, note)` — [014-work-preparazioni.sql](src/main/migrations/014-work-preparazioni.sql), colonna `operatore` in [015](src/main/migrations/).
- Relazione madre/figlia via `work_ingredienti.source_type='work' + source_id` — [012-work.sql:16-25](src/main/migrations/012-work.sql).
- Servizio ricorsivo [`expandWorkTree(db, workId)`](src/main/services/workTree.ts#L66-L226) che già calcola `WorkTreeProblemi` propagando flag verso l'alto (incluso `work_scadute` alle righe 167-170).
- IPC `work:expand-tree` — [work.ipc.ts:956](src/main/ipc/work.ipc.ts#L956).
- Consumo in [WorkDrawer.tsx:536-553](src/renderer/pages/work/WorkDrawer.tsx#L536-L553): banner viola "Work intermedia con sorgenti con problemi".
- Pattern UI banner consolidato: giallo (warning CRM scaduti/prep scadute), viola (work intermedia), arancione (blocco CRM dismessi).
- Handler `work:prepara` — [work.ipc.ts:480-492](src/main/ipc/work.ipc.ts#L480-L492).

## Modifiche

### 1. Backend — estendere `expandWorkTree`

File: [src/main/services/workTree.ts](src/main/services/workTree.ts)

a) Aggiungere flag `figlia_prep_obsoleta: boolean` a `WorkTreeProblemi` (linee 29-36).

b) Dentro il loop `for (const ing of ingredienti)` ramo `source_type === 'work'` (linee 149-172), dopo il push di `child`, aggiungere:

```ts
// Figlia preparata prima dell'ultima preparazione della work corrente (madre)
if (child.ultima_prep_data && ultimaPrep?.data_prep) {
  if (child.ultima_prep_data < ultimaPrep.data_prep) {
    problemi.figlia_prep_obsoleta = true
  }
}
// Propaga anche il flag dai figli (per catene multi-livello)
if (child.problemi.figlia_prep_obsoleta) problemi.figlia_prep_obsoleta = true
```

c) Inizializzare `figlia_prep_obsoleta: false` nell'oggetto `problemi` (linee 137-144).

**Razionale.** `expandWorkTree` è già il punto che ha visibilità su `ultima_prep_data` di madre e figlie. Propagando come gli altri flag esistenti, il banner viola "Work intermedia con problemi" funziona automaticamente (la propagazione è già in atto — basta aggiungere il nuovo label nella stringa).

### 2. Backend — nuovo IPC `work:figlie-obsolete`

File: [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts)

Serve la **query inversa**: dato `workId`, trovare le work che lo usano come sorgente e hanno `data_prep` antecedente all'ultima della madre.

```ts
ipcMain.handle('work:figlie-obsolete', (_e, workId: number) => {
  const db = getDb()
  const madre = db.prepare(
    'SELECT data_prep FROM work_preparazioni WHERE work_id = ? ORDER BY data_prep DESC LIMIT 1'
  ).get(workId) as { data_prep: string } | undefined
  if (!madre) return []
  return db.prepare(`
    SELECT w.id, w.nome, MAX(wp.data_prep) AS ultima_prep_data
    FROM work_ingredienti wi
    JOIN work w ON w.id = wi.work_id
    LEFT JOIN work_preparazioni wp ON wp.work_id = w.id
    WHERE wi.source_type = 'work' AND wi.source_id = ?
      AND w.archiviata = 0
    GROUP BY w.id, w.nome
    HAVING ultima_prep_data IS NOT NULL AND ultima_prep_data < ?
  `).all(workId, madre.data_prep)
})
```

(Verificare nome colonna `archiviata` in `work` — in caso diverso, adattare.)

Esporre in [src/preload/index.ts](src/preload/index.ts) e [src/renderer/lib/api.ts](src/renderer/lib/api.ts) seguendo gli altri metodi `workApi`.

### 3. Frontend — banner nel drawer

File: [src/renderer/pages/work/WorkDrawer.tsx](src/renderer/pages/work/WorkDrawer.tsx)

**A) Banner "figlie obsolete" (drawer madre).**

Nello `useEffect` di caricamento (vicino alla chiamata `workApi.expandTree`, ~linea 230), chiamare `workApi.figlieObsolete(workId)` e salvare in state `figlieObsolete: Array<{id, nome, ultima_prep_data}>`.

Renderizzare banner giallo dopo il banner prep scadute (~linea 534), prima del banner viola:

```tsx
{figlieObsolete.length > 0 && (
  <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <span>
          {figlieObsolete.length === 1 ? '1 work figlia è stata' : `${figlieObsolete.length} work figlie sono state`} preparate prima dell'ultima preparazione di questa work. Ripreparare per ripristinare la tracciabilità.
        </span>
        <ul className="text-xs list-disc list-inside">
          {figlieObsolete.map(f => (
            <li key={f.id}>{f.nome} (ultima prep: {formatDate(f.ultima_prep_data)})</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}
```

**B) Banner "sorgente rinnovata" (drawer figlia).**

Il flag `figlia_prep_obsoleta` arriva già via `workTreeProblemi` dall'IPC `work:expand-tree` (dopo modifica #1). Estendere il banner viola esistente (linee 536-553) aggiungendo `'sorgente rinnovata dopo preparazione'` alla lista delle stringhe di problema.

**Alternativa più chiara**: banner giallo dedicato quando `workTreeProblemi.problemi?.figlia_prep_obsoleta` è true, con messaggio specifico "Una Work sorgente è stata ri-preparata dopo questa work. Ripreparare per ripristinare la tracciabilità." Questa versione è più leggibile perché il banner viola oggi mescola problemi eterogenei.

Raccomandazione: **banner giallo dedicato**, inserito subito dopo quello delle figlie obsolete.

## File critici modificati

- [src/main/services/workTree.ts](src/main/services/workTree.ts) — nuovo flag + logica
- [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts) — nuovo handler `work:figlie-obsolete`
- [src/preload/index.ts](src/preload/index.ts) + [src/renderer/lib/api.ts](src/renderer/lib/api.ts) — esposizione API
- [src/renderer/pages/work/WorkDrawer.tsx](src/renderer/pages/work/WorkDrawer.tsx) — due nuovi banner + state

## Vincoli da CLAUDE.md

`WorkDrawer.tsx` non è nei 3 file critici "non toccare senza autorizzazione" (quelli sono CompostiTable/StoriaDialog/CompostiPage) — modifiche OK.

## Verifica end-to-end

1. Creare Work madre tracciata, prepararla una prima volta (data X).
2. Creare Work figlia con ingrediente `source_type='work'` verso la madre, prepararla (data X+1).
3. Registrare nuova preparazione della madre (data X+10).
4. **Drawer madre**: banner giallo "1 work figlia è stata preparata prima... — <nome figlia> (ultima prep: X+1)".
5. **Drawer figlia**: banner giallo "Una Work sorgente è stata ri-preparata dopo questa work...".
6. Registrare nuova preparazione della figlia (data X+11) → entrambi i banner scompaiono al reload del drawer.
7. Caso ricorsivo: nonna → madre → figlia. Ri-preparare la nonna: il flag `figlia_prep_obsoleta` su madre deve propagare e far apparire il banner anche sulla nonna (logica OR in workTree.ts).
8. Type check: `npm run typecheck` (o equivalente da `package.json`).
9. Dev server: `npm run dev`, testare manualmente i 3 casi sopra in UI.
