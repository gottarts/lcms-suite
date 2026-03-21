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
  onSavedBulk?: (payload: any) => Promise<void>
  isBulk?: boolean
  bulkLottiDistinti?: number  // n. lotti distinti nella selezione — banner appare solo se > 1
}

export function StoriaDialog({
  open, onOpenChange, compostoId, compostoNome, tipo, onSaved, onSavedBulk, isBulk, bulkLottiDistinti,
}: StoriaDialogProps) {
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [nRegistroQc, setNRegistroQc] = useState('')
  const [batchAnalitico, setBatchAnalitico] = useState('')
  const [lottoCrmValido, setLottoCrmValido] = useState('')
  const [lottiValidi, setLottiValidi] = useState<any[]>([])
  const [nuovaScadenza, setNuovaScadenza] = useState('')

  // In bulk rivalidazione, lotto CRM e nuova scadenza si specificano
  // per lotto nel dialog lotto-scope — qui vengono nascosti.
  const showLottoScadenza = tipo === 'Rivalidazione' && !isBulk

  // Banner avviso: solo se bulk rivalidazione con più di un lotto distinto nella selezione
  const showBulkWarning = isBulk && tipo === 'Rivalidazione' && (bulkLottiDistinti ?? 0) > 1

  useEffect(() => {
    if (!open) return
    setData(new Date().toISOString().split('T')[0])
    setNote('')
    setNRegistroQc('')
    setBatchAnalitico('')
    setLottoCrmValido('')
    setNuovaScadenza('')
    setLottiValidi([])
    if (showLottoScadenza && compostoId) {
      window.electronAPI.invoke('composti:lotti-validi', compostoId)
        .then(lotti => setLottiValidi(lotti as any[]))
    }
  }, [open, compostoId, tipo, isBulk])

  const handleConfirm = async () => {
    if (!tipo) return
    const payload = {
      tipo,
      data,
      note: note || undefined,
      n_registro_qc: nRegistroQc || undefined,
      batch_analitico: batchAnalitico || undefined,
      lotto_crm_valido: showLottoScadenza ? (lottoCrmValido || undefined) : undefined,
      nuova_scadenza: showLottoScadenza ? (nuovaScadenza || undefined) : undefined,
    }
    if (onSavedBulk) {
      await onSavedBulk(payload)
      onOpenChange(false)
    } else {
      if (!compostoId) return
      await compostiApi.addStoria(compostoId, payload)
      onOpenChange(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{tipo}</DialogTitle>
          {compostoNome && <p className="text-sm text-muted-foreground">{compostoNome}</p>}
        </DialogHeader>

        {/* Banner avviso lotti multipli — solo se più lotti distinti nella selezione */}
        {showBulkWarning && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 space-y-1">
            <p className="font-medium">⚠ Rivalidazione su lotti multipli ({bulkLottiDistinti} lotti)</p>
            <p>
              Data, N° Registro QC, Batch analitico e Note si applicano a <strong>tutti</strong> i lotti selezionati.
              Compilali solo se la rivalidazione è stata effettuata con lo stesso QC per tutti i lotti.
            </p>
            <p className="text-amber-600">
              Nel passo successivo potrai specificare Lotto CRM e nuova scadenza separatamente per ogni lotto.
            </p>
          </div>
        )}

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

              {showLottoScadenza ? (
                <>
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
                  <div>
                    <Label className="text-xs">Nuova data di scadenza</Label>
                    <Input type="date" value={nuovaScadenza} onChange={e => setNuovaScadenza(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">
                      Se compilato, aggiorna la scadenza del composto e compare nello storico.
                    </p>
                  </div>
                </>
              ) : isBulk ? (
                <div className="rounded-md border border-dashed border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-xs text-blue-600">
                    Lotto CRM valido e nuova scadenza — da specificare per ogni lotto nel passo successivo.
                  </p>
                </div>
              ) : null}
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