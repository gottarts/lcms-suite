import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Upload } from 'lucide-react'

// ─── Tipi pubblici ────────────────────────────────────────────────────────────

export interface ImportField {
  key: string       // chiave del campo nel form, es. 'lotto'
  label: string     // etichetta visibile all'utente, es. 'Lotto'
  multi?: boolean   // true = raccoglie tutti i valori della colonna (sep. ;)
}

interface TextImportDialogProps {
  open: boolean
  onClose: () => void
  fields: ImportField[]
  onImport: (values: Record<string, string>) => void
}

// ─── Tipi interni ─────────────────────────────────────────────────────────────

type Step = 'upload' | 'sheet' | 'preview' | 'mapping'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellToString(val: unknown): string {
  if (val == null) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val).trim()
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TextImportDialog({ open, onClose, fields, onImport }: TextImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [originCell, setOriginCell] = useState<{ r: number; c: number } | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})  // colonna → fieldKey
  const [errorMsg, setErrorMsg] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Reset completo ──────────────────────────────────────────────────────────

  function handleClose() {
    setStep('upload')
    setRawRows([])
    setSheetNames([])
    setWorkbook(null)
    setOriginCell(null)
    setHeaders([])
    setDataRows([])
    setMapping({})
    setErrorMsg('')
    onClose()
  }

  // ── Caricamento file ────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const wb = XLSX.read(data, { type: 'binary', cellDates: true })

        if (wb.SheetNames.length > 1) {
          setWorkbook(wb)
          setSheetNames(wb.SheetNames)
          setStep('sheet')
        } else {
          processSheet(wb.Sheets[wb.SheetNames[0]])
        }
      } catch {
        setErrorMsg('Impossibile leggere il file. Assicurati che sia un CSV o Excel valido.')
      }
    }
    reader.readAsBinaryString(file)
  }

  function handleSheetSelect(name: string) {
    if (!workbook) return
    processSheet(workbook.Sheets[name])
  }

  function processSheet(ws: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      cellDates: true,
      defval: null,
    }) as unknown[][]

    if (rows.length === 0) {
      setErrorMsg('Il foglio sembra vuoto.')
      return
    }

    // Calcola il numero massimo di colonne per uniformare le righe
    const maxCols = rows.reduce((m, r) => Math.max(m, (r as unknown[]).length), 0)

    const normalized: string[][] = rows.map(row =>
      Array.from({ length: maxCols }, (_, i) => cellToString((row as unknown[])[i]))
    )

    setRawRows(normalized)
    setOriginCell(null)
    setStep('preview')
  }

  // ── Selezione cella di origine ──────────────────────────────────────────────

  function handleCellClick(r: number, c: number) {
    setOriginCell({ r, c })
  }

  function applyOrigin() {
    if (!originCell) return
    const { r, c } = originCell

    // La riga r, dalla colonna c in poi, è l'intestazione
    const hs = rawRows[r]
      .slice(c)
      .map(h => h.trim())
      .filter(h => h !== '')

    if (hs.length === 0) return

    // Le righe successive sono i dati (solo quelle non completamente vuote)
    const dRows = rawRows
      .slice(r + 1)
      .filter(row => row.some(cell => cell !== ''))
      .map(row => row.slice(c, c + hs.length).map(cell => cell.trim()))

    setHeaders(hs)
    setDataRows(dRows)
    setMapping({})
    setStep('mapping')
  }

  // ── Importazione ────────────────────────────────────────────────────────────

  function handleImport() {
    const result: Record<string, string> = {}

    // Filtra righe senza nome (colonna mappata a 'nomi')
    const nomiColName = Object.entries(mapping).find(([, v]) => v === 'nomi')?.[0]
    const nomiColIdx = nomiColName ? headers.indexOf(nomiColName) : -1
    const filteredRows = nomiColIdx >= 0
      ? dataRows.filter(row => (row[nomiColIdx] ?? '').trim() !== '')
      : dataRows

    for (const [colName, fieldKey] of Object.entries(mapping)) {
      if (!fieldKey || fieldKey === '_skip') continue

      const colIdx = headers.indexOf(colName)
      if (colIdx === -1) continue

      const field = fields.find(f => f.key === fieldKey)

      if (field?.multi || fieldKey === 'nomi') {
        // Raccoglie TUTTI i valori non vuoti della colonna, uniti da ;
        const valori = filteredRows
          .map(row => row[colIdx]?.trim())
          .filter(Boolean)
        result[fieldKey] = valori.join(';')
      } else {
        // Prende il valore dalla prima riga dati non vuota
        const val = filteredRows.find(row => row[colIdx]?.trim())?.[colIdx] ?? ''
        result[fieldKey] = val.trim()
      }
    }

    onImport(result)
    handleClose()
  }

  // ── Helpers visivi ──────────────────────────────────────────────────────────

  function cellClass(r: number, c: number): string {
    if (!originCell) return 'hover:bg-accent cursor-pointer'

    const { r: or, c: oc } = originCell

    if (r === or && c === oc) {
      // Cella selezionata
      return 'bg-primary text-primary-foreground cursor-pointer font-semibold'
    }
    if (r === or && c > oc) {
      // Stessa riga, colonne a destra → diventano intestazioni
      return 'bg-primary/20 cursor-pointer'
    }
    if (r < or) {
      // Righe sopra → ignorate
      return 'bg-muted/60 text-muted-foreground cursor-pointer opacity-50'
    }
    // Righe dati
    return 'hover:bg-accent cursor-pointer'
  }

  const hasAnyMapping = Object.values(mapping).some(v => v && v !== '_skip')

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa da file</DialogTitle>
        </DialogHeader>

        {/* ── STEP: UPLOAD ── */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            {errorMsg && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                {errorMsg}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Seleziona un file <strong>.csv</strong> o <strong>.xlsx</strong> da cui importare i dati.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
            </div>
          </div>
        )}

        {/* ── STEP: SELEZIONE FOGLIO ── */}
        {step === 'sheet' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Il file contiene <strong>{sheetNames.length} fogli</strong>. Quale vuoi importare?
            </p>
            <div className="flex flex-col gap-2">
              {sheetNames.map(name => (
                <Button
                  key={name}
                  variant="outline"
                  className="justify-start text-left"
                  onClick={() => handleSheetSelect(name)}
                >
                  📄 {name}
                </Button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW — selezione cella di origine ── */}
        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <p className="font-medium mb-1">📍 Seleziona la cella di inizio tabella</p>
              <p>Clicca sulla cella che contiene la <strong>prima intestazione di colonna</strong> (es. "NAME", "LOT N.", ecc.).
              Quella riga diventerà l'intestazione — le righe sopra verranno ignorate.</p>
            </div>

            {/* Griglia anteprima file */}
            <div className="overflow-auto border rounded-md max-h-96">
              <table className="text-xs border-collapse w-full">
                <tbody>
                  {rawRows.map((row, r) => (
                    <tr key={r}>
                      {/* Numero riga */}
                      <td className="px-1 py-0.5 text-muted-foreground bg-muted/40 border border-border text-right select-none w-8 font-mono">
                        {r + 1}
                      </td>
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          onClick={() => handleCellClick(r, c)}
                          className={`px-2 py-1 border border-border whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis select-none transition-colors ${cellClass(r, c)}`}
                          title={cell}
                        >
                          {cell || <span className="text-muted-foreground/40">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {originCell && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
                ✓ Cella selezionata: riga {originCell.r + 1}, colonna {originCell.c + 1}
                {' — '}
                <strong>{rawRows[originCell.r]?.[originCell.c] || '(vuota)'}</strong>
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
              <Button onClick={applyOrigin} disabled={!originCell}>
                Continua →
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STEP: MAPPATURA COLONNE ── */}
        {step === 'mapping' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Trovate <strong>{headers.length} colonne</strong> e <strong>{dataRows.length} righe</strong> di dati.
              Per ogni colonna del file, scegli a quale campo del form corrisponde (o lascia "— Ignora —").
            </p>

            {/* Tabella mappatura */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {headers.map((h, i) => (
                <div key={`${h}-${i}`} className="flex items-center gap-3 bg-muted/30 rounded px-3 py-2">
                  {/* Nome colonna dal file */}
                  <span
                    className="text-xs font-mono w-40 shrink-0 truncate text-foreground"
                    title={h}
                  >
                    {h || <span className="text-muted-foreground italic">(vuota)</span>}
                  </span>

                  <span className="text-muted-foreground text-xs">→</span>

                  {/* Select campo destinazione */}
                  <Select
                    value={mapping[h] ?? '_skip'}
                    onValueChange={v => setMapping(prev => ({ ...prev, [h]: v }))}
                  >
                    <SelectTrigger className="flex-1 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">— Ignora —</SelectItem>
                      {fields.map(f => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}{f.multi ? ' ⁽ˡⁱˢᵗᵃ⁾' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Anteprima prime 3 righe */}
            {dataRows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Anteprima dati (prime 3 righe)
                </p>
                <div className="overflow-auto border rounded-md">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/60">
                        {headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-2 py-1 text-left border border-border font-mono font-medium truncate max-w-[140px]"
                            title={h}
                          >
                            {h || '—'}
                            {mapping[h] && mapping[h] !== '_skip' && (
                              <span className="ml-1 text-blue-600 font-sans font-normal">
                                ({fields.find(f => f.key === mapping[h])?.label ?? mapping[h]})
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.slice(0, 3).map((row, r) => (
                        <tr key={r} className={r % 2 === 0 ? '' : 'bg-muted/20'}>
                          {row.map((cell, c) => (
                            <td
                              key={c}
                              className="px-2 py-1 border border-border truncate max-w-[140px]"
                              title={cell}
                            >
                              {cell || <span className="text-muted-foreground/40">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('preview')}>← Indietro</Button>
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
              <Button onClick={handleImport} disabled={!hasAnyMapping}>
                <Upload className="h-4 w-4 mr-1" /> Importa
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}