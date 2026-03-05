import { useState } from 'react'
import { preparazioniApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface PreparazioniTabProps {
  compostoId: number
  preparazioni: any[]
  onRefresh: () => void
}

export function PreparazioniTab({ compostoId, preparazioni, onRefresh }: PreparazioniTabProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editPrep, setEditPrep] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({
    flacone: '', concentrazione: '', solvente: '', data_prep: '', scadenza: '', operatore: '', note: '',
  })

  const openNew = () => {
    setEditPrep(null)
    setForm({ flacone: '', concentrazione: '', solvente: '', data_prep: new Date().toISOString().split('T')[0], scadenza: '', operatore: '', note: '' })
    setFormOpen(true)
  }

  const openEdit = (p: any) => {
    setEditPrep(p)
    setForm({
      flacone: p.flacone || '', concentrazione: p.concentrazione || '',
      solvente: p.solvente || '', data_prep: p.data_prep || '',
      scadenza: p.scadenza || '', operatore: p.operatore || '', note: p.note || '',
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    const data = {
      composto_id: compostoId,
      ...form,
      flacone: form.flacone || null, concentrazione: form.concentrazione || null,
      solvente: form.solvente || null, data_prep: form.data_prep || null,
      scadenza: form.scadenza || null, operatore: form.operatore || null,
      note: form.note || null,
    }
    if (editPrep) {
      await preparazioniApi.update(editPrep.id, data)
    } else {
      await preparazioniApi.create(data)
    }
    setFormOpen(false)
    onRefresh()
  }

  const handleDelete = async () => {
    if (deleteId !== null) {
      await preparazioniApi.delete(deleteId)
      setDeleteId(null)
      onRefresh()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{preparazioni.length} preparazioni</span>
        <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Nuova</Button>
      </div>

      {preparazioni.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flacone</TableHead>
              <TableHead>Conc.</TableHead>
              <TableHead>Solvente</TableHead>
              <TableHead>Data Prep</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Operatore</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preparazioni.map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.flacone || '—'}</TableCell>
                <TableCell>{p.concentrazione || '—'}</TableCell>
                <TableCell>{p.solvente || '—'}</TableCell>
                <TableCell>{formatDate(p.data_prep)}</TableCell>
                <TableCell>{formatDate(p.scadenza)}</TableCell>
                <TableCell>{p.operatore || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editPrep ? 'Modifica preparazione' : 'Nuova preparazione'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Flacone</Label><Input value={form.flacone} onChange={e => setForm(f => ({ ...f, flacone: e.target.value }))} /></div>
              <div><Label className="text-xs">Concentrazione</Label><Input value={form.concentrazione} onChange={e => setForm(f => ({ ...f, concentrazione: e.target.value }))} /></div>
              <div><Label className="text-xs">Solvente</Label><Input value={form.solvente} onChange={e => setForm(f => ({ ...f, solvente: e.target.value }))} /></div>
              <div><Label className="text-xs">Operatore</Label><Input value={form.operatore} onChange={e => setForm(f => ({ ...f, operatore: e.target.value }))} /></div>
              <div><Label className="text-xs">Data Preparazione</Label><Input type="date" value={form.data_prep} onChange={e => setForm(f => ({ ...f, data_prep: e.target.value }))} /></div>
              <div><Label className="text-xs">Scadenza</Label><Input type="date" value={form.scadenza} onChange={e => setForm(f => ({ ...f, scadenza: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Note</Label><Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button onClick={handleSave}>{editPrep ? 'Salva' : 'Crea'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} title="Elimina preparazione" message="Eliminare questa preparazione?" confirmLabel="Elimina" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}
