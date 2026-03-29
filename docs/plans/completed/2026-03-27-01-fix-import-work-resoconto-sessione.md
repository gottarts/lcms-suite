# Resoconto sessione — Fix importazione work ripetibile

**Data:** 2026-03-27
**Oggetto:** Fix re-import work da altri metodi; tentativo fallito di copiare drawer SchemaCalibrazione in WorkPage

---

## Cosa è stato fatto

- **Fix confermato e mantenuto**: rimozione del filtro `NOT EXISTS` in `work:list-for-import` → le work sono ora sempre importabili in qualsiasi metodo, senza la restrizione "solo una volta".
- **Tentativo abortito**: riscrittura del WorkDrawer (WorkPage) per replicare l'aspetto e i dati di DrawerDettaglioWork (SchemaCalibrazione). Tentativi multipli hanno portato a drawer vuoto / calcoli sbagliati. Tutto rollbackato al commit precedente.

---

## Bug risolti

### Re-import work sempre disponibile
**Root cause:** La query `work:list-for-import` escludeva le work già collegate al metodo corrente tramite `NOT EXISTS` su `work_metodi`. La relazione esiste già dalla prima importazione, quindi non era possibile re-importare.

**Fix:** Rimossa la clausola `NOT EXISTS` e il parametro `metodoId` dal `.all()`. Il `INSERT OR IGNORE` in `work:add-to-metodo` gestisce silenziosamente i duplicati. Il frontend `ImportaWorkDialog` già filtra localmente i `dbId` già presenti nello schema corrente per evitare duplicati visivi.

**File:** `src/main/ipc/work.ipc.ts`

---

## Tentativo fallito — WorkDrawer identico a SchemaCalibrazione

### Problema
L'utente chiedeva che il drawer delle work in WorkPage fosse identico a `DrawerDettaglioWork` in SchemaCalibrazione (stessa grafica, stessi dati: tabella volumi, catena tracciabilità, lista composti con concentrazione calcolata).

### Ostacolo architetturale
`DrawerDettaglioWork` lavora su oggetti `WorkInSchema` (struttura in-memory con `srcs`, `vols`, calcolati a runtime da `getCompsFromWork`). WorkDrawer lavora su work caricate dal DB (`work.ingredienti` flat, senza `srcs`/`vols`).

### Tentativi effettuati (tutti rollbackati)
1. Raggruppamento CRM mix per `source_mix` nella sezione Tracciabilità → drawer bianco (useMemo dopo early return, violazione regole hooks).
2. Riscrittura completa WorkDrawer con calcoli propri → calcoli diversi e sbagliati rispetto a SchemaCalibrazione.
3. Aggiunta tabelle DB `work_composti_calcolati` e `work_vols_snapshot` per congelare i dati al momento della creazione → drawer vuoto (errori multipli di integrazione).

### Conclusione
Il drawer di WorkPage rimane quello originale. Il problema richiede un approccio più attento in una sessione dedicata.

---

## Approccio corretto per sessione futura

Per replicare esattamente DrawerDettaglioWork in WorkPage:

1. **Non ricalcolare nulla nel frontend** — congelare i dati al momento della creazione in SchemaCalibrazione.
2. **Due tabelle DB** da aggiungere con migrazioni:
   - `work_vols_snapshot`: snapshot di `w.vols` (nome, vol, conc_target, dil_factor, modo) — una riga per voce della tabella volumi
   - `work_composti_calcolati`: output di `getCompsFromWork(w, workCols, crmItems)` (nome, conc, unita, src_path)
3. **`salvaWorkNelDb`** in `SchemaCalibrazione.logic.ts`: passare `workCols` e chiamare `getCompsFromWork`, includere entrambi gli snapshot nel payload.
4. **`work:create` IPC**: accettare e salvare i due snapshot nelle nuove tabelle.
5. **`work:get` IPC**: caricare i due snapshot e aggiungerli alla risposta.
6. **WorkDrawer**: mostrare `work.vols_snapshot` per la tabella volumi e `work.composti_calcolati` per la lista composti — **zero calcoli**, solo display identico a SchemaCalibrazione.
7. **Catena tracciabilità**: usare `work.vols_snapshot` per i nodi (ogni `nome` è già il nome della sorgente raggruppata per mix).

**Attenzione**: le work già esistenti nel DB avranno questi campi vuoti. Mostrare un messaggio "dati non disponibili per work create precedentemente" oppure omettere le sezioni.

**Causa del fallimento precedente**: è stato scritto codice di calcolo nel WorkDrawer invece di leggere passivamente i dati salvati. Il punto critico è che `salvaWorkNelDb` ha accesso a `w.vols` e `getCompsFromWork` con tutti i dati corretti — basta serializzarli e salvarli.

---

## File modificati (sessione corrente — solo fix mantenuto)

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Rimosso `NOT EXISTS` da `work:list-for-import`; tutte le work non archiviate sono sempre importabili |

---

## Note per sessioni future

- Il fix importazione è stabile e corretto.
- Il WorkDrawer è tornato al suo stato originale (pre-sessione).
- Per la riscrittura del drawer: seguire esattamente l'approccio descritto sopra, senza scrivere logica di calcolo nel frontend.
- Riferimento piano: `~/.claude/plans/lovely-fluttering-catmull.md`
