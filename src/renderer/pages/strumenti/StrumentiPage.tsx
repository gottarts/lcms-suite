import { useState, useEffect } from 'react'
import { strumentiApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Settings } from 'lucide-react'
import { EluentiTab } from './EluentiTab'
import { MetodiReadonlyTab } from './MetodiReadonlyTab'
import { DiarioTab } from './DiarioTab'
import { QueryTab } from './QueryTab'

export function StrumentiPage() {
  const [strumenti, setStrumenti] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editStrumento, setEditStrumento] = useState<any>(null)
  const [form, setForm] = useState({ id: '', codice: '', tipo: '', seriale: '', status: 'off' })

  const load = async () => {
    const data = await strumentiApi.list()
    setStrumenti(data)
    if (!selectedId && data.length > 0) setSelectedId(data[0].id)
  }

  useEffect(() => { load() }, [])

  const selected = strumenti.find(s => s.id === selectedId)

  const openNew = () => {
    setEditStrumento(null)
    setForm({ id: crypto.randomUUID(), codice: '', tipo: '', seriale: '', status: 'off' })
    setFormOpen(true)
  }

  const openEdit = () => {
    if (!selected) return
    setEditStrumento(selected)
    setForm({ id: selected.id, codice: selected.codice, tipo: selected.tipo || '', seriale: selected.seriale || '', status: selected.status || 'off' })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.codice.trim()) return
    const data = { ...form, tipo: form.tipo || null, seriale: form.seriale || null }
    if (editStrumento) {
      await strumentiApi.update(editStrumento.id, data)
    } else {
      await strumentiApi.create(data)
      setSelectedId(data.id)
    }
    setFormOpen(false)
    load()
  }

  const statusColors: Record<string, string> = {
    on: 'bg-green-500',
    idle: 'bg-yellow-500',
    off: 'bg-gray-400',
  }

  return (
    <div>
      {/* Instrument selector strip */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {strumenti.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
              selectedId === s.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', statusColors[s.status] || 'bg-gray-400')} />
            {s.codice}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4" />
        </Button>
        {selected && (
          <Button size="sm" variant="ghost" onClick={openEdit}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Selected instrument info */}
      {selected && (
        <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
          <span>Tipo: {selected.tipo || '—'}</span>
          <span>Seriale: {selected.seriale || '—'}</span>
        </div>
      )}

      {/* Inner tabs */}
      {selected ? (
        <Tabs defaultValue="eluenti" className="w-full">
          <TabsList>
            <TabsTrigger value="eluenti">Eluenti</TabsTrigger>
            <TabsTrigger value="metodi">Metodi</TabsTrigger>
            <TabsTrigger value="diario">Diario</TabsTrigger>
            <TabsTrigger value="query">Query Storico</TabsTrigger>
          </TabsList>
          <TabsContent value="eluenti">
            <EluentiTab strumentoId={selected.id} />
          </TabsContent>
          <TabsContent value="metodi">
            <MetodiReadonlyTab strumentoId={selected.id} />
          </TabsContent>
          <TabsContent value="diario">
            <DiarioTab strumentoId={selected.id} />
          </TabsContent>
          <TabsContent value="query">
            <QueryTab strumentoId={selected.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center text-muted-foreground py-12 text-sm">
          {strumenti.length === 0 ? 'Nessuno strumento registrato. Aggiungine uno.' : 'Seleziona uno strumento.'}
        </div>
      )}

      {/* Add/edit strumento dialog */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editStrumento ? 'Modifica strumento' : 'Nuovo strumento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Codice *</Label><Input value={form.codice} onChange={e => setForm(f => ({ ...f, codice: e.target.value }))} /></div>
            <div><Label className="text-xs">Tipo</Label><Input value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} /></div>
            <div><Label className="text-xs">Seriale</Label><Input value={form.seriale} onChange={e => setForm(f => ({ ...f, seriale: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Stato</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Acceso</SelectItem>
                  <SelectItem value="idle">Standby</SelectItem>
                  <SelectItem value="off">Spento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={!form.codice.trim()}>
              {editStrumento ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
