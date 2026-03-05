import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { metodiApi } from '@/lib/api'

interface MetodoFormProps {
  open: boolean
  onClose: () => void
  metodo?: Record<string, any> | null
  strumenti: { id: string; codice: string }[]
  onSave: () => void
}

export function MetodoForm({ open, onClose, metodo, strumenti, onSave }: MetodoFormProps) {
  const isEdit = !!metodo
  const [form, setForm] = useState<Record<string, any>>({})

  useEffect(() => {
    if (metodo) {
      setForm({ ...metodo })
    } else {
      setForm({
        id: crypto.randomUUID(),
        nome: '', strumento_id: '', matrice: '', colonna: '',
        fase_a: '', fase_b: '', gradiente: '', flusso: '',
        ionizzazione: '', polarita: '', acquisizione: '', srm: '',
        lims_id: '', oqlab_id: '', note: '',
      })
    }
  }, [metodo, open])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.nome?.trim()) return
    const data = { ...form }
    // Convert empty strings to null for optional fields
    for (const k of Object.keys(data)) {
      if (k !== 'id' && k !== 'nome' && data[k] === '') data[k] = null
    }
    if (isEdit) {
      await metodiApi.update(metodo!.id, data)
    } else {
      await metodiApi.create(data)
    }
    onSave()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? 'Modifica metodo' : 'Nuovo metodo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificazione</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Strumento</Label>
              <Select value={form.strumento_id || ''} onValueChange={v => set('strumento_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>
                  {strumenti.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.codice}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Matrice</Label>
              <Input value={form.matrice || ''} onChange={e => set('matrice', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">LIMS ID</Label>
              <Input value={form.lims_id || ''} onChange={e => set('lims_id', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">OQLab ID</Label>
              <Input value={form.oqlab_id || ''} onChange={e => set('oqlab_id', e.target.value)} />
            </div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cromatografia LC</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Colonna</Label><Input value={form.colonna || ''} onChange={e => set('colonna', e.target.value)} /></div>
            <div><Label className="text-xs">Fase A</Label><Input value={form.fase_a || ''} onChange={e => set('fase_a', e.target.value)} /></div>
            <div><Label className="text-xs">Fase B</Label><Input value={form.fase_b || ''} onChange={e => set('fase_b', e.target.value)} /></div>
            <div><Label className="text-xs">Gradiente</Label><Input value={form.gradiente || ''} onChange={e => set('gradiente', e.target.value)} /></div>
            <div><Label className="text-xs">Flusso</Label><Input value={form.flusso || ''} onChange={e => set('flusso', e.target.value)} /></div>
          </div>

          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MS</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Ionizzazione</Label><Input value={form.ionizzazione || ''} onChange={e => set('ionizzazione', e.target.value)} /></div>
            <div><Label className="text-xs">Polarità</Label><Input value={form.polarita || ''} onChange={e => set('polarita', e.target.value)} /></div>
            <div><Label className="text-xs">Acquisizione</Label><Input value={form.acquisizione || ''} onChange={e => set('acquisizione', e.target.value)} /></div>
            <div><Label className="text-xs">SRM</Label><Input value={form.srm || ''} onChange={e => set('srm', e.target.value)} /></div>
          </div>

          <Separator />
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea value={form.note || ''} onChange={e => set('note', e.target.value)} rows={3} />
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
