import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

// Colonne del database a cui mappare i dati CSV
const DB_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'codice_interno', label: 'Codice Interno' },
  { key: 'classe', label: 'Classe' },
  { key: 'forma', label: 'Forma (Neat/Solution/Stock)' },
  { key: 'forma_commerciale', label: 'Forma Commerciale' },
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
  { key: 'work_standard', label: 'Work Standard' },
  { key: 'ubicazione', label: 'Ubicazione' },
  { key: 'stoccaggio', label: 'Stoccaggio' },
  { key: 'peso_molecolare', label: 'Peso Molecolare (MW)' },
  { key: '_skip', label: '— Ignora colonna —' },
]

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onSave: () => void
}

export function ImportDialog({ open, onClose, onSave }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'done' | 'error'>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // csvHeader → dbField
  const [errorMsg, setErrorMsg] = useState('')
  const [importCount, setImportCount] = useState(0)

  function reset() {
    setStep('upload')
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setErrorMsg('')
    setImportCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  // Tenta di indovinare automaticamente la mappatura in base al nome della colonna CSV
  function autoMap(headers: string[]): Record<string, string> {
    const auto: Record<string, string> = {}
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-\.]/g, '')
    const aliases: Record<string, string[]> = {
      nome:              ['nome', 'name', 'composto', 'standard', 'analita'],
      codice_interno:    ['codice', 'codiceinterno', 'codiceintern', 'id'],
      classe:            ['classe', 'class', 'categoria'],
      forma:             ['forma', 'form', 'tipo', 'type'],
      forma_commerciale: ['formacommerciale', 'formacommer', 'commercial'],
      formula:           ['formula'],
      purezza:           ['purezza', 'purity', 'pur'],
      concentrazione:    ['concentrazione', 'conc', 'concentration'],
      unita_conc:        ['unitaconc', 'unita', 'unit', 'um'],
      solvente:          ['solvente', 'solvent'],
      fiala:             ['fiala', 'fiale', 'vial'],
      produttore:        ['produttore', 'azienda', 'fornitore', 'producer', 'supplier', 'vendor'],
      lotto:             ['lotto', 'lot', 'batch'],
      operatore_apertura:['operatore', 'operator'],
      data_apertura:     ['dataapertura', 'apertura', 'opening'],
      scadenza_prodotto: ['scadenza', 'scad', 'expiry', 'expiration'],
      destinazione_uso:  ['destinazione', 'destinazioneuso', 'use'],
      work_standard:     ['workstandard', 'work'],
      ubicazione:        ['ubicazione', 'location', 'posizione'],
      stoccaggio:        ['stoccaggio', 'storage'],
      peso_molecolare:   ['pesomolecolare', 'pm', 'mw', 'molweight'],
    }
    for (const h of headers) {
      const hn = normalize(h)
      let matched = '_skip'
      for (const [dbKey, synonyms] of Object.entries(aliases)) {
        if (synonyms.some(s => hn.includes(s) || s.includes(hn))) {
          matched = dbKey
          break
        }
      }
      auto[h] = matched
    }
    return auto
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const wb = XLSX.read(data, { type: 'binary', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

        if (rows.length < 2) {
          setErrorMsg('Il file sembra vuoto o ha solo l\'intestazione.')
          setStep('error')
          return
        }

        const headers = (rows[0] as string[]).map(h => String(h ?? '').trim())
        const dataRows = rows.slice(1).filter(r => r.some(c => c !== '' && c != null)) as string[][]

        setCsvHeaders(headers)
        setCsvRows(dataRows)
        setMapping(autoMap(headers))
        setStep('mapping')
      } catch (err) {
        setErrorMsg('Impossibile leggere il file. Assicurati che sia un CSV o Excel valido.')
        setStep('error')
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    // Controlla che "nome" sia mappato
    const nomeCol = Object.entries(mapping).find(([, v]) => v === 'nome')?.[0]
    if (!nomeCol) {
      setErrorMsg('Devi mappare almeno la colonna "Nome" prima di importare.')
      setStep('error')
      return
    }

    setStep('importing')
    let count = 0
    let errori = 0

    for (const row of csvRows) {
      // Costruisce l'oggetto composto dalla riga CSV
      const composto: Record<string, unknown> = {}
      csvHeaders.forEach((h, i) => {
        const dbField = mapping[h]
        if (dbField && dbField !== '_skip') {
          const val = String(row[i] ?? '').trim()
          if (val !== '') composto[dbField] = val
        }
      })

      if (!composto.nome) continue // salta righe senza nome

      try {
        await window.electronAPI.invoke('composti:create', composto)
        count++
      } catch {
        errori++
      }
    }

    setImportCount(count)
    if (errori > 0) {
      setErrorMsg(`Importati ${count} composti. ${errori} righe saltate per errore.`)
    }
    setStep('done')
    onSave()
  }

  // Anteprima: prime 5 righe con le colonne mappate (non _skip)
  const mappedCols = csvHeaders.filter(h => mapping[h] && mapping[h] !== '_skip')
  const previewRows = csvRows.slice(0, 5)

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
              La prima riga deve contenere le intestazioni delle colonne.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
          </div>
        )}

        {/* STEP: MAPPATURA COLONNE */}
        {step === 'mapping' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Trovate <strong>{csvHeaders.length} colonne</strong> e <strong>{csvRows.length} righe</strong>.
              Controlla la mappatura automatica e correggila se necessario.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {csvHeaders.map(h => (
                <div key={h} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1.5">
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
              Anteprima delle prime 5 righe (colonne ignorate escluse). Verranno importati <strong>{csvRows.length}</strong> composti.
            </p>
            <div className="overflow-x-auto border rounded">
              <table className="text-xs w-full">
                <thead className="bg-muted">
                  <tr>
                    {mappedCols.map(h => (
                      <th key={h} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                        {DB_FIELDS.find(f => f.key === mapping[h])?.label ?? mapping[h]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t">
                      {mappedCols.map(h => {
                        const idx = csvHeaders.indexOf(h)
                        return (
                          <td key={h} className="px-2 py-1 truncate max-w-[160px]" title={String(row[idx] ?? '')}>
                            {String(row[idx] ?? '')}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep('mapping')}>← Indietro</Button>
              <Button onClick={handleImport}>
                Importa {csvRows.length} composti
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