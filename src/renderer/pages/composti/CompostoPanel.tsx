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

  const load = async () => {
    if (!compostoId) return
    const c = await compostiApi.get(compostoId)
    setComposto(c)
    // Calcola ultima_rivalidazione (MAX nuova_scadenza) dallo storico già caricato
    if (c?.storia?.length) {
      const scadenze = c.storia
        .filter((s: any) => s.tipo === 'Rivalidazione' && s.nuova_scadenza)
        .map((s: any) => s.nuova_scadenza as string)
      setUltimaRivalidazione(scadenze.length > 0 ? scadenze.sort().at(-1) : null)
    } else {
      setUltimaRivalidazione(null)
    }
  }

  useEffect(() => { load() }, [compostoId])

  if (!composto) return null

  const Field = ({ label, value }: { label: string; value?: any }) => (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? '—'}</span>
    </div>
  )

  const openStoria = async (tipo: string) => {
    setStoriaData({
      data: new Date().toISOString().split('T')[0],
      note: '',
      n_registro_qc: '',
      batch_analitico: '',
      lotto_crm_valido: '',
      nuova_scadenza: '',
    })
    if (tipo === 'Rivalidazione' && composto?.id) {
      const lotti = await window.electronAPI.invoke('composti:lotti-validi', composto.id)
      setLottiValidi(lotti as any[])
    } else {
      setLottiValidi([])
    }
    setStoriaForm({ open: true, tipo })
  }

  const handleAddStoria = async () => {
    await compostiApi.addStoria(composto.id, {
      tipo: storiaForm.tipo,
      data: storiaData.data,
      note: storiaData.note || undefined,
      n_registro_qc: storiaData.n_registro_qc || undefined,
      batch_analitico: storiaData.batch_analitico || undefined,
      lotto_crm_valido: storiaData.lotto_crm_valido || undefined,
      nuova_scadenza: storiaData.nuova_scadenza || undefined,
    })
    setStoriaForm({ open: false, tipo: '' })
    load()
  }

  const handlePrepRefresh = () => {
    load()
    onRefreshList?.()
  }

  // Composto arricchito con ultima_rivalidazione per computeStato corretto nell'header
  const compostoConRival = { ...composto, ultima_rivalidazione: ultimaRivalidazione }

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

        <Tabs defaultValue={defaultTab ?? 'dettaglio'}>
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
          </TabsContent>

          {composto.forma === 'Neat' && (
            <TabsContent value="preparazioni" className="mt-3">
              <PreparazioniTab compostoId={composto.id} preparazioni={composto.preparazioni || []} onRefresh={handlePrepRefresh} />
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
            {composto.data_apertura && (
             <div className="flex items-start gap-2 py-2 border-b opacity-75">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 shrink-0 pt-0.5">
              Apertura
              </span>
              <div className="flex-1">
               <div className="text-xs font-medium">
                 {composto.mix_id
                   ? `Apertura mix ${composto.mix}`
                   : 'Apertura flacone'}
               </div>
              <div className="text-[11px] text-muted-foreground">
               {formatDate(composto.data_apertura)}
              {composto.operatore_apertura && ` — ${composto.operatore_apertura}`}
             </div>
            </div>
           </div>
          )}
            {composto.storia?.length ? composto.storia.map((s: any) => (
              <div key={s.id} className="p-3 border rounded-md text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={s.tipo === 'Rivalidazione' ? 'default' : s.tipo === 'apertura_fiala' ? 'outline' : 'destructive'}
                    className="text-xs"
                  >
                    {s.tipo === 'apertura_fiala' ? `Fiala ${s.fiala_numero} aperta` : s.tipo}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(s.data)}</span>
                </div>
                {s.n_registro_qc && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">N° Registro QC: </span>
                    <span className="font-mono">{s.n_registro_qc}</span>
                  </div>
                )}
                {s.batch_analitico && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Batch: </span>
                    <span className="font-mono">{s.batch_analitico}</span>
                  </div>
                )}
                {s.lotto_crm_valido && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Lotto CRM: </span>
                    <span className="font-mono">{s.lotto_crm_valido}</span>
                  </div>
                )}
                {s.nuova_scadenza && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Scadenza estesa al: </span>
                    <span className="font-mono font-medium text-blue-700">{formatDate(s.nuova_scadenza)}</span>
                  </div>
                )}
                {s.note && (
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                )}
              </div>
            )) : <p className="text-xs text-muted-foreground">Nessun evento registrato</p>}
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
                        lotto_crm_valido: v === '_manual' ? '' : v
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona lotto..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_manual">— Inserisci manualmente —</SelectItem>
                        {lottiValidi.map((l: any) => (
                          <SelectItem key={l.id} value={l.lotto || String(l.id)}>
                            <span className="font-mono text-xs">
                              {l.lotto || 'N/D'}
                              {l.scadenza_prodotto && (
                                <span className="text-muted-foreground ml-2">scad. {l.scadenza_prodotto}</span>
                              )}
                              {l.forma_commerciale && (
                                <span className="text-muted-foreground ml-1">· {l.forma_commerciale}</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {(lottiValidi.length === 0 || storiaData.lotto_crm_valido === '' && lottiValidi.length > 0) && (
                    <Input
                      className={lottiValidi.length > 0 ? 'mt-1' : ''}
                      value={storiaData.lotto_crm_valido}
                      onChange={e => setStoriaData(f => ({ ...f, lotto_crm_valido: e.target.value }))}
                      placeholder="es. FN0872121"
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Nuova data di scadenza</Label>
                  <Input
                    type="date"
                    value={storiaData.nuova_scadenza}
                    onChange={e => setStoriaData(f => ({ ...f, nuova_scadenza: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se compilato, compare nello storico e determina lo stato "Rivalidato".
                  </p>
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Note</Label>
              <Textarea
                value={storiaData.note}
                onChange={e => setStoriaData(f => ({ ...f, note: e.target.value }))}
                rows={2}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStoriaForm({ open: false, tipo: '' })}>
              Annulla
            </Button>
            <Button onClick={handleAddStoria}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SlidePanel>
  )
}