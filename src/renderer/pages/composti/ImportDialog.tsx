import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const DB_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'codice_interno', label: 'Codice Interno' },
  { key: 'classe', label: 'Classe' },
  { key: 'forma', label: 'Forma (Neat/Solution/Mix)' },
  { key: 'forma_commerciale', label: 'Nome CRM' },
  { key: 'formula', label: 'Formula' },
  { key: 'purezza', label: 'Purezza (%)' },
  { key: 'concentrazione', label: 'Concentrazione' },
  { key: 'unita_conc', label: 'Unità Concentrazione' },
  { key: 'solvente', label: 'Solvente' },
  { key: 'fiala', label: 'N° Fiale' },
  { key: 'produttore', label: 'Produttore/Azienda' },
  { key: 'lotto', label: 'Lotto' },
  { key: 'operatore_apertura', label: 'Operatore Apertura' },
  { key: 'data_apertura', label: 'Data Apertura' },
  { key: 'scadenza_prodotto', label: 'Scadenza Prodotto' },
  { key: 'destinazione_uso', label: 'Destinazione Uso' },
  { key: 'ubicazione', label: 'Ubicazione' },
  { key: 'stoccaggio', label: 'Stoccaggio' },
  { key: 'accreditamento_crm', label: 'Accreditamento CRM' },
  { key: 'volume_ml', label: 'Volume (mL)' },
  { key: 'peso_molecolare', label: 'Peso Molecolare (MW)' },
  { key: 'matrice', label: 'Matrice' },
  { key: 'note', label: 'Note' },
  { key: 'metodi_nomi', label: 'Metodi Analitici (separati da ;)' },
  { key: '_skip', label: '— Ignora colonna —' },
]

const MESI_IT: Record<string, string> = {
  gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06',
  lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12',
}

function parseDate(val: unknown): string {
  if (val == null || val === '') return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof val === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(val)
      if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    } catch { /* ignore */ }
    return String(val)
  }
  const s = String(val).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const year = y.length === 2 ? (parseInt(y) > 50 ? '19' + y : '20' + y) : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const itMatch = s.match(/^(\d{1,2})-([a-zA-Z]{3})-(\d{2,4})$/)
  if (itMatch) {
    const [, d, mon, y] = itMatch
    const mNum = MESI_IT[mon.toLowerCase()]
    if (mNum) {
      const year = y.length === 2 ? (parseInt(y) > 50 ? '19' + y : '20' + y) : y
      return `${year}-${mNum}-${d.padStart(2, '0')}`
    }
  }
  return s
}

function cellToString(val: unknown): string {
  if (val == null) return ''
  if (val instanceof Date) return parseDate(val)
  return String(val).replace(/\r?\n/g, ' ').trim()
}

// TASK 2: helper — analizza le righe mappate e restituisce una mappa lotto → mix_id
// per i lotti che compaiono in più di una riga.
// DOPO (fix) — stesso lotto + stesso nome = duplicato, non mix
function calcolaMixDaLotto(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>
): Map<string, string> {
  const lottoHeader = Object.entries(mapping).find(([, v]) => v === 'lotto')?.[0]
  if (!lottoHeader) return new Map()
  const lottoIdx = headers.indexOf(lottoHeader)
  if (lottoIdx === -1) return new Map()

  const nomeHeader = Object.entries(mapping).find(([, v]) => v === 'nome')?.[0]
  const nomeIdx = nomeHeader ? headers.indexOf(nomeHeader) : -1

  // Per ogni lotto, raccoglie i nomi distinti delle righe che lo usano
  const nomiPerLotto = new Map<string, Set<string>>()
  for (const row of rows) {
    const lotto = row[lottoIdx]?.trim()
    if (!lotto) continue
    const nome = (nomeIdx >= 0 ? row[nomeIdx]?.trim() : '') || '__noname__'
    if (!nomiPerLotto.has(lotto)) nomiPerLotto.set(lotto, new Set())
    nomiPerLotto.get(lotto)!.add(nome)
  }

  // È un mix solo se lo stesso lotto appare con almeno 2 nomi DISTINTI
  let i = 0
  const mixIdMap = new Map<string, string>()
  for (const [lotto, nomi] of nomiPerLotto.entries()) {
    if (nomi.size > 1) {
      mixIdMap.set(lotto, `mix_${Date.now().toString(36)}_${i++}_${lotto.replace(/\W/g, '')}`)
    }
  }
  return mixIdMap
}

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onSave: () => void
}

export function ImportDialog({ open, onClose, onSave }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // TASK 3: aggiunto step 'header' all'union type
  const [step, setStep] = useState<'upload' | 'sheet' | 'header' | 'mapping' | 'preview' | 'importing' | 'done' | 'error'>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState('')
  const [importCount, setImportCount] = useState(0)
  const [mixImportCount, setMixImportCount] = useState(0)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  // TASK 3: righe grezze del file per la selezione intestazione
  const [rawRows, setRawRows] = useState<string[][]>([])

  const DATE_FIELDS = new Set([
    'data_apertura', 'data_preparazione', 'scadenza_prodotto',
    'data_scadenza_soluzione', 'data_dismissione',
  ])

  const NUMERIC_FIELDS = new Set([
    'volume_ml', 'peso_molecolare', 'concentrazione', 'purezza',
  ])

  function reset() {
    setStep('upload')
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setErrorMsg('')
    setImportCount(0)
    setMixImportCount(0)
    setSheetNames([])
    setWorkbook(null)
    setRawRows([]) // TASK 3
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  function autoMap(headers: string[]): Record<string, string> {
    const auto: Record<string, string> = {}
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-\.\/]/g, '')
    const aliases: Record<string, string[]> = {
      nome:               ['nome', 'name', 'composto', 'analita'],
      codice_interno:     ['codiceinterno', 'codiceintern', 'codice'],
      classe:             ['classe', 'class', 'categoria'],
      forma:              ['forma', 'statofisico', 'statofisicodiorigine'],
      forma_commerciale:  ['formacommerciale', 'formacommer', 'nomecrm'],
      formula:            ['formula'],
      purezza:            ['purezza', 'purity'],
      concentrazione:     ['concentrazione', 'conc', 'concentration'],
      unita_conc:         ['unitaconc', 'unita', 'unit'],
      solvente:           ['solvente', 'solvent'],
      fiala:              ['fiala', 'fiale', 'vial'],
      produttore:         ['produttore', 'azienda', 'fornitore', 'producer', 'supplier'],
      lotto:              ['lotto', 'lot', 'batch'],
      operatore_apertura: ['operatoriapertura', 'operatoreApertura', 'operatore', 'operator'],
      data_apertura:      ['dataapertura', 'dataap'],
      scadenza_prodotto:  ['scadenzaneat', 'scadenzaprodotto', 'datascadenza', 'scadenza', 'scad'],
      destinazione_uso:   ['destinazioneuso', 'destinazione'],
      ubicazione:         ['ubicazione', 'location', 'posizione'],
      stoccaggio:         ['stoccaggio', 'storage'],
      accreditamento_crm: ['accreditamentocrm', 'accreditamento', 'crm', 'iso17034'],
      volume_ml:          ['volumeml', 'volume', 'vol', 'volml'],
      peso_molecolare:    ['pesomolecolare', 'mw', 'pm'],
      matrice:            ['matrice', 'matrix'],
      note:               ['note', 'notes', 'annotazioni'],
      metodi_nomi:        ['metodi', 'metodo', 'metodianalitici', 'methods', 'method'],
    }

    const seen: Record<string, number> = {}
    for (const h of headers) {
      const hClean = h.replace(/_\d+$/, '')
      const hn = normalize(hClean)

      // Colonna senza intestazione → ignora sempre, senza tentare match
      if (!hn) {
        auto[h] = '_skip'
        continue
      }

      seen[hn] = (seen[hn] ?? 0) + 1

      let matched = '_skip'

      for (const [dbKey, synonyms] of Object.entries(aliases)) {
        if (synonyms.some(s => normalize(s) === hn)) {
          matched = dbKey
          break
        }
      }
      if (matched === '_skip') {
        for (const [dbKey, synonyms] of Object.entries(aliases)) {
          if (synonyms.some(s => normalize(s).length >= 5 && (hn.includes(normalize(s)) || normalize(s).includes(hn)))) {
            matched = dbKey
            break
          }
        }
      }

      auto[h] = matched
    }
    return auto
  }

  // TASK 3: processSheet ora si ferma allo step 'header' invece di andare a 'mapping'
  function processSheet(ws: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      cellDates: true,
      defval: null,
    }) as unknown[][]

    if (rows.length < 1) {
      setErrorMsg('Il foglio sembra vuoto.')
      setStep('error')
      return
    }

    // Converti tutte le righe in stringhe e salva come rawRows
    const raw: string[][] = rows.map(r =>
      (r as unknown[]).map(cell => {
        if (cell instanceof Date) return parseDate(cell)
        return cellToString(cell)
      })
    )

    setRawRows(raw)
    setStep('header') // TASK 3: l'utente sceglie quale riga è l'intestazione
  }

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
      } catch (err) {
        setErrorMsg('Impossibile leggere il file. Assicurati che sia un CSV o Excel valido.')
        setStep('error')
      }
    }
    reader.readAsBinaryString(file)
  }

  function handleSheetSelect(name: string) {
    if (!workbook) return
    processSheet(workbook.Sheets[name])
  }

  async function handleImport() {
    const nomeCol = Object.entries(mapping).find(([, v]) => v === 'nome')?.[0]
    if (!nomeCol) {
      setErrorMsg('Devi mappare almeno la colonna "Nome" prima di importare.')
      setStep('error')
      return
    }

    setStep('importing')
    let count = 0
    let errori = 0

    let metodiEsistenti: any[] = []
    try {
      metodiEsistenti = await window.electronAPI.invoke('metodi:list') as any[]
    } catch {
      metodiEsistenti = []
    }

    // TASK 2 — PASSO 1: costruire tutti i composti senza chiamare ancora l'IPC
    const compostiDaImportare: Array<{
      composto: Record<string, unknown>
      metodiNomiRaw: string
    }> = []

    for (const row of csvRows) {
      const composto: Record<string, unknown> = {}
      let metodiNomiRaw = ''

      csvHeaders.forEach((h, i) => {
        const dbField = mapping[h]
        if (!dbField || dbField === '_skip') return

        if (dbField === 'metodi_nomi') {
          metodiNomiRaw = String(row[i] ?? '').trim()
          return
        }

        const raw = row[i] ?? ''

        let val: unknown
        if (DATE_FIELDS.has(dbField)) {
          val = parseDate(raw)
        } else if (NUMERIC_FIELDS.has(dbField)) {
          const n = parseFloat(String(raw).replace(',', '.'))
          val = isNaN(n) ? '' : n
        } else {
          val = String(raw).trim()
        }

        if (val !== '' && val !== null && !composto[dbField]) composto[dbField] = val
      })

      if (!composto.nome) continue
      compostiDaImportare.push({ composto, metodiNomiRaw })
    }

    // TASK 2 — PASSO 2: post-processing mix — assegna mix_id, mix, forma ai composti
    // che hanno un lotto condiviso con almeno un altro composto nella stessa importazione.
    const mixIdMap = calcolaMixDaLotto(csvRows, csvHeaders, mapping)

    // Se un lotto del batch corrisponde a una mix già presente nel DB, riusa il mix_id esistente
    for (const [lotto] of mixIdMap.entries()) {
      const existingMixId = await window.electronAPI.invoke('composti:find-mix-id-by-lotto', lotto)
      if (existingMixId) {
        mixIdMap.set(lotto, existingMixId)
      }
    }

    setMixImportCount(mixIdMap.size)
    for (const { composto } of compostiDaImportare) {
      const lotto = (composto.lotto as string)?.trim()
      if (lotto && mixIdMap.has(lotto)) {
        composto.mix_id = mixIdMap.get(lotto)!
        composto.mix = lotto
        composto.forma = 'Mix'
      }
    }

    // TASK 2 — PASSO 3: import effettivo
    for (const { composto, metodiNomiRaw } of compostiDaImportare) {
      if (metodiNomiRaw) {
        const nomiMetodi = metodiNomiRaw
          .split(';')
          .map(n => n.trim())
          .filter(Boolean)

        const ids: string[] = []
        for (const nome of nomiMetodi) {
          let metodo = metodiEsistenti.find(
            (m: any) => m.nome.toLowerCase() === nome.toLowerCase()
          )
          if (!metodo) {
            try {
              metodo = await window.electronAPI.invoke('metodi:get-or-create', nome) as any
              metodiEsistenti.push(metodo)
            } catch {
              continue
            }
          }
          if (metodo?.id) ids.push(metodo.id)
        }

        if (ids.length > 0) {
          composto.metodi_ids = ids
        }
      }

      try {
        await window.electronAPI.invoke('composti:create', composto)
        count++
      } catch {
        errori++
      }
    }

    setImportCount(count)
    if (count === 0 && errori > 0) {
      setErrorMsg(`Importazione fallita: ${errori} righe su ${errori} hanno generato un errore. Nessun composto aggiunto.`)
      setStep('error')
    } else {
      if (errori > 0) {
        setErrorMsg(`Importati ${count} composti. ${errori} righe saltate per errore.`)
      }
      setStep('done')
      onSave()
    }
  }

  const mappedCols = csvHeaders
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => mapping[h] && mapping[h] !== '_skip')

  // Filtra righe senza nome in base alla mappatura corrente
  const nomeColHeader = Object.entries(mapping).find(([, v]) => v === 'nome')?.[0]
  const nomeColIdx = nomeColHeader ? csvHeaders.indexOf(nomeColHeader) : -1
  const filteredRows = nomeColIdx >= 0
    ? csvRows.filter(r => (r[nomeColIdx] ?? '').trim() !== '')
    : csvRows
  const previewRows = filteredRows.slice(0, 5)

  // TASK 2: calcola quanti mix verranno rilevati — usato nel banner dello step preview
  const mixRilevatiCount = calcolaMixDaLotto(filteredRows, csvHeaders, mapping).size

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa composti da CSV / Excel</DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Seleziona un file <strong>.csv</strong> o <strong>.xlsx</strong> esportato da Excel.
            </p>
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <p className="font-medium mb-1">💡 Colonna Metodi Analitici</p>
              <p>Per associare i metodi, aggiungi una colonna chiamata <strong>metodi</strong> con i nomi separati da punto e virgola.</p>
              <p className="mt-1 font-mono bg-white border border-blue-100 rounded px-2 py-1 inline-block">
                es: <code>pos_098; pos_099; pos_100</code>
              </p>
              <p className="mt-1">I metodi non ancora presenti nel database verranno creati automaticamente.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
          </div>
        )}

        {/* STEP: SELEZIONE FOGLIO */}
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

        {/* TASK 3 — STEP: SELEZIONE RIGA INTESTAZIONE */}
        {step === 'header' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Clicca sulla riga che contiene le <strong>intestazioni delle colonne</strong>.
            </p>

            <div className="border rounded-md overflow-auto max-h-72">
              <table className="text-xs w-full">
                <tbody>
                  {rawRows.map((row, ri) => (
                    <tr
                      key={ri}
                      className="cursor-pointer hover:bg-blue-50 border-b transition-colors"
                      onClick={() => {
                        const headers = row.map(c => String(c ?? '').trim())
                        const autoMapping = autoMap(headers)
                        // Trova l'indice della colonna mappata a 'nome'
                        const nomeHeader = Object.entries(autoMapping).find(([, v]) => v === 'nome')?.[0]
                        const nomeIdx = nomeHeader ? headers.indexOf(nomeHeader) : -1
                        const dataRows = rawRows
                          .slice(ri + 1)
                          .filter(r => r.some(c => c !== '' && c != null))
                          // Filtra righe senza nome
                          .filter(r => nomeIdx === -1 || (r[nomeIdx] ?? '').trim() !== '')
                        setCsvHeaders(headers)
                        setCsvRows(dataRows)
                        setMapping(autoMapping)
                        setStep('mapping')
                      }}
                    >
                      <td className="px-2 py-1.5 text-muted-foreground w-8 select-none font-mono border-r">
                        {ri + 1}
                      </td>
                      {row.slice(0, 8).map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-2 py-1.5 border-r truncate max-w-[120px]"
                          title={String(cell ?? '')}
                        >
                          {String(cell ?? '')}
                        </td>
                      ))}
                      {row.length > 8 && (
                        <td className="px-2 py-1.5 text-muted-foreground italic">
                          +{row.length - 8} colonne
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Mostrate le prime 20 righe. Clicca sulla riga che fa da intestazione.
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: MAPPATURA COLONNE */}
        {step === 'mapping' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Trovate <strong>{csvHeaders.length} colonne</strong> e <strong>{filteredRows.length} righe</strong> con nome.
              Controlla la mappatura automatica e correggila se necessario.
            </p>

            {/* Banner mix rilevati — visibile già in mappatura se la colonna lotto è già agganciata */}
            {mixRilevatiCount > 0 && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">ℹ️</span>
                <p>
                  Rilevati <strong>{mixRilevatiCount} mix</strong> (composti con lotto condiviso).
                  Verranno importati con <strong>Forma = Mix</strong> e stesso <code className="text-xs bg-blue-100 px-1 rounded">mix_id</code>.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {csvHeaders.map((h, i) => (
                <div key={`${h}-${i}`} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1.5">
                  <span className="text-xs font-mono flex-1 truncate" title={h}>{h}</span>
                  <Select
                    value={mapping[h] ?? '_skip'}
                    onValueChange={v => setMapping(prev => ({ ...prev, [h]: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DB_FIELDS.map(f => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">* campo obbligatorio</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
              <Button onClick={() => setStep('preview')}>
                Anteprima →
              </Button>
            </div>
          </div>
        )}

        {/* STEP: ANTEPRIMA */}
        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Anteprima delle prime 5 righe (colonne ignorate escluse). Verranno importati <strong>{filteredRows.length}</strong> composti.
            </p>

            {/* TASK 2: banner mix rilevati */}
            {mixRilevatiCount > 0 && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">ℹ️</span>
                <p>
                  Rilevati <strong>{mixRilevatiCount} mix</strong> (composti con lotto condiviso).
                  Verranno importati con <strong>Forma = Mix</strong> e stesso{' '}
                  <code className="text-xs bg-blue-100 px-1 rounded">mix_id</code>.
                </p>
              </div>
            )}

            <div className="overflow-x-auto border rounded">
              <table className="text-xs w-full">
                <thead className="bg-muted">
                  <tr>
                    {mappedCols.map(({ h, i }) => (
                      <th key={`${h}-${i}`} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                        {DB_FIELDS.find(f => f.key === mapping[h])?.label ?? mapping[h]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {mappedCols.map(({ h, i }) => (
                        <td key={`${h}-${i}`} className="px-2 py-1 truncate max-w-[160px]" title={String(row[i] ?? '')}>
                          {String(row[i] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep('mapping')}>← Indietro</Button>
              <Button onClick={handleImport}>
                Importa {filteredRows.length} composti
              </Button>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div className="py-8 text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Importazione in corso…</p>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div className="py-6 text-center space-y-4">
            <p className="text-lg font-medium text-green-600">✓ Importazione completata</p>
            <p className="text-sm text-muted-foreground">
              {errorMsg || `Importati ${importCount} composti con successo.`}
            </p>
            <Badge variant="outline" className="text-base px-4 py-1">{importCount} composti aggiunti</Badge>
            {mixImportCount > 0 && (
              <p className="text-sm text-blue-700">
                🧪 <strong>{mixImportCount} mix</strong> identificati (composti con lotto condiviso).
              </p>
            )}
            <DialogFooter className="justify-center pt-2">
              <Button onClick={handleClose}>Chiudi</Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: ERROR */}
        {step === 'error' && (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm font-medium text-destructive">Errore</p>
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded">{errorMsg}</p>
            <DialogFooter className="justify-center pt-2">
              <Button variant="ghost" onClick={reset}>Riprova</Button>
              <Button onClick={handleClose}>Annulla</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}