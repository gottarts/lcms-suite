import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { compostiApi } from '@/lib/api'

interface StoriaDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  compostoId: number | null
  compostoNome?: string
  tipo: 'Rivalidazione' | 'Dismissione' | ''
  onSaved: () => void
}

export function StoriaDialog({ open, onOpenChange, compostoId, compostoNome, tipo, onSaved }: StoriaDialogProps) {
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [nRegistroQc, setNRegistroQc] = useState('')
  const [batchAnalitico, setBatchAnalitico] = useState('')
  const [lottoCrmValido, setLottoCrmValido] = useState('')
  const [lottiValidi, setLottiValidi] = useState<any[]>([])

  useEffect(() => {
    if (open && compostoId) {
      setData(new Date().toISOString().split('T')[0])
      setNote('')
      setNRegistroQc('')
      setBatchAnalitico('')
      setLottoCrmValido('')

      if (tipo === 'Rivalidazione') {
        window.electronAPI.invoke('composti:lotti-validi', compostoId)
          .then(lotti => setLottiValidi(lotti as any[]))
      } else {
        setLottiValidi([])
      }
    }
  }, [open, compostoId, tipo])

  const handleConfirm = async () => {
    if (!compostoId || !tipo) return
    await compostiApi.addStoria(compostoId, {
      tipo,
      data,
      note: note || undefined,
      n_registro_qc: nRegistroQc || undefined,
      batch_analitico: batchAnalitico || undefined,
      lotto_crm_valido: lottoCrmValido || undefined,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{tipo}</DialogTitle>
          {compostoNome && (
            <p className="text-sm text-muted-foreground">{compostoNome}</p>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Data {tipo}</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>

          {tipo === 'Rivalidazione' && (
            <>
              <div>
                <Label className="text-xs">N° Registro QC</Label>
                <Input value={nRegistroQc} onChange={e => setNRegistroQc(e.target.value)} placeholder="es. QC-2024-0123" />
              </div>
              <div>
                <Label className="text-xs">Batch analitico</Label>
                <Input value={batchAnalitico} onChange={e => setBatchAnalitico(e.target.value)} placeholder="es. B2024-03-15" />
              </div>
              <div>
                <Label className="text-xs">
                  Lotto CRM valido
                  {lottiValidi.length > 0 && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      ({lottiValidi.length} disponibil{lottiValidi.length === 1 ? 'e' : 'i'})
                    </span>
                  )}
                </Label>
                {lottiValidi.length > 0 && (
                  <Select value={lottoCrmValido || '_manual'} onValueChange={v => setLottoCrmValido(v === '_manual' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona lotto..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_manual">— Inserisci manualmente —</SelectItem>
                      {lottiValidi.map((l: any) => (
                        <SelectItem key={l.id} value={l.lotto || String(l.id)}>
                          <span className="font-mono text-xs">
                            {l.lotto || 'N/D'}
                            {l.scadenza_prodotto && <span className="text-muted-foreground ml-2">scad. {l.scadenza_prodotto}</span>}
                            {l.forma_commerciale && <span className="text-muted-foreground ml-1">· {l.forma_commerciale}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(lottiValidi.length === 0 || lottoCrmValido === '') && (
                  <Input
                    className={lottiValidi.length > 0 ? 'mt-1' : ''}
                    value={lottoCrmValido}
                    onChange={e => setLottoCrmValido(e.target.value)}
                    placeholder="es. FN0872121"
                  />
                )}
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Note</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleConfirm} disabled={!data || !tipo}>Conferma</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}