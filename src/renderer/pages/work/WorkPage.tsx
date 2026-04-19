import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { workApi, metodiApi } from '@/lib/api'
import { useDbChange } from '@/lib/useDbChange'
import { WorkDrawer } from './WorkDrawer'
import { WorkForm } from './WorkForm'
import { AggiungiASchemaDialog } from './AggiungiASchemaDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, FlaskConical, AlertCircle, Archive, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function WorkPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [works, setWorks] = useState<any[]>([])
  const [metodiNomi, setMetodiNomi] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editWork, setEditWork] = useState<any>(null)
  const [drawerId, setDrawerId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [preparaWorkId, setPreparaWorkId] = useState<number | null>(null)
  const [preparaData, setPreparaData] = useState('')
  const [preparaOp, setPreparaOp] = useState('')
  const [preparaNote, setPreparaNote] = useState('')
  const [preparaSaving, setPreparaSaving] = useState(false)
  const [archiviaId, setArchiviaId] = useState<number | null>(null)
  const [mostraArchivio, setMostraArchivio] = useState(false)
  const [addToSchemaWork, setAddToSchemaWork] = useState<{ id: number; nome: string } | null>(null)
  const [filtroMetodo, setFiltroMetodo] = useState<string | null>(null)
  const [expandId, setExpandId] = useState<number | null>(null)
  const [pendingExpandId, setPendingExpandId] = useState<number | null>(null)
  const [prepCount, setPrepCount] = useState<Record<number, number>>({})

  const load = async (archivio = false) => {
    const [data, metodi] = await Promise.all([
      archivio ? workApi.listArchivio() : workApi.list(),
      metodiApi.list(),
    ])
    setWorks(data)
    const nomi: Record<string, string> = {}
    for (const m of metodi) { if (m.id) nomi[m.id] = m.nome ?? m.id }
    setMetodiNomi(nomi)
  }

  useEffect(() => { load(mostraArchivio) }, [mostraArchivio])
  useDbChange(() => load(mostraArchivio))

  // Apertura automatica da link esterno (es. Audit) — espande lo storico preparazioni
  useEffect(() => {
    const state = location.state as { openWorkId?: number; archiviata?: boolean; filtroMetodo?: string; searchWork?: string } | null
    if (!state?.openWorkId) return
    if (state.filtroMetodo) setFiltroMetodo(state.filtroMetodo)
    if (state.searchWork) setSearch(state.searchWork)
    if (state.archiviata) {
      setPendingExpandId(state.openWorkId)
      setMostraArchivio(true)
    } else {
      setExpandId(state.openWorkId)
    }
  }, [])

  // Consuma pendingExpandId non appena le works archiviate sono caricate
  useEffect(() => {
    if (pendingExpandId !== null && works.some(w => w.id === pendingExpandId)) {
      setExpandId(pendingExpandId)
      setPendingExpandId(null)
    }
  }, [pendingExpandId, works])

  const filtered = useMemo(() => {
    let result = works
    if (filtroMetodo) {
      result = result.filter(w => w.metodi_ids?.includes(filtroMetodo))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(w =>
        w.nome?.toLowerCase().includes(q) ||
        w.solvente?.toLowerCase().includes(q) ||
        w.operatore?.toLowerCase().includes(q)
      )
    }
    return result
  }, [works, search, filtroMetodo])

  const metodiConWork = useMemo(() => {
    const ids = new Set<string>()
    for (const w of works) {
      for (const mid of (w.metodi_ids ?? [])) ids.add(mid)
    }
    return [...ids].filter(id => metodiNomi[id])
  }, [works, metodiNomi])

  const handleDelete = async () => {
    if (deleteId !== null) {
      await workApi.delete(deleteId)
      setDeleteId(null)
      setDrawerId(null)
      load(mostraArchivio)
    }
  }

  const handleArchivia = async () => {
    if (archiviaId !== null) {
      await workApi.archivia(archiviaId, 'Archiviata manualmente')
      setArchiviaId(null)
      setDrawerId(null)
      load(false)
    }
  }

  const handleEdit = (work: any) => {
    setEditWork(work)
    setDrawerId(null)
    setFormOpen(true)
  }

  const handlePrepara = async () => {
    if (!preparaWorkId || !preparaData || !preparaOp.trim()) return
    setPreparaSaving(true)
    const workId = preparaWorkId
    await workApi.prepara({
      work_id: workId,
      data_prep: preparaData,
      note: preparaNote || null,
      operatore: preparaOp.trim(),
    })
    setPreparaSaving(false)
    setPreparaWorkId(null)
    setPrepCount(prev => ({ ...prev, [workId]: (prev[workId] ?? 0) + 1 }))
    load(mostraArchivio)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Work Solutions</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} work</span>
          <Button
            size="sm"
            variant={mostraArchivio ? 'secondary' : 'outline'}
            onClick={() => { setMostraArchivio(v => !v); setSearch(''); setFiltroMetodo(null) }}
          >
            <Archive className="h-4 w-4 mr-1" />
            {mostraArchivio ? 'Archiviate' : 'Archivio'}
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca work..."
          className="pl-9"
        />
      </div>

      {!mostraArchivio && metodiConWork.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setFiltroMetodo(null)}
            className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
              filtroMetodo === null
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
            }`}
          >Tutti</button>
          {metodiConWork.map(mid => (
            <button
              key={mid}
              onClick={() => setFiltroMetodo(filtroMetodo === mid ? null : mid)}
              className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                filtroMetodo === mid
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-background text-indigo-700 border-indigo-300 hover:bg-indigo-50'
              }`}
            >{metodiNomi[mid]}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 text-sm">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{mostraArchivio ? 'Nessuna Work archiviata.' : 'Nessuna Work trovata.'}</p>
          {!mostraArchivio && (
            <p className="text-xs mt-1 opacity-70">
              Le Work vengono create dallo Schema Calibrazione nel modulo Metodi,<br/>
              oppure manualmente con il pulsante &quot;Nuova Work&quot;.
            </p>
          )}
        </div>
      ) : mostraArchivio ? (
        <div className="space-y-2">
          {filtered.map(w => (
            <WorkRowArchivio key={w.id} work={w} metodiNomi={metodiNomi} onClick={() => setDrawerId(w.id)} initialExpanded={expandId === w.id} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(w => (
            <WorkRow
              key={`${w.id}-${prepCount[w.id] ?? 0}`}
              work={w}
              metodiNomi={metodiNomi}
              onClick={() => setDrawerId(w.id)}
              onPrepara={() => {
                setPreparaWorkId(w.id)
                setPreparaData(new Date().toISOString().slice(0, 10))
                setPreparaOp('')
                setPreparaNote('')
              }}
              onGoSchema={w.metodi_ids?.length > 0 ? (mid: string) => navigate('/metodi', { state: { schemaMetodoId: mid } }) : undefined}
              onAddToSchema={() => setAddToSchemaWork({ id: w.id, nome: w.nome })}
              onEdit={() => handleEdit(w)}
              onArchivia={() => { setDrawerId(null); setArchiviaId(w.id) }}
              initialExpanded={expandId === w.id}
            />
          ))}
        </div>
      )}

      <WorkForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditWork(null) }}
        work={editWork}
        onSave={() => load(mostraArchivio)}
      />

      <WorkDrawer
        workId={drawerId}
        onClose={() => setDrawerId(null)}
        onEdit={handleEdit}
        onDelete={id => { setDrawerId(null); setDeleteId(id) }}
        onArchivia={!mostraArchivio ? id => { setDrawerId(null); setArchiviaId(id) } : undefined}
        onVaiASchema={(metodoId) => { setDrawerId(null); navigate('/metodi', { state: { schemaMetodoId: metodoId } }) }}
        metodiNomi={metodiNomi}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Elimina Work"
        message="Sei sicuro di voler eliminare questa Work? Verranno rimossi anche tutti gli ingredienti e le associazioni ai metodi."
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={archiviaId !== null}
        title="Archivia Work"
        message="Vuoi archiviare questa Work? Rimarrà consultabile nell'archivio ma non comparirà più nella lista attiva."
        confirmLabel="Archivia"
        variant="default"
        onConfirm={handleArchivia}
        onCancel={() => setArchiviaId(null)}
      />

      <AggiungiASchemaDialog
        open={addToSchemaWork !== null}
        workId={addToSchemaWork?.id ?? null}
        workNome={addToSchemaWork?.nome ?? ''}
        onClose={() => setAddToSchemaWork(null)}
      />

      <Dialog open={preparaWorkId !== null} onOpenChange={v => { if (!v) setPreparaWorkId(null) }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Prepara / Rinnova Soluzione Work</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="w-20 text-xs shrink-0">Data *</Label>
              <input
                type="date"
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={preparaData}
                onChange={e => setPreparaData(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-20 text-xs shrink-0">Operatore *</Label>
              <Input
                className="flex-1 text-sm"
                placeholder="es. V.G."
                value={preparaOp}
                onChange={e => setPreparaOp(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-2">
              <Label className="w-20 text-xs shrink-0 pt-1.5">Note</Label>
              <Textarea
                className="flex-1 text-sm"
                placeholder="Opzionale..."
                rows={2}
                value={preparaNote}
                onChange={e => setPreparaNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreparaWorkId(null)} disabled={preparaSaving}>
              Annulla
            </Button>
            <Button
              onClick={handlePrepara}
              disabled={preparaSaving || !preparaData || !preparaOp.trim()}
            >
              {preparaSaving ? 'Salvo...' : 'Conferma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ─── Riga Work Archiviata ─────────────────────────────────────────────────────

function WorkRowArchivio({ work, metodiNomi, onClick, initialExpanded }: { work: any; metodiNomi: Record<string, string>; onClick: () => void; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(true)
  const [storico, setStorico] = useState<any[] | null>(null)
  const [loadingStorico, setLoadingStorico] = useState(false)

  const isTracciata = !!work.validita_mesi

  useEffect(() => {
    if (!isTracciata) return
    setLoadingStorico(true)
    workApi.preparazioniList(work.id).then(data => {
      setStorico(data)
      setLoadingStorico(false)
    })
  }, [])

  const handleToggleStorico = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (storico === null) {
      setLoadingStorico(true)
      const data = await workApi.preparazioniList(work.id)
      setStorico(data)
      setLoadingStorico(false)
    }
  }

  return (
    <div className="border rounded-md overflow-hidden opacity-75" data-archivio-row>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={onClick}
      >
        <div className="font-medium text-sm flex-1 truncate">{work.nome}</div>
        {work.archiviato_at && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {formatDate(work.archiviato_at.slice(0, 10))}
          </span>
        )}
        {work.archiviato_motivo && (
          <span className="text-xs text-muted-foreground italic truncate max-w-[160px] hidden md:block">
            {work.archiviato_motivo}
          </span>
        )}
        {work.metodi_ids && work.metodi_ids.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {work.metodi_ids.map((mid: string) => (
              <Badge key={mid} variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                {metodiNomi[mid] ?? mid}
              </Badge>
            ))}
          </div>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground">
          <Archive className="h-2.5 w-2.5 mr-1" />
          Archiviata
        </Badge>
        {isTracciata && (
          <Button
            size="sm" variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground shrink-0"
            onClick={handleToggleStorico}
            title={expanded ? 'Nascondi storico preparazioni' : 'Mostra storico preparazioni'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="divide-y divide-border">
          {loadingStorico && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Caricamento...</div>
          )}
          {!loadingStorico && storico && storico.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">Nessuna preparazione registrata.</div>
          )}
          {!loadingStorico && storico && storico.map((p: any) => {
            const scad = (() => {
              if (!p.data_prep || !work.validita_mesi) return null
              const d = new Date(p.data_prep)
              d.setDate(d.getDate() + Math.round(work.validita_mesi * 30.44))
              return d.toISOString().slice(0, 10)
            })()
            const oggi = new Date().toISOString().slice(0, 10)
            const stato = scad
              ? (scad < oggi ? 'scaduta' : scad <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) ? 'in_scadenza' : 'attiva')
              : null
            const sb = stato ? STATO_LAB_BADGE[stato] : null
            return (
              <div key={p.id} className="px-3 py-2 text-xs flex items-center gap-3 bg-background">
                <span className="font-medium">Soluzione Work preparata il {formatDate(p.data_prep)}</span>
                {p.operatore && <span className="text-muted-foreground">· {p.operatore}</span>}
                {p.note && <span className="italic text-muted-foreground truncate max-w-[200px]">{p.note}</span>}
                {scad && <span className="text-muted-foreground ml-auto shrink-0">scad. {formatDate(scad)}</span>}
                {sb && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${sb.className}`}>
                    {sb.label}
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Badge stato lab ──────────────────────────────────────────────────────────

const STATO_LAB_BADGE: Record<string, { label: string; className: string }> = {
  attiva:        { label: 'Attiva',        className: 'border-green-300 text-green-700 bg-green-50' },
  in_scadenza:   { label: 'In scadenza',   className: 'border-amber-300 text-amber-700 bg-amber-50' },
  scaduta:       { label: 'Scaduta',       className: 'border-red-300 text-red-700 bg-red-50' },
  non_preparata: { label: 'Non preparata', className: 'text-muted-foreground' },
}

// ─── Riga Work ────────────────────────────────────────────────────────────────

function WorkRow({
  work,
  metodiNomi,
  onClick,
  onPrepara,
  onGoSchema,
  onAddToSchema,
  onEdit,
  onArchivia,
  initialExpanded,
}: {
  work: any
  metodiNomi?: Record<string, string>
  onClick: () => void
  onPrepara?: () => void
  onGoSchema?: (metodoId: string) => void
  onAddToSchema?: () => void
  onEdit?: () => void
  onArchivia?: () => void
  initialExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [storico, setStorico] = useState<any[] | null>(null)
  const [loadingStorico, setLoadingStorico] = useState(false)

  const isTracciata   = !!work.validita_mesi

  useEffect(() => {
    if (!isTracciata) return
    setLoadingStorico(true)
    workApi.preparazioniList(work.id).then(data => {
      setStorico(data)
      setLoadingStorico(false)
    })
  }, [])
  const isIntermedia  = (work.livello ?? 0) > 0
  const isBloccata    = !!work.bloccata
  const haScaduti     = !!work.ha_crm_scaduti
  const statoLab      = work.stato_lab as string | null | undefined
  const statoBadge    = statoLab ? STATO_LAB_BADGE[statoLab] : null

  const scadenzaLabel = (() => {
    if (!work.ultima_preparazione?.data_prep || !work.validita_mesi) return null
    const d = new Date(work.ultima_preparazione.data_prep)
    d.setDate(d.getDate() + Math.round(work.validita_mesi * 30.44))
    return formatDate(d.toISOString().slice(0, 10))
  })()

  const infoCompatta = [
    work.concentrazione != null && !work.conc_variabile
      ? `Concentrazione ${work.concentrazione} ${work.unita_conc ?? 'mg/L'}`
      : work.conc_variabile ? 'Concentrazione variabile' : null,
    work.volume_ml ? `Volume ${work.volume_ml} mL` : null,
    work.solvente ?? null,
    work.operatore ? `Op: ${work.operatore}` : null,
  ].filter(Boolean).join(' · ')

  const handleToggleStorico = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (storico === null) {
      setLoadingStorico(true)
      const data = await workApi.preparazioniList(work.id)
      setStorico(data)
      setLoadingStorico(false)
    }
  }

  return (
    <div className="border rounded-md overflow-hidden" style={{ borderLeft: `3px solid ${isIntermedia ? '#9b86d6' : '#c49540'}` }}>
      {/* Header riga */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        {/* Nome + badge tipo + pulsante Prepara/Rinnova + badge tracciabilità */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="font-medium text-sm min-w-0 truncate">{work.nome}</div>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 shrink-0 font-medium"
            style={
              isIntermedia
                ? { borderColor: '#9b86d6', color: '#5a3fa0', backgroundColor: '#f2effe' }
                : { borderColor: '#c49540', color: '#6b4f1a', backgroundColor: '#fdf6e8' }
            }
          >
            {isIntermedia ? 'Intermedia' : 'Work'}
          </Badge>
          {onPrepara && isTracciata && (
            <div onClick={e => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                className={`h-6 text-[11px] px-2.5 shrink-0 font-medium gap-1.5 ${
                  isBloccata
                    ? 'border-orange-300 text-orange-700 bg-orange-50/60 hover:bg-orange-100 cursor-not-allowed opacity-60'
                    : work.ultima_preparazione
                    ? 'border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                    : 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                }`}
                onClick={onPrepara}
                disabled={isBloccata}
                title={isBloccata ? 'Work bloccata: uno o più CRM sono stati dismessi' : undefined}
              >
                <FlaskConical className="h-3 w-3" />
                {work.ultima_preparazione ? 'Rinnova' : 'Prepara'}
              </Button>
            </div>
          )}
          {!!work.ha_figlie_obsolete && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-yellow-400 text-yellow-700 bg-yellow-50 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />Figlie da ripreparare
            </Badge>
          )}
          {!!work.ha_sorgente_rinnovata && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-yellow-400 text-yellow-700 bg-yellow-50 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />Sorgente rinnovata
            </Badge>
          )}
        </div>

        {/* Info compatta */}
        {infoCompatta && (
          <span className="text-xs text-muted-foreground hidden lg:block shrink-0 max-w-[420px] truncate">
            {infoCompatta}
          </span>
        )}

        {/* Badge alert */}
        {isBloccata && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-red-300 text-red-700 bg-red-50 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5" />CRM dismessi
          </Badge>
        )}
        {!isBloccata && haScaduti && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-yellow-400 text-yellow-700 bg-yellow-50 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5" />CRM scaduti
          </Badge>
        )}
        {!isBloccata && !!work.ha_prep_scadute && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-yellow-400 text-yellow-700 bg-yellow-50 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5" />Prep stock scadute
          </Badge>
        )}
        {isTracciata ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-amber-300 text-amber-700 bg-amber-50">
            Durata {work.validita_mesi} mesi
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground">
            al momento
          </Badge>
        )}
        {statoBadge && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${statoBadge.className}`}>
            {statoBadge.label}{scadenzaLabel && (statoLab === 'attiva' || statoLab === 'in_scadenza') ? ` · Scade il ${scadenzaLabel}` : ''}
          </Badge>
        )}

        {/* Metodi badge */}
        {metodiNomi && work.metodi_ids && work.metodi_ids.length > 0 && (
          <div className="flex gap-1 shrink-0 hidden sm:flex">
            {work.metodi_ids.map((mid: string) => (
              <Badge key={mid} variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-300 text-indigo-700 bg-indigo-50">
                {metodiNomi[mid] ?? mid}
              </Badge>
            ))}
          </div>
        )}

        {/* Pulsanti azioni */}
        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {onGoSchema && work.metodi_ids && work.metodi_ids.length > 0 && (
            work.metodi_ids.length === 1 ? (
              <Button
                size="sm" variant="outline"
                className={`h-6 text-[10px] px-2${isBloccata ? ' border-orange-300 text-orange-700 hover:bg-orange-50' : ''}`}
                onClick={() => onGoSchema(work.metodi_ids[0])}
                title={isBloccata ? 'Vai allo Schema per aggiornare i lotti e creare una nuova work' : undefined}
              >
                {isBloccata ? 'Aggiorna Schema ↗' : 'Schema ↗'}
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm" variant="outline"
                    className={`h-6 text-[10px] px-2${isBloccata ? ' border-orange-300 text-orange-700 hover:bg-orange-50' : ''}`}
                    title={isBloccata ? 'Vai allo Schema per aggiornare i lotti e creare una nuova work' : undefined}
                  >
                    {isBloccata ? 'Aggiorna Schema ↗' : 'Schema ↗'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(work.metodi_ids as string[]).map((mid: string) => (
                    <DropdownMenuItem key={mid} onClick={() => onGoSchema(mid)}>
                      {metodiNomi?.[mid] ?? mid}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
          {onAddToSchema && (
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={onAddToSchema}
              title="Aggiungi questa work a un metodo"
            >
              + Metodo ↗
            </Button>
          )}
          {onEdit && (
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onArchivia && (
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] px-2 text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={onArchivia}
              title="Archivia work"
            >
              <Archive className="h-3 w-3" />
            </Button>
          )}
          {isTracciata && (
            <Button
              size="sm" variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={handleToggleStorico}
              title={expanded ? 'Nascondi storico preparazioni' : 'Mostra storico preparazioni'}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Storico preparazioni */}
      {expanded && (
        <div className="divide-y divide-border">
          {loadingStorico && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Caricamento...</div>
          )}
          {!loadingStorico && storico && storico.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">Nessuna preparazione registrata.</div>
          )}
          {!loadingStorico && storico && storico.map((p: any) => {
            const scad = (() => {
              if (!p.data_prep || !work.validita_mesi) return null
              const d = new Date(p.data_prep)
              d.setDate(d.getDate() + Math.round(work.validita_mesi * 30.44))
              return d.toISOString().slice(0, 10)
            })()
            const oggi = new Date().toISOString().slice(0, 10)
            const stato = scad
              ? (scad < oggi ? 'scaduta' : scad <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) ? 'in_scadenza' : 'attiva')
              : null
            const sb = stato ? STATO_LAB_BADGE[stato] : null
            return (
              <div key={p.id} className="px-3 py-2 text-xs flex items-center gap-3 bg-background">
                <span className="font-medium">Soluzione Work preparata il {formatDate(p.data_prep)}</span>
                {p.operatore && <span className="text-muted-foreground">· {p.operatore}</span>}
                {p.note && <span className="italic text-muted-foreground truncate max-w-[200px]">{p.note}</span>}
                {scad && (
                  <span className="text-muted-foreground ml-auto shrink-0">scad. {formatDate(scad)}</span>
                )}
                {sb && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${sb.className}`}>
                    {sb.label}
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
