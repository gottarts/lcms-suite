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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, computeStato } from '@/components/shared/StatusBadge'
import { Plus, Search, FlaskConical, X } from 'lucide-react'

const STATO_MAP: Record<string, string> = {
  'Attivo': 'attivo',
  'In scadenza': 'in_scadenza',
  'Scaduto': 'scaduto',
  'Dismesso': 'dismesso',
}

export function CompostiPage() {
  const [composti, setComposti] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('Tutti')
  const [filtroWork, setFiltroWork] = useState('Tutti')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editComposto, setEditComposto] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [panelId, setPanelId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [mixOpen, setMixOpen] = useState(false)
  const [storiaTarget, setStoriaTarget] = useState<{ id: number; nome: string; tipo: 'Rivalidazione' | 'Dismissione' } | null>(null)

  const load = () => compostiApi.list().then(setComposti)
  useEffect(() => { load() }, [])

  const opzioniWork = useMemo(() => [
    'Tutti',
    ...Array.from(
      new Set(
        composti
          .map(c => c.work_standard)
          .filter((v): v is string => !!v && v.trim() !== '')
      )
    ).sort()
  ], [composti])

  const filtered = useMemo(() => {
    let result = composti

    // ricerca testuale
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.nome?.toLowerCase().includes(q) ||
        c.codice_interno?.toLowerCase().includes(q) ||
        c.classe?.toLowerCase().includes(q) ||
        c.produttore?.toLowerCase().includes(q) ||
        c.lotto?.toLowerCase().includes(q) ||
        c.ubicazione?.toLowerCase().includes(q) ||
        c.solvente?.toLowerCase().includes(q) ||
        c.forma_commerciale?.toLowerCase().includes(q) ||
        c.destinazione_uso?.toLowerCase().includes(q) ||
        c.forma?.toLowerCase().includes(q) ||
        c.formula?.toLowerCase().includes(q) ||
        c.fiala?.toLowerCase().includes(q) ||
        c.operatore_apertura?.toLowerCase().includes(q) ||
        c.stoccaggio?.toLowerCase().includes(q) ||
        c.accreditamento_crm?.toLowerCase().includes(q)
      )
    }

    // filtro stato
    if (filtroStato !== 'Tutti') {
      result = result.filter(c => computeStato(c) === STATO_MAP[filtroStato])
    }

    // filtro work solution
    if (filtroWork !== 'Tutti') {
      result = result.filter(c => c.work_standard === filtroWork)
    }

    // filtro metodo (se presente)
    if (filtroMetodo) {
      result = result.filter(c => c.metodo_id === filtroMetodo)
    }

    return result
  }, [composti, search, filtroStato, filtroWork, filtroMetodo])

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
          <span className="text-sm text-muted-foreground">
            Visualizzati: {filtered.length} / Totali: {composti.length}
          </span>
          <Button size="sm" variant="outline" onClick={() => setMixOpen(true)}>
            <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
          </Button>
          <Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo composto
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, lotto, produttore, classe..." className="pl-9" />
          </div>
          <Select value={filtroStato} onValueChange={setFiltroStato}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tutti">Tutti</SelectItem>
              <SelectItem value="Attivo">Attivo</SelectItem>
              <SelectItem value="In scadenza">In scadenza</SelectItem>
              <SelectItem value="Scaduto">Scaduto</SelectItem>
              <SelectItem value="Dismesso">Dismesso</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroWork} onValueChange={setFiltroWork}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Work Solution" />
            </SelectTrigger>
            <SelectContent>
              {opzioniWork.map(opzione => (
                <SelectItem key={opzione} value={opzione}>
                  {opzione}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtroStato !== 'Tutti' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Stato: {filtroStato}
              <button onClick={() => setFiltroStato('Tutti')} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
            </Badge>
          )}
          {filtroWork !== 'Tutti' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Work: {filtroWork}
              <button onClick={() => setFiltroWork('Tutti')} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
            </Badge>
          )}
        </div>
      </div>

      <CompostiTable
        data={filtered}
        onRowClick={row => setPanelId(row.id)}
        onNewLotto={handleNewLotto}
        onRivalida={handleRivalida}
        onDismetti={handleDismetti}
        onRefresh={load}
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