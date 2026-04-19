# Fix Multi-PC: sync dati + pannello connessioni

## Context

Bug critico segnalato: con 2+ PC collegati alla stessa cartella di storage condivisa (SMB/NAS o cartella cloud-sync),
1. le modifiche del PC che si connette *dopo* non vengono salvate né viste dall'altro PC,
2. il pannello "Connessioni" in Sidebar mostra solo 1 PC anche quando ne sono collegati 2,
3. "una volta funzionava" → regressione percepita.

**Root cause**: `src/main/db.ts:15` imposta `journal_mode = WAL`. WAL richiede un file di shared memory (`lcms.db-shm`) mappato via mmap: su filesystem di rete (SMB/NFS) e su cartelle cloud-sync (Dropbox/OneDrive) questo non è affidabile. Ogni PC vede una cache locale non sincronizzata — le scritture di PC1 non diventano visibili a PC2 finché il DB non viene chiuso e riaperto. Lo stesso effetto fa sparire le righe della tabella `sessions` altrui dal pannello connessioni. L'ANALISI_FUNZIONALE.md dichiara "uso sequenziale (nessuna concorrenza reale)", ma il commit 7cb0960 ha introdotto la feature sessioni multi-PC presupponendo visibilità inter-PC che WAL su rete non garantisce.

Bug secondario indipendente: `src/main/index.ts:65-91` (handler `config:select-folder`, pulsante CAMBIA CARTELLA) apre il nuovo DB senza chiudere il precedente, lasciando lock attivi sulla cartella vecchia.

Outcome atteso dopo il fix:
- PC2 vede entro pochi secondi i dati scritti da PC1 (e viceversa) senza dover chiudere/riaprire l'app.
- Il pannello connessioni mostra correttamente tutti i PC attivi sulla stessa cartella.
- CAMBIA CARTELLA rilascia correttamente il DB precedente.

## Approccio

Passaggio di SQLite da **WAL** a **journal DELETE (rollback journal classico)** con `busy_timeout` e `synchronous = FULL`. È l'unica modalità documentata come affidabile su filesystem di rete / cartelle cloud-sync. Il costo in performance è trascurabile per il carico reale (app CRUD manuale, 2-3 utenti, UI non real-time).

Fix complementari minimali sulla tabella `sessions` (DISTINCT hostname, polling più frequente) e sul ciclo di vita del DB al cambio cartella.

**NON fatto** (fuori scope): presence via file JSON separato, event bus cross-PC, polling aggressivo di tutti i dati business. Il fix del journal_mode rende la lettura fresh-from-disk di default, quindi il refresh naturale per navigazione tra pagine è sufficiente.

## Modifiche

### 1. src/main/db.ts — journal mode + timeout (CRITICO)

In `openDatabase()`:

- Sostituire `db.pragma('journal_mode = WAL')` con `db.pragma('journal_mode = DELETE')`
- Aggiungere subito dopo:
  - `db.pragma('busy_timeout = 5000')` — attesa fino a 5s su lock contesi invece di fallire con `SQLITE_BUSY`
  - `db.pragma('synchronous = FULL')` — massima durabilità, necessaria con più client su filesystem di rete

**Migrazione automatica**: al primo avvio dopo il fix, better-sqlite3 esegue automaticamente il checkpoint del `.db-wal` preesistente nel file principale ed elimina `-wal`/`-shm`.

### 2. src/main/index.ts — CAMBIA CARTELLA chiude il DB vecchio (CRITICO)

Nel handler `config:select-folder`, **prima** di `if (exists) { openDatabase(...) } else { createDatabase(...) }`, aggiungere:

```ts
stopSession()
closeDatabase()
```

Entrambe sono idempotenti.

### 3. src/main/ipc/sessions.ipc.ts — DISTINCT

Cambiare la query in:

```sql
SELECT DISTINCT hostname FROM sessions WHERE last_seen >= unixepoch() - ?
```

Opzionale: ridurre `HEARTBEAT_INTERVAL_MS` da 30000 a 15000 e `SESSION_TIMEOUT_S` da 90 a 45 per detection più rapida.

### 4. src/renderer/components/layout/Sidebar.tsx — key React + polling

- Cambiare map e key in `sessions.map((s, idx) => <li key={`${s.hostname}-${idx}`}>{s.hostname}</li>)` — difesa in profondità contro hostname duplicati.
- Ridurre polling da `30_000` a `10_000` ms.

## File critici da rileggere prima di implementare

- src/main/db.ts
- src/main/index.ts
- src/main/ipc/sessions.ipc.ts
- src/renderer/components/layout/Sidebar.tsx
- CLAUDE.md — ricordare regola scope isolato e file blindati (CompostiTable/StoriaDialog/CompostiPage fuori scope)

## Verifica (test manuale con 2 PC)

Prerequisito: fare backup di `lcms.db` sulla cartella condivisa prima del primo avvio (precauzione migrazione WAL→DELETE).

1. **PC1 scrive → PC2 legge**: PC-A crea un composto "TEST-FIX-01" su pagina Composti e salva. PC-B, già aperta, naviga a Composti o cambia pagina e torna → "TEST-FIX-01" deve comparire. Controllo fisico: nella cartella condivisa **non devono più esistere** `lcms.db-wal` / `lcms.db-shm`; può comparire transitoriamente `lcms.db-journal` durante le scritture.
2. **Entrambi scrivono**: PC-A crea un composto, PC-B crea una preparazione nello stesso momento. Entrambe le scritture devono andare a buon fine senza `SQLITE_BUSY` (può esserci piccolo ritardo fino a 5s — busy_timeout).
3. **Pannello connessioni mostra 2**: PC-A apre app, attendi 15s → "1 connesso". PC-B apre app, attendi ~25s → entrambe le Sidebar mostrano "2 connessi" con i due hostname. Chiudi PC-B, dopo ~45s PC-A torna a "1 connesso". Aprire 2 istanze app su PC-A deve continuare a mostrare solo "1 connesso" grazie a DISTINCT.
4. **CAMBIA CARTELLA**: su PC-A puntato a `\\server\share1\lcms.db`, cliccare CAMBIA CARTELLA e passare a `\\server\share2\lcms.db`. Dopo l'operazione, `share1\lcms.db` deve essere eliminabile/rinominabile da un altro processo (nessun lock residuo). Riaprendo l'app su share2, la tabella `sessions` del DB precedente deve essere pulita.

## Rischi

- **Performance**: DELETE journal è leggermente più lento di WAL su scritture isolate. Impatto atteso impercettibile (app non write-heavy, bottleneck reale è la latenza SMB).
- **File `.db-journal` residui dopo crash**: innocui, SQLite esegue rollback automatico alla riapertura. Documentare per l'utente: non eliminare manualmente file `lcms.db-*`.
- **Cloud sync (Dropbox/OneDrive)**: `busy_timeout` mitiga ma non elimina race condition in cui 2 client scrivono nello stesso millisecondo e il provider di sync crea conflitti. Mitigazione raccomandata al di fuori del codice: usare SMB/NAS puro oppure escludere `lcms.db*` dalla sincronizzazione del provider.
- **Migrazione WAL→DELETE**: eseguita da better-sqlite3 al primo open. Backup consigliato come precauzione.
- **Nessun rischio single-PC locale**: DELETE journal funziona identico in locale.
