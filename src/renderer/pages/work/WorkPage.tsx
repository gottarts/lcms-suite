import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { workApi } from '@/lib/api'
import { WorkDrawer } from './WorkDrawer'
import { WorkForm } from './WorkForm'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, FlaskConical, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function WorkPage() {
  const navigate = useNavigate()
  const [works, setWorks] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editWork, setEditWork] = useState<any>(null)
  const [drawerId, setDrawerId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const load = async () => {
    const data = await workApi.list()
    setWorks(data)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return works
    const q = search.toLowerCase()
    return works.filter(w =>
      w.nome?.toLowerCase().includes(q) ||
      w.solvente?.toLowerCase().includes(q) ||
      w.operatore?.toLowerCase().includes(q)
    )
  }, [works, search])

  const handleDelete = async () => {
    if (deleteId !== null) {
      await workApi.delete(deleteId)
      setDeleteId(null)
      setDrawerId(null)
      load()
    }
  }

  const handleEdit = (work: any) => {
    setEditWork(work)
    setDrawerId(null)
    setFormOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Work Solutions</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} work</span>
          <Button size="sm" onClick={() => { setEditWork(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuova Work
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

      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 text-sm">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nessuna Work trovata.</p>
          <p className="text-xs mt-1 opacity-70">
            Le Work vengono create dallo Schema Calibrazione nel modulo Metodi,<br/>
            oppure manualmente con il pulsante &quot;Nuova Work&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(w => (
            <WorkCard
              key={w.id}
              work={w}
              onClick={() => setDrawerId(w.id)}
              onPrepara={() => setDrawerId(w.id)}
              onGoSchema={w.primo_metodo_id ? () => navigate('/metodi', { state: { schemaMetodoId: w.primo_metodo_id } }) : undefined}
            />
          ))}
        </div>
      )}

      <WorkForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditWork(null) }}
        work={editWork}
        onSave={load}
      />

      <WorkDrawer
        workId={drawerId}
        onClose={() => setDrawerId(null)}
        onEdit={handleEdit}
        onDelete={id => { setDrawerId(null); setDeleteId(id) }}
        onVaiASchema={(metodoId) => { setDrawerId(null); navigate('/metodi', { state: { schemaMetodoId: metodoId } }) }}
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

    </div>
  )
}

// ─── Card Work ────────────────────────────────────────────────────────────────

const STATO_LAB_BADGE: Record<string, { label: string; className: string }> = {
  attiva:       { label: 'Attiva',       className: 'border-green-300 text-green-700 bg-green-50' },
  in_scadenza:  { label: 'In scadenza',  className: 'border-amber-300 text-amber-700 bg-amber-50' },
  scaduta:      { label: 'Scaduta',      className: 'border-red-300 text-red-700 bg-red-50' },
  non_preparata:{ label: 'Non preparata',className: 'text-muted-foreground' },
}

function WorkCard({ work, onClick, onPrepara, onGoSchema }: { work: any; onClick: () => void; onPrepara?: () => void; onGoSchema?: () => void }) {
  const isTracciata = !!work.validita_mesi
  const isIntermedia = (work.livello ?? 0) > 0
  const isBloccata = !!work.bloccata
  const haScaduti = !!work.ha_crm_scaduti
  const statoLab = work.stato_lab as string | null | undefined
  const statoBadge = statoLab ? STATO_LAB_BADGE[statoLab] : null

  // Calcola data scadenza per badge attiva/in_scadenza
  const scadenzaLabel = (() => {
    if (!work.ultima_preparazione?.data_prep || !work.validita_mesi) return null
    const d = new Date(work.ultima_preparazione.data_prep)
    d.setDate(d.getDate() + Math.round(work.validita_mesi * 30.44))
    return formatDate(d.toISOString().slice(0, 10))
  })()

  return (
    <div
      className="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:shadow-md transition-shadow p-4"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-heading font-semibold text-sm leading-tight">{work.nome}</div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isBloccata && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700 bg-red-50 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />
              CRM dismessi
            </Badge>
          )}
          {!isBloccata && haScaduti && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-400 text-yellow-700 bg-yellow-50 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />
              CRM scaduti
            </Badge>
          )}
          {isIntermedia && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-700 bg-purple-50">
              Intermedia
            </Badge>
          )}
          {isTracciata ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
              {work.validita_mesi} mesi
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              al momento
            </Badge>
          )}
          {statoBadge && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statoBadge.className}`}>
              {statoBadge.label}{scadenzaLabel && (statoLab === 'attiva' || statoLab === 'in_scadenza') ? ` · ${scadenzaLabel}` : ''}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {work.concentrazione != null && !work.conc_variabile && (
          <div>
            <span className="text-foreground font-medium">
              {work.concentrazione} {work.unita_conc ?? 'mg/L'}
            </span>
          </div>
        )}
        {work.conc_variabile === 1 && (
          <div><span className="text-foreground italic">variabile</span></div>
        )}
        {work.volume_ml && (
          <div>{work.volume_ml} mL</div>
        )}
        {work.solvente && (
          <div className="col-span-2 truncate">{work.solvente}</div>
        )}
        {work.operatore && (
          <div className="col-span-2 truncate">Op: {work.operatore}</div>
        )}
      </div>
      {(onPrepara || onGoSchema) && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
          {onPrepara && work.validita_mesi && (
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] px-2 flex-1"
              onClick={onPrepara}
              disabled={isBloccata}
              title={isBloccata ? 'Work bloccata: uno o più CRM sono stati dismessi' : undefined}
            >
              <FlaskConical className="h-3 w-3 mr-1" />
              {work.ultima_preparazione ? 'Rinnova' : 'Prepara'}
            </Button>
          )}
          {onGoSchema && (
            <Button
              size="sm" variant="outline"
              className={`h-6 text-[10px] px-2 flex-1${isBloccata ? ' border-orange-300 text-orange-700 hover:bg-orange-50' : ''}`}
              onClick={onGoSchema}
              title={isBloccata ? 'Vai allo Schema per aggiornare i lotti e creare una nuova work' : undefined}
            >
              {isBloccata ? 'Aggiorna Schema ↗' : 'Schema ↗'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
