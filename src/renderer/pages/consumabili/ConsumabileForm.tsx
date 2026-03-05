import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { consumabiliApi } from '@/lib/api'

const tipi = [
  { value: 'colonna_hplc', label: 'Colonna HPLC' },
  { value: 'spe', label: 'SPE' },
  { value: 'solvente', label: 'Solvente' },
  { value: 'sale', label: 'Sale' },
  { value: 'altro', label: 'Altro' },
]

interface ConsumabileFormProps {
  open: boolean
  onClose: () => void
  consumabile?: any | null
  metodi: any[]
  onSave: () => void
}

export function ConsumabileForm({ open, onClose, consumabile, metodi, onSave }: ConsumabileFormProps) {
  const isEdit = !!consumabile
  const [form, setForm] = useState<Record<string, any>>({})
  const [selectedMetodi, setSelectedMetodi] = useState<string[]>([])

  useEffect(() => {
    if (consumabile) {
      setForm({ ...consumabile })
      setSelectedMetodi(consumabile.metodi_ids || [])
    } else {
      setForm({
        tipo: 'colonna_hplc', nome: '', lotto: '', fornitore: '',
        data_apertura: new Date().toISOString().split('T')[0], data_chiusura: '', note: '',
      })
      setSelectedMetodi([])
    }
  }, [consumabile, open])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const toggleMetodo = (id: string) => {
    setSelectedMetodi(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!form.nome?.trim()) return
    const data = {
      ...form,
      lotto: form.lotto || null,
      fornitore: form.fornitore || null,
      data_apertura: form.data_apertura || null,
      data_chiusura: form.data_chiusura || null,
      note: form.note || null,
      metodi_ids: selectedMetodi,
    }
    if (isEdit) {
      await consumabiliApi.update(consumabile.id, data)
    } else {
      await consumabiliApi.create(data)
    }
    onSave()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? 'Modifica consumabile' : 'Nuovo consumabile'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo || ''} onValueChange={v => set('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipi.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome *</Label><Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} /></div>
            <div><Label className="text-xs">Lotto</Label><Input value={form.lotto || ''} onChange={e => set('lotto', e.target.value)} /></div>
            <div><Label className="text-xs">Fornitore</Label><Input value={form.fornitore || ''} onChange={e => set('fornitore', e.target.value)} /></div>
            <div><Label className="text-xs">Data Apertura</Label><Input type="date" value={form.data_apertura || ''} onChange={e => set('data_apertura', e.target.value)} /></div>
            <div><Label className="text-xs">Data Chiusura</Label><Input type="date" value={form.data_chiusura || ''} onChange={e => set('data_chiusura', e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Note</Label><Textarea value={form.note || ''} onChange={e => set('note', e.target.value)} rows={2} /></div>

          <div>
            <Label className="text-xs">Metodi associati</Label>
            <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md min-h-[40px]">
              {selectedMetodi.map(mid => {
                const m = metodi.find((met: any) => met.id === mid)
                return (
                  <Badge key={mid} variant="secondary" className="text-xs gap-1">
                    {m?.nome || mid}
                    <button onClick={() => toggleMetodo(mid)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
            <div className="mt-1 max-h-32 overflow-y-auto border rounded-md">
              {metodi.filter((m: any) => !selectedMetodi.includes(m.id)).map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => toggleMetodo(m.id)}
                  className="w-full text-left px-2 py-1 text-xs hover:bg-accent transition-colors"
                >
                  {m.nome}
                </button>
              ))}
            </div>
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
