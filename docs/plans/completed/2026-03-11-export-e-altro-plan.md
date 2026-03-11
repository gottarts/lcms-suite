# Piano di Sviluppo — Nuove Feature
**Data:** 2026-03-11  
**Branch base:** master  
**DB user_version:** 7 (nessuna migration necessaria per queste feature)

---

## Indice Feature

| ID | Feature | File principali | Branch |
|----|---------|-----------------|--------|
| FEAT-1 | Riordino pulsanti toolbar | `CompostiPage.tsx` | `fix/toolbar-order` |
| FEAT-2 | Elimina mix per lotto (con conteggio) | `CompostiPage.tsx`, `composti.ipc.ts` | `feat/delete-mix-by-lotto` |
| FEAT-3 | Rinomina modulo → "Reference Standards" | `Sidebar.tsx`, `CompostiPage.tsx` | `fix/rename-reference-standards` |
| FEAT-4 | Export CSV + PDF Quaderno CRM | `CompostiPage.tsx`, `ExportDialog.tsx` (nuovo) | `feat/export-csv-pdf` |
| FEAT-5 | Alert date anomale nello storico *(🔮 futuro)* | `CompostoPanel.tsx` | da pianificare |

---

## Istruzioni Git — da fare PRIMA di ogni feature

> Prima di iniziare qualsiasi task, apri il terminale in VS Code e sincronizza:

```bash
git pull
git status
```

Deve rispondere `nothing to commit, working tree clean`. Se non è così, fermati e avvisami.

---

## FEAT-1 — Riordino pulsanti toolbar

### Obiettivo
Spostare il pulsante **"Aggiungi Mix"** subito vicino a **"Nuovo composto"**, con "Importa CSV" spostato prima degli altri due.

### Situazione attuale
In `CompostiPage.tsx`, l'ordine attuale dei pulsanti nella toolbar è:

```tsx
<Button size="sm" variant="outline" onClick={() => setMixOpen(true)}>
  <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
</Button>
<Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
  <Upload className="h-4 w-4 mr-1" /> Importa CSV
</Button>
<Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
  <Plus className="h-4 w-4 mr-1" /> Nuovo composto
</Button>
```

Ordine visivo attuale: `[Aggiungi Mix] [Importa CSV] [Nuovo composto]`

### Situazione dopo
Ordine visivo desiderato: `[Importa CSV] [Aggiungi Mix] [Nuovo composto]`

### Modifica
**File:** `src/renderer/pages/composti/CompostiPage.tsx`

Cambia l'ordine dei tre `<Button>` nel blocco `flex items-center gap-2`. Sposta il blocco "Importa CSV" **prima** di "Aggiungi Mix":

```tsx
<Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
  <Upload className="h-4 w-4 mr-1" /> Importa CSV
</Button>
<Button size="sm" variant="outline" onClick={() => setMixOpen(true)}>
  <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
</Button>
<Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
  <Plus className="h-4 w-4 mr-1" /> Nuovo composto
</Button>
```

### Branch
```bash
git checkout master
git checkout -b fix/toolbar-order
```

### Commit (dopo verifica)
```bash
git add src/renderer/pages/composti/CompostiPage.tsx
git commit -m "fix(toolbar): sposta Importa CSV prima di Aggiungi Mix"
git checkout master
git merge fix/toolbar-order
git push
```

### Verifica
- Nella toolbar in alto a destra: primo pulsante = "Importa CSV", secondo = "Aggiungi Mix", terzo = "Nuovo composto"

---

## FEAT-2 — Elimina mix per lotto (con conteggio esplicito)

### Obiettivo
Quando si elimina un composto che appartiene a un mix (ha `mix_id` non nullo), eliminare **tutti i composti con lo stesso lotto** e mostrare un dialog di conferma con il numero esatto di composti che verranno eliminati.

### Situazione attuale

**Backend** — `src/main/ipc/composti.ipc.ts`:
```ts
ipcMain.handle('composti:delete', (_, id: number) => {
  getDb().prepare('DELETE FROM composti WHERE id = ?').run(id)
  return { ok: true }
})
```
Elimina solo il singolo composto per `id`.

**Frontend** — `src/renderer/pages/composti/CompostiPage.tsx`:

Il `ConfirmDialog` ha testo fisso:
```tsx
<ConfirmDialog
  open={deleteId !== null}
  title="Elimina composto"
  message="Eliminare questo composto e tutti i dati correlati (preparazioni, storia, associazioni metodi)?"
  confirmLabel="Elimina"
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => setDeleteId(null)}
/>
```

La funzione `handleDelete`:
```ts
const handleDelete = async () => {
  if (deleteId !== null) {
    await compostiApi.delete(deleteId)
    setDeleteId(null)
    setPanelId(null)
    load()
  }
}
```

### Situazione dopo

#### Modifica A — Backend: nuovo handler `composti:delete-by-lotto`

**File:** `src/main/ipc/composti.ipc.ts`

Aggiungere **dopo** l'handler `composti:delete` esistente:

```ts
// Restituisce quanti composti condividono lo stesso lotto (incluso il composto stesso)
ipcMain.handle('composti:count-by-lotto', (_, id: number) => {
  const db = getDb()
  const row = db.prepare('SELECT lotto, mix_id FROM composti WHERE id = ?').get(id) as any
  if (!row || !row.lotto || !row.mix_id) return { count: 1, lotto: null }
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM composti WHERE lotto = ?'
  ).get(row.lotto) as any
  return { count: result.count, lotto: row.lotto }
})

// Elimina tutti i composti con lo stesso lotto
ipcMain.handle('composti:delete-by-lotto', (_, lotto: string) => {
  getDb().prepare('DELETE FROM composti WHERE lotto = ?').run(lotto)
  return { ok: true }
})
```

#### Modifica B — Frontend: logica dialog dinamico

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

**Passo 1** — Aggiungere uno stato per i dati di eliminazione mix:

```ts
const [deleteId, setDeleteId] = useState<number | null>(null)
const [deleteMixInfo, setDeleteMixInfo] = useState<{ count: number; lotto: string | null } | null>(null)
```

**Passo 2** — Modificare `onDelete` nel pannello laterale per recuperare il conteggio prima di aprire il dialog:

```ts
onDelete={async (id) => {
  setPanelId(null)
  const info = await window.electronAPI.invoke('composti:count-by-lotto', id)
  setDeleteMixInfo(info)
  setDeleteId(id)
}}
```

**Passo 3** — Modificare `handleDelete` per usare il handler corretto:

```ts
const handleDelete = async () => {
  if (deleteId !== null) {
    if (deleteMixInfo && deleteMixInfo.lotto && deleteMixInfo.count > 1) {
      await window.electronAPI.invoke('composti:delete-by-lotto', deleteMixInfo.lotto)
    } else {
      await compostiApi.delete(deleteId)
    }
    setDeleteId(null)
    setDeleteMixInfo(null)
    setPanelId(null)
    load()
  }
}
```

**Passo 4** — Aggiornare il `ConfirmDialog` con messaggio dinamico:

```tsx
<ConfirmDialog
  open={deleteId !== null}
  title="Elimina composto"
  message={
    deleteMixInfo && deleteMixInfo.count > 1
      ? `Questo composto fa parte di un mix (lotto: ${deleteMixInfo.lotto}). Verranno eliminati ${deleteMixInfo.count} composti con tutti i dati correlati. Continuare?`
      : "Eliminare questo composto e tutti i dati correlati (preparazioni, storia, associazioni metodi)?"
  }
  confirmLabel="Elimina"
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => { setDeleteId(null); setDeleteMixInfo(null) }}
/>
```

### Branch
```bash
git checkout master
git checkout -b feat/delete-mix-by-lotto
```

### Commit (dopo verifica)
```bash
git add src/main/ipc/composti.ipc.ts
git add src/renderer/pages/composti/CompostiPage.tsx
git commit -m "feat(mix): elimina tutti i composti del lotto con conferma conteggio"
git checkout master
git merge feat/delete-mix-by-lotto
git push
```

### Verifica
1. Aprire un composto che fa parte di un mix → cliccare Elimina
2. Il dialog mostra: *"Questo composto fa parte di un mix (lotto: XXX). Verranno eliminati N composti con tutti i dati correlati. Continuare?"*
3. Confermare → tutti i composti del lotto spariscono dalla tabella
4. Aprire un composto normale (senza mix_id) → il dialog mostra il testo standard, elimina solo quello

---

## FEAT-3 — Rinomina modulo → "Reference Standards"

### Obiettivo
Cambiare la label "Composti" nella sidebar e il titolo "Standard di Riferimento" nella pagina in **"Reference Standards"**.

### Situazione attuale

**Sidebar** — `src/renderer/components/layout/Sidebar.tsx`:
```ts
const navItems = [
  { to: '/composti', label: 'Composti', icon: '🧪' },
  ...
]
```

**Pagina** — `src/renderer/pages/composti/CompostiPage.tsx`:
```tsx
<h2 className="font-heading text-lg font-semibold">Standard di Riferimento</h2>
```

### Situazione dopo

**Sidebar** — cambiare `label`:
```ts
{ to: '/composti', label: 'Reference Standards', icon: '🧪' },
```

**Pagina** — cambiare il titolo `<h2>`:
```tsx
<h2 className="font-heading text-lg font-semibold">Reference Standards</h2>
```

### Branch
```bash
git checkout master
git checkout -b fix/rename-reference-standards
```

### Commit (dopo verifica)
```bash
git add src/renderer/components/layout/Sidebar.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git commit -m "fix(ui): rinomina modulo composti in Reference Standards"
git checkout master
git merge fix/rename-reference-standards
git push
```

### Verifica
- Sidebar: la voce mostra "Reference Standards" con l'icona 🧪
- Pagina: il titolo in alto a sinistra mostra "Reference Standards"

---

## FEAT-4 — Export CSV + PDF Quaderno CRM

### Obiettivo
Aggiungere un pulsante **"Esporta"** nella toolbar che apre un dialog con due opzioni:
- **CSV** — esporta i composti (filtrati o tutti, a scelta dell'utente)
- **PDF Quaderno CRM** — genera un documento con sommario tabellare + schede individuali per ogni composto (tutti, inclusi dismessi), con preparazioni e storico

### Struttura del PDF Quaderno CRM
1. **Copertina** — titolo "Quaderno CRM – Reference Standards", data generazione, nome DB
2. **Sommario tabellare** — una riga per composto: Nome, Codice, Classe, Forma, Lotto, Scadenza, Stato
3. **Schede individuali** — una sezione per composto con:
   - Tutti i campi anagrafici (nome, codice, classe, forma, lotto, scadenza, produttore, ecc.)
   - Storico eventi (rivalidazioni, dismissioni, aperture fiale)
   - Preparazioni (concentrazione, data, scadenza, stato, operatore)

> ℹ️ Il PDF viene generato client-side tramite libreria `jsPDF` + `jspdf-autotable` (da installare). Non richiede migration DB.

---

### Struttura task

Questa feature è più complessa e si divide in 3 sotto-task:

| Sub-task | Cosa fa | File |
|----------|---------|------|
| 4A | Nuovo IPC `composti:export-data` che restituisce dati completi | `composti.ipc.ts` |
| 4B | Nuovo componente `ExportDialog.tsx` con scelta CSV / PDF | `ExportDialog.tsx` (nuovo) |
| 4C | Integrazione in `CompostiPage.tsx` + installazione dipendenze | `CompostiPage.tsx` |

---

### Sub-task 4A — Backend: handler `composti:export-data`

**File:** `src/main/ipc/composti.ipc.ts`

Aggiungere in fondo, prima della chiusura di `registerCompostiIpc()`:

```ts
ipcMain.handle('composti:export-data', (_, scope: 'all' | 'filtered', ids?: number[]) => {
  const db = getDb()
  
  // Recupera composti: tutti o solo quelli passati come ids
  const composti = scope === 'filtered' && ids && ids.length > 0
    ? ids.map(id => db.prepare('SELECT * FROM composti WHERE id = ?').get(id)).filter(Boolean)
    : db.prepare('SELECT * FROM composti ORDER BY nome ASC').all()

  // Per ogni composto recupera storia e preparazioni
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

---

### Sub-task 4B — Nuovo componente `ExportDialog.tsx`

**File da creare:** `src/renderer/pages/composti/ExportDialog.tsx`

Questo file gestisce:
- Dialog modale con titolo "Esporta dati"
- Scelta formato: CSV o PDF Quaderno CRM
- Scelta scope: "Solo composti visibili (filtrati)" o "Tutti i composti"
- Pulsante "Esporta" che lancia la generazione

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  filteredIds: number[]   // ids dei composti attualmente visibili in tabella
}

export function ExportDialog({ open, onClose, filteredIds }: ExportDialogProps) {
  const [formato, setFormato] = useState<'csv' | 'pdf'>('csv')
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.invoke(
        'composti:export-data',
        scope,
        scope === 'filtered' ? filteredIds : undefined
      )

      if (formato === 'csv') {
        exportCSV(data)
      } else {
        exportPDF(data)
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta dati</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Scelta formato */}
          <div>
            <p className="text-sm font-medium mb-2">Formato</p>
            <RadioGroup value={formato} onValueChange={v => setFormato(v as 'csv' | 'pdf')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="fmt-csv" />
                <Label htmlFor="fmt-csv">CSV (Excel)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <Label htmlFor="fmt-pdf">PDF — Quaderno CRM (sommario + schede)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Scelta scope */}
          <div>
            <p className="text-sm font-medium mb-2">Composti da includere</p>
            <RadioGroup value={scope} onValueChange={v => setScope(v as 'filtered' | 'all')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="filtered" id="scope-filtered" />
                <Label htmlFor="scope-filtered">
                  Solo visibili ({filteredIds.length} composti)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all">Tutti (inclusi dismessi e scaduti)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? 'Generazione...' : 'Esporta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Generazione CSV ──────────────────────────────────────────────────────────

function exportCSV(data: any[]) {
  const headers = [
    'Nome', 'Codice', 'Classe', 'Forma', 'Forma Commerciale',
    'Produttore', 'Lotto', 'Concentrazione', 'Unità', 'Solvente',
    'Purezza', 'Data Apertura', 'Scadenza', 'Data Dismissione',
    'Destinazione Uso', 'Stoccaggio', 'Accreditamento', 'Ubicazione', 'Note Mix'
  ]

  const rows = data.map(c => [
    c.nome ?? '',
    c.codice_interno ?? '',
    c.classe ?? '',
    c.forma ?? '',
    c.forma_commerciale ?? '',
    c.produttore ?? '',
    c.lotto ?? '',
    c.concentrazione ?? '',
    c.unita_conc ?? '',
    c.solvente ?? '',
    c.purezza ?? '',
    c.data_apertura ?? '',
    c.scadenza_prodotto ?? '',
    c.data_dismissione ?? '',
    c.destinazione_uso ?? '',
    c.stoccaggio ?? '',
    c.accreditamento_crm ?? '',
    c.ubicazione ?? '',
    c.mix ?? '',
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reference-standards-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Generazione PDF Quaderno CRM ─────────────────────────────────────────────

function exportPDF(data: any[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const oggi = new Date().toLocaleDateString('it-IT')

  // ── COPERTINA ──
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Quaderno CRM', 105, 80, { align: 'center' })
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text('Reference Standards', 105, 92, { align: 'center' })
  doc.setFontSize(11)
  doc.text(`Generato il: ${oggi}`, 105, 108, { align: 'center' })
  doc.text(`Composti inclusi: ${data.length}`, 105, 116, { align: 'center' })

  // ── SOMMARIO TABELLARE ──
  doc.addPage()
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Sommario', 14, 18)

  autoTable(doc, {
    startY: 24,
    head: [['Nome', 'Codice', 'Classe', 'Lotto', 'Scadenza', 'Stato']],
    body: data.map(c => [
      c.nome ?? '',
      c.codice_interno ?? '',
      c.classe ?? '',
      c.lotto ?? '',
      c.scadenza_prodotto ?? '',
      computeStatoLabel(c),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  // ── SCHEDE INDIVIDUALI ──
  for (const c of data) {
    doc.addPage()

    // Intestazione scheda
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(c.nome ?? 'Senza nome', 14, 16)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Stato: ${computeStatoLabel(c)}   |   Lotto: ${c.lotto ?? '—'}   |   Scadenza: ${c.scadenza_prodotto ?? '—'}`, 14, 22)
    doc.setDrawColor(200)
    doc.line(14, 25, 196, 25)

    // Campi anagrafici
    autoTable(doc, {
      startY: 28,
      head: [['Campo', 'Valore']],
      body: [
        ['Codice interno', c.codice_interno ?? '—'],
        ['Classe', c.classe ?? '—'],
        ['Forma', c.forma ?? '—'],
        ['Forma Commerciale', c.forma_commerciale ?? '—'],
        ['Produttore', c.produttore ?? '—'],
        ['Lotto', c.lotto ?? '—'],
        ['Concentrazione', c.concentrazione ? `${c.concentrazione} ${c.unita_conc ?? ''}` : '—'],
        ['Solvente', c.solvente ?? '—'],
        ['Purezza', c.purezza ?? '—'],
        ['Data apertura', c.data_apertura ?? '—'],
        ['Scadenza prodotto', c.scadenza_prodotto ?? '—'],
        ['Data dismissione', c.data_dismissione ?? '—'],
        ['Destinazione uso', c.destinazione_uso ?? '—'],
        ['Stoccaggio', c.stoccaggio ?? '—'],
        ['Accreditamento CRM', c.accreditamento_crm ?? '—'],
        ['Ubicazione', c.ubicazione ?? '—'],
        ['Mix', c.mix ?? '—'],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    })

    const afterAnag = (doc as any).lastAutoTable.finalY + 6

    // Storico eventi
    if (c.storia && c.storia.length > 0) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Storico eventi', 14, afterAnag)
      autoTable(doc, {
        startY: afterAnag + 4,
        head: [['Data', 'Tipo', 'Note']],
        body: c.storia.map((s: any) => [s.data ?? '', s.tipo ?? '', s.note ?? '']),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [100, 100, 100] },
      })
    }

    const afterStoria = (doc as any).lastAutoTable?.finalY ?? afterAnag
    const afterStoriaY = afterStoria + 6

    // Preparazioni
    if (c.preparazioni && c.preparazioni.length > 0) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Preparazioni', 14, afterStoriaY)
      autoTable(doc, {
        startY: afterStoriaY + 4,
        head: [['Data prep', 'Concentrazione', 'Solvente', 'Scadenza', 'Stato', 'Operatore']],
        body: c.preparazioni.map((p: any) => [
          p.data_prep ?? '',
          p.concentrazione ?? '',
          p.solvente ?? '',
          p.scadenza ?? '',
          p.stato ?? '',
          p.operatore ?? '',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [120, 120, 120] },
      })
    }
  }

  doc.save(`quaderno-crm-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// Helper stato label (semplificato, solo per export)
function computeStatoLabel(c: any): string {
  if (c.data_dismissione) return 'Dismesso'
  if (c.scadenza_prodotto && new Date(c.scadenza_prodotto) < new Date()) return 'Scaduto'
  return 'Attivo'
}
```

---

### Sub-task 4C — Integrazione in `CompostiPage.tsx`

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

**Passo 1** — Installare le dipendenze (una volta sola):
```bash
npm install jspdf jspdf-autotable
```

**Passo 2** — Aggiungere import in cima al file:
```ts
import { ExportDialog } from './ExportDialog'
```

**Passo 3** — Aggiungere stato:
```ts
const [exportOpen, setExportOpen] = useState(false)
```

**Passo 4** — Aggiungere il pulsante nella toolbar (dopo "Importa CSV"):
```tsx
<Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
  <Download className="h-4 w-4 mr-1" /> Esporta
</Button>
```
> Aggiungere `Download` agli import di `lucide-react`.

**Passo 5** — Aggiungere il componente nel JSX (vicino agli altri dialog):
```tsx
<ExportDialog
  open={exportOpen}
  onClose={() => setExportOpen(false)}
  filteredIds={filtered.map((c: any) => c.id)}
/>
```

### Branch
```bash
git checkout master
git checkout -b feat/export-csv-pdf
```

### Commit (dopo verifica)
```bash
git add src/renderer/pages/composti/ExportDialog.tsx
git add src/renderer/pages/composti/CompostiPage.tsx
git add src/main/ipc/composti.ipc.ts
git commit -m "feat(export): aggiungi export CSV e PDF Quaderno CRM"
git checkout master
git merge feat/export-csv-pdf
git push
```

### Verifica
1. Pulsante "Esporta" visibile nella toolbar
2. Dialog si apre con scelta formato (CSV / PDF) e scelta scope (visibili / tutti)
3. Export CSV: file scaricato, apribile in Excel, codifica UTF-8 corretta (caratteri speciali ok)
4. Export PDF: file scaricato con copertina, sommario tabella, schede per composto con storico e preparazioni

---

## FEAT-5 — 🔮 Alert date anomale nello storico *(Feat futura)*

> **Nota:** questa feature è pianificata per una sessione successiva. Non è da implementare ora.

### Descrizione
Se `data_apertura` del composto è successiva alla data di qualsiasi evento in `composti_storia`, mostrare un'icona ⚠️ accanto all'evento "Apertura" nello storico.

**Eccezione ammessa:** `scadenza_prodotto` può precedere la data di apertura (è normale per prodotti con scadenza breve).

### File che verranno toccati
- `src/renderer/pages/composti/CompostoPanel.tsx` — tab Storico, aggiunta icona ⚠️ condizionale

---

## Ordine di esecuzione consigliato

Le feature sono indipendenti tra loro, ma l'ordine consigliato per minimizzare il rischio è:

1. **FEAT-3** (rinomina) — 2 righe, rischio zero
2. **FEAT-1** (riordino toolbar) — 3 righe, rischio zero  
3. **FEAT-2** (elimina mix per lotto) — media complessità, tocca backend
4. **FEAT-4** (export) — più complessa, richiede installazione dipendenze

Procedi una feature alla volta. Verifica sempre prima di passare alla successiva.