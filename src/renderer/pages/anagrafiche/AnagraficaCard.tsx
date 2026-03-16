import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus, Trash2, GitMerge } from 'lucide-react'
import { anagraficheApi } from '@/lib/api'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

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
  // TASK C-3: campo DB collegato — undefined = anagrafica non propagata ai composti
  campoDB?: string
}

export function AnagraficaCard({ id, nome, voci, onRefresh, onDelete, campoDB }: AnagraficaCardProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(nome)
  const [newVoce, setNewVoce] = useState('')
  const [editingVoceId, setEditingVoceId] = useState<number | null>(null)
  const [editingVoceValue, setEditingVoceValue] = useState('')

  // TASK C-3: stato per il dialog conferma rename con propagazione
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false)
  const [renamePending, setRenamePending] = useState<{ voceId: number; vecchioValore: string; nuovoValore: string } | null>(null)

  // TASK C-3: stato per il dialog merge esplicito
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null)
  const [mergeSourceValore, setMergeSourceValore] = useState('')
  const [mergeDestId, setMergeDestId] = useState<number | null>(null)

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

  // TASK C-3: quando si termina di editare una voce, se campoDB è definito chiede
  // conferma prima di propagare il rename ai composti; altrimenti usa update semplice.
  const handleUpdateVoce = async (voce: Voce) => {
    const nuovoValore = editingVoceValue.trim()
    if (!nuovoValore || nuovoValore === voce.valore) {
      setEditingVoceId(null)
      return
    }

    if (campoDB) {
      // Mostra dialog di conferma con propagazione
      setRenamePending({ voceId: voce.id, vecchioValore: voce.valore, nuovoValore })
      setRenameConfirmOpen(true)
      setEditingVoceId(null)
    } else {
      // Anagrafica non collegata a composti: rename semplice
      await anagraficheApi.updateVoce(voce.id, nuovoValore)
      setEditingVoceId(null)
      onRefresh()
    }
  }

  const handleConfirmRename = async () => {
    if (!renamePending || !campoDB) return
    await anagraficheApi.renameVocePropagate(
      renamePending.voceId,
      renamePending.nuovoValore,
      campoDB
    )
    setRenameConfirmOpen(false)
    setRenamePending(null)
    onRefresh()
  }

  const handleDeleteVoce = async (voceId: number) => {
    await anagraficheApi.deleteVoce(voceId)
    onRefresh()
  }

  // TASK C-3: apre il dialog merge per la voce sorgente
  const handleOpenMerge = (voce: Voce) => {
    setMergeSourceId(voce.id)
    setMergeSourceValore(voce.valore)
    setMergeDestId(null)
    setMergeOpen(true)
  }

  const handleConfirmMerge = async () => {
    if (!mergeSourceId || !mergeDestId || !campoDB) return
    await anagraficheApi.mergeVoci(mergeSourceId, mergeDestId, campoDB)
    setMergeOpen(false)
    setMergeSourceId(null)
    setMergeSourceValore('')
    setMergeDestId(null)
    onRefresh()
  }

  return (
    <>
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
                {campoDB && (
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                    → {campoDB}
                  </span>
                )}
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
                  onBlur={() => handleUpdateVoce(v)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleUpdateVoce(v)
                    if (e.key === 'Escape') setEditingVoceId(null)
                  }}
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

                  {/* Bottone merge — visibile solo se campoDB è definito e ci sono almeno 2 voci */}
                  {campoDB && voci.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Unisci "${v.valore}" con un'altra voce`}
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600"
                      onMouseDown={e => e.preventDefault()} // evita onBlur spurio sull'input voce
                      onClick={() => handleOpenMerge(v)}
                    >
                      <GitMerge className="h-3 w-3" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onMouseDown={e => e.preventDefault()} // evita onBlur spurio sull'input voce
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

      {/* Dialog conferma rename con propagazione ai composti */}
      <AlertDialog open={renameConfirmOpen} onOpenChange={v => !v && setRenameConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rinomina e propaga</AlertDialogTitle>
            <AlertDialogDescription>
              Rinominare <strong>{renamePending?.vecchioValore}</strong> in{' '}
              <strong>{renamePending?.nuovoValore}</strong> aggiornerà automaticamente
              tutti i composti che usano questo valore nel campo <strong>{campoDB}</strong>.
              <br /><br />
              Questa operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRenameConfirmOpen(false); setRenamePending(null) }}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRename}>
              Rinomina e aggiorna composti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog merge esplicito */}
      <AlertDialog open={mergeOpen} onOpenChange={v => !v && setMergeOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unisci voci</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tutti i composti con <strong>{campoDB}</strong> = <strong>"{mergeSourceValore}"</strong>{' '}
                  verranno spostati sulla voce che selezioni qui sotto.
                  La voce <strong>"{mergeSourceValore}"</strong> verrà eliminata.
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Unisci in:</p>
                  {voci
                    .filter(v => v.id !== mergeSourceId)
                    .map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setMergeDestId(v.id)}
                        className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                          mergeDestId === v.id
                            ? 'border-primary bg-primary/5 font-medium'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        {v.valore}
                      </button>
                    ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMergeOpen(false)}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMerge}
              disabled={!mergeDestId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Unisci e aggiorna composti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}