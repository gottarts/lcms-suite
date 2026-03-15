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

// ── Helper: disegna una singola etichetta composto ───────────────────────────

function disegnaEtichetteComposto(
  doc: jsPDF,
  c: any,
  x: number,
  y: number,
  dim: DimensioniVial
): void {
  const w = dim.larghezza
  const h = dim.altezza
  const pad = 1.5

  // Bordo etichetta
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)

  // Header scuro con nome composto
  doc.setFillColor(35, 35, 35)
  doc.rect(x, y, w, 5.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(255, 255, 255)
  const nomeClip = doc.splitTextToSize(c.nome ?? '—', w - pad * 2)
  doc.text(nomeClip[0], x + pad, y + 3.8)

  // Corpo etichetta
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.2)
  doc.setTextColor(30, 30, 30)

  const conc = c.concentrazione
    ? `${c.concentrazione} ${c.unita_conc ?? ''}`.trim()
    : '—'

  const righe: [string, string][] = [
    ['Lotto',     c.lotto ?? '—'],
    ['Conc.',     conc],
    ['Solv.',     c.solvente ?? '—'],
    ['Apertura',  c.data_apertura ?? '—'],
    ['Scadenza',  c.scadenza_prodotto ?? '—'],
    ['Operatore', c.operatore_apertura ?? '—'],
  ]

  const areaH = h - 5.5 - pad
  const lineH = areaH / righe.length
  let yCur = y + 5.5 + lineH * 0.75

  for (const [label, valore] of righe) {
    // Label in grigio
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text(label + ':', x + pad, yCur)

    // Valore in nero, allineato dopo la label
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    const labelW = doc.getTextWidth(label + ': ')
    const valoreClip = doc.splitTextToSize(valore, w - pad * 2 - labelW)
    doc.text(valoreClip[0], x + pad + labelW, yCur)

    yCur += lineH
  }
}

// ── Helper: disegna una singola etichetta preparazione ───────────────────────

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
  const pad = 1.5

  // Bordo etichetta
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)

  // Header con sfondo blu scuro + badge PREP
  doc.setFillColor(30, 50, 100)
  doc.rect(x, y, w, 5.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(255, 255, 255)
  const nomeClip = doc.splitTextToSize(composto.nome ?? '—', w - pad * 2 - 10)
  doc.text(nomeClip[0], x + pad, y + 3.8)

  // Badge "PREP" in alto a destra
  doc.setFontSize(4)
  doc.setTextColor(180, 210, 255)
  doc.text('PREP', x + w - pad - doc.getTextWidth('PREP'), y + 3.8)

  // Corpo etichetta
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.2)
  doc.setTextColor(30, 30, 30)

  const concPrep = prep.concentrazione_reale != null
    ? `${Number(prep.concentrazione_reale).toFixed(2)} ${prep.unita_conc ?? ''} (reale)`.trim()
    : prep.concentrazione
      ? `${prep.concentrazione} ${prep.unita_conc ?? ''}`.trim()
      : '—'

  const righe: [string, string][] = [
    ['Lotto',    composto.lotto ?? '—'],
    ['Conc.',    concPrep],
    ['Solv.',    prep.solvente ?? '—'],
    ['Prep.',    prep.data_prep ?? '—'],
    ['Scad.',    prep.scadenza ?? '—'],
    ['Op./Stato', `${prep.operatore ?? '—'} · ${prep.stato ?? '—'}`],
  ]

  const areaH = h - 5.5 - pad
  const lineH = areaH / righe.length
  let yCur = y + 5.5 + lineH * 0.75

  for (const [label, valore] of righe) {
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text(label + ':', x + pad, yCur)

    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    const labelW = doc.getTextWidth(label + ': ')
    const valoreClip = doc.splitTextToSize(valore, w - pad * 2 - labelW)
    doc.text(valoreClip[0], x + pad + labelW, yCur)

    yCur += lineH
  }
}

// ── Generazione PDF etichette composti (dalla toolbar) ───────────────────────

function generaEtichetteComposti(data: any[], dim: DimensioniVial): void {
  const marginX = 5
  const marginY = 5
  const gapX = 3
  const gapY = 3
  const paginaW = 210
  const paginaH = 297

  const colonne = Math.max(1, Math.floor((paginaW - marginX * 2 + gapX) / (dim.larghezza + gapX)))
  const righe   = Math.max(1, Math.floor((paginaH - marginY * 2 + gapY) / (dim.altezza + gapY)))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let col = 0
  let riga = 0
  let prima = true

  for (const composto of data) {
    const nCopie = Math.max(1, parseInt(composto.fiala ?? '1') || 1)

    for (let i = 0; i < nCopie; i++) {
      if (!prima && col === 0 && riga === 0) {
        doc.addPage()
      }
      prima = false

      const x = marginX + col * (dim.larghezza + gapX)
      const y = marginY + riga * (dim.altezza + gapY)

      disegnaEtichetteComposto(doc, composto, x, y, dim)

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

// ── Generazione PDF etichetta singola preparazione (dal pannello laterale) ───

export function generaEtichettaPreparazione(
  composto: any,
  prep: any,
  dim: DimensioniVial = DIMENSIONI_DEFAULT['hplc2ml']
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  disegnaEtichettaPreparazione(doc, composto, prep, 5, 5, dim)
  doc.save(`etichetta-prep-${prep.id ?? 'new'}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Componente Dialog ─────────────────────────────────────────────────────────

export function EtichetteDialog({ open, onClose, filteredIds }: EtichetteDialogProps) {
  const [formato, setFormato] = useState<FormatoVial>('hplc2ml')
  const [dim, setDim] = useState<DimensioniVial>({ ...DIMENSIONI_DEFAULT['hplc2ml'] })
  const [loading, setLoading] = useState(false)

  const handleFormatoChange = (f: FormatoVial) => {
    setFormato(f)
    setDim({ ...DIMENSIONI_DEFAULT[f] })
  }

  const handleStampa = async () => {
    setLoading(true)
    try {
      const data: any[] = await window.electronAPI.invoke(
        'composti:etichette-data',
        filteredIds
      )
      generaEtichetteComposti(data, dim)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Stima numero totale etichette (basata solo sul conteggio composti, senza fiale)
  const n = filteredIds.length
  const stimaLabel = `Verranno generate etichette per ${n} compost${n === 1 ? 'o' : 'i'}. Per composti con più fiale, verrà stampata una copia per ogni fiala.`

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
              {([
                { id: 'hplc2ml',    label: 'Vial HPLC 2 mL',    default: '35 × 22 mm' },
                { id: 'supelco4ml', label: 'Vial Supelco 4 mL',  default: '45 × 28 mm' },
              ] as { id: FormatoVial; label: string; default: string }[]).map(f => (
                <label
                  key={f.id}
                  className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
                  style={{
                    borderColor: formato === f.id ? 'hsl(var(--primary))' : undefined,
                    backgroundColor: formato === f.id ? 'hsl(var(--primary) / 0.05)' : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="formato-vial"
                    value={f.id}
                    checked={formato === f.id}
                    onChange={() => handleFormatoChange(f.id)}
                  />
                  <div>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">Default: {f.default}</div>
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
                  min={15}
                  max={120}
                  value={dim.larghezza}
                  onChange={e => setDim(d => ({ ...d, larghezza: Number(e.target.value) || d.larghezza }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Altezza</Label>
                <Input
                  type="number"
                  min={10}
                  max={80}
                  value={dim.altezza}
                  onChange={e => setDim(d => ({ ...d, altezza: Number(e.target.value) || d.altezza }))}
                />
              </div>
            </div>
          </div>

          {/* Info scope */}
          <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
            {stimaLabel}
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