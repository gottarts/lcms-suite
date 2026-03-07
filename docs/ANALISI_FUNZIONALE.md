# Analisi Funzionale — LC-MS/MS Suite

**Versione:** 2.2  
**Data:** 2026-03-06  
**Fonte:** codice sorgente repository

---

## 1. Descrizione Generale

Suite gestionale desktop per un reparto di analisi LC-MS/MS. Gestisce standard di riferimento (CRM), metodi analitici, strumenti, eluenti, consumabili, preparazioni e anagrafiche.

App **Electron** packaged come singolo `.exe` portabile. Database SQLite su file esterno collocabile su cartella di rete condivisa (NAS/SMB), accessibile da più PC in uso sequenziale (un utente alla volta scrive, nessuna concorrenza reale).

---

## 2. Stack Tecnico

| Componente | Tecnologia |
|---|---|
| Runtime | Electron |
| Frontend | React + TypeScript + Vite |
| UI | Shadcn/ui + Tailwind CSS |
| Font | Karla (heading) · Lato (body) · IBM Plex Mono |
| Database | SQLite via better-sqlite3 |
| Comunicazione | IPC Electron (invoke/handle) + contextBridge |
| Routing | React Router v6 — HashRouter |
| Packaging | electron-builder → `.exe` (Windows x64/ia32) + `.dmg` (Mac) |

---

## 3. Flusso di Avvio

`App.tsx` chiama `window.electronAPI.getConfig()` all'avvio. Se `dbPath` è null o il file non esiste → **SetupPage** (first-run), altrimenti entra nel layout principale.

**SetupPage** — card centrata a schermo intero (no sidebar), con questi stati:

| Step | Descrizione |
|---|---|
| `welcome` | Pulsante "Seleziona cartella" → `config:select-folder` IPC |
| `choose-import` | DB nuovo: offre "Importa da lcms-data.json" o "Inizia da zero" |
| `importing` | Spinner durante `config:import-legacy` IPC |
| `done` | Mostra riepilogo conteggi importati, pulsante "Continua" |
| `error` | Mostra errore, offre Riprova o Continua senza importare |

Config salvata in `%APPDATA%/lcms-suite/config.json` — campi: `dbPath`, `windowBounds`.

---

## 4. Layout Principale

**Sidebar** (w-56) — logo "LC-MS/MS Suite", link di navigazione con icone emoji e stato attivo, orologio in fondo (aggiornato ogni minuto).

**Topbar** — titolo pagina corrente a sinistra, percorso del file DB (font mono, troncato) a destra.

**Main** — `<Outlet />` con padding, scrollabile.

---

## 5. Navigazione

```
AppLayout (Sidebar + Topbar + <Outlet>)
  /composti     → Standard di Riferimento
  /metodi       → Metodi Analitici
  /strumenti    → Strumenti
  /consumabili  → Consumabili
  /anagrafiche  → Anagrafiche
  *             → redirect /composti
```

---

## 6. Database — Schema SQLite

Migrazioni automatiche via `PRAGMA user_version` — file `.sql` inclusi come `extraResources`. WAL mode + foreign keys ON.

| Tabella | Contenuto |
|---|---|
| `strumenti` | Piattaforme analitiche |
| `metodi` | Metodi analitici (LC + MS) |
| `composti` | Standard di riferimento |
| `composti_metodi` | N:M composti ↔ metodi |
| `composti_storia` | Storico rivalidazioni e dismissioni |
| `preparazioni` | Soluzioni stock per composto |
| `eluenti` | Eluenti installati per strumento |
| `eluenti_componenti` | Componenti di ogni eluente (sostanza, lotto, fornitore) |
| `consumabili` | Colonne HPLC, SPE, solventi, sali |
| `consumabili_metodi` | N:M consumabili ↔ metodi |
| `diario` | Note operative per strumento |
| `anagrafiche` | Categorie dizionari configurabili |
| `anagrafiche_voci` | Voci per categoria (UNIQUE per anagrafica) |

---

## 7. Moduli

### 7.1 Composti / Standard DB (`/composti`)

**Tabella** (`CompostiTable`) — colonne: Nome (con badge blu MIX se `mix_id` presente), Codice, Classe (badge outline), Forma, Produttore, Lotto, Scadenza, Stato.

**Ricerca** — client-side su: nome, codice_interno, classe, produttore, lotto.

**Filtri IPC** (applicati SQL lato main su `composti:list`): search (LIKE su nome e codice_interno), classe, forma, metodo_id (JOIN `composti_metodi`).

**Stato calcolato** (`computeStato` in `StatusBadge.tsx`):

| Stato | Condizione |
|---|---|
| `dismesso` | `data_dismissione` presente |
| `scaduto` | `scadenza_prodotto` < oggi |
| `in_scadenza` | scadenza entro 30 giorni |
| `attivo` | altrimenti |

**Pannello laterale** (`CompostoPanel`, SlidePanel 520px) — tre tab:

*Dettaglio* — tutti i campi readonly: classe, forma, forma commerciale, formula, MW, purezza, concentrazione, solvente, fiala, produttore, lotto, operatore apertura, data apertura, scadenza prodotto, data dismissione, destinazione uso, work standard, matrice, ubicazione, ARPA, mix, mix_id.

*Preparazioni* — lista con badge stato colorato (Attiva=verde, Esaurita=ambra, Scaduta=rosso, Dismessa=grigio). Badge arancione se scadenza entro 30 giorni. CRUD via modal. Campi: forma (Solido/Liquido), stato, concentrazione mg/L, volume mL, solvente, operatore, data prep, scadenza, posizione, note. Azione "Dismetti" con data dismissione.

*Storico* — lista eventi `composti_storia`. Pulsanti "Rivalidazione" e "Dismissione" → inseriscono record con data e note.

**Azioni panel**: Modifica (apre `CompostoForm`), Elimina (confirm dialog con avviso cascata).

**Aggiungi Mix Pesticidi** (`MixPesticidiForm`) — carica file `.txt` (un nome per riga), inserisce N record con metadati comuni (forma commerciale, forma, concentrazione, solvente, produttore, lotto, date, classe, destinazione uso). Tutti i record dello stesso flacone condividono il `mix_id` generato.

---

### 7.2 Metodi Analitici (`/metodi`)

Grid di card responsive. Ricerca su nome e matrice. Filtro per strumento (select).

**Card** (`MetodoCard`) — nome, badge strumento, matrice, colonna, gradiente, flusso.

**Drawer** (`MetodoDrawer`, SlidePanel 480px) — sezioni: Identificazione (matrice, LIMS ID, OQLab ID), Cromatografia LC (colonna, fase A/B, gradiente, flusso), MS (ionizzazione, polarità, acquisizione, SRM), Note, lista badge composti associati (caricati da `composti:list` con filtro `metodo_id`).

**Form** (`MetodoForm`, modal) — campi: nome*, strumento (select), matrice, LIMS ID, OQLab ID, colonna, fase A, fase B, gradiente, flusso, ionizzazione, polarità, acquisizione, SRM, note.

Elimina con confirm — CASCADE su `composti_metodi` e `consumabili_metodi`.

---

### 7.3 Strumenti (`/strumenti`)

Strip di selezione strumento (pill per strumento con dot stato verde/giallo/grigio). Info tipo e seriale sotto. CRUD via modal (id, codice, tipo, seriale, status).

Quattro tab interni:

**Eluenti** — tabella: nome, data inizio, data fine, componenti (badge sostanza+lotto), stato Attivo/Esaurito. CRUD con componenti dinamici (N righe). "Esaurisci" → `eluenti:close` → `data_fine = oggi`.

**Metodi** — lista read-only metodi con `strumento_id` corrispondente. Solo visualizzazione.

**Diario** — note ordinate per data decrescente. CRUD via modal: data, autore, metodo (select opzionale), testo.

**Query Storico** — date picker + filtro metodo opzionale → `query:snapshot` IPC → risultato strutturato:
- Eluenti attivi a quella data con componenti (SQL: `data_inizio <= data AND (data_fine IS NULL OR data_fine >= data)`)
- Consumabili attivi per il metodo (solo se metodo selezionato, SQL analogo su date apertura/chiusura)
- Composti del metodo con preparazione attiva a quella data (LEFT JOIN `preparazioni` su date)

---

### 7.4 Consumabili (`/consumabili`)

Tab orizzontali: Tutti / Colonna HPLC / SPE / Solvente / Sale / Altro. Ricerca client-side su nome, lotto, fornitore.

**Tabella** — colonne: tipo (badge), nome, lotto, fornitore, data apertura, data chiusura, stato Aperto/Chiuso, azioni.

**Azioni**: modifica, "Chiudi lotto" (`consumabili:close` → `data_chiusura = oggi`), elimina.

**Form** (modal) — campi: tipo (select), nome*, lotto, fornitore, data apertura, data chiusura, note, multi-select metodi associati.

---

### 7.5 Anagrafiche (`/anagrafiche`)

Grid di card. Ogni card = una categoria. Titolo rinominabile inline. Voci aggiungibili/modificabili/eliminabili inline. CRUD completo su categorie e voci.

---

## 8. Componenti Condivisi

| Componente | Descrizione |
|---|---|
| `DataTable` | Tabella generica con columns definition, sort, row click, render custom per cella |
| `SlidePanel` | Pannello slide destro (Shadcn `Sheet` side="right") — props: open, onClose, title, subtitle, width |
| `StatusBadge` + `computeStato` | Badge stato composto con logica di calcolo (soglia 30 giorni) |
| `ConfirmDialog` | Shadcn `AlertDialog` con variante danger |

---

## 9. IPC Handlers (Main Process)

| Handler | Operazioni |
|---|---|
| `composti.ipc.ts` | list (filtri SQL), get (+metodi_ids, storia, preparazioni), create, update, delete, create-mix, storia-add |
| `metodi.ipc.ts` | list (join strumenti → `strumento_codice`), get (+composti_ids), create, update, delete |
| `strumenti.ipc.ts` | list, get, create, update, delete |
| `eluenti.ipc.ts` | list (+componenti), create, update, close, delete |
| `preparazioni.ipc.ts` | list, create, update, dismiss (stato + data_dismissione), delete |
| `consumabili.ipc.ts` | list, create, update, close, delete |
| `diario.ipc.ts` | list per strumento, create, update, delete |
| `anagrafiche.ipc.ts` | list (+voci), create, rename, delete; add-voce, update-voce, delete-voce |
| `migration.ipc.ts` | `config:import-legacy` — import `lcms-data.json` → SQLite in transazione atomica con rollback |
| `query.ipc.ts` | `query:snapshot` — stato completo strumento a una data |

**Config IPC** (in `main/index.ts`): `config:get`, `config:select-folder`, `config:select-json`.

---

## 10. Migrazione da JSON Legacy

`migration.ipc.ts` legge `lcms-data.json` e inserisce tutto in SQLite in **singola transazione** con rollback su errore. Restituisce conteggi per entità (`{ strumenti: N, metodi: N, composti: N, ... }`).

Mapping campi: `Name→nome`, `Azienda→produttore`, `MW→peso_molecolare`, `Conc→concentrazione`, `FormaCommer→forma_commerciale`, `_storia[]→composti_storia`, `preps{}→preparazioni`, `metodiIds[]→composti_metodi`.

---

## 11. Gap Funzionali Noti

**Preparazioni work standard / soluzioni di lavoro** — Le preparazioni attuali sono collegate a un singolo composto (stock solution). Mancano le soluzioni di lavoro multi-composto (mix taratura/QC) legate a un metodo, con N composti ciascuno a concentrazione propria nella soluzione finale.

**Eluenti non collegati ai metodi** — `eluenti` ha FK su `strumenti` ma nessuna relazione con `metodi`. I campi `fase_a` e `fase_b` del metodo sono testo libero. Nel form metodo non è possibile selezionare tra gli eluenti installati sullo strumento scelto; manca tracciabilità diretta eluente↔metodo.

---

## 12. Sviluppi Futuri (da design doc)

| Modulo | Note |
|---|---|
| Dashboard | Contatori sintetici, alert scadenze prossime, stato strumenti |
| Gestione utenze | Autenticazione e log operatore (v2) |

---

## 13. Packaging

- **Windows:** directory x64 + ia32, senza firma
- **Mac:** `.dmg` (config separata `electron-builder.config.mac-legacy.js`)
- Migrazioni SQL incluse come `extraResources`
- Aggiornamento manuale: sostituire l'exe, le migrazioni partono automaticamente alla prima apertura

---

## 14. Git — Workflow

```bash
git status
git log --oneline --graph --all

git checkout -b feat/nome-feature
git add -A
git commit -m "feat: descrizione"
git checkout main && git merge feat/nome-feature
```

Convenzione commit usata nel progetto: `feat:` · `fix:` · `chore:` · `refactor:`
