import { useState, useEffect, useMemo } from 'react'
import { metodiApi, strumentiApi } from '@/lib/api'
import { MetodoCard } from './MetodoCard'
import { MetodoForm } from './MetodoForm'
import { MetodoDrawer } from './MetodoDrawer'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'

export function MetodiPage() {
  const [metodi, setMetodi] = useState<any[]>([])
  const [strumenti, setStrumenti] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStrumento, setFilterStrumento] = useState<string>('__all__')
  const [formOpen, setFormOpen] = useState(false)
  const [editMetodo, setEditMetodo] = useState<any>(null)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    const [m, s] = await Promise.all([metodiApi.list(), strumentiApi.list()])
    setMetodi(m)
    setStrumenti(s)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = metodi
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(m =>
        m.nome?.toLowerCase().includes(q) || m.matrice?.toLowerCase().includes(q)
      )
    }
    if (filterStrumento && filterStrumento !== '__all__') {
      result = result.filter(m => m.strumento_id === filterStrumento)
    }
    return result
  }, [metodi, search, filterStrumento])

  const handleDelete = async () => {
    if (deleteId) {
      await metodiApi.delete(deleteId)
      setDeleteId(null)
      setDrawerId(null)
      load()
    }
  }

  const handleEdit = (metodo: any) => {
    setEditMetodo(metodo)
    setDrawerId(null)
    setFormOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Metodi Analitici</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} metodi</span>
          <Button size="sm" onClick={() => { setEditMetodo(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo metodo
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca metodo..."
            className="pl-9"
          />
        </div>
        <Select value={filterStrumento} onValueChange={setFilterStrumento}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tutti gli strumenti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti gli strumenti</SelectItem>
            {strumenti.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.codice}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(m => (
          <MetodoCard key={m.id} metodo={m} onClick={() => setDrawerId(m.id)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12 text-sm">Nessun metodo trovato</div>
      )}

      <MetodoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        metodo={editMetodo}
        strumenti={strumenti}
        onSave={load}
      />

      <MetodoDrawer
        metodoId={drawerId}
        onClose={() => setDrawerId(null)}
        onEdit={handleEdit}
        onDelete={id => { setDrawerId(null); setDeleteId(id) }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Elimina metodo"
        message="Sei sicuro di voler eliminare questo metodo? Le associazioni con composti e consumabili saranno rimosse."
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
