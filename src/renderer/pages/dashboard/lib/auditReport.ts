import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  PDF_COLORS,
  DEFAULT_MARGINS,
  PAGE_A4,
  cleanText,
  drawCover,
  drawAllPageFooters,
  tableBodyStyle,
  tableHeaderStyle,
  tableAltRowStyle,
} from '../../../lib/pdfReport'
import type { AuditModel, AuditWorkRow } from './auditModel'
import type { StatoLab } from '../../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// auditReport — genera il PDF "Audit CRM" dato un AuditModel costruito dal
// renderer (buildAuditModel). Stile omogeneo al Quaderno CRM.
// ─────────────────────────────────────────────────────────────────────────────

function statoLabel(s: StatoLab | null): string {
  if (!s) return '—'
  if (s === 'attiva') return 'Valida'
  if (s === 'in_scadenza') return 'In scadenza'
  if (s === 'scaduta') return 'Scaduta'
  if (s === 'non_preparata') return 'Non preparata'
  return s
}

function statoColor(s: StatoLab | null): [number, number, number] {
  if (s === 'scaduta') return PDF_COLORS.statoScaduto
  if (s === 'in_scadenza') return PDF_COLORS.statoInScadenza
  if (s === 'attiva') return PDF_COLORS.statoAttivo
  return PDF_COLORS.statoDismesso
}

function formatItDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function exportAuditPdf(model: AuditModel): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const oggi = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  // ── COPERTINA ────────────────────────────────────────────────────────────
  drawCover(doc, {
    title: 'Audit CRM',
    subtitle: 'Copertura analiti accreditati',
    dateLabel: `Generato il: ${oggi}`,
    extraLines: [
      `Metodo: ${model.metodo_nome ?? model.metodo_id}`,
      `Data audit: ${formatItDate(model.data)}`,
    ],
    stats: [
      { label: 'Accreditati', value: model.stats.n_accreditati },
      { label: 'Coperti', value: model.stats.n_coperti },
      { label: 'Scoperti', value: model.stats.n_scoperti },
      { label: 'Work', value: model.stats.n_works },
    ],
  })

  // Nota dettaglio stato work
  if (model.stats.n_works > 0) {
    doc.setFontSize(9)
    doc.setTextColor(...PDF_COLORS.textMuted)
    doc.text(
      `Work: ${model.stats.n_work_scadute} scadute · ${model.stats.n_work_in_scadenza} in scadenza · ${model.stats.n_work_bloccate} bloccate`,
      PAGE_A4.w / 2,
      120,
      { align: 'center' },
    )
  }

  // ── SOMMARIO WORK ────────────────────────────────────────────────────────
  doc.addPage()
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PDF_COLORS.textBody)
  doc.text('Sommario Work registrati', DEFAULT_MARGINS.left, DEFAULT_MARGINS.top)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...PDF_COLORS.textMuted)
  doc.text(
    `${model.righe_work.length} work · metodo ${model.metodo_id}`,
    DEFAULT_MARGINS.left,
    DEFAULT_MARGINS.top + 6,
  )

  if (model.righe_work.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...PDF_COLORS.textBody)
    doc.text(
      'Nessun Work registrato per questo metodo.',
      DEFAULT_MARGINS.left,
      DEFAULT_MARGINS.top + 16,
    )
  } else {
    autoTable(doc, {
      startY: DEFAULT_MARGINS.top + 10,
      head: [['Work', 'Scadenza', 'Stato', 'Analiti coperti', 'Flag']],
      body: model.righe_work.map(w => [
        cleanText(w.work_nome),
        w.work_scadenza ?? '—',
        statoLabel(w.stato_work),
        String(w.analiti_coperti.length),
        [w.bloccata ? 'BLOCC' : null, w.ha_crm_scaduti ? 'CRM SCAD' : null]
          .filter(Boolean).join(' · ') || '—',
      ]),
      styles: tableBodyStyle,
      headStyles: tableHeaderStyle,
      alternateRowStyles: tableAltRowStyle,
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 24 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 'auto' },
      },
    })
  }

  // ── SCHEDE WORK ──────────────────────────────────────────────────────────
  for (const w of model.righe_work) {
    doc.addPage()
    drawWorkSheet(doc, w)
  }

  // ── SEZIONE SCOPERTI ─────────────────────────────────────────────────────
  if (model.righe_scoperte.length > 0) {
    doc.addPage()

    doc.setFillColor(245, 235, 235)
    doc.rect(0, 0, PAGE_A4.w, 22, 'F')
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_COLORS.statoScaduto)
    doc.text('Analiti scoperti', DEFAULT_MARGINS.left, 13)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.textMuted)
    doc.text(
      `${model.righe_scoperte.length} analiti non coperti da alcun Work registrato`,
      DEFAULT_MARGINS.left,
      19,
    )

    autoTable(doc, {
      startY: 28,
      head: [['Analita', 'Alias strumento', 'CRM validi disponibili']],
      body: model.righe_scoperte.map(r => [
        cleanText(r.analita_nome),
        r.alias_strumento ?? '—',
        r.crm_disponibili.length === 0
          ? '⚠ nessun CRM valido'
          : r.crm_disponibili
              .map(c => `${cleanText(c.composto_nome)}${c.lotto ? ` (${c.lotto})` : ''}${c.scadenza_effettiva ? ` · scad. ${c.scadenza_effettiva}` : ''}`)
              .join('\n'),
      ]),
      styles: { ...tableBodyStyle, minCellHeight: 7 },
      headStyles: { ...tableHeaderStyle, fillColor: PDF_COLORS.statoScaduto },
      alternateRowStyles: tableAltRowStyle,
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 36 },
        2: { cellWidth: 'auto' },
      },
    })
  }

  // Footer pagine
  drawAllPageFooters(doc)

  doc.save(`audit-crm-${model.metodo_id}-${model.data}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// drawWorkSheet — scheda singola di un Work: header colorato, anagrafica,
// tabella analiti coperti con CRM sottostanti.
// ─────────────────────────────────────────────────────────────────────────────
function drawWorkSheet(doc: jsPDF, w: AuditWorkRow): void {
  // Banner con stato
  doc.setFillColor(245, 245, 245)
  doc.rect(0, 0, PAGE_A4.w, 28, 'F')

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PDF_COLORS.textBody)
  doc.text(cleanText(w.work_nome) || 'Work', DEFAULT_MARGINS.left, 11)

  // Badge stato
  const col = statoColor(w.stato_work)
  doc.setFillColor(col[0], col[1], col[2])
  doc.roundedRect(DEFAULT_MARGINS.left, 14, 32, 7, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text(
    statoLabel(w.stato_work).toUpperCase(),
    DEFAULT_MARGINS.left + 16,
    19,
    { align: 'center' },
  )

  // Flag bloccata / crm scaduti
  let flagX = DEFAULT_MARGINS.left + 34
  if (w.bloccata) {
    doc.setFillColor(...PDF_COLORS.statoScaduto)
    doc.roundedRect(flagX, 14, 22, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text('BLOCCATA', flagX + 11, 19, { align: 'center' })
    flagX += 24
  }
  if (w.ha_crm_scaduti) {
    doc.setFillColor(...PDF_COLORS.statoInScadenza)
    doc.roundedRect(flagX, 14, 26, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text('CRM SCADUTI', flagX + 13, 19, { align: 'center' })
  }

  doc.setTextColor(80, 80, 80)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Scadenza work: ${w.work_scadenza ?? '—'}   |   Analiti coperti: ${w.analiti_coperti.length}`,
    DEFAULT_MARGINS.left + 64,
    19,
  )

  doc.setDrawColor(...PDF_COLORS.divider)
  doc.line(DEFAULT_MARGINS.left, 29, PAGE_A4.w - DEFAULT_MARGINS.right, 29)

  // Tabella analiti coperti
  if (w.analiti_coperti.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...PDF_COLORS.textMuted)
    doc.setFont('helvetica', 'italic')
    doc.text(
      'Nessun analita accreditato coperto da questo Work.',
      DEFAULT_MARGINS.left,
      40,
    )
    return
  }

  autoTable(doc, {
    startY: 33,
    head: [['Analita', 'Alias strumento', 'CRM sottostanti (nome · lotto · scadenza)']],
    body: w.analiti_coperti.map(a => [
      cleanText(a.analita_nome),
      a.alias_strumento ?? '—',
      a.crm_ingredienti.length === 0
        ? '—'
        : a.crm_ingredienti
            .map(c => `${cleanText(c.composto_nome)}${c.lotto ? ` · ${c.lotto}` : ''}${c.scadenza_effettiva ? ` · ${c.scadenza_effettiva}` : ''}`)
            .join('\n'),
    ]),
    styles: { ...tableBodyStyle, minCellHeight: 6 },
    headStyles: tableHeaderStyle,
    alternateRowStyles: tableAltRowStyle,
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 34 },
      2: { cellWidth: 'auto' },
    },
  })
}
