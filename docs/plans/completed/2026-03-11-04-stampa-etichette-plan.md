# Piano di Sviluppo — FEAT: Stampa Etichette Vial
**Data:** 2026-03-11  
**Branch base:** `master`  
**DB user_version:** 7 (nessuna migration necessaria)

---

## Indice Task

| ID | Task | File modificati | Note |
|----|------|-----------------|------|
| ET-1 | Nuovo componente `EtichetteDialog.tsx` | `src/renderer/pages/composti/EtichetteDialog.tsx` (nuovo) | Dialog con scelta formato vial + generazione PDF etichette composti |
| ET-2 | Aggiunta pulsante toolbar in `CompostiPage.tsx` | `src/renderer/pages/composti/CompostiPage.tsx` | Pulsante "Etichette" nella toolbar, passa `filteredIds` |
| ET-3 | Backend IPC `composti:etichette-data` | `src/main/ipc/composti.ipc.ts` | Handler che restituisce composti con campo `fiala` |
| ET-4 | Pulsante etichetta preparazione in `PreparazioniTab.tsx` | `src/renderer/pages/composti/PreparazioniTab.tsx` | Bottone 🏷️ su ogni preparazione nella lista |

---

## Istruzioni Git — prima di ogni task

> Apri il terminale in VS Code e verifica che tutto sia pulito:

```bash
git pull
git status
```

Deve rispondere `nothing to commit, working tree clean`. Se non è così, fermati e avvisami.

```bash
git checkout -b feat/stampa-etichette
```

---

## Logica generale

**Etichette composti (dalla toolbar):**
- L'utente clicca "Etichette" nella toolbar
- Si apre un dialog dove sceglie il formato vial (HPLC 2mL o Supelco 4mL, con dimensioni modificabili)
- Il PDF generato contiene **tante etichette quante le fiale** del composto (`fiala` campo esistente)  
  → Es. composto con `fiala = 4` genera 4 etichette identiche
- Vengono inclusi solo i composti **attualmente visibili** (filteredIds)
- Ogni etichetta mostra: Nome, Lotto, Concentrazione+Unità, Scadenza, Data apertura, Operatore, Solvente

**Etichette preparati (dal pannello laterale):**
- Nel tab Preparazioni, ogni riga ha un bottone 🏷️
- Al click genera un PDF con 1 etichetta per quella preparazione
- L'etichetta mostra: Nome composto padre, Lotto (composto), Concentrazione preparazione, Solvente preparazione, Data prep, Scadenza preparazione, Operatore, Stato

---

## TASK ET-1 — Nuovo componente `EtichetteDialog.tsx`

### Branch
```bash
git checkout feat/stampa-etichette
```

### File da creare
`src/renderer/pages/composti/EtichetteDialog.tsx`

### Situazione attuale
Il file non esiste. Va creato da zero.

### Situazione dopo
Un Dialog modale che permette di:
1. Scegliere il formato vial (HPLC 2mL o Supelco 4mL)
2. Visualizzare/modificare le dimensioni in mm dell'etichetta
3. Cliccare "Stampa" per generare il PDF

### Dimensioni etichette di default

| Formato | Larghezza | Altezza | Note |
|---------|-----------|---------|------|
| Vial HPLC 2mL | 35 mm | 22 mm | Etichetta piccola |
| Vial Supelco 4mL | 45 mm | 28 mm | Etichetta media |

Le dimensioni sono modificabili dall'utente nel dialog (campi numerici).

### Codice da creare — `EtichetteDialog.tsx`

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import jsPDF from 'jspdf'

// ── Tipi ─────────────────────────────────────────────────────────────────────

interface EtichetteDialogProps {
  open: boolean
  onClose: () => void
  filteredIds: number[]
}

type FormatoVial = 'hplc2ml' | 'supelco4ml'

interface DimensioniVial {
  larghezza: number  // mm
  altezza: number    // mm
}

const DIMENSIONI_DEFAULT: Record<FormatoVial, DimensioniVial> = {
  hplc2ml:    { larghezza: 35, altezza: 22 },
  supelco4ml: { larghezza: 45, altezza: 28 },
}

// ── Generazione PDF etichette composti ───────────────────────────────────────

function generaEtichetteComposti(
  data: any[],
  dim: DimensioniVial
): void {
  // Margini pagina (mm)
  const marginX = 5
  const marginY = 5
  const gapX = 3   // spazio orizzontale tra etichette
  const gapY = 3   // spazio verticale tra etichette

  // Numero etichette per riga e per colonna su A4 (210x297mm)
  const paginaW = 210
  const paginaH = 297
  const colonne = Math.floor((paginaW - marginX * 2 + gapX) / (dim.larghezza + gapX))
  const righe   = Math.floor((paginaH - marginY * 2 + gapY) / (dim.altezza + gapY))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let col = 0
  let riga = 0
  let primaEtichetta = true

  for (const composto of data) {
    // Numero di copie = valore numerico del campo fiala (minimo 1)
    const nCopie = Math.max(1, parseInt(composto.fiala ?? '1') || 1)

    for (let i = 0; i < nCopie; i++) {
      // Nuova pagina se necessario
      if (!primaEtichetta && col === 0 && riga === 0) {
        doc.addPage()
      }
      primaEtichetta = false

      // Posizione angolo top-left di questa etichetta
      const x = marginX + col * (dim.larghezza + gapX)
      const y = marginY + riga * (dim.altezza + gapY)

      disegnaEtichetteComposto(doc, composto, x, y, dim)

      // Avanza posizione
      col++
      if (col >= colonne) {
        col = 0
        riga++
        if (riga >= righe) {
          riga = 0
          col = 0
        }
      }
    }
  }

  doc.save(`etichette-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Disegna una singola etichetta composto ───────────────────────────────────

function disegnaEtichetteComposto(
  doc: jsPDF,
  c: any,
  x: number,
  y: number,
  dim: DimensioniVial
): void {
  const w = dim.larghezza
  const h = dim.altezza
  const pad = 1.2  // padding interno mm

  // Bordo etichetta
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)

  // Nome composto — riga 1, bold, font grande
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(20, 20, 20)
  const nomeClip = doc.splitTextToSize(c.nome ?? '—', w - pad * 2)
  doc.text(nomeClip[0], x + pad, y + pad + 3)

  // Linea sottile sotto il nome
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.15)
  doc.line(x + pad, y + pad + 4, x + w - pad, y + pad + 4)

  // Campi — font piccolo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.setTextColor(50, 50, 50)

  const conc = c.concentrazione
    ? `${c.concentrazione} ${c.unita_conc ?? ''}`
    : '—'

  const righe = [
    `Lotto: ${c.lotto ?? '—'}`,
    `Conc: ${conc}`,
    `Solv: ${c.solvente ?? '—'}`,
    `Ap: ${c.data_apertura ?? '—'}`,
    `Sc: ${c.scadenza_prodotto ?? '—'}`,
    `Op: ${c.operatore_apertura ?? '—'}`,
  ]

  let yCur = y + pad + 6
  const lineH = (h - pad * 2 - 6) / righe.length

  for (const r of righe) {
    doc.text(r, x + pad, yCur)
    yCur += lineH
  }
}

// ── Generazione PDF etichetta singola preparazione ───────────────────────────

export function generaEtichettaPreparazione(
  composto: any,
  prep: any,
  dim: DimensioniVial
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  disegnaEtichettaPreparazione(doc, composto, prep, 5, 5, dim)
  doc.save(`etichetta-prep-${prep.id ?? ''}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function disegnaEtichettaPreparazione(
  doc: jsPDF,
  composto: any,
  prep: any,
  x: number,
  y: number,
  dim: DimensioniVial
): void {
  const w = dim.larghezza
  const h = dim.altezza
  const pad = 1.2

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)

  // Nome composto — bold
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(20, 20, 20)
  const nomeClip = doc.splitTextToSize(composto.nome ?? '—', w - pad * 2)
  doc.text(nomeClip[0], x + pad, y + pad + 3)

  // Badge "PREP" top right
  doc.setFontSize(4)
  doc.setTextColor(80, 80, 200)
  doc.text('PREP', x + w - pad - 6, y + pad + 3)

  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.15)
  doc.line(x + pad, y + pad + 4, x + w - pad, y + pad + 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.setTextColor(50, 50, 50)

  const concPrep = prep.concentrazione_reale
    ? `${prep.concentrazione_reale} ${prep.unita_conc ?? ''} (reale)`
    : prep.concentrazione
      ? `${prep.concentrazione} ${prep.unita_conc ?? ''}`
      : '—'

  const righe = [
    `Lotto: ${composto.lotto ?? '—'}`,
    `Conc: ${concPrep}`,
    `Solv: ${prep.solvente ?? '—'}`,
    `Prep: ${prep.data_prep ?? '—'}`,
    `Sc: ${prep.scadenza ?? '—'}`,
    `Op: ${prep.operatore ?? '—'}  Stato: ${prep.stato ?? '—'}`,
  ]

  let yCur = y + pad + 6
  const lineH = (h - pad * 2 - 6) / righe.length

  for (const r of righe) {
    doc.text(r, x + pad, yCur)
    yCur += lineH
  }
}

// ── Componente Dialog ─────────────────────────────────────────────────────────

export function EtichetteDialog({ open, onClose, filteredIds }: EtichetteDialogProps) {
  const [formato, setFormato] = useState<FormatoVial>('hplc2ml')
  const [dim, setDim] = useState<DimensioniVial>(DIMENSIONI_DEFAULT['hplc2ml'])
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState<number | null>(null)

  const handleFormatoChange = (f: FormatoVial) => {
    setFormato(f)
    setDim({ ...DIMENSIONI_DEFAULT[f] })
  }

  const handleStampa = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.invoke(
        'composti:etichette-data',
        filteredIds
      )
      generaEtichetteComposti(data, dim)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Calcola anteprima numero etichette quando si apre
  const nEtichetteStimate = count !== null ? count : filteredIds.length + ' composti (fiale da calcolare)'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Stampa Etichette Vial</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Scelta formato */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Formato vial</Label>
            <div className="space-y-2">
              {(['hplc2ml', 'supelco4ml'] as FormatoVial[]).map(f => (
                <label
                  key={f}
                  className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
                  style={{
                    borderColor: formato === f ? 'hsl(var(--primary))' : undefined,
                    backgroundColor: formato === f ? 'hsl(var(--primary) / 0.05)' : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="formato"
                    value={f}
                    checked={formato === f}
                    onChange={() => handleFormatoChange(f)}
                  />
                  <div>
                    <div className="text-sm font-medium">
                      {f === 'hplc2ml' ? 'Vial HPLC 2 mL' : 'Vial Supelco 4 mL'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Default: {DIMENSIONI_DEFAULT[f].larghezza} × {DIMENSIONI_DEFAULT[f].altezza} mm
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Dimensioni modificabili */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dimensioni etichetta (mm)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Larghezza</Label>
                <Input
                  type="number"
                  min="20"
                  max="100"
                  value={dim.larghezza}
                  onChange={e => setDim(d => ({ ...d, larghezza: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Altezza</Label>
                <Input
                  type="number"
                  min="10"
                  max="80"
                  value={dim.altezza}
                  onChange={e => setDim(d => ({ ...d, altezza: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Info scope */}
          <p className="text-xs text-muted-foreground">
            Verranno stampate le etichette per <strong>{filteredIds.length} composti</strong> visibili,
            con tante copie quante le fiale di ciascuno.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleStampa} disabled={loading || filteredIds.length === 0}>
            {loading ? 'Generazione...' : '🏷️ Stampa PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Verifica
- Il dialog si apre e mostra i due formati vial
- Selezionando un formato, le dimensioni si aggiornano ai default
- Le dimensioni sono modificabili nei campi numerici
- Clic "Stampa PDF" → scarica un PDF con le etichette impaginate su A4
- Un composto con `fiala = 4` genera 4 etichette identiche
- Un composto con `fiala` null o vuoto genera 1 etichetta

---

## TASK ET-2 — Pulsante toolbar in `CompostiPage.tsx`

### File da modificare
`src/renderer/pages/composti/CompostiPage.tsx`

### Situazione attuale

In cima al file, gli import attuali includono già `ExportDialog`:
```tsx
import { ExportDialog } from './ExportDialog'
```

Nella toolbar (blocco `flex items-center gap-2`), l'ordine attuale è:
```tsx
<Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
  <Upload className="h-4 w-4 mr-1" /> Importa CSV
</Button>
<Button size="sm" variant="outline" onClick={() => setMixOpen(true)}>
  <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
</Button>
<Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
  <Download className="h-4 w-4 mr-1" /> Esporta
</Button>
<Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
  <Plus className="h-4 w-4 mr-1" /> Nuovo composto
</Button>
```

Gli stati attuali includono già `exportOpen`. Non c'è ancora `etichetteOpen`.

### Situazione dopo

**Modifica 1 — aggiungere import:**
```tsx
import { EtichetteDialog } from './EtichetteDialog'
```

**Modifica 2 — aggiungere lo stato:**

Trovare il blocco degli `useState`. Aggiungere dopo `const [exportOpen, setExportOpen] = useState(false)`:
```tsx
const [etichetteOpen, setEtichetteOpen] = useState(false)
```

**Modifica 3 — aggiungere il pulsante nella toolbar:**

Aggiungere il pulsante "Etichette" subito dopo il pulsante "Esporta":
```tsx
{/* Pulsante Etichette — subito dopo Esporta */}
<Button size="sm" variant="outline" onClick={() => setEtichetteOpen(true)}>
  🏷️ Etichette
</Button>
```

Ordine finale toolbar: `[Importa CSV] [Aggiungi Mix] [Esporta] [Etichette] [Nuovo composto]`

**Modifica 4 — aggiungere il componente nel JSX:**

Vicino all'`<ExportDialog>` esistente, aggiungere:
```tsx
<EtichetteDialog
  open={etichetteOpen}
  onClose={() => setEtichetteOpen(false)}
  filteredIds={filtered.map((c: any) => c.id)}
/>
```

> ⚠️ `filtered` è già disponibile nella pagina — è l'array dei composti dopo i filtri applicati. Verificare il nome esatto della variabile nel codice (potrebbe chiamarsi `filteredComposti` o simile — adattare di conseguenza).

### Verifica
- Pulsante "🏷️ Etichette" visibile nella toolbar dopo "Esporta"
- Click sul pulsante apre il dialog `EtichetteDialog`
- Dialog riceve correttamente il numero di composti filtrati

---

## TASK ET-3 — Backend IPC `composti:etichette-data`

### File da modificare
`src/main/ipc/composti.ipc.ts`

### Situazione attuale

Nel file esiste già l'handler `composti:export-data`, aggiunto nella sessione 2026-03-11:
```ts
ipcMain.handle('composti:export-data', (_, scope: string, ids?: number[]) => {
  const db = getDb()
  const composti = scope === 'filtered' && ids?.length
    ? ids.map(id => db.prepare('SELECT * FROM composti WHERE id = ?').get(id)).filter(Boolean)
    : db.prepare('SELECT * FROM composti ORDER BY nome ASC').all()

  const result = (composti as any[]).map(c => {
    const storia = db.prepare(
      'SELECT * FROM composti_storia WHERE composto_id = ? ORDER BY data ASC'
    ).all(c.id)
    const preparazioni = db.prepare(
      'SELECT * FROM preparazioni WHERE composto_id = ? ORDER BY data_prep DESC'
    ).all(c.id)
    return { ...c, storia, preparazioni }
  })

  return result
})
```

Non esiste ancora l'handler `composti:etichette-data`.

### Situazione dopo

Aggiungere subito dopo l'handler `composti:export-data` il nuovo handler:
```ts
ipcMain.handle('composti:etichette-data', (_, ids: number[]) => {
  const db = getDb()
  // Recupera solo i campi necessari per le etichette
  const composti = ids.length
    ? ids
        .map(id => db.prepare(
          `SELECT id, nome, lotto, concentrazione, unita_conc, solvente,
                  data_apertura, scadenza_prodotto, operatore_apertura, fiala
           FROM composti WHERE id = ?`
        ).get(id))
        .filter(Boolean)
    : []
  return composti
})
```

> ℹ️ Recuperiamo solo i campi che servono per l'etichetta — non tutta la riga. `fiala` è necessario per calcolare il numero di copie.

### Verifica
- L'handler risponde con un array di oggetti contenenti i campi elencati
- Se `ids` è vuoto, restituisce array vuoto
- Il campo `fiala` è presente nella risposta

---

## TASK ET-4 — Pulsante etichetta preparazione in `PreparazioniTab.tsx`

### File da modificare
`src/renderer/pages/composti/PreparazioniTab.tsx`

### Situazione attuale

Le preparazioni vengono mostrate in una lista di card. Ogni card ha già dei pulsanti azione (modifica, dismetti, elimina). La parte JSX di ogni card ha una struttura simile a questa (verifica il codice esatto):

```tsx
<div className="flex items-center gap-1">
  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Modifica</Button>
  {/* altri pulsanti */}
</div>
```

Non esiste ancora il pulsante etichetta.

### Situazione dopo

**Modifica 1 — aggiungere import:**

In cima al file, verificare che `jsPDF` sia già importato. Se non c'è:
```tsx
import jsPDF from 'jspdf'
```

> ⚠️ jsPDF è già installato nel progetto (usato da ExportDialog). Non serve reinstallarlo.

**Modifica 2 — aggiungere import della funzione di generazione etichetta:**
```tsx
import { generaEtichettaPreparazione } from './EtichetteDialog'
```

**Modifica 3 — aggiungere stato per il formato vial di default:**

Dentro il componente `PreparazioniTab`, aggiungere lo stato (usa dimensioni HPLC 2mL come default):
```tsx
const DIM_ETICHETTA_DEFAULT = { larghezza: 35, altezza: 22 }
```

> ℹ️ Non apriamo un dialog di scelta formato per le preparazioni — si usa il formato default HPLC 2mL. Se in futuro si vorrà scegliere, si può aggiungere un dialog apposito. Per ora è sufficiente così.

**Modifica 4 — aggiungere il pulsante nella card di ogni preparazione:**

Trovare nel JSX il blocco dei pulsanti azione di ogni preparazione e aggiungere il pulsante 🏷️:

```tsx
<Button
  size="sm"
  variant="ghost"
  title="Stampa etichetta"
  onClick={() => generaEtichettaPreparazione(composto, p, DIM_ETICHETTA_DEFAULT)}
>
  🏷️
</Button>
```

> ⚠️ Il componente `PreparazioniTab` riceve già il composto padre tramite props o lo carica tramite `compostoId`. Verifica come è strutturato: se riceve `composto` come prop direttamente, usalo. Se riceve solo `compostoId`, aggiungi `composto` come prop oppure fai un fetch locale. Avvisami se non è chiaro dopo aver aperto il file.

### Prop da aggiungere (se necessario)

Se `PreparazioniTab` non ha accesso ai dati del composto padre (nome, lotto), dobbiamo aggiungerla come prop.

Cerca la firma attuale del componente:
```tsx
export function PreparazioniTab({ compostoId, preparazioni, onRefresh }: PreparazioniTabProps)
```

Se è così, bisogna aggiungere `composto` alle props:

**In `PreparazioniTab.tsx` — aggiungere alla interface:**
```tsx
interface PreparazioniTabProps {
  compostoId: number
  preparazioni: any[]
  onRefresh: () => void
  composto: any   // ← aggiungere questa riga
}
```

**In `CompostoPanel.tsx` — passare il prop:**
```tsx
<PreparazioniTab
  compostoId={composto.id}
  preparazioni={composto.preparazioni}
  onRefresh={refresh}
  composto={composto}   // ← aggiungere questa riga
/>
```

### Verifica
- Nel tab Preparazioni di un composto Neat, ogni riga mostra il pulsante 🏷️
- Click sul pulsante → scarica un PDF con l'etichetta della preparazione
- L'etichetta mostra nome composto, lotto, concentrazione (reale se disponibile), solvente, date, operatore

---

## Commit finale (dopo verifica completa di tutte le task)

Una volta verificato che tutto funziona correttamente:

```bash
git add src/renderer/pages/composti/EtichetteDialog.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/main/ipc/composti.ipc.ts
git add src/renderer/pages/composti/PreparazioniTab.tsx
git add src/renderer/pages/composti/CompostoPanel.tsx   # solo se hai modificato le props

git commit -m "feat(etichette): stampa etichette vial per composti e preparazioni"

git checkout master
git merge feat/stampa-etichette
git push
```

---

## Ordine di esecuzione consigliato

1. **ET-3 prima** (backend IPC) — non dipende da nulla, si testa subito con DevTools
2. **ET-1** (EtichetteDialog) — il componente principale
3. **ET-2** (pulsante toolbar) — collega il dialog alla pagina
4. **ET-4** (pulsante preparazioni) — aggiunge la funzionalità al pannello laterale

---

## Note su layout etichette

Le etichette vengono impaginate su A4 a griglia automatica, con quante colonne entrano in base alle dimensioni scelte. Per esempio con etichette HPLC 2mL (35×22mm):

- Su A4 210mm, con margini 5mm e gap 3mm: `floor((210 - 10 + 3) / (35 + 3))` = **5 colonne**
- In altezza 297mm: `floor((297 - 10 + 3) / (22 + 3))` = **11 righe**
- → ~55 etichette per pagina A4

Per Supelco 4mL (45×28mm): ~4 colonne × 9 righe = ~36 etichette per pagina.

---

*Piano redatto il 2026-03-11*