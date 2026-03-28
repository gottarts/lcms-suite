# Piano definitivo — Modulo Work & Schema Calibrazione
**Sessione 20 marzo 2026 — LC-MS/MS Suite**
**Revisione: scadenza come periodo di validità (mesi), non data assoluta**

---

## 1. Concetti fondamentali

### CRM (Reference Standard) — già nel sistema
- Tabella `composti`, `forma` = Neat / Solution / Mix
- Mix raggruppate per `mix_id` — indivisibili in ogni operazione
- `data_dismissione IS NULL` = disponibile
- Concentrazione: omogenea se tutti i componenti hanno stesso valore, variabile altrimenti

### Work
- Soluzione preparata diluendo uno o più CRM e/o altre Work
- **Non legata a un metodo specifico** — usata in N metodi (N:N)
- **Con validità (mesi)** → tracciata nel sistema: la data di scadenza reale si calcola solo al momento della preparazione fisica, nel modulo Tracciabilità
- **Senza validità** → preparata al momento, non tracciata
- Gerarchia a 3 livelli: CRM → Work → Work intermedia
- Mix CRM e Work sono sempre **indivisibili**: si usano tutte o niente

### Scadenza — periodo di validità, non data assoluta
La Work nello Schema Calibrazione è uno **schema ricorrente**, non un'istanza fisica.
Inserire una data assoluta non ha senso perché la stessa Work può essere preparata più volte.

**Nel form Work si inserisce:**
- `validita_mesi` (intero, opzionale) — es. `6` = valida 6 mesi dalla preparazione
- Se valorizzato → Work "tracciata" (apparirà nel modulo Tracciabilità)
- Se vuoto → Work "al momento" (non tracciata)

**La data di scadenza reale** (`data_prep + validita_mesi`) viene calcolata solo nel modulo Tracciabilità, quando si registra la preparazione fisica della Work.

### Calcolo volumi — due modalità
- **Sorgente omogenea** (singolo CRM, mix con tutti stessa conc., work con conc. nominale): campo = conc. target mg/L → calcolo C1V1 = C2V2: `V_prelievo = (C_target × V_finale) / C1`
- **Sorgente variabile** (mix con conc. diverse, work variabile): campo = fattore diluizione ÷N → calcolo: `V_prelievo = V_finale / N`
- Le due modalità possono coesistere nella stessa work

---

## 2. Schema Calibrazione — specifiche complete

### Struttura UI
Pannello a tutto schermo aperto dal drawer del metodo. Non un drawer laterale — serve spazio orizzontale.

**Colonne (da sinistra a destra):**

| Colonna | Contenuto |
|---|---|
| Analiti | Lista composti associati al metodo |
| CRM disponibili | Mix CRM (azzurro) + Singoli (verde) — allineati agli analiti |
| Singoli CRM | Blocchi singoli selezionabili |
| Work | Colonna Work create (livello 0) |
| Intermedia 1…N | Colonne Work intermedie dinamiche |

### Ordine righe nella griglia analiti/CRM
1. **Singoli puri** — solo nella colonna Singoli (verde)
2. **Entrambi** — presenti sia nella mix che come singoli → blocco coral con × per rimuovere il singolo
3. **Solo mix** — solo nel blocco Mix (azzurro, indivisibile)

Separatori visivi tra i tre gruppi.

### Codifica colori
- **Azzurro** — Mix CRM (indivisibile)
- **Verde** — Singoli CRM (solution/neat/IS)
- **Coral** — Duplicato (presente in entrambi) → da risolvere prima di procedere
- **IS tratteggiato** — Standard interni (bordo dashed)
- **Giallo/ambra** — Work tracciata (con validità in mesi)
- **Viola** — Work intermedia

### Step bar (4 step)
1. **Lettura CRM** — automatico: legge composti del metodo + CRM disponibili + classifica
2. **Risolvi duplicati** — obbligatorio: clicca × sui singoli duplicati; finché esistono → selezione e "Crea Work" bloccati
3. **Seleziona sorgenti** — click su mix, singoli, card Work
4. **Crea Work** — form di creazione con calcoli

### Selezione sorgenti
- Click singolo su Mix CRM → seleziona/deseleziona tutta la mix
- Click singolo su Singolo CRM → seleziona/deseleziona
- Click singolo su card Work → seleziona/deseleziona come sorgente per la colonna successiva
- Icona ⊙ su card Work → apre drawer dettaglio (non interferisce con la selezione)
- Icona × su card Work → elimina la work dalla colonna

### Colonne Work dinamiche
- Colonna **Work** (lv0): sempre presente
- Pulsante **+** laterale: aggiunge una colonna Intermedia vuota
- La colonna target si determina automaticamente: se la selezione include una Work di colonna N → la nuova Work va in colonna N+1

### Form "Crea Work"
Campi:
- Nome (obbligatorio)
- Volume finale (mL)
- Solvente
- **Validità (mesi)** — opzionale; se valorizzato la Work è tracciata; se vuoto è "al momento"
  - Visualizzata nella card come es. `valida 6 mesi` oppure `al momento`
- Operatore

Sezione sorgenti selezionate:
- Per ogni sorgente: nome, concentrazione (`X mg/L` se omogenea, `variabile` se conc. diverse)
- Toggle **"Valori per sorgente"**: se OFF → un campo unico per tutte; se ON → campo individuale per sorgente
- Label e tipo del campo si adattano:
  - Sorgenti tutte omogenee → "Conc. target uguale per tutte (mg/L)"
  - Almeno una variabile → "Fattore diluizione uguale per tutte (÷N)"
  - Toggle ON → campo unico disabilitato, campi individuali abilitati

Preview calcoli in tempo reale:
- Ogni sorgente con volume di prelievo e valore usato
- Riga solvente di completamento
- Warning in rosso se i prelievi superano il volume finale

### Drawer dettaglio Work (icona ⊙)
- **Header**: nome, badge tipo (Work/Intermedia), badge `valida N mesi` o `al momento`, conc. nominale o "variabile", volume, solvente, operatore
- **Azioni**: Elimina
- **Volumi di prelievo**: tabella sorgente / diluizione / mL / solvente completamento / totale / volume finale
- **Catena di tracciabilità**: albero ricorsivo dai CRM originali
- **Lista composti**: con concentrazione calcolata lungo la catena; campo filtro

---

## 3. Pagina Work (sidebar)

### Lista
Mostra **solo Work con validità definita** (tracciate). Colonne:
- Nome
- Conc. nominale + unità (o "variabile")
- Volume (mL)
- Validità: `N mesi`
- N° CRM sorgente
- N° metodi che la usano

> La data di scadenza reale non esiste qui — verrà calcolata nel modulo Tracciabilità al momento della preparazione fisica.

### Drawer Work (da lista)
- Dettagli completi
- Lista CRM collegati
- Lista metodi
- Pulsanti Modifica / Elimina

---

## 4. Schema DB — tabelle nuove

```sql
-- Migration 012

CREATE TABLE IF NOT EXISTS work (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  concentrazione  REAL,
  conc_variabile  INTEGER DEFAULT 0,
  unita_conc      TEXT DEFAULT 'mg/L',
  volume_ml       REAL,
  solvente        TEXT,
  validita_mesi   INTEGER,        -- NULL = "al momento" (non tracciata)
  operatore       TEXT,
  note            TEXT,
  livello         INTEGER DEFAULT 0,   -- 0=Work, 1+=Intermedia
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_ingredienti (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id             INTEGER REFERENCES work(id) ON DELETE CASCADE,
  source_type         TEXT NOT NULL CHECK (source_type IN ('crm', 'work')),
  source_id           INTEGER NOT NULL,
  volume_prelievo_ml  REAL,
  fattore_diluizione  REAL,
  conc_target_mgL     REAL,
  modo_calcolo        TEXT CHECK (modo_calcolo IN ('conc', 'dil'))
);

CREATE TABLE IF NOT EXISTS work_metodi (
  work_id   INTEGER REFERENCES work(id) ON DELETE CASCADE,
  metodo_id TEXT    REFERENCES metodi(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, metodo_id)
);

CREATE INDEX IF NOT EXISTS idx_work_ingredienti_work   ON work_ingredienti(work_id);
CREATE INDEX IF NOT EXISTS idx_work_ingredienti_source ON work_ingredienti(source_id, source_type);
```

---

## 5. Ordine di costruzione e task

### Fase 1 — DB e Backend
| Task | File | Azione |
|---|---|---|
| 1.1 | `src/main/migrations/012-work.sql` | Nuovo |
| 1.2 | `src/main/ipc/work.ipc.ts` | Nuovo |
| 1.3 | `src/main/index.ts` | Modifica — registra work IPC |
| 1.3 | `src/shared/types.ts` | Modifica — aggiunge tipi Work |
| 1.3 | `src/renderer/lib/api.ts` | Modifica — aggiunge workApi |

**🧪 TEST 1** — App si avvia, DB migra senza errori

**GIT** `git commit -m "feat: Fase 1 - DB e backend Work"`

---

### Fase 2 — Pagina Work
| Task | File | Azione |
|---|---|---|
| 2.1 | `src/renderer/pages/work/WorkPage.tsx` | Nuovo |
| 2.1 | `src/renderer/pages/work/WorkDrawer.tsx` | Nuovo |
| 2.1 | `src/renderer/pages/work/WorkForm.tsx` | Nuovo |
| 2.2 | `src/renderer/App.tsx` | Modifica — route `/work` |
| 2.2 | `src/renderer/components/layout/Sidebar.tsx` | Modifica — voce "Work" |

**🧪 TEST 2** — Pagina Work navigabile; crea/modifica/elimina Work con validità in mesi

**GIT** `git commit -m "feat: Fase 2 - Pagina Work"`

---

### Fase 3 — Schema Calibrazione
| Task | File | Azione |
|---|---|---|
| 3.1 | `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Nuovo — componente completo |
| 3.2 | `src/renderer/pages/metodi/MetodoDrawer.tsx` | Modifica — pulsante "Schema calibrazione" |

**🧪 TEST 3** — Apri metodo con composti, avvia schema, testa griglia + duplicati + selezione + form Work con calcoli

**GIT** `git commit -m "feat: Fase 3 - Schema Calibrazione"`

---

### Fase 4 — Tracciabilità *(da pianificare in sessione separata)*
Il modulo Tracciabilità registra le preparazioni fisiche delle Work tracciate e calcola la data di scadenza reale come `data_prep + validita_mesi`. Da affrontare separatamente.

---

## 6. Note implementative chiave

**Sorgente omogenea vs variabile**: calcolata lato frontend leggendo i componenti della mix dal DB — non serve flag per i CRM; per le Work il flag `conc_variabile` è in tabella.

**Mix indivisibile**: mai selezionare singoli componenti di una Mix o Work — sempre tutta la sorgente.

**Catena tracciabilità**: funzione ricorsiva che parte dagli `work_ingredienti` e risale ai CRM foglia, moltiplicando i fattori di diluizione.

**Schema calibrazione — dati reali**: lo schema legge dal DB i CRM del metodo corrente via IPC `composti:list` filtrata per `metodo_id`, escludendo i dismessi.

**Git**: commit dopo ogni fase completata prima di passare alla successiva.