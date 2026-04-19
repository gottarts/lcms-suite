# Tracciabilità ricorsiva Work intermedie

## Context

Quando una Work usa un'altra Work come sorgente (`source_type='work'` in `work_ingredienti`), il sistema oggi perde la tracciabilità:

1. **Sorgenti/ingredienti**: `work:get` torna solo `source_nome` della work madre, senza espandere i CRM e le prep contenuti ricorsivamente.
2. **Composti della Work**: la WorkFinale non elenca i composti derivati dalle Work intermedie; nel Dashboard Audit sfruttiamo `getCompsFromWork` ma passiamo `workCols = [[]]`, quindi le Work-dipendenti finiscono in `extraSrcs` e `ricostruisciWorkInSchema` ritorna `null` (vedi [auditModel.ts:161-170](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/dashboard/lib/auditModel.ts#L161-L170) e [SchemaCalibrazione.logic.ts:594](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L594)).
3. **Calcoli**: quando la sorgente è una Work, la diluizione non prende la concentrazione dei composti dentro la Work (si perde perché `getCompsFromWork` non la raggiunge).
4. **SchemaCalibrazione**: i flag `ha_crm_scaduti` / `ha_prep_scadute` di `work:get` ([work.ipc.ts:207-240](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/main/ipc/work.ipc.ts#L207-L240)) guardano solo gli ingredienti diretti, non attraversano le Work madri.
5. **Dashboard Audit**: non mostra le Work contenute come entità né i loro badge di scadenza, né offre link al dettaglio/archivio.

La tracciabilità ricorsiva esiste lato renderer dentro `getCompsFromWork` (usa `visited: Set` anti-ciclo), ma richiede che TUTTE le Work dipendenti siano già presenti in `workCols`. Fuori da SchemaCalibrazione questa pre-condizione non è soddisfatta.

**Outcome atteso**: una WorkFinale che usa Work_A + CRM_C espone (a) lista ricorsiva dei CRM/prep coinvolti con la concentrazione corretta, (b) flag di scadenza/dismissione che propagano dai nodi foglia, (c) rappresentazione completa nel Dashboard Audit con link e badge, (d) evidenze nello SchemaCalibrazione quando una Work sorgente ha problemi, così da poter archiviare e ricostruire.

## Decisioni

- **Core logic ricorsivo in IPC main** (nuovo handler `work:expand-tree`). Fonte unica di verità anche per i flag `ha_crm_scaduti`/`ha_prep_scadute`/`bloccata` di `work:get`.
- **Link Audit → WorkPage** con filtro preselezionato via query-param (include archivio filtrato). Piccolo supporto da aggiungere in `WorkPage.tsx`.
- **Evidenze SchemaCalibrazione: badge + tooltip**, nessun pulsante extra (l'utente usa il flusso di archiviazione/ricreazione esistente).

## Files critici

- [src/main/ipc/work.ipc.ts](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/main/ipc/work.ipc.ts) — handler `work:get`, `work:check-lot-status`, aggiunta nuovo handler ricorsivo
- [src/renderer/pages/metodi/SchemaCalibrazione.logic.ts](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — `getCompsFromWork`, `ricostruisciWorkInSchema` (riuso, non tocchiamo la firma)
- [src/renderer/pages/dashboard/lib/auditModel.ts](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/dashboard/lib/auditModel.ts) — `buildAuditModel` e `toDbWorkShape`
- [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/dashboard/sections/AuditCrmSection.tsx) — UI riga Work con badge e link
- [src/renderer/pages/work/WorkDrawer.tsx](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/work/WorkDrawer.tsx) — dettaglio Work (composti attesi + alert sorgenti)
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/metodi/SchemaCalibrazione.tsx) — badge di errore sulle card Work quando una sorgente è invalida

## Piano

### 1 — Espansione ricorsiva delle Work (main/IPC)

Creare una utility pura `expandWorkTree(db, workId, visited)` in un nuovo file `src/main/services/workTree.ts` (o dentro `work.ipc.ts` se preferito, ma tenerla separata aiuta il riuso):

- Legge `work` + `work_ingredienti` di `workId`.
- Per ogni ingrediente:
  - `crm` / `prep` → nodo foglia con `source_id`, `source_type`, `nome`, `lotto`, `scadenza_effettiva`, `data_dismissione`, `concentrazione`, `unita_conc`, `mix_id`.
  - `work` → ricorsione su `source_id` con `visited.add(workId)` anti-ciclo.
- Ritorna `{ work_id, work_nome, leaves: Leaf[], children_works: ExpandedWork[], problemi: { crm_scaduti, crm_dismessi, prep_scadute, prep_dismesse, work_scadute, work_bloccate } }`.
- La ricorsione propaga verso l'alto i contatori problemi (OR logico) così ogni livello sa se c'è qualcosa sotto.

Nuovo handler IPC `work:expand-tree` che wrappa `expandWorkTree` e torna il tree piatto + gli aggregati problemi. Questo è la fonte di verità unica per tutta la UI.

**Sostituzione calcoli flag esistenti**: i calcoli di `nBloccati`/`nScaduti`/`nPrepScadute` dentro `work:get` vengono rifatti usando `expandWorkTree(workId)` così anche le Work figlie ereditano correttamente `ha_crm_scaduti`/`ha_prep_scadute`/`bloccata`. Preservare i nomi dei campi già ritornati da `work:get` per non rompere i consumer.

### 2 — Calcolo concentrazioni ricorsivo

Opzione raccomandata: spostare la logica di `getCompsFromWork` in una funzione pura condivisa `computeCompostiFromWorkTree(tree, crmById)` in `src/shared/workCalc.ts` (o renderer-only in `src/renderer/lib/workCalc.ts` se non serve in main).

- Input: albero da `work:expand-tree` + indice CRM per id.
- Stessa matematica di [SchemaCalibrazione.logic.ts:362-417](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L362-L417): per ogni ingrediente calcola `dilFactor` (modo `dil` → `1/fattore`, modo `conc` → `concTarget/cv`, fallback `conc_work/cv`); per sorgenti work ricorre e moltiplica; per mix espande i componenti.
- Output: `CompostoInWork[]` con `nome`, `concInWork`, `unita`, `srcPath`.

`getCompsFromWork` in SchemaCalibrazione resta com'è (è dentro un contesto `WorkInSchema`, non è il posto per toccarlo — la CLAUDE.md vieta semplificazioni). Il nuovo util è solo per i path che oggi passano `workCols=[[]]` (Audit, WorkDrawer dettaglio).

### 3 — Dashboard Audit: Work + CRM ricorsivi

In `auditModel.ts`:

- Sostituire il fallback di [auditModel.ts:174-184](../../Documents/Personali/Chem/Arpa/LCMS%20Suite%20Progetto/lcms-suite/src/renderer/pages/dashboard/lib/auditModel.ts#L174-L184) con `computeCompostiFromWorkTree` alimentato dal nuovo IPC (il preload espone `works_registrati` con già l'albero serializzato, oppure si fa una chiamata IPC per ogni work prima di `buildAuditModel`).
- Popolare `crmUsatiInWork` attraversando anche `children_works.leaves` (oggi guarda solo `ing` diretti, riga 195-226).
- `ha_crm_scaduti` / `ha_prep_scadute_at_data` già arrivano corretti dal nuovo `work:get`.

In `AuditCrmSection.tsx`:

- Per ogni `AuditWorkRow`, aggiungere una riga espandibile che mostra:
  - Badge di scadenza della Work stessa (già c'è `stato_work`).
  - Sotto-sezione "Work intermedie" con una riga per child work (nome, scadenza, stato, badge errori) con link al dettaglio (apre `WorkDrawer` in modalità view).
  - Sotto-sezione "CRM coinvolti" (foglie ricorsive) già presenti come `crm_ingredienti` per analita, ma aggiungerne una lista aggregata a livello work.
- Link "Vedi nella WorkPage" con filtro preselezionato sull'ID della work (route esistente + query param, verificare se WorkPage supporta `?workId=`; se no, aggiungere lettura query param minimale in `WorkPage.tsx`).
- Badge "archiviata" se `archiviate_alla_data === true`.

### 4 — SchemaCalibrazione: evidenze sorgenti invalide

Le card `WorkInSchema` oggi non mostrano un badge globale per "una mia sorgente è scaduta/dismessa". Estensioni puntuali:

- In `SchemaCalibrazione.tsx`, per ogni Work nella griglia, chiamare `work:expand-tree` (una volta per work, cached) e calcolare un flag `hasInvalidSource = problemi.crm_scaduti||crm_dismessi||prep_scadute||prep_dismesse||work_scadute||work_bloccate`.
- Aggiungere un badge rosso / tooltip sulla card (il componente card è in `SchemaCalibrazione.grid.tsx` — individuare dove si renderizzano i chip esistenti e aggiungere il nuovo senza toccare il layout).
- Nessuna nuova azione: l'utente già sa come archiviare + ricreare dalla WorkPage. Il badge è segnale visivo sufficiente.

### 5 — WorkDrawer: lista composti attesi + alert sorgenti

Oggi WorkDrawer mostra gli ingredienti diretti. Aggiunta:

- Sezione "Composti attesi in questa Work" popolata da `computeCompostiFromWorkTree` (nome, conc, unità, percorso sorgente). Readonly, serve solo visualizzazione.
- Per ogni ingrediente `source_type='work'`, aggiungere un chip rosso "Sorgenti con problemi" se il tree di quella child work ha `problemi.*` > 0, con tooltip che elenca CRM/prep problematici.

### 6 — Verifica end-to-end

1. **DB**: preparare tramite UI (o direttamente sul `.db` di test) uno scenario: `CRM_A`, `CRM_B`, `CRM_C` validi; Work_A usa `CRM_A`+`CRM_B`; WorkFinale usa Work_A + `CRM_C`.
2. **Espansione**: `invoke('work:expand-tree', WorkFinale.id)` → leaves = [CRM_A, CRM_B, CRM_C], children = [Work_A con leaves [CRM_A, CRM_B]].
3. **Ciclo guard**: creare manualmente un ciclo (Work_X sorgente di Work_Y sorgente di Work_X) e verificare che `visited` eviti stack overflow.
4. **Concentrazioni**: configurare diluizioni reali (es. Work_A: 10→100 mg/L dilita 1/10 di CRM_A 1000 mg/L; WorkFinale: 1→10 mg/L dilita 1/10 di Work_A) e confermare che `CompostoInWork.concInWork` esca a 1 mg/L per i composti di Work_A dentro WorkFinale.
5. **Scadenze propagate**: dismettere `CRM_A`, verificare che `work:get(WorkFinale.id)` ora torni `ha_crm_scaduti=true` / `bloccata=true`. Idem per `work:get(Work_A.id)`.
6. **Audit Dashboard**: aprire la sezione Audit per un metodo che include WorkFinale → deve comparire la riga Work con badge coretti e child works con link.
7. **SchemaCalibrazione**: aprire uno schema con WorkFinale → badge rosso su Work_A (e propagato a WorkFinale).
8. **WorkDrawer**: aprire WorkFinale → "Composti attesi" elenca CRM_A, CRM_B, CRM_C con concentrazioni giuste; chip rosso su Work_A se i suoi CRM sono dismessi.
9. **Type-check + build**: `npm run typecheck` e avvio `npm run dev` per verifica UI.

## Scope escluso

- **Refactoring di `getCompsFromWork` dentro SchemaCalibrazione**: rischio regressione alto (vedi CLAUDE.md — commit `2c4eabd`). Il nuovo util vive affianco.
- **Modifiche schema DB**: tutto si risolve con query ricorsive SQLite + logica in `main`. Nessuna migration.
- **View materialized**: non necessaria alla scala attuale; se in futuro si vedono lentezze, si può aggiungere una CTE ricorsiva o una tabella cache.
