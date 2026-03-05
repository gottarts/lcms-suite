# LC-MS/MS Suite — Design: Migrazione Electron

**Data:** 2026-03-05
**Stato:** Approvato

---

## 1. Obiettivo

Convertire la suite gestionale LC-MS/MS da HTML/JS puro a un'applicazione desktop moderna con React + Vite + Electron, packaged come singolo eseguibile `.exe`. Il database passa da JSON su File System Access API a SQLite su file esterno in cartella di rete condivisa.

## 2. Vincoli

- 2-5 PC, aggiornamento manuale (copia `.exe`)
- Uso sequenziale del DB (un utente alla volta scrive, nessuna concorrenza reale)
- Il file `.db` risiede su cartella di rete SMB, accessibile da tutti i client
- Nessuna autenticazione utente nella v1
- Moduli v1: Composti, Metodi, Strumenti (eluenti/diario/query), Consumabili, Anagrafiche
- Moduli futuri: Dashboard, Per Stoccaggio, Per Metodo, gestione utenze

## 3. Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Runtime desktop | Electron |
| Frontend | React + TypeScript + Vite |
| UI | Shadcn/ui + Tailwind CSS |
| Font | Karla (titoli) + Lato (dati) |
| Palette | Soft-tech pastels, variabili Tailwind per switch tema |
| Database | SQLite via better-sqlite3 |
| IPC | Electron invoke/handle + contextBridge |
| Packaging | electron-builder, target portable (singolo .exe) |

## 4. Architettura

```
Electron App
  Main Process (Node.js)
    - better-sqlite3 → lcms.db (file esterno su rete)
    - IPC handlers per ogni entita'
    - Schema migrations (PRAGMA user_version)
    - Config locale (%APPDATA%/lcms-suite/config.json)

  Preload
    - contextBridge → window.electronAPI

  Renderer Process (React)
    - SPA con React Router
    - Sidebar persistente
    - Pagine per modulo
    - State locale per pagina (useState/useReducer)
    - Chiamate IPC tipizzate
```

### Pattern IPC

Ogni entita' espone operazioni standard via IPC:
- `entita:list` — query con filtri
- `entita:get` — singolo record
- `entita:create` — inserimento
- `entita:update` — modifica
- `entita:delete` — eliminazione

Query complesse (tracciabilita', snapshot) hanno handler IPC dedicati.

## 5. Modello Dati

### Relazioni chiave

```
Metodo (padre)
  N:1 → Strumento (dove gira di routine, spostabile)
  N:M → Composti (standard di riferimento)
  N:M → Consumabili (colonne HPLC, SPE, solventi)
  1:N → Diario (note con metodo opzionale)

Strumento
  1:N → Eluenti (fissi, con componenti/lotti — tipo A)

Composto
  1:N → Preparazioni (stock solutions)
  1:N → Storia (rivalidazioni/dismissioni)

Consumabile (colonne HPLC, SPE, solventi — tipo B)
  N:M → Metodi (in quali metodi viene usato)
```

### Distinzione consumabili

- **Tipo A (eluenti):** Fissi sullo strumento, non si spostano. Tabella `eluenti` con FK a `strumenti`.
- **Tipo B (colonne, SPE, solventi, sali):** Legati ai metodi, possono essere usati su piu' strumenti/metodi. Tabella `consumabili` con relazione N:M a `metodi`.

### Schema SQL

```sql
CREATE TABLE strumenti (
  id          TEXT PRIMARY KEY,
  codice      TEXT NOT NULL,
  tipo        TEXT,
  seriale     TEXT,
  status      TEXT DEFAULT 'off',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE metodi (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  strumento_id    TEXT REFERENCES strumenti(id),
  matrice         TEXT,
  colonna         TEXT,
  fase_a          TEXT,
  fase_b          TEXT,
  gradiente       TEXT,
  flusso          TEXT,
  ionizzazione    TEXT,
  polarita        TEXT,
  acquisizione    TEXT,
  srm             TEXT,
  lims_id         TEXT,
  oqlab_id        TEXT,
  note            TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE composti (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT NOT NULL,
  codice_interno      TEXT,
  formula             TEXT,
  classe              TEXT,
  forma               TEXT,
  forma_commerciale   TEXT,
  purezza             REAL,
  concentrazione      REAL,
  solvente            TEXT,
  fiala               TEXT,
  produttore          TEXT,
  lotto               TEXT,
  operatore_apertura  TEXT,
  data_apertura       TEXT,
  scadenza_prodotto   TEXT,
  data_dismissione    TEXT,
  destinazione_uso    TEXT,
  work_standard       TEXT,
  matrice             TEXT,
  peso_molecolare     REAL,
  ubicazione          TEXT,
  arpa                TEXT DEFAULT 'N',
  mix                 TEXT,
  mix_id              TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE composti_metodi (
  composto_id   INTEGER REFERENCES composti(id) ON DELETE CASCADE,
  metodo_id     TEXT    REFERENCES metodi(id)   ON DELETE CASCADE,
  PRIMARY KEY (composto_id, metodo_id)
);

CREATE TABLE composti_storia (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  composto_id   INTEGER REFERENCES composti(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,
  data          TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE preparazioni (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  composto_id   INTEGER REFERENCES composti(id) ON DELETE CASCADE,
  flacone       TEXT,
  concentrazione TEXT,
  solvente      TEXT,
  data_prep     TEXT,
  scadenza      TEXT,
  operatore     TEXT,
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE eluenti (
  id              TEXT PRIMARY KEY,
  strumento_id    TEXT REFERENCES strumenti(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  data_inizio     TEXT NOT NULL,
  data_fine       TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE eluenti_componenti (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  eluente_id    TEXT REFERENCES eluenti(id) ON DELETE CASCADE,
  sostanza      TEXT,
  lotto         TEXT,
  fornitore     TEXT
);

CREATE TABLE consumabili (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL,
  nome            TEXT NOT NULL,
  lotto           TEXT,
  fornitore       TEXT,
  data_apertura   TEXT,
  data_chiusura   TEXT,
  note            TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE consumabili_metodi (
  consumabile_id  INTEGER REFERENCES consumabili(id) ON DELETE CASCADE,
  metodo_id       TEXT    REFERENCES metodi(id)      ON DELETE CASCADE,
  PRIMARY KEY (consumabile_id, metodo_id)
);

CREATE TABLE diario (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  strumento_id    TEXT REFERENCES strumenti(id) ON DELETE CASCADE,
  metodo_id       TEXT REFERENCES metodi(id),
  data            TEXT NOT NULL,
  autore          TEXT,
  testo           TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE anagrafiche (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nome    TEXT NOT NULL
);

CREATE TABLE anagrafiche_voci (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  anagrafica_id   INTEGER REFERENCES anagrafiche(id) ON DELETE CASCADE,
  valore          TEXT NOT NULL,
  UNIQUE(anagrafica_id, valore)
);
```

## 6. Navigazione

```
/composti         → Standard DB (tabella + pannello laterale)
/metodi           → Metodi analitici (card grid + drawer)
/strumenti        → Strumenti (tab strip + sub-tab: eluenti, metodi readonly, diario, query)
/consumabili      → Consumabili per tipo (colonne HPLC, SPE, solventi)
/anagrafiche      → Dizionari configurabili
```

## 7. Struttura File

```
src/
  main/
    index.ts                    # Entry Electron, BrowserWindow
    db.ts                       # Connessione better-sqlite3, migrations
    ipc/                        # Handler IPC per entita'
      composti.ipc.ts
      metodi.ipc.ts
      strumenti.ipc.ts
      consumabili.ipc.ts
      eluenti.ipc.ts
      diario.ipc.ts
      anagrafiche.ipc.ts
      preparazioni.ipc.ts
    migrations/
      001-initial.sql

  preload/
    index.ts                    # contextBridge

  renderer/
    App.tsx
    components/
      layout/                   # Sidebar, Topbar, AppLayout
      ui/                       # Shadcn
      shared/                   # DataTable, SlidePanel, ConfirmDialog, StatusBadge
    pages/
      composti/                 # Page, Table, Panel, Form, PreparazioniTab, ImportDialog
      metodi/                   # Page, Card, Drawer, Form
      strumenti/                # Page, Tabs, EluentiTab, MetodiReadonlyTab, DiarioTab, QueryTab
      consumabili/              # Page, Form, Table
      anagrafiche/              # Page, Card
    hooks/
      useQuery.ts
      useMutation.ts
    lib/
      api.ts                    # Chiamate IPC tipizzate
      utils.ts
    styles/
      globals.css
    types/
      index.ts

  shared/
    types.ts                    # Tipi condivisi main/renderer
```

## 8. Primo Avvio e Migrazione

### Flusso

1. App si avvia, cerca `config.json` in `%APPDATA%/lcms-suite/`
2. Se non esiste → schermata setup: dialog selezione cartella
3. Se la cartella contiene `lcms.db` → lo apre
4. Se non contiene → crea DB con schema, offre import da `lcms-data.json`
5. Se `config.json` esiste ma il DB non si trova → avviso, riselezione cartella

### Config locale

```json
{
  "dbPath": "\\\\NAS\\condivisa\\lcms.db",
  "windowBounds": { "width": 1400, "height": 900 }
}
```

### Migrazione JSON → SQLite

- Legge `lcms-data.json`
- Singola transazione: inserisce tutte le entita', ricostruisce relazioni N:M, deduplica metodi
- Rollback su errore

### Schema versioning

- `PRAGMA user_version` confrontato con migrazioni disponibili
- Migrazioni eseguite automaticamente all'apertura
- Nuovo `.exe` con nuove colonne → migrazione automatica

## 9. Packaging

- **Tool:** electron-builder
- **Target:** portable (singolo `.exe`, ~100 MB)
- **Architettura:** x64
- **better-sqlite3:** ricompilato per Electron via electron-rebuild
- **Migrazioni SQL:** incluse come extraResources

### Aggiornamento

Manuale: sostituire il `.exe`. Le migrazioni DB partono automaticamente.

## 10. Tracciabilita' — Query Chiave

La query "data X, metodo Y, strumento Z" restituisce:

```sql
-- Eluenti attivi sullo strumento a data X
SELECT e.*, ec.sostanza, ec.lotto, ec.fornitore
FROM eluenti e
LEFT JOIN eluenti_componenti ec ON ec.eluente_id = e.id
WHERE e.strumento_id = :strumento
  AND e.data_inizio <= :data
  AND (e.data_fine IS NULL OR e.data_fine >= :data);

-- Consumabili attivi per metodo Y a data X
SELECT c.*
FROM consumabili c
JOIN consumabili_metodi cm ON cm.consumabile_id = c.id
WHERE cm.metodo_id = :metodo
  AND c.data_apertura <= :data
  AND (c.data_chiusura IS NULL OR c.data_chiusura >= :data);

-- Composti associati al metodo Y con prep attiva a data X
SELECT comp.*, p.flacone, p.concentrazione AS prep_conc, p.data_prep, p.scadenza
FROM composti comp
JOIN composti_metodi cm ON cm.composto_id = comp.id
LEFT JOIN preparazioni p ON p.composto_id = comp.id
  AND p.data_prep <= :data
  AND (p.scadenza IS NULL OR p.scadenza >= :data)
WHERE cm.metodo_id = :metodo;
```
