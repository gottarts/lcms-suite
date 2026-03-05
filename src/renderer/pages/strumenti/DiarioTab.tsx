import { useState, useEffect } from 'react'
import { diarioApi, metodiApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface DiarioTabProps {
  strumentoId: string
}

export function DiarioTab({ strumentoId }: DiarioTabProps) {
  const [entries, setEntries] = useState<any[]>([])
  const [metodi, setMetodi] = useState<any[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({ data: '', autore: '', metodo_id: '', testo: '' })

  const load = async () => {
    const [e, m] = await Promise.all([diarioApi.list(strumentoId), metodiApi.list()])
    setEntries(e)
    setMetodi(m.filter((met: any) => met.strumento_id === strumentoId))
  }

  useEffect(() => { load() }, [strumentoId])

  const openNew = () => {
    setEditEntry(null)
    setForm({ data: new Date().toISOString().split('T')[0], autore: '', metodo_id: '', testo: '' })
    setFormOpen(true)
  }

  const openEdit = (entry: any) => {
    setEditEntry(entry)
    setForm({ data: entry.data, autore: entry.autore || '', metodo_id: entry.metodo_id || '', testo: entry.testo })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.testo.trim() || !form.data) return
    const data = {
      strumento_id: strumentoId,
      data: form.data,
      autore: form.autore || null,
      metodo_id: form.metodo_id || null,
      testo: form.testo,
    }
    if (editEntry) {
      await diarioApi.update(editEntry.id, data)
    } else {
      await diarioApi.create(data)
    }
    setFormOpen(false)
    load()
  }

  const handleDelete = async () => {
    if (deleteId !== null) {
      await diarioApi.delete(deleteId)
      setDeleteId(null)
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{entries.length} note</span>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuova nota</Button>
      </div>

      <div className="space-y-3">
        {entries.map(e => (
          <div key={e.id} className="p-3 border rounded-md bg-card group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(e.data)}</span>
                {e.autore && <span>— {e.autore}</span>}
                {e.metodo_nome && <Badge variant="outline" className="text-xs">{e.metodo_nome}</Badge>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{e.testo}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">Nessuna nota nel diario</div>
      )}

      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editEntry ? 'Modifica nota' : 'Nuova nota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data *</Label><Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
              <div><Label className="text-xs">Autore</Label><Input value={form.autore} onChange={e => setForm(f => ({ ...f, autore: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Metodo</Label>
              <Select value={form.metodo_id} onValueChange={v => setForm(f => ({ ...f, metodo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuno</SelectItem>
                  {metodi.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Testo *</Label><Textarea value={form.testo} onChange={e => setForm(f => ({ ...f, testo: e.target.value }))} rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={!form.testo.trim() || !form.data}>
              {editEntry ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} title="Elimina nota" message="Eliminare questa nota dal diario?" confirmLabel="Elimina" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}
