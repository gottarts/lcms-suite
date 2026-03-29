# Resoconto sessione — Feature gestione lotti work (blocco + ricarica schema)

**Data:** 2026-03-25
**Oggetto:** Gestione validità lotti CRM nelle work — blocco preparazioni, archiviazione, ricarica schema

---

## Cosa è stato fatto

Implementata la Feature A del piano `hidden-orbiting-lemur`: gestione completa del ciclo di vita dei lotti CRM nelle work. Quando un CRM viene dismesso, le work che lo referenziano vengono automaticamente bloccate (impossibile fare nuove preparazioni), con possibilità di "ricaricare" la work usando i lotti attivi correnti. La vecchia work viene archiviata con soft-delete preservando tutto lo storico.

---

## Feature aggiunta

### Snapshot lotto al momento della creazione (DB + backend)
**Motivazione:** `work_ingredienti` referenziava solo `source_id` (composti.id) senza mai salvare il lotto usato. Se il lotto veniva modificato o dismesso, non c'era traccia di quale lotto fosse stato usato alla creazione della work.
**Implementazione:** Aggiunto campo `lotto_usato TEXT` in `work_ingredienti` (migrazione 017). I handler `work:create` e `work:update` eseguono ora `SELECT lotto FROM composti WHERE id=?` dentro la transazione e popolano `lotto_usato` per ogni ingrediente CRM.

### Soft-delete / archiviazione work
**Motivazione:** Le work superate (per cambio lotto) non devono essere cancellate — conservano storico preparazioni, ingredienti, tracciabilità.
**Implementazione:** Aggiunti 4 campi a `work`: `archiviato`, `archiviato_at`, `archiviato_motivo`, `sostituito_da_id`. `work:list` filtra automaticamente le work archiviate (`WHERE archiviato = 0 OR archiviato IS NULL`). Nuovo handler `work:archivia`.

### Flag `bloccata` e rilevamento dismissioni
**Motivazione:** L'operatore deve sapere in modo evidente quando una work ha CRM dismessi, senza dover andare ad ispezionare ogni ingrediente.
**Implementazione:** `work:list` calcola `n_ingredienti_bloccati` con subquery su `composti.data_dismissione`; mappa a `bloccata: boolean`. `work:get` aggiunge `source_dismissione` per ogni ingrediente CRM. Nuovo handler `work:check-lot-status` classifica ogni ingrediente come `ok / auto / ambiguo / mancante` cercando sostituti attivi con stesso `nome`.

### Ricarica schema (sostituzione atomica work)
**Motivazione:** Quando una work è bloccata, l'operatore deve poter "ricreare" la work con i lotti attuali in modo guidato. La vecchia work deve restare archiviata con link alla nuova.
**Implementazione:** Nuovo handler `work:ricarica`: crea nuova work con stessi metadati, copia ingredienti con `source_id` sostituiti, aggiorna `lotto_usato`, collega ai stessi metodi, archivia la vecchia con `archiviato_motivo`. Operazione atomica in transazione.

### UI — WorkPage
- Badge rosso "CRM dismessi" su WorkCard quando `work.bloccata`
- Pulsante "Prepara/Rinnova" disabilitato con tooltip esplicativo
- Pulsante arancione "Ricarica lotti" visibile solo per work bloccate
- `RicaricaDialog` montata in WorkPage

### UI — WorkDrawer
- Banner arancione "Uno o più lotti CRM sono stati dismessi" in cima al drawer
- Pulsante "Registra/Rinnova preparazione" disabilitato quando bloccata
- In sezione Composizione: tag rosso "DISMESSO" sull'ingrediente + riga `lotto_usato` in mono rosso
- Fix bug: sezione "Metodi associati" usava `work.metodi` (array di oggetti, mai popolato) invece di `work.metodi_ids` (string[], quello che ritorna il backend)

### UI — RicaricaDialog (nuovo componente)
- Carica `checkLotStatus` e `workApi.get` in parallelo all'apertura
- Mostra 4 sezioni: OK (verde), Automatico (giallo), Scelta richiesta (select per ambigui), Mancante (rosso, blocca il tasto Conferma)
- On success: chiama `onSuccess(newWorkId)` per aggiornare la lista

### UI — SchemaCalibrazione
- Lotto CRM ora visibile nelle chip dei singoli (riga mono grigia sotto concentrazione)
- `blockedMap: Map<number, boolean>` calcolata con `useEffect` dopo il caricamento schema (una call `workApi.get` per ogni work con dbId)
- Pulsante "Ricarica ↻" (arancione, posizione absolute in basso a destra nella card) visibile solo per work bloccate
- On success ricarica: aggiorna `dbId` in workCols per puntare alla nuova work, il `useEffect` si riesegue e pulisce il flag

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/migrations/017-work-lot-snapshot.sql` | Nuovo — aggiunge `lotto_usato`, campi archivio su `work` |
| `src/shared/types.ts` | Aggiunti campi archivio a `Work`, `lotto_usato`+`source_dismissione` a `WorkIngrediente`, nuovo tipo `WorkIngredienteLotStatus` |
| `src/main/ipc/work.ipc.ts` | Snapshot `lotto_usato`, flag `bloccata`, filtro archiviati, 3 nuovi handler |
| `src/renderer/lib/api.ts` | Aggiunti `archivia`, `checkLotStatus`, `ricarica` a `workApi` |
| `src/renderer/pages/work/WorkPage.tsx` | Badge, disable Prepara, pulsante Ricarica, monta RicaricaDialog |
| `src/renderer/pages/work/WorkDrawer.tsx` | Banner bloccata, disable prep, lotto_usato/DISMESSO, fix metodi_ids |
| `src/renderer/pages/work/RicaricaDialog.tsx` | Nuovo componente — dialog risoluzione lotti |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | blockedMap, useEffect check, pulsante Ricarica in card, RicaricaDialog |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Lotto visibile in chip CRM singoli |

---

## Note per sessioni future

- **Feature B (work sharing tra metodi)** non implementata — design in `docs/plans/active/2026-03-25-feat-gestione-lotti-work-plan.md`. L'infrastruttura DB (`work_metodi` molti-a-molti) è già pronta; manca solo l'UI per importare una work esistente in un nuovo schema.
- **Filtro per metodo in WorkPage** — annotato nel draft come "nella card delle work deve esserci la selezione del metodo come filtro". Non fatto in questa sessione.
- **Archivio schemi calibrazione** — annotato nel draft come prossima feature importante: salvare versioni degli schemi con destinazione d'uso (taratura, QC, IS) e archiviabilità.
- Il `useEffect` che popola `blockedMap` in SchemaCalibrazione ha `eslint-disable-next-line` intenzionale — dipende da `workCols` (giusto) ma non da `workApi.get` (stabile).
- **`work:archivia` non è esposta nell'UI**: l'handler esiste nel backend e nell'API renderer, ma nessun componente lo chiama direttamente. L'unico modo in cui una work viene archiviata è tramite la **Ricarica** (il backend la archivia in automatico nella stessa transazione). Non esiste un pulsante "Archivia" nell'interfaccia. Le work archiviate non sono visibili da nessuna UI — se serve consultarle si deve accedere al DB direttamente. Valutare se aggiungere un toggle "mostra archiviate" in WorkPage.
- Piano di questa sessione: `docs/plans/active/2026-03-25-feat-gestione-lotti-work-plan.md`
