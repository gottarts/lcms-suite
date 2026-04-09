# Piano: Fix bug "ricomincia da zero" sgancia work dal metodo

## Context

Quando l'utente preme "Ricomincia da zero" in SchemaCalibrazione, la funzione `handleFullReset`
salva uno schema vuoto (`[[]]`) nel DB. Il salvataggio chiama `schema-cal:save` che, trovando
zero `dbId`, esegue:

```sql
DELETE FROM work_metodi WHERE metodo_id = ?
```

Questo rimuove **tutti i link work↔metodo** per quel metodo. Le work esistono ancora nella
tabella `work`, ma sono ora orfane: `metodi_ids` diventa `[]`.

In WorkPage questo causa:
- Le card perdono il badge del metodo
- `primo_metodo_id` diventa NULL → sparisce il pulsante "Schema ↗"
- Il filtro per metodo non le include più

Il comportamento è **buggy** perché le work già create devono rimanere "congelate" e collegate
al metodo: rappresentano lo storico di cosa è stato prodotto. Il reset riguarda solo la struttura
dello schema futuro, non le work già esistenti.

## Causa radice

In `schemaCalibrazione.ipc.ts` riga 50, il branch `else` (zero dbId) è troppo aggressivo:
elimina **tutti** i link, inclusi quelli di work già "committatate" (con `dbId` nel JSON).

Il problema è che dopo il reset il JSON `workCols` è `[[]]` — nessun `dbId` — ma le work
create in precedenza esistono ancora nel DB e devono mantenere il link.

## Soluzione

Il `schema-cal:save` deve sincronizzare `work_metodi` **solo rispetto ai dbId presenti nel JSON**,
senza mai eliminare link di work che esistono realmente nel DB (cioè work con record in `work`).

La regola corretta: rimuovere da `work_metodi` solo le righe dove `work_id` **non** è presente
nella tabella `work` (link orfani) OPPURE dove la work non ha un corrispondente `dbId` nel JSON
**ma non è nemmeno una work reale del DB**.

Wait — più semplice: la source of truth deve essere il JSON SOLO per work che sono state create
da questo schema. Le work create da uno schema precedente devono rimanere legate.

**Approccio corretto:**

Nel `schema-cal:save` e `schema-cal:get`, invece di eliminare brutalmente tutti i link quando
`dbId.length === 0`, non toccare i link esistenti quando il JSON è vuoto/reset.

La sincronizzazione deve essere:
- **Aggiungere** i link per tutti i dbId presenti nel JSON (già funziona)
- **Rimuovere** i link solo per work che non esistono più nel DB (link davvero orfani)
- **Mai rimuovere** link di work reali solo perché il JSON è stato azzerato

In pratica: nel branch `else` e nel DELETE del branch `if`, la condizione di rimozione
deve escludere le work che esistono nella tabella `work`.

### Modifica in `schemaCalibrazione.ipc.ts`

**Caso con dbIds > 0** (riga 44):
```sql
-- ATTUALE (rimuove work reali non nel JSON):
DELETE FROM work_metodi WHERE metodo_id = ? AND work_id NOT IN (dbIds)

-- NUOVO (rimuove solo work che non esistono nel DB):
DELETE FROM work_metodi 
WHERE metodo_id = ? 
  AND work_id NOT IN (dbIds)
  AND work_id NOT IN (SELECT id FROM work)
```

Wait, questo è sbagliato — se una work è nel DB ma non nel JSON, la vogliamo mantenere,
non rimuovere. Il punto è che il JSON dopo il reset non lista le vecchie work, ma quelle
devono restare legate.

**Approccio definitivo:**

La logica di sincronizzazione `work_metodi` nel `schema-cal:save` deve essere completamente
rimossa o resa non-distruttiva. Il `work_metodi` viene già gestito correttamente al momento
della creazione della work (`work:create` con `metodi_ids`). Il `schema-cal:save` non dovrebbe
mai rimuovere link esistenti — deve solo aggiungerne di nuovi.

Rimuovere la cancellazione da `schema-cal:save`. La pulizia di link orfani (work eliminate)
avviene già tramite ON DELETE CASCADE sulla FK `work_metodi.work_id → work(id)`.

### File da modificare

**`src/main/ipc/schemaCalibrazione.ipc.ts`**

1. In `schema-cal:save` (riga 42-51): rimuovere il blocco DELETE. Tenere solo gli INSERT OR IGNORE.
2. In `schema-cal:get` (riga 17-23): rimuovere il "cleanup passivo" che cancella link.

Entrambi i blocchi di DELETE vanno rimossi. Il CASCADE sul DB gestisce già i link orfani
quando una work viene eliminata.

## File critici

- `src/main/ipc/schemaCalibrazione.ipc.ts` — unico file da modificare

## Verifica

1. Creare uno schema con work, confermarlo (work create nel DB con link metodo)
2. Andare in WorkPage → verificare che le work mostrano badge metodo
3. Tornare in SchemaCalibrazione → "Ricomincia da zero"
4. Tornare in WorkPage → le work devono ancora mostrare badge metodo e pulsante "Schema ↗"
5. Eliminare una work dal DB → verificare che il link sparisce (ON DELETE CASCADE)
