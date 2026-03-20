import { useState, useEffect } from 'react'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2 } from 'lucide-react'
import { workApi } from '@/lib/api'

interface WorkDrawerProps {
  workId: number | null
  onClose: () => void
  onEdit: (work: any) => void
  onDelete: (id: number) => void
}

export function WorkDrawer({ workId, onClose, onEdit, onDelete }: WorkDrawerProps) {
  const [work, setWork] = useState<any>(null)

  useEffect(() => {
    if (workId) {
      workApi.get(workId).then(setWork)
    } else {
      setWork(null)
    }
  }, [workId])

  if (!work) return null

  const isTracciata = !!work.validita_mesi
  const isIntermedia = (work.livello ?? 0) > 0

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
        </div>

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
