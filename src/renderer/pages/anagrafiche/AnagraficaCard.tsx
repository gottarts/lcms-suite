import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Pencil, Plus, Trash2 } from 'lucide-react'
import { anagraficheApi } from '@/lib/api'

interface Voce {
  id: number
  anagrafica_id: number
  valore: string
}

interface AnagraficaCardProps {
  id: number
  nome: string
  voci: Voce[]
  onRefresh: () => void
  onDelete: (id: number) => void
}

export function AnagraficaCard({ id, nome, voci, onRefresh, onDelete }: AnagraficaCardProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(nome)
  const [newVoce, setNewVoce] = useState('')
  const [editingVoceId, setEditingVoceId] = useState<number | null>(null)
  const [editingVoceValue, setEditingVoceValue] = useState('')

  const handleRenameSave = async () => {
    if (nameValue.trim() && nameValue !== nome) {
      await anagraficheApi.rename(id, nameValue.trim())
      onRefresh()
    }
    setEditingName(false)
  }

  const handleAddVoce = async () => {
    if (!newVoce.trim()) return
    await anagraficheApi.addVoce(id, newVoce.trim())
    setNewVoce('')
    onRefresh()
  }

  const handleUpdateVoce = async (voceId: number) => {
    if (editingVoceValue.trim()) {
      await anagraficheApi.updateVoce(voceId, editingVoceValue.trim())
      onRefresh()
    }
    setEditingVoceId(null)
  }

  const handleDeleteVoce = async (voceId: number) => {
    await anagraficheApi.deleteVoce(voceId)
    onRefresh()
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          {editingName ? (
            <Input
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleRenameSave}
              onKeyDown={e => e.key === 'Enter' && handleRenameSave()}
              autoFocus
              className="h-7 text-sm font-semibold"
            />
          ) : (
            <CardTitle
              className="text-sm cursor-pointer hover:text-primary transition-colors"
              onClick={() => { setNameValue(nome); setEditingName(true) }}
            >
              {nome}
            </CardTitle>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-1">
        {voci.map(v => (
          <div key={v.id} className="flex items-center gap-1 group text-sm">
            {editingVoceId === v.id ? (
              <Input
                value={editingVoceValue}
                onChange={e => setEditingVoceValue(e.target.value)}
                onBlur={() => handleUpdateVoce(v.id)}
                onKeyDown={e => e.key === 'Enter' && handleUpdateVoce(v.id)}
                autoFocus
                className="h-6 text-xs flex-1"
              />
            ) : (
              <>
                <span
                  className="flex-1 cursor-pointer hover:text-primary transition-colors truncate"
                  onClick={() => { setEditingVoceId(v.id); setEditingVoceValue(v.valore) }}
                >
                  {v.valore}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteVoce(v.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}
        <div className="flex items-center gap-1 pt-2">
          <Input
            value={newVoce}
            onChange={e => setNewVoce(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddVoce()}
            placeholder="Aggiungi voce..."
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddVoce} disabled={!newVoce.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
