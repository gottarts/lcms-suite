# Piano: Feature "Utenti connessi" (sessioni multi-PC)

## Context

L'app LCMS Suite viene usata da più PC in rete locale che condividono lo stesso file `lcms.db` su una cartella condivisa (SMB/NFS). Attualmente non c'è nessuna indicazione di quanti utenti hanno il DB aperto simultaneamente. L'obiettivo è mostrare nella Sidebar il numero di istanze connesse e i loro hostname.

**Approccio scelto:** tabella `sessions` nel DB SQLite — ogni istanza scrive la propria presenza al boot, la aggiorna con heartbeat ogni 30s, la cancella alla chiusura. Le sessioni non aggiornate da >90s sono considerate offline.

**Contro noti (accettati):**
- Heartbeat genera scritture ogni 30s sul file condiviso — trascurabile su rete locale
- In caso di crash dell'app, la sessione rimane "fantasma" per ~90s prima dello scadere
- WAL mode già attivo (`db.pragma('journal_mode = WAL')` in `db.ts:15`) — nessuna modifica necessaria

**Hostname:** disponibile via `os.hostname()` in Node.js — nessuna configurazione utente necessaria.

---

## File critici

| File | Ruolo |
|------|-------|
| `src/main/migrations/023-sessions.sql` | Crea tabella `sessions` |
| `src/main/ipc/sessions.ipc.ts` | IPC handler `sessions:list` (nuovo file) |
| `src/main/index.ts` | Boot: avvia session manager + registra IPC + cleanup alla chiusura |
| `src/preload/index.ts` | Espone `listSessions` al renderer |
| `src/renderer/components/layout/Sidebar.tsx` | UI: mostra conteggio + lista hostname |

---

## Implementazione passo per passo

### 1. Migrazione DB — `src/main/migrations/023-sessions.sql`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT PRIMARY KEY,
  hostname  TEXT NOT NULL,
  last_seen INTEGER NOT NULL  -- Unix timestamp in secondi
);
```

### 2. Session Manager — `src/main/ipc/sessions.ipc.ts`

```typescript
import { ipcMain } from 'electron'
import { getDb } from '../db'
import os from 'os'
import { randomUUID } from 'crypto'

const SESSION_ID = randomUUID()
const HOSTNAME = os.hostname()
const HEARTBEAT_INTERVAL_MS = 30_000
const SESSION_TIMEOUT_S = 90

let heartbeatTimer: NodeJS.Timeout | null = null

export function startSession(): void {
  // Upsert: insert o aggiorna se già esiste (es. restart veloce stesso UUID)
  getDb().prepare(`
    INSERT INTO sessions (id, hostname, last_seen) VALUES (?, ?, unixepoch())
    ON CONFLICT(id) DO UPDATE SET last_seen = unixepoch()
  `).run(SESSION_ID, HOSTNAME)

  heartbeatTimer = setInterval(() => {
    try {
      getDb().prepare(`UPDATE sessions SET last_seen = unixepoch() WHERE id = ?`).run(SESSION_ID)
    } catch (_) { /* DB non ancora aperto o chiuso */ }
  }, HEARTBEAT_INTERVAL_MS)
}

export function stopSession(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  try {
    getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(SESSION_ID)
  } catch (_) { /* ignora se DB già chiuso */ }
}

export function registerSessionsIpc(): void {
  ipcMain.handle('sessions:list', () => {
    // Ritorna solo sessioni vive (last_seen recente)
    return getDb()
      .prepare(`SELECT hostname FROM sessions WHERE last_seen >= unixepoch() - ?`)
      .all(SESSION_TIMEOUT_S) as { hostname: string }[]
  })
}
```

**Nota:** `startSession()` va chiamata DOPO `openDatabase()`, non al boot se il DB non è ancora configurato. Gestire il caso in cui il DB non esiste ancora (primo avvio).

### 3. Integrazione in `src/main/index.ts`

Aggiunte minimali:

```typescript
import { registerSessionsIpc, startSession, stopSession } from './ipc/sessions.ipc'

// In app.whenReady():
registerSessionsIpc()

// Dopo openDatabase() (sia nel boot che in config:select-folder):
startSession()

// In app.on('window-all-closed'):
stopSession()
closeDatabase()
```

**Attenzione:** `startSession()` va chiamata sia:
- Al boot, se `config.dbPath` esiste (riga ~123 di index.ts)
- Dopo `openDatabase()`/`createDatabase()` in `config:select-folder` (riga ~79-81)

### 4. Preload — `src/preload/index.ts`

Aggiungere una sola riga:

```typescript
listSessions: () => ipcRenderer.invoke('sessions:list'),
```

### 5. Sidebar — `src/renderer/components/layout/Sidebar.tsx`

Aggiungere stato e polling:

```typescript
const [sessions, setSessions] = useState<{ hostname: string }[]>([])
const [sessionsExpanded, setSessionsExpanded] = useState(false)

useEffect(() => {
  const fetchSessions = () =>
    window.electronAPI.listSessions().then(setSessions).catch(() => {})
  fetchSessions()
  const timer = setInterval(fetchSessions, 30_000)
  return () => clearInterval(timer)
}, [])
```

UI nel pannello storage (sotto il percorso, sopra CAMBIA CARTELLA):

```tsx
{sessions.length > 0 && (
  <div>
    <button
      onClick={() => setSessionsExpanded(p => !p)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <span className="text-blue-400">●</span>
      {sessions.length} {sessions.length === 1 ? 'connesso' : 'connessi'}
      <span>{sessionsExpanded ? '▴' : '▾'}</span>
    </button>
    {sessionsExpanded && (
      <ul className="pl-3 mt-0.5 space-y-0.5 text-xs text-muted-foreground">
        {sessions.map(s => <li key={s.hostname}>{s.hostname}</li>)}
      </ul>
    )}
  </div>
)}
```

---

## Edge cases da gestire

1. **DB non ancora configurato** (primo avvio): `startSession()` non va chiamata — il `getDb()` dentro il heartbeat non trova DB aperto. Il try/catch nel timer lo gestisce silenziosamente.
2. **Hostname duplicato** (stessa macchina, due istanze): entrambe appaiono perché hanno UUID diversi. Comportamento accettabile.
3. **Sessioni fantasma** da crash: scadono dopo 90s per via del filtro `last_seen >= unixepoch() - 90`.

---

## Verifica

1. Aprire l'app su un PC — la Sidebar mostra "● 1 connesso" con il proprio hostname
2. Aprire l'app su un secondo PC (stesso DB condiviso) — entrambi mostrano "● 2 connessi"
3. Chiudere un'istanza — entro 30s l'altra aggiorna a "● 1 connesso"
4. Simulare crash (kill -9 del processo) — dopo 90s la sessione fantasma scompare
