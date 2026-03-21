# Piano: Fix sincronizzazione metodo_analiti al salvataggio metodo

## Contesto

La feature `metodo_analiti` (lista persistente di analiti per metodo) è stata implementata con una logica **solo-aggiunta**: quando si modificano i composti associati a un metodo, gli analiti vengono aggiunti a `metodo_analiti` ma **mai rimossi**. Questo causa un bug visibile: se si rimuove un composto dal metodo, il suo analita rimane nella lista e appare in SchemaCalibrazione come "analita senza CRM disponibile".

## Causa del bug

In `metodi:update` (e analogamente in `metodi:merge`), la transazione:
1. Cancella tutti i link `composti_metodi` → ✅
2. Reinserisce solo i link selezionati → ✅
3. Aggiunge analiti con `INSERT OR IGNORE` → ✅
4. **Non cancella gli analiti rimossi** → ❌ mancante

## Fix proposto

### File: `src/main/ipc/metodi.ipc.ts`

**In `metodi:update`** — cancellare tutti gli analiti del metodo prima del reinserimento (stesso pattern già usato per `composti_metodi`):

```typescript
// Aggiungere prima del loop:
const deleteAllAnaliti = db.prepare('DELETE FROM metodo_analiti WHERE metodo_id = ?')

// Nella transazione, dopo deleteLinks.run(id):
deleteAllAnaliti.run(id)
// poi il loop dei composti che fa INSERT OR IGNORE rimane invariato
```

**In `metodi:merge`** — stesso approccio: dopo l'unione dei composti, ricalcolare gli analiti da zero invece di solo appendere.

## File da modificare

| File | Modifica |
|------|----------|
| `src/main/ipc/metodi.ipc.ts` | `metodi:update` e `metodi:merge`: aggiungere DELETE metodo_analiti prima del reinserimento |

## Nota di design

La cancellazione automatica si applica solo ai composti rimossi **tramite il form metodo**. Gli analiti aggiunti manualmente dall'utente (tramite `metodo-analiti:add`) **verranno anch'essi rimossi** se non corrispondono a un composto attivo. Questo è accettabile perché:
- L'aggiunta manuale serve per analiti senza CRM nel DB
- Se il composto viene poi aggiunto al DB e collegato al metodo, viene reinserito automaticamente
- L'utente può sempre riaggiungere analiti manualmente dopo il salvataggio

## Verifica

1. Aprire un metodo con N composti collegati → verificare che `metodo_analiti` contenga N analiti
2. Modificare il metodo rimuovendo un composto → salvare
3. Riaprire lo schema calibrazione → l'analita rimosso non deve più apparire
4. Verificare che gli analiti restanti siano ancora presenti
