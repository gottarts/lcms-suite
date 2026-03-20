import { useState, useEffect } from 'react'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Trash2, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react'
import { workApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface WorkDrawerProps {
  workId: number | null
  onClose: () => void
  onEdit: (work: any) => void
  onDelete: (id: number) => void
}

const STATO_LAB_BADGE: Record<string, { label: string; className: string }> = {
  attiva:        { label: 'Attiva',        className: 'border-green-300 text-green-700 bg-green-50' },
  in_scadenza:   { label: 'In scadenza',   className: 'border-amber-400 text-amber-700 bg-amber-50' },
  scaduta:       { label: 'Scaduta',       className: 'border-red-300 text-red-700 bg-red-50' },
  non_preparata: { label: 'Non preparata', className: 'text-muted-foreground' },
}

function scadenzaDate(dataPrepISO: string, validita_mesi: number): string {
  const d = new Date(dataPrepISO)
  d.setDate(d.getDate() + Math.round(validita_mesi * 30.44))
  return d.toISOString().slice(0, 10)
}

export function WorkDrawer({ workId, onClose, onEdit, onDelete }: WorkDrawerProps) {
  const [work, setWork] = useState<any>(null)
  const [storico, setStorico] = useState<any[]>([])
  const [storicoOpen, setStoricoOpen] = useState(false)
  const [prepForm, setPrepForm] = useState(false)
  const [prepData, setPrepData] = useState('')
  const [prepNote, setPrepNote] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = (id: number) => workApi.get(id).then(setWork)

  useEffect(() => {
    if (workId) {
      reload(workId)
      setStorico([])
      setStoricoOpen(false)
      setPrepForm(false)
      setPrepData(new Date().toISOString().slice(0, 10))
      setPrepNote('')
    } else {
      setWork(null)
    }
  }, [workId])

  const loadStorico = async () => {
    if (!workId) return
    const data = await workApi.preparazioniList(workId)
    setStorico(data)
    setStoricoOpen(true)
  }

  const handlePrepara = async () => {
    if (!workId || !prepData) return
    setSaving(true)
    await workApi.prepara({ work_id: workId, data_prep: prepData, note: prepNote || null })
    await reload(workId)
    setPrepForm(false)
    setPrepNote('')
    if (storicoOpen) await loadStorico()
    setSaving(false)
  }

  if (!work) return null

  const isTracciata = !!work.validita_mesi
  const isIntermedia = (work.livello ?? 0) > 0
  const statoLab = work.stato_lab as string | null | undefined
  const statoBadge = statoLab ? STATO_LAB_BADGE[statoLab] : null

  const Field = ({ label, value }: { label: string; value?: string | number | null }) => {
    if (value == null || value === '') return null
    return (
      <div className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right">{String(value)}</span>
      </div>
    )
  }

  return (
    <SlidePanel
      open={!!workId}
      onClose={onClose}
      title={work.nome}
      subtitle={isIntermedia ? 'Work Intermedia' : 'Work Solution'}
      width="460px"
    >
      <div className="space-y-4">

        {/* Azioni */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(work)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(work.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
          </Button>
        </div>

        {/* Badge stato */}
        <div className="flex gap-2 flex-wrap">
          {isIntermedia && (
            <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
              Intermedia liv. {work.livello}
            </Badge>
          )}
          {isTracciata ? (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
              Tracciata · valida {work.validita_mesi} mesi
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Al momento — non tracciata
            </Badge>
          )}
          {statoBadge && (
            <Badge variant="outline" className={statoBadge.className}>
              {statoBadge.label}
            </Badge>
          )}
        </div>

        {/* Sezione Preparazione (solo work tracciate) */}
        {isTracciata && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <FlaskConical className="h-3.5 w-3.5" /> Preparazione in laboratorio
            </div>

            {work.ultima_preparazione ? (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Ultima: {formatDate(work.ultima_preparazione.data_prep)}
                  </span>
                  {statoBadge && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statoBadge.className}`}>
                      {statoBadge.label}
                    </Badge>
                  )}
                </div>
                {work.validita_mesi && (
                  <div className="text-xs text-muted-foreground">
                    Scade il: {formatDate(scadenzaDate(work.ultima_preparazione.data_prep, work.validita_mesi))}
                  </div>
                )}
                {work.ultima_preparazione.note && (
                  <div className="text-xs text-muted-foreground italic">{work.ultima_preparazione.note}</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna preparazione registrata.</p>
            )}

            {/* Form registrazione */}
            {prepForm ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Nuova preparazione</div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12 shrink-0">Data</label>
                  <input
                    type="date"
                    value={prepData}
                    onChange={e => setPrepData(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs text-muted-foreground w-12 shrink-0 pt-1.5">Note</label>
                  <Textarea
                    value={prepNote}
                    onChange={e => setPrepNote(e.target.value)}
                    placeholder="Opzionale..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handlePrepara} disabled={saving || !prepData}>
                    {saving ? 'Salvo...' : 'Registra'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPrepForm(false)}>Annulla</Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setPrepData(new Date().toISOString().slice(0, 10)); setPrepForm(true) }}
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1" />
                {work.ultima_preparazione ? 'Rinnova preparazione' : 'Registra preparazione'}
              </Button>
            )}

            {/* Storico */}
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={async () => {
                if (storicoOpen) { setStoricoOpen(false) } else { await loadStorico() }
              }}
            >
              {storicoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Storico preparazioni
            </button>
            {storicoOpen && storico.length > 0 && (
              <div className="space-y-1">
                {storico.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground border-b pb-1 last:border-0">
                    <span>{formatDate(p.data_prep)}</span>
                    {p.note && <span className="italic truncate max-w-[200px]">{p.note}</span>}
                  </div>
                ))}
              </div>
            )}
            {storicoOpen && storico.length === 0 && (
              <p className="text-xs text-muted-foreground">Nessuna preparazione nello storico.</p>
            )}
          </>
        )}

        <Separator />

        {/* Dettagli */}
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dettagli</div>

        {work.conc_variabile ? (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Concentrazione</span>
            <span className="italic text-muted-foreground">variabile</span>
          </div>
        ) : (
          <Field
            label="Concentrazione"
            value={work.concentrazione != null ? `${work.concentrazione} ${work.unita_conc ?? 'mg/L'}` : null}
          />
        )}
        <Field label="Volume finale" value={work.volume_ml != null ? `${work.volume_ml} mL` : null} />
        <Field label="Solvente" value={work.solvente} />
        <Field label="Validità" value={isTracciata ? `${work.validita_mesi} mesi` : 'Al momento'} />
        <Field label="Operatore" value={work.operatore} />
        {work.note && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note</div>
            <p className="text-sm whitespace-pre-wrap">{work.note}</p>
          </>
        )}

        {/* Ingredienti / Sorgenti */}
        {work.ingredienti && work.ingredienti.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sorgenti ({work.ingredienti.length})
            </div>
            <div className="space-y-2">
              {work.ingredienti.map((ing: any, i: number) => (
                <div key={i} className="rounded-md border p-2 text-xs">
                  <div className="font-medium">
                    {ing.source_type === 'crm' ? '🧪 CRM' : '⚗️ Work'} — {ing.source_nome ?? `ID ${ing.source_id}`}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {ing.volume_prelievo_ml != null && `Prelievo: ${ing.volume_prelievo_ml} mL`}
                    {ing.conc_target_mgL != null && ` · Target: ${ing.conc_target_mgL} mg/L`}
                    {ing.fattore_diluizione != null && ` · Diluizione: ÷${ing.fattore_diluizione}`}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Metodi associati */}
        {work.metodi && work.metodi.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Metodi associati ({work.metodi.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {work.metodi.map((m: any) => (
                <Badge key={m.id} variant="outline" className="text-xs">
                  {m.nome}
                </Badge>
              ))}
            </div>
          </>
        )}

      </div>
    </SlidePanel>
  )
}
