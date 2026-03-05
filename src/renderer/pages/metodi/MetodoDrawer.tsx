import { useState, useEffect } from 'react'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2 } from 'lucide-react'
import { metodiApi, compostiApi } from '@/lib/api'

interface MetodoDrawerProps {
  metodoId: string | null
  onClose: () => void
  onEdit: (metodo: any) => void
  onDelete: (id: string) => void
}

export function MetodoDrawer({ metodoId, onClose, onEdit, onDelete }: MetodoDrawerProps) {
  const [metodo, setMetodo] = useState<any>(null)
  const [composti, setComposti] = useState<any[]>([])

  useEffect(() => {
    if (metodoId) {
      metodiApi.get(metodoId).then(m => {
        setMetodo(m)
        if (m?.composti_ids?.length) {
          compostiApi.list({ metodo_id: metodoId }).then(setComposti)
        } else {
          setComposti([])
        }
      })
    }
  }, [metodoId])

  if (!metodo) return null

  const Field = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null
    return (
      <div className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right">{value}</span>
      </div>
    )
  }

  return (
    <SlidePanel
      open={!!metodoId}
      onClose={onClose}
      title={metodo.nome}
      subtitle={metodo.strumento_codice ? `Strumento: ${metodo.strumento_codice}` : undefined}
      width="480px"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(metodo)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(metodo.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
          </Button>
        </div>

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificazione</div>
        <Field label="Matrice" value={metodo.matrice} />
        <Field label="LIMS ID" value={metodo.lims_id} />
        <Field label="OQLab ID" value={metodo.oqlab_id} />

        <Separator />
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cromatografia LC</div>
        <Field label="Colonna" value={metodo.colonna} />
        <Field label="Fase A" value={metodo.fase_a} />
        <Field label="Fase B" value={metodo.fase_b} />
        <Field label="Gradiente" value={metodo.gradiente} />
        <Field label="Flusso" value={metodo.flusso} />

        <Separator />
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MS</div>
        <Field label="Ionizzazione" value={metodo.ionizzazione} />
        <Field label="Polarità" value={metodo.polarita} />
        <Field label="Acquisizione" value={metodo.acquisizione} />
        <Field label="SRM" value={metodo.srm} />

        {metodo.note && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note</div>
            <p className="text-sm whitespace-pre-wrap">{metodo.note}</p>
          </>
        )}

        {composti.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Composti associati ({composti.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {composti.map((c: any) => (
                <Badge key={c.id} variant="outline" className="text-xs">{c.nome}</Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </SlidePanel>
  )
}
