import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { metodiApi, metodoAnalitiApi, compostiApi } from '@/lib/api'

interface MetodoFormProps {
  open: boolean
  onClose: () => void
  metodo?: Record<string, any> | null
  strumenti: { id: string; codice: string }[]
  onSave: () => void
}

// FIX-merge: stato del dialogo di conferma merge
interface MergeState {
  conflictId: string
  conflictNome: string
  sourceId: string
  data: Record<string, unknown>
  compostiIds: number[]
}

export function MetodoForm({ open, onClose, metodo, strumenti, onSave }: MetodoFormProps) {
  const isEdit = !!metodo
  const [form, setForm] = useState<Record<string, any>>({})
  // FIX-merge: se il backend segnala un conflitto, salviamo qui i dati per il dialogo
  const [mergeState, setMergeState] = useState<MergeState | null>(null)

  // ── Gestione analiti persistenti (solo in modalità edit) ──
  const [analiti, setAnaliti]               = useState<{ id: number; nome: string }[]>([])
  const [selAnaliti, setSelAnaliti]         = useState<Set<string>>(new Set())
  const [addInput, setAddInput]             = useState('')
  const [addSugg, setAddSugg]               = useState<string[]>([])
  const [allNomiDb, setAllNomiDb]           = useState<string[]>([])

  const loadAnaliti = useCallback(async (metodoId: string) => {
    const rows = await metodoAnalitiApi.list(metodoId)
    setAnaliti(rows)
    setSelAnaliti(new Set())
  }, [])

  const loadNomiDb = useCallback(async () => {
    const rows: any[] = await compostiApi.list({})
    const nomiUnici = Array.from(new Set(rows.map((r: any) => r.nome as string).filter(Boolean))).sort()
    setAllNomiDb(nomiUnici)
  }, [])

  useEffect(() => {
    if (metodo) {
      setForm({ ...metodo })
      loadAnaliti(metodo.id)
      loadNomiDb()
    } else {
      setForm({
        id: crypto.randomUUID(),
        nome: '', strumento_id: '', matrice: '', colonna: '',
        fase_a: '', fase_b: '', gradiente: '', flusso: '',
        ionizzazione: '', polarita: '', acquisizione: '', srm: '',
        lims_id: '', oqlab_id: '', note: '',
      })
      setAnaliti([])
    }
  }, [metodo, open, loadAnaliti, loadNomiDb])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleAddAnalita = async (nome: string) => {
    const trimmed = nome.trim()
    if (!trimmed || !metodo?.id) return
    if (analiti.some(a => a.nome.toLowerCase() === trimmed.toLowerCase())) return
    await metodoAnalitiApi.add(metodo.id, [trimmed])
    setAddInput('')
    setAddSugg([])
    await loadAnaliti(metodo.id)
  }

  const handleRimuoviSelezionati = async () => {
    if (!metodo?.id || selAnaliti.size === 0) return
    await metodoAnalitiApi.remove(metodo.id, Array.from(selAnaliti))
    // Ricarica i composti_ids aggiornati dal backend, altrimenti al salvataggio
    // il form reinserisce i composti appena scollegati
    const updated = await metodiApi.get(metodo.id)
    setForm(f => ({ ...f, composti_ids: updated?.composti_ids ?? [] }))
    await loadAnaliti(metodo.id)
  }

  const toggleSelAnalita = (nome: string) => {
    setSelAnaliti(prev => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome)
      else next.add(nome)
      return next
    })
  }

  const handleAddInputChange = (val: string) => {
    setAddInput(val)
    if (val.trim().length < 2) { setAddSugg([]); return }
    const esistenti = new Set(analiti.map(a => a.nome.toLowerCase()))
    const sugg = allNomiDb
      .filter(n => n.toLowerCase().includes(val.toLowerCase()) && !esistenti.has(n.toLowerCase()))
      .slice(0, 8)
    setAddSugg(sugg)
  }

  const handleSave = async () => {
    if (!form.nome?.trim()) return
    const data = { ...form }
    // Convert empty strings to null for optional fields
    for (const k of Object.keys(data)) {
      if (k !== 'id' && k !== 'nome' && data[k] === '') data[k] = null
    }
    if (isEdit) {
      // FIX-merge: update può restituire { needsMerge: true, ... } invece del metodo aggiornato
      const result = await metodiApi.update(metodo!.id, data) as any
      if (result?.needsMerge) {
        setMergeState({
          conflictId: result.conflictId,
          conflictNome: result.conflictNome,
          sourceId: result.sourceId,
          data: result.data,
          compostiIds: result.compostiIds,
        })
        return // non chiudere il form, aspettiamo conferma
      }
    } else {
      await metodiApi.create(data)
    }
    onSave()
    onClose()
  }

  // FIX-merge: l'utente ha confermato — esegue il merge
  const handleMergeConfirm = async () => {
    if (!mergeState) return
    await (window as any).electronAPI.invoke(
      'metodi:merge',
      mergeState.sourceId,
      mergeState.conflictId,
      mergeState.data,
      mergeState.compostiIds,
    )
    setMergeState(null)
    onSave()
    onClose()
  }

  const handleMergeCancel = () => {
    setMergeState(null)
    // Il form rimane aperto così l'utente può scegliere un nome diverso
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{isEdit ? 'Modifica metodo' : 'Nuovo metodo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificazione</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Strumento</Label>
                <Select value={form.strumento_id || ''} onValueChange={v => set('strumento_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {strumenti.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.codice}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Matrice</Label>
                <Input value={form.matrice || ''} onChange={e => set('matrice', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">LIMS ID</Label>
                <Input value={form.lims_id || ''} onChange={e => set('lims_id', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">OQLab ID</Label>
                <Input value={form.oqlab_id || ''} onChange={e => set('oqlab_id', e.target.value)} />
              </div>
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cromatografia LC</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Colonna</Label><Input value={form.colonna || ''} onChange={e => set('colonna', e.target.value)} /></div>
              <div><Label className="text-xs">Fase A</Label><Input value={form.fase_a || ''} onChange={e => set('fase_a', e.target.value)} /></div>
              <div><Label className="text-xs">Fase B</Label><Input value={form.fase_b || ''} onChange={e => set('fase_b', e.target.value)} /></div>
              <div><Label className="text-xs">Gradiente</Label><Input value={form.gradiente || ''} onChange={e => set('gradiente', e.target.value)} /></div>
              <div><Label className="text-xs">Flusso</Label><Input value={form.flusso || ''} onChange={e => set('flusso', e.target.value)} /></div>
            </div>

            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MS</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Ionizzazione</Label><Input value={form.ionizzazione || ''} onChange={e => set('ionizzazione', e.target.value)} /></div>
              <div><Label className="text-xs">Polarità</Label><Input value={form.polarita || ''} onChange={e => set('polarita', e.target.value)} /></div>
              <div><Label className="text-xs">Acquisizione</Label><Input value={form.acquisizione || ''} onChange={e => set('acquisizione', e.target.value)} /></div>
              <div><Label className="text-xs">SRM</Label><Input value={form.srm || ''} onChange={e => set('srm', e.target.value)} /></div>
            </div>

            <Separator />
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea value={form.note || ''} onChange={e => set('note', e.target.value)} rows={3} />
            </div>

            {isEdit && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Analiti del metodo
                    </div>
                    {selAnaliti.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleRimuoviSelezionati}
                      >
                        Rimuovi selezionati ({selAnaliti.size})
                      </Button>
                    )}
                  </div>

                  {/* Lista analiti con checkbox */}
                  <div className="max-h-48 overflow-y-auto border rounded-md divide-y text-sm mb-3">
                    {analiti.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground italic">
                        Nessun analita — aggiungili dal DB Composti o manualmente
                      </div>
                    )}
                    {analiti.map(a => (
                      <label
                        key={a.nome}
                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={selAnaliti.has(a.nome)}
                          onChange={() => toggleSelAnalita(a.nome)}
                          className="accent-destructive"
                        />
                        <span className="font-mono text-xs">{a.nome}</span>
                      </label>
                    ))}
                  </div>

                  {/* Aggiungi analita */}
                  <div className="relative">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome analita (dal catalogo o libero)"
                        value={addInput}
                        onChange={e => handleAddInputChange(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddAnalita(addInput) }
                          if (e.key === 'Escape') { setAddInput(''); setAddSugg([]) }
                        }}
                        className="text-xs h-8"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        variant="outline"
                        disabled={!addInput.trim()}
                        onClick={() => handleAddAnalita(addInput)}
                      >
                        Aggiungi
                      </Button>
                    </div>
                    {addSugg.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {addSugg.map(n => (
                          <div
                            key={n}
                            className="px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-muted"
                            onClick={() => handleAddAnalita(n)}
                          >
                            {n}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Le modifiche agli analiti sono immediate. Un analita aggiunto manualmente apparirà grigio nello schema finché non viene associato un CRM.
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Annulla</Button>
            <Button onClick={handleSave} disabled={!form.nome?.trim()}>
              {isEdit ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIX-merge: dialogo di conferma quando il nuovo nome collide con un metodo esistente */}
      <AlertDialog open={!!mergeState} onOpenChange={v => !v && handleMergeCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Metodo già esistente</AlertDialogTitle>
            <AlertDialogDescription>
              Esiste già un metodo chiamato <strong>"{mergeState?.conflictNome}"</strong>.
              <br /><br />
              Vuoi unire i due metodi? I composti associati a entrambi verranno collegati
              al metodo <strong>"{mergeState?.conflictNome}"</strong> e il metodo corrente
              verrà eliminato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMergeCancel}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergeConfirm}>Unisci metodi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}