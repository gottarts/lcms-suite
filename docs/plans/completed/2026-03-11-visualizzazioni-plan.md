# Piano di Sviluppo — LCMS Suite
**Data:** 2026-03-11
**Branch base:** `master`
**DB user_version attuale:** 8

---

## Panoramica Feature

| ID | Feature | File principali | Migration |
|----|---------|-----------------|-----------|
| FEAT-H | Badge CHIUSO sui CRM con data_dismissione | `CompostiTable.tsx` | No |
| FEAT-I | Pulsante PREP (con conteggio) sui composti Neat in tabella | `CompostiTable.tsx`, `CompostiPage.tsx` | No |
| FEAT-J | Campo Destinazione d'Uso come select a tendina + filtro | `CompostoForm.tsx`, `MixPesticidiForm.tsx`, `CompostiPage.tsx`, `types.ts` | No |
| FEAT-K | Controllo data apertura < data scadenza (avviso post-salva) | `CompostoForm.tsx` | No |

> ℹ️ Nessuna migration SQL necessaria per nessuna di queste feature. Tutte le modifiche sono solo UI/frontend.

---

## FEAT-H — Badge "CHIUSO" per composti non ancora aperti

### Obiettivo
Nella colonna Nome della tabella composti, aggiungere un badge grigio `CHIUSO` per i composti che **non hanno ancora una data di apertura** (`data_apertura` è null o vuota). Significa che la fiala è ancora sigillata, non è mai stata messa in uso.

Quando l'utente modifica il composto e inserisce la data di apertura, il badge scompare automaticamente (la lista si ricarica e la condizione non è più vera).

Vale per tutti i composti indipendentemente dal numero di fiale. I pallini `FialeSelector` restano invariati e continuano a gestire la casistica multi-fiala aperta.

### Situazione attuale
**File:** `src/renderer/pages/composti/CompostiTable.tsx`

Nella `render` della colonna `nome`, la logica attuale è:
```tsx
return (
  <span className="flex items-center gap-2">
    <span>
      {row.mix_id && (
        <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">
          MIX
        </Badge>
      )}
      {isRivalidato && (
        <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">
          RIVAL.
        </Badge>
      )}
      {String(v)}
      {row.prep_attive_count > 0 && (
        <Badge variant="outline" className="ml-2 text-xs">{row.prep_attive_count} prep.</Badge>
      )}
      {row.prep_scadute_count > 0 && (
        <Badge variant="destructive" className="ml-2 text-xs">⚠</Badge>
      )}
    </span>
    ...
  </span>
)
```

### Dopo la modifica
Aggiungere subito dopo il badge `RIVAL.` (e prima del testo del nome) il badge `CHIUSO`:

```tsx
{!row.data_apertura && (
  <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-100">
    CHIUSO
  </Badge>
)}
```

> ℹ️ La condizione `!row.data_apertura` è vera sia se il campo è `null` (valore DB) sia se è stringa vuota `""`. Non serve nessuna logica aggiuntiva.

### Branch
```bash
git checkout master
git checkout -b feat/badge-chiuso-crm
```

### Commit (dopo verifica)
```bash
git add src/renderer/pages/composti/CompostiTable.tsx
git commit -m "feat(tabella): badge CHIUSO per composti con data dismissione"
```

---

## FEAT-I — Pulsante PREP (con conteggio 0) sui composti Neat

### Obiettivo
Per ogni composto con `forma = 'Neat'` nella tabella, mostrare un pulsante/badge cliccabile che mostra `prep N` (dove N è il numero di preparazioni attive, anche 0). Al click, apre il pannello laterale direttamente sulla tab **Preparazioni**.

Questo pulsante **sostituisce** il badge `{row.prep_attive_count} prep.` già esistente.

### Situazione attuale

**File:** `src/renderer/pages/composti/CompostiTable.tsx`

Il badge esistente da rimuovere:
```tsx
{row.prep_attive_count > 0 && (
  <Badge variant="outline" className="ml-2 text-xs">{row.prep_attive_count} prep.</Badge>
)}
```

Questo badge: (a) compare solo se ci sono preparazioni attive (> 0), (b) non è cliccabile.

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

La funzione `onRowClick` attualmente apre il pannello sul tab di default (Dettaglio):
```tsx
const handleRowClick = (row: any) => {
  setSelected(row)
  setPanelOpen(true)
}
```

**File:** `src/renderer/pages/composti/CompostoPanel.tsx`

Il pannello accetta già `defaultTab` come prop? **Verificare.** Dalla sessione del 10-03, i Tabs sono ora **controlled** tramite stato `activeTab` con `useEffect` su `[defaultTab, compostoId]`. Quindi `defaultTab` è già una prop accettata.

### Modifiche necessarie

#### Modifica A — `CompostiTable.tsx`

Alla `interface CompostiTableProps` aggiungere una prop callback:
```tsx
onOpenPreparazioni?: (row: any) => void
```

Nella `render` della colonna `nome`, **sostituire** il badge esistente con:
```tsx
{row.forma === 'Neat' && (
  <Badge
    variant="outline"
    className="ml-2 text-xs cursor-pointer hover:bg-accent"
    onClick={(e) => {
      e.stopPropagation()
      onOpenPreparazioni?.(row)
    }}
  >
    prep {row.prep_attive_count ?? 0}
  </Badge>
)}
```

> ⚠️ La condizione è `row.forma === 'Neat'` — **non** `row.prep_attive_count > 0`. Il badge deve comparire **sempre** per i composti Neat, inclusi quelli senza alcuna preparazione (mostrando `prep 0`).

> ⚠️ Il `e.stopPropagation()` è necessario per evitare che il click sul badge apra anche il pannello normalmente (che sarebbe sulla tab Dettaglio invece che Preparazioni).

#### Modifica B — `CompostiPage.tsx`

Aggiungere uno stato per il tab da aprire:
```tsx
const [defaultTab, setDefaultTab] = useState<string>('dettaglio')
```

Aggiungere handler per apertura su tab Preparazioni:
```tsx
const handleOpenPreparazioni = (row: any) => {
  setSelected(row)
  setDefaultTab('preparazioni')
  setPanelOpen(true)
}
```

Passare le prop a `CompostiTable`:
```tsx
<CompostiTable
  ...
  onOpenPreparazioni={handleOpenPreparazioni}
/>
```

Passare `defaultTab` a `CompostoPanel`:
```tsx
<CompostoPanel
  ...
  defaultTab={defaultTab}
  onClose={() => { setPanelOpen(false); setDefaultTab('dettaglio') }}
/>
```

> ⚠️ Quando il pannello si chiude, resetta `defaultTab` a `'dettaglio'` per evitare che la prossima apertura da `handleRowClick` normale parta dalla tab Preparazioni.

### Branch
```bash
git checkout master
git checkout -b feat/prep-button-neat
```

### Commit (dopo verifica)
```bash
git add src/renderer/pages/composti/CompostiTable.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git commit -m "feat(tabella): pulsante PREP cliccabile per Neat, apre tab preparazioni"
```

---

## FEAT-J — Destinazione d'Uso come select a tendina + filtro

### Obiettivo
Trasformare il campo `destinazione_uso` da testo libero a **select con valori fissi**:
- Taratura
- Controllo qualità
- Taratura+Controllo qualità
- Standard Interno

Aggiungere un **filtro** nella barra filtri di `CompostiPage.tsx` accanto a Stato e Work.

### Situazione attuale

**File:** `src/renderer/pages/composti/CompostoForm.tsx`

Campo attuale (testo libero):
```tsx
<div><Label className="text-xs">Destinazione d'Uso</Label><Input value={form.destinazione_uso || ''} onChange={e => set('destinazione_uso', e.target.value)} /></div>
```

**File:** `src/renderer/pages/composti/MixPesticidiForm.tsx`

Il form Mix ha anch'esso `destinazione_uso` nello stato e probabilmente un Input simile — **da verificare nel codice effettivo**, ma sulla base dello `useState` documentato nei piani precedenti c'è `destinazione_uso: ''`.

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

I filtri attivi al momento sono: ricerca testuale, Stato, Work Solution. Non esiste ancora un filtro Destinazione Uso.

### Modifiche necessarie

#### Costante condivisa (opzionale ma consigliata)
Aggiungere in `src/renderer/lib/destinazione.ts` (file nuovo):
```ts
export const DESTINAZIONI_USO = [
  'Taratura',
  'Controllo qualità',
  'Taratura+Controllo qualità',
  'Standard Interno',
] as const
```

#### Modifica A — `CompostoForm.tsx`

**Sostituire** l'Input testo con una Select:
```tsx
// PRIMA (da rimuovere):
<div><Label className="text-xs">Destinazione d'Uso</Label><Input value={form.destinazione_uso || ''} onChange={e => set('destinazione_uso', e.target.value)} /></div>

// DOPO (da inserire):
<div>
  <Label className="text-xs">Destinazione d'Uso</Label>
  <Select
    value={form.destinazione_uso || '_none'}
    onValueChange={v => set('destinazione_uso', v === '_none' ? '' : v)}
  >
    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
    <SelectContent>
      <SelectItem value="_none">— Nessuna —</SelectItem>
      {DESTINAZIONI_USO.map(d => (
        <SelectItem key={d} value={d}>{d}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

> Importare `DESTINAZIONI_USO` da `@/lib/destinazione` (o definirla inline se si preferisce non creare un file separato).

#### Modifica B — `MixPesticidiForm.tsx`

Stesso intervento — trovare il campo `destinazione_uso` nel JSX e sostituire Input con Select con gli stessi valori.

#### Modifica C — `CompostiPage.tsx`

Aggiungere lo stato:
```tsx
const [filtroDestinazione, setFiltroDestinazione] = useState('')
```

Aggiungere la logica di filtraggio nel `useMemo` dei composti filtrati (stesso pattern del filtro Work):
```tsx
.filter(c => !filtroDestinazione || c.destinazione_uso === filtroDestinazione)
```

Aggiungere la Select nella barra filtri, **accanto** ai filtri Stato e Work già esistenti:
```tsx
<Select value={filtroDestinazione || '_none'} onValueChange={v => setFiltroDestinazione(v === '_none' ? '' : v)}>
  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Destinazione..." /></SelectTrigger>
  <SelectContent>
    <SelectItem value="_none">Tutte le destinazioni</SelectItem>
    {DESTINAZIONI_USO.map(d => (
      <SelectItem key={d} value={d}>{d}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Aggiungere il badge rimovibile per il filtro attivo (stesso pattern degli altri filtri):
```tsx
{filtroDestinazione && (
  <Badge variant="secondary" className="cursor-pointer" onClick={() => setFiltroDestinazione('')}>
    Dest.: {filtroDestinazione} ✕
  </Badge>
)}
```

### Branch
```bash
git checkout master
git checkout -b feat/destinazione-uso-select
```

### Commit (dopo verifica)
```bash
git add src/renderer/lib/destinazione.ts
git add src/renderer/pages/composti/CompostoForm.tsx
git add src/renderer/pages/composti/MixPesticidiForm.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git commit -m "feat(composti): destinazione uso come select + filtro in tabella"
```

---

## FEAT-K — Controllo data apertura < data scadenza

### Obiettivo
Dopo aver salvato un composto, se `data_apertura` è **uguale o successiva** a `scadenza_prodotto`, mostrare un avviso (non bloccare il salvataggio). Soloavviso visivo — l'utente può ignorarlo.

### Situazione attuale

**File:** `src/renderer/pages/composti/CompostoForm.tsx`

La funzione `handleSave` attualmente salva e chiude il dialog:
```tsx
const handleSave = async () => {
  if (!form.nome?.trim()) return
  setSaving(true)
  try {
    const data = { ...form }
    // ... trasformazioni campi ...
    if (isEdit) {
      await compostiApi.update(composto.id, data)
    } else {
      await compostiApi.create(data)
    }
    onSave()
    onClose()
  } catch (error) {
    console.error('Errore nel salvare il composto:', error)
  } finally {
    setSaving(false)
  }
}
```

### Modifiche necessarie

Aggiungere uno stato per l'avviso:
```tsx
const [warningDate, setWarningDate] = useState(false)
```

**Modificare `handleSave`** per controllare le date **dopo** il salvataggio e prima di chiamare `onClose()`:
```tsx
const handleSave = async () => {
  if (!form.nome?.trim()) return
  setSaving(true)
  try {
    const data = { ...form }
    // ... trasformazioni campi ... (invariato)
    if (isEdit) {
      await compostiApi.update(composto.id, data)
    } else {
      await compostiApi.create(data)
    }
    onSave()

    // Controllo date: apertura deve essere < scadenza
    if (form.data_apertura && form.scadenza_prodotto) {
      const apertura = new Date(form.data_apertura)
      const scadenza = new Date(form.scadenza_prodotto)
      if (apertura >= scadenza) {
        setWarningDate(true)
        return  // non chiudere il dialog, mostra l'avviso
      }
    }

    onClose()
  } catch (error) {
    console.error('Errore nel salvare il composto:', error)
  } finally {
    setSaving(false)
  }
}
```

Aggiungere il messaggio di avviso nel JSX del dialog, visibile solo se `warningDate === true`:
```tsx
{warningDate && (
  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
    <span>⚠️</span>
    <div>
      <p className="font-medium">Attenzione: date anomale</p>
      <p>La data di apertura è uguale o successiva alla data di scadenza. Il record è stato salvato — verifica le date.</p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onClose}>Chiudi</Button>
    </div>
  </div>
)}
```

> ℹ️ Quando `warningDate` è true, il dialog resta aperto mostrando l'avviso. Il pulsante "Chiudi" nell'avviso permette all'utente di chiudere manualmente. Al prossimo salvataggio, `warningDate` si resetta automaticamente perché `setWarningDate(false)` va aggiunto all'inizio di `handleSave`.

Aggiungere all'inizio di `handleSave`:
```tsx
setWarningDate(false)
```

### Branch
```bash
git checkout master
git checkout -b feat/date-check-apertura-scadenza
```

### Commit (dopo verifica)
```bash
git add src/renderer/pages/composti/CompostoForm.tsx
git commit -m "feat(form): avviso post-salva se data apertura >= data scadenza"
```

---

## Ordine di esecuzione consigliato

| # | Feature | Complessità | File toccati |
|---|---------|-------------|--------------|
| 1 | FEAT-H — Badge CHIUSO | Bassa | 1 file |
| 2 | FEAT-K — Controllo date | Bassa | 1 file |
| 3 | FEAT-J — Destinazione uso select+filtro | Media | 3-4 file |
| 4 | FEAT-I — Pulsante PREP Neat | Media | 2 file |

---

## Git — Workflow per ogni feature

```bash
# Prima di ogni feature: parti sempre da master aggiornato
git checkout master
git status   # assicurati che non ci siano modifiche in sospeso

# Crea il branch
git checkout -b feat/nome-feature

# ... fai le modifiche ...

# Verifica visiva nell'app
# poi:
git add -A
git commit -m "feat: descrizione"

# Dopo verifica finale:
git checkout master
git merge feat/nome-feature
git branch -d feat/nome-feature
```

> ⚠️ **Non fare il merge** prima di avermi confermato che la feature funziona correttamente nell'app.