import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { metodoAnalitiApi } from '@/lib/api'

// ---------------------------------------------------------------------------
// Algoritmo fuzzy Levenshtein
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[\s\-_,./()[\]]/g, '')
}

function similarity(a: string, b: string): number {
  const na = normalizeStr(a), nb = normalizeStr(b)
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

type MatchStatus = 'auto' | 'suggest' | 'unmatched'

interface MappedRow {
  source: string        // nome nel file
  matched: string | null  // nome analita interno scelto
  score: number
  status: MatchStatus
  alias_lims: string | null
  alias_oqlab: string | null
  alias_strumento: string | null
}

function automap(fileRows: string[], analiti: string[]): MappedRow[] {
  return fileRows.map(source => {
    if (!source.trim()) return { source, matched: null, score: 0, status: 'unmatched', alias_lims: null, alias_oqlab: null, alias_strumento: null }
    let best = 0, bestName: string | null = null
    for (const nome of analiti) {
      const s = similarity(source, nome)
      if (s > best) { best = s; bestName = nome }
    }
    const status: MatchStatus = best >= 0.85 ? 'auto' : best >= 0.60 ? 'suggest' : 'unmatched'
    return {
      source,
      matched: status !== 'unmatched' ? bestName : null,
      score: best,
      status,
      alias_lims: null,
      alias_oqlab: null,
      alias_strumento: null,
    }
  })
}

// ---------------------------------------------------------------------------
// Tipi step
// ---------------------------------------------------------------------------

type Step = 'upload' | 'sheet' | 'mapping' | 'review' | 'importing' | 'done' | 'error'

type AliasColTarget = 'alias_lims' | 'alias_oqlab' | 'alias_strumento' | '_skip'

interface ColMapping {
  sourceCol: string     // colonna del file per i nomi analiti
  aliasLims: string | null
  aliasOqlab: string | null
  aliasStrumento: string | null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AliasImportDialogProps {
  open: boolean
  metodoId: string
  analiti: string[]     // nomi analiti interni del metodo
  onClose: () => void
  onSaved: () => void
}

export function AliasImportDialog({ open, metodoId, analiti, onClose, onSaved }: AliasImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [errorMsg, setErrorMsg] = useState('')

  // Dati file
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])

  // Mapping colonne
  const [colMapping, setColMapping] = useState<ColMapping>({ sourceCol: '', aliasLims: null, aliasOqlab: null, aliasStrumento: null })

  // Righe mappate per review
  const [mapped, setMapped] = useState<MappedRow[]>([])
  const [autoExpanded, setAutoExpanded] = useState(false)
  const [importCount, setImportCount] = useState(0)

  function reset() {
    setStep('upload')
    setErrorMsg('')
    setWorkbook(null)
    setSheetNames([])
    setHeaders([])
    setRows([])
    setColMapping({ sourceCol: '', aliasLims: null, aliasOqlab: null, aliasStrumento: null })
    setMapped([])
    setAutoExpanded(false)
    setImportCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ---------------------------------------------------------------------------
  // Step: upload
  // ---------------------------------------------------------------------------

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        setWorkbook(wb)
        if (wb.SheetNames.length === 1) {
          loadSheet(wb, wb.SheetNames[0])
        } else {
          setSheetNames(wb.SheetNames)
          setStep('sheet')
        }
      } catch {
        setErrorMsg('Impossibile leggere il file. Assicurati che sia un file Excel (.xlsx) o CSV valido.')
        setStep('error')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function loadSheet(wb: XLSX.WorkBook, sheetName: string) {
    const ws = wb.Sheets[sheetName]
    const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][]
    if (raw.length < 2) {
      setErrorMsg('Il foglio sembra vuoto o ha solo l\'intestazione.')
      setStep('error')
      return
    }
    const hdrs = (raw[0] as unknown[]).map(h => String(h ?? '').trim())
    const dataRows = raw.slice(1).map(r => hdrs.map((_, i) => String((r as unknown[])[i] ?? '').trim()))
    setHeaders(hdrs)
    setRows(dataRows)
    // Autoselect colonna sorgente: prima colonna non vuota
    const firstNonEmpty = hdrs.find(h => h) ?? ''
    setColMapping({ sourceCol: firstNonEmpty, aliasLims: null, aliasOqlab: null, aliasStrumento: null })
    setStep('mapping')
  }

  // ---------------------------------------------------------------------------
  // Step: mapping → review
  // ---------------------------------------------------------------------------

  function handleProceedToReview() {
    if (!colMapping.sourceCol) return
    const sourceIdx = headers.indexOf(colMapping.sourceCol)
    if (sourceIdx === -1) return
    const fileNomi = rows.map(r => r[sourceIdx]).filter(v => v.trim())
    const limsIdx = colMapping.aliasLims ? headers.indexOf(colMapping.aliasLims) : -1
    const oqlabIdx = colMapping.aliasOqlab ? headers.indexOf(colMapping.aliasOqlab) : -1
    const strIdx = colMapping.aliasStrumento ? headers.indexOf(colMapping.aliasStrumento) : -1
    const base = automap(fileNomi, analiti)
    // Arricchisci con i valori alias dal file
    const enriched = base.map((m, i) => {
      const rowIdx = rows.findIndex(r => r[sourceIdx] === fileNomi[i])
      const row = rowIdx >= 0 ? rows[rowIdx] : []
      return {
        ...m,
        alias_lims: limsIdx >= 0 ? (row[limsIdx]?.trim() || null) : null,
        alias_oqlab: oqlabIdx >= 0 ? (row[oqlabIdx]?.trim() || null) : null,
        alias_strumento: strIdx >= 0 ? (row[strIdx]?.trim() || null) : null,
      }
    })
    setMapped(enriched)
    setStep('review')
  }

  // ---------------------------------------------------------------------------
  // Step: review — modifica match
  // ---------------------------------------------------------------------------

  function updateMatch(idx: number, newMatched: string | null) {
    setMapped(prev => prev.map((m, i) => {
      if (i !== idx) return m
      const status: MatchStatus = newMatched ? 'auto' : 'unmatched'
      return { ...m, matched: newMatched, status }
    }))
  }

  // ---------------------------------------------------------------------------
  // Step: import
  // ---------------------------------------------------------------------------

  async function handleImport() {
    setStep('importing')
    const confirmed = mapped.filter(m => m.matched)
    const updates = confirmed.map(m => ({
      nome: m.matched!,
      ...(m.alias_lims !== null ? { alias_lims: m.alias_lims } : {}),
      ...(m.alias_oqlab !== null ? { alias_oqlab: m.alias_oqlab } : {}),
      ...(m.alias_strumento !== null ? { alias_strumento: m.alias_strumento } : {}),
    }))
    try {
      await metodoAnalitiApi.bulkUpdateAlias(metodoId, updates)
      setImportCount(updates.length)
      setStep('done')
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Errore durante il salvataggio.')
      setStep('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const autoRows = mapped.filter(m => m.status === 'auto')
  const reviewRows = mapped.filter(m => m.status !== 'auto')
  const confirmableCount = mapped.filter(m => m.matched).length

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">Importa alias da file</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Carica un file CSV o Excel da LIMS/OQLab per mappare automaticamente gli alias degli analiti.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* STEP: upload */}
          {step === 'upload' && (
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <p className="text-sm font-medium mb-1">Trascina un file qui oppure clicca per selezionarlo</p>
              <p className="text-xs text-muted-foreground">Formati supportati: .xlsx, .xls, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {/* STEP: sheet */}
          {step === 'sheet' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Seleziona il foglio da importare</p>
              <div className="grid gap-2">
                {sheetNames.map(name => (
                  <button
                    key={name}
                    onClick={() => loadSheet(workbook!, name)}
                    className="text-left px-4 py-2 rounded-md border hover:bg-muted text-sm font-mono"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP: mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Associa le colonne del file ai campi del DB</p>
              <div className="grid gap-3">
                <ColSelect
                  label="Colonna nomi analiti (sorgente)"
                  required
                  headers={headers}
                  value={colMapping.sourceCol}
                  onChange={v => setColMapping(prev => ({ ...prev, sourceCol: v }))}
                  skipOption={false}
                />
                <ColSelect
                  label="Colonna Alias LIMS"
                  headers={headers}
                  value={colMapping.aliasLims ?? '_skip'}
                  onChange={v => setColMapping(prev => ({ ...prev, aliasLims: v === '_skip' ? null : v }))}
                  skipOption
                />
                <ColSelect
                  label="Colonna Alias OQLab"
                  headers={headers}
                  value={colMapping.aliasOqlab ?? '_skip'}
                  onChange={v => setColMapping(prev => ({ ...prev, aliasOqlab: v === '_skip' ? null : v }))}
                  skipOption
                />
                <ColSelect
                  label="Colonna Alias Strumento"
                  headers={headers}
                  value={colMapping.aliasStrumento ?? '_skip'}
                  onChange={v => setColMapping(prev => ({ ...prev, aliasStrumento: v === '_skip' ? null : v }))}
                  skipOption
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Anteprima: {rows.length} righe dati trovate nel file.
              </p>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Auto ({autoRows.length})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Da verificare ({reviewRows.filter(m => m.status === 'suggest').length})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Non mappati ({reviewRows.filter(m => m.status === 'unmatched').length})</span>
              </div>

              {/* Righe da verificare / non mappate */}
              {reviewRows.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Nome nel file</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Analita interno</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Alias LIMS</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Alias OQLab</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reviewRows.map((m, localIdx) => {
                        const globalIdx = mapped.indexOf(m)
                        return (
                          <ReviewRow
                            key={m.source + localIdx}
                            row={m}
                            analiti={analiti}
                            onChange={newMatched => updateMatch(globalIdx, newMatched)}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mappati automaticamente (collassati) */}
              {autoRows.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <button
                    className="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 text-xs font-semibold text-muted-foreground"
                    onClick={() => setAutoExpanded(v => !v)}
                  >
                    <span>Mappati automaticamente ({autoRows.length})</span>
                    <span>{autoExpanded ? '▲' : '▼'}</span>
                  </button>
                  {autoExpanded && (
                    <table className="w-full text-xs">
                      <tbody className="divide-y">
                        {autoRows.map((m, i) => (
                          <tr key={m.source + i} className="hover:bg-muted/20">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{m.source}</td>
                            <td className="px-3 py-1.5 font-mono text-green-700 dark:text-green-400">{m.matched}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{m.alias_lims ?? '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{m.alias_oqlab ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP: importing */}
          {step === 'importing' && (
            <div className="py-8 text-center text-sm text-muted-foreground">Salvataggio in corso…</div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">Import completato</p>
              <p className="text-xs text-muted-foreground">{importCount} analiti aggiornati.</p>
            </div>
          )}

          {/* STEP: error */}
          {step === 'error' && (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm font-semibold text-destructive">Errore</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            </div>
          )}

        </div>

        <DialogFooter className="px-6 py-3 border-t flex items-center gap-2">
          {step === 'done' ? (
            <Button size="sm" onClick={() => { onSaved() }}>Chiudi</Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={handleClose}>Annulla</Button>
              {step === 'mapping' && (
                <Button size="sm" onClick={handleProceedToReview} disabled={!colMapping.sourceCol}>
                  Avanti — Revisione mappatura
                </Button>
              )}
              {step === 'review' && (
                <Button size="sm" onClick={handleImport} disabled={confirmableCount === 0}>
                  Importa {confirmableCount} analiti
                </Button>
              )}
              {step === 'error' && (
                <Button size="sm" variant="outline" onClick={reset}>Riprova</Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Sottocomponenti
// ---------------------------------------------------------------------------

function ColSelect({
  label,
  required,
  headers,
  value,
  onChange,
  skipOption,
}: {
  label: string
  required?: boolean
  headers: string[]
  value: string
  onChange: (v: string) => void
  skipOption: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-52 text-xs text-muted-foreground shrink-0">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs flex-1">
          <SelectValue placeholder="Seleziona colonna…" />
        </SelectTrigger>
        <SelectContent>
          {skipOption && <SelectItem value="_skip" className="text-xs text-muted-foreground">— Ignora —</SelectItem>}
          {headers.filter(h => h).map(h => (
            <SelectItem key={h} value={h} className="text-xs font-mono">{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ReviewRow({
  row,
  analiti,
  onChange,
}: {
  row: MappedRow
  analiti: string[]
  onChange: (matched: string | null) => void
}) {
  const statusColor =
    row.status === 'suggest' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
    row.status === 'unmatched' ? 'bg-red-50 dark:bg-red-900/20' : ''

  return (
    <tr className={`${statusColor} hover:brightness-95`}>
      <td className="px-3 py-2 font-mono">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${row.status === 'suggest' ? 'bg-yellow-500' : 'bg-red-500'}`} />
          {row.source}
        </span>
      </td>
      <td className="px-3 py-2">
        <Select value={row.matched ?? '_none'} onValueChange={v => onChange(v === '_none' ? null : v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="— Non mappato —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none" className="text-xs text-muted-foreground">— Non mappato —</SelectItem>
            {analiti.map(nome => (
              <SelectItem key={nome} value={nome} className="text-xs font-mono">{nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{row.alias_lims ?? '—'}</td>
      <td className="px-3 py-2 text-muted-foreground">{row.alias_oqlab ?? '—'}</td>
    </tr>
  )
}
