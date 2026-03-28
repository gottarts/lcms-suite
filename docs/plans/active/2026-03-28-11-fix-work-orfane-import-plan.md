# Piano: Fix work orfane + import bloccato

**Data:** 2026-03-28

## Context

Due bug correlati con la stessa radice:

1. **Bug 1 (import)**: Una work W presente nello schema di M1 non appare nell'import dialog di M2, anche se M1 e M2 condividono analiti.
2. **Bug 2 (WorkPage orfane)**: Work in WorkPage mostrano `primo_metodo_id = M2`, ma aprendo M2 la work non è visibile nello schema.

**Causa radice**: Entries spurie in `work_metodi` — la tabella ha `(W, M2)` ma `schema_calibrazione.schema_json` di M2 non contiene W.

### Come si originano le entries spurie

`work:ricarica` inserisce la nuova work in `work_metodi` per TUTTI i `metodi_ids` passati dal renderer (`RicaricaDialog` usa `work.metodi_ids` = tutte le entries in work_metodi della vecchia work). Se la vecchia work aveva già entries spurie per M2, queste si propagano alla nuova work — ciclo vizioso.

Il filtro di import usava `AND w.id NOT IN (SELECT work_id FROM work_metodi WHERE metodo_id = ?)` — escludeva W da M2 anche quando W non era nel schema di M2 (entry spuria), bloccando Bug 1.

### Perché le fix della sessione precedente non avevano risolto

- **`work:ricarica` fix**: aggiornava `schema_json` di tutti gli schemi ma continuava a inserire `work_metodi` per tutti i metodi (anche quelli senza la work nel JSON) → le orfane si propagavano comunque.
- **`schema-cal:get` self-healing**: aggiungeva `work_metodi` entries (INSERT) durante un GET → non puliva le spurie, poteva generarne di nuove.

---

## Soluzione applicata

### File modificati

- `src/main/ipc/work.ipc.ts`
- `src/main/ipc/schemaCalibrazione.ipc.ts`

### 1. Fix `work:ricarica`

Fuso il doppio loop (INSERT work_metodi incondizionato + aggiornamento JSON) in un unico loop. `INSERT work_metodi` avviene **solo se** la work è trovata nel `schema_json` del metodo (`changed = true`). Le entries spurie non si propagano più alla nuova work.

### 2. Fix `work:list-for-import`

Rimossa la condizione `AND w.id NOT IN (SELECT work_id FROM work_metodi WHERE metodo_id = ?)`. Il renderer (`ImportaWorkDialog.tsx:41`) filtra già le work presenti nel schema via `schemaDbIds.has(w.id)`.

### 3. Cleanup passivo in `schema-cal:get`

Rimosso il self-healing (che aggiungeva entries). Aggiunto solo un DELETE passivo: rimuove da `work_metodi` le entries per questo metodo che non sono nel `schema_json`. Al primo caricamento di ogni schema, le orfane esistenti vengono pulite.

### 4. Sincronizzazione in `schema-cal:save`

Dopo l'UPSERT del `schema_json`, sincronizza `work_metodi`: DELETE spurie + INSERT mancanti. Garantisce coerenza permanente ad ogni salvataggio.

---

## Risultati verificati

- **Bug 1 risolto**: work di M1 appaiono nell'import di M2 anche se avevano entries spurie
- **Bug 2 risolto** (con cleanup one-shot): aprendo lo schema, le entries spurie vengono rimosse e il link in WorkPage scompare

## Feature idea per sessione futura

Work orfana in WorkPage: click su "Schema ↗" potrebbe aprire un dialog di aggiunta work allo schema (pre-compilato con i dati della work esistente, senza creare una nuova work nel DB). Applicabile solo alle work con link a uno schema in cui non sono presenti. L'import dialog normale non è sufficiente perché richiede che la work sia già in uno schema con analiti condivisi.
