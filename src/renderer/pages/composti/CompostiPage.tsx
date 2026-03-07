import { useState, useEffect, useMemo } from 'react'
import { compostiApi } from '@/lib/api'
import { CompostiTable } from './CompostiTable'
import { CompostoForm } from './CompostoForm'
import { CompostoPanel } from './CompostoPanel'
import { MixPesticidiForm } from './MixPesticidiForm'
import { StoriaDialog } from './StoriaDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, FlaskConical } from 'lucide-react'

export function CompostiPage() {
  const [composti, setComposti] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editComposto, setEditComposto] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [panelId, setPanelId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [mixOpen, setMixOpen] = useState(false)
  const [storiaTarget, setStoriaTarget] = useState<{ id: number; nome: string; tipo: 'Rivalidazione' | 'Dismissione' } | null>(null)

  const load = () => compostiApi.list().then(setComposti)
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search) return composti
    const q = search.toLowerCase()
    return composti.filter(c =>
      c.nome?.toLowerCase().includes(q) ||
      c.codice_interno?.toLowerCase().includes(q) ||
      c.classe?.toLowerCase().includes(q) ||
      c.produttore?.toLowerCase().includes(q) ||
      c.lotto?.toLowerCase().includes(q)
    )
  }, [composti, search])

  const handleDelete = async () => {
    if (deleteId !== null) {
      await compostiApi.delete(deleteId)
      setDeleteId(null)
      setPanelId(null)
      load()
    }
  }

  const handleEdit = (composto: any) => {
    setEditComposto(composto)
    setPanelId(null)
    setFormOpen(true)
  }

  const handleNewLotto = (composto: any) => {
    setTemplate(composto)
    setEditComposto(null)
    setPanelId(null)
    setFormOpen(true)
  }

  const handleRivalida = (row: any) => {
    setStoriaTarget({ id: row.id, nome: row.nome, tipo: 'Rivalidazione' })
  }

  const handleDismetti = (row: any) => {
    setStoriaTarget({ id: row.id, nome: row.nome, tipo: 'Dismissione' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Standard di Riferimento</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} composti</span>
          <Button size="sm" variant="outline" onClick={() => setMixOpen(true)}>
            <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
          </Button>
          <Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo composto
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca composto..." className="pl-9" />
        </div>
      </div>

      <CompostiTable
        data={filtered}
        onRowClick={row => setPanelId(row.id)}
        onNewLotto={handleNewLotto}
        onRivalida={handleRivalida}
        onDismetti={handleDismetti}
      />

      <CompostoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setTemplate(null) }}
        composto={editComposto}
        template={template}
        onSave={() => { load(); setTemplate(null) }}
      />
      <MixPesticidiForm open={mixOpen} onClose={() => setMixOpen(false)} onSave={load} />
      <CompostoPanel
        compostoId={panelId}
        onClose={() => setPanelId(null)}
        onEdit={handleEdit}
        onDelete={id => { setPanelId(null); setDeleteId(id) }}
        onNewLotto={handleNewLotto}
      />
      <StoriaDialog
        open={storiaTarget !== null}
        onOpenChange={v => !v && setStoriaTarget(null)}
        compostoId={storiaTarget?.id ?? null}
        compostoNome={storiaTarget?.nome}
        tipo={storiaTarget?.tipo ?? ''}
        onSaved={() => { load(); setStoriaTarget(null) }}
      />
      <ConfirmDialog
        open={deleteId !== null}
        title="Elimina composto"
        message="Eliminare questo composto e tutti i dati correlati (preparazioni, storia, associazioni metodi)?"
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
