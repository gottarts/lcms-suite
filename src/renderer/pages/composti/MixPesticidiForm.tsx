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

// FEAT-J: stessa lista usata in CompostoForm e CompostiPage
const DESTINAZIONI_USO = [
  'Taratura',
  'Controllo qualità',
  'Taratura+Controllo qualità',
  'Standard Interno',
]

interface MixPesticidiFormProps {
  open: boolean
  onClose: () => void
  onSave: () => void
}

export function MixPesticidiForm({ open, onClose, onSave }: MixPesticidiFormProps) {
  const [form, setForm] = useState({
    forma_commerciale: '',
    concentrazione: '',
    unita_conc: UNITA_DEFAULT,
    solvente: '',
    produttore: '',
    lotto: '',
    data_apertura: '',
    scadenza_prodotto: '',
    classe: '',
    destinazione_uso: '',
    stoccaggio: '',
    accreditamento_crm: 'ISO 17034',
    codice_interno: '',
    fiale: '1',
  })
  const [nomi, setNomi] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [vociStoccaggio, setVociStoccaggio] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // FEAT-metodi-campo
  const [metodi, setMetodi] = useState<any[]>([])
  const [metodiIds, setMetodiIds] = useState<string[]>([])
  const [metodiInput, setMetodiInput] = useState('')
  const [metodiSuggerimenti, setMetodiSuggerimenti] = useState<any[]>([])
  const [metodiDropdownOpen, setMetodiDropdownOpen] = useState(false)
  const [metodiToast, setMetodiToast] = useState('')

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    try {
      window.electronAPI.invoke('anagrafiche:list').then((anagrafiche: any[]) => {
        const anagrafica = anagrafiche.find(
          (a: any) => a.nome.toLowerCase().includes('stoccaggio') ||
                      a.nome.toLowerCase().includes('posizioni')
        )
        if (anagrafica?.voci) {
          setVociStoccaggio(anagrafica.voci.map((v: any) => v.valore))
        }
      }).catch(err => console.error('Error loading anagrafiche:', err))
    } catch (err) {
      console.error('Error in useEffect:', err)
    }

    // Carica la lista metodi disponibili
    window.electronAPI.invoke('metodi:list').then((result: unknown) => {
      setMetodi(result as any[])
    }).catch(err => console.error('Error loading metodi:', err))
  }, [])

  const reset = () => {
    setForm({
      forma_commerciale: '', concentrazione: '', unita_conc: UNITA_DEFAULT,
      solvente: '', produttore: '', lotto: '', data_apertura: '',
      scadenza_prodotto: '', classe: '', destinazione_uso: '',
      stoccaggio: '', accreditamento_crm: 'ISO 17034',
      codice_interno: '',
      fiale: '1',
    })
    setNomi([])
    setMetodiIds([])
    setMetodiInput('')
    setMetodiToast('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // --- Gestione campo Metodi ---

  const handleMetodiInput = (val: string) => {
    setMetodiInput(val)
    if (val.trim().length === 0) {
      setMetodiSuggerimenti([])
      setMetodiDropdownOpen(false)
      return
    }
    const filtered = metodi.filter(m =>
      m.nome.toLowerCase().includes(val.toLowerCase()) &&
      !metodiIds.includes(m.id)
    )
    setMetodiSuggerimenti(filtered)
    setMetodiDropdownOpen(true)
  }

  const handleMetodoSelect = (metodo: any) => {
    if (!metodiIds.includes(metodo.id)) {
      setMetodiIds(prev => [...prev, metodo.id])
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
    setMetodiIds(prev => prev.filter(id => id !== metodoId))
  }

  // --- Fine gestione Metodi ---

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setNomi([]); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      setNomi(lines)
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    if (!form.forma_commerciale.trim() || !nomi.length) return
    setSaving(true)
    try {
      const data = {
        ...form,
        forma: 'mix',
        concentrazione: form.concentrazione ? parseFloat(form.concentrazione) : null,
        unita_conc: form.unita_conc || UNITA_DEFAULT,
        fiala: form.fiale ? String(parseInt(form.fiale)) : null,
        metodi_ids: metodiIds,
        nomi,
      }
      const result = await compostiApi.createMix(data)
      onSave()
      onClose()
      reset()
      alert(`Mix "${form.forma_commerciale}" creato — ${result.count} componenti aggiunti`)
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.forma_commerciale.trim() && nomi.length > 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset() } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Aggiungi Mix Pesticidi</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Carica un file .txt con un nome per riga. Verranno creati N record con i metadati comuni del flacone.
        </p>

        <div className="space-y-4">

          {/* FEAT-metodi-campo: campo Metodi in cima */}
          <div>
            <Label className="text-xs">Metodi Analitici</Label>

            {metodiToast && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-1 mb-1">
                ✓ {metodiToast}
              </div>
            )}

            {metodiIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 mt-1">
                {metodiIds.map((mid: string) => {
                  const m = metodi.find(m => m.id === mid)
                  return (
                    <span key={mid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs border border-blue-200">
                      {m ? m.nome : mid}
                      <button type="button" onClick={() => handleMetodoRemove(mid)} className="hover:text-blue-600">
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
              Associa il mix a uno o più metodi. I metodi verranno applicati a tutti i componenti.
            </p>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metadati comuni</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome mix (Forma Commerciale) *</Label>
              <Input value={form.forma_commerciale} onChange={e => set('forma_commerciale', e.target.value)} placeholder="es. CRM Mix IA16" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Codice Interno</Label>
              <Input value={form.codice_interno} onChange={e => set('codice_interno', e.target.value)} placeholder="es. MIX-001" />
            </div>
            <div>
              <Label className="text-xs">N fiale</Label>
              <Input
                type="number"
                min="1"
                value={form.fiale}
                onChange={e => set('fiale', e.target.value)}
                placeholder="es. 4"
              />
            </div>
            <div>
              <Label className="text-xs">Concentrazione</Label>
              <Input type="number" step="any" value={form.concentrazione} onChange={e => set('concentrazione', e.target.value)} placeholder="es. 100" />
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
              <Input value={form.solvente} onChange={e => set('solvente', e.target.value)} placeholder="es. MeOH" />
            </div>
            <div>
              <Label className="text-xs">Produttore</Label>
              <Input value={form.produttore} onChange={e => set('produttore', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Lotto</Label>
              <Input value={form.lotto} onChange={e => set('lotto', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data Apertura CRM</Label>
              <Input type="date" value={form.data_apertura} onChange={e => set('data_apertura', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Scadenza Prodotto</Label>
              <Input type="date" value={form.scadenza_prodotto} onChange={e => set('scadenza_prodotto', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Classe</Label>
              <Select value={form.classe || '_none'} onValueChange={v => set('classe', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">--</SelectItem>
                  <SelectItem value="Antibiotico">Antibiotico</SelectItem>
                  <SelectItem value="Antiviral">Antiviral</SelectItem>
                  <SelectItem value="FANS">FANS</SelectItem>
                  <SelectItem value="Antimicotico">Antimicotico</SelectItem>
                  <SelectItem value="Diuretico">Diuretico</SelectItem>
                  <SelectItem value="psyco">psyco</SelectItem>
                  <SelectItem value="cardio">cardio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Destinazione Uso</Label>
              <Select value={form.destinazione_uso || '_none'} onValueChange={v => set('destinazione_uso', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Nessuna —</SelectItem>
                  {DESTINAZIONI_USO.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stoccaggio e Accreditamento CRM */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Stoccaggio</Label>
              {vociStoccaggio.length > 0 ? (
                <Select
                  value={form.stoccaggio || '_none'}
                  onValueChange={v => set('stoccaggio', v === '_none' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona posizione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nessuna —</SelectItem>
                    {vociStoccaggio.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.stoccaggio || ''}
                  onChange={e => set('stoccaggio', e.target.value)}
                  placeholder="es. Frigo 1 — Scaffale A"
                />
              )}
              {vociStoccaggio.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Aggiungi posizioni in Anagrafiche → Posizioni stoccaggio per abilitare la tendina.
                </p>
              )}
            </div>

            <div>
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
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File componenti</div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Carica file .txt
            </Button>
            <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileLoad} />
            {nomi.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground">{nomi.length} componenti</span>
            )}
          </div>

          {nomi.length > 0 && (
            <div className="border rounded-md p-3 max-h-36 overflow-y-auto bg-muted/30">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Anteprima componenti</div>
              {nomi.map((n, i) => (
                <div key={i} className="text-xs font-mono leading-6">{i + 1}. {n}</div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); reset() }}>Annulla</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Creazione...' : `Crea Mix (${nomi.length} componenti)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}