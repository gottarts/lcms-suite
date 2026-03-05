import { useState, useEffect, useMemo } from 'react'
import { consumabiliApi, metodiApi } from '@/lib/api'
import { ConsumabileForm } from './ConsumabileForm'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const tipoLabels: Record<string, string> = {
  colonna_hplc: 'Colonna HPLC',
  spe: 'SPE',
  solvente: 'Solvente',
  sale: 'Sale',
  altro: 'Altro',
}

export function ConsumabiliPage() {
  const [consumabili, setConsumabili] = useState<any[]>([])
  const [metodi, setMetodi] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('tutti')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    const [c, m] = await Promise.all([consumabiliApi.list(), metodiApi.list()])
    setConsumabili(c)
    setMetodi(m)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = consumabili
    if (tipoFilter !== 'tutti') {
      result = result.filter(c => c.tipo === tipoFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.nome?.toLowerCase().includes(q) ||
        c.lotto?.toLowerCase().includes(q) ||
        c.fornitore?.toLowerCase().includes(q)
      )
    }
    return result
  }, [consumabili, tipoFilter, search])

  const handleClose = async (id: number) => {
    await consumabiliApi.close(id)
    load()
  }

  const handleDelete = async () => {
    if (deleteId !== null) {
      await consumabiliApi.delete(deleteId)
      setDeleteId(null)
      load()
    }
  }

  const handleEdit = (item: any) => {
    setEditItem(item)
    setFormOpen(true)
  }

  const columns: Column<any>[] = [
    { key: 'tipo', label: 'Tipo', render: (v) => <Badge variant="outline" className="text-xs">{tipoLabels[v as string] || String(v)}</Badge> },
    { key: 'nome', label: 'Nome', className: 'font-medium cursor-pointer', render: (v, row) => <span onClick={() => handleEdit(row)} className="hover:text-primary">{String(v)}</span> },
    { key: 'lotto', label: 'Lotto' },
    { key: 'fornitore', label: 'Fornitore' },
    { key: 'data_apertura', label: 'Apertura', render: (v) => formatDate(v as string) },
    { key: 'data_chiusura', label: 'Chiusura', render: (v) => formatDate(v as string) },
    {
      key: 'stato',
      label: 'Stato',
      sortable: false,
      render: (_, row) => row.data_chiusura
        ? <Badge variant="secondary" className="text-xs">Chiuso</Badge>
        : <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">Aperto</Badge>,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      className: 'w-24',
      render: (_, row) => (
        <div className="flex gap-1">
          {!row.data_chiusura && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleClose(row.id) }}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Chiudi
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Consumabili</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} consumabili</span>
          <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo consumabile
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Tabs value={tipoFilter} onValueChange={setTipoFilter}>
          <TabsList>
            <TabsTrigger value="tutti">Tutti</TabsTrigger>
            <TabsTrigger value="colonna_hplc">Colonne HPLC</TabsTrigger>
            <TabsTrigger value="spe">SPE</TabsTrigger>
            <TabsTrigger value="solvente">Solventi</TabsTrigger>
            <TabsTrigger value="sale">Sali</TabsTrigger>
            <TabsTrigger value="altro">Altro</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="pl-9" />
        </div>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="Nessun consumabile trovato" />

      <ConsumabileForm open={formOpen} onClose={() => setFormOpen(false)} consumabile={editItem} metodi={metodi} onSave={load} />

      <ConfirmDialog open={deleteId !== null} title="Elimina consumabile" message="Eliminare questo consumabile?" confirmLabel="Elimina" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}
