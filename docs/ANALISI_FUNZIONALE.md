# Analisi Funzionale — LC-MS/MS Suite

**Versione:** 3.0
**Data:** 2026-03-24
**Fonte:** codice sorgente repository (lettura completa)

---

## 1. Descrizione Generale

Suite gestionale desktop per un reparto di analisi LC-MS/MS di ARPA. Gestisce l'intero ciclo di vita di standard di riferimento (CRM singoli e mix), metodi analitici, strumenti, eluenti, consumabili, preparazioni di laboratorio, soluzioni work/intermedie e schemi di calibrazione.

App **Electron** (v40) single-window. Database **SQLite** su file esterno (`lcms.db`) collocabile su NAS/SMB per condivisione multi-PC in uso sequenziale (nessuna concorrenza reale). Primo avvio: setup guidato per selezione/creazione cartella DB + importazione legacy JSON.

---

## 2. Stack Tecnico

| Componente | Tecnologia |
|---|---|
| Runtime | Electron 40, Node.js |
| Frontend | React 19, React Router 7 (HashRouter), TypeScript 5.9 |
| Styling | Tailwind CSS 4, Radix UI primitives, Lucide icons. Font: Lato (body), Karla (headings), IBM Plex Mono (code). Primary: teal (#168 45% 35%) |
| Build | Vite 7, esbuild, electron-builder |
| Database | better-sqlite3, WAL mode, foreign keys ON |
| Virtualizzazione | @tanstack/react-virtual (DataTable) |
| PDF | jspdf + jspdf-autotable |
| Excel | xlsx (importazione) |

### Architettura IPC

```
Renderer (React) ──→ preload/index.ts ──→ ipcMain handlers
                     contextBridge           (main process)
                     contextIsolation=true
```

Il preload espone un singolo `electronAPI.invoke(channel, ...args)` generico. I moduli API nel renderer (`src/renderer/lib/api.ts`) wrappano le chiamate per tipo-safe.

---

## 3. Database — Schema e Migrazioni

16 migrazioni SQL (001→016). Tabelle principali:

### 3.1 Tabelle Core

| Tabella | PK | Descrizione |
|---|---|---|
| `strumenti` | TEXT (id manuale) | Strumenti LC-MS: codice, tipo, seriale, status (on/idle/off) |
| `metodi` | TEXT (id manuale) | Metodi analitici: nome, strumento_id (FK), parametri cromatografici (colonna, fase_a/b, gradiente, flusso, ionizzazione, polarità, acquisizione, SRM), codici LIMS/OQLab |
| `composti` | INTEGER AUTO | CRM (standard): nome, codice_interno, formula, classe, forma, forma_commerciale, purezza, concentrazione, unita_conc, solvente, fiala, produttore, lotto, date (apertura, scadenza, dismissione), ubicazione, stoccaggio, mix/mix_id, volume_ml, arpa, accreditamento_crm |
| `preparazioni` | INTEGER AUTO | Preparazioni di soluzioni da CRM: stato (Attiva/Dismessa), concentrazione target/reale, dati calcolo (massa_pesata, purezza_usata, densità_solvente, modalità_aggiunta) |
| `eluenti` | TEXT (UUID) | Eluenti per strumento: nome, date inizio/fine |
| `eluenti_componenti` | INTEGER AUTO | Componenti eluente: sostanza, lotto, fornitore |
| `consumabili` | INTEGER AUTO | Tipi: colonna_hplc, spe, solvente, sale, altro. Dati: nome, lotto, fornitore, date apertura/chiusura |
| `diario` | INTEGER AUTO | Log per strumento+metodo: data, autore, testo libero |
| `anagrafiche` / `anagrafiche_voci` | INTEGER AUTO | Liste valori master (Classi, Produttori, Solventi, Ubicazioni, Posizioni stoccaggio, Operatori). UNIQUE(anagrafica_id, valore) |

### 3.2 Tabelle di Relazione

| Tabella | Tipo | Note |
|---|---|---|
| `composti_metodi` | N:M | composto ↔ metodo (ON DELETE CASCADE) |
| `composti_storia` | 1:N | Rivalidazioni, Dismissioni, aperture fiala. Campi: tipo, data, note, n_registro_qc, batch_analitico, lotto_crm_valido, fiala_numero, nuova_scadenza |
| `consumabili_metodi` | N:M | consumabile ↔ metodo |

### 3.3 Tabelle Work & Calibrazione

| Tabella | Tipo | Descrizione |
|---|---|---|
| `work` | Core | Soluzioni work: nome, concentrazione, conc_variabile, unita_conc, volume_ml, solvente, validita_mesi (NULL = "al momento"), operatore, livello (0=Work, 1+=Intermedia) |
| `work_ingredienti` | 1:N | Ingredienti: source_type (crm/work), source_id, volume_prelievo_ml, fattore_diluizione, conc_target_mgL, modo_calcolo (conc/dil) |
| `work_metodi` | N:M | work ↔ metodo |
| `work_preparazioni` | 1:N | Storico preparazioni effettive: data_prep, note, operatore |
| `schema_calibrazione` | 1:1 per metodo | schema_json blob JSON con workCols, removedCon, removedMix |
| `metodo_analiti` | 1:N per metodo | Lista analiti del metodo: nome, ordine. UNIQUE(metodo_id, nome). Popolata automaticamente da composti_metodi alla migrazione 016 |

### 3.4 Indici di Performance

- `idx_preparazioni_composto` su preparazioni(composto_id)
- `idx_storia_composto` su composti_storia(composto_id)
- `idx_composti_metodi_composto` su composti_metodi(composto_id)
- `idx_composti_metodi_metodo` su composti_metodi(metodo_id)
- `idx_work_ingredienti_work/source` su work_ingredienti
- `idx_metodo_analiti_metodo` su metodo_analiti(metodo_id)

---

## 4. Pagine e Funzionalità

### 4.1 SetupPage (`pages/setup/SetupPage.tsx`)

**Scopo:** Wizard primo avvio / configurazione DB.

**Funzionalità:**
- Selezione cartella per il file `lcms.db` (crea se non esiste, apre se esiste)
- Importazione dati da JSON legacy (`lcms-data.json`) con mappatura campi vecchio formato
- Contatori elementi importati (strumenti, metodi, composti, storia, preparazioni, eluenti, diario, anagrafiche)
- Callback `onComplete` → sblocca l'app e mostra il layout principale

---

### 4.2 CompostiPage (`pages/composti/`) — DB Composti / CRM

Pagina più complessa dell'app. Modulo principale per gestione standard di riferimento.

#### 4.2.1 CompostiPage.tsx — Orchestratore

**Stato principale:**
- `composti[]`: lista caricata via `compostiApi.list()`
- `selected`: composto selezionato (panel laterale)
- `panelMode`: 'view' | 'edit' | 'new' | 'new-mix'
- `selectedIds` + `lastClickedId`: selezione multipla per operazioni bulk
- `searchFilter`: filtro globale testo libero

**Funzionalità:**
- Calcolo stato composti (`computeStato()`): attivo, in_scadenza, scaduto, dismesso, da_aprire, rivalidato_attivo, rivalidato_in_scadenza, rivalidato_scaduto. Logica: confronta `scadenza_prodotto` con data odierna e soglia 60 giorni; se ha `ultima_rivalidazione` (da composti_storia), la usa come nuova scadenza effettiva
- Toolbar con: Nuovo Composto, Nuovo Mix, Import CSV, Export, Etichette vial
- Selezione multipla (checkbox + Shift+click)
- Apertura dialoghi: StoriaDialog (rivalidazione/dismissione singola o bulk), ApriAperturaDialog (fiala), ImportDialog, ExportDialog, EtichetteDialog, MixPesticidiForm
- **Flusso bulk a 2 fasi** (rivalidazione/dismissione di più composti):
  1. **Fase 1 (MixScopeDialog)**: "Applicare ai N selezionati o a tutti i M componenti del mix?" → decide `propagate` flag. Se lotti diversi tra i selezionati, raggruppa per mix_id
  2. **Fase 2 (LottoRivalidaDialog, solo rivalidazione)**: per ogni lotto distinto, chiede lotto CRM valido + nuova scadenza specifica. Iterazione gestita da `mixScopeQueue[]` e `lottoScopeQueue[]`
- **Persistenza localStorage**: visibilità colonne (`colVisible`), ordine colonne (`colOrder`), filtri colonna (`colFilters`)
- Filtri attivi: per stato, per destinazione uso, per work standard, per metodo associato, per flag "attenzione" (campi mancanti)

#### 4.2.2 CompostiTable.tsx — Tabella Principale

**Caratteristiche critiche (NON semplificare):**
- Usa `DataTable` generico con virtualizzazione @tanstack/react-virtual
- **Selezione bulk con checkbox**: singola click, Shift+click per range
- **Filtri per colonna**: ogni colonna ha un input filtro indipendente (ColumnFilterInput con stato locale per evitare perdita focus)
- **Visibilità/ordine colonne**: menu dropdown per toggle colonne visibili
- **Colonne:** nome, codice_interno, forma, forma_commerciale, classe, purezza, concentrazione, unita_conc, solvente, fiala, produttore, lotto, operatore_apertura, data_apertura, scadenza_prodotto, ubicazione, stoccaggio, stato (badge colorato), arpa, mix
- **Badge RIVALIDATO**: se il composto ha `ultima_rivalidazione`, mostra badge "RIVALIDATO" con tooltip nuova scadenza
- **Indicatori campi mancanti**: highlight visivo per campi vuoti obbligatori
- **Menu contestuale riga**: ApriAperturaDialog, FialeSelector, Rivalidazione, Dismissione, Elimina, Nuovo lotto

#### 4.2.3 CompostoPanel.tsx + CompostoForm.tsx — Dettaglio / Modifica

**CompostoPanel** (SlidePanel laterale):
- Vista dettaglio con tutti i campi del composto
- Tab: Dettagli, Preparazioni, Storia
- Azioni: Modifica, Elimina, Nuovo lotto
- Se mix: mostra conteggio componenti e azioni su tutti i componenti

**CompostoForm** (form di creazione/modifica):
- Campi con AutocompleteInput per classe, produttore, solvente, ubicazione, stoccaggio, operatore (suggerimenti da anagrafiche + `composti:distinct-values`)
- Selezione metodi multipli (checkbox)
- Validazione: nome obbligatorio
- Sync automatica anagrafiche: salvataggio composto → `syncVociDb()` nel backend aggiorna automaticamente le voci anagrafica

#### 4.2.4 MixPesticidiForm.tsx — Creazione Mix

**Funzionalità:**
- Form per creare un mix (più composti con stesso lotto/mix_id)
- Due flussi:
  1. **Nuovo mix**: lista nomi componenti digitati dall'utente o incollati (uno per riga)
  2. **Nuovo lotto di mix esistente**: carica i componenti dal mix_id esistente (`composti:list-by-mix`), permette override per-riga di forma_commerciale, lotto, scadenza, data_apertura, produttore
- Campi comuni: forma_commerciale, concentrazione, solvente, produttore, lotto, date
- Supporto componenti con campi individuali (per-row override)
- Metodi associati (checkbox)
- Backend genera `mix_id` automaticamente (prefisso `mix_` + timestamp base36)

#### 4.2.5 PrepCalcTool.tsx — Calcolatore Preparazione

Calcolatore inline per preparazione di soluzioni madre:
- Input: massa pesata, purezza, volume solvente/soluzione, densità solvente
- Due modalità: volume (V = m·P/C) o pesata (m = C·V/P)
- Calcolo concentrazione reale automatico
- Densità solvente: lookup automatico da tabella (`solventDensities.ts`)

#### 4.2.6 PreparazioniTab.tsx — Gestione Preparazioni CRM

- Lista preparazioni del composto selezionato
- Creazione nuova preparazione con PrepCalcTool integrato
- Modifica/dismissione preparazione esistente
- Campi: forma, flacone, concentrazione, unita_conc, solvente, data_prep, scadenza, operatore, ubicazione, stoccaggio, note
- Campi calcolo: massa_pesata, purezza_usata, densita_solvente, modalita_aggiunta, concentrazione_reale, concentrazione_target

#### 4.2.7 StoriaDialog.tsx — Rivalidazione / Dismissione

**Caratteristiche critiche (NON semplificare):**
- **Modalità singola**: rivalidazione o dismissione di un composto
- **Modalità bulk** (props `onSavedBulk`, `isBulk`, `bulkLottiDistinti`):
  - Routing: se i composti selezionati hanno lotti diversi → chiede "Applicare a tutto il mix di ogni composto?" / "Solo ai selezionati"
  - Se un solo lotto → applica a tutto il mix
  - `propagate: true/false` passato al backend per controllare se estendere al mix
- Campi rivalidazione: data, note, n_registro_qc, batch_analitico, lotto_crm_valido, nuova_scadenza
- Campi dismissione: data, note
- Il backend propaga automaticamente agli altri componenti del mix (se `propagate=true`)
- Aggiorna `data_dismissione` sul composto in caso di dismissione

#### 4.2.8 ApriAperturaDialog.tsx — Registrazione Apertura Fiala

- Registra l'apertura di una nuova fiala (numero fiala, data, operatore)
- Propaga a tutti i composti con lo stesso lotto (siblings)
- Inserisce record in `composti_storia` con tipo='apertura_fiala'

#### 4.2.9 FialeSelector.tsx — Selezione Fiala Attiva

- Dropdown per selezionare quale fiala è attualmente in uso
- Aggiorna il campo `fiala` del composto
- Propaga la fiala a tutti i composti con lo stesso lotto

#### 4.2.10 ImportDialog.tsx — Import da CSV/Excel

- Import composti da file CSV/TSV/Excel (.xlsx)
- Mappatura colonne automatica per corrispondenza nome
- Anteprima dati senza limite righe (rimosso il precedente limite di 20)
- Filtro righe senza nome (non importa righe vuote)
- Creazione batch con `compostiApi.create()` per ogni riga

#### 4.2.11 ExportDialog.tsx — Export Dati

- Export composti con storia e preparazioni
- **Scope**: selected | filtered | all (passa array di id a `composti:export-data`)
- **Formati**:
  - **CSV**: tabella flat con tutti i campi, Excel-compatible
  - **PDF "Quaderno CRM"**: copertina + tabella riepilogativa + schede per-composto (anagrafica, storico eventi, preparazioni nidificate). Usa `jspdf` + `jspdf-autotable`
- Helper `computeStatoLabel()` locale per label stato (Attivo/In scadenza/Scaduto/Dismesso, soglia 30gg)
- Helper `cleanText()` per sanitizzare caratteri Unicode invisibili

#### 4.2.12 EtichetteDialog.tsx — Stampa Etichette Vial

- Genera PDF con etichette per vial
- Dati: nome, lotto, concentrazione, solvente, data_apertura, scadenza, operatore, fiala
- Usa `jspdf` + `jspdf-autotable`

#### 4.2.13 CompostiStats.tsx — Badge Statistiche

- Contatori per stato: attivi, in_scadenza, scaduti, dismessi
- Cliccabili per filtrare la tabella

---

### 4.3 MetodiPage (`pages/metodi/`) — Gestione Metodi

#### 4.3.1 MetodiPage.tsx — Lista e Orchestratore

- Lista metodi con filtro testo
- Apertura drawer laterale per dettaglio/modifica
- Navigazione a SchemaCalibrazione

#### 4.3.2 MetodoCard.tsx — Card Singolo Metodo

- Card con info metodo: nome, strumento, matrice, colonna
- Badge conteggio composti associati
- Click → apre drawer

#### 4.3.3 MetodoDrawer.tsx — Drawer Laterale

- Vista: dettagli metodo + tabs (Metodo readonly, Analiti, Schema Calibrazione)
- Tab **Analiti**: lista analiti del metodo (`metodo_analiti`), aggiunta/rimozione manuale, TextImportDialog per import bulk da testo
- Tab **Schema**: apre SchemaCalibrazione full-page

#### 4.3.4 MetodoForm.tsx — Form Creazione/Modifica

- Tutti i campi metodo: nome, strumento (select), matrice, colonna, fase_a/b, gradiente, flusso, ionizzazione, polarità, acquisizione, SRM, lims_id, oqlab_id, note
- Selezione composti associati (checkbox)
- **Merge detection**: se il nuovo nome collide con un metodo esistente, il backend restituisce `needsMerge: true` → il frontend chiede conferma e chiama `metodi:merge` che unisce composti e analiti dei due metodi
- Creazione implicita metodo: `metodi:get-or-create` dal form composto

#### 4.3.5 SchemaCalibrazione — Designer Visuale Calibrazione

Componente complesso su 4 file:

**Struttura file:**
- `SchemaCalibrazione.types.ts`: tipi (SorgenteSel, WorkInSchema, CrmItem, AnalitoItem, ConnectionLine, palette colori C)
- `SchemaCalibrazione.logic.ts`: hook `useSchemaData`, funzioni calcolo (getConcInfo, targetColIdx, calcolaVols, getCompsFromWork, salvaWorkNelDb, computeConnections)
- `SchemaCalibrazione.grid.tsx`: GrigliaAnalitiCrm (griglia 3 colonne Analiti|Mix|Singoli), ModalCreaWork (form modale)
- `SchemaCalibrazione.tsx`: componente root con ColonneWork, DrawerDettaglioWork, SVG ConnectionsOverlay

**Flusso operativo (4 step):**
1. **Lettura CRM**: carica analiti da `metodo_analiti` + CRM disponibili da `composti:list-for-schema` (esclude dismessi e scaduti senza rivalidazione attiva)
2. **Rimozione CRM indesiderati**: per analiti che hanno sia mix che singolo (flag `isCon`), l'utente sceglie quale tenere con pulsante × per rimuovere mix o singolo (`removedCon`, `removedMix`)
3. **Selezione sorgenti**: click sulle card CRM per selezionarle come ingredienti della Work
4. **Crea Work**: form modale con nome, concentrazione (omogenea o variabile), volume finale, solvente, validità mesi, operatore. Calcolo volumi automatico (C1V1=C2V2 per concentrazione, Vfin/N per diluizione)

**Funzionalità chiave:**
- Griglia analiti con righe allineate verticalmente: ogni riga = un analita, colonne Mix CRM (card con chip) e Singoli (card selezionabile)
- Chip nei mix mostrano nome + concentrazione per ogni componente
- Colonne Work dinamiche: Work (livello 0) + Intermedie (livello 1+), aggiungibili con pulsante +
- **SVG ConnectionsOverlay**: frecce Bézier animate che collegano sorgenti → Work (ref DOM, ResizeObserver, scroll tracking)
- **Auto-save debounced** (500ms): schema salvato come JSON in `schema_calibrazione`
- **Ricarica / Reset**: ricarica da DB o ricomincia da zero (con conferma)
- **DrawerDettaglioWork**: pannello laterale con tabella volumi, catena di tracciabilità ricorsiva (Work→sorgenti→CRM), lista composti con concentrazione calcolata
- **Salvataggio Work nel DB**: se `validitaMesi > 0`, crea record in tabella `work` con ingredienti. Se "al momento" (null), resta solo nello schema JSON
- Navigazione al DB Composti: click su nome analita → chiude schema e naviga a `/composti` con filtro search

#### 4.3.6 MetodiReadonlyTab.tsx — Vista Readonly

- Tab nel dettaglio strumento: lista metodi dello strumento in sola lettura

---

### 4.4 StrumentiPage (`pages/strumenti/`) — Gestione Strumenti

#### 4.4.1 StrumentiPage.tsx — Orchestratore

- Lista strumenti con filtro
- Form creazione/modifica inline
- Tabs per strumento selezionato: Metodi, Eluenti, Diario, Query

#### 4.4.2 EluentiTab.tsx — Gestione Eluenti

- Lista eluenti per strumento con stato (aperto/chiuso)
- Form creazione/modifica con componenti dinamici (aggiungi/rimuovi riga componente)
- Chiusura eluente (data_fine = oggi)
- Ogni componente: sostanza, lotto, fornitore

#### 4.4.3 DiarioTab.tsx — Diario Strumento

- Log testuale per strumento, filtrabile per metodo
- Creazione/modifica/eliminazione entry
- Campi: data, autore, testo, metodo (opzionale)

#### 4.4.4 QueryTab.tsx — Snapshot Tracciabilità

- **Query snapshot**: dato uno strumento, un metodo (opzionale) e una data, restituisce lo stato del laboratorio a quella data:
  - Eluenti attivi (data_inizio ≤ data ≤ data_fine) con componenti
  - Consumabili attivi per il metodo (data_apertura ≤ data ≤ data_chiusura)
  - Composti del metodo con preparazione attiva alla data (data_prep ≤ data, scadenza ≥ data)
- Usato per rispondere a audit: "cosa era in uso il giorno X?"

---

### 4.5 ConsumabiliPage (`pages/consumabili/`)

- CRUD consumabili: colonna HPLC, SPE, solvente, sale, altro
- Filtro per tipo
- Form con campi: tipo, nome, lotto, fornitore, data_apertura, data_chiusura, note
- Associazione a metodi (checkbox)
- Chiusura rapida (data_chiusura = oggi)

---

### 4.6 WorkPage (`pages/work/`) — Soluzioni Work

#### 4.6.1 WorkPage.tsx — Lista Work

- Lista tutte le Work con badge stato laboratorio (attiva, in_scadenza, scaduta, non_preparata)
- Calcolo stato: basato su ultima_preparazione + validita_mesi. Soglia "in_scadenza" = 20% del periodo
- Filtro testo
- Click → apre WorkDrawer

#### 4.6.2 WorkDrawer.tsx — Dettaglio Work

**Funzionalità:**
- Vista dettaglio: nome, concentrazione (omogenea/variabile), volume, solvente, validità, operatore
- **Lista ingredienti**: source_type (CRM/Work), nome sorgente, lotto (se CRM), mix commerciale (se mix)
- **Preparazioni**: tab con storico preparazioni (`work_preparazioni`), form per registrare nuova preparazione (data, note, operatore)
- **Badge stato**: calcolato dal backend (`calcolaStatoLab`)
- Azioni: Modifica, Elimina

#### 4.6.3 WorkForm.tsx — Form Creazione/Modifica

- Campi: nome, concentrazione, conc_variabile (toggle), unita_conc, volume_ml, solvente, validita_mesi (NULL = "al momento"), operatore, note, livello
- **Ingredienti dinamici**: aggiungi/rimuovi righe, per ogni riga: source_type (crm/work), selezione sorgente (autocomplete), volume_prelievo, fattore_diluizione/conc_target, modo_calcolo
- Associazione metodi (checkbox)

---

### 4.7 AnagrafichePage (`pages/anagrafiche/`)

#### 4.7.1 AnagrafichePage.tsx — Gestione Liste Valori

- Lista anagrafiche (Classi, Produttori, Solventi, Ubicazioni, Posizioni stoccaggio, Operatori)
- Per ogni anagrafica: lista voci editabili

#### 4.7.2 AnagraficaCard.tsx — Card Singola Anagrafica

**Funzionalità:**
- Visualizzazione/aggiunta/rimozione voci
- **Rinomina con propagazione** (`rename-voce-propagate`): rinominare una voce aggiorna automaticamente tutti i composti che la usano nel campo DB corrispondente
- **Merge voci** (`merge-voci`): unire due voci della stessa anagrafica riassegna tutti i composti dalla voce sorgente alla destinazione, poi elimina la sorgente
- Mapping campo DB ↔ anagrafica: classe→Classi, produttore→Produttori, solvente→Solventi, stoccaggio→Posizioni stoccaggio, ubicazione→Ubicazioni, operatore_apertura→Operatori

#### 4.7.3 anagrafiche-sync.ts — Sync Automatica

- Funzione helper per sincronizzare voci anagrafica dopo salvataggio composto
- Mapping `ANAGRAFICA_CAMPO_MAP` nel backend: durante `composti:create` e `composti:update`, chiama `syncVociDb()` che inserisce automaticamente nuovi valori nelle anagrafiche corrispondenti

---

## 5. Componenti Condivisi

### 5.1 Layout

| Componente | File | Funzione |
|---|---|---|
| AppLayout | `components/layout/AppLayout.tsx` | Layout con Sidebar + Topbar + Outlet |
| Sidebar | `components/layout/Sidebar.tsx` | Navigazione laterale: DB Composti, Metodi, Strumenti, Consumabili, Anagrafiche, Work |
| Topbar | `components/layout/Topbar.tsx` | Barra superiore con titolo |

### 5.2 Componenti Riutilizzabili

| Componente | File | Funzione |
|---|---|---|
| DataTable | `components/shared/DataTable.tsx` | Tabella generica con sorting, filtri per colonna, virtualizzazione (@tanstack/react-virtual, soglia 50 righe), ColumnFilterInput con stato locale per evitare perdita focus |
| SlidePanel | `components/shared/SlidePanel.tsx` | Pannello laterale slide-in per dettagli/form |
| ConfirmDialog | `components/shared/ConfirmDialog.tsx` | Dialog di conferma con varianti (default/danger) |
| StatusBadge | `components/shared/StatusBadge.tsx` | Badge colorato per stato composto. Esporta anche `computeStato()` (logica: dismesso→da_aprire→scadenza→rivalidazione, soglia 60gg) e `getCampiMancanti()` (campi obbligatori: nome, forma, lotto, produttore, classe, solvente, ubicazione, destinazione_uso, data_apertura, fiala; purezza/concentrazione condizionali per forma Neat) |
| AutocompleteInput | `components/shared/AutocompleteInput.tsx` | Input con suggerimenti dropdown da anagrafiche/distinct values |
| TextImportDialog | `components/shared/TextImportDialog.tsx` | Dialog per importare lista di stringhe da testo (es. analiti da incollare) |

### 5.3 UI Primitives (Radix)

Tutti in `components/ui/`: alert-dialog, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, table, tabs, textarea, tooltip.

### 5.4 Utility

| File | Contenuto |
|---|---|
| `lib/utils.ts` | `cn()` per merge classi Tailwind |
| `lib/unita.ts` | Lista unità di concentrazione |
| `lib/solventDensities.ts` | Tabella densità solventi per PrepCalcTool |
| `lib/anagrafiche-sync.ts` | Helper sync anagrafiche (frontend) |

---

## 6. Routing

```
/composti      → CompostiPage (default, redirect da *)
/metodi        → MetodiPage
/strumenti     → StrumentiPage
/consumabili   → ConsumabiliPage
/anagrafiche   → AnagrafichePage
/work          → WorkPage
```

---

## 7. Funzionalità Trasversali

### 7.1 Gestione Mix

- I composti con forma="Mix" condividono un `mix_id` e un `lotto`
- Aggiornamento mix: modifica di un componente propaga i campi comuni a tutti i componenti dello stesso `mix_id`
- Dismissione/Rivalidazione: propagazione automatica o selettiva (flag `propagate`)
- Apertura fiala: propaga a tutti i composti con lo stesso lotto
- Conteggio: `composti:count-by-mix`, `composti:count-by-lotto`
- Eliminazione: `composti:delete-by-mix-id` (tutto il mix), `composti:delete-by-lotto`

### 7.2 Metodo ↔ Analiti

Relazione bidirezionale gestita da due tabelle:
- `composti_metodi`: N:M tra composti e metodi (legacy, mantiene la FK)
- `metodo_analiti`: lista nomi analiti del metodo (fonte autorevole per SchemaCalibrazione). Popolata automaticamente quando si collegano/scollegano composti

Aggiunta analita: inserisce in `metodo_analiti` + cerca composti con lo stesso nome → crea link in `composti_metodi`
Rimozione analita: rimuove da `metodo_analiti` + rimuove link `composti_metodi` per composti con lo stesso nome

### 7.3 Importazione Legacy

Handler `config:import-legacy`: importa JSON con formato vecchio in una singola transazione DB. Mappa campi con naming diverso (es. `Name`→`nome`, `Azienda`→`produttore`, `FormaCommer`→`forma_commerciale`). Supporta tutti i tipi: strumenti, metodi, composti (con storia e link metodi), preparazioni, eluenti (con componenti), diario, anagrafiche (con voci).

### 7.4 Auto-save Anagrafiche

Ogni salvataggio composto (create/update) chiama `syncVociDb()` che:
1. Per ogni campo mappato (classe, produttore, solvente, stoccaggio, ubicazione, operatore_apertura)
2. Trova o crea l'anagrafica corrispondente
3. Inserisce la voce se non esiste (INSERT OR IGNORE)

Questo garantisce che le liste anagrafica siano sempre allineate ai valori usati nei composti.

---

## 8. Aree di Miglioramento Identificate

### 8.1 Architettura e Codice

- **API non tipizzate**: `api.ts` usa `Promise<any>` ovunque. Manca tipizzazione dei return type IPC → errori runtime non intercettati dal compiler
- **Nessuna gestione errori strutturata nel frontend**: le chiamate IPC non hanno try/catch sistematico. Errori DB mostrati come console.error nel main process senza feedback all'utente
- **Duplicazione logica stato composto**: `computeStato()` è nel renderer (CompostiPage). Dovrebbe essere nel backend per coerenza con filtri/ordinamento DB
- **Nessun test**: zero test unitari o di integrazione. Regressioni scoperte solo manualmente
- **Stile inline in SchemaCalibrazione**: tutto il CSS è inline con oggetti style. Non usa Tailwind come il resto dell'app → difficile da mantenere e non coerente
- **Assenza di error boundary React**: un errore in un componente può crashare tutta l'app

### 8.2 Database e Performance

- **Nessuna paginazione**: `composti:list` carica TUTTI i composti in memoria. Con migliaia di record, la query è ottimizzata (subquery scalari) ma il trasferimento IPC e il rendering rimangono O(N)
- **Query snapshot non paginata**: `query:snapshot` potrebbe restituire risultati molto grandi
- **Mancanza di indici su campi filtro**: nessun indice su `composti.nome`, `composti.classe`, `composti.lotto` — i filtri fanno full-scan
- **WAL mode senza checkpoint esplicito**: il file WAL può crescere indefinitamente

### 8.3 UX e Funzionalità

- **SchemaCalibrazione**: layout chip mix può andare in overflow con mix molto grandi (>30 componenti). Fix parziale applicato ma non definitivo
- **Nessun undo/redo**: operazioni distruttive (elimina, dismissione) sono irreversibili senza conferma adeguata
- **Export limitato**: solo JSON, manca export XLSX/CSV diretto
- **Nessuna stampa/report**: manca generazione report periodici (inventario, scadenze imminenti, storico preparazioni)
- **Work page**: manca la vista "ingredienti mancanti" — non evidenzia quando un CRM usato come ingrediente è scaduto/dismesso
- **Assenza di notifiche proattive**: nessun alert per CRM in scadenza o preparazioni scadute al login
- **Multi-utenza**: nessun sistema di autenticazione/autorizzazione. Tutti gli utenti hanno accesso completo. Nessun log di chi ha fatto cosa (audit trail incompleto: solo `operatore_apertura` e `autore` diario)

### 8.4 Build e Deploy

- **Packaging solo macOS testato**: script `package:mac` e `package:mac-legacy`. Manca build Windows verificata
- **Nessun auto-update**: aggiornamenti manuali, nessun electron-updater configurato

---

## 9. Mappa Dipendenze File

```
main/
  index.ts                 → entry point, crea window, registra IPC
  config.ts                → lettura/scrittura config.json (userData)
  db.ts                    → gestione SQLite (open/close/migrate)
  ipc/
    strumenti.ipc.ts       → CRUD strumenti
    metodi.ipc.ts          → CRUD metodi + merge + get-or-create
    composti.ipc.ts        → CRUD composti, mix, storia, export, fiala, distinct-values, list-for-schema
    preparazioni.ipc.ts    → CRUD preparazioni + dismiss
    eluenti.ipc.ts         → CRUD eluenti + componenti + close
    consumabili.ipc.ts     → CRUD consumabili + close
    diario.ipc.ts          → CRUD diario
    anagrafiche.ipc.ts     → CRUD anagrafiche/voci + sync + rename-propagate + merge
    query.ipc.ts           → snapshot tracciabilità
    work.ipc.ts            → CRUD work + ingredienti + preparazioni + stato lab
    schemaCalibrazione.ipc.ts → get/save schema JSON
    metodo-analiti.ipc.ts  → CRUD analiti metodo
    migration.ipc.ts       → import JSON legacy
  migrations/              → 16 file SQL (001→016)

renderer/
  App.tsx                  → routing + DB ready check
  main.tsx                 → React entry point
  lib/
    api.ts                 → wrapper IPC per ogni entità
    utils.ts               → cn() Tailwind merge
    unita.ts               → lista unità concentrazione
    solventDensities.ts    → tabella densità solventi
    anagrafiche-sync.ts    → helper sync anagrafiche frontend
  components/
    layout/                → AppLayout, Sidebar, Topbar
    shared/                → DataTable, SlidePanel, ConfirmDialog, StatusBadge, AutocompleteInput, TextImportDialog
    ui/                    → Radix primitives wrappati (15 componenti)
  pages/
    setup/                 → SetupPage
    composti/              → CompostiPage, CompostiTable, CompostoPanel, CompostoForm, MixPesticidiForm, PrepCalcTool, PreparazioniTab, StoriaDialog, ApriAperturaDialog, FialeSelector, ImportDialog, ExportDialog, EtichetteDialog, CompostiStats
    metodi/                → MetodiPage, MetodoCard, MetodoDrawer, MetodoForm, SchemaCalibrazione (4 file), MetodiReadonlyTab
    strumenti/             → StrumentiPage, EluentiTab, DiarioTab, QueryTab
    consumabili/           → ConsumabiliPage, ConsumabileForm
    work/                  → WorkPage, WorkDrawer, WorkForm
    anagrafiche/           → AnagrafichePage, AnagraficaCard

shared/
  types.ts                 → Interfacce TypeScript condivise (12 entità + IPC shape)

preload/
  index.ts                 → contextBridge: invoke, getConfig, selectFolder, selectJson, importLegacyJson
```
