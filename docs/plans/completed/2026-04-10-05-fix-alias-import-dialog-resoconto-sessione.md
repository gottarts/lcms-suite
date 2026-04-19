# Resoconto sessione — Refactor AliasImportDialog (import alias LIMS/OQLab)

**Data:** 2026-04-10
**Oggetto:** Refactor completo di AliasImportDialog per correggere semantica mapping colonne e aggiungere creazione nuovi parametri — funzionalità attualmente NON operativa

---

## Cosa è stato fatto

Tentativo di refactoring di `AliasImportDialog.tsx` per correggere la semantica sbagliata del dialog originale e aggiungere le feature richieste:

- Nuova struttura `ColMapping` con 4 campi opzionali (nomeParametro, aliasLims, aliasOqlab, aliasStrumento)
- Logica di match: fuzzy su LIMS/OQLab oppure match esatto su nomeParametro
- Nuovo status `'new'` per parametri da creare + sezione dedicata in review
- Chiamata a `metodoAnalitiApi.add()` prima di `bulkUpdateAlias()` per creare parametri nuovi
- Anteprima file con colonne A/B/C (senza assumere header)
- Toggle "Prima riga = intestazione" (aggiunto e poi rimosso su richiesta utente — da reimplementare riusando il pattern di ImportDialog.tsx)
- Step mapping con colori per identificare visivamente le colonne assegnate
- Blocco fisico: ogni colonna assegnabile a un solo campo

---

## Bug risolti / Feature aggiunte

### NESSUN BUG RISOLTO — funzionalità attualmente non operativa

La funzionalità di import alias non scrive nulla in DB. I bug identificati durante la sessione ma non risolti sono documentati di seguito.

---

## Bug identificati (non risolti)

### Bug 1 — `bulkUpdateAlias` non aggiorna il DB
**Root cause:** Non ancora definitivamente identificata. Il log mostra `{ ok: true }` ma i valori non compaiono in tabella. Sospettata catena: o i valori alias nell'oggetto update sono tutti `null` (perché la colonna non era mappata correttamente), oppure il WHERE `LOWER(nome) = LOWER(?)` non trova righe.
**Stato:** Non risolto. Richiede debug con log nel main process (`info.changes` dalla `db.prepare().run()`) per vedere se SQLite aggiorna 0 righe.

### Bug 2 — Step mapping: colonna singola mappata a tutti i campi
**Root cause:** Con un file a una sola colonna, l'utente assegnava la stessa colonna a tutti e quattro i campi, producendo `alias_lims = alias_oqlab = alias_strumento = stesso valore`. Aggiunto blocco fisico (ogni colonna disponibile solo per un campo), ma questo non risolve il bug principale di scrittura DB.

### Bug 3 — Override manuale in review non produce alias da salvare
**Root cause:** Quando una riga è `unmatched` e l'utente assegna manualmente un parametro dal dropdown, `alias_lims` resta `null` perché non c'era colonna LIMS valorizzata. L'update inviato all'IPC ha solo `{ nome: "X" }` — nessun campo alias — e l'handler IPC fa `continue` silenziosamente.
**Tentativo di fix:** `updateMatch` ora copia `source` nell'alias della colonna selezionata quando tutti gli alias sono null. Non verificato se funziona.

### Bug 4 — Prima riga trattata come header
**Root cause:** `loadSheet` originale usava `raw[0]` come intestazioni, ma i file reali non hanno header. Corretto usando nomi `A/B/C`, ma l'utente ha chiesto un toggle "prima riga = intestazione" — implementato inline e poi rimosso perché va fatto riusando il pattern di `ImportDialog.tsx` (step 'header' con click sulla riga).

### Bug 5 — Toggle "Prima riga = intestazione" da reimplementare
**Root cause:** Implementazione custom aggiunta e poi rimossa su richiesta utente. Va reimplementata riusando il pattern esistente in `src/renderer/pages/composti/ImportDialog.tsx` (righe ~494-556): step separato `'header'` dove si clicca sulla riga che funge da intestazione.

---

## Stato del file al termine della sessione

`AliasImportDialog.tsx` è modificato rispetto al commit `b8ea034` ma la funzionalità non è operativa. Il file contiene:
- Nuova struttura dati corretta (ColMapping, MappedRow con isNew)
- Logica handleProceedToReview riscritta
- Step mapping con anteprima (colonne A/B/C, nessun header assunto)
- Step review con sezione "nuovi parametri"
- handleImport con add() + bulkUpdateAlias()
- MA: l'aggiornamento DB non avviene

---

## File modificati
| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/AliasImportDialog.tsx` | Refactor completo — non operativo |
| `src/main/ipc/metodo-analiti.ipc.ts` | Log di debug aggiunti e rimossi — invariato funzionalmente |

---

## Note per sessioni future

### Priorità 1 — Debuggare bulkUpdateAlias
Aggiungere nel main process (`metodo-analiti.ipc.ts`) log di `info.changes` dopo ogni `db.prepare().run()` e verificare:
1. Quante righe vengono aggiornate (0 = WHERE non matcha)
2. Il valore esatto di `metodoId` e `u.nome` che arriva all'IPC
3. Eseguire manualmente in SQLite: `SELECT * FROM metodo_analiti WHERE metodo_id = 'xxx'` per vedere i nomi esatti in DB e confrontarli con quelli inviati

### Priorità 2 — Toggle header riga
Reimplementare riusando il pattern di `ImportDialog.tsx`:
- Aggiungere step `'header'` prima di `'mapping'`
- Mostrare tabella con rawRows, click sulla riga = quella diventa header
- Righe sotto = dati
- Vedere `src/renderer/pages/composti/ImportDialog.tsx` righe ~494-556 per il pattern esatto

### Priorità 3 — Override manuale in review
Verificare che quando l'utente assegna manualmente un parametro a una riga `unmatched`, il valore `source` venga copiato correttamente in `alias_lims` (o oqlab) a seconda della colonna selezionata in `colMapping`.

### Decisioni architetturali
- `metodoAnalitiApi.add()` già esistente gestisce INSERT OR IGNORE + uppercase + link composti_metodi — riusarlo senza modifiche
- `bulkUpdateAlias` IPC usa `'field' in u` per decidere cosa aggiornare — quindi passare solo le chiavi valorizzate (no null spread)
- La colonna sorgente del match (LIMS/OQLab) deve essere salvata come alias — non è solo per il match

### Riferimento piano
`docs/plans/active/2026-04-10-04-feat-parametri-alias-lims-oqlab-import-plan.md`
