import React, { useState, useRef } from 'react'
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

type MatchStatus = 'auto' | 'suggest' | 'unmatched' | 'new'

interface MappedRow {
  source: string                   // etichetta riga (valParametro ?? valLims ?? valOqlab)
  matched: string | null           // nome parametro interno (esistente o nuovo)
  score: number
  status: MatchStatus
  isNew: boolean                   // true se matched sarà creato via add()
  alias_lims: string | null
  alias_oqlab: string | null
  alias_strumento: string | null
}

function bestFuzzy(source: string, analiti: string[]): { name: string | null; score: number } {
  let best = 0
  let bestName: string | null = null
  for (const nome of analiti) {
    const s = similarity(source, nome)
    if (s > best) { best = s; bestName = nome }
  }
  return { name: bestName, score: best }
}

// ---------------------------------------------------------------------------
// Tipi step
// ---------------------------------------------------------------------------

type Step = 'upload' | 'sheet' | 'mapping' | 'review' | 'importing' | 'done' | 'error'

interface ColMapping {
  nomeParametro: string | null  // quando presente, comanda (match esatto + crea se manca)
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
  const [allRows, setAllRows] = useState<string[][]>([])   // tutte le righe raw, inclusa eventuale intestazione
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])

  // Mapping colonne
  const [colMapping, setColMapping] = useState<ColMapping>({ nomeParametro: null, aliasLims: null, aliasOqlab: null, aliasStrumento: null })

  // Righe mappate per review
  const [mapped, setMapped] = useState<MappedRow[]>([])
  const [autoExpanded, setAutoExpanded] = useState(false)
  const [importCount, setImportCount] = useState<{ updated: number; created: number }>({ updated: 0, created: 0 })

  function reset() {
    setStep('upload')
    setErrorMsg('')
    setWorkbook(null)
    setSheetNames([])
    setHeaders([])
    setRows([])
    setAllRows([])
    setColMapping({ nomeParametro: null, aliasLims: null, aliasOqlab: null, aliasStrumento: null })
    setMapped([])
    setAutoExpanded(false)
    setImportCount({ updated: 0, created: 0 })
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
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][]
    if (raw.length === 0) {
      setErrorMsg('Il foglio sembra vuoto.')
      setStep('error')
      return
    }
    const maxCols = Math.max(...raw.map(r => (r as unknown[]).length))
    const normalized = raw.map(r => Array.from({ length: maxCols }, (_, i) => String((r as unknown[])[i] ?? '').trim()))
    setAllRows(normalized)
    applyHeaderMode(normalized, false)
    setColMapping({ nomeParametro: null, aliasLims: null, aliasOqlab: null, aliasStrumento: null })
    setStep('mapping')
  }

  function applyHeaderMode(rawRows: string[][], hasHeader: boolean) {
    const maxCols = rawRows[0]?.length ?? 0
    if (hasHeader && rawRows.length >= 1) {
      // Prima riga come intestazione: usa i suoi valori come nomi colonna (fallback lettera se vuoto)
      const hdrs = rawRows[0].map((v, i) =>
        v.trim() || (i < 26 ? String.fromCharCode(65 + i) : `Col${i + 1}`)
      )
      setHeaders(hdrs)
      setRows(rawRows.slice(1))
    } else {
      // Nessun header: nomi colonna A/B/C...
      const hdrs = Array.from({ length: maxCols }, (_, i) =>
        i < 26 ? String.fromCharCode(65 + i) : `Col${i + 1}`
      )
      setHeaders(hdrs)
      setRows(rawRows)
    }
  }

  // ---------------------------------------------------------------------------
  // Step: mapping → review
  // ---------------------------------------------------------------------------

  function handleProceedToReview() {
    if (!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento) return

    const paramIdx = colMapping.nomeParametro ? headers.indexOf(colMapping.nomeParametro) : -1
    const limsIdx = colMapping.aliasLims ? headers.indexOf(colMapping.aliasLims) : -1
    const oqlabIdx = colMapping.aliasOqlab ? headers.indexOf(colMapping.aliasOqlab) : -1
    const strIdx = colMapping.aliasStrumento ? headers.indexOf(colMapping.aliasStrumento) : -1

    const analitiLower = analiti.map(a => a.toLowerCase())

    const result: MappedRow[] = []
    for (const row of rows) {
      const valParametro = paramIdx >= 0 ? (row[paramIdx]?.trim() || null) : null
      const valLims = limsIdx >= 0 ? (row[limsIdx]?.trim() || null) : null
      const valOqlab = oqlabIdx >= 0 ? (row[oqlabIdx]?.trim() || null) : null
      const valStrum = strIdx >= 0 ? (row[strIdx]?.trim() || null) : null

      // Riga completamente vuota → skip
      if (!valParametro && !valLims && !valOqlab && !valStrum) continue

      let matched: string | null = null
      let score = 0
      let status: MatchStatus = 'unmatched'
      let isNew = false

      if (valParametro) {
        // Priorità assoluta alla colonna Nome Parametro
        const exactIdx = analitiLower.indexOf(valParametro.toLowerCase())
        if (exactIdx >= 0) {
          matched = analiti[exactIdx]
          score = 1
          status = 'auto'
        } else {
          // Prima di creare, prova fuzzy per evitare doppioni
          const { name, score: fs } = bestFuzzy(valParametro, analiti)
          if (name && fs >= 0.85) {
            matched = name
            score = fs
            status = 'suggest'
          } else {
            matched = valParametro.toUpperCase()
            score = 0
            status = 'new'
            isNew = true
          }
        }
      } else {
        // Nessuna colonna parametro: fuzzy su LIMS (fallback OQLab)
        const fuzzySrc = valLims ?? valOqlab
        if (fuzzySrc) {
          const { name, score: fs } = bestFuzzy(fuzzySrc, analiti)
          score = fs
          if (fs >= 0.85) {
            matched = name
            status = 'auto'
          } else if (fs >= 0.60) {
            matched = name
            status = 'suggest'
          } else {
            matched = null
            status = 'unmatched'
          }
        }
      }

      const source = valParametro ?? valLims ?? valOqlab ?? ''

      result.push({
        source,
        matched,
        score,
        status,
        isNew,
        alias_lims: valLims,
        alias_oqlab: valOqlab,
        alias_strumento: valStrum,
      })
    }

    setMapped(result)
    setStep('review')
  }

  // ---------------------------------------------------------------------------
  // Step: review — modifica match
  // ---------------------------------------------------------------------------

  function updateMatch(idx: number, newMatched: string | null) {
    setMapped(prev => prev.map((m, i) => {
      if (i !== idx) return m
      if (newMatched === null) {
        return { ...m, matched: null, status: 'unmatched', isNew: false }
      }
      const exists = analiti.some(a => a.toLowerCase() === newMatched.toLowerCase())
      // Se la riga non aveva alias valorizzati (es. era unmatched) ma aveva un source,
      // usiamo source come alias per la colonna principale selezionata, così l'import scrive qualcosa.
      const needsAlias = m.alias_lims === null && m.alias_oqlab === null && m.alias_strumento === null
      const aliasFromSource = needsAlias && m.source ? {
        alias_lims: colMapping.aliasLims ? m.source : m.alias_lims,
        alias_oqlab: colMapping.aliasOqlab ? m.source : m.alias_oqlab,
        alias_strumento: colMapping.aliasStrumento ? m.source : m.alias_strumento,
      } : {}
      return {
        ...m,
        matched: newMatched,
        status: exists ? 'auto' : 'new',
        isNew: !exists,
        ...aliasFromSource,
      }
    }))
  }

  // ---------------------------------------------------------------------------
  // Step: import
  // ---------------------------------------------------------------------------

  async function handleImport() {
    setStep('importing')
    const confirmed = mapped.filter(m => m.matched)
    const nuoviNomi = confirmed.filter(m => m.isNew).map(m => m.matched!)
    try {
      // 1. Crea i nuovi parametri (l'handler fa INSERT OR IGNORE + uppercase + aggancia composti_metodi)
      if (nuoviNomi.length > 0) {
        await metodoAnalitiApi.add(metodoId, nuoviNomi)
      }
      // 2. Scrivi gli alias su tutti (inclusi i nuovi, match case-insensitive)
      // Non passiamo le chiavi con valore null: l'handler IPC aggiorna solo i campi presenti,
      // quindi i valori già in DB non vengono sovrascritti se la colonna non era selezionata.
      const updates = confirmed.map(m => ({
        nome: m.isNew ? m.matched!.toUpperCase() : m.matched!,
        ...(m.alias_lims !== null ? { alias_lims: m.alias_lims } : {}),
        ...(m.alias_oqlab !== null ? { alias_oqlab: m.alias_oqlab } : {}),
        ...(m.alias_strumento !== null ? { alias_strumento: m.alias_strumento } : {}),
      }))
      await metodoAnalitiApi.bulkUpdateAlias(metodoId, updates)
      setImportCount({ updated: confirmed.length - nuoviNomi.length, created: nuoviNomi.length })
      setStep('done')
    } catch (e: any) {
      console.error('[AliasImport] errore:', e)
      setErrorMsg(e?.message ?? 'Errore durante il salvataggio.')
      setStep('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Teniamo indice globale insieme alla riga per evitare indexOf con identità oggetto
  const indexedMapped = mapped.map((m, i) => ({ m, i }))
  const autoRows = indexedMapped.filter(({ m }) => m.status === 'auto')
  const newRows = indexedMapped.filter(({ m }) => m.status === 'new')
  const suggestRows = indexedMapped.filter(({ m }) => m.status === 'suggest')
  const unmatchedRows = indexedMapped.filter(({ m }) => m.status === 'unmatched')
  const reviewRows = indexedMapped.filter(({ m }) => m.status === 'suggest' || m.status === 'unmatched')
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
            <MappingStep
              headers={headers}
              rows={rows}
              allRows={allRows}
              colMapping={colMapping}
              setColMapping={setColMapping}
              onHeaderModeChange={(hasHeader) => {
                applyHeaderMode(allRows, hasHeader)
                setColMapping({ nomeParametro: null, aliasLims: null, aliasOqlab: null, aliasStrumento: null })
              }}
            />
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Auto ({autoRows.length})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Da verificare ({suggestRows.length})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Non mappati ({unmatchedRows.length})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Da creare ({newRows.length})</span>
              </div>


              {/* Banner avviso nuovi parametri */}
              {newRows.length > 0 && (
                <div className="rounded-md border border-blue-500/40 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
                  <strong>Attenzione:</strong> {newRows.length} {newRows.length === 1 ? 'parametro non presente nel metodo verrà CREATO' : 'parametri non presenti nel metodo verranno CREATI'}. Verifica la lista prima di importare.
                </div>
              )}

              {/* Nuovi parametri da creare */}
              {newRows.length > 0 && (
                <div className="border border-blue-500/40 rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-900 dark:text-blue-200">
                    Nuovi parametri da creare ({newRows.length})
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Nome nel file</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Parametro (nuovo o esistente)</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Alias LIMS</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase">Alias OQLab</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {newRows.map(({ m, i }) => (
                        <ReviewRow
                          key={'new-' + i}
                          row={m}
                          analiti={analiti}
                          onChange={newMatched => updateMatch(i, newMatched)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
                      {reviewRows.map(({ m, i }) => (
                        <ReviewRow
                          key={'review-' + i}
                          row={m}
                          analiti={analiti}
                          onChange={newMatched => updateMatch(i, newMatched)}
                        />
                      ))}
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
                        {autoRows.map(({ m, i }) => (
                          <tr key={'auto-' + i} className="hover:bg-muted/20">
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
              <p className="text-xs text-muted-foreground">
                {importCount.updated} {importCount.updated === 1 ? 'parametro aggiornato' : 'parametri aggiornati'}
                {importCount.created > 0 && (
                  <>, <span className="text-blue-700 dark:text-blue-400">{importCount.created} {importCount.created === 1 ? 'nuovo parametro creato' : 'nuovi parametri creati'}</span></>
                )}.
              </p>
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
                <Button
                  size="sm"
                  onClick={handleProceedToReview}
                  disabled={!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento}
                  title={(!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento) ? 'Seleziona almeno una colonna per procedere' : undefined}
                >
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

function MappingStep({
  headers,
  rows,
  allRows,
  colMapping,
  setColMapping,
  onHeaderModeChange,
}: {
  headers: string[]
  rows: string[][]
  allRows: string[][]
  colMapping: ColMapping
  setColMapping: React.Dispatch<React.SetStateAction<ColMapping>>
  onHeaderModeChange: (hasHeader: boolean) => void
}) {
  const [hasHeader, setHasHeader] = React.useState(false)

  function toggleHeader(v: boolean) {
    setHasHeader(v)
    onHeaderModeChange(v)
  }

  const freeFor = (ownVal: string | null) => {
    const used = [colMapping.aliasLims, colMapping.aliasOqlab, colMapping.aliasStrumento, colMapping.nomeParametro]
      .filter((v): v is string => v !== null && v !== ownVal)
    return headers.filter(h => h && !used.includes(h))
  }

  const colColors: Record<string, string> = {}
  if (colMapping.aliasLims) colColors[colMapping.aliasLims] = 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
  if (colMapping.aliasOqlab) colColors[colMapping.aliasOqlab] = 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200'
  if (colMapping.nomeParametro) colColors[colMapping.nomeParametro] = 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
  if (colMapping.aliasStrumento) colColors[colMapping.aliasStrumento] = 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200'

  const colLabel: Record<string, string> = {}
  if (colMapping.aliasLims) colLabel[colMapping.aliasLims] = 'LIMS'
  if (colMapping.aliasOqlab) colLabel[colMapping.aliasOqlab] = 'OQLab'
  if (colMapping.nomeParametro) colLabel[colMapping.nomeParametro] = 'Param'
  if (colMapping.aliasStrumento) colLabel[colMapping.aliasStrumento] = 'Strum.'

  // Anteprima: mostra riga intestazione (se hasHeader) in grigio + prime 5 righe dati
  const previewDataRows = rows.slice(0, 5)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Anteprima file — scegli quale colonna è cosa</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={e => toggleHeader(e.target.checked)}
            className="rounded"
          />
          Prima riga = intestazione
        </label>
      </div>

      {/* Anteprima */}
      <div className="border rounded-md overflow-x-auto">
        <table className="text-[11px] font-mono w-full">
          <thead className="bg-muted/60">
            <tr>
              {headers.map(h => (
                <th key={h} className={`px-2 py-1.5 text-left whitespace-nowrap border-r last:border-r-0 font-bold ${colColors[h] ?? ''}`}>
                  {h}
                  {colLabel[h] && <span className="ml-1 text-[10px] font-normal opacity-70">← {colLabel[h]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Se hasHeader, mostra la riga originale usata come header, in grigio */}
            {hasHeader && allRows.length > 0 && (
              <tr className="opacity-40 italic">
                {headers.map((_, ci) => (
                  <td key={ci} className="px-2 py-1 whitespace-nowrap border-r last:border-r-0 text-muted-foreground">
                    {allRows[0][ci] ?? ''}
                  </td>
                ))}
              </tr>
            )}
            {previewDataRows.map((r, ri) => (
              <tr key={ri} className="hover:bg-muted/20">
                {headers.map((h, ci) => (
                  <td key={ci} className={`px-2 py-1 whitespace-nowrap border-r last:border-r-0 ${colColors[h] ? colColors[h] + ' font-medium' : 'text-muted-foreground'}`}>
                    {r[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">{rows.length} righe dati nel file</p>

      {/* Selezione campi */}
      <div className="grid gap-2">
        <ColSelect
          label="Nome LIMS → alias_lims"
          headers={freeFor(colMapping.aliasLims)}
          value={colMapping.aliasLims ?? '_skip'}
          onChange={v => setColMapping(prev => ({ ...prev, aliasLims: v === '_skip' ? null : v }))}
          skipOption
        />
        <ColSelect
          label="Nome OQLab → alias_oqlab"
          headers={freeFor(colMapping.aliasOqlab)}
          value={colMapping.aliasOqlab ?? '_skip'}
          onChange={v => setColMapping(prev => ({ ...prev, aliasOqlab: v === '_skip' ? null : v }))}
          skipOption
        />
        <ColSelect
          label="Nome parametro interno"
          headers={freeFor(colMapping.nomeParametro)}
          value={colMapping.nomeParametro ?? '_skip'}
          onChange={v => setColMapping(prev => ({ ...prev, nomeParametro: v === '_skip' ? null : v }))}
          skipOption
        />
        <ColSelect
          label="Alias strumento"
          headers={freeFor(colMapping.aliasStrumento)}
          value={colMapping.aliasStrumento ?? '_skip'}
          onChange={v => setColMapping(prev => ({ ...prev, aliasStrumento: v === '_skip' ? null : v }))}
          skipOption
        />
      </div>

      {!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400">
          Seleziona almeno una colonna per procedere.
        </p>
      )}
    </div>
  )
}

function ColSelect({
  label,
  required,
  headers,
  value,
  onChange,
  skipOption,
  hint,
}: {
  label: string
  required?: boolean
  headers: string[]
  value: string
  onChange: (v: string) => void
  skipOption: boolean
  hint?: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3">
        <span className="w-52 text-xs text-muted-foreground shrink-0">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </span>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="— Ignora —" />
          </SelectTrigger>
          <SelectContent>
            {skipOption && <SelectItem value="_skip" className="text-xs text-muted-foreground">— Ignora —</SelectItem>}
            {headers.filter(h => h).map(h => (
              <SelectItem key={h} value={h} className="text-xs font-mono">{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hint && value !== '_skip' && (
        <p className="text-[11px] text-muted-foreground pl-[13.5rem]">{hint}</p>
      )}
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
    row.status === 'unmatched' ? 'bg-red-50 dark:bg-red-900/20' :
    row.status === 'new' ? 'bg-blue-50 dark:bg-blue-950/30' : ''

  const dotColor =
    row.status === 'suggest' ? 'bg-yellow-500' :
    row.status === 'unmatched' ? 'bg-red-500' :
    row.status === 'new' ? 'bg-blue-500' : 'bg-green-500'

  // Valore del select: per righe 'new' il matched non è tra gli analiti → usiamo una chiave speciale
  const selectValue =
    row.matched === null ? '_none' :
    row.isNew ? '_new' :
    row.matched

  function handleChange(v: string) {
    if (v === '_none') onChange(null)
    else if (v === '_new') onChange(row.matched) // mantieni il valore nuovo
    else onChange(v)
  }

  return (
    <tr className={`${statusColor} hover:brightness-95`}>
      <td className="px-3 py-2 font-mono">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          {row.source}
        </span>
      </td>
      <td className="px-3 py-2">
        <Select value={selectValue} onValueChange={handleChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="— Non mappato —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none" className="text-xs text-muted-foreground">— Non mappato —</SelectItem>
            {row.isNew && row.matched && (
              <SelectItem value="_new" className="text-xs font-mono text-blue-700 dark:text-blue-300">
                + Crea nuovo: {row.matched}
              </SelectItem>
            )}
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
