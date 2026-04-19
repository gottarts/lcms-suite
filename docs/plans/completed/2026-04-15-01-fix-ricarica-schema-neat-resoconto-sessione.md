# Resoconto sessione — Fix ricarica Schema Calibrazione (rigenerazione srcs/frecce + Neat)

**Data:** 2026-04-15
**Oggetto:** Dopo la ricarica di una Work nello Schema di Calibrazione, rigenerare `srcs[]`/`vols[]` nello `schema_json` con i nuovi lotti; gestire correttamente il caso CRM Neat (composto padre dismesso/scaduto); correggere la chiave di card prep.

---

## Cosa è stato fatto

Risolto il bug per cui, dopo una "Ricarica" su una Work nello Schema di Calibrazione, le frecce tra sorgenti e Work non venivano più disegnate e gli `srcs` mostrati continuavano a puntare ai lotti pre-ricarica. Il fix è centralizzato nel main process (handler `work:ricarica`) che ora rigenera `srcs[]`/`vols[]` leggendo direttamente gli ingredienti della nuova Work dal DB. Il renderer è stato semplificato: dopo la ricarica ricarica CRM e schema dal backend invece di patchare solo `dbId` localmente.

Lungo la strada sono stati corretti due sotto-problemi specifici dei CRM Neat:
1. il RicaricaDialog non proponeva sostituti per Neat quando il **composto padre** era dismesso/scaduto (`stmtSostitutiPrep` cercava solo sullo stesso `composto_id`);
2. la chiave della card `prep_<preparazioni.id>` usata dal grid UI non corrispondeva all'`id` che il fix iniziale emetteva in `srcs[]` (`String(composto.id)`), quindi le frecce non si disegnavano comunque per i Neat.

---

## Bug risolti / Feature aggiunte

### Rigenerazione `srcs[]`/`vols[]` nello `schema_json` dopo ricarica
**Root cause:** L'handler `work:ricarica` aggiornava solo `w.dbId` nello `schema_json` ([work.ipc.ts:716-734](../../src/main/ipc/work.ipc.ts#L716-L734)) ma non toccava `w.srcs[]`, che continuavano a contenere `mix_id` / `composto_id` del lotto pre-ricarica. Di conseguenza [computeConnections](../../src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L607-L642) non trovava i `cardRefs` (la mappa contiene ora i nuovi `mix_id`) e nessuna freccia veniva disegnata.

**Fix:** Nel loop di aggiornamento `schema_json` dentro la transazione di `work:ricarica`, dopo `INSERT` della nuova Work e dei suoi ingredienti:
- rilettura di `work_ingredienti` per la nuova Work;
- funzione locale `buildSrcsAndVols(schema.workCols)` che replica la logica di [ricostruisciWorkInSchema](../../src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L480-L602) in SQL puro:
  - `crm`: SELECT su `composti`; se `mix_id` valorizzato → `src = { id: mix_id, nome: forma_commerciale ?? nome, tipo: 'mix' }` con dedup su `mix_id` (Set); altrimenti `src = { id: String(c.id), tipo: 'sng' }`;
  - `work`: cerca la work dipendente nello stesso `schema.workCols` per riemettere l'`id` locale della card (il `source_id` work non cambia nella ricarica perché `subst` tocca solo CRM/prep);
  - `prep`: vedi sezione dedicata sotto;
- assegna `w.srcs = newSrcs` e `w.vols = newVols`, rimuove `w.extraSrcs`.

Aggiunto anche l'INSERT `OR IGNORE` in `composti_metodi` per i nuovi `composto_id` della ricarica, così `composti:list-for-schema` li restituisce e le card sorgenti vengono renderizzate.

### `onSuccess` del RicaricaDialog semplificato
**Root cause:** Il vecchio handler patchava localmente solo `dbId` con `setWorkCols(...)` e risalvava lo schema dal renderer, perdendo l'aggiornamento appena fatto dal main in transazione.

**Fix:** Ora `onSuccess` è async e fa: `await reload()` (ricarica `crmItems` con i nuovi `mix_id`) → `schemaCalApi.get(metodoId)` → `setWorkCols(saved.workCols)`. Nessun `save` locale. Il backend è l'unica fonte di verità dello schema dopo la ricarica.

### Bug CRM Neat #1 — RicaricaDialog non trovava sostituti quando il composto padre era dismesso
**Root cause:** In [work:check-lot-status](../../src/main/ipc/work.ipc.ts#L546-L637) la logica "prep" valutava solo `data_dismissione`/`scadenza_prodotto` della **preparazione** (dal JOIN `preparazioni p`), ignorando lo stato del composto padre. E `stmtSostitutiPrep` cercava preparazioni valide **sullo stesso `composto_id`**: inutile quando il composto è stato dismesso e il nuovo lotto ha un `composti.id` diverso.

**Fix:**
- Aggiunti al SELECT degli ingredienti: `cp.data_dismissione AS prep_composto_dismissione` e `cp.scadenza_prodotto AS prep_composto_scadenza`.
- Logica "prep" ora considera dismesso/scaduto anche se lo è **il composto padre**, non solo la preparazione.
- Nuovo prepared statement `stmtSostitutiPrepAltriComposti`: cerca preparazioni valide (`data_dismissione IS NULL`, non scadute) su composti **con lo stesso nome** ma `composti.id` diverso, non dismessi e non scaduti (considerando anche la rivalidazione).
- Il fallback parte solo se lo stesso-composto non ha restituito sostituti e il composto padre è dismesso/scaduto.

### Bug CRM Neat #2 — chiave card prep sbagliata in `srcs[].id`
**Root cause:** La card del prep stock è registrata con chiave `prep_${prep.id}` ([SchemaCalibrazione.grid.tsx:386,399](../../src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx#L386)), ma la prima versione del fix — replicando [ricostruisciWorkInSchema:569](../../src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L569) — emetteva `src.id = String(c.id)` (id del composto padre). Quindi `cardRefs.get(src.id)` non trovava niente e le frecce Neat non si disegnavano.

**Fix:** Nel blocco `prep` di `buildSrcsAndVols`, emetto ora `id: \`prep_${prepId}\`` con i campi attesi dal tipo [SorgenteSel](../../src/renderer/pages/metodi/SchemaCalibrazione.types.ts#L22-L34): `prepId`, `flacone`, `progressivo`, `lotto: null`, coerenti con quanto fa [togglePrepStock](../../src/renderer/pages/metodi/SchemaCalibrazione.tsx#L594) quando l'utente seleziona uno stock prep nell'UI. Il `prepId` viene letto da `ing.prep_id ?? ing.source_id`.

### Bug runtime — `no such column: progressivo`
**Root cause:** La query `getPrepFull` selezionava `progressivo` come se fosse una colonna di `preparazioni`, ma non lo è: il campo è **calcolato** via `COUNT(*)` subquery nel handler [`preparazioni:list-for-schema`](../../src/main/ipc/preparazioni.ipc.ts#L96). Errore sqlite al click su "Conferma e Ricarica" del dialog Neat.

**Fix:** `getPrepFull` ora usa una subquery `(SELECT COUNT(*) FROM preparazioni p2 WHERE p2.composto_id = p.composto_id AND p2.id <= p.id) AS progressivo`, identica a quella del handler ufficiale.

---

## File modificati

| File | Modifica |
|------|----------|
| [src/main/ipc/work.ipc.ts](../../src/main/ipc/work.ipc.ts) | `work:check-lot-status`: aggiunti `prep_composto_dismissione`/`prep_composto_scadenza` al SELECT ingredienti; nuovo `stmtSostitutiPrepAltriComposti`; logica prep considera stato composto padre. `work:ricarica`: aggiunta rigenerazione `srcs[]`/`vols[]` dagli ingredienti della nuova Work via `buildSrcsAndVols`; `INSERT OR IGNORE` in `composti_metodi` per i nuovi CRM; `getPrepFull` con subquery `COUNT(*)` per `progressivo`. |
| [src/renderer/pages/metodi/SchemaCalibrazione.tsx](../../src/renderer/pages/metodi/SchemaCalibrazione.tsx) | `onSuccess` del `RicaricaDialog` semplificato a `await reload() → schemaCalApi.get(metodoId) → setWorkCols(saved.workCols)` (niente più patch locale di `dbId` + `save`). |
| [docs/plans/active/new draft.md](new%20draft.md) | Modifica preesistente (non tocca questa sessione). |

---

## Note per sessioni future

- **Debito tecnico in [ricostruisciWorkInSchema](../../src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L480-L602):** lato renderer ha lo stesso bug del "Bug Neat #2" (emette `id: String(crm.id)` per i prep, linea 569). Non toccato perché fuori scope (usato solo nell'import Work da altri metodi) — se un giorno si importa una Work con ingrediente Neat, le frecce del Neat non si disegneranno nemmeno lì. Fix analogo a quello lato main (id `prep_<prepId>` + campi flacone/progressivo) quando sarà necessario.
- **`work:ricarica` ora aggiorna schema_json solo per `metodi_ids` passati** dal renderer: nessuna propagazione spuria in `work_metodi`. Attenzione se in futuro si permetterà di ricaricare da contesti dove `metodi_ids` non è valorizzato — verrebbe persa l'opportunità di rigenerare `srcs[]` per altri metodi che usano la stessa Work.
- **Fix applicati manualmente al DB dell'utente in sessioni precedenti** (Fix 2 INSERT in `composti_metodi`, Fix 3 edit schema_json DASOL con id 1128) non sono stati rollback-ati: restano nel DB dell'utente, ma non causano problemi perché il nuovo flusso li sovrascriverà correttamente al prossimo ciclo.
- **Piano originale:** `~/.claude/plans/joyful-waddling-planet.md` (non copiato in `docs/plans/active/` — il resoconto documenta tutto l'eseguito, il plan era intermedio).
- **Test end-to-end svolto dall'utente:** ricarica su Work con CRM Neat è ora funzionante (conferma in chat: "funziona").
- **Non testato:** ricarica su Work con sorgente `work` dipendente (multilivello). La logica è presente nel `buildSrcsAndVols` ma non verificata sul campo — la prima occasione utile vale la pena di un rapido check.
