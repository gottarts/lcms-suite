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
## FEAT-E — Multi-fiala: piano aggiornato
**Data:** 2026-03-08  
**Stato:** pronto per implementazione  

---

### Stato di partenza

- DB: colonne `numero_fiale` e `fiala_numero` rimosse — vanno aggiunte dalla migration
- Codice: tutto ripristinato alla versione pre-tentativo fallito
- Migration disponibile successiva: **007**  
  (la 006 è già occupata da FEAT-B `unita_conc`)

---

### Correzioni rispetto al piano originale

| Voce | Piano originale | Piano corretto |
|------|----------------|----------------|
| Migration | 006 | 007 |
| Campo `fiala` | "rinominare in N° fiale" | **lasciare invariato** — è un identificativo testuale della fiala |
| Campo `numero_fiale` | solo se `forma === Neat'` | **sempre visibile** nel form, dopo `fiala`, default 1 |

---

### Blocco 1 — DB e Backend

#### 1A — Migration `007-numero-fiale.sql`

Creare il file `src/main/migrations/007-numero-fiale.sql`:

```sql
ALTER TABLE composti ADD COLUMN numero_fiale INTEGER NOT NULL DEFAULT 1;
ALTER TABLE composti_storia ADD COLUMN fiala_numero INTEGER DEFAULT NULL;
```

Il meccanismo di migrazione in `db.ts` legge il prefisso numerico del filename (`007`) e lo confronta con `user_version` — nessuna modifica a `db.ts` necessaria, la migration parte automaticamente al prossimo avvio.

---

#### 1B — `src/shared/types.ts`

**Modifica 1** — aggiungere `numero_fiale` all'interfaccia `Composto`, dopo `fiala`:

```ts
fiala: string | null
numero_fiale: number   // ← aggiungere qui
```

**Modifica 2** — estendere `CompostoStoria`:

```ts
export interface CompostoStoria {
  id: number
  composto_id: number
  tipo: 'Rivalidazione' | 'Dismissione' | 'apertura_fiala'  // ← aggiungere 'apertura_fiala'
  data: string
  note: string | null
  n_registro_qc: string | null
  batch_analitico: string | null
  lotto_crm_valido: string | null
  fiala_numero: number | null   // ← aggiungere
  created_at: string
}
```

---

#### 1C — `src/main/ipc/composti.ipc.ts`

**Modifica 1** — oggetto `row` in `composti:create`, dopo `fiala`:

```ts
fiala: data.fiala ?? null,
numero_fiale: (data.numero_fiale as number) ?? 1,
```

**Modifica 2** — array `cols` in `composti:create`, aggiungere `'numero_fiale'` dopo `'fiala'`:

```ts
'purezza', 'concentrazione', 'unita_conc', 'solvente', 'fiala', 'numero_fiale', 'produttore', 'lotto',
```

**Modifica 3** — oggetto `row` in `composti:update`, dopo `fiala`:

```ts
fiala: data.fiala ?? null,
numero_fiale: (data.numero_fiale as number) ?? 1,
```

**Modifica 4** — stringa SQL UPDATE in `composti:update`, aggiungere dopo `fiala=@fiala`:

```ts
fiala=@fiala, numero_fiale=@numero_fiale, produttore=@produttore,
```

**Modifica 5** — array `cols` in `composti:create-mix`, aggiungere `'numero_fiale'` dopo `'fiala'`:

```ts
'purezza', 'concentrazione', 'unita_conc', 'solvente', 'fiala', 'numero_fiale', 'produttore', 'lotto',
```

**Modifica 6** — oggetto `common` in `composti:create-mix`, dopo `fiala: null`:

```ts
fiala: null,
numero_fiale: 1,
```

**Modifica 7** — aggiungere nuovo handler `composti:apri-fiala` in fondo, prima della chiusura di `registerCompostiIpc()`:

```ts
ipcMain.handle('composti:apri-fiala', (_, compostoId: number, data: {
  fiala_numero: number
  data_apertura: string
  operatore?: string
  note?: string
}) => {
  const result = getDb().prepare(
    `INSERT INTO composti_storia (composto_id, tipo, data, fiala_numero, note)
     VALUES (?, 'apertura_fiala', ?, ?, ?)`
  ).run(
    compostoId,
    data.data_apertura,
    data.fiala_numero,
    data.note || null
  )
  return { id: result.lastInsertRowid }
})
```

> ℹ️ `composti:get` usa `SELECT *` — restituirà automaticamente `fiala_numero` senza modifiche.

---

### Blocco 2 — Form

#### 2A — `src/renderer/pages/composti/CompostoForm.tsx`

**Modifica 1** — aggiungere `numero_fiale: 1` nello stato iniziale (blocco `else` dell'`useEffect`), dopo `fiala: ''`:

```ts
fiala: '',
numero_fiale: 1,
```

**Modifica 2** — aggiungere `parseInt` in `handleSave` per convertire il valore:

```ts
if (data.numero_fiale) data.numero_fiale = parseInt(data.numero_fiale) || 1
```

**Modifica 3** — aggiungere il campo nel JSX, dopo il `<div>` del campo `Fiala`:

```tsx
<div>
  <Label className="text-xs">N° Fiale</Label>
  <Input
    type="number"
    min={1}
    step={1}
    value={form.numero_fiale ?? 1}
    onChange={e => set('numero_fiale', e.target.value)}
  />
</div>
```

---

### Blocco 3 — Tabella e componenti

#### 3A — Nuovo file `src/renderer/pages/composti/FialeSelector.tsx`

Componente che riceve:
- `numeroFiale: number` — totale fiale
- `fialeAperte: number` — fiale già aperte (conteggio eventi `apertura_fiala` dallo storico)
- `onApri: (fialaNumero: number) => void` — callback al click su pallino vuoto

Comportamento:
- Renderizza N pallini: `●` per le aperte, `○` per le chiuse
- Click su `○` → chiama `onApri(indice)`
- Click su `●` → nessuna azione (o tooltip con data apertura se disponibile)
- Se `numeroFiale === 1` → non renderizza nulla

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface FialeSelectorProps {
  numeroFiale: number
  fialeAperte: number
  onApri: (fialaNumero: number) => void
}

export function FialeSelector({ numeroFiale, fialeAperte, onApri }: FialeSelectorProps) {
  if (numeroFiale <= 1) return null

  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: numeroFiale }, (_, i) => {
        const aperta = i < fialeAperte
        return (
          <button
            key={i}
            onClick={() => !aperta && onApri(i + 1)}
            className={`text-base leading-none ${aperta ? 'cursor-default text-foreground' : 'cursor-pointer text-muted-foreground hover:text-foreground'}`}
            title={aperta ? `Fiala ${i + 1} aperta` : `Apri fiala ${i + 1}`}
          >
            {aperta ? '●' : '○'}
          </button>
        )
      })}
    </div>
  )
}
```

---

#### 3B — Nuovo file `src/renderer/pages/composti/ApriAperturaDialog.tsx`

Dialog modale che appare al click su un pallino vuoto.

Props:
- `open: boolean`
- `onOpenChange: (v: boolean) => void`
- `compostoId: number`
- `fialaNumero: number`
- `onSaved: () => void`

Campi:
- `data_apertura` — date input, default oggi
- `operatore` — text input, opzionale
- `note` — textarea, opzionale

Al salvataggio chiama `window.electronAPI.invoke('composti:apri-fiala', compostoId, { fiala_numero, data_apertura, operatore, note })`.

---

#### 3C — `src/renderer/pages/composti/CompostiTable.tsx`

- Aggiungere colonna `"Fiale"` alla definizione `columns`
- La colonna renderizza `<FialeSelector>` con `numeroFiale={row.numero_fiale}` e `fialeAperte` calcolato contando gli eventi `apertura_fiala` nello storico
- La colonna è visibile solo se `row.numero_fiale > 1`
- Al click su pallino vuoto, aprire `ApriAperturaDialog`

> ⚠️ Il conteggio `fialeAperte` richiede di avere lo storico disponibile nella tabella. Valutare se aggiungerlo alla query `composti:list` come campo aggregato (`fiale_aperte_count`) oppure caricarlo on-demand all'apertura del dialog. **Soluzione consigliata:** aggiungere alla query SQL di `composti:list` il conteggio:
> ```sql
> COUNT(CASE WHEN cs.tipo = 'apertura_fiala' THEN 1 END) AS fiale_aperte_count
> ```
> con LEFT JOIN su `composti_storia cs ON cs.composto_id = c.id`.

---

### Blocco 4 — Pannello storico

#### 4A — `src/renderer/pages/composti/CompostoPanel.tsx`

Nel tab *Storico*, i record di tipo `apertura_fiala` vanno mostrati con formato diverso dagli altri:

```tsx
{evento.tipo === 'apertura_fiala' ? (
  <div>
    <span className="font-medium">Fiala {evento.fiala_numero} aperta</span>
    <span className="text-muted-foreground text-xs ml-2">{evento.data}</span>
    {evento.note && <p className="text-xs mt-1">{evento.note}</p>}
  </div>
) : (
  // rendering esistente per Rivalidazione/Dismissione
)}
```

---

### Checklist implementazione

- [ ] Blocco 1: migration + types + IPC → avvia app e verifica 0 errori
- [ ] Blocco 2: form → testa creazione/modifica composto con N° Fiale
- [ ] Blocco 3: FialeSelector + Dialog + colonna tabella → testa apertura fiala
- [ ] Blocco 4: storico pannello → verifica che gli eventi compaiano

---

*Piano aggiornato il 2026-03-08 — da allegare a `docs/plans/active/`*

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