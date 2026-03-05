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
import { Pencil, Trash2, RotateCcw, XCircle } from 'lucide-react'
import { compostiApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { PreparazioniTab } from './PreparazioniTab'

interface CompostoPanelProps {
  compostoId: number | null
  onClose: () => void
  onEdit: (composto: any) => void
  onDelete: (id: number) => void
}

export function CompostoPanel({ compostoId, onClose, onEdit, onDelete }: CompostoPanelProps) {
  const [composto, setComposto] = useState<any>(null)
  const [storiaForm, setStoriaForm] = useState<{ open: boolean; tipo: string }>({ open: false, tipo: '' })
  const [storiaData, setStoriaData] = useState({ data: new Date().toISOString().split('T')[0], note: '' })

  const load = () => {
    if (compostoId) compostiApi.get(compostoId).then(setComposto)
  }

  useEffect(() => { load() }, [compostoId])

  if (!composto) return null

  const Field = ({ label, value }: { label: string; value?: any }) => (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? '—'}</span>
    </div>
  )

  const handleAddStoria = async () => {
    await compostiApi.addStoria(composto.id, { tipo: storiaForm.tipo, data: storiaData.data, note: storiaData.note || undefined })
    setStoriaForm({ open: false, tipo: '' })
    load()
  }

  return (
    <SlidePanel open={!!compostoId} onClose={onClose} title={composto.nome} subtitle={composto.codice_interno || undefined} width="520px">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={computeStato(composto)} />
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onEdit(composto)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(composto.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
          </Button>
        </div>

        <Tabs defaultValue="dettaglio">
          <TabsList className="w-full">
            <TabsTrigger value="dettaglio" className="flex-1">Dettaglio</TabsTrigger>
            <TabsTrigger value="preparazioni" className="flex-1">Preparazioni ({composto.preparazioni?.length || 0})</TabsTrigger>
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
            <Field label="Concentrazione" value={composto.concentrazione} />
            <Field label="Solvente" value={composto.solvente} />
            <Field label="Fiala" value={composto.fiala} />
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
            <Field label="Matrice" value={composto.matrice} />
            <Field label="Ubicazione" value={composto.ubicazione} />
            <Field label="ARPA" value={composto.arpa} />
            <Field label="Mix" value={composto.mix} />
            <Field label="Mix ID" value={composto.mix_id} />
          </TabsContent>

          <TabsContent value="preparazioni" className="mt-3">
            <PreparazioniTab compostoId={composto.id} preparazioni={composto.preparazioni || []} onRefresh={load} />
          </TabsContent>

          <TabsContent value="storico" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setStoriaForm({ open: true, tipo: 'Rivalidazione' }); setStoriaData({ data: new Date().toISOString().split('T')[0], note: '' }) }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rivalidazione
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setStoriaForm({ open: true, tipo: 'Dismissione' }); setStoriaData({ data: new Date().toISOString().split('T')[0], note: '' }) }}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Dismissione
              </Button>
            </div>
            {composto.storia?.length ? composto.storia.map((s: any) => (
              <div key={s.id} className="p-2 border rounded-md text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={s.tipo === 'Rivalidazione' ? 'default' : 'destructive'} className="text-xs">{s.tipo}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(s.data)}</span>
                </div>
                {s.note && <p className="text-xs mt-1 text-muted-foreground">{s.note}</p>}
              </div>
            )) : <p className="text-xs text-muted-foreground">Nessun evento registrato</p>}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={storiaForm.open} onOpenChange={v => !v && setStoriaForm({ open: false, tipo: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">{storiaForm.tipo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Data</Label><Input type="date" value={storiaData.data} onChange={e => setStoriaData(f => ({ ...f, data: e.target.value }))} /></div>
            <div><Label className="text-xs">Note</Label><Textarea value={storiaData.note} onChange={e => setStoriaData(f => ({ ...f, note: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStoriaForm({ open: false, tipo: '' })}>Annulla</Button>
            <Button onClick={handleAddStoria}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SlidePanel>
  )
}
