import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { compostiApi } from '@/lib/api'

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

  useEffect(() => {
    if (composto) {
      setForm({ ...composto })
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
      })
    } else {
      setForm({
        nome: '', codice_interno: '', formula: '', classe: '', forma: '',
        forma_commerciale: '', purezza: '', concentrazione: '', solvente: '',
        fiala: '', produttore: '', lotto: '', operatore_apertura: '',
        data_apertura: '', scadenza_prodotto: '', destinazione_uso: '',
        work_standard: '', peso_molecolare: '', ubicazione: '',
        stoccaggio: '', accreditamento_crm: 'ISO 17034',
      })
    }
  }, [composto, template, open])

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

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.nome?.trim()) return
    setSaving(true)
    try {
      const data = { ...form }
      if (data.purezza) data.purezza = parseFloat(data.purezza) || null
      if (data.concentrazione) data.concentrazione = parseFloat(data.concentrazione) || null
      if (data.peso_molecolare) data.peso_molecolare = parseFloat(data.peso_molecolare) || null
      for (const k of Object.keys(data)) {
        if (k !== 'nome' && k !== 'arpa' && data[k] === '') data[k] = null
      }
      if (isEdit) {
        await compostiApi.update(composto.id, data)
      } else {
        await compostiApi.create(data)
      }
      onSave()
      onClose()
    } catch (error) {
      console.error('Errore nel salvare il composto:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? 'Modifica composto' : template ? `Nuovo lotto — ${template.nome}` : 'Nuovo composto'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificazione</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label className="text-xs">Nome *</Label><Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} /></div>
            <div><Label className="text-xs">Codice Interno</Label><Input value={form.codice_interno || ''} onChange={e => set('codice_interno', e.target.value)} /></div>
            <div><Label className="text-xs">Formula</Label><Input value={form.formula || ''} onChange={e => set('formula', e.target.value)} /></div>
            <div><Label className="text-xs">Classe</Label><Input value={form.classe || ''} onChange={e => set('classe', e.target.value)} /></div>
            <div><Label className="text-xs">Matrice</Label><Input value={form.matrice || ''} onChange={e => set('matrice', e.target.value)} /></div>
            <div><Label className="text-xs">MW</Label><Input type="number" step="0.01" value={form.peso_molecolare || ''} onChange={e => set('peso_molecolare', e.target.value)} /></div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma e Concentrazione</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Forma</Label><Select value={form.forma || ''} onValueChange={v => set('forma', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Neat">Neat</SelectItem>
                  <SelectItem value="Solution">Solution</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs">Forma Commerciale</Label><Input value={form.forma_commerciale || ''} onChange={e => set('forma_commerciale', e.target.value)} /></div>
            <div><Label className="text-xs">Fiala</Label><Input value={form.fiala || ''} onChange={e => set('fiala', e.target.value)} /></div>
            <div><Label className="text-xs">Purezza (%)</Label><Input type="number" step="0.1" value={form.purezza || ''} onChange={e => set('purezza', e.target.value)} /></div>
            <div><Label className="text-xs">Concentrazione</Label><Input type="number" step="0.01" value={form.concentrazione || ''} onChange={e => set('concentrazione', e.target.value)} /></div>
            <div><Label className="text-xs">Solvente</Label><Input value={form.solvente || ''} onChange={e => set('solvente', e.target.value)} /></div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fornitore e Lotto</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Produttore</Label><Input value={form.produttore || ''} onChange={e => set('produttore', e.target.value)} /></div>
            <div><Label className="text-xs">Lotto</Label><Input value={form.lotto || ''} onChange={e => set('lotto', e.target.value)} /></div>
            <div><Label className="text-xs">Operatore Apertura</Label><Input value={form.operatore_apertura || ''} onChange={e => set('operatore_apertura', e.target.value)} /></div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Data Apertura</Label><Input type="date" value={form.data_apertura || ''} onChange={e => set('data_apertura', e.target.value)} /></div>
            <div><Label className="text-xs">Scadenza Prodotto</Label><Input type="date" value={form.scadenza_prodotto || ''} onChange={e => set('scadenza_prodotto', e.target.value)} /></div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uso e Ubicazione</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Destinazione d'Uso</Label><Input value={form.destinazione_uso || ''} onChange={e => set('destinazione_uso', e.target.value)} /></div>
            <div><Label className="text-xs">Work Standard</Label><Input value={form.work_standard || ''} onChange={e => set('work_standard', e.target.value)} /></div>
            <div><Label className="text-xs">Ubicazione</Label><Input value={form.ubicazione || ''} onChange={e => set('ubicazione', e.target.value)} /></div>

            {/* Stoccaggio con tendina anagrafiche */}
            <div className="col-span-2">
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

            {/* Accreditamento CRM Provider */}
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={!form.nome?.trim() || saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salva' : 'Crea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
