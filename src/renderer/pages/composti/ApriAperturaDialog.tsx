import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ApriAperturaDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  compostoId: number | null
  compostoNome?: string
  fialaNumero: number
  compostoLotto?: string | null
  conteggioLotto?: number
  onSaved: () => void
}

export function ApriAperturaDialog({
  open, onOpenChange, compostoId, compostoNome, fialaNumero, compostoLotto, conteggioLotto, onSaved
}: ApriAperturaDialogProps) {
  const [dataApertura, setDataApertura] = useState('')
  const [operatore, setOperatore] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDataApertura(new Date().toISOString().split('T')[0])
      setOperatore('')
      setNote('')
    }
  }, [open])

  const handleSave = async () => {
    if (!compostoId) return
    setSaving(true)
    await window.electronAPI.invoke('composti:apri-fiala', compostoId, {
      fiala_numero: fialaNumero,
      data_apertura: dataApertura,
      operatore: operatore || undefined,
      note: note || undefined,
    })
    setSaving(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Apertura Fiala {fialaNumero}</DialogTitle>
          {compostoNome && <p className="text-sm text-muted-foreground">{compostoNome}</p>}
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Data apertura</Label>
            <Input type="date" value={dataApertura} onChange={e => setDataApertura(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Operatore (opzionale)</Label>
            <Input value={operatore} onChange={e => setOperatore(e.target.value)} placeholder="es. Mario Rossi" />
          </div>
          <div>
            <Label className="text-xs">Note (opzionale)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          {conteggioLotto && conteggioLotto > 1 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded mb-2 w-full">
              ⚠ Questa apertura verrà registrata per tutti i {conteggioLotto} composti
              con lotto &quot;{compostoLotto}&quot;.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving || !dataApertura}>
            {saving ? 'Salvataggio...' : 'Conferma apertura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}