# Resoconto sessione — Fix work create da schema + ripristino prep stock Neat

**Data:** 2026-04-08
**Oggetto:** Bugfix work non salvate da SchemaCalibrazione + ripristino rendering prep stock Neat

---

## Cosa è stato fatto

Sessione interamente dedicata a correggere due bug critici:

1. **Le work create da SchemaCalibrazione non apparivano in WorkPage** — bug introdotto dalla sessione precedente (commit `77ec82a`) che aveva un errore silenzioso nella transazione SQLite.
2. **I riquadri delle prep stock Neat erano scomparsi** dopo il revert del commit `77ec82a`, necessario per isolare e correggere il bug delle work.

Il percorso è stato tortuoso: inizialmente si credeva che il problema fosse solo il CHECK constraint su `source_type`, poi si è scoperto che il DB aveva già `user_version = 19` (dal vecchio commit revertato), poi che la tabella `work_ingredienti_new` era rimasta orfana da un tentativo di migration fallito, poi che `db.exec()` non supporta PRAGMA misto a DDL.

---

## Bug risolti / Feature aggiunte

### Bug: work create da SchemaCalibrazione non appaiono in WorkPage

**Root cause:** Il bug era multilivello:
1. La migration `019` del vecchio commit aggiungeva solo `prep_id` con `ALTER TABLE ADD COLUMN`, senza aggiornare il CHECK constraint `source_type IN ('crm', 'work')`. Quando `work:create` inseriva un ingrediente con `source_type = 'prep'`, SQLite violava il CHECK e la transazione andava in rollback silenzioso.
2. Il `try/catch` in `SchemaCalibrazione.tsx` ingoiava l'errore senza mostrarlo all'utente.
3. Dopo il revert, il DB aveva `user_version = 19` ma senza la colonna `prep_id` — la nuova migration `019` veniva saltata perché `19 > 19` è falso.
4. La migration ricreava la tabella con `work_ingredienti_new` ma `db.exec()` non supporta PRAGMA dentro script multi-statement → crash.
5. Una sessione di tentativi aveva lasciato `work_ingredienti_new` orfana nel DB.

**Fix applicato:**
- Migration rinominata `020` (numerazione superiore al `user_version` del DB)
- `db.ts`: `foreign_keys = OFF/ON` gestiti nel codice prima/dopo `db.exec()` (non nel SQL)
- Migration `020`: `DROP TABLE IF EXISTS work_ingredienti_new` come prima istruzione (cleanup tabella orfana)
- `work:create` in `work.ipc.ts`: aggiunto `try/catch` con `throw e` per propagare l'errore al renderer
- `SchemaCalibrazione.tsx`: `alert()` dell'errore invece di ingoiarlo silenziosamente

### Feature: ripristino rendering prep stock Neat in SchemaCalibrazione

**Motivazione:** Il revert di `77ec82a` aveva eliminato il rendering dei riquadri bianchi con le prep stock nelle chip dei CRM Neat.

**Implementazione:** Riapplicati chirurgicamente i cambiamenti relativi al rendering Neat (senza i bug del commit originale):
- `preparazioni.ipc.ts`: handler `preparazioni:list-for-schema`
- `SchemaCalibrazione.types.ts`: `PrepStockItem`, `SorgenteTipo = 'prep'`, `prepId`/`lotto` in `SorgenteSel`, `prepStock` in `CrmItem`
- `SchemaCalibrazione.logic.ts`: caricamento prep stock per Neat, gestione `tipo = 'prep'` in `getConcInfo`, `getCompsFromWork`, `salvaWorkNelDb`, `computeConnections`
- `SchemaCalibrazione.grid.tsx`: rendering riquadro Neat con prep stock interne, callback `onTogglePrepStock`
- `SchemaCalibrazione.tsx`: `togglePrepStock`, passato a `GrigliaAnalitiCrm`, drawer dettaglio work con `tipo = 'prep'`
- `work:create`, `work:update`, `work:ricarica` in `work.ipc.ts`: `insertIngrPrep` separato per `source_type = 'prep'`

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/db.ts` | `foreign_keys OFF/ON` nel loop migration + logging |
| `src/main/migrations/020-work-ingredienti-prep.sql` | Nuova migration: ricrea `work_ingredienti` con CHECK `('crm','work','prep')` + colonna `prep_id` |
| `src/main/ipc/preparazioni.ipc.ts` | Aggiunto handler `preparazioni:list-for-schema` |
| `src/main/ipc/work.ipc.ts` | `work:create/update/ricarica` con `insertIngrPrep` per `source_type='prep'`; try/catch esplicito in `work:create` |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | `PrepStockItem`, `SorgenteTipo='prep'`, `prepId/lotto` in `SorgenteSel`, `prepStock` in `CrmItem` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Caricamento prep stock Neat, gestione `tipo='prep'` in tutte le funzioni |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rendering riquadro Neat con prep stock, `onTogglePrepStock` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `togglePrepStock`, drawer dettaglio work per `tipo='prep'`, alert errore |

---

## Note per sessioni future

- **Stato finale:** il fix della migration `020` è stato applicato ma **non ancora verificato funzionante** — la sessione si è chiusa prima della verifica finale. Al prossimo avvio dell'app la migration `020` dovrebbe girare correttamente (DROP IF EXISTS + no PRAGMA nel SQL).
- **⚠️ Verificare al prossimo avvio:** guardare i log `[migrations]` per confermare che `020` venga applicata senza errori, poi testare la creazione di una work da SchemaCalibrazione.
- **Alert temporaneo:** `SchemaCalibrazione.tsx` ha un `alert()` per mostrare errori di `work:create` — utile per il debug ma da rimuovere o sostituire con un toast una volta che il bug è confermato risolto.
- **Logging in db.ts:** i `console.log` aggiunti a `runMigrations` sono utili per il debug ma possono essere rimossi una volta che le migration sono stabili.
- **work:ricarica:** aggiornato per gestire `source_type='prep'` ma non testato.
