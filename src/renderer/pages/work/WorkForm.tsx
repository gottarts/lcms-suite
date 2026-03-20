import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { workApi } from '@/lib/api'
import { UNITA_CONCENTRAZIONE, UNITA_DEFAULT } from '@/lib/unita'

interface WorkFormProps {
  open: boolean
  onClose: () => void
  work?: any | null
  onSave: () => void
}

const EMPTY_FORM = {
  nome: '',
  concentrazione: '',
  conc_variabile: false,
  unita_conc: UNITA_DEFAULT,
  volume_ml: '',
  solvente: '',
  validita_mesi: '',
  operatore: '',
  note: '',
  livello: 0,
}

export function WorkForm({ open, onClose, work, onSave }: WorkFormProps) {
  const isEdit = !!work
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (work) {
      setForm({
        nome: work.nome ?? '',
        concentrazione: work.concentrazione != null ? String(work.concentrazione) : '',
        conc_variabile: !!work.conc_variabile,
        unita_conc: work.unita_conc ?? UNITA_DEFAULT,
        volume_ml: work.volume_ml != null ? String(work.volume_ml) : '',
        solvente: work.solvente ?? '',
        validita_mesi: work.validita_mesi != null ? String(work.validita_mesi) : '',
        operatore: work.operatore ?? '',
        note: work.note ?? '',
        livello: work.livello ?? 0,
      })
    } else {
      setForm({ ...EMPTY_FORM })
    }
  }, [work, open])

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const data = {
        nome: form.nome.trim(),
        concentrazione: form.conc_variabile ? null : (form.concentrazione ? parseFloat(form.concentrazione) : null),
        conc_variabile: form.conc_variabile ? 1 : 0,
        unita_conc: form.unita_conc || UNITA_DEFAULT,
        volume_ml: form.volume_ml ? parseFloat(form.volume_ml) : null,
        solvente: form.solvente || null,
        validita_mesi: form.validita_mesi ? parseInt(form.validita_mesi) : null,
        operatore: form.operatore || null,
        note: form.note || null,
        livello: form.livello ?? 0,
      }

      if (isEdit) {
        await workApi.update(work.id, data)
      } else {
        await workApi.create(data)
      }

      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isTracciata = !!form.validita_mesi

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? 'Modifica Work' : 'Nuova Work Solution'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Identificazione */}
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Identificazione
          </div>
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="es. Work PFAS taratura gen-2026"
            />
          </div>

          <div>
            <Label className="text-xs">Livello</Label>
            <Select
              value={String(form.livello)}
              onValueChange={v => set('livello', parseInt(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Work (livello 0)</SelectItem>
                <SelectItem value="1">Intermedia 1</SelectItem>
                <SelectItem value="2">Intermedia 2</SelectItem>
                <SelectItem value="3">Intermedia 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Concentrazione */}
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Concentrazione
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="conc-var"
              checked={form.conc_variabile}
              onChange={e => set('conc_variabile', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="conc-var" className="text-sm cursor-pointer select-none">
              Concentrazione variabile (mix con analiti a conc. diverse)
            </label>
          </div>

          {!form.conc_variabile && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Concentrazione nominale</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.concentrazione}
                  onChange={e => set('concentrazione', e.target.value)}
                  placeholder="es. 1.0"
                />
              </div>
              <div>
                <Label className="text-xs">Unità</Label>
                <Select value={form.unita_conc} onValueChange={v => set('unita_conc', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITA_CONCENTRAZIONE.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Separator />

          {/* Preparazione */}
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Preparazione
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Volume finale (mL)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.volume_ml}
                onChange={e => set('volume_ml', e.target.value)}
                placeholder="es. 10"
              />
            </div>
            <div>
              <Label className="text-xs">Solvente</Label>
              <Input
                value={form.solvente}
                onChange={e => set('solvente', e.target.value)}
                placeholder="es. MeOH"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Operatore</Label>
            <Input
              value={form.operatore}
              onChange={e => set('operatore', e.target.value)}
              placeholder="es. Mario Rossi"
            />
          </div>

          <Separator />

          {/* Tracciabilità */}
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tracciabilità
          </div>

          <div>
            <Label className="text-xs">
              Validità (mesi)
              <span className="ml-1 font-normal text-muted-foreground normal-case">
                — lascia vuoto per Work &quot;al momento&quot; (non tracciata)
              </span>
            </Label>
            <Input
              type="number"
              min="1"
              max="60"
              value={form.validita_mesi}
              onChange={e => set('validita_mesi', e.target.value)}
              placeholder="es. 6"
            />
            {isTracciata && (
              <p className="text-xs text-amber-700 mt-1">
                ✓ Work tracciata — la data di scadenza verrà calcolata al momento della preparazione fisica.
              </p>
            )}
            {!isTracciata && (
              <p className="text-xs text-muted-foreground mt-1">
                Work &quot;al momento&quot; — non compare nel registro delle preparazioni.
              </p>
            )}
          </div>

          <Separator />

          {/* Note */}
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea
              value={form.note}
              onChange={e => set('note', e.target.value)}
              rows={3}
              placeholder="Annotazioni, riferimenti a SOP, ecc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={!form.nome.trim() || saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salva' : 'Crea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
