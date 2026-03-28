# Resoconto sessione — Fix work orfane + import bloccato

**Data:** 2026-03-28

## Problema originale (dalla sessione precedente)

Due bug correlati rimasti aperti:

1. **Bug import**: Work presenti nello schema di M1 non apparivano nell'import dialog di M2, anche se M1 e M2 condividevano analiti.
2. **Bug orfane**: Work in WorkPage mostravano un link "Schema ↗" a M2, ma aprendo M2 la work non era nello schema.

Le fix della sessione precedente (self-healing in `schema-cal:get` e update JSON in `work:ricarica`) non avevano risolto perché il problema era a monte: entries spurie in `work_metodi` che si propagavano.

## Analisi della causa radice

**Entries spurie in `work_metodi`**: la tabella aveva `(W, M2)` ma `schema_calibrazione.schema_json` di M2 non conteneva W.

Come si originano:
- `work:ricarica` inseriva la nuova work in `work_metodi` per TUTTI i `metodi_ids` della vecchia work, indipendentemente da se la vecchia work era effettivamente nel `schema_json` di quel metodo
- Risultato: se la vecchia work aveva entries spurie, la nuova le ereditava — ciclo vizioso

Il filtro di import (`NOT IN work_metodi`) escludeva work con entries spurie anche quando non erano nel schema, bloccando l'import.

## Modifiche applicate

### `src/main/ipc/work.ipc.ts`

**`work:ricarica`**: Fuso il doppio loop separato (INSERT work_metodi + aggiornamento JSON) in un loop unico. `INSERT work_metodi` avviene ora solo se la work è trovata nel `schema_json` del metodo. Le entries spurie non si propagano più.

**`work:list-for-import`**: Rimossa la condizione `AND w.id NOT IN (SELECT work_id FROM work_metodi WHERE metodo_id = ?)`. Il renderer filtra già le work presenti nel schema tramite `schemaDbIds`.

### `src/main/ipc/schemaCalibrazione.ipc.ts`

**`schema-cal:get`**: Rimosso il self-healing (sbagliato: aggiungeva entries anziché pulirle). Aggiunto cleanup passivo: `DELETE FROM work_metodi WHERE metodo_id = ? AND work_id NOT IN (dbIds nel JSON)`. Al primo caricamento di ogni schema, le orfane esistenti vengono eliminate.

**`schema-cal:save`**: Aggiunta sincronizzazione `work_metodi` dopo l'UPSERT: DELETE spurie + INSERT mancanti. Garantisce coerenza permanente ad ogni salvataggio (source of truth = `schema_json`).

## Risultati

- **Bug import risolto**: work di M1 ora appaiono nel dialog di import di M2
- **Bug orfane risolto**: le entries spurie vengono pulite al primo caricamento dello schema; il link in WorkPage scompare dopo quella prima apertura (effetto one-shot di cleanup)

## Feature idea per sessione futura

Work orfana in WorkPage: click su "Schema ↗" potrebbe aprire un dialog per aggiungere la work allo schema pre-compilato (senza ricreare la work nel DB, solo aggiungendo il link). Utile perché l'import dialog normale richiede che la work sia già in uno schema con analiti condivisi.
