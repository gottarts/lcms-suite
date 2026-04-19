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

export function exportAuditPdf(model: AuditModel, crmData: any[] = []): void {
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
      { label: 'CRM', value: crmData.length },
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
        [w.bloccata ? 'BLOCC' : null, w.ha_crm_scaduti ? 'CRM SCAD' : null, w.ha_prep_scadute_at_data ? (w.ha_prep_scadute_solo_non_accreditati ? 'PREP SCAD (non accr.)' : 'PREP SCAD') : null]
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

  // ── SEZIONE CRM COINVOLTI (identica al Quaderno CRM di ExportDialog) ────────
  if (crmData.length > 0) {
    doc.addPage()
    doc.setFillColor(30, 30, 30)
    doc.rect(0, 0, PAGE_A4.w, 22, 'F')
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('CRM coinvolti nell\'audit', DEFAULT_MARGINS.left, 13)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(200, 200, 200)
    doc.text(
      `${crmData.length} CRM · metodo ${model.metodo_id} · data ${formatItDate(model.data)}`,
      DEFAULT_MARGINS.left,
      19,
    )

    // Sommario
    autoTable(doc, {
      startY: 26,
      head: [['Nome', 'Codice', 'Classe', 'Forma', 'Produttore', 'Lotto', 'Scadenza', 'Stato']],
      body: crmData.map(c => [
        c.nome ?? '',
        c.codice_interno ?? '',
        c.classe ?? '',
        c.forma ?? '',
        c.produttore ?? '',
        c.lotto ?? '',
        c.scadenza_prodotto ?? '',
        crmStatoLabelFromData(c),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 42 }, 7: { cellWidth: 20 } },
    })

    // Schede individuali — identiche al Quaderno CRM
    for (const c of crmData) {
      doc.addPage()
      drawCrmFullSheet(doc, c)
    }
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
// Helpers CRM (stesso stile di ExportDialog.tsx)
// ─────────────────────────────────────────────────────────────────────────────
function crmStatoLabelFromData(c: any): string {
  if (c.data_dismissione) return 'Dismesso'
  if (c.scadenza_prodotto && new Date(c.scadenza_prodotto) < new Date()) return 'Scaduto'
  const diffGiorni = c.scadenza_prodotto
    ? Math.ceil((new Date(c.scadenza_prodotto).getTime() - Date.now()) / 86400000)
    : null
  if (diffGiorni !== null && diffGiorni <= 30) return 'In scadenza'
  return 'Attivo'
}

function metodiToString(c: any): string {
  if (!c.metodi || !Array.isArray(c.metodi) || c.metodi.length === 0) return ''
  return c.metodi.map((m: any) => m.nome ?? m).join('; ')
}

// ─────────────────────────────────────────────────────────────────────────────
// drawCrmFullSheet — scheda completa CRM identica al Quaderno CRM (ExportDialog)
// ─────────────────────────────────────────────────────────────────────────────
function drawCrmFullSheet(doc: jsPDF, c: any): void {
  const statoLabel = crmStatoLabelFromData(c)
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
    ['Forma', c.forma ?? '—', 'Nome CRM', c.forma_commerciale ?? '—'],
    ['Concentrazione', c.concentrazione ? `${c.concentrazione} ${c.unita_conc ?? ''}` : '—', 'Solvente', c.solvente ?? '—'],
    ['Purezza', c.purezza ?? '—', 'N fiale', c.fiala ?? '—'],
    ['Data apertura', c.data_apertura ?? '—', 'Data dismissione', c.data_dismissione ?? '—'],
    ['Destinazione uso', c.destinazione_uso ?? '—', 'Stoccaggio', c.stoccaggio ?? '—'],
    ['Accreditamento CRM', c.accreditamento_crm ?? '—', '', ''],
    ['Ubicazione', c.ubicazione ?? '—', 'Matrice', c.matrice ?? '—'],
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
    flagX += 28
  }
  if (w.ha_prep_scadute_at_data) {
    doc.setFillColor(...PDF_COLORS.statoInScadenza)
    const prepLabel = w.ha_prep_scadute_solo_non_accreditati ? 'PREP SCAD (non accr.)' : 'PREP SCADUTE'
    const prepWidth = w.ha_prep_scadute_solo_non_accreditati ? 40 : 28
    doc.roundedRect(flagX, 14, prepWidth, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(prepLabel, flagX + prepWidth / 2, 19, { align: 'center' })
  }

  doc.setTextColor(80, 80, 80)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${w.work_codice ? `${w.work_codice}   |   ` : ''}Scadenza: ${w.work_scadenza ?? '—'}   |   Analiti coperti: ${w.analiti_coperti.length}`,
    PAGE_A4.w - DEFAULT_MARGINS.right,
    19,
    { align: 'right' },
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
            .map(c => {
              let riga = `${cleanText(c.composto_nome)}${c.lotto ? ` · ${c.lotto}` : ''}${c.scadenza_effettiva ? ` · scad. ${c.scadenza_effettiva}` : ''}`
              if (c.prep_flacone != null) {
                riga += `\n  prep #${c.prep_progressivo ?? '?'}${c.prep_data_prep ? ` · ${c.prep_data_prep}` : ''}${c.prep_scadenza ? ` · scad. ${c.prep_scadenza}` : ''}${c.prep_scaduta ? ' [SCADUTA]' : ''}`
              }
              return riga
            })
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
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 2) {
        const analita = w.analiti_coperti[data.row.index]
        if (analita?.crm_ingredienti.some(c => c.prep_scaduta)) {
          data.cell.styles.fillColor = [255, 235, 235]
        }
      }
    },
  })
}
