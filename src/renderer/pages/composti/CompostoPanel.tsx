import { useState, useEffect } from 'react'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { StatusBadge, computeStato } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, RotateCcw, XCircle, Copy } from 'lucide-react'
import { compostiApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { parseConcentrazione } from '@/lib/unita'
import { PreparazioniTab } from './PreparazioniTab'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

// Helper: calcola stato visualizzato di una preparazione (non modifica il DB)
function computeStatoPrep(prep: any): string {
  if (prep.stato === 'Dismessa') return 'Dismessa'
  if (prep.stato === 'Esaurita') return 'Esaurita'
  if (prep.scadenza && new Date(prep.scadenza) < new Date()) return 'Scaduta'
  return prep.stato ?? 'Attiva'
}

interface CompostoPanelProps {
  compostoId: number | null
  onClose: () => void
  onEdit: (composto: any) => void
  onDelete: (id: number) => void
  onNewLotto: (template: any) => void
  onRefreshList?: () => void
  defaultTab?: string
}

export function CompostoPanel({ compostoId, onClose, onEdit, onDelete, onNewLotto, onRefreshList, defaultTab }: CompostoPanelProps) {
  const [composto, setComposto] = useState<any>(null)
  const [ultimaRivalidazione, setUltimaRivalidazione] = useState<string | null>(null)
  const [storiaForm, setStoriaForm] = useState<{ open: boolean; tipo: string }>({ open: false, tipo: '' })
  const [storiaData, setStoriaData] = useState({
    data: new Date().toISOString().split('T')[0],
    note: '',
    n_registro_qc: '',
    batch_analitico: '',
    lotto_crm_valido: '',
    nuova_scadenza: '',
  })
  const [lottiValidi, setLottiValidi] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? 'dettaglio')

  // FEAT-metodi-campo: metodi associati al composto
  const [metodiAssociati, setMetodiAssociati] = useState<any[]>([])

  const load = async () => {
    if (!compostoId) return
    const c = await compostiApi.get(compostoId)
    setComposto(c)
    if (c?.storia?.length) {
      const scadenze = c.storia
        .filter((s: any) => s.tipo === 'Rivalidazione' && s.nuova_scadenza)
        .map((s: any) => s.nuova_scadenza as string)
      setUltimaRivalidazione(scadenze.length > 0 ? scadenze.sort().at(-1) : null)
    } else {
      setUltimaRivalidazione(null)
    }

    // FEAT-metodi-campo: carica i nomi dei metodi associati
    if (c?.metodi_ids && c.metodi_ids.length > 0) {
      window.electronAPI.invoke('metodi:list').then((result: unknown) => {
        const tutti = result as any[]
        setMetodiAssociati(tutti.filter((m: any) => c.metodi_ids.includes(m.id)))
      }).catch(() => setMetodiAssociati([]))
    } else {
      setMetodiAssociati([])
    }
  }

  useEffect(() => { load() }, [compostoId])

  useEffect(() => {
    setActiveTab(defaultTab ?? 'dettaglio')
  }, [defaultTab, compostoId])

  const openStoria = async (tipo: string) => {
    setStoriaData({
      data: new Date().toISOString().split('T')[0],
      note: '',
      n_registro_qc: '',
      batch_analitico: '',
      lotto_crm_valido: '',
      nuova_scadenza: '',
    })
    if (tipo === 'Rivalidazione' && compostoId) {
      try {
        const lotti = await window.electronAPI.invoke('composti:lotti-validi', compostoId) as any[]
        setLottiValidi(lotti ?? [])
      } catch {
        setLottiValidi([])
      }
    }
    setStoriaForm({ open: true, tipo })
  }

  const handleStoriaSubmit = async () => {
    if (!compostoId) return
    await window.electronAPI.invoke('composti:storia-add', compostoId, {
      tipo: storiaForm.tipo,
      ...storiaData,
    })
    setStoriaForm({ open: false, tipo: '' })
    load()
    onRefreshList?.()
  }

  const handlePrepRefresh = () => {
    load()
    onRefreshList?.()
  }

  // Timeline unificata: merge storia + preparazioni, ordinate per data DESC
  const timelineEvents = (() => {
    if (!composto) return []
    const storiaEvents = (composto.storia ?? []).map((s: any) => ({
      _type: 'storia' as const,
      _sortDate: s.data ?? '',
      _sortId: s.id as number,
      data: s,
    }))
    const prepEvents = (composto.preparazioni ?? [])
      .filter((p: any) => p.data_prep)
      .map((p: any) => ({
        _type: 'prep' as const,
        _sortDate: p.data_prep as string,
        _sortId: -(p.id as number),
        data: p,
      }))
    return [...storiaEvents, ...prepEvents].sort((a, b) => {
      if (b._sortDate < a._sortDate) return -1
      if (b._sortDate > a._sortDate) return 1
      return b._sortId - a._sortId
    })
  })()

  if (!composto) return null

  const compostoConRival = { ...composto, ultima_rivalidazione: ultimaRivalidazione }

  const Field = ({ label, value }: { label: string; value: any }) => {
    if (!value && value !== 0) return null
    return (
      <div className="flex justify-between text-sm py-0.5">
        <span className="text-muted-foreground shrink-0 mr-4">{label}</span>
        <span className="text-right">{String(value)}</span>
      </div>
    )
  }

  return (
    <SlidePanel open={!!compostoId} onClose={onClose} title={composto.nome} subtitle={composto.codice_interno || undefined} width="520px">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={computeStato(compostoConRival)} />
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onNewLotto(composto)}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Nuovo lotto
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(composto)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(composto.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="dettaglio" className="flex-1">Dettaglio</TabsTrigger>
            {composto.forma === 'Neat' && (
              <TabsTrigger value="preparazioni" className="flex-1">Preparazioni ({composto.preparazioni?.length || 0})</TabsTrigger>
            )}
            <TabsTrigger value="storico" className="flex-1">Storico</TabsTrigger>
          </TabsList>

          <TabsContent value="dettaglio" className="space-y-2 mt-3">
            <Field label="Classe" value={composto.classe} />
            <Field label="Forma" value={composto.forma} />
            <Field label="Forma Commerciale" value={composto.forma_commerciale} />
            <Field label="Formula" value={composto.formula} />
            <Field label="MW" value={composto.peso_molecolare} />
            <Separator />
            <Field label="Purezza" value={composto.purezza ? `${composto.purezza}%` : null} />
            <Field label="Concentrazione" value={composto.concentrazione ? `${parseConcentrazione(composto.concentrazione)} ${composto.unita_conc ?? 'mg/L'}` : null} />
            <Field label="Solvente" value={composto.solvente} />
            <Field label="N° Fiale" value={composto.fiala} />
            <Separator />
            <Field label="Produttore" value={composto.produttore} />
            <Field label="Lotto" value={composto.lotto} />
            <Field label="Operatore" value={composto.operatore_apertura} />
            <Separator />
            <Field label="Data Apertura" value={formatDate(composto.data_apertura)} />
            <Field label="Scadenza" value={formatDate(composto.scadenza_prodotto)} />
            <Field label="Data Dismissione" value={formatDate(composto.data_dismissione)} />
            <Separator />
            <Field label="Destinazione Uso" value={composto.destinazione_uso} />
            <Field label="Work Standard" value={composto.work_standard} />
            <Field label="Ubicazione" value={composto.ubicazione} />
            <Field label="Stoccaggio" value={composto.stoccaggio} />
            <Field label="Accreditamento CRM" value={composto.accreditamento_crm} />

            {/* FEAT-metodi-campo: metodi associati in fondo al tab Dettaglio */}
            {metodiAssociati.length > 0 && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">Metodi Analitici</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {metodiAssociati.map((m: any) => (
                      <Badge key={m.id} variant="outline" className="text-xs">{m.nome}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {composto.forma === 'Neat' && (
            <TabsContent value="preparazioni" className="mt-3">
              <PreparazioniTab
                compostoId={composto.id}
                preparazioni={composto.preparazioni}
                onRefresh={handlePrepRefresh}
                composto={composto}
              />
            </TabsContent>
          )}

          <TabsContent value="storico" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openStoria('Rivalidazione')}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rivalidazione
              </Button>
              <Button size="sm" variant="outline" onClick={() => openStoria('Dismissione')}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Dismissione
              </Button>
            </div>

            {timelineEvents.length > 0 ? (
              timelineEvents.map((evt) => {
                if (evt._type === 'prep') {
                  const p = evt.data
                  const statoPrep = computeStatoPrep(p)
                  const statoColor =
                    statoPrep === 'Attiva'   ? 'text-green-700' :
                    statoPrep === 'Scaduta'  ? 'text-red-600'   :
                    statoPrep === 'Esaurita' ? 'text-amber-600' : 'text-muted-foreground'
                  return (
                    <div key={`prep-${p.id}`} className="text-sm border-l-2 border-green-300 pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-700">Preparazione</span>
                        <span className={`text-xs ${statoColor}`}>{statoPrep}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(p.data_prep)}
                        {p.concentrazione && ` — ${parseConcentrazione(p.concentrazione)} ${p.unita_conc ?? 'mg/L'}`}
                        {p.operatore && ` — ${p.operatore}`}
                      </div>
                      <button
                        className="text-[10px] text-blue-500 hover:underline mt-0.5"
                        onClick={() => setActiveTab('preparazioni')}
                      >
                        → vedi preparazioni
                      </button>
                    </div>
                  )
                }

                // evt._type === 'storia'
                const s = evt.data
                const isRival = s.tipo === 'Rivalidazione'
                const isDismiss = s.tipo === 'Dismissione'
                const borderColor = isRival ? 'border-blue-300' : isDismiss ? 'border-red-300' : 'border-muted'
                return (
                  <div key={`storia-${s.id}`} className={`text-sm border-l-2 ${borderColor} pl-3 py-1`}>
                    <div className="font-medium">
                      {s.tipo === 'apertura_fiala'
                        ? `Apertura fiala #${s.fiala_numero ?? ''}`
                        : s.tipo}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(s.data)}
                    </div>
                    {isRival && s.nuova_scadenza && (
                      <div className="text-[11px] text-blue-600">
                        Scadenza estesa al {formatDate(s.nuova_scadenza)}
                      </div>
                    )}
                    {s.n_registro_qc && <div className="text-[11px] text-muted-foreground">QC: {s.n_registro_qc}</div>}
                    {s.batch_analitico && <div className="text-[11px] text-muted-foreground">Batch: {s.batch_analitico}</div>}
                    {s.lotto_crm_valido && <div className="text-[11px] text-muted-foreground">Lotto CRM: {s.lotto_crm_valido}</div>}
                    {s.note && <div className="text-[11px] text-muted-foreground italic">{s.note}</div>}
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
            )}

            {/* Evento fisso apertura flacone in fondo */}
            {composto.data_apertura && (
              <div className="text-sm border-l-2 border-muted pl-3 py-1 opacity-60">
                <div className="font-medium">
                  {composto.mix
                    ? `Apertura mix ${composto.mix}`
                    : 'Apertura flacone'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatDate(composto.data_apertura)}
                  {composto.operatore_apertura && ` — ${composto.operatore_apertura}`}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={storiaForm.open} onOpenChange={v => !v && setStoriaForm({ open: false, tipo: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{storiaForm.tipo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">

            <div>
              <Label className="text-xs">Data {storiaForm.tipo}</Label>
              <Input
                type="date"
                value={storiaData.data}
                onChange={e => setStoriaData(f => ({ ...f, data: e.target.value }))}
              />
            </div>

            {storiaForm.tipo === 'Rivalidazione' && (
              <>
                <div>
                  <Label className="text-xs">N° Registro QC</Label>
                  <Input
                    value={storiaData.n_registro_qc}
                    onChange={e => setStoriaData(f => ({ ...f, n_registro_qc: e.target.value }))}
                    placeholder="es. QC-2024-0123"
                  />
                </div>
                <div>
                  <Label className="text-xs">Batch analitico</Label>
                  <Input
                    value={storiaData.batch_analitico}
                    onChange={e => setStoriaData(f => ({ ...f, batch_analitico: e.target.value }))}
                    placeholder="es. B2024-03-15"
                  />
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
                  {lottiValidi.length > 0 ? (
                    <Select
                      value={storiaData.lotto_crm_valido || '_manual'}
                      onValueChange={v => setStoriaData(f => ({
                        ...f,
                        lotto_crm_valido: v === '_manual' ? '' : v,
                      }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleziona lotto..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_manual">— Inserisci manualmente —</SelectItem>
                        {lottiValidi.map((l: any) => (
                          <SelectItem key={l.id} value={l.lotto}>
                            {l.nome} — {l.lotto} (scad. {formatDate(l.scadenza_prodotto)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {(lottiValidi.length === 0 || storiaData.lotto_crm_valido === '') && (
                    <Input
                      value={storiaData.lotto_crm_valido}
                      onChange={e => setStoriaData(f => ({ ...f, lotto_crm_valido: e.target.value }))}
                      placeholder="es. L2024-001"
                      className="mt-1"
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs">
                    Nuova scadenza
                    <span className="ml-1 text-muted-foreground font-normal text-[11px]">
                      — Se compilata, determina lo stato Rivalidato
                    </span>
                  </Label>
                  <Input
                    type="date"
                    value={storiaData.nuova_scadenza}
                    onChange={e => setStoriaData(f => ({ ...f, nuova_scadenza: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Note</Label>
              <Textarea
                value={storiaData.note}
                onChange={e => setStoriaData(f => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStoriaForm({ open: false, tipo: '' })}>Annulla</Button>
            <Button onClick={handleStoriaSubmit}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SlidePanel>
  )
}