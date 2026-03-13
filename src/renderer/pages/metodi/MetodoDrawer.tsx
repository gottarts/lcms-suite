import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
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
  const navigate = useNavigate()

  useEffect(() => {
    if (metodoId) {
      metodiApi.get(metodoId).then(m => {
        setMetodo(m)
        if (m?.composti_ids?.length) {
          compostiApi.list({ metodo_id: metodoId }).then(rows => {
            // deduplicazione per id (sicurezza)
            const seen = new Set<number>()
            const unique = rows.filter((c: any) => {
              if (seen.has(c.id)) return false
              seen.add(c.id)
              return true
            })
            setComposti(unique)
          })
        } else {
          setComposti([])
        }
      })
    }
  }, [metodoId])

  // Raggruppa per nome: array di [nome, count] ordinato alfabeticamente
  const compostiPerNome = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of composti) {
      const nome = c.nome ?? '—'
      map.set(nome, (map.get(nome) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [composti])

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

  // Naviga a /composti filtrando per nome sostanza
  const handleBadgeClick = (nome: string) => {
    onClose()
    navigate('/composti', { state: { searchFilter: nome } })
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

        {compostiPerNome.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Composti associati ({compostiPerNome.length} sostanze, {composti.length} lotti)
            </div>
            <div className="flex flex-wrap gap-1">
              {compostiPerNome.map(([nome, count]) => (
                <Badge
                  key={nome}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1"
                  onClick={() => handleBadgeClick(nome)}
                  title="Vai ai composti filtrati per questo nome"
                >
                  {nome}
                  {count > 1 && (
                    <span className="ml-1 bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[10px] font-medium">
                      {count}
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </SlidePanel>
  )
}