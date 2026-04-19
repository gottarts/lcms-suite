# Bugfix Schema Calibrazione — chips prelievi duplicate dopo Ricarica + propagazione cross-schema

## Context

Dopo aver eseguito una **Ricarica** su una work nello Schema Calibrazione, le chip della "tabella volumi mini" mostrano una riga **per ogni componente del CRM mix** invece di una sola riga per mix. I calcoli numerici restano corretti — è solo la visualizzazione delle chip che ripete il volume N volte (N = numero di componenti del mix).

L'utente segnala anche che l'effetto si manifesta su **work che non sono state ricaricate**: aprendo lo schema di un metodo, vede chip duplicate anche su work la cui ricarica era stata fatta in **un altro schema/metodo**, perché la work era stata trasferita tra metodi. Questo indica che il bug si propaga attraverso `schema_calibrazione.schema_json` di tutti gli schemi che contenevano la old work.

Bug introdotto dal commit **8917fff** (oggi, 2026-04-15) — `fix: ricarica Schema Calibrazione — rigenerazione srcs/frecce e gestione Neat`. Il commit risolveva il problema delle frecce SVG che non si ridisegnavano dopo la ricarica, ma ha introdotto una funzione `buildSrcsAndVols()` lato backend che **non è allineata** con la versione esistente lato renderer (`ricostruisciWorkInSchema()` in [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts)).

L'utente chiede inoltre, approfittando della rilettura, di segnalare altri bug strutturali del modulo (il più critico del progetto).

---

## Root cause del bug principale

In [work.ipc.ts:776-804](src/main/ipc/work.ipc.ts#L776-L804) la funzione `buildSrcsAndVols()` itera `newIngr` (una riga per ogni componente del mix in `work_ingredienti`) e:

1. Per `srcs` deduplica correttamente i mix con `seenMix.has(c.mix_id) → continue del solo push srcs`
2. Per `vols` esegue **sempre** `vols.push({...})` — anche per le righe già viste come mix

Risultato: `srcs.length = 1` per il mix, `vols.length = N` per gli N componenti del mix, **tutti con lo stesso `volume_prelievo_ml`** e **stesso `nome`** (forma commerciale del mix).

La versione **renderer** in [SchemaCalibrazione.logic.ts:515-540](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L515-L540) usa correttamente `if (seenMix.has(crm.mix_id)) continue` che salta **sia** il push di srcs **sia** quello di vols — una sola entry per mix.

Il rendering in [SchemaCalibrazione.tsx:313](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L313) usa `w.vols.map(v => …)` con `key={v.nome}` — la duplicazione è quindi visibile come N righe identiche nella mini-tabella volumi, e la `key` duplicata può anche causare warning React.

### Aggravante: propagazione cross-schema

In [work.ipc.ts:872-896](src/main/ipc/work.ipc.ts#L872-L896) il codice itera `params.metodi_ids` e per ogni schema **ricalcola** `buildSrcsAndVols(schema.workCols)` — quindi il bug di duplicazione si applica alla work in **ogni schema** che la conteneva (anche metodi dove l'utente non ha aperto la dialog di Ricarica). Questo spiega perché l'utente vede chip duplicate su work apparentemente non ricaricate.

C'è anche un problema più sottile: il test `if (w.dbId === params.old_work_id)` sostituisce `w.srcs` e `w.vols` con risultati calcolati una sola volta a inizio loop, ma se schemi diversi hanno work-dipendenti (`source_type='work'`) con id locali diversi, il `srcs[].id` per le sorgenti di tipo work potrebbe non corrispondere alla card di quello schema (perché `found.id` viene preso dal **primo** workCols che matcha). Per il bug attuale è secondario, ma va corretto contestualmente: `buildSrcsAndVols` va **richiamata per ciascun schema**, non riusata.

---

## Fix proposto

### Fix 1 — Deduplicazione vols per mix (root cause)

In [work.ipc.ts](src/main/ipc/work.ipc.ts), dentro `buildSrcsAndVols()`, allineare la logica al renderer: quando il mix è già stato visto, fare `continue` saltando **anche** il push in `vols`.

Modifica chirurgica al ramo `crm`:

```ts
if (ing.source_type === 'crm') {
  const c = getCompostoFull.get(ing.source_id) as any
  if (!c) continue
  if (c.mix_id) {
    if (seenMix.has(c.mix_id)) continue   // ← skip srcs E vols
    seenMix.add(c.mix_id)
    srcs.push({ id: c.mix_id, nome: c.forma_commerciale ?? c.nome ?? '', cv: Number(c.concentrazione) || 0, tipo: 'mix' })
  } else {
    srcs.push({ id: String(c.id), nome: c.nome ?? '', cv: Number(c.concentrazione) || 0, tipo: 'sng' })
  }
  vols.push({ … })
}
```

### Fix 2 — Richiamare buildSrcsAndVols per ogni schema

In [work.ipc.ts:872-896](src/main/ipc/work.ipc.ts#L872-L896) spostare la chiamata `const { srcs, vols } = buildSrcsAndVols(schema.workCols ?? [])` **dentro** il loop `for (const mid of params.metodi_ids)`, dopo aver caricato lo `schema` di quel metodo. Così ogni schema ottiene `srcs[].id` per `tipo='work'` calcolati sui propri `workCols`. (La chiamata era già dentro il loop nel codice attuale — verificare e mantenere.)

### Fix 3 — Migrazione/riparazione one-shot degli schemi già danneggiati

Gli schemi di tutti gli utenti che hanno già eseguito Ricarica con la versione 8917fff hanno `vols[]` duplicati persistiti in `schema_calibrazione.schema_json`. Senza riparazione, riaprire lo schema continuerà a mostrare chip duplicate **anche con il fix attivo** (perché il renderer legge dal DB).

Opzioni:

- **Opzione A (consigliata, automatica)**: alla `schema-calibrazione:get` del backend, dopo aver fatto `JSON.parse(schema_json)`, applicare una funzione `dedupVolsByMixName(workCols)` che ricostruisce `vols[]` deduplicando per `nome` quando appaiono entry consecutive identiche. Lossless e silenziosa, agisce in lettura senza mutare il DB.
- **Opzione B (più pulita)**: aggiungere una migrazione SQL `021-fix-vols-dedup.sql` che esegue uno script Node-side al primo avvio per riscrivere `schema_json` di tutti i metodi.

Vista la **regola CLAUDE.md "cambiamenti minimali e mirati"**, raccomando **Opzione A**: una funzione defensive di sanitizing in lettura, ~15 righe, nessuna migrazione. Va applicata in [schemaCalibrazione.ipc.ts](src/main/ipc/schemaCalibrazione.ipc.ts) handler `schema-calibrazione:get`. Va anche applicata al volo dentro `buildSrcsAndVols` (già coperta dal Fix 1, ma la sanitizzazione in get protegge da eventuali altre regressioni future).

### Fix 4 — Key React stabile

In [SchemaCalibrazione.tsx:313](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L313) cambiare `key={v.nome}` in `key={`${v.nome}-${idx}`}` (con `(v, idx) =>`). È un fix difensivo: dopo Fix 1+3 i nomi non saranno più duplicati, ma se un mix per qualche motivo avesse due ingredienti dello stesso nome la `key` duplicata romperebbe la reconciliation di React. Cambio chirurgico.

---

## Altri bug / fragilità trovate (riportare all'utente, NON fixare in questo piano)

Durante l'esplorazione del modulo ho identificato altri punti che meritano segnalazione. **Non li fixo in questo intervento** (regola "scope isolato"), ma li elenco perché l'utente ha esplicitamente chiesto un controllo strutturale del modulo:

1. **Logica duplicata renderer/backend**: `ricostruisciWorkInSchema()` ([logic.ts:480](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L480)) e `buildSrcsAndVols()` ([work.ipc.ts:772](src/main/ipc/work.ipc.ts#L772)) implementano due volte la stessa trasformazione `work_ingredienti → {srcs, vols}`. Sono già divergenti (questo bug ne è la prova). **Raccomandazione**: estrarre una sola funzione condivisa in un modulo "domain" (es. `src/shared/work-srcs-vols.ts`) richiamata da entrambi i lati. Oggi il rischio di nuove divergenze è alto.

2. **Transazione `work:ricarica` non rollback-safe a livello di IPC**: la transazione SQLite è atomica, ma se un `JSON.parse(schema_json)` fallisce a metà del loop `metodi_ids` non c'è try/catch a livello handler. Un metodo con schema JSON corrotto bloccherebbe la ricarica.

3. **`buildSrcsAndVols` per `source_type='work'` cerca per `dbId` solo nel **primo** workCols match**: se la stessa work compare in più colonne (caso raro ma non vietato), prende solo la prima. Vedi [work.ipc.ts:807-813](src/main/ipc/work.ipc.ts#L807-L813).

4. **`extraSrcs` viene cancellato dalla ricarica anche quando l'extra dovrebbe restare**: [work.ipc.ts:884](src/main/ipc/work.ipc.ts#L884) fa sempre `delete w.extraSrcs`. Se la work conteneva CRM "extra" (non in schema corrente), dopo la ricarica scompaiono dalla UI senza essere realmente rimossi dal DB.

5. **`SchemaCalibrazione.tsx` è 1035 righe** con 7+ stati interconnessi (`workCols`, `selSrcs`, `removedMix`, `mixLottoSel`, `blockedMap`, `crmItems`, …) e ~5 useEffect che dipendono uno dall'altro. È il candidato principale per un futuro refactor in custom hooks (`useWorkCols`, `useBlockedLots`, …). **Non in questo intervento**.

6. **Chiave `<div key={v.nome}>` instabile**: già coperta da Fix 4 sopra.

L'utente deciderà se aprire bugfix separati per i punti 1–5.

---

## File da modificare

- [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts) — Fix 1 (dedup vols nel ramo `crm` di `buildSrcsAndVols`), verifica Fix 2
- [src/main/ipc/schemaCalibrazione.ipc.ts](src/main/ipc/schemaCalibrazione.ipc.ts) — Fix 3 (sanitizing in `schema-calibrazione:get`)
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — Fix 4 (key React riga 313)

**File NON toccati**: tutti gli altri del modulo, in particolare i file critici elencati in CLAUDE.md (CompostiTable, StoriaDialog, CompostiPage).

---

## Funzioni esistenti da riusare

- `ricostruisciWorkInSchema()` in [SchemaCalibrazione.logic.ts:480](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L480) — è già la versione corretta, serve come **riferimento** per allineare `buildSrcsAndVols`. Non viene modificata.
- Pattern `seenMix: Set<string>` — già usato in entrambe le versioni, basta applicarlo coerentemente a vols nel backend.

---

## Verification

1. **Riproduzione bug pre-fix** (per conferma della root cause):
   - Aprire uno schema con una work che usa un mix multi-componente
   - Eseguire Ricarica su quella work (anche selezionando lo stesso lotto se non ci sono dismessi disponibili)
   - Osservare nella card della work una riga "MixNome — X.XXX mL" ripetuta N volte (dove N = composti del mix)

2. **Test post-fix**:
   - Stessa azione di sopra → la riga "MixNome — X.XXX mL" deve apparire **una volta sola**
   - I calcoli numerici (`vol.toFixed(3)`, somma `usedVol`, controllo `neg`) devono restare identici
   - Le frecce SVG (computeConnections) devono continuare a essere disegnate correttamente — questo era il fix originale del commit 8917fff e va preservato
   - Le chip degli `srcs` (riga 291) restano una per mix, invariate

3. **Test riparazione retroattiva (Fix 3)**:
   - Aprire uno schema **già danneggiato** dal bug 8917fff (cioè uno schema dove era già stata fatta una Ricarica): le chip duplicate devono sparire automaticamente alla riapertura, **senza** dover rieseguire la Ricarica
   - Fare Save dello schema (auto-save al cambio di stato) e riaprire: i `vols` salvati devono essere già deduplicati

4. **Test cross-schema** (lo scenario specifico riportato dall'utente):
   - Trasferire una work tra due metodi (M1 → M2) attraverso l'import work
   - Dallo schema di M2 eseguire Ricarica della work
   - Aprire lo schema di M1 (che NON ha eseguito Ricarica): la work deve mostrare chip non duplicate

5. **Test ispezione DB** (manuale, sqlite CLI o better-sqlite3 inspector):
   ```sql
   SELECT metodo_id, json_extract(schema_json, '$.workCols') FROM schema_calibrazione;
   ```
   Verificare che dentro `workCols[*][*].vols` non ci siano entry duplicate per `nome`.

6. **Smoke test del modulo Schema Calibrazione**:
   - Creazione nuova work + scelta sorgenti → drag srcs → calcolo volumi → save → riapertura schema (no regressione su flusso normale)
   - Drawer dettaglio work → modifica → save (no regressione su flusso edit)

---

## Note operative

- Tutti i fix sono confinati a 3 file e ~30 righe totali
- Nessuna migrazione SQL necessaria (il sanitizing in get evita una migrazione one-shot)
- Compatibile con dati esistenti: schemi danneggiati vengono autoriparati alla prima lettura
- Non tocca `ricostruisciWorkInSchema()` (renderer) → comportamento del flusso normale "salva work" invariato
- Non tocca i file critici di CLAUDE.md
