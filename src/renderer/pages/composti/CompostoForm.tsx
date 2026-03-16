import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import { compostiApi } from '@/lib/api'
import { UNITA_CONCENTRAZIONE, UNITA_DEFAULT } from '@/lib/unita'
import { AutocompleteInput } from '@/components/shared/AutocompleteInput'
import { syncAnagrafiche } from '@/lib/anagrafiche-sync'

const DESTINAZIONI_USO = [
  'Taratura',
  'Controllo qualità',
  'Taratura+Controllo qualità',
  'Standard Interno',
]

interface CompostoFormProps {
  open: boolean
  onClose: () => void
  composto?: any | null
  template?: any | null
  onSave: () => void
}

export function CompostoForm({ open, onClose, composto, template, onSave }: CompostoFormProps) {
  const isEdit = !!composto
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [vociStoccaggio, setVociStoccaggio] = useState<string[]>([])
  const [warningDate, setWarningDate] = useState(false)
  const [confirmMixOpen, setConfirmMixOpen] = useState(false)
  const [mixCount, setMixCount] = useState(0)

  // FEAT-metodi-campo
  const [metodi, setMetodi] = useState<any[]>([])
  const [metodiInput, setMetodiInput] = useState('')
  const [metodiSuggerimenti, setMetodiSuggerimenti] = useState<any[]>([])
  const [metodiDropdownOpen, setMetodiDropdownOpen] = useState(false)
  const [metodiToast, setMetodiToast] = useState('')

  // TASK A-3: suggerimenti autocomplete (classe, produttore, solvente, ubicazione)
  const [classiDisponibili, setClassiDisponibili] = useState<string[]>([])
  const [produttoriDisponibili, setProduttoriDisponibili] = useState<string[]>([])
  const [solventiDisponibili, setSolventiDisponibili] = useState<string[]>([])
  const [ubicazioniDisponibili, setUbicazioniDisponibili] = useState<string[]>([])
  const [operatoriDisponibili, setOperatoriDisponibili] = useState<string[]>([])

  useEffect(() => {
    if (composto) {
      setForm({ ...composto })
      if (composto.mix_id) {
        window.electronAPI.invoke('composti:count-by-mix', composto.mix_id)
          .then((n: unknown) => setMixCount(n as number))
          .catch(() => setMixCount(0))
      } else {
        setMixCount(0)
      }
    } else if (template) {
      setForm({
        ...template,
        lotto: '',
        data_apertura: '',
        scadenza_prodotto: '',
        operatore_apertura: '',
        purezza: '',
        data_dismissione: '',
        metodi_ids: template.metodi_ids || [],
        stoccaggio: template.stoccaggio,
        accreditamento_crm: template.accreditamento_crm ?? 'ISO 17034',
        volume_ml: template.volume_ml ?? '',
      })
      setMixCount(0)
    } else {
      setForm({
        nome: '', codice_interno: '', formula: '', classe: '', forma: '',
        forma_commerciale: '', purezza: '', concentrazione: '', unita_conc: UNITA_DEFAULT, solvente: '',
        fiala: '', produttore: '', lotto: '', operatore_apertura: '',
        data_apertura: '', scadenza_prodotto: '', destinazione_uso: '',
        work_standard: '', peso_molecolare: '', ubicazione: '',
        stoccaggio: '', accreditamento_crm: 'ISO 17034',
        metodi_ids: [],
        volume_ml: '',
      })
      setMixCount(0)
    }
    setWarningDate(false)
    setMetodiInput('')
    setMetodiToast('')
  }, [composto, template, open])

  useEffect(() => {
    // Carica anagrafiche una sola volta e ne estrae le voci per ogni campo
    window.electronAPI.invoke('anagrafiche:list').then((anagrafiche: any[]) => {
      const voci = (nomeMatch: string) => {
        const found = anagrafiche.find((a: any) => a.nome.toLowerCase().includes(nomeMatch))
        return found?.voci?.map((v: any) => v.valore) ?? []
      }
      setVociStoccaggio(voci('stoccaggio') || voci('posizioni'))

      // Suggerimenti per i campi autocomplete — dall'anagrafica (già popolata dal sync)
      // con fallback ai valori distinti nel DB composti (union dei due)
      const classiAnagrafica: string[] = voci('classi') || voci('classe')
      const produttoriAnagrafica: string[] = voci('produttori') || voci('fornitori')
      const solventiAnagrafica: string[] = voci('solventi')
      const ubicazioniAnagrafica: string[] = voci('ubicazioni') || voci('stanze')
      const operatoriAnagrafica: string[] = voci('operatori')

      // Merge con i valori distinti dal DB composti (deduplica, case-insensitive)
      const merge = (fromAnagrafica: string[], campo: string) =>
        window.electronAPI.invoke('composti:distinct-values', campo)
          .then((fromDb: unknown) => {
            const db = fromDb as string[]
            const set = new Map<string, string>()
            ;[...fromAnagrafica, ...db].forEach(v => set.set(v.toLowerCase(), v))
            return [...set.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  // --- Gestione campo Metodi ---

  const handleMetodiInput = (val: string) => {
    setMetodiInput(val)
    if (val.trim().length === 0) {
      setMetodiSuggerimenti([])
      setMetodiDropdownOpen(false)
      return
    }
    const currentIds = (form.metodi_ids || []) as string[]
    const filtered = metodi.filter(m =>
      m.nome.toLowerCase().includes(val.toLowerCase()) &&
      !currentIds.includes(m.id)
    )
    setMetodiSuggerimenti(filtered)
    setMetodiDropdownOpen(true)
  }

  const handleMetodoSelect = (metodo: any) => {
    const currentIds = (form.metodi_ids || []) as string[]
    if (!currentIds.includes(metodo.id)) {
      setForm(f => ({ ...f, metodi_ids: [...currentIds, metodo.id] }))
    }
    setMetodiInput('')
    setMetodiSuggerimenti([])
    setMetodiDropdownOpen(false)
  }

  const handleMetodoCreateOrAdd = async () => {
    const nome = metodiInput.trim()
    if (!nome) return
    try {
      const esistente = metodi.find(m => m.nome.toLowerCase() === nome.toLowerCase())
      const metodo = await window.electronAPI.invoke('metodi:get-or-create', nome) as any
      handleMetodoSelect(metodo)
      setMetodi(prev => prev.find(m => m.id === metodo.id) ? prev : [...prev, metodo])
      if (!esistente) {
        setMetodiToast(`Metodo "${nome}" creato`)
        setTimeout(() => setMetodiToast(''), 2500)
      }
    } catch (err) {
      console.error('Errore creazione metodo:', err)
    }
  }

  const handleMetodoRemove = (metodoId: string) => {
    const currentIds = (form.metodi_ids || []) as string[]
    setForm(f => ({ ...f, metodi_ids: currentIds.filter(id => id !== metodoId) }))
  }

  // --- Fine gestione Metodi ---

  const doSave = async () => {
    setSaving(true)
    try {
      const data = { ...form }
      if (data.purezza) data.purezza = parseFloat(data.purezza) || null
      if (data.concentrazione) data.concentrazione = parseFloat(data.concentrazione) || null
      if (data.peso_molecolare) data.peso_molecolare = parseFloat(data.peso_molecolare) || null
      if (data.volume_ml) data.volume_ml = parseFloat(data.volume_ml) || null
      for (const k of Object.keys(data)) {
        if (k !== 'nome' && k !== 'arpa' && k !== 'metodi_ids' && data[k] === '') data[k] = null
      }

      if (isEdit) {
        await compostiApi.update(composto.id, data)
      } else {
        await compostiApi.create(data)
      }

      // TASK B-3: sync automatico anagrafiche dopo il salvataggio
      await syncAnagrafiche({
        classe:             form.classe,
        produttore:         form.produttore,
        solvente:           form.solvente,
        stoccaggio:         form.stoccaggio,
        operatore_apertura: form.operatore_apertura,
        ubicazione:         form.ubicazione,
      })

      onSave()

      if (form.data_apertura && form.scadenza_prodotto) {
        const apertura = new Date(form.data_apertura)
        const scadenza = new Date(form.scadenza_prodotto)
        if (apertura >= scadenza) {
          setWarningDate(true)
          return
        }
      }

      onClose()
    } catch (error) {
      console.error('Errore nel salvare il composto:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.nome?.trim()) return
    setWarningDate(false)

    if (isEdit && form.mix_id && mixCount > 1) {
      setConfirmMixOpen(true)
      return
    }

    await doSave()
  }

  const handleConfirmMix = async () => {
    setConfirmMixOpen(false)
    await doSave()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {isEdit ? 'Modifica composto' : template ? `Nuovo lotto — ${template.nome}` : 'Nuovo composto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {isEdit && form.mix_id && mixCount > 1 && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">ℹ️</span>
                <p>
                  Questo composto fa parte del mix <strong>{form.mix}</strong> ({mixCount} componenti).
                  Il salvataggio aggiornerà tutti i campi comuni a tutti i componenti del mix.
                </p>
              </div>
            )}

            {/* Campo Metodi */}
            <div className="mb-2">
              <Label className="text-xs">Metodi Analitici</Label>

              {metodiToast && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-1 mb-1">
                  ✓ {metodiToast}
                </div>
              )}

              {((form.metodi_ids || []) as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 mt-1">
                  {((form.metodi_ids || []) as string[]).map((mid: string) => {
                    const m = metodi.find(m => m.id === mid)
                    return (
                      <span key={mid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs border border-blue-200">
                        {m ? m.nome : mid}
                        <button
                          type="button"
                          onClick={() => handleMetodoRemove(mid)}
                          className="hover:text-blue-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
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
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (metodiSuggerimenti.length === 1) {
                        handleMetodoSelect(metodiSuggerimenti[0])
                      } else {
                        handleMetodoCreateOrAdd()
                      }
                    }
                    if (e.key === 'Escape') {
                      setMetodiDropdownOpen(false)
                      setMetodiInput('')
                    }
                  }}
                  placeholder="Cerca o crea metodo (es. pos_098)..."
                  className="text-sm"
                />

                {metodiDropdownOpen && (metodiSuggerimenti.length > 0 || metodiInput.trim().length > 0) && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                    {metodiSuggerimenti.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                        onClick={() => handleMetodoSelect(m)}
                      >
                        {m.nome}
                      </button>
                    ))}
                    {metodiInput.trim() && !metodi.find(m => m.nome.toLowerCase() === metodiInput.toLowerCase()) && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-blue-600 border-t"
                        onClick={handleMetodoCreateOrAdd}
                      >
                        + Crea metodo "{metodiInput.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Digita per cercare tra i metodi esistenti o premi Invio / clicca "+ Crea" per aggiungerne uno nuovo.
              </p>
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificazione</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Codice Interno</Label>
                <Input value={form.codice_interno || ''} onChange={e => set('codice_interno', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Formula</Label>
                <Input value={form.formula || ''} onChange={e => set('formula', e.target.value)} />
              </div>

              {/* TASK A-3: classe libera con autocomplete */}
              <div>
                <Label className="text-xs">Classe</Label>
                <AutocompleteInput
                  value={form.classe || ''}
                  onChange={v => set('classe', v)}
                  suggestions={classiDisponibili}
                  placeholder="es. Pesticidi, Antibiotici..."
                />
              </div>

              <div>
                <Label className="text-xs">MW</Label>
                <Input type="number" step="0.01" value={form.peso_molecolare || ''} onChange={e => set('peso_molecolare', e.target.value)} />
              </div>
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma e Concentrazione</div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Forma</Label>
                <Select value={form.forma || ''} onValueChange={v => set('forma', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Neat">Neat</SelectItem>
                    <SelectItem value="Solution">Solution</SelectItem>
                    <SelectItem value="Mix">Mix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Forma Commerciale</Label>
                <Input value={form.forma_commerciale || ''} onChange={e => set('forma_commerciale', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">N° Fiale</Label>
                <Input value={form.fiala || ''} onChange={e => set('fiala', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Purezza (%)</Label>
                <Input type="number" step="0.1" value={form.purezza || ''} onChange={e => set('purezza', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Concentrazione</Label>
                <Input type="number" step="0.01" value={form.concentrazione || ''} onChange={e => set('concentrazione', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Unità</Label>
                <Select value={form.unita_conc || UNITA_DEFAULT} onValueChange={v => set('unita_conc', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITA_CONCENTRAZIONE.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Solvente</Label>
                <AutocompleteInput
                  value={form.solvente || ''}
                  onChange={v => set('solvente', v)}
                  suggestions={solventiDisponibili}
                  placeholder="es. MeOH, ACN..."
                />
              </div>
              {(form.forma === 'Solution' || form.forma === 'Mix') && (
                <div>
                  <Label className="text-xs">Volume mL</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.volume_ml || ''}
                    onChange={e => set('volume_ml', e.target.value)}
                    placeholder="es. 1.2"
                  />
                </div>
              )}
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fornitore e Lotto</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Produttore</Label>
                <AutocompleteInput
                  value={form.produttore || ''}
                  onChange={v => set('produttore', v)}
                  suggestions={produttoriDisponibili}
                  placeholder="es. Sigma-Aldrich..."
                />
              </div>
              <div>
                <Label className="text-xs">Lotto</Label>
                <Input value={form.lotto || ''} onChange={e => set('lotto', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Operatore Apertura</Label>
                <AutocompleteInput
                  value={form.operatore_apertura || ''}
                  onChange={v => set('operatore_apertura', v)}
                  suggestions={operatoriDisponibili}
                  placeholder="es. Mario Rossi..."
                />
              </div>
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data Apertura</Label>
                <Input type="date" value={form.data_apertura || ''} onChange={e => set('data_apertura', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Scadenza Prodotto</Label>
                <Input type="date" value={form.scadenza_prodotto || ''} onChange={e => set('scadenza_prodotto', e.target.value)} />
              </div>
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uso e Ubicazione</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Destinazione d'Uso</Label>
                <Select
                  value={form.destinazione_uso || '_none'}
                  onValueChange={v => set('destinazione_uso', v === '_none' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nessuna —</SelectItem>
                    {DESTINAZIONI_USO.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Work Standard</Label>
                <Input value={form.work_standard || ''} onChange={e => set('work_standard', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Ubicazione</Label>
                <AutocompleteInput
                  value={form.ubicazione || ''}
                  onChange={v => set('ubicazione', v)}
                  suggestions={ubicazioniDisponibili}
                  placeholder="es. Frigo A, Lab 2..."
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Stoccaggio</Label>
                <AutocompleteInput
                  value={form.stoccaggio || ''}
                  onChange={v => set('stoccaggio', v)}
                  suggestions={vociStoccaggio}
                  placeholder="es. Frigo 1 — Scaffale A"
                />
              </div>

              <div className="col-span-1">
                <Label className="text-xs">Accreditamento CRM Provider</Label>
                <div className="flex gap-2">
                  <Select
                    value={['ISO 17034', 'ISO 17511', 'ISO 15189', 'NIST'].includes(form.accreditamento_crm || '') ? form.accreditamento_crm : 'Altro'}
                    onValueChange={v => {
                      if (v !== 'Altro') set('accreditamento_crm', v)
                      else set('accreditamento_crm', '')
                    }}
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
                    <Input
                      value={form.accreditamento_crm || ''}
                      onChange={e => set('accreditamento_crm', e.target.value)}
                      placeholder="es. DAkkS, COFRAC..."
                      className="flex-1"
                    />
                  )}
                </div>
              </div>

              {form.mix_id && (
                <div className="col-span-2">
                  <Label className="text-xs">Mix</Label>
                  <div className="text-sm text-muted-foreground mt-1 font-mono">{form.mix} ({form.mix_id})</div>
                </div>
              )}
            </div>

            {warningDate && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className="font-medium">Attenzione: date anomale</p>
                  <p className="text-xs mt-0.5">La data di apertura è uguale o successiva alla data di scadenza. Il record è stato salvato correttamente — verifica le date.</p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={onClose}>
                    Chiudi
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Annulla</Button>
            <Button onClick={handleSave} disabled={!form.nome?.trim() || saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MIX-SYNC: dialog di conferma propagazione */}
      <Dialog open={confirmMixOpen} onOpenChange={v => !v && setConfirmMixOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Modifica in blocco mix</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Questo composto fa parte del mix <strong>{form.mix}</strong> che contiene <strong>{mixCount} componenti</strong>.
            </p>
            <p className="text-muted-foreground">
              Tutti i campi comuni (lotto, date, concentrazione, destinazione, work standard, ubicazione, metodi e altri) verranno aggiornati su tutti i componenti del mix. Solo il nome del singolo composto rimarrà invariato.
            </p>
            <p className="font-medium">Vuoi procedere?</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmMixOpen(false)}>Annulla</Button>
            <Button onClick={handleConfirmMix} disabled={saving}>
              {saving ? 'Salvando...' : `Aggiorna tutti i ${mixCount} componenti`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}