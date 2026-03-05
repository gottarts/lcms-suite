import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface MetodoCardProps {
  metodo: {
    id: string
    nome: string
    strumento_codice?: string
    matrice?: string | null
    colonna?: string | null
    gradiente?: string | null
    flusso?: string | null
  }
  onClick: () => void
}

export function MetodoCard({ metodo, onClick }: MetodoCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-heading">{metodo.nome}</CardTitle>
          {metodo.strumento_codice && (
            <Badge variant="secondary" className="text-xs shrink-0">{metodo.strumento_codice}</Badge>
          )}
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
      </CardContent>
    </Card>
  )
}
