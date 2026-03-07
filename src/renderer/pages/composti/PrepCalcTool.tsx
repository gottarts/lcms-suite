import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SOLVENT_LIST } from '@/lib/solventDensities'
import { cn } from '@/lib/utils'

export interface PrepCalcToolProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  purezzeDefault?: number | null
  onConfirm: (result: {
    concentrazione: string
    solvente: string
    note: string
    volume_solvente: number
    massa_pesata: number
    purezza_usata: number
    densita_solvente: number | null
    modalita_aggiunta: 'volume' | 'pesata'
    concentrazione_reale: number
    concentrazione_target: number
  }) => void
}

export function PrepCalcTool({
  open,
  onOpenChange,
  purezzeDefault,
  onConfirm,
}: PrepCalcToolProps) {
  const [concTarget, setConcTarget] = useState('')
  const [massaPesata, setMassaPesata] = useState('')
  const [purezza, setPurezza] = useState(purezzeDefault?.toString() ?? '')
  const [solvente, setSolvente] = useState('')
  const [solventeCustom, setSolventeCustom] = useState('')
  const [densita, setDensita] = useState('')
  const [modalita, setModalita] = useState<'volume' | 'pesata'>('volume')
  const [massaSolvente, setMassaSolvente] = useState('')

  // Calcoli in tempo reale
  const calculations = useMemo(() => {
    const concTargetNum = parseFloat(concTarget) || 0
    const massaPesataNum = parseFloat(massaPesata) || 0
    const purezzaNum = parseFloat(purezza) || 0
    const densitaNum = parseFloat(densita) || 0
    const massaSolventeNum = parseFloat(massaSolvente) || 0

    // Massa reale: tenendo conto della purezza
    const massaReale = (massaPesataNum * purezzaNum) / 100

    let volumeSolvente = 0
    let concReale = 0
    let isValid = false

    if (modalita === 'volume') {
      // Per volume: volumeSolvente = (massaReale / concTarget) * 1000
      if (concTargetNum > 0 && massaReale > 0) {
        volumeSolvente = (massaReale / concTargetNum) * 1000
        concReale = (massaReale / volumeSolvente) * 1000
        isValid = isFinite(concReale)
      }
    } else {
      // Per pesata: volumeSolvente = massaSolvente / densita
      if (densitaNum > 0 && massaSolventeNum > 0 && massaReale > 0) {
        volumeSolvente = massaSolventeNum / densitaNum
        concReale = (massaReale / volumeSolvente) * 1000
        isValid = isFinite(concReale)
      }
    }

    return {
      massaReale,
      volumeSolvente,
      concReale,
      isValid,
    }
  }, [concTarget, massaPesata, purezza, densita, modalita, massaSolvente])

  const solventeDisplay = solventeCustom || solvente
  const densitaDisplay = parseFloat(densita) || null

  const handleConfirm = () => {
    if (!calculations.isValid || !solventeDisplay) return

    const concTargetNum = parseFloat(concTarget) || 0

    onConfirm({
      concentrazione: `${calculations.concReale.toFixed(1)} mg/L`,
      solvente: solventeDisplay,
      note: `[Calc] Pesata: ${massaPesata} mg, purezza: ${purezza}%, ` +
        (modalita === 'volume'
          ? `aggiunto ${calculations.volumeSolvente.toFixed(2)} mL ${solventeDisplay}`
          : `pesato ${massaSolvente} g ${solventeDisplay} (d=${densita})`) +
        ` → Conc. reale: ${calculations.concReale.toFixed(1)} mg/L`,
      volume_solvente: calculations.volumeSolvente,
      massa_pesata: parseFloat(massaPesata) || 0,
      purezza_usata: parseFloat(purezza) || 0,
      densita_solvente: densitaDisplay,
      modalita_aggiunta: modalita,
      concentrazione_reale: calculations.concReale,
      concentrazione_target: concTargetNum,
    })
  }

  const handleSolventeChange = (value: string) => {
    if (value === '_custom') {
      setSolvente('')
      setSolventeCustom('')
    } else {
      setSolvente(value)
      setSolventeCustom('')
      const found = SOLVENT_LIST.find(s => s.nome === value)
      if (found) {
        setDensita(found.densita.toString())
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">🧪 Calcolatore Preparazione</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sezione 1 — Parametri pesata */}
          <div className="border rounded-md p-3 space-y-3 bg-muted/40">
            <div className="text-xs font-semibold text-foreground mb-2">Parametri pesata</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Conc. target (mg/L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={concTarget}
                  onChange={e => setConcTarget(e.target.value)}
                  placeholder="es. 1000"
                />
              </div>
              <div>
                <Label className="text-xs">Massa pesata (mg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={massaPesata}
                  onChange={e => setMassaPesata(e.target.value)}
                  placeholder="es. 100"
                />
              </div>
              <div>
                <Label className="text-xs">Purezza (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={purezza}
                  onChange={e => setPurezza(e.target.value)}
                  placeholder="es. 98.5"
                />
              </div>
            </div>
            <div className="text-xs bg-accent/20 rounded p-2 text-center font-mono">
              Massa reale: <span className="font-bold">{calculations.massaReale.toFixed(2)} mg</span>
            </div>
          </div>

          {/* Sezione 2 — Solvente */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="text-xs font-semibold text-foreground mb-2">Solvente</div>

            {/* Solvente select */}
            <div>
              <Label className="text-xs">Solvente</Label>
              <Select value={solvente || '_custom'} onValueChange={handleSolventeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOLVENT_LIST.map(s => (
                    <SelectItem key={s.nome} value={s.nome}>
                      {s.nome} ({s.densita.toFixed(3)} g/cm³)
                    </SelectItem>
                  ))}
                  <SelectItem value="_custom">Altro...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input solvente custom */}
            {solvente === '' && (
              <div>
                <Label className="text-xs">Solvente (nome libero)</Label>
                <Input
                  value={solventeCustom}
                  onChange={e => setSolventeCustom(e.target.value)}
                  placeholder="es. Acetone tecnico"
                />
              </div>
            )}

            {/* Modalita */}
            <div className="space-y-2">
              <Label className="text-xs">Modalità aggiunta</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    value="volume"
                    checked={modalita === 'volume'}
                    onChange={e => {
                      if (e.target.checked) setModalita('volume')
                    }}
                  />
                  <span>Per volume (mL)</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    value="pesata"
                    checked={modalita === 'pesata'}
                    onChange={e => {
                      if (e.target.checked) setModalita('pesata')
                    }}
                  />
                  <span>Per pesata (g)</span>
                </label>
              </div>
            </div>

            {/* Input pesata (solo se modalita='pesata') */}
            {modalita === 'pesata' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Massa solvente (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={massaSolvente}
                    onChange={e => setMassaSolvente(e.target.value)}
                    placeholder="es. 10.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Densità (g/cm³)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={densita}
                    onChange={e => setDensita(e.target.value)}
                    placeholder="es. 0.786"
                  />
                </div>
              </div>
            )}

            {/* Mostra densita se volume */}
            {modalita === 'volume' && solvente && (
              <div className="text-xs bg-muted p-2 rounded">
                Densità: <span className="font-mono font-semibold">{densita || '—'} g/cm³</span>
              </div>
            )}
          </div>

          {/* Sezione 3 — Risultati */}
          <div className={cn('border rounded-md p-3 space-y-2', 'bg-accent/30', calculations.isValid && 'border-accent')}>
            <div className="text-xs font-semibold text-foreground mb-2">Risultati</div>

            <div className="space-y-2">
              {calculations.isValid ? (
                <>
                  <div className="text-xs bg-white/50 dark:bg-black/20 rounded p-2">
                    <div>{modalita === 'volume' ? 'Aggiungere' : 'Pesare'}:</div>
                    <div className="font-mono text-sm font-bold mt-1">
                      {calculations.volumeSolvente.toFixed(2)} {modalita === 'volume' ? 'mL' : 'g'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">di {solventeDisplay}</div>
                  </div>

                  <div className="text-center bg-primary/10 rounded p-3 border border-primary/30">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Concentrazione reale
                    </div>
                    <div className="text-2xl font-bold text-primary font-mono">
                      {calculations.concReale.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">mg/L</div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-destructive text-center p-3">
                  Compilare tutti i valori per visualizzare i risultati
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={!calculations.isValid || !solventeDisplay}>
            Usa questi valori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
