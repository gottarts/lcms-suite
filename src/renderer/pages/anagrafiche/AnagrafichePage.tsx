import { useState, useEffect } from 'react'
import { anagraficheApi } from '@/lib/api'
import { AnagraficaCard } from './AnagraficaCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface Anagrafica {
  id: number
  nome: string
  voci: { id: number; anagrafica_id: number; valore: string }[]
}

export function AnagrafichePage() {
  const [anagrafiche, setAnagrafiche] = useState<Anagrafica[]>([])
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    const data = await anagraficheApi.list()
    setAnagrafiche(data)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    await anagraficheApi.create(newName.trim())
    setNewName('')
    setShowNew(false)
    load()
  }

  const handleDelete = async () => {
    if (deleteId !== null) {
      await anagraficheApi.delete(deleteId)
      setDeleteId(null)
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Anagrafiche</h2>
        <span className="text-sm text-muted-foreground">{anagrafiche.length} dizionari</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {anagrafiche.map(a => (
          <AnagraficaCard
            key={a.id}
            id={a.id}
            nome={a.nome}
            voci={a.voci}
            onRefresh={load}
            onDelete={id => setDeleteId(id)}
          />
        ))}

        {/* New card button */}
        {showNew ? (
          <div className="rounded-lg border-2 border-dashed border-border p-4 flex flex-col items-center justify-center gap-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setShowNew(false); setNewName('') }
              }}
              placeholder="Nome anagrafica..."
              autoFocus
              className="text-center"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Crea</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewName('') }}>Annulla</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg border-2 border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[120px]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm">Nuova anagrafica</span>
          </button>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Elimina anagrafica"
        message="Sei sicuro di voler eliminare questa anagrafica e tutte le sue voci?"
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
