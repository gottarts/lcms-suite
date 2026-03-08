# Piano di Sviluppo — Modulo Composti
**Data:** 2026-03-08  
**Modulo:** `composti` — Standard DB  
**Stato DB user_version:** 5  

---

## Contesto

Questo piano raccoglie le feature e i refactor richiesti per il modulo Composti (`/composti`) dell'applicazione LCMS Suite (Electron + React + SQLite). Le modifiche riguardano la tabella principale, il pannello laterale, la gestione multi-fiala, la pulizia del data model, i filtri e le statistiche.

Ogni feature è descritta come un blocco autonomo con: obiettivo, file coinvolti, comportamento atteso e note di implementazione per l'agente Copilot in VSC. Le task sono ordinate per priorità e dipendenze.

---

## Panoramica Feature

| ID | Feature | Priorità | Dipendenze |
|----|---------|----------|------------|
| FEAT-A | Rimozione campo `matrice` ovunque | Alta | nessuna |
| FEAT-B | Unità di misura flessibili per concentrazione (Opzione 2) | Alta | nessuna |
| FEAT-C | Sezione Preparazioni nella sidebar solo per Neat | Alta | nessuna |
| FEAT-D | Filtri avanzati e ricerca estesa nella tabella | Media | nessuna |
| FEAT-E | Selettore multi-fiala con storico aperture | Media | FEAT-A completata |
| FEAT-F | Statistiche riepilogative sopra la tabella | Bassa | FEAT-D consigliata |

---

## FEAT-A — Rimozione campo `matrice` dalla tabella e dal pannello laterale

### Obiettivo
Il campo `matrice` non fornisce informazioni utili nel contesto del modulo Composti (è rilevante solo a livello di Metodo). Va eliminato da tutti i punti dove appare nell'interfaccia. **Non si tocca il DB** — il campo rimane nella tabella SQLite per retrocompatibilità, ma non viene più visualizzato né modificabile dall'utente.

### File coinvolti
- `src/renderer/pages/composti/CompostiTable.tsx` — rimuovere la colonna "Matrice" dalla definizione `columns`
- `src/renderer/pages/composti/CompostoPanel.tsx` — rimuovere il campo `matrice` dal tab *Dettaglio*
- `src/renderer/pages/composti/CompostoForm.tsx` — rimuovere il campo `matrice` dal form di creazione/modifica
- `src/shared/types.ts` — il campo può restare nel tipo `Composto` (non rompere il typing), ma segnare come `@deprecated` in commento

### Comportamento atteso
- La colonna "Matrice" non appare nella tabella principale (nemmeno nel selettore colonne visibili)
- Nel pannello laterale tab *Dettaglio* non compare alcun riferimento a `matrice`
- Nel form di creazione/modifica non esiste il campo `matrice`
- Nessun dato viene cancellato dal DB


### Note per l'agente
Fare una ricerca globale con `grep -r "matrice" src/renderer` per trovare tutte le occorrenze prima di procedere. Prestare attenzione a non rimuovere accidentalmente `matrice` dai tipi TypeScript condivisi con il main process (IPC), che potrebbe causare errori di tipo. Rimuovere solo le occorrenze UI (JSX, colonne, form fields).

---

## FEAT-B — Unità di misura flessibili per concentrazione (Opzione 2)

### Obiettivo
Attualmente le unità di misura compaiono in modo inconsistente: a volte hardcodate nel JSX come suffisso, a volte già incluse nel dato salvato nel DB (es. `"1000.0 mg/L"`), causando duplicati tipo `"1000.0 mg/L mg/L"`.

La soluzione adottata è **Opzione 2**: aggiungere un campo `unita_conc` nel DB per ogni composto e per ogni preparazione, con una lista fissa di unità comuni selezionabili da menu a tendina, precompilata su `mg/L`. Il display usa sempre `{valore} {unita_conc}` — niente hardcoded nel JSX. Questa scelta è orientata anche al futuro modulo Protocolli nei Metodi, dove i calcoli dovranno conoscere l'unità del composto per fare conversioni corrette.

### Lista unità (costante nel codice)
Da definire in un nuovo file `src/renderer/lib/unita.ts`:
```ts
export const UNITA_CONCENTRAZIONE = [
  'mg/L',
  'µg/L',
  'ng/L',
  'ng/mL',
  'pg/mL',
  'ppm',
  'ppb',
  'ppt',
  '%',
] as const

export const UNITA_DEFAULT = 'mg/L'
```

### Migration DB
```sql
-- migration 006
ALTER TABLE composti ADD COLUMN unita_conc TEXT NOT NULL DEFAULT 'mg/L';
ALTER TABLE preparazioni ADD COLUMN unita_conc TEXT NOT NULL DEFAULT 'mg/L';
```

> ℹ️ La migration aggiunge `unita_conc` anche a `preparazioni` per coerenza strutturale, ma il valore viene sempre ereditato dal composto padre — le preparazioni esistono solo per i composti `Neat` (vedi FEAT-C), quindi l'unità è sempre quella del composto. Il campo non viene esposto come Select nel form preparazione.

### File coinvolti
- `src/main/migrations/006-unita-conc.sql` — nuova migration
- `src/main/db.ts` — bump `PRAGMA user_version` a 6
- `src/shared/types.ts` — aggiungere `unita_conc: string` a `Composto` e `Preparazione`
- `src/renderer/lib/unita.ts` — nuovo file con la costante `UNITA_CONCENTRAZIONE` e `UNITA_DEFAULT`
- `src/renderer/pages/composti/CompostoForm.tsx` — aggiungere Select `unita_conc` accanto al campo concentrazione, default `mg/L`
- `src/renderer/pages/composti/PreparazioniTab.tsx` — rimuovere eventuale suffisso hardcoded; mostrare `{conc} {unita_conc}`
- `src/renderer/components/PrepCalcTool.tsx` — salvare `concentrazione` come numero puro; aggiungere Select `unita_conc`, default `mg/L`
- `src/renderer/pages/composti/CompostoPanel.tsx` — nel tab Dettaglio mostrare `{concentrazione} {unita_conc}`
- `src/main/ipc/composti.ipc.ts` — includere `unita_conc` nelle query `SELECT`, `INSERT`, `UPDATE`
- `src/main/ipc/preparazioni.ipc.ts` — includere `unita_conc` nelle query

### Comportamento atteso
- Ogni composto e ogni preparazione hanno un campo `unita_conc` nel DB (default `mg/L`)
- Nel form composto, accanto al campo "Concentrazione" appare una Select con le unità disponibili, preselezionata su `mg/L`
- Nel display (tabella, pannello, preparazioni) il valore è sempre `{numero} {unita_conc}` — mai hardcoded
- Il calcolatore `PrepCalcTool` salva `concentrazione` come numero puro e `unita_conc` come campo separato
- I dati esistenti nel DB con unità già incluse nel valore stringa (es. `"1000.0 mg/L"`) vengono gestiti con una funzione di parsing al momento del display


### Note per l'agente
**Passo 1 — Migration:** creare `006-unita-conc.sql` e verificare che il DB si aggiorni prima di toccare il renderer.

**Passo 2 — Audit occorrenze hardcoded:**
```bash
grep -rn "mg/L\|µg/L\|ng/mL\|ppm\|ppb" src/renderer --include="*.tsx" --include="*.ts"
```
Ogni occorrenza hardcodata nel JSX va sostituita con il valore dal dato. Le occorrenze nei label (es. `"Concentrazione (mg/L)"`) vanno rimosse — l'unità sarà visibile solo a fianco del valore dinamico.

**Passo 3 — Parsing dati storici:** aggiungere una funzione di sanitizzazione nel nuovo file `unita.ts`:
```ts
export function parseConcentrazione(raw: string | number): number {
  if (typeof raw === 'number') return raw
  return parseFloat(raw.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
}
```
Usarla ovunque si legge `concentrazione` dal DB per gestire i valori storici con unità già nella stringa.

> ⚠️ **Nota:** il fix `mg/L mg/L` (TASK 1 sessione 07-03) è già stato applicato in `PreparazioniTab.tsx`. Verificare il codice attuale prima di modificare quello stesso file per non sovrascrivere il fix esistente.

---

## FEAT-C — Sezione Preparazioni nel pannello laterale solo per composti Neat

### Obiettivo
Il tab *Preparazioni* nella sidebar (`CompostoPanel`) ha senso solo per i composti `Neat` (polveri solide da pesare e sciogliere). Per i composti già in forma `Solution` non ha senso preparare una stock solution — il composto è già pronto all'uso. Il tab va nascosto condizionalmente in base al campo `forma` del composto selezionato.

### File coinvolti
- `src/renderer/pages/composti/CompostoPanel.tsx` — logica condizionale sui tab
- `src/renderer/pages/composti/PreparazioniTab.tsx` — nessuna modifica necessaria

### Comportamento atteso
- Se `composto.forma === 'Neat'` → il tab *Preparazioni* è visibile e funzionante come ora
- Se `composto.forma === 'Solution'` o `composto.forma === 'mix'` → il tab *Preparazioni* non appare nella tab strip
- Se il tab è nascosto, il tab attivo di default diventa *Dettaglio*
- Non viene modificata nessuna logica di salvataggio; le preparazioni già esistenti per composti Solution restano nel DB ma non vengono più mostrate


### Note per l'agente
Trovare nel JSX di `CompostoPanel.tsx` il componente `Tabs` (o equivalente shadcn) che definisce i tab. Aggiungere una condizione `{composto.forma === 'Neat' && <TabsTrigger value="preparazioni">...</TabsTrigger>}` e analoga per il `TabsContent`. Verificare che il `defaultValue` del componente `Tabs` sia robusto: se il tab default è `"preparazioni"` ma questo è nascosto, la UI mostra un tab vuoto — impostare il default a `"dettaglio"` in modo incondizionato o calcolarlo dinamicamente.

---

## FEAT-D — Filtri avanzati e ricerca estesa nella tabella principale

### Obiettivo
Attualmente la ricerca è limitata a nome e codice interno. I filtri sono parziali (classe, forma, metodo). Questa feature espande entrambe le funzionalità in modo organico.

#### D1 — Ricerca estesa su tutti i parametri
La ricerca testuale deve coprire tutti i campi stringa del composto: `nome`, `codice_interno`, `classe`, `produttore`, `lotto`, `ubicazione`, `solvente`, `forma_commerciale`, `destinazione_uso`.

#### D2 — Nuovi filtri rapidi nella toolbar
Aggiungere i seguenti filtri nella toolbar sopra la tabella (accanto ai filtri esistenti):
- **Filtro Stato** — select: `Tutti | Attivo | In scadenza | Scaduto | Dismesso`
- **Filtro Work Solution** — select: `Tutti | Sì | No` (basato sul campo `work_standard`)
- **Filtro Metodo** — già presente, verificare funzionamento corretto

#### D3 — Ordinamento colonne
Verificare che l'ordinamento per click su header sia funzionante su tutte le colonne visibili, incluse le colonne custom. Se mancante, implementare con stato `sortColumn` / `sortDirection`.

### File coinvolti
- `src/renderer/pages/composti/CompostiPage.tsx` — stato filtri, passaggio props
- `src/renderer/pages/composti/CompostiTable.tsx` — ricerca client-side, ordinamento
- `src/main/ipc/composti.ipc.ts` — estendere il LIKE SQL oppure spostare tutto client-side (valutare)
- `src/renderer/pages/composti/CompostiToolbar.tsx` (o equivalente) — UI filtri

### Comportamento atteso
- La searchbar filtra su tutti i campi testuali elencati sopra
- I tre nuovi filtri (Stato, Work Solution, Metodo) sono select dropdown nella toolbar
- I filtri sono combinabili tra loro e con la ricerca testuale
- Il contatore nell'header mostra `"Visualizzati: X / Totali: Y"` aggiornato in tempo reale
- L'ordinamento per colonna funziona su tutte le colonne (asc/desc toggle con icona freccia)
- I filtri attivi sono visibili (es. badge "Stato: Attivo ×" rimovibile)


### Note per l'agente
Valutare se fare il filtraggio lato SQL (IPC) o lato client. Con dataset ~200 composti, il filtraggio client-side è preferibile per reattività immediata. Tutta la lista dei composti viene caricata una volta, poi i filtri operano sul dataset in memoria. Aggiornare l'handler IPC `composti:list` solo se necessario per la compatibilità. Per il filtro Stato, usare la funzione `computeStato()` già esistente — non aggiungere una colonna DB. Per Work Solution, il campo DB si chiama `work_standard` — verificare i valori possibili (es. `"Sì"/"No"`, `1/0`, `true/false`) prima di costruire il filtro.

---

## FEAT-E — Selettore multi-fiala con registrazione aperture e storico

### Obiettivo
Alcuni composti hanno più fiale dello stesso lotto (es. 4 fiale identiche). Attualmente non c'è modo di sapere quante fiale ci sono, quante sono state aperte e quando. Questa feature aggiunge:

1. Un campo `numero_fiale` (intero) nel DB per indicare quante fiale totali esistono per un composto
2. Un indicatore visivo nella tabella principale — N pallini colorati cliccabili (●●●○ = 3 aperte su 4)
3. Un'azione "Apri fiala" che registra la data di apertura nello storico e aggiorna il contatore
4. La visualizzazione delle aperture nel tab *Storico* del pannello laterale

### Sotto-task

#### E1 — Migrazione DB: aggiungere colonna `numero_fiale`
```sql
-- migration 006
ALTER TABLE composti ADD COLUMN numero_fiale INTEGER DEFAULT 1;
```
Il campo `fiale_aperte` (contatore) viene derivato contando gli eventi nel `composti_storia` di tipo `'apertura_fiala'`.

#### E2 — Aggiornare il form Composto
Nel `CompostoForm.tsx` rinominare il campo esistente `fiala` in `n° fiale` (label visibile all'utente) e aggiungere il campo `numero_fiale` (input numerico, minimo 1, default 1). Mostrare il campo solo se `forma === 'Neat'` (per i Solution non ha senso).

#### E3 — Indicatore visivo nella tabella
Nella `CompostiTable.tsx`, aggiungere una colonna `"Fiale"` che mostra gli N pallini. La colonna è visibile solo se il composto ha `numero_fiale > 1` (o mostrarla sempre con 1 pallino per i Neat, nasconderla per i Solution).

Mockup visivo:
```
●●●○  ← 3 aperte (nero pieno), 1 chiusa (cerchio vuoto)
```
- Pallino pieno (●) = fiala aperta
- Pallino vuoto (○) = fiala non ancora aperta
- Click su pallino vuoto → apre dialog "Registra apertura fiala N"

#### E4 — Dialog apertura fiala
Al click su un pallino vuoto:
- Dialog modale con: data apertura (default oggi), operatore, note
- Salva un record in `composti_storia` con `tipo: 'apertura_fiala'`, `fiala_numero: N`, data e note
- Aggiorna il contatore visualizzato senza ricaricare tutto

#### E5 — Storico aperture nel pannello
Nel tab *Storico* di `CompostoPanel.tsx`, i record di tipo `apertura_fiala` vengono mostrati con:
- Etichetta: `"Fiala N aperta"`
- Data, operatore, note

### File coinvolti
- `src/main/migrations/006-numero-fiale.sql` — nuova migration
- `src/main/db.ts` — bump `PRAGMA user_version` a 6
- `src/shared/types.ts` — aggiungere `numero_fiale` al tipo `Composto`
- `src/main/ipc/composti.ipc.ts` — aggiornare `composti:list`, `composti:get`, `composti:update`; aggiungere handler `composti:apri-fiala`
- `src/renderer/pages/composti/CompostiTable.tsx` — colonna fiale con pallini
- `src/renderer/pages/composti/CompostoForm.tsx` — campo `numero_fiale`
- `src/renderer/pages/composti/CompostoPanel.tsx` — storico con eventi apertura
- `src/renderer/pages/composti/FialeSelector.tsx` — nuovo componente (pallini cliccabili)
- `src/renderer/pages/composti/ApriAperturaDialog.tsx` — nuovo dialog

### Comportamento atteso
- Composto con 4 fiale e 2 aperte → mostra `●●○○`
- Click sul terzo pallino (○) → dialog → conferma → pallino diventa ● → record in storico
- Pallini già pieni (●) non sono cliccabili (o mostrano tooltip con data apertura)
- Il campo esistente `fiala` (identificativo testuale della fiala) resta invariato — `numero_fiale` è un campo aggiuntivo distinto, con label `"N° fiale"` nel form
- Se `numero_fiale === 1` (default), non mostrare i pallini (o mostrare un singolo pallino senza interazione)


### Note per l'agente
Questa è la feature più complessa del piano. Procedere nell'ordine E1→E2→E3→E4→E5. Creare prima la migration e verificare che il DB si aggiorni correttamente prima di toccare il renderer. Il conteggio `fiale_aperte` va fatto con una query che conta i record `composti_storia` di tipo `apertura_fiala` per quel composto — evitare di aggiungere un secondo campo numerico nel DB per non avere desync. Passare al componente `FialeSelector` sia `numero_fiale` (totale) che `fiale_aperte` (calcolato).

---

## FEAT-F — Statistiche riepilogative sopra la tabella

### Obiettivo
Aggiungere una barra di statistiche compatta sopra la tabella (o nel header della pagina) con i contatori più utili per il laboratorio, aggiornati in tempo reale in base ai filtri attivi.

### Stat card da mostrare

| Statistica | Descrizione |
|------------|-------------|
| **Totali** | Numero di composti nel DB (indipendente dai filtri) |
| **Visualizzati** | Numero di composti dopo i filtri attivi |
| **Attivi** | Composti con stato `attivo` (calcolato) |
| **In scadenza** | Composti con scadenza entro 30 giorni |
| **Attenzione** | Composti con preparazioni scadute (stato prep calcolato) |

### Layout suggerito
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│  Totali     │ Visualizzati│   Attivi    │ In scadenza │  Attenzione │
│    50       │    38       │    42       │      3      │      2      │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

Le card "In scadenza" e "Attenzione" hanno sfondo/testo ambra o rosso se > 0.

### File coinvolti
- `src/renderer/pages/composti/CompostiPage.tsx` — calcolo statistiche dal dataset filtrato
- `src/renderer/pages/composti/CompostiStats.tsx` — nuovo componente stat card
- `src/main/ipc/composti.ipc.ts` — eventuale aggiunta di una query aggregata per "preparazioni scadute" (se non già disponibile lato client)

### Comportamento atteso
- Le stat card sono sempre visibili sopra la tabella
- "Totali" non cambia con i filtri; "Visualizzati" sì
- "Attenzione" conta i composti che hanno almeno una preparazione con stato calcolato `scaduta`
- Click su "In scadenza" → applica automaticamente il filtro Stato = "In scadenza"
- Click su "Attenzione" → applica automaticamente un filtro che mostra solo i composti con preparazioni scadute


### Note per l'agente
Per il contatore "Attenzione" (preparazioni scadute) è necessario avere a disposizione le preparazioni di tutti i composti visibili. Valutare se caricare le preparazioni in bulk con `preparazioni:list-all` (da aggiungere all'IPC se non esiste) oppure derivarlo dai dati già in memoria. Usare `computeStatoPrep()` (già implementata nella sessione precedente) per il calcolo. I click sulle stat card che applicano filtri devono andare in sync con lo stato filtri di `CompostiPage` — passare un callback `onFilterChange` al componente.

---

## Ordine di implementazione consigliato

Le feature sono indipendenti tra loro (salvo FEAT-E che richiede DB migration). L'ordine suggerito per minimizzare il rischio di conflitti:

```
1. FEAT-A  (rimozione matrice)           — refactor pulito, zero rischi
2. FEAT-B  (unità flessibili)            — richiede migration 006, alta priorità
3. FEAT-C  (prep solo Neat)              — 1 file, cambio condizionale
4. FEAT-D  (filtri e ricerca)            — feature autonoma, no DB
5. FEAT-F  (statistiche)                 — dipende da FEAT-D per filtri click
6. FEAT-E  (multi-fiala)                 — più complessa, richiede migration 007
```

---

## Checklist pre-implementazione (per ogni task)

Prima di dare il task all'agente VSC, verificare sempre:

- [ ] Il task descrive esattamente i file da toccare
- [ ] Il comportamento atteso è testabile manualmente
- [ ] Non ci sono task pendenti della sessione precedente sugli stessi file

---

## Task dalla sessione 2026-03-07 — tutti completati ✅

Tutti i task pianificati nella sessione pomeriggio del 07-03-2026 sono stati implementati e verificati su GitHub (`master`).

| Task | Descrizione | Stato |
|------|-------------|-------|
| TASK 1 | Fix doppia unità `mg/L mg/L` in `PreparazioniTab.tsx` | ✅ completato |
| TASK 2 | Modalità pesata: mostra volume derivato in mL (`PrepCalcTool`) | ✅ completato |
| TASK 3 | Fix form Mix (Forma, Codice Interno, Miscela in tabella) + rimuovi Stock da `CompostoForm` | ✅ completato |
| TASK 4 | Rimuovi titolo non informativo dalla card preparazione | ✅ completato |
| TASK 5 | Stato preparazione calcolato automaticamente alla scadenza | ✅ completato |
| TASK 6 | Badge contatore prep + alert scadute nella tabella principale (`prep_attive_count`, `prep_scadute_count`) | ✅ completato |

> ℹ️ **Nota FEAT-B:** il fix doppia unità (TASK 1) è già in produzione. L'implementazione di FEAT-B deve evitare di riapplicare modifiche già presenti in `PreparazioniTab.tsx` — verificare il codice attuale prima di procedere.

> ℹ️ **Nota DB:** `user_version = 5`, nessuna migration aggiunta nella sessione 07-03. Le FEAT-A/C/D/F non richiedono migration. FEAT-B richiede migration 006, FEAT-E richiede migration 007.

---

*Piano generato il 2026-03-08 — da allegare a `docs/plans/active/`*