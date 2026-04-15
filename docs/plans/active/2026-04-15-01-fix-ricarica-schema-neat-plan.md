# Rigenerazione schema + frecce dopo ricarica CRM

## Context

Dopo una ricarica di una work nello Schema di Calibrazione (quando uno o più CRM sorgente hanno lotti dismessi/scaduti e vengono sostituiti con nuovi lotti), lo `schema_json` salvato continua a riferirsi ai **vecchi** `mix_id` / `source_id` nei `srcs[]` delle work. Di conseguenza:

- Le frecce tra le card sorgente e le card Work non vengono disegnate perché [SchemaCalibrazione.logic.ts:620-638](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L620-L638) cerca `cardRefs.get(src.id)` ma `src.id` punta al vecchio lotto, mentre le card registrate nella mappa hanno i nuovi `mix_id`.
- Gli `srcs` visualizzati nella Work continuano a mostrare i lotti pre-ricarica.

I tentativi fatti in sessione (fallback per `mix_id` nella ricerca, patch manuali del DB, aggiornamento di `dbId` nell'onSuccess) **non risolvono alla radice**: manca la rigenerazione vera e propria di `w.srcs[]` dal DB dopo la ricarica.

**Obiettivo**: dopo ogni ricarica, `w.srcs[]` (e `w.vols[]` per coerenza) della nuova work nel `schema_json` deve essere ricostruito dagli ingredienti effettivi della nuova work nel DB, usando i nuovi lotti.

## Approccio scelto

Fix lato **main process** in [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts), nell'handler `work:ricarica`. È il punto naturale:

1. la nuova work è appena stata creata e gli ingredienti con i nuovi `source_id` sono già inseriti nella transazione;
2. il DB è la fonte di verità e la modifica dello schema avviene già lì (linee 718-734);
3. fix unico che copre tutti i metodi/scenari futuri, senza dover toccare il renderer.

Il renderer, dopo aver ricevuto `ok: true` dall'IPC, farà semplicemente un **reload dello schema_json** dal DB (invece della patch locale di solo `dbId`), così React rileggerà i nuovi `srcs` e `computeConnections` troverà correttamente i `cardRefs` con i nuovi `mix_id`.

## Modifiche

### 1. [src/main/ipc/work.ipc.ts:716-734](src/main/ipc/work.ipc.ts#L716-L734) — rigenerazione `srcs` nello schema_json

Nel loop che aggiorna `schema.workCols` dopo l'`INSERT` della nuova work, quando si trova `w.dbId === params.old_work_id`:

- impostare `w.dbId = Number(newId)` (come ora);
- rileggere gli ingredienti della **nuova** work dal DB (`SELECT * FROM work_ingredienti WHERE work_id = ?` passando `newId`);
- per ciascun ingrediente ricostruire un elemento di `srcs[]` con la stessa logica già in uso lato renderer in [ricostruisciWorkInSchema](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L480-L602) (linee 493-583), adattata a SQL puro:
  - `source_type === 'crm'`: `SELECT id, nome, mix_id, forma_commerciale, concentrazione FROM composti WHERE id = ?`. Se `mix_id` valorizzato → `src = { id: mix_id, nome: forma_commerciale ?? nome, cv: concentrazione, tipo: 'mix' }` e dedup su `mix_id` (Set). Altrimenti → `src = { id: String(id), nome, cv: concentrazione, tipo: 'sng' }`.
  - `source_type === 'work'`: mantenere l'`src` work esistente in `w.srcs` corrispondente (il `source_id` work non cambia nella ricarica — `subst` riguarda solo CRM/prep, vedi [work.ipc.ts:673-691](src/main/ipc/work.ipc.ts#L673-L691)), oppure riemetterlo cercando la work dipendente per `dbId` nello stesso `schema.workCols`.
  - `source_type === 'prep'`: `SELECT source_composto_id` → `composti` per avere nome/cv, `tipo: 'prep'`.
- rimpiazzare `w.srcs = newSrcs`;
- ricostruire anche `w.vols[]` preservando volumi/dilFactor/concTarget/modo dall'ingrediente DB (che li porta identici dalla vecchia work) e aggiornando solo il `nome` al nuovo mix/singolo.
- `w.extraSrcs` va svuotato / rimosso (tutti i CRM dovrebbero ora risolvere): solo se la nuova work ha ingredienti tutti presenti nel DB corrente.

### 2. [src/renderer/pages/metodi/SchemaCalibrazione.tsx:986-1006](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L986-L1006) — onSuccess semplificato

Sostituire la patch locale `map(w => w.dbId === ... ? { ...w, dbId: newWorkId } : w)` con:

1. `await reload()` — ricarica `crmItems` con i nuovi mix_id (già esposto da `useSchemaData`);
2. `const saved = await schemaCalApi.get(metodoId)` — rilegge il `schema_json` aggiornato dal backend (che ora contiene i nuovi `srcs`);
3. `setWorkCols(saved.workCols)` — React ri-renderizza le card sorgenti con i nuovi id e `computeConnections` troverà i `cardRefs` corrispondenti.
4. Rimuovere il `schemaCalApi.save(...)` locale: il backend ha già salvato lo schema aggiornato in transazione, risalvarlo qui sovrascriverebbe con dati potenzialmente stale.

Nota: serve `setSchemaLoaded(false)` prima del reload? No — il load iniziale è protetto da `schemaLoaded` ma qui stiamo forzando un set manuale, non ripassiamo dal `useEffect` di [SchemaCalibrazione.tsx:490](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L490).

## File critici toccati

- [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts) — handler `work:ricarica` (linee ~716-734): aggiunta rigenerazione `srcs`/`vols`
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — `onSuccess` del RicaricaDialog (linee 990-1005): reload invece di patch locale

**File NON toccati** (nonostante i fix sparsi della sessione):
- [SchemaCalibrazione.logic.ts:495](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L495) — il fallback `find(c => c.mix_id === ing.source_mix_id)` può restare (non danneggia), ma non è la strada risolutiva e non serve più una volta che schema_json ha i nuovi id.

## Rollback fix precedenti

I fix in sessione 1-6 elencati dall'utente andrebbero verificati/puliti:

- **Fix 1** (fallback mix_id): innocuo, può restare.
- **Fix 2** (insert manuale in `composti_metodi`): il fix 4 in [work.ipc.ts](src/main/ipc/work.ipc.ts) lo automatizza — verificare che l'automazione copra anche il caso già patchato manualmente.
- **Fix 3** (edit manuale schema_json con id 1128): ora verrà sovrascritto dalla rigenerazione al prossimo ricarica. Va bene.
- **Fix 4** (insert `composti_metodi` nella ricarica): da **mantenere** — serve per rendere i nuovi lotti visibili in `composti:list-for-schema`.
- **Fix 5** (ricostruisciWorkInSchema nell'onSuccess renderer): da **rimuovere** — sostituito dal reload + `schemaCalApi.get`.
- **Fix 6** (ricalcolo srcs nel loop work.ipc.ts): da **completare** — è sostanzialmente il punto 1 di questo piano. Verificare che la bozza in corso sia corretta e completa per `crm`/`work`/`prep`.

## Verifica end-to-end

1. Avviare l'app: `npm run dev` (o comando equivalente nel progetto).
2. Aprire un metodo con Schema di Calibrazione che ha almeno una Work con sorgente CRM mix e uno stock scaduto.
3. Forzare la scadenza/dismissione del mix (oppure usare il caso DASOL già rotto in DB).
4. Aprire la Work → cliccare "Ricarica" → confermare.
5. Verifica:
   - ✅ la Work nello schema continua a comparire;
   - ✅ le frecce dalla card sorgente (nuovo mix_id) alla Work vengono disegnate;
   - ✅ `w.srcs[]` nello schema_json (controllabile via DevTools o query SQL) contiene gli id dei nuovi mix;
   - ✅ la vecchia work è archiviata (`archiviato = 1`);
   - ✅ `composti_metodi` contiene i nuovi `composto_id` per il metodo;
   - ✅ al refresh della pagina (chiudi+riapri lo schema), le frecce sono ancora disegnate (persistenza schema_json corretta).
6. Ripetere per un caso con sorgente CRM **singolo** (non mix), ad esempio DASOL: verificare che `src.id` sia il nuovo `String(composto.id)`.
7. Ripetere per una Work multilivello (con `source_type === 'work'` dipendente): il `src.id` della work sorgente non deve cambiare, le frecce inter-colonna restano intatte.
