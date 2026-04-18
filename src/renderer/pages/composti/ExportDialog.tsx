import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Tipi locali ──────────────────────────────────────────────────────────────

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  filteredIds: number[]
  selectedIds?: number[]
}

type Formato = 'csv' | 'pdf'
type Scope = 'selected' | 'filtered' | 'all'

// ── Helper pulizia testo ─────────────────────────────────────────────────────

function cleanText(s: any): string {
  if (!s) return ''
  return String(s)
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/\s*→\s*/g, '\n')
    .replace(/(\[Calc\][^\n]*),\s*/g, '$1,\n')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim()
}

// ── Helper stato label ───────────────────────────────────────────────────────

function computeStatoLabel(c: any): string {
  if (c.data_dismissione) return 'Dismesso'
  if (c.scadenza_prodotto && new Date(c.scadenza_prodotto) < new Date()) return 'Scaduto'
  const diffGiorni = c.scadenza_prodotto
    ? Math.ceil((new Date(c.scadenza_prodotto).getTime() - Date.now()) / 86400000)
    : null
  if (diffGiorni !== null && diffGiorni <= 30) return 'In scadenza'
  return 'Attivo'
}

// ── Helper metodi come stringa ───────────────────────────────────────────────

function metodiToString(c: any): string {
  if (!c.metodi || !Array.isArray(c.metodi) || c.metodi.length === 0) return ''
  return c.metodi.map((m: any) => m.nome ?? m).join('; ')
}

// ── Generazione CSV ──────────────────────────────────────────────────────────

function exportCSV(data: any[]) {
  const headers = [
    'Nome', 'Codice interno', 'Classe', 'Forma', 'Forma commerciale',
    'Produttore', 'Lotto', 'Concentrazione', 'Unità', 'Solvente',
    'Purezza', 'N fiale', 'Data apertura', 'Scadenza prodotto',
    'Data dismissione', 'Destinazione uso',
    'Stoccaggio', 'Accreditamento CRM', 'Ubicazione', 'Mix', 'Metodi',
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
    c.fiala ?? '',
    c.data_apertura ?? '',
    c.scadenza_prodotto ?? '',
    c.data_dismissione ?? '',
    c.destinazione_uso ?? '',
    c.stoccaggio ?? '',
    c.accreditamento_crm ?? '',
    c.ubicazione ?? '',
    c.mix ?? '',
    metodiToString(c),
  ])

  const csvContent = [headers, ...rows]
    .map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
    .join('\r\n')

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
  const oggi = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  // ── COPERTINA ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 30, 30)
  doc.rect(0, 0, 210, 60, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text('Quaderno CRM', 105, 30, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Reference Standards', 105, 42, { align: 'center' })

  doc.setTextColor(40, 40, 40)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generato il: ${oggi}`, 105, 80, { align: 'center' })
  doc.text(`Composti inclusi: ${data.length}`, 105, 88, { align: 'center' })

  const nAttivi = data.filter(c => computeStatoLabel(c) === 'Attivo').length
  const nScaduti = data.filter(c => computeStatoLabel(c) === 'Scaduto').length
  const nDismessi = data.filter(c => computeStatoLabel(c) === 'Dismesso').length
  const nInScadenza = data.filter(c => computeStatoLabel(c) === 'In scadenza').length

  doc.setFontSize(10)
  doc.text(`Attivi: ${nAttivi}   In scadenza: ${nInScadenza}   Scaduti: ${nScaduti}   Dismessi: ${nDismessi}`, 105, 100, { align: 'center' })

  // ── SOMMARIO TABELLARE ─────────────────────────────────────────────────────
  doc.addPage()

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Sommario', 14, 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(`${data.length} composti — generato il ${oggi}`, 14, 22)

  autoTable(doc, {
    startY: 26,
    head: [['Nome', 'Codice', 'Classe', 'Forma', 'Produttore', 'Lotto', 'Scadenza', 'Stato']],
    body: data.map(c => [
      c.nome ?? '',
      c.codice_interno ?? '',
      c.classe ?? '',
      c.forma ?? '',
      c.produttore ?? '',
      c.lotto ?? '',
      c.scadenza_prodotto ?? '',
      computeStatoLabel(c),
    ]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 42 },
      7: { cellWidth: 20 },
    },
  })

  // ── SCHEDE INDIVIDUALI ─────────────────────────────────────────────────────
  for (const c of data) {
    doc.addPage()

    const statoLabel = computeStatoLabel(c)
    const statoColor: [number, number, number] =
      statoLabel === 'Dismesso' ? [150, 150, 150]
      : statoLabel === 'Scaduto' ? [200, 60, 60]
      : statoLabel === 'In scadenza' ? [200, 130, 0]
      : [40, 140, 80]

    // Intestazione scheda
    doc.setFillColor(245, 245, 245)
    doc.rect(0, 0, 210, 28, 'F')

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(c.nome ?? 'Senza nome', 14, 11)

    // Badge stato
    doc.setFillColor(...statoColor)
    doc.roundedRect(14, 14, 28, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(statoLabel.toUpperCase(), 28, 19, { align: 'center' })

    doc.setTextColor(80, 80, 80)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Lotto: ${c.lotto ?? '—'}   |   Scadenza: ${c.scadenza_prodotto ?? '—'}   |   Produttore: ${c.produttore ?? '—'}`,
      46, 19
    )

    doc.setDrawColor(220, 220, 220)
    doc.line(14, 29, 196, 29)

    const metodiStr = metodiToString(c) || '—'
    const anagrafica = [
      ['Codice interno', c.codice_interno ?? '—', 'Classe', c.classe ?? '—'],
      ['Forma', c.forma ?? '—', 'Forma commerciale', c.forma_commerciale ?? '—'],
      ['Concentrazione', c.concentrazione ? `${c.concentrazione} ${c.unita_conc ?? ''}` : '—', 'Solvente', c.solvente ?? '—'],
      ['Purezza', c.purezza ?? '—', 'N fiale', c.fiala ?? '—'],
      ['Data apertura', c.data_apertura ?? '—', 'Data dismissione', c.data_dismissione ?? '—'],
      ['Destinazione uso', c.destinazione_uso ?? '—', 'Stoccaggio', c.stoccaggio ?? '—'],
      ['Accreditamento CRM', c.accreditamento_crm ?? '—', 'Ubicazione', c.ubicazione ?? '—'],
      ['Matrice', c.matrice ?? '—', '', ''],
      ['Peso molecolare', c.peso_molecolare ?? '—', 'Lotto', c.lotto ?? '—'],
      ['Metodi analitici', { content: metodiStr, colSpan: 3, styles: { fontStyle: 'normal' } }],
      ...(c.mix_id ? [['Mix', `${c.mix ?? ''} (${c.mix_id})`, 'Mix ID', c.mix_id]] : []),
    ]
    autoTable(doc, {
      startY: 32,
      head: [['Campo', 'Valore', 'Campo', 'Valore']],
      body: anagrafica,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 248, 248] },
        1: { cellWidth: 52 },
        2: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 248, 248] },
        3: { cellWidth: 52 },
      },
    })

    let cursorY: number = (doc as any).lastAutoTable.finalY + 7

    // Storico eventi
    if (c.storia && c.storia.length > 0) {
      if (cursorY > 230) { doc.addPage(); cursorY = 16 }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text('Storico eventi', 14, cursorY)

      autoTable(doc, {
        startY: cursorY + 4,
        head: [['Data', 'Tipo', 'N° fiala', 'Nuova scadenza', 'Note']],
        body: c.storia.map((s: any) => [
          s.data ?? '',
          s.tipo === 'apertura_fiala' ? 'Apertura fiala' : (s.tipo ?? ''),
          s.fiala_numero ?? '',
          s.nuova_scadenza ?? '',
          cleanText(s.note),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 7 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 30 },
          2: { cellWidth: 18 },
          3: { cellWidth: 28 },
          4: { cellWidth: 'auto' },
        },
      })

      cursorY = (doc as any).lastAutoTable.finalY + 7
    }

    // Preparazioni
    if (c.preparazioni && c.preparazioni.length > 0) {
      if (cursorY > 230) { doc.addPage(); cursorY = 16 }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text('Preparazioni', 14, cursorY)

      autoTable(doc, {
        startY: cursorY + 4,
        head: [['Data prep.', 'Concentrazione', 'Solvente', 'Scadenza', 'Stato', 'Operatore', 'Note']],
        body: c.preparazioni.map((p: any) => [
          p.data_prep ?? '',
          p.concentrazione ?? '',
          p.solvente ?? '',
          p.scadenza ?? '',
          p.stato ?? '',
          p.operatore ?? '',
          cleanText(p.note),
        ]),
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', minCellHeight: 8 },
        headStyles: { fillColor: [100, 100, 100], textColor: 255, fontSize: 6.5 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        tableWidth: 'auto',
        margin: { left: 14, right: 14 },
      })
    }

    // Numero pagina
    const pageCount = (doc as any).internal.getNumberOfPages()
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.setFont('helvetica', 'normal')
    doc.text(`pag. ${pageCount}`, 196, 290, { align: 'right' })
  }

  doc.save(`quaderno-crm-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Componente principale ────────────────────────────────────────────────────

export function ExportDialog({ open, onClose, filteredIds, selectedIds = [] }: ExportDialogProps) {
  const [formato, setFormato] = useState<Formato>('csv')
  // Se ci sono selezionati, pre-seleziona "selected"; altrimenti "filtered"
  const [scope, setScope] = useState<Scope>(selectedIds.length > 0 ? 'selected' : 'filtered')
  const [loading, setLoading] = useState(false)

  const idsToExport = scope === 'selected' ? selectedIds : scope === 'filtered' ? filteredIds : undefined

  const handleExport = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.invoke(
        'composti:export-data',
        scope === 'all' ? 'all' : 'filtered',
        scope !== 'all' ? idsToExport : undefined
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

  const scopeOption = (value: Scope, label: string, sublabel: string) => (
    <label
      className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
      style={{
        borderColor: scope === value ? 'hsl(var(--primary))' : undefined,
        backgroundColor: scope === value ? 'hsl(var(--primary) / 0.05)' : undefined,
      }}
    >
      <input
        type="radio"
        name="scope"
        value={value}
        checked={scope === value}
        onChange={() => setScope(value)}
      />
      <div className="text-sm">
        {label}
        <span className="ml-1 text-xs text-muted-foreground">{sublabel}</span>
      </div>
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta dati</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* Scelta formato */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Formato</Label>
            <div className="space-y-2">
              <label
                className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
                style={{
                  borderColor: formato === 'csv' ? 'hsl(var(--primary))' : undefined,
                  backgroundColor: formato === 'csv' ? 'hsl(var(--primary) / 0.05)' : undefined,
                }}
              >
                <input
                  type="radio"
                  name="formato"
                  value="csv"
                  checked={formato === 'csv'}
                  onChange={() => setFormato('csv')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">CSV (Excel)</div>
                  <div className="text-xs text-muted-foreground">
                    Tabella piatta, una riga per composto. Ideale per analisi in Excel.
                  </div>
                </div>
              </label>
              <label
                className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
                style={{
                  borderColor: formato === 'pdf' ? 'hsl(var(--primary))' : undefined,
                  backgroundColor: formato === 'pdf' ? 'hsl(var(--primary) / 0.05)' : undefined,
                }}
              >
                <input
                  type="radio"
                  name="formato"
                  value="pdf"
                  checked={formato === 'pdf'}
                  onChange={() => setFormato('pdf')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">PDF — Quaderno CRM</div>
                  <div className="text-xs text-muted-foreground">
                    Copertina + sommario + schede individuali con storico e preparazioni. Per archiviazione.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Scelta scope */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Composti da includere</Label>
            <div className="space-y-2">
              {selectedIds.length > 0 && scopeOption(
                'selected',
                'Selezionati',
                `(${selectedIds.length} composti selezionati con i checkbox)`
              )}
              {scopeOption(
                'filtered',
                'Solo visibili',
                `(${filteredIds.length} composti con i filtri attuali)`
              )}
              {scopeOption(
                'all',
                'Tutti i composti',
                '(inclusi dismessi e scaduti)'
              )}
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading
              ? (formato === 'pdf' ? 'Generazione PDF...' : 'Esportazione...')
              : `Esporta ${formato.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}