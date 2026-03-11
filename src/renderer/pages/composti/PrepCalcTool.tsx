import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SOLVENT_LIST } from '@/lib/solventDensities'
import { UNITA_CONCENTRAZIONE, UNITA_DEFAULT } from '@/lib/unita'
import { cn } from '@/lib/utils'

export interface PrepCalcToolProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  purezzeDefault?: number | null
  onConfirm: (result: {
    concentrazione: number
    unita_conc: string
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
  const [unitaConc, setUnitaConc] = useState<string>(UNITA_DEFAULT)
  const [volumeEffettivo, setVolumeEffettivo] = useState('')   // mL reali (modalità volume)
  const [massaEffettiva, setMassaEffettiva] = useState('')     // g reali (modalità pesata)

  // Calcoli in tempo reale
  const calculations = useMemo(() => {
    const concTargetNum = parseFloat(concTarget) || 0
    const massaPesataNum = parseFloat(massaPesata) || 0
    const purezzaNum = parseFloat(purezza) || 0
    const densitaNum = parseFloat(densita) || 0

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
      // Per pesata: volume teorico = (massaReale / concTarget) * 1000, poi massa = volume * densità
      if (concTargetNum > 0 && massaReale > 0 && densitaNum > 0) {
        volumeSolvente = (massaReale / concTargetNum) * 1000
        concReale = (massaReale / volumeSolvente) * 1000
        isValid = isFinite(concReale)
      }
    }

    // Peso teorico da aggiungere:
    // - modalità volume: peso = volume * densità (se densità disponibile)
    // - modalità pesata: peso = volume * densità (è il valore principale da mostrare)
    let pesoTeoricoSolvente: number | null = null
    if (densitaNum > 0 && volumeSolvente > 0) {
      pesoTeoricoSolvente = volumeSolvente * densitaNum
    }

    // Alias per compatibilità modalità volume (stesso calcolo)
    const pesoEquivalente = pesoTeoricoSolvente

    // Calcolo concentrazione reale da valori effettivi
    const volumeEffettivoNum = parseFloat(volumeEffettivo) || 0
    const massaEffettivaNum = parseFloat(massaEffettiva) || 0

    let concRealeEffettiva: number | null = null
    let volumeRealeUsato: number = volumeSolvente // default = teorico

    if (modalita === 'volume' && volumeEffettivoNum > 0 && massaReale > 0) {
      volumeRealeUsato = volumeEffettivoNum
      concRealeEffettiva = (massaReale / volumeEffettivoNum) * 1000
    } else if (modalita === 'pesata' && massaEffettivaNum > 0 && densitaNum > 0 && massaReale > 0) {
      volumeRealeUsato = massaEffettivaNum / densitaNum
      concRealeEffettiva = (massaReale / volumeRealeUsato) * 1000
    }

    // Il valore finale da passare a onConfirm
    const concFinale = concRealeEffettiva ?? concReale
    const volumeFinale = volumeRealeUsato

    return {
      massaReale,
      volumeSolvente,
      concReale,
      isValid,
      pesoEquivalente,
      pesoTeoricoSolvente,
      concRealeEffettiva,
      concFinale,
      volumeFinale,
    }

  }, [concTarget, massaPesata, purezza, densita, modalita, volumeEffettivo, massaEffettiva])

  const solventeDisplay = solventeCustom || solvente

  // Reset campi ad ogni apertura del dialog
  useEffect(() => {
    if (open) {
      setConcTarget('')
      setMassaPesata('')
      setPurezza(purezzeDefault?.toString() ?? '')
      setSolvente('')
      setSolventeCustom('')
      setDensita('')
      setModalita('volume')
      setUnitaConc(UNITA_DEFAULT)
      setVolumeEffettivo('')
      setMassaEffettiva('')
    }
  }, [open])

  const handleConfirm = () => {
    if (!calculations.isValid || !solventeDisplay) return

    const concTargetNum = parseFloat(concTarget) || 0
    const haValoreEffettivo = calculations.concRealeEffettiva !== null

    // Descrizione del valore usato per la nota
    const descValore = modalita === 'volume'
      ? (haValoreEffettivo
          ? `aggiunto effettivo: ${volumeEffettivo} mL (teorico: ${calculations.volumeSolvente.toFixed(2)} mL)`
          : `aggiunto ${calculations.volumeSolvente.toFixed(2)} mL`)
      : (haValoreEffettivo
          ? `pesato effettivo: ${massaEffettiva} g (teorico: ${calculations.pesoTeoricoSolvente?.toFixed(2) ?? '—'} g)`
          : `pesato ${calculations.pesoTeoricoSolvente?.toFixed(2) ?? '—'} g (d=${densita})`)

    onConfirm({
      concentrazione: calculations.concFinale,
      unita_conc: unitaConc,
      solvente: solventeDisplay,
      note: `[Calc] Pesata: ${massaPesata} mg, purezza: ${purezza}%, ` +
        `${descValore} ${solventeDisplay}` +
        ` → Conc. reale: ${calculations.concFinale.toFixed(1)} ${unitaConc}`,
      volume_solvente: calculations.volumeFinale,
      massa_pesata: parseFloat(massaPesata) || 0,
      purezza_usata: parseFloat(purezza) || 0,
      densita_solvente: parseFloat(densita) || null,
      modalita_aggiunta: modalita,
      concentrazione_reale: calculations.concFinale,
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

          {/* Sezione 2 — Solvente e Unità */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="text-xs font-semibold text-foreground mb-2">Solvente e Unità</div>

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

            {/* Unità concentrazione */}
            <div>
              <Label className="text-xs">Unità concentrazione</Label>
              <Select value={unitaConc} onValueChange={setUnitaConc}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITA_CONCENTRAZIONE.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            {/* Campo densità — SEMPRE VISIBILE */}
            <div>
              <Label className="text-xs">Densità solvente (g/cm³)</Label>
              <Input
                type="number"
                step="0.001"
                value={densita}
                onChange={e => setDensita(e.target.value)}
                placeholder="es. 0.786 — auto da solvente"
              />
            </div>
          </div>

          {/* Sezione 3 — Risultati */}
          <div className={cn('border rounded-md p-3 space-y-2', 'bg-accent/30', calculations.isValid && 'border-accent')}>
            <div className="text-xs font-semibold text-foreground mb-2">Risultati</div>

            <div className="space-y-2">
              {calculations.isValid ? (
                <>
                  <div className="text-xs bg-white/50 dark:bg-black/20 rounded p-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      {modalita === 'volume' ? 'Volume teorico da aggiungere:' : 'Massa teorica da pesare:'}
                    </div>
                    <div className="font-mono text-sm font-bold mt-1 flex items-center gap-3">
                      {modalita === 'volume' ? (
                        <>
                          <span>{calculations.volumeSolvente.toFixed(2)} mL</span>
                          {calculations.pesoEquivalente !== null && (
                            <span className="text-muted-foreground font-normal">
                              ≈ {calculations.pesoEquivalente.toFixed(2)} g
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span>
                            {calculations.pesoTeoricoSolvente !== null
                              ? calculations.pesoTeoricoSolvente.toFixed(2)
                              : '—'} g
                          </span>
                          {calculations.volumeSolvente > 0 && (
                            <span className="text-muted-foreground font-normal">
                              ≈ {calculations.volumeSolvente.toFixed(2)} mL
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">di {solventeDisplay}</div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-destructive text-center p-3">
                  Compilare tutti i valori per visualizzare i risultati
                </div>
              )}
            </div>
          </div>

          {/* Sezione 4 — Valori effettivi (opzionale) */}
          {calculations.isValid && (
            <div className="border rounded-md p-3 space-y-3 border-dashed border-muted-foreground/40">
              <div className="text-xs font-semibold text-foreground">
                Valori effettivi <span className="font-normal text-muted-foreground">(opzionale)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Inserisci quanto hai realmente {modalita === 'volume' ? 'aggiunto' : 'pesato'}.
                Se vuoto, viene usato il valore teorico.
              </div>

              {modalita === 'volume' && (
                <div>
                  <Label className="text-xs">Volume effettivo aggiunto (mL)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={volumeEffettivo}
                    onChange={e => setVolumeEffettivo(e.target.value)}
                    placeholder={`teorico: ${calculations.volumeSolvente.toFixed(2)} mL`}
                  />
                </div>
              )}

              {modalita === 'pesata' && (
                <div>
                  <Label className="text-xs">Massa effettiva pesata (g)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={massaEffettiva}
                    onChange={e => setMassaEffettiva(e.target.value)}
                    placeholder={calculations.pesoTeoricoSolvente !== null
                      ? `teorico: ${calculations.pesoTeoricoSolvente.toFixed(2)} g`
                      : 'inserisci densità per il valore teorico'}
                  />
                </div>
              )}

              {/* Concentrazione reale — aggiornata in tempo reale */}
              <div className="text-center bg-primary/10 rounded p-3 border border-primary/30">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Concentrazione reale
                </div>
                <div className="text-2xl font-bold text-primary font-mono">
                  {calculations.concFinale.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">{unitaConc}</div>
                {calculations.concRealeEffettiva !== null && (
                  <div className="text-xs text-muted-foreground mt-1">
                    (da valore effettivo inserito)
                  </div>
                )}
              </div>
            </div>
          )}

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