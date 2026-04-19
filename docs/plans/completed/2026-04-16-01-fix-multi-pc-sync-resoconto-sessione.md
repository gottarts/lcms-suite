# Resoconto sessione — Fix multi-PC sync + refresh automatico cross-PC

**Data:** 2026-04-16
**Branch:** master

## Obiettivo

Risolvere il bug critico segnalato: con 2+ PC connessi alla stessa cartella di storage condivisa, le modifiche non si propagano tra PC e il pannello connessioni in Sidebar mostra solo 1 PC anche quando sono collegati in 2.

## Analisi e root cause

Il piano è in [2026-04-16-01-fix-multi-pc-sync-plan.md](./2026-04-16-01-fix-multi-pc-sync-plan.md).

**Root cause identificato**: `src/main/db.ts` apriva SQLite con `journal_mode = WAL`. WAL su filesystem di rete (SMB/NFS/cloud-sync) non è affidabile perché richiede il file `-shm` (shared memory) mappato via mmap, che su questi filesystem non è garantito. Ogni PC vede una cache locale incoerente e le scritture di PC1 non diventano visibili a PC2 finché il DB non viene chiuso e riaperto. Stesso meccanismo impediva al pannello connessioni di vedere i peer.

Bug correlati: `config:select-folder` (CAMBIA CARTELLA) apriva il nuovo DB senza chiudere il precedente, lasciando lock attivi.

## Modifiche implementate

### Fase 1 — Fix primario (sync dati e pannello)

- **[src/main/db.ts](../../../src/main/db.ts)** — WAL → DELETE journal, `busy_timeout=5000`, `synchronous=FULL`, checkpoint WAL esplicito tollerante, diagnostica in console se lo switch non completa (lock residuo da altro PC).
- **[src/main/index.ts](../../../src/main/index.ts)** — handler `config:select-folder` ora wrappato in try/catch e ritorna `{ ok: false, error }` invece di propagare eccezione IPC silenziosa. `stopSession()` + `closeDatabase()` prima di aprire nuovo DB.
- **[src/main/ipc/sessions.ipc.ts](../../../src/main/ipc/sessions.ipc.ts)** — `SELECT DISTINCT hostname`, `HEARTBEAT_INTERVAL_MS` 30s→15s, `SESSION_TIMEOUT_S` 90→45.
- **[src/renderer/components/layout/Sidebar.tsx](../../../src/renderer/components/layout/Sidebar.tsx)** — polling 30s→10s, key React univoca per difesa contro hostname duplicati, `alert()` in caso di errore da `selectFolder` (prima falliva silente).
- **[src/renderer/pages/setup/SetupPage.tsx](../../../src/renderer/pages/setup/SetupPage.tsx)** — gestione errore `selectFolder` con step `error`.
- **[src/shared/types.ts](../../../src/shared/types.ts)** — firma `selectFolder` estesa con `error?: string`, aggiunta `listSessions` (mancante).

### Fase 2 — Infrastruttura refresh automatico cross-PC

Necessaria perché dopo Fase 1 PC2 **vede** i dati di PC1 solo rifacendo una query — serviva trigger automatico.

- **[src/main/index.ts](../../../src/main/index.ts)** — `fs.watchFile(lcms.db, interval:2000ms)` su open/CAMBIA CARTELLA/lifecycle; quando `mtime` cambia, invia `db:external-change` alla window.
- **[src/preload/index.ts](../../../src/preload/index.ts)** — espone `onDbChange(callback)` con unsubscribe.
- **[src/shared/types.ts](../../../src/shared/types.ts)** — firma `onDbChange: (cb) => () => void`.
- **[src/renderer/lib/useDbChange.ts](../../../src/renderer/lib/useDbChange.ts)** (nuovo file) — hook custom: ascolta `onDbChange` + `window.focus`, throttle 500ms, ref per ultima callback.

### Fase 3 — Wiring hook nelle pagine principali

Aggiunto `useDbChange(load)` in tutte le pagine elencate in Sidebar:

- [AnagrafichePage](../../../src/renderer/pages/anagrafiche/AnagrafichePage.tsx)
- [MetodiPage](../../../src/renderer/pages/metodi/MetodiPage.tsx)
- [StrumentiPage](../../../src/renderer/pages/strumenti/StrumentiPage.tsx)
- [ConsumabiliPage](../../../src/renderer/pages/consumabili/ConsumabiliPage.tsx)
- [WorkPage](../../../src/renderer/pages/work/WorkPage.tsx)
- [CompostiPage](../../../src/renderer/pages/composti/CompostiPage.tsx) (file blindato — aggiunta chirurgica di 2 righe, zero rimozioni, dichiarazione intento prima di toccare)
- [KpiCards](../../../src/renderer/pages/dashboard/sections/KpiCards.tsx)
- [ScadenzeTimeline](../../../src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx)
- [TracciabilitaCard](../../../src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx)
- [AuditCrmSection](../../../src/renderer/pages/dashboard/sections/AuditCrmSection.tsx)

Per le sezioni Dashboard, fetch inline in `useEffect` estratto in `useCallback` per permettere `useDbChange(load)` (refactor minimo, zero cambio di comportamento).

## Problemi collaterali risolti in sessione

- **Native module `better_sqlite3.node` "not a valid Win32 application"**: il rebuild iniziale (`electron-rebuild -f -w better-sqlite3`) compilava per x86 invece di x64 (process.arch x64, Electron 40.8.0 x64). Risolto con `npx electron-rebuild -f -w better-sqlite3 --arch=x64`. Raccomandazione: usare sempre `--arch=x64` su questa macchina.
- **Handler `config:select-folder` falliva silente**: lo switch WAL→DELETE poteva lanciare eccezione se un altro PC teneva il lock; il renderer non gestiva l'errore e la selezione "non veniva presa". Ora error visibile all'utente.

## Verifica esecutiva

- Fase 1 confermata funzionante dall'utente: PC1 e PC2 ora vedono le modifiche reciproche e il pannello aggiorna gli stati correttamente nella maggior parte dei casi.
- Fase 2/3 confermata funzionante per la maggior parte delle pagine: refresh automatico ~2-3s cross-PC.

## Problemi residui non risolti (segnalati dall'utente)

### 1. WorkPage — refresh delle preparazioni (drill-down) non reattivo

**Sintomo**: in WorkPage, l'aggiornamento automatico cross-PC funziona per la **lista delle work** (stringa principale), ma **non** per le preparazioni espanse sotto ogni work. Anche sullo stesso PC che effettua la preparazione/rinnovo bisogna cambiare pagina per vedere la preparazione aggiornata.

**Ipotesi da verificare**: le preparazioni espanse sono probabilmente caricate da un componente figlio (es. `WorkDrawer` o blocco storico preparazioni espandibile) che ha un proprio `useEffect` con fetch, **non** coperto dal `useDbChange` del `load()` di WorkPage. La `load()` ricarica solo `works` + `metodi`, non lo storico preparazioni per ciascuna work espansa.

**File da investigare**:
- [src/renderer/pages/work/WorkPage.tsx](../../../src/renderer/pages/work/WorkPage.tsx) — dove viene renderizzato il blocco preparazioni per work espanse
- [src/renderer/pages/work/WorkDrawer.tsx](../../../src/renderer/pages/work/WorkDrawer.tsx) — contiene un `reload(id)` che probabilmente fetcha le preparazioni
- Eventuale `WorkCard` o componente "storico preparazioni espandibile" creato nel commit `f563afb`

**Possibile fix**: aggiungere `useDbChange` al componente che fetcha le preparazioni espanse, oppure far sì che il `load()` di WorkPage rifetchi anche lo stato delle preparazioni delle work espanse.

### 2. PC2 — pannello connessioni non vede PC1

**Sintomo**: sulla macchina "questo PC" (quella su cui è stato fatto lo sviluppo) il pannello Connessioni mostra correttamente entrambi gli hostname. Su PC2 invece mostra solo se stesso come unico utente connesso.

**Ipotesi da verificare**:
1. PC2 sta ancora girando con una build vecchia del codice (pre-fix) e non ha ricevuto il deploy dell'aggiornamento. → verificare che entrambi i PC abbiano la stessa versione del codice/binary.
2. PC2 ha ancora il DB aperto in WAL mode (migrazione WAL→DELETE non completata al primo avvio per qualche motivo, es. lock di PC1 attivo) → verificare che nella cartella condivisa **non esistano** più `lcms.db-wal` / `lcms.db-shm`.
3. PC2 non riesce a leggere la riga di session di "questo PC" per cache locale persistente → il busy_timeout non sta aiutando perché SQLite su SMB può comunque tenere cache di read.
4. Il clock di PC2 è sfasato significativamente rispetto a "questo PC" → `last_seen >= unixepoch() - 45` filtrerebbe fuori la riga se l'orologio di PC2 è avanti di >45s.

**Controllo immediato consigliato**: su PC2 aprire DevTools, eseguire `window.electronAPI.listSessions()` manualmente e verificare cosa ritorna. Se ritorna solo la propria riga, il problema è backend/DB. Se ritorna 2 righe ma Sidebar mostra 1, è un bug di rendering.

**File da investigare**:
- [src/main/ipc/sessions.ipc.ts](../../../src/main/ipc/sessions.ipc.ts) — query session
- Confrontare mtime di `lcms.db` rispetto al clock di PC2

## File toccati (totale)

**Main / Preload / Shared:**
- src/main/db.ts
- src/main/index.ts
- src/main/ipc/sessions.ipc.ts
- src/preload/index.ts
- src/shared/types.ts

**Renderer — infrastruttura:**
- src/renderer/lib/useDbChange.ts (nuovo)
- src/renderer/components/layout/Sidebar.tsx
- src/renderer/pages/setup/SetupPage.tsx

**Renderer — wiring pagine:**
- src/renderer/pages/anagrafiche/AnagrafichePage.tsx
- src/renderer/pages/metodi/MetodiPage.tsx
- src/renderer/pages/strumenti/StrumentiPage.tsx
- src/renderer/pages/consumabili/ConsumabiliPage.tsx
- src/renderer/pages/work/WorkPage.tsx
- src/renderer/pages/composti/CompostiPage.tsx
- src/renderer/pages/dashboard/sections/KpiCards.tsx
- src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx
- src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx
- src/renderer/pages/dashboard/sections/AuditCrmSection.tsx

**Docs:**
- docs/plans/active/2026-04-16-01-fix-multi-pc-sync-plan.md (nuovo)
- docs/plans/active/2026-04-16-01-fix-multi-pc-sync-resoconto-sessione.md (questo)
