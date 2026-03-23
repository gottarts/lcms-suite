# Resoconto sessione — 2026-03-23

## Oggetto
CRM SchemaCalibrazione: sorgente per nome analita, mix completi

## Problema affrontato
SchemaCalibrazione caricava i CRM tramite `composti:list({ metodo_id })` che usa JOIN su `composti_metodi`. Quando un analita veniva rimosso dal metodo, il link `composti_metodi` veniva cancellato e il CRM spariva dallo schema. Inoltre la card mix mostrava solo i componenti che erano analiti del metodo, non il contenuto reale del mix.

## Lavoro svolto

### Nuovo handler IPC `composti:list-for-schema`
- **File:** `src/main/ipc/composti.ipc.ts`
- Query in due passi: trova singoli CRM per nome analita + trova mix che contengono almeno un analita e carica TUTTI i componenti di quei mix
- Non dipende da `composti_metodi` — i CRM appaiono nello schema se il nome corrisponde a un analita del metodo

### useSchemaData() aggiornato
- **File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`
- Cambiato invoke da `composti:list` a `composti:list-for-schema`

### Card mix: contenuto reale
- **File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`
- I chip nella card mix ora mostrano TUTTI i componenti del mix (non solo gli analiti)
- Componenti analiti: chip pieno (colore solido)
- Componenti non-analiti: chip tenue (sfondo leggero, opacità ridotta)

### MetodoDrawer aggiornato
- **File:** `src/renderer/pages/metodi/MetodoDrawer.tsx`
- Sorgente dati cambiata da `compostiApi.list` a `metodoAnalitiApi.list`
- Header: "Analiti del metodo (N)" invece di "Composti associati (N sostanze, M lotti)"

### API frontend
- **File:** `src/renderer/lib/api.ts`
- Aggiunto `listForSchema` a `compostiApi`

## File modificati (5)
1. `src/main/ipc/composti.ipc.ts` — nuovo handler `composti:list-for-schema`
2. `src/renderer/lib/api.ts` — aggiunto `listForSchema`
3. `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — cambio invoke CRM
4. `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` — chip mix con tutti i componenti
5. `src/renderer/pages/metodi/MetodoDrawer.tsx` — sorgente analiti + label

## Decisioni di design
- Creato handler separato `composti:list-for-schema` per non toccare `composti:list` (usato da MetodoForm, CompostiPage, ecc.)
- Mix completi: se un mix contiene anche solo un analita del metodo, tutti i componenti del mix vengono caricati
- Distinzione visiva tra componenti analiti e non-analiti nei chip della card mix

## Stato
Implementazione completata. Richiede test manuale con dati reali.
