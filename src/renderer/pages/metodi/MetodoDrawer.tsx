import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2, ExternalLink, ChevronDown, ChevronUp, History } from 'lucide-react'
import { metodiApi, metodoAnalitiApi } from '@/lib/api'
interface MetodoDrawerProps {
  metodoId: string | null
  onClose: () => void
  onEdit: (metodo: any) => void
  onDelete: (id: string) => void
  onOpenSchema: (id: string) => void
  onOpenParametri: (id: string) => void
}

export function MetodoDrawer({ metodoId, onClose, onEdit, onDelete, onOpenSchema, onOpenParametri }: MetodoDrawerProps) {
  const [metodo, setMetodo] = useState<any>(null)
  const [analiti, setAnaliti] = useState<{ id: number; nome: string }[]>([])
  const [showVersioni, setShowVersioni] = useState(false)
  const [versioni, setVersioni] = useState<Array<{ id: number; snapshot: string; motivo: string | null; created_at: string }>>([])
  const [expandedVersione, setExpandedVersione] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (metodoId) {
      metodiApi.get(metodoId).then(setMetodo)
      metodoAnalitiApi.list(metodoId).then(rows =>
        setAnaliti(rows.sort((a, b) => a.nome.localeCompare(b.nome)))
      )
      setShowVersioni(false)
      setVersioni([])
      setExpandedVersione(null)
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

  // Naviga a /composti filtrando per nome sostanza
  const handleBadgeClick = (nome: string) => {
    onClose()
    navigate('/composti', { state: { searchFilter: nome } })
  }

  return (
    <>
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
          <Button size="sm" variant="outline" onClick={() => { onClose(); onOpenSchema(String(metodo.id)) }}>
            Schema calibrazione
          </Button>
          <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => { onClose(); onOpenParametri(String(metodo.id)) }}>
            Parametri
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

        {analiti.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Analiti del metodo ({analiti.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {analiti.map(a => (
                <Badge
                  key={a.id}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1"
                  onClick={() => handleBadgeClick(a.nome)}
                  title="Vai ai composti filtrati per questo nome"
                >
                  {a.nome}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Badge>
              ))}
            </div>

            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              onClick={async () => {
                if (!showVersioni && versioni.length === 0 && metodoId) {
                  const v = await metodoAnalitiApi.versioni(metodoId)
                  setVersioni(v)
                }
                setShowVersioni(!showVersioni)
              }}
            >
              {showVersioni ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <History className="h-3.5 w-3.5" />
              Versioni precedenti
            </button>

            {showVersioni && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {versioni.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nessuna versione registrata</p>
                )}
                {versioni.map(v => {
                  const snap = JSON.parse(v.snapshot) as Array<{ nome: string; accreditato: number }>
                  const nAccr = snap.filter(a => a.accreditato === 1).length
                  const isExpanded = expandedVersione === v.id
                  return (
                    <div key={v.id} className="border rounded p-2 text-xs">
                      <button
                        className="w-full flex items-center justify-between hover:text-foreground transition-colors"
                        onClick={() => setExpandedVersione(isExpanded ? null : v.id)}
                      >
                        <span>
                          {v.created_at.replace('T', ' ').slice(0, 16)}
                          {v.motivo && <span className="ml-1.5 text-muted-foreground">({v.motivo})</span>}
                        </span>
                        <span className="text-muted-foreground">
                          {snap.length} analiti, {nAccr} accr.
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t">
                          {snap.map((a, i) => (
                            <Badge key={i} variant={a.accreditato === 1 ? 'default' : 'outline'} className="text-[10px]">
                              {a.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </SlidePanel>
    </>
  )
}