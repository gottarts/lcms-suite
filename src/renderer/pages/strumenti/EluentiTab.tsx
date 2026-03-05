import { useState, useEffect } from 'react'
import { eluentiApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, X, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface EluentiTabProps {
  strumentoId: string
}

export function EluentiTab({ strumentoId }: EluentiTabProps) {
  const [eluenti, setEluenti] = useState<any[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editEluente, setEditEluente] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', data_inizio: '', componenti: [{ sostanza: '', lotto: '', fornitore: '' }] })

  const load = () => eluentiApi.list(strumentoId).then(setEluenti)
  useEffect(() => { load() }, [strumentoId])

  const openNew = () => {
    setEditEluente(null)
    setForm({ nome: '', data_inizio: new Date().toISOString().split('T')[0], componenti: [{ sostanza: '', lotto: '', fornitore: '' }] })
    setFormOpen(true)
  }

  const openEdit = (e: any) => {
    setEditEluente(e)
    setForm({
      nome: e.nome,
      data_inizio: e.data_inizio,
      componenti: e.componenti?.length ? e.componenti.map((c: any) => ({ sostanza: c.sostanza || '', lotto: c.lotto || '', fornitore: c.fornitore || '' })) : [{ sostanza: '', lotto: '', fornitore: '' }],
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) return
    const data = {
      strumento_id: strumentoId,
      nome: form.nome,
      data_inizio: form.data_inizio,
      componenti: form.componenti.filter(c => c.sostanza || c.lotto || c.fornitore),
    }
    if (editEluente) {
      await eluentiApi.update(editEluente.id, { ...data, data_fine: editEluente.data_fine })
    } else {
      await eluentiApi.create(data)
    }
    setFormOpen(false)
    load()
  }

  const handleClose = async (id: string) => {
    await eluentiApi.close(id)
    load()
  }

  const handleDelete = async () => {
    if (deleteId) {
      await eluentiApi.delete(deleteId)
      setDeleteId(null)
      load()
    }
  }

  const addComponente = () => setForm(f => ({ ...f, componenti: [...f.componenti, { sostanza: '', lotto: '', fornitore: '' }] }))
  const removeComponente = (i: number) => setForm(f => ({ ...f, componenti: f.componenti.filter((_, idx) => idx !== i) }))
  const updateComponente = (i: number, key: string, value: string) => {
    setForm(f => ({
      ...f,
      componenti: f.componenti.map((c, idx) => idx === i ? { ...c, [key]: value } : c),
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{eluenti.length} eluenti</span>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuovo eluente</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Data Inizio</TableHead>
            <TableHead>Data Fine</TableHead>
            <TableHead>Componenti</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="w-24">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eluenti.map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-medium cursor-pointer hover:text-primary" onClick={() => openEdit(e)}>{e.nome}</TableCell>
              <TableCell>{formatDate(e.data_inizio)}</TableCell>
              <TableCell>{formatDate(e.data_fine)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {e.componenti?.map((c: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {c.sostanza} {c.lotto ? `(${c.lotto})` : ''}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {e.data_fine ? (
                  <Badge variant="secondary" className="text-xs">Esaurito</Badge>
                ) : (
                  <Badge className="text-xs bg-green-100 text-green-800 border-green-200" variant="outline">Attivo</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {!e.data_fine && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleClose(e.id)}>Esaurisci</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(e.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {eluenti.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">Nessun eluente registrato</div>
      )}

      {/* Eluente form dialog */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editEluente ? 'Modifica eluente' : 'Nuovo eluente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div><Label className="text-xs">Data Inizio</Label><Input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} /></div>
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">Componenti</div>
            {form.componenti.map((c, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1"><Label className="text-xs">Sostanza</Label><Input value={c.sostanza} onChange={e => updateComponente(i, 'sostanza', e.target.value)} className="h-8 text-sm" /></div>
                <div className="flex-1"><Label className="text-xs">Lotto</Label><Input value={c.lotto} onChange={e => updateComponente(i, 'lotto', e.target.value)} className="h-8 text-sm" /></div>
                <div className="flex-1"><Label className="text-xs">Fornitore</Label><Input value={c.fornitore} onChange={e => updateComponente(i, 'fornitore', e.target.value)} className="h-8 text-sm" /></div>
                {form.componenti.length > 1 && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeComponente(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addComponente}><Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi componente</Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={!form.nome.trim()}>
              {editEluente ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        title="Elimina eluente"
        message="Eliminare questo eluente e tutte le sue componenti?"
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
