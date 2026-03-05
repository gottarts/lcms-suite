import { useState } from 'react'
import { preparazioniApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'

interface PreparazioniTabProps {
  compostoId: number
  preparazioni: any[]
  onRefresh: () => void
}

const EMPTY_FORM = {
  forma: '', stato: 'Attiva', concentrazione: '', solvente: '',
  flacone: '', operatore: '', data_prep: '', scadenza: '',
  posizione: '', note: '',
}

function statusBadgeClass(stato: string) {
  switch (stato) {
    case 'Attiva': return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    case 'Esaurita': return 'bg-amber-100 text-amber-700 border-amber-300'
    case 'Scaduta': return 'bg-red-100 text-red-700 border-red-300'
    case 'Dismessa': return 'bg-gray-100 text-gray-500 border-gray-300'
    default: return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

function isExpiringSoon(scadenza: string | null): boolean {
  if (!scadenza) return false
  const diff = new Date(scadenza).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

export function PreparazioniTab({ compostoId, preparazioni, onRefresh }: PreparazioniTabProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editPrep, setEditPrep] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [dismissId, setDismissId] = useState<number | null>(null)
  const [dismissDate, setDismissDate] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const openNew = () => {
    setEditPrep(null)
    setForm({ ...EMPTY_FORM, data_prep: new Date().toISOString().split('T')[0] })
    setFormOpen(true)
  }

  const openEdit = (p: any) => {
    setEditPrep(p)
    setForm({
      forma: p.forma || '', stato: p.stato || 'Attiva',
      concentrazione: p.concentrazione || '', solvente: p.solvente || '',
      flacone: p.flacone || '', operatore: p.operatore || '',
      data_prep: p.data_prep || '', scadenza: p.scadenza || '',
      posizione: p.posizione || '', note: p.note || '',
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    const data = {
      composto_id: compostoId,
      forma: form.forma || null,
      stato: form.stato || 'Attiva',
      concentrazione: form.concentrazione || null,
      solvente: form.solvente || null,
      flacone: form.flacone || null,
      operatore: form.operatore || null,
      data_prep: form.data_prep || null,
      scadenza: form.scadenza || null,
      posizione: form.posizione || null,
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

  const handleDismiss = async () => {
    if (dismissId !== null && dismissDate) {
      await preparazioniApi.dismiss(dismissId, dismissDate)
      setDismissId(null)
      setDismissDate('')
      onRefresh()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{preparazioni.length} preparazioni</span>
        <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Nuova preparazione</Button>
      </div>

      {preparazioni.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-5">Nessuna preparazione registrata.</p>
      )}

      {preparazioni.map(p => {
        const isDismessa = p.stato === 'Dismessa'
        const expiring = !isDismessa && isExpiringSoon(p.scadenza)
        return (
          <div key={p.id} className={cn('border rounded-md overflow-hidden', isDismessa && 'opacity-60')}>
            {/* Card header */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold font-mono text-primary">
                  {p.forma || '—'} — {p.flacone || '#?'}
                </span>
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusBadgeClass(p.stato || 'Attiva'))}>
                  {p.stato || 'Attiva'}
                </Badge>
              </div>
              <div className="flex gap-1">
                {!isDismessa && (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-600" onClick={() => { setDismissId(p.id); setDismissDate(new Date().toISOString().split('T')[0]) }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {/* Card body */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2.5">
              <Field label="Concentrazione" value={p.concentrazione ? `${p.concentrazione} mg/L` : null} />
              <Field label="Solvente" value={p.solvente} />
              <Field label="Volume (mL)" value={p.flacone} />
              <Field label="Operatore" value={p.operatore} />
              <Field label="Data Prep." value={formatDate(p.data_prep)} />
              <Field label="Scadenza" value={formatDate(p.scadenza)} className={expiring ? 'text-amber-600 font-semibold' : undefined} />
              <Field label="Posizione" value={p.posizione} className="col-span-2" />
              {p.note && <Field label="Note" value={p.note} className="col-span-2" />}
              {isDismessa && p.data_dismissione && (
                <Field label="Data dismissione" value={formatDate(p.data_dismissione)} className="col-span-2 text-destructive" />
              )}
            </div>
          </div>
        )
      })}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editPrep ? 'Modifica preparazione' : 'Nuova preparazione stock'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Forma</Label>
                <Select value={form.forma || '_none'} onValueChange={v => setForm(f => ({ ...f, forma: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">--</SelectItem>
                    <SelectItem value="Solido">Solido</SelectItem>
                    <SelectItem value="Liquido">Liquido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Stato</Label>
                <Select value={form.stato} onValueChange={v => setForm(f => ({ ...f, stato: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Attiva">Attiva</SelectItem>
                    <SelectItem value="Esaurita">Esaurita</SelectItem>
                    <SelectItem value="Scaduta">Scaduta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Concentrazione (mg/L)</Label><Input value={form.concentrazione} onChange={e => setForm(f => ({ ...f, concentrazione: e.target.value }))} /></div>
              <div><Label className="text-xs">Volume soluzione (mL)</Label><Input value={form.flacone} onChange={e => setForm(f => ({ ...f, flacone: e.target.value }))} placeholder="es. 1.5" /></div>
              <div><Label className="text-xs">Solvente</Label><Input value={form.solvente} onChange={e => setForm(f => ({ ...f, solvente: e.target.value }))} /></div>
              <div><Label className="text-xs">Operatore</Label><Input value={form.operatore} onChange={e => setForm(f => ({ ...f, operatore: e.target.value }))} /></div>
              <div><Label className="text-xs">Data Preparazione</Label><Input type="date" value={form.data_prep} onChange={e => setForm(f => ({ ...f, data_prep: e.target.value }))} /></div>
              <div><Label className="text-xs">Scadenza</Label><Input type="date" value={form.scadenza} onChange={e => setForm(f => ({ ...f, scadenza: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Posizione</Label><Input value={form.posizione} onChange={e => setForm(f => ({ ...f, posizione: e.target.value }))} placeholder="es. Freezer -20C, Box 3" /></div>
            <div><Label className="text-xs">Note</Label><Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button onClick={handleSave}>{editPrep ? 'Salva' : 'Crea'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss dialog */}
      <Dialog open={dismissId !== null} onOpenChange={v => !v && setDismissId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">Dismetti preparazione</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs">Data dismissione</Label>
            <Input type="date" value={dismissDate} onChange={e => setDismissDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDismissId(null)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDismiss} disabled={!dismissDate}>Dismetti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} title="Elimina preparazione" message="Eliminare questa preparazione?" confirmLabel="Elimina" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}

function Field({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-mono">{value || '—'}</div>
    </div>
  )
}
