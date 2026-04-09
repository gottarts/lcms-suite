import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface MetodoCardProps {
  metodo: {
    id: string
    nome: string
    strumento_codice?: string
    matrice?: string | null
    colonna?: string | null
    gradiente?: string | null
    flusso?: string | null
    classe_metodo?: string | null
    nome_esteso?: string | null
  }
  onClick: () => void
  onEdit?: () => void
  onGoSchema?: () => void
  onGoParametri?: () => void
}

export function MetodoCard({ metodo, onClick, onEdit, onGoSchema, onGoParametri }: MetodoCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-heading break-words">{metodo.nome}</CardTitle>
            {metodo.nome_esteso && (
              <p className="text-xs text-muted-foreground break-words mt-0.5">{metodo.nome_esteso}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {metodo.strumento_codice && (
              <Badge variant="secondary" className="text-xs">{metodo.strumento_codice}</Badge>
            )}
            {metodo.classe_metodo && (
              <Badge variant="outline" className="text-xs">{metodo.classe_metodo}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {metodo.matrice && (
            <div><span className="text-muted-foreground">Matrice:</span> {metodo.matrice}</div>
          )}
          {metodo.colonna && (
            <div><span className="text-muted-foreground">Colonna:</span> {metodo.colonna}</div>
          )}
          {metodo.gradiente && (
            <div><span className="text-muted-foreground">Gradiente:</span> {metodo.gradiente}</div>
          )}
          {metodo.flusso && (
            <div><span className="text-muted-foreground">Flusso:</span> {metodo.flusso}</div>
          )}
        </div>

        {(onEdit || onGoParametri || onGoSchema) && (
          <div className="flex gap-1 mt-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
            {onEdit && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 flex-1" onClick={onEdit}>
                Modifica
              </Button>
            )}
            {onGoParametri && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 flex-1 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={onGoParametri}>
                Parametri ↗
              </Button>
            )}
            {onGoSchema && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 flex-1" onClick={onGoSchema}>
                Schema ↗
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
