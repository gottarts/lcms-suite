# LC-MS/MS Reparto — Analisi Funzionale

**Versione:** 1.0
**Data:** 2026-03-05
**Stato:** Documento di stato corrente

---

## 1. Descrizione Generale

Suite gestionale web per un reparto di analisi LC-MS/MS (Liquid Chromatography - Tandem Mass Spectrometry). L'applicazione gestisce strumenti, metodi analitici, standard di riferimento, consumabili e dati operativi del laboratorio.

Il software e' progettato per funzionare interamente lato client (browser Chrome/Edge), senza server backend, con persistenza dei dati su cartella di rete condivisa (NAS) e fallback locale.

---

## 2. Architettura Tecnica

### 2.1 Stack

| Componente | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla (nessun framework) |
| Shell di navigazione | `index.html` — sidebar + iframe |
| Pagine funzionali | File HTML standalone caricati in iframe |
| Stili condivisi | `_shared.css` (design system) |
| Storage Layer | `storage.js` — modulo `LabStorage` (v5) |
| Formato dati | `lcms-data.json` (JSON) |
| Font | IBM Plex Mono, IBM Plex Sans, Fraunces |

### 2.2 Persistenza Dati (Triple Mirror)

Il modulo `LabStorage` implementa una strategia di persistenza a tre livelli:

1. **File JSON su cartella di rete** (sorgente di verita') — via File System Access API
2. **IndexedDB** (mirror locale) — database `lcms_lab`, store `kv`
3. **localStorage** (fallback) — chiave `lcms_data`

Il nome della cartella e' salvato in `localStorage` (`lcms_folder_name`) per sopravvivere a pulizia dell'IndexedDB.

### 2.3 Sincronizzazione

| Caratteristica | Dettaglio |
|---|---|
| Polling | Ogni 10 secondi legge il file dalla cartella di rete |
| Merge | Smart merge per array (composti, metodi, colonne, eluenti, diario, spe, solventi, strumenti) basato su `_id`/`id`/`Name` |
| Conflitti | Il record piu' recente (`_savedAt`) ha priorita'; i record mancanti vengono aggiunti senza perdita |
| Flush | Debounced a 300ms dopo ogni modifica |
| Cross-tab | Evento `storage` su localStorage per sincronizzare tab multipli |
| Cross-iframe | `postMessage` con tipo `lcms-updated` / `storage-reload` |

### 2.4 Stati di Connessione

| Stato | Descrizione |
|---|---|
| `connected` | Cartella di rete collegata, permessi concessi, sync attivo |
| `needs-perm` | Handle salvato in IDB ma permesso scaduto (richiesto ad ogni sessione dal browser) |
| `folder-forgotten` | Memoria browser pulita, nome cartella in localStorage ma handle perso |
| `local` | Nessuna cartella configurata, solo dati locali |

### 2.5 Struttura Navigazione (Shell)

L'`index.html` funge da shell applicativa con:
- **Sidebar sinistra** (200px): logo, menu di navigazione, indicatori strumenti, widget connessione rete, orologio, backup/ripristino
- **Barra superiore**: titolo pagina, contatore strumenti online, orologio
- **Area iframe**: contenuto della pagina selezionata
- **Overlay modale**: gestione connessione rete (visibile di default, nascosto solo se `connected`)
- **Barra di sincronizzazione**: avvisi persistenti per stato non sincronizzato

---

## 3. Modello Dati

### 3.1 Schema Principale (`lcms-data.json`)

```
{
  version: 5,
  _savedAt: timestamp,

  composti: [                  // Standard di riferimento
    {
      _id: number,             // ID univoco auto-incrementale
      Name: string,            // Nome sostanza
      CodiceInterno: string,   // Codice interno laboratorio
      Formula: string,         // Formula bruta
      Classe: string,          // Antibiotico|Antiviral|FANS|Antimicotico|Diuretico|psyco|cardio
      Forma: string,           // Solution|Neat|Stock
      FormaCommer: string,     // Nome commerciale
      Purezza: string,         // % purezza (solo Neat)
      Conc: string,            // Concentrazione mg/L (solo Solution/Stock)
      Solvente: string,        // Solvente (solo Solution/Stock)
      Fiala: string,           // Identificativo fiala
      Azienda: string,         // Produttore
      Lotto: string,           // Numero di lotto
      OperatoreApertura: string,
      DataApertura: date,      // Data apertura CRM
      ScadenzaProdotto: date,  // Scadenza prodotto
      DataDismissione: date,   // Data dismissione/rivalidazione
      DestinazioneUso: string, // Taratura|QC|Taratura e QC
      WorkStandard: string,
      Matrice: string,
      MW: string,              // Peso molecolare
      Ubicazione: string,      // Posizione di stoccaggio
      ARPA: string,            // Y|N — flag ARPA
      Mix: string,             // Identificativo miscela
      mix_id: string,          // ID gruppo mix
      metodiIds: [string],     // Array di ID metodi associati
      _storia: [               // Storico rivalidazioni/dismissioni
        { tipo, data, note, ... }
      ]
    }
  ],

  preps: {                     // Preparazioni (chiave = _id composto)
    "0": [
      {
        _pid: number,
        flacone: string,
        conc: string,
        solvente: string,
        data_prep: date,
        scadenza: date,
        operatore: string,
        note: string
      }
    ]
  },

  strumenti: [                 // Piattaforme analitiche
    {
      id: string,              // tq1|tq2|tq3|qtof|instr_*
      code: string,            // TQ1|TQ2|TQ3|QTOF
      type: string,            // Triple Quadrupole · LC-MS/MS | High-Resolution MS · QTOF
      serial: string,          // Numero seriale
      status: string           // on|idle|off
    }
  ],

  metodi: [                    // Metodi analitici
    {
      id: string,              // met_* (generato)
      nome: string,            // Nome metodo
      strumentoId: string,     // Riferimento a strumento
      matrice: string,         // Urine|Sangue|Plasma|Siero|...
      colonna: string,         // Colonna HPLC usata
      phA: string,             // Fase mobile A
      phB: string,             // Fase mobile B
      gradiente: string,       // Programma gradiente
      flusso: string,          // Flusso
      ionizzazione: string,    // Tipo ionizzazione MS
      polarita: string,        // Polarita' MS
      acquisizione: string,    // Tipo acquisizione MS
      srm: string,             // SRM/MRM transitions
      limsId: string,          // ID integrazione LIMS (futuro)
      oqlabId: string,         // ID integrazione OQLab (futuro)
      note: string
    }
  ],

  metodi (strumenti.html): [   // Vista strumento-centrica
    {
      id: string,
      strumentoId: string,
      codice: string,          // Codice metodo
      nome: string,
      versione: string,
      matrice: string,
      eluenteA_id: string,     // Riferimento eluente A
      eluenteB_id: string,     // Riferimento eluente B
      stdIds: [string],        // ID composti associati
      note: string
    }
  ],

  eluenti: [                   // Eluenti installati per strumento
    {
      id: string,
      strumentoId: string,
      nome: string,            // es. "Acqua + 0.1% HCOOH"
      dataInizio: date,
      dataFine: date|null,     // null = in uso
      componenti: [
        { sostanza, lotto, fornitore }
      ]
    }
  ],

  diario: [                    // Note operative per strumento
    {
      id: string,
      strumentoId: string,
      data: date,
      autore: string,
      metodoId: string|null,
      testo: string
    }
  ],

  colonne: [],                 // HPLC columns (struttura prevista ma non implementata)
  spe: [],                     // SPE cartridges (non implementato)
  solventi: [],                // Solventi & sali (non implementato)

  anagrafiche: [               // Dizionari configurabili
    {
      id: string,
      nome: string,            // es. "Operatori", "Posizioni stoccaggio"
      voci: [string]           // Lista ordinata di valori
    }
  ],

  customCols: [],              // Colonne personalizzate tabella composti
  colOrder: [string],          // Ordine colonne tabella composti
  colVisible: { key: bool }    // Visibilita' colonne tabella composti
}
```

---

## 4. Moduli Funzionali — Stato Attuale

### 4.1 Composti / Standard DB (`composti.html`) — IMPLEMENTATO

Modulo principale per la gestione degli standard di riferimento (CRM, neat, solution).

**Funzionalita':**

| Funzione | Descrizione |
|---|---|
| Tabella completa | Griglia con tutte le colonne di sistema + colonne personalizzate |
| Ricerca full-text | Su tutti i campi testuali |
| Filtri combinabili | Per classe, forma (Neat/Solution/Stock), solvente, stato, metodo |
| Ordinamento | Per qualsiasi colonna (click su header), toggle asc/desc |
| Stato calcolato | Automatico: Attivo / In scadenza (2 mesi) / Scaduto / Rivalidato / Dismesso |
| Pannello laterale | Dettaglio composto con tab Preparazioni / Dettaglio / Storico |
| Preparazioni | CRUD completo: flacone, concentrazione, solvente, data prep, scadenza, operatore |
| Rivalidazione | Estensione scadenza con registrazione in storico |
| Dismissione | Marcatura dismissione con data e note in storico |
| Import Excel/CSV | Parsing client-side con mappatura colonne, anteprima, importazione batch |
| Gestione colonne | Aggiungi/rimuovi colonne custom, riordina con drag&drop, toggle visibilita' |
| Associazione metodi | Multi-select per associare composti a metodi analitici |
| Colonne sistema | 21 campi predefiniti (Name, CodiceInterno, Classe, Forma, Purezza, Conc, Solvente, Fiala, Azienda, Lotto, OperatoreApertura, DataApertura, ScadenzaProdotto, DataDismissione, DestinazioneUso, WorkStandard, metodiIds, Matrice, MW, Ubicazione, FormaCommer) |
| Badge visivi | Classe (pill colorata), forma (dot verde/arancione), stato (badge semantico) |
| Contatori | Header con totali, visualizzati, filtrati |

**UI:** Tabella scrollabile a larghezza completa + pannello laterale (420px) con animazione slide.

---

### 4.2 Metodi Analitici (`metodi.html`) — IMPLEMENTATO

Gestione dei metodi analitici con vista a griglia di card.

**Funzionalita':**

| Funzione | Descrizione |
|---|---|
| Griglia card | Card responsive (min 340px) con info metodo |
| Ricerca | Su nome, matrice, colonna, fasi, gradiente, note |
| Filtri | Per strumento, per matrice (Urine, Sangue, Plasma, Siero, Tessuto, Capelli, Acqua, Suolo, Alimento, Altro) |
| CRUD completo | Crea, modifica, elimina metodo via modal |
| Drawer dettaglio | Pannello laterale con tutte le info + composti associati |
| Associazione bidirezionale | I composti associati al metodo sono visibili e conteggiati |
| Eliminazione safe | Conferma con conteggio composti impattati; pulizia `metodiIds` dai composti |
| Statistiche | Totali, visualizzati, composti associati |

**Campi metodo:** Nome, strumento, matrice, colonna HPLC, fase A, fase B, gradiente, LIMS ID (futuro), OQLab ID (futuro), note.

**Campi MS (solo drawer):** Ionizzazione, polarita', acquisizione, SRM/MRM.

---

### 4.3 Strumenti (`strumenti.html`) — IMPLEMENTATO

Gestione delle piattaforme analitiche (strumenti LC-MS/MS) con vista tabbed.

**Funzionalita':**

| Funzione | Descrizione |
|---|---|
| Strip selezione strumento | Tab orizzontali con codice, tipo, seriale |
| Barra anagrafica | Dettaglio fisso: codice, tipo, seriale + bottone modifica |
| Tab interni | Eluenti / Metodi / Diario / Query storico |
| CRUD strumenti | Aggiungi, modifica, elimina strumento (con cascata su eluenti, metodi, diario) |

**Sub-modulo Eluenti:**

| Funzione | Descrizione |
|---|---|
| Tabella storica | Eluenti con componenti, lotti, date installazione/esaurimento |
| Stato | IN USO (dataFine null) / ESAURITO |
| Componenti dinamici | N componenti per eluente: sostanza, lotto, fornitore |
| Esaurisci | Marca eluente come esaurito con data odierna |

**Sub-modulo Metodi (vista strumento):**

| Funzione | Descrizione |
|---|---|
| Card espanse | Dettaglio metodo con eluenti A/B associati e standard |
| Snapshot temporale | Query "lotti attivi al giorno X" per un metodo: eluenti, colonna, standard con preparazioni attive |

**Sub-modulo Diario:**

| Funzione | Descrizione |
|---|---|
| Note operative | Per data, con operatore e metodo opzionali |
| Ordinamento | Cronologico inverso |

**Sub-modulo Query Storico:**

| Funzione | Descrizione |
|---|---|
| Interrogazione per data | Stato completo strumento ad una data: eluenti attivi con lotti, colonna installata, metodi, diario |
| Filtro per metodo | Opzionale, restringe diario e dettaglio |
| Output strutturato | Pannello formattato con tutte le info di tracciabilita' |

---

### 4.4 Anagrafiche (`anagrafiche.html`) — IMPLEMENTATO

Dizionari configurabili per popolare i menu a tendina nei form.

**Funzionalita':**

| Funzione | Descrizione |
|---|---|
| Sezioni dinamiche | N anagrafiche creabili dall'utente (es. Operatori, Posizioni stoccaggio, Fornitori) |
| Voci per sezione | Lista ordinata alfabeticamente, inline editing |
| CRUD completo | Crea/rinomina/elimina anagrafica; aggiungi/modifica/elimina voce |
| Migrazione | Supporto vecchio formato `{operatori:[], posizioni:[]}` -> array |
| Note informative | Disclaimer: non collegate alla tracciabilita', rinominare non modifica dati esistenti |

---

## 5. Moduli Previsti — NON IMPLEMENTATI

I seguenti moduli sono referenziati nella sidebar dell'index.html ma le relative pagine HTML non esistono.

### 5.1 Dashboard (`dashboard.html`)

**Scopo previsto:** Riepilogo generale del reparto.

**Contenuto suggerito:**
- Contatori sintetici: composti totali, attivi, in scadenza, scaduti
- Stato strumenti (on/idle/off) in tempo reale
- Ultimi eventi dal diario
- Composti in scadenza prossima (alert)
- Statistiche per classe/forma/solvente

### 5.2 Colonne HPLC (`colonne.html`)

**Scopo previsto:** Inventario colonne cromatografiche per strumento.

**Struttura dati prevista (da `strumenti.html`):**
```
{
  id, marca, modello, dimensioni, faseStaz, seriale,
  strumentoNote, dataInstallazione, dataDismissione, note
}
```

### 5.3 SPE Cartridge (`spe.html`)

**Scopo previsto:** Gestione cartucce per estrazione in fase solida.

**Dati:** Array `spe[]` nel data model, attualmente vuoto.

### 5.4 Solventi & Sali (`solventi.html`)

**Scopo previsto:** Gestione consumabili LC (solventi, sali, acidi).

**Dati:** Array `solventi[]` nel data model, attualmente vuoto.

### 5.5 Per Stoccaggio (`stoccaggio.html`)

**Scopo previsto:** Vista trasversale dei composti raggruppati per area di conservazione (ubicazione).

**Dati:** Basato sul campo `Ubicazione` dei composti.

### 5.6 Per Metodo (`per_metodo.html`)

**Scopo previsto:** Vista trasversale dei composti raggruppati per metodo analitico associato.

**Dati:** Basato su `metodiIds` dei composti + tabella `metodi`.

---

## 6. Funzionalita' Trasversali

### 6.1 Backup / Ripristino

- **Export**: Download completo del JSON come file `lcms_backup_YYYY-MM-DD.json`
- **Import**: Upload file JSON con sostituzione completa dei dati + reload

### 6.2 Design System (`_shared.css`)

Palette coerente con variabili CSS:
- **Base:** warm paper (#f5f4f0), surface (#faf9f7)
- **Accent:** forest green (#1a3a2a / #2a5a40)
- **Teal:** #1a6b5c / #228570 / #2da384
- **Semantici:** brass (warning), danger (red), info (blue), success (green)
- **Componenti:** card, table, modal, badge, button, toast, progress, stat-card, form, empty-state

### 6.3 Pattern di Comunicazione

```
index.html (shell)
    |
    |--- postMessage('lcms-updated') ---> iframe (pagina)
    |<-- postMessage('lcms-updated') --- iframe (pagina)
    |
    |--- LabStorage.onChange() ---> updateBadges()
    |--- LabStorage.onSyncChange() ---> applyState()
    |--- LabStorage.onPollUpdate() ---> broadcastReload()
```

### 6.4 Sicurezza

- Escaping HTML sistematico (`esc()`) in tutti i moduli per prevenire XSS
- File System Access API richiede interazione utente esplicita
- Nessun dato sensibile trasmesso in rete (tutto locale/NAS)
- Nessuna dipendenza esterna runtime (solo Google Fonts CDN)

---

## 7. File di Progetto

| File | Dimensione | Ruolo |
|---|---|---|
| `index.html` | 25 KB | Shell applicativa + sidebar + overlay rete |
| `composti.html` | 76 KB | Standard DB (modulo piu' complesso) |
| `strumenti.html` | 48 KB | Gestione strumenti con sub-moduli |
| `metodi.html` | 26 KB | Metodi analitici |
| `anagrafiche.html` | 17 KB | Dizionari configurabili |
| `storage.js` | 13 KB | Layer di persistenza |
| `_shared.css` | 18 KB | Design system condiviso |
| `lcms-data.json` | 21 KB | Dati correnti (~200 composti) |
| `Book1.xlsx` | 20 KB | Dati di importazione (sorgente) |
| `Old/` | — | Revisioni precedenti (archivio) |

---

## 8. Limitazioni Note

1. **Browser-only:** Richiede Chrome o Edge con supporto File System Access API (no Firefox/Safari)
2. **Single-file data:** Tutti i dati in un unico JSON — potenziale collo di bottiglia con dataset grandi
3. **No autenticazione:** Nessun controllo accesso utente
4. **No versioning dati:** Lo storico e' limitato al campo `_storia` dei composti
5. **Polling-based sync:** Latenza fino a 10s tra modifiche su PC diversi
6. **No offline queue:** Le modifiche offline vengono merge al reconnect, ma non c'e' coda ordinata
7. **Duplicazione logica metodi:** Il modulo metodi esiste sia in `metodi.html` (vista per card) che in `strumenti.html` (vista per strumento) con strutture dati leggermente diverse

---

## 9. Riepilogo Stato Implementazione

| Modulo | File | Stato | Complessita' |
|---|---|---|---|
| Shell / Navigazione | `index.html` | Completo | Media |
| Storage Layer | `storage.js` | Completo | Alta |
| Design System | `_shared.css` | Completo | Media |
| Standard DB | `composti.html` | Completo | Alta |
| Metodi Analitici | `metodi.html` | Completo | Media |
| Strumenti | `strumenti.html` | Completo | Alta |
| Anagrafiche | `anagrafiche.html` | Completo | Bassa |
| Dashboard | `dashboard.html` | **Da fare** | Media |
| Colonne HPLC | `colonne.html` | **Da fare** | Media |
| SPE Cartridge | `spe.html` | **Da fare** | Bassa |
| Solventi & Sali | `solventi.html` | **Da fare** | Bassa |
| Per Stoccaggio | `stoccaggio.html` | **Da fare** | Bassa |
| Per Metodo | `per_metodo.html` | **Da fare** | Bassa |
