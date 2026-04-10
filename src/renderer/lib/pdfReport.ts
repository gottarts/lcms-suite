import type jsPDF from 'jspdf'

// ─────────────────────────────────────────────────────────────────────────────
// pdfReport — helper condivisi per la generazione di PDF in stile uniforme
// al "Quaderno CRM" di ExportDialog.tsx.
//
// Estrazione PASSIVA: questi helper replicano i pattern già usati in
// ExportDialog.tsx senza modificarlo. Il "Quaderno CRM" continua a usare il
// suo codice locale, i nuovi report (Audit CRM, futuri) usano questo modulo.
// ─────────────────────────────────────────────────────────────────────────────

export const PDF_COLORS = {
  headerDark:    [30, 30, 30] as [number, number, number],
  headerMid:     [60, 60, 60] as [number, number, number],
  headerLight:   [100, 100, 100] as [number, number, number],
  rowAlt:        [248, 248, 248] as [number, number, number],
  rowAltSoft:    [250, 250, 250] as [number, number, number],
  labelBg:       [248, 248, 248] as [number, number, number],
  statoAttivo:     [40, 140, 80]  as [number, number, number],
  statoInScadenza: [200, 130, 0]  as [number, number, number],
  statoScaduto:    [200, 60, 60]  as [number, number, number],
  statoDismesso:   [150, 150, 150] as [number, number, number],
  textMuted:     [120, 120, 120] as [number, number, number],
  textBody:      [30, 30, 30]    as [number, number, number],
  divider:       [220, 220, 220] as [number, number, number],
}

export const DEFAULT_MARGINS = { top: 16, left: 14, right: 14, bottom: 14 }

// Dimensioni pagina A4 portrait (mm)
export const PAGE_A4 = { w: 210, h: 297 }

// ─────────────────────────────────────────────────────────────────────────────
// cleanText — sanitizza stringhe per il PDF (rimuove zero-width, freccia →
// diventa newline, tronca caratteri non stampabili).
// Copia fedele di ExportDialog.tsx:22-32.
// ─────────────────────────────────────────────────────────────────────────────
export function cleanText(s: any): string {
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

// ─────────────────────────────────────────────────────────────────────────────
// drawCover — disegna una copertina standard in stile Quaderno CRM:
//   banner scuro in alto con titolo+sottotitolo bianchi, poi data e
//   statistiche centrate sotto.
// ─────────────────────────────────────────────────────────────────────────────
export function drawCover(
  doc: jsPDF,
  opts: {
    title: string
    subtitle?: string
    dateLabel?: string           // es. "Generato il: 09/04/2026"
    stats?: Array<{ label: string; value: string | number }>
    extraLines?: string[]        // righe aggiuntive centrate (es. metodo, data audit)
  },
): void {
  // Banner scuro
  doc.setFillColor(...PDF_COLORS.headerDark)
  doc.rect(0, 0, PAGE_A4.w, 60, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.title, PAGE_A4.w / 2, 30, { align: 'center' })

  if (opts.subtitle) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(opts.subtitle, PAGE_A4.w / 2, 42, { align: 'center' })
  }

  // Corpo copertina
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  let y = 80
  if (opts.dateLabel) {
    doc.text(opts.dateLabel, PAGE_A4.w / 2, y, { align: 'center' })
    y += 8
  }
  if (opts.extraLines) {
    for (const line of opts.extraLines) {
      doc.text(line, PAGE_A4.w / 2, y, { align: 'center' })
      y += 8
    }
  }

  if (opts.stats && opts.stats.length > 0) {
    y += 4
    doc.setFontSize(10)
    const statsLine = opts.stats.map(s => `${s.label}: ${s.value}`).join('   ')
    doc.text(statsLine, PAGE_A4.w / 2, y, { align: 'center' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// drawPageFooter — "pag. N/M" in basso a destra, grigio chiaro.
// ─────────────────────────────────────────────────────────────────────────────
export function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `pag. ${pageNum}/${totalPages}`,
    PAGE_A4.w - DEFAULT_MARGINS.right,
    PAGE_A4.h - 7,
    { align: 'right' },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// drawAllPageFooters — da chiamare a fine generazione per numerare tutte le
// pagine con "pag. N/M".
// ─────────────────────────────────────────────────────────────────────────────
export function drawAllPageFooters(doc: jsPDF): void {
  const total = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    drawPageFooter(doc, i, total)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stili standard per jspdf-autotable — coerenti con ExportDialog.tsx.
// ─────────────────────────────────────────────────────────────────────────────
export const tableBodyStyle = {
  fontSize: 7.5,
  cellPadding: 2,
  overflow: 'linebreak' as const,
}

export const tableHeaderStyle = {
  fillColor: PDF_COLORS.headerDark,
  textColor: 255,
  fontStyle: 'bold' as const,
  fontSize: 7,
}

export const tableAltRowStyle = {
  fillColor: PDF_COLORS.rowAlt,
}
