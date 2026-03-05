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
  onSave: () => void
}

export function CompostoForm({ open, onClose, composto, onSave }: CompostoFormProps) {
  const isEdit = !!composto
  const [form, setForm] = useState<Record<string, any>>({})

  useEffect(() => {
    if (composto) {
      setForm({ ...composto })
    } else {
      setForm({
        nome: '', codice_interno: '', formula: '', classe: '', forma: '',
        forma_commerciale: '', purezza: '', concentrazione: '', solvente: '',
        fiala: '', produttore: '', lotto: '', operatore_apertura: '',
        data_apertura: '', scadenza_prodotto: '', destinazione_uso: '',
        work_standard: '', matrice: '', peso_molecolare: '', ubicazione: '',
        arpa: 'N', mix: '', mix_id: '',
      })
    }
  }, [composto, open])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.nome?.trim()) return
    const data = { ...form }
    // Convert numeric fields
    if (data.purezza) data.purezza = parseFloat(data.purezza) || null
    if (data.concentrazione) data.concentrazione = parseFloat(data.concentrazione) || null
    if (data.peso_molecolare) data.peso_molecolare = parseFloat(data.peso_molecolare) || null
    // Convert empty strings to null
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
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? 'Modifica composto' : 'Nuovo composto'}</DialogTitle>
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
            <div><Label className="text-xs">Forma</Label><Input value={form.forma || ''} onChange={e => set('forma', e.target.value)} /></div>
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
            <div>
              <Label className="text-xs">ARPA</Label>
              <Select value={form.arpa || 'N'} onValueChange={v => set('arpa', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="N">No</SelectItem>
                  <SelectItem value="S">Si</SelectItem>
                </SelectContent>
              </Select>
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
          <Button onClick={handleSave} disabled={!form.nome?.trim()}>
            {isEdit ? 'Salva' : 'Crea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
