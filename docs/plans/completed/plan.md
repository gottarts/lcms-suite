# Piano — FEAT: TextImportDialog generico

**Data:** 2026-03-14
**Branch base:** `master`
**DB:** nessuna migration necessaria
**Primo utilizzo:** `MixPesticidiForm.tsx`

---

## Concetto

Un dialog riutilizzabile `TextImportDialog` che:
1. Carica un file Excel o CSV
2. Mostra l'anteprima del file come griglia (tutte le righe e colonne)
3. L'utente **clicca su una cella** per dire "da questa cella parte la tabella" — quella cella diventa la prima intestazione colonna
4. Mostra le colonne trovate e per ognuna una Select per agganciarla a un campo del form chiamante
5. Al click "Importa", restituisce al form chiamante un oggetto con i valori mappati
6. Nel form chiamante i campi compilati dall'import vengono **bloccati** (non editabili)

---

## Architettura

Il dialog è generico. Ogni form che lo usa gli passa:

- `fields` — lista dei campi disponibili per la mappatura (es. `[{ key: 'lotto', label: 'Lotto' }, { key: 'metodi_nomi', label: 'Metodi (sep. ;)' }, ...]`)
- `onImport(values)` — callback che riceve i valori importati come oggetto `{ chiave: valore }`

---

## File da creare / modificare

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/renderer/components/shared/TextImportDialog.tsx` | ✨ Nuovo | Il dialog generico |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | 🔧 Modificato | Aggiunge bottone + integra il dialog |

---

## TASK 1 — Creare `TextImportDialog.tsx`

### Branch
```bash
git checkout master
git pull
git checkout -b feat/text-import-dialog
```

### File da creare
`src/renderer/components/shared/TextImportDialog.tsx`

---

### Interfacce TypeScript

```tsx
export interface ImportField {
  key: string       // chiave del campo nel form, es. 'lotto'
  label: string     // etichetta visibile all'utente, es. 'Lotto'
  multi?: boolean   // true = valori separati da ; (es. metodi)
}

interface TextImportDialogProps {
  open: boolean
  onClose: () => void
  fields: ImportField[]
  onImport: (values: Record<string, string>) => void
}
```

---

### Stato interno del dialog

```tsx
type Step = 'upload' | 'preview' | 'mapping' | 'done'

const [step, setStep] = useState<Step>('upload')
const [rawRows, setRawRows] = useState<string[][]>([])       // tutte le righe del file
const [originCell, setOriginCell] = useState<{r: number, c: number} | null>(null)  // cella cliccata
const [headers, setHeaders] = useState<string[]>([])          // nomi colonne (dalla riga cliccata)
const [dataRows, setDataRows] = useState<string[][]>([])      // righe dati (dopo la riga intestazione)
const [mapping, setMapping] = useState<Record<string, string>>({})  // colonna → chiave campo
```

---

### Step 1 — Upload

Identico allo step upload di `ImportDialog.tsx` già esistente nel progetto. Usa la stessa libreria `xlsx` già installata.

Quando il file è caricato, popola `rawRows` con **tutte** le righe del foglio (gestisci la selezione foglio se ce ne sono più di uno, come già fa `ImportDialog`), poi passa allo step `preview`.

---

### Step 2 — Preview (selezione cella di origine)

Mostra una tabella HTML con tutte le righe e colonne di `rawRows`. Ogni cella è cliccabile.

**Visual:**
- La cella attualmente selezionata → sfondo blu/primario, testo bianco
- Le celle nella stessa riga della cella selezionata → sfondo primario più chiaro (queste diventeranno le intestazioni)
- Le righe sotto la riga selezionata → sfondo normale (questi sono i dati)
- Le righe sopra la riga selezionata → sfondo muted/grigio (ignorate)

**Interazione:**
- Click su una cella → `setOriginCell({ r: rowIndex, c: colIndex })`
- La riga `originCell.r` diventa le intestazioni, partendo dalla colonna `originCell.c`
- Le righe da `originCell.r + 1` in poi sono i dati

**Pulsante "Continua"** attivo solo se `originCell !== null`. Al click, costruisce `headers` e `dataRows`, poi passa allo step `mapping`.

```tsx
// Costruisce headers e dataRows dalla cella di origine
function applyOrigin(r: number, c: number) {
  const headerRow = rawRows[r]
  const hs = headerRow.slice(c).map(h => String(h ?? '').trim()).filter(h => h !== '')
  setHeaders(hs)
  setDataRows(
    rawRows.slice(r + 1)
      .filter(row => row.some(cell => cell !== '' && cell != null))
      .map(row => row.slice(c, c + hs.length).map(cell => String(cell ?? '').trim()))
  )
  setMapping({})  // reset mappatura ad ogni cambio origine
}
```

---

### Step 3 — Mappatura colonne

Per ogni colonna trovata (gli elementi di `headers`), mostra:
- Il nome della colonna (dal file)
- Una Select con le opzioni: `— Ignora —` + tutti i `fields` passati come prop

Esempio visivo per ogni riga della mappatura:

```
[COMPONENT]   →   [ Nomi composti (lista) ▼ ]
[LOT N.]      →   [ Lotto                  ▼ ]
[EXPIRY DATE] →   [ Data Scadenza          ▼ ]
[CAS NUMBER]  →   [ — Ignora —             ▼ ]
```

Mostra anche un'anteprima delle prime 3 righe di dati sotto la mappatura, con solo le colonne agganciate (non quelle ignorate).

**Pulsante "Importa"** — al click esegue `handleImport`:

```tsx
function handleImport() {
  const result: Record<string, string> = {}

  for (const [colName, fieldKey] of Object.entries(mapping)) {
    if (!fieldKey || fieldKey === '_skip') continue
    const colIdx = headers.indexOf(colName)
    if (colIdx === -1) continue

    const field = fields.find(f => f.key === fieldKey)

    if (field?.multi || fieldKey === 'nomi') {
      // Raccoglie TUTTI i valori non vuoti di questa colonna, uniti da ;
      const valori = dataRows
        .map(row => row[colIdx]?.trim())
        .filter(Boolean)
      result[fieldKey] = valori.join(';')
    } else {
      // Prende il valore dalla PRIMA riga dati non vuota
      const val = dataRows.find(row => row[colIdx]?.trim())?.[colIdx] ?? ''
      result[fieldKey] = val.trim()
    }
  }

  onImport(result)
  onClose()
}
```

> **Nota logica nomi:** il campo `nomi` in `MixPesticidiForm` è la lista dei composti nel mix. Se l'utente mappa una colonna su `nomi`, vengono raccolti tutti i valori di quella colonna (uno per riga) e passati come stringa separata da `;`. `MixPesticidiForm` farà poi lo split su `;` per ricostruire l'array interno `nomi`.

> **Nota campi singoli:** per campi come Lotto, Scadenza, Produttore — il valore è lo stesso per tutte le righe del mix, quindi si prende solo la prima riga dati non vuota.

---

## TASK 2 — Modificare `MixPesticidiForm.tsx`

### Stesso branch: `feat/text-import-dialog`

---

### Modifica A — Aggiungere lo stato per i campi bloccati

Nella sezione degli `useState`, aggiungere:

```tsx
const [importedFields, setImportedFields] = useState<Set<string>>(new Set())
```

Questo Set tiene traccia di quali chiavi sono state compilate dall'import e devono essere bloccate nell'interfaccia.

---

### Modifica B — Aggiungere lo stato per l'apertura del dialog

```tsx
const [importTextOpen, setImportTextOpen] = useState(false)
```

---

### Modifica C — Definire la lista `importFields`

Aggiungere questa costante subito prima del `return` del componente:

```tsx
const importFields: ImportField[] = [
  { key: 'nomi',              label: 'Nomi composti (lista)', multi: true },
  { key: 'forma_commerciale', label: 'Nome mix / Forma Commerciale' },
  { key: 'lotto',             label: 'Lotto' },
  { key: 'produttore',        label: 'Produttore' },
  { key: 'scadenza_prodotto', label: 'Data Scadenza' },
  { key: 'data_apertura',     label: 'Data Apertura' },
  { key: 'solvente',          label: 'Solvente' },
  { key: 'concentrazione',    label: 'Concentrazione' },
  { key: 'stoccaggio',        label: 'Stoccaggio' },
  { key: 'destinazione_uso',  label: 'Destinazione Uso' },
  { key: 'codice_interno',    label: 'Codice Interno' },
  { key: 'metodi_nomi',       label: 'Metodi (sep. ;)', multi: true },
]
```

---

### Modifica D — Aggiungere la callback `handleTextImport`

```tsx
function handleTextImport(values: Record<string, string>) {
  const locked = new Set<string>()

  // Campi semplici del form
  const formKeys = [
    'forma_commerciale', 'lotto', 'produttore', 'scadenza_prodotto',
    'data_apertura', 'solvente', 'concentrazione', 'stoccaggio',
    'destinazione_uso', 'codice_interno'
  ] as const

  for (const key of formKeys) {
    if (values[key] !== undefined && values[key] !== '') {
      set(key, values[key])
      locked.add(key)
    }
  }

  // Campo nomi: split su ; e pulizia
  if (values['nomi']) {
    const lista = values['nomi'].split(';').map(n => n.trim()).filter(Boolean)
    setNomi(lista)
    locked.add('nomi')
  }

  // Metodi: i nomi verranno risolti in IDs al salvataggio (logica già presente in handleSave)
  // Per ora si marca solo come locked — la gestione metodi_nomi al save è un TODO
  if (values['metodi_nomi']) {
    locked.add('metodi_nomi')
  }

  setImportedFields(locked)
}
```

---

### Modifica E — Aggiungere il bottone "Importa da file" nel JSX

Trovare il punto in cima al form (vicino alla sezione metodi o sopra "Metadati comuni") e aggiungere il bottone:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => setImportTextOpen(true)}
>
  <Upload className="h-4 w-4 mr-1" /> Importa da file
</Button>
```

> ℹ️ `Upload` è già importato in `MixPesticidiForm.tsx` — nessuna importazione aggiuntiva necessaria.

---

### Modifica F — Bloccare i campi importati nel JSX

Per ogni campo Input o Select che può essere agganciato dall'import, aggiungere `disabled` condizionale. Esempi:

```tsx
{/* Lotto */}
<Input
  value={form.lotto}
  onChange={e => set('lotto', e.target.value)}
  disabled={importedFields.has('lotto')}
  className={importedFields.has('lotto') ? 'bg-muted opacity-80' : ''}
/>

{/* Solvente */}
<Input
  value={form.solvente}
  onChange={e => set('solvente', e.target.value)}
  disabled={importedFields.has('solvente')}
  className={importedFields.has('solvente') ? 'bg-muted opacity-80' : ''}
/>

{/* Produttore */}
<Input
  value={form.produttore}
  onChange={e => set('produttore', e.target.value)}
  disabled={importedFields.has('produttore')}
  className={importedFields.has('produttore') ? 'bg-muted opacity-80' : ''}
/>

{/* Scadenza Prodotto */}
<Input
  value={form.scadenza_prodotto}
  onChange={e => set('scadenza_prodotto', e.target.value)}
  disabled={importedFields.has('scadenza_prodotto')}
  className={importedFields.has('scadenza_prodotto') ? 'bg-muted opacity-80' : ''}
/>
```

Applicare lo stesso pattern a tutti gli altri campi mappabili: `forma_commerciale`, `data_apertura`, `concentrazione`, `stoccaggio`, `destinazione_uso`, `codice_interno`.

Per il campo **nomi** (la lista badge composti), bloccare l'input di testo e il pulsante di caricamento file `.txt` se `importedFields.has('nomi')`:

```tsx
<Input
  disabled={importedFields.has('nomi')}
  // ... resto invariato
/>
```

---

### Modifica G — Aggiungere `TextImportDialog` nel JSX

Aggiungere il dialog subito prima del tag `</Dialog>` finale del form:

```tsx
<TextImportDialog
  open={importTextOpen}
  onClose={() => setImportTextOpen(false)}
  fields={importFields}
  onImport={handleTextImport}
/>
```

Aggiungere l'import in cima al file:

```tsx
import { TextImportDialog, type ImportField } from '@/components/shared/TextImportDialog'
```

---

### Modifica H — Reset dei campi bloccati

Nella funzione `reset()`, aggiungere in fondo:

```tsx
setImportedFields(new Set())
```

---

## Verifica manuale

1. Aprire il form Mix → cliccare **"Importa da file"** → si apre il dialog
2. Caricare il file Excel di esempio (quello con la tabella Working Solution)
3. Nello step Preview vedere tutte le righe del foglio come griglia
4. Cliccare sulla cella **"NAME"** (intestazione della tabella dati) → la riga si evidenzia in blu
5. Cliccare **"Continua"** → si passa alla mappatura colonne
6. Agganciare:
   - `NAME` → *Nomi composti (lista)*
   - `LOT N.` → *Lotto*
   - `EXPIRY DATE` → *Data Scadenza*
   - le altre colonne → *— Ignora —*
7. Cliccare **"Importa"** → il dialog si chiude
8. Nel form: i nomi composti appaiono come badge, i campi Lotto e Data Scadenza sono compilati e **grigi (bloccati)**
9. I campi non agganciati (es. Solvente) restano bianchi e modificabili normalmente
10. Salvare il mix → i dati importati sono presenti nel record

---

## Commit

```bash
git add src/renderer/components/shared/TextImportDialog.tsx
git add src/renderer/pages/composti/MixPesticidiForm.tsx
git commit -m "feat(import): dialog generico importazione da file con selezione cella origine"
```

---

## Merge dopo verifica

```bash
git checkout master
git merge feat/text-import-dialog
git branch -d feat/text-import-dialog
```