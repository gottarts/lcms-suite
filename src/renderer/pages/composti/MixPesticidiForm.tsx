import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { compostiApi } from '@/lib/api'
import { Upload } from 'lucide-react'

interface MixPesticidiFormProps {
  open: boolean
  onClose: () => void
  onSave: () => void
}

export function MixPesticidiForm({ open, onClose, onSave }: MixPesticidiFormProps) {
  const [form, setForm] = useState({
    forma_commerciale: '',
    concentrazione: '',
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
  })
  const [nomi, setNomi] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [vociStoccaggio, setVociStoccaggio] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

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
  }, [])

  const reset = () => {
    setForm({
      forma_commerciale: '', concentrazione: '',
      solvente: '', produttore: '', lotto: '', data_apertura: '',
      scadenza_prodotto: '', classe: '', destinazione_uso: '',
      stoccaggio: '', accreditamento_crm: 'ISO 17034',
      codice_interno: '',
    })
    setNomi([])
    if (fileRef.current) fileRef.current.value = ''
  }

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
              <Label className="text-xs">Concentrazione mg/L (per componente)</Label>
              <Input type="number" step="any" value={form.concentrazione} onChange={e => set('concentrazione', e.target.value)} placeholder="es. 100" />
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
                  <SelectItem value="_none">--</SelectItem>
                  <SelectItem value="Taratura">Taratura</SelectItem>
                  <SelectItem value="QC">QC</SelectItem>
                  <SelectItem value="Taratura e QC">Taratura e QC</SelectItem>
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
