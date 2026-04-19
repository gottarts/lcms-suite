import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { X, Upload } from 'lucide-react'
import { compostiApi } from '@/lib/api'
import { UNITA_CONCENTRAZIONE, UNITA_DEFAULT } from '@/lib/unita'
import { TextImportDialog, type ImportField } from '@/components/shared/TextImportDialog'
import { AutocompleteInput } from '@/components/shared/AutocompleteInput'
import { syncAnagrafiche } from '@/lib/anagrafiche-sync'

const DESTINAZIONI_USO = [
  'Taratura',
  'Controllo qualità',
  'Taratura+Controllo qualità',
  'Standard Interno',
]

interface ComponenteImportato {
  nome: string
  forma_commerciale?: string | null
  lotto?: string | null
  scadenza_prodotto?: string | null
  data_apertura?: string | null
  produttore?: string | null
  concentrazione?: number | null
}

interface MixPesticidiFormProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  mixTemplate?: {
    forma_commerciale: string
    concentrazione: string
    unita_conc: string
    solvente: string
    classe: string
    destinazione_uso: string
    ubicazione: string
    stoccaggio: string
    accreditamento_crm: string
    codice_interno: string
    fiala: string
    volume_ml: string
    lotto: string
    data_apertura: string
    scadenza_prodotto: string
    operatore_apertura: string
    produttore: string
    _nomi: string[]
    _concentrazioni: (number | null)[]
    _metodi_ids: string[]
  } | null
}

export function MixPesticidiForm({ open, onClose, onSave, mixTemplate }: MixPesticidiFormProps) {
  const [form, setForm] = useState({
    forma_commerciale: '', concentrazione: '', unita_conc: UNITA_DEFAULT,
    solvente: '', produttore: '', lotto: '', data_apertura: '',
    scadenza_prodotto: '', classe: '', destinazione_uso: '',
    stoccaggio: '', accreditamento_crm: 'ISO 17034', codice_interno: '',
    fiale: '1', ubicazione: '', volume_ml: '',
    operatore_apertura: '',
  })
  const [nomi, setNomi] = useState<string[]>([])
  const [componentiImportati, setComponentiImportati] = useState<ComponenteImportato[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [vociStoccaggio, setVociStoccaggio] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [metodi, setMetodi] = useState<any[]>([])
  const [metodiIds, setMetodiIds] = useState<string[]>([])
  const [metodiInput, setMetodiInput] = useState('')
  const [metodiSuggerimenti, setMetodiSuggerimenti] = useState<any[]>([])
  const [metodiDropdownOpen, setMetodiDropdownOpen] = useState(false)
  const [metodiToast, setMetodiToast] = useState('')
  const [importTextOpen, setImportTextOpen] = useState(false)
  const [importedFields, setImportedFields] = useState<Set<string>>(new Set())
  const [lottiUnici, setLottiUnici] = useState<ComponenteImportato[][]>([])
  const [selezioneLottiOpen, setSelezioneLottiOpen] = useState(false)

  // TASK A-3: suggerimenti autocomplete (classe, produttore, solvente, ubicazione)
  const [classiDisponibili, setClassiDisponibili] = useState<string[]>([])
  const [produttoriDisponibili, setProduttoriDisponibili] = useState<string[]>([])
  const [solventiDisponibili, setSolventiDisponibili] = useState<string[]>([])
  const [ubicazioniDisponibili, setUbicazioniDisponibili] = useState<string[]>([])
  const [operatoriDisponibili, setOperatoriDisponibili] = useState<string[]>([])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    window.electronAPI.invoke('anagrafiche:list').then((anagrafiche: any[]) => {
      const voci = (nomeMatch: string) => {
        const found = anagrafiche.find((a: any) => a.nome.toLowerCase().includes(nomeMatch))
        return found?.voci?.map((v: any) => v.valore) ?? []
      }
      setVociStoccaggio(voci('stoccaggio') || voci('posizioni'))

      const classiAnagrafica: string[] = voci('classi') || voci('classe')
      const produttoriAnagrafica: string[] = voci('produttori') || voci('fornitori')
      const solventiAnagrafica: string[] = voci('solventi')
      const ubicazioniAnagrafica: string[] = voci('ubicazioni') || voci('stanze')
      const operatoriAnagrafica: string[] = voci('operatori')

      const merge = (fromAnagrafica: string[], campo: string) =>
        window.electronAPI.invoke('composti:distinct-values', campo)
          .then((fromDb: unknown) => {
            const db = fromDb as string[]
            const map = new Map<string, string>()
            ;[...fromAnagrafica, ...db].forEach(v => map.set(v.toLowerCase(), v))
            return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          })
          .catch(() => fromAnagrafica)

      merge(classiAnagrafica, 'classe').then(setClassiDisponibili)
      merge(produttoriAnagrafica, 'produttore').then(setProduttoriDisponibili)
      merge(solventiAnagrafica, 'solvente').then(setSolventiDisponibili)
      merge(ubicazioniAnagrafica, 'ubicazione').then(setUbicazioniDisponibili)
      merge(operatoriAnagrafica, 'operatore_apertura').then(setOperatoriDisponibili)
    }).catch(err => console.error('Error loading anagrafiche:', err))

    window.electronAPI.invoke('metodi:list').then((result: unknown) => {
      setMetodi(result as any[])
    }).catch(err => console.error('Error loading metodi:', err))
  }, [])

  useEffect(() => {
    if (!open) return
    if (mixTemplate) {
      setForm({
        forma_commerciale: mixTemplate.forma_commerciale,
        concentrazione:    mixTemplate.concentrazione,
        unita_conc:        mixTemplate.unita_conc || UNITA_DEFAULT,
        solvente:          mixTemplate.solvente,
        produttore:        mixTemplate.produttore,
        lotto:             '',
        data_apertura:     '',
        scadenza_prodotto: '',
        classe:            mixTemplate.classe,
        destinazione_uso:  mixTemplate.destinazione_uso,
        stoccaggio:        mixTemplate.stoccaggio,
        accreditamento_crm: mixTemplate.accreditamento_crm || 'ISO 17034',
        codice_interno:    mixTemplate.codice_interno,
        fiale:             mixTemplate.fiala || '1',
        ubicazione:        mixTemplate.ubicazione,
        volume_ml:         mixTemplate.volume_ml,
        operatore_apertura: '',
      })
      setNomi(mixTemplate._nomi)
      if (mixTemplate._concentrazioni?.length > 0) {
        setComponentiImportati(
          mixTemplate._nomi.map((nome, i) => ({
            nome,
            concentrazione: mixTemplate._concentrazioni[i] ?? null,
          }))
        )
      } else {
        setComponentiImportati(null)
      }
      setImportedFields(new Set())
      if (mixTemplate._metodi_ids?.length > 0) {
        setMetodiIds(mixTemplate._metodi_ids)
      }
    } else {
      reset()
    }
  }, [open, mixTemplate])

  const reset = () => {
    setForm({
      forma_commerciale: '', concentrazione: '', unita_conc: UNITA_DEFAULT,
      solvente: '', produttore: '', lotto: '', data_apertura: '',
      scadenza_prodotto: '', classe: '', destinazione_uso: '',
      stoccaggio: '', accreditamento_crm: 'ISO 17034', codice_interno: '',
      fiale: '1', ubicazione: '', volume_ml: '',
      operatore_apertura: '',
    })
    setNomi([])
    setComponentiImportati(null)
    setMetodiIds([])
    setMetodiInput('')
    setMetodiToast('')
    setImportedFields(new Set())
    setLottiUnici([])
    setSelezioneLottiOpen(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleMetodiInput = (val: string) => {
    setMetodiInput(val)
    if (val.trim().length === 0) { setMetodiSuggerimenti([]); setMetodiDropdownOpen(false); return }
    const filtered = metodi.filter(m => m.nome.toLowerCase().includes(val.toLowerCase()) && !metodiIds.includes(m.id))
    setMetodiSuggerimenti(filtered)
    setMetodiDropdownOpen(true)
  }

  const handleMetodoSelect = (metodo: any) => {
    if (!metodiIds.includes(metodo.id)) setMetodiIds(prev => [...prev, metodo.id])
    setMetodiInput(''); setMetodiSuggerimenti([]); setMetodiDropdownOpen(false)
  }

  const handleMetodoCreateOrAdd = async () => {
    const nome = metodiInput.trim()
    if (!nome) return
    try {
      const esistente = metodi.find(m => m.nome.toLowerCase() === nome.toLowerCase())
      const metodo = await window.electronAPI.invoke('metodi:get-or-create', nome) as any
      handleMetodoSelect(metodo)
      setMetodi(prev => prev.find(m => m.id === metodo.id) ? prev : [...prev, metodo])
      if (!esistente) { setMetodiToast(`Metodo "${nome}" creato`); setTimeout(() => setMetodiToast(''), 2500) }
    } catch (err) { console.error('Errore creazione metodo:', err) }
  }

  const handleMetodoRemove = (metodoId: string) => setMetodiIds(prev => prev.filter(id => id !== metodoId))

  const importFields: ImportField[] = [
    { key: 'nomi',              label: 'Nomi composti',            multi: true },
    { key: 'forma_commerciale', label: 'Nome CRM (per riga)', multi: true },
    { key: 'lotto',             label: 'Lotto (per riga)',         multi: true },
    { key: 'scadenza_prodotto', label: 'Data Scadenza (per riga)', multi: true },
    { key: 'data_apertura',     label: 'Data Apertura (per riga)', multi: true },
    { key: 'produttore',        label: 'Produttore (per riga)',    multi: true },
    { key: 'solvente',          label: 'Solvente' },
    { key: 'concentrazione',    label: 'Concentrazione' },
    { key: 'stoccaggio',        label: 'Stoccaggio' },
    { key: 'destinazione_uso',  label: 'Destinazione Uso' },
    { key: 'codice_interno',    label: 'Codice Interno' },
    { key: 'metodi_nomi',       label: 'Metodi (sep. ;)', multi: true },
  ]

  async function handleTextImport(values: Record<string, string>) {
    const locked = new Set<string>()

    const formKeys = ['solvente', 'concentrazione', 'stoccaggio', 'destinazione_uso', 'codice_interno'] as const
    for (const key of formKeys) {
      if (values[key] !== undefined && values[key] !== '') { set(key, values[key]); locked.add(key) }
    }

    const nomiArr  = values['nomi']              ? values['nomi'].split(';').map(s => s.trim()).filter(Boolean) : []
    const formaArr = values['forma_commerciale'] ? values['forma_commerciale'].split(';').map(s => s.trim()) : []
    const lottiArr = values['lotto']             ? values['lotto'].split(';').map(s => s.trim()) : []
    const scadArr  = values['scadenza_prodotto'] ? values['scadenza_prodotto'].split(';').map(s => s.trim()) : []
    const aperArr  = values['data_apertura']     ? values['data_apertura'].split(';').map(s => s.trim()) : []
    const prodArr  = values['produttore']        ? values['produttore'].split(';').map(s => s.trim()) : []

    if (nomiArr.length > 0) {
      const comps: ComponenteImportato[] = nomiArr.map((nome, i) => ({
        nome,
        forma_commerciale: formaArr[i] || null,
        lotto:             lottiArr[i] || null,
        scadenza_prodotto: scadArr[i]  || null,
        data_apertura:     aperArr[i]  || null,
        produttore:        prodArr[i]  || null,
      }))
      setComponentiImportati(comps)
      setNomi(nomiArr)
      locked.add('nomi')
      if (formaArr.length > 0) locked.add('forma_commerciale')
      if (lottiArr.length > 0) locked.add('lotto')
      if (scadArr.length > 0)  locked.add('scadenza_prodotto')
      if (aperArr.length > 0)  locked.add('data_apertura')
      if (prodArr.length > 0)  locked.add('produttore')

      const gruppi = new Map<string, ComponenteImportato[]>()
      for (const c of comps) {
        const chiave = c.lotto?.trim() || 'nolotto'
        if (!gruppi.has(chiave)) gruppi.set(chiave, [])
        gruppi.get(chiave)!.push(c)
      }
      if (gruppi.size > 1) {
        setLottiUnici([...gruppi.values()])
        setSelezioneLottiOpen(true)
      }
    }

    if (values['metodi_nomi']) {
      locked.add('metodi_nomi')
      const nomiMetodi = values['metodi_nomi'].split(';').map((s: string) => s.trim()).filter(Boolean)
      for (const nome of nomiMetodi) {
        try {
          const metodo = await window.electronAPI.invoke('metodi:get-or-create', nome) as any
          setMetodi(prev => prev.find((m: any) => m.id === metodo.id) ? prev : [...prev, metodo])
          setMetodiIds(prev => prev.includes(metodo.id) ? prev : [...prev, metodo.id])
        } catch (err) { console.error('Errore import metodo:', err) }
      }
    }

    setImportedFields(locked)
  }

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setNomi([]); setComponentiImportati(null); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      setNomi(lines)
      setComponentiImportati(null)
    }
    reader.readAsText(file)
  }

  const handleLottoSelect = (gruppo: ComponenteImportato[]) => {
    setComponentiImportati(gruppo)
    setNomi(gruppo.map(c => c.nome))

    const locked = new Set<string>(['nomi'])
    if (gruppo.some(c => c.forma_commerciale)) locked.add('forma_commerciale')
    if (gruppo.some(c => c.lotto))             locked.add('lotto')
    if (gruppo.some(c => c.scadenza_prodotto)) locked.add('scadenza_prodotto')
    if (gruppo.some(c => c.data_apertura))     locked.add('data_apertura')
    if (gruppo.some(c => c.produttore))        locked.add('produttore')
    setImportedFields(locked)

    const formaUnica = gruppo[0]?.forma_commerciale
    if (formaUnica && gruppo.every(c => c.forma_commerciale === formaUnica)) {
      setForm(f => ({ ...f, forma_commerciale: formaUnica }))
    }

    setSelezioneLottiOpen(false)
    setLottiUnici([])
  }

  const handleSave = async () => {
    if (!nomi.length) return
    if (!importedFields.has('nomi') && !form.forma_commerciale.trim()) return
    setSaving(true)
    try {
      const baseData = {
        ...form,
        forma: 'Mix',
        concentrazione: form.concentrazione ? parseFloat(form.concentrazione) : null,
        unita_conc: form.unita_conc || UNITA_DEFAULT,
        fiala: form.fiale ? String(parseInt(form.fiale)) : null,
        ubicazione: form.ubicazione || null,
        operatore_apertura: form.operatore_apertura || null,
        volume_ml: form.volume_ml ? parseFloat(form.volume_ml) : null,
        metodi_ids: metodiIds,
      }

      if (componentiImportati && componentiImportati.length > 0) {
        const gruppi = new Map<string, ComponenteImportato[]>()
        for (const comp of componentiImportati) {
          const chiave = comp.lotto?.trim() || 'nolotto'
          if (!gruppi.has(chiave)) gruppi.set(chiave, [])
          gruppi.get(chiave)!.push(comp)
        }

        if (gruppi.size > 1) {
          setSaving(false)
          setLottiUnici([...gruppi.values()])
          setSelezioneLottiOpen(true)
          return
        }

        const [, gruppo] = [...gruppi.entries()][0]
        const formaCommercialeGruppo =
          gruppo.find(c => c.forma_commerciale?.trim())?.forma_commerciale ||
          form.forma_commerciale ||
          gruppo[0]?.lotto?.trim() || ''

        // Se l'operatore ha compilato la concentrazione nel form, sovrascrive quella per-componente
        const concFormOverride = form.concentrazione ? parseFloat(form.concentrazione) : null
        const componentiFinali = concFormOverride != null
          ? gruppo.map(c => ({ ...c, concentrazione: concFormOverride }))
          : gruppo

        await compostiApi.createMix({
          ...baseData,
          forma_commerciale: formaCommercialeGruppo,
          componenti: componentiFinali,
        })

        // TASK B-3: sync anagrafiche dopo salvataggio mix
        await syncAnagrafiche({
          classe:             form.classe,
          produttore:         form.produttore,
          solvente:           form.solvente,
          stoccaggio:         form.stoccaggio,
          operatore_apertura: form.operatore_apertura,
          ubicazione:         form.ubicazione,
        })

        onSave(); onClose(); reset()
        alert(`Mix creato — ${gruppo.length} componenti aggiunti`)

      } else {
        const result = await compostiApi.createMix({
          ...baseData,
          forma_commerciale: form.forma_commerciale,
          nomi,
        })

        // TASK B-3: sync anagrafiche dopo salvataggio mix
        await syncAnagrafiche({
          classe:             form.classe,
          produttore:         form.produttore,
          solvente:           form.solvente,
          stoccaggio:         form.stoccaggio,
          operatore_apertura: form.operatore_apertura,
          ubicazione:         form.ubicazione,
        })

        onSave(); onClose(); reset()
        alert(`Mix creato — ${result.count} componenti aggiunti`)
      }

    } finally { setSaving(false) }
  }

  const canSave = nomi.length > 0 && (
    importedFields.has('nomi') ||
    form.forma_commerciale.trim() !== ''
  )
  const lockedClass = (key: string) => importedFields.has(key) ? 'bg-muted opacity-80' : ''
  const hasPerRowData = componentiImportati !== null &&
    componentiImportati.some(c => c.lotto || c.scadenza_prodotto || c.data_apertura || c.produttore)

  const numMixAnteprima = (() => {
    if (!componentiImportati || componentiImportati.length === 0) return 1
    const lotti = new Set(componentiImportati.map(c => c.lotto?.trim() || 'nolotto'))
    return lotti.size
  })()

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset() } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {mixTemplate ? `Nuovo lotto — ${mixTemplate.forma_commerciale}` : 'Aggiungi Mix Pesticidi'}
          </DialogTitle>
        </DialogHeader>

        {mixTemplate && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">ℹ️</span>
            <p>
              Stai creando un <strong>nuovo lotto</strong> del mix <strong>{mixTemplate.forma_commerciale}</strong> ({mixTemplate._nomi.length} componenti).
              I metadati comuni sono pre-compilati — compila lotto, date e operatore per il nuovo flacone.
            </p>
          </div>
        )}

        {!mixTemplate && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Carica un file .txt con un nome per riga oppure importa da file Excel/CSV.
            Verranno creati N record con i metadati comuni del flacone.
          </p>
        )}

        <div className="space-y-4">

          <div>
            <Label className="text-xs">Metodi Analitici</Label>
            {metodiToast && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-1 mb-1">✓ {metodiToast}</div>
            )}
            {metodiIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 mt-1">
                {metodiIds.map((mid: string) => {
                  const m = metodi.find(m => m.id === mid)
                  return (
                    <span key={mid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs border border-blue-200">
                      {m ? m.nome : mid}
                      <button type="button" onClick={() => handleMetodoRemove(mid)} className="hover:text-blue-600"><X className="h-3 w-3" /></button>
                    </span>
                  )
                })}
              </div>
            )}
            <div className="relative">
              <Input
                value={metodiInput}
                onChange={e => handleMetodiInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); if (metodiSuggerimenti.length === 1) handleMetodoSelect(metodiSuggerimenti[0]); else handleMetodoCreateOrAdd() }
                  if (e.key === 'Escape') { setMetodiDropdownOpen(false); setMetodiInput('') }
                }}
                placeholder="Cerca o crea metodo (es. pos_098)..."
                className="text-sm"
              />
              {metodiDropdownOpen && (metodiSuggerimenti.length > 0 || metodiInput.trim().length > 0) && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                  {metodiSuggerimenti.map(m => (
                    <button key={m.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent" onClick={() => handleMetodoSelect(m)}>{m.nome}</button>
                  ))}
                  {metodiInput.trim() && !metodi.find(m => m.nome.toLowerCase() === metodiInput.toLowerCase()) && (
                    <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-blue-600 border-t" onClick={handleMetodoCreateOrAdd}>+ Crea metodo "{metodiInput.trim()}"</button>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Associa il mix a uno o più metodi. I metodi verranno applicati a tutti i componenti.</p>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metadati comuni</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">
                Nome mix (Nome CRM)
                {!importedFields.has('forma_commerciale') && <span className="text-red-500 ml-1">*</span>}
                {importedFields.has('forma_commerciale') && <span className="ml-1 text-blue-600 font-normal normal-case">(da file, per riga)</span>}
              </Label>
              <Input value={form.forma_commerciale} onChange={e => set('forma_commerciale', e.target.value)} placeholder={importedFields.has('forma_commerciale') ? 'Valore diverso per ogni riga' : 'es. CRM Mix IA16'} disabled={importedFields.has('forma_commerciale')} className={lockedClass('forma_commerciale')} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Codice Interno</Label>
              <Input value={form.codice_interno} onChange={e => set('codice_interno', e.target.value)} placeholder="es. MIX-001" disabled={importedFields.has('codice_interno')} className={lockedClass('codice_interno')} />
            </div>
            <div>
              <Label className="text-xs">N fiale</Label>
              <Input type="number" min="1" value={form.fiale} onChange={e => set('fiale', e.target.value)} placeholder="es. 4" />
            </div>
            <div>
              <Label className="text-xs">Volume mL</Label>
              <Input type="number" step="any" value={form.volume_ml} onChange={e => set('volume_ml', e.target.value)} placeholder="es. 1.2" />
            </div>
            <div>
              <Label className="text-xs">
                Concentrazione
                {mixTemplate && <span className="ml-1 font-normal normal-case text-muted-foreground">— non compilare</span>}
              </Label>
              <Input type="number" step="any" value={form.concentrazione} onChange={e => set('concentrazione', e.target.value)} placeholder={mixTemplate ? 'lascia vuoto' : 'es. 100'} disabled={importedFields.has('concentrazione')} className={lockedClass('concentrazione')} />
              {mixTemplate && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Lascia vuoto per mantenere le concentrazioni originali di ciascun analita. Compila solo per sovrascriverle tutte con un valore unico.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Unità</Label>
              <Select value={form.unita_conc || UNITA_DEFAULT} onValueChange={v => set('unita_conc', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITA_CONCENTRAZIONE.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Solvente</Label>
              <AutocompleteInput
                value={form.solvente}
                onChange={v => set('solvente', v)}
                suggestions={solventiDisponibili}
                placeholder="es. MeOH, ACN..."
                disabled={importedFields.has('solvente')}
                className={lockedClass('solvente')}
              />
            </div>
            <div>
              <Label className="text-xs">Produttore {importedFields.has('produttore') && <span className="ml-1 text-blue-600 font-normal normal-case">(da file, per riga)</span>}</Label>
              <AutocompleteInput
                value={form.produttore}
                onChange={v => set('produttore', v)}
                suggestions={produttoriDisponibili}
                placeholder={importedFields.has('produttore') ? 'Valore diverso per ogni riga' : 'es. Sigma-Aldrich...'}
                disabled={importedFields.has('produttore')}
                className={lockedClass('produttore')}
              />
            </div>
            <div>
              <Label className="text-xs">Lotto {importedFields.has('lotto') && <span className="ml-1 text-blue-600 font-normal normal-case">(da file, per riga)</span>}</Label>
              <Input value={form.lotto} onChange={e => set('lotto', e.target.value)} disabled={importedFields.has('lotto')} className={lockedClass('lotto')} placeholder={importedFields.has('lotto') ? 'Valore diverso per ogni riga' : ''} />
            </div>
            <div>
              <Label className="text-xs">Data Apertura CRM {importedFields.has('data_apertura') && <span className="ml-1 text-blue-600 font-normal normal-case">(da file, per riga)</span>}</Label>
              <Input type="date" value={form.data_apertura} onChange={e => set('data_apertura', e.target.value)} disabled={importedFields.has('data_apertura')} className={lockedClass('data_apertura')} />
            </div>
            <div>
              <Label className="text-xs">Scadenza Prodotto {importedFields.has('scadenza_prodotto') && <span className="ml-1 text-blue-600 font-normal normal-case">(da file, per riga)</span>}</Label>
              <Input type="date" value={form.scadenza_prodotto} onChange={e => set('scadenza_prodotto', e.target.value)} disabled={importedFields.has('scadenza_prodotto')} className={lockedClass('scadenza_prodotto')} />
            </div>
            <div>
              <Label className="text-xs">Operatore Apertura</Label>
              <AutocompleteInput
                value={form.operatore_apertura}
                onChange={v => set('operatore_apertura', v)}
                suggestions={operatoriDisponibili}
                placeholder="es. Mario Rossi..."
              />
            </div>

            {/* TASK A-3: classe libera con autocomplete, sostituisce la Select hardcoded */}
            <div>
              <Label className="text-xs">Classe</Label>
              <AutocompleteInput
                value={form.classe}
                onChange={v => set('classe', v)}
                suggestions={classiDisponibili}
                placeholder="es. Pesticidi, Fitofarmaci..."
              />
            </div>

            <div>
              <Label className="text-xs">Destinazione Uso</Label>
              <Select value={form.destinazione_uso || '_none'} onValueChange={v => set('destinazione_uso', v === '_none' ? '' : v)} disabled={importedFields.has('destinazione_uso')}>
                <SelectTrigger className={lockedClass('destinazione_uso')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Nessuna —</SelectItem>
                  {DESTINAZIONI_USO.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ubicazione</Label>
              <AutocompleteInput
                value={form.ubicazione}
                onChange={v => set('ubicazione', v)}
                suggestions={ubicazioniDisponibili}
                placeholder="es. Frigo A, Lab 2..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Stoccaggio</Label>
              <AutocompleteInput
                value={form.stoccaggio || ''}
                onChange={v => set('stoccaggio', v)}
                suggestions={vociStoccaggio}
                placeholder="es. Frigo 1 — Scaffale A"
                disabled={importedFields.has('stoccaggio')}
                className={lockedClass('stoccaggio')}
              />
            </div>
            <div>
              <Label className="text-xs">Accreditamento CRM Provider</Label>
              <div className="flex gap-2">
                <Select
                  value={['ISO 17034', 'ISO 17511', 'ISO 15189', 'NIST'].includes(form.accreditamento_crm || '') ? form.accreditamento_crm : 'Altro'}
                  onValueChange={v => { if (v !== 'Altro') set('accreditamento_crm', v); else set('accreditamento_crm', '') }}
                >
                  <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ISO 17034">ISO 17034</SelectItem>
                    <SelectItem value="ISO 17511">ISO 17511</SelectItem>
                    <SelectItem value="ISO 15189">ISO 15189</SelectItem>
                    <SelectItem value="NIST">NIST</SelectItem>
                    <SelectItem value="Altro">Altro / libero</SelectItem>
                  </SelectContent>
                </Select>
                {!['ISO 17034', 'ISO 17511', 'ISO 15189', 'NIST'].includes(form.accreditamento_crm || '') && (
                  <Input value={form.accreditamento_crm || ''} onChange={e => set('accreditamento_crm', e.target.value)} placeholder="es. DAkkS, COFRAC..." className="flex-1" />
                )}
              </div>
            </div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File componenti</div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setImportTextOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importa da file
            </Button>
            <span className="text-xs text-muted-foreground">oppure</span>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importedFields.has('nomi')}>
              <Upload className="h-4 w-4 mr-1" /> Carica file .txt
            </Button>
            <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileLoad} />
            {nomi.length > 0 && <span className="text-xs font-mono text-muted-foreground">{nomi.length} componenti</span>}
          </div>

          {importedFields.has('nomi') && nomi.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                📥 {hasPerRowData
                  ? numMixAnteprima > 1
                    ? `Componenti importati — verranno creati ${numMixAnteprima} mix distinti (lotti diversi)`
                    : 'Componenti importati con dati per riga (lotto, scadenza, ecc.)'
                  : 'Nomi importati da file'}
              </span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => { setNomi([]); setComponentiImportati(null); setImportedFields(new Set()) }}>
                Rimuovi
              </button>
            </div>
          )}

          {nomi.length > 0 && (
            <div className="border rounded-md p-3 max-h-36 overflow-y-auto bg-muted/30">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Anteprima componenti</div>
              {nomi.map((n, i) => {
                const comp = componentiImportati?.[i]
                return (
                  <div key={i} className="text-xs font-mono leading-6 flex gap-3">
                    <span>{i + 1}. {n}</span>
                    {comp?.lotto && <span className="text-muted-foreground">lotto: {comp.lotto}</span>}
                    {comp?.scadenza_prodotto && <span className="text-muted-foreground">scad: {comp.scadenza_prodotto}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); reset() }}>Annulla</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving
              ? 'Creazione...'
              : numMixAnteprima > 1
                ? `Crea ${numMixAnteprima} Mix (${nomi.length} componenti)`
                : `Crea Mix (${nomi.length} componenti)`}
          </Button>
        </DialogFooter>
      </DialogContent>

      <TextImportDialog
        open={importTextOpen}
        onClose={() => setImportTextOpen(false)}
        fields={importFields}
        onImport={handleTextImport}
      />

      <Dialog open={selezioneLottiOpen} onOpenChange={v => !v && setSelezioneLottiOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleziona la mix da inserire</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Il file contiene <strong>{lottiUnici.length} lotti distinti</strong>.
              Seleziona quale mix vuoi inserire ora — per gli altri usa <strong>Importa CSV</strong> nella tabella composti.
            </p>
            <div className="space-y-2 mt-3 max-h-64 overflow-y-auto pr-1">
              {lottiUnici.map((gruppo, i) => {
                const lotto = gruppo[0]?.lotto || '— senza lotto —'
                const formaComm = gruppo[0]?.forma_commerciale || ''
                return (
                  <button key={i} type="button" className="w-full text-left rounded-md border px-4 py-3 hover:bg-muted/50 transition-colors" onClick={() => handleLottoSelect(gruppo)}>
                    <div className="text-sm font-medium font-mono">{lotto}</div>
                    {formaComm && <div className="text-xs text-muted-foreground mt-0.5">{formaComm}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">{gruppo.length} composto{gruppo.length !== 1 ? 'i' : ''}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setComponentiImportati(null); setNomi([]); setImportedFields(new Set()); setLottiUnici([]); setSelezioneLottiOpen(false) }}>
              Annulla import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}