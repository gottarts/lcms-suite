import { useState, useEffect } from 'react'
import { metodiApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface MetodiReadonlyTabProps {
  strumentoId: string
}

export function MetodiReadonlyTab({ strumentoId }: MetodiReadonlyTabProps) {
  const [metodi, setMetodi] = useState<any[]>([])

  useEffect(() => {
    metodiApi.list().then(all => {
      setMetodi(all.filter((m: any) => m.strumento_id === strumentoId))
    })
  }, [strumentoId])

  if (metodi.length === 0) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Nessun metodo associato a questo strumento</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
      {metodi.map(m => (
        <Card key={m.id} className="text-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">{m.nome}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {m.matrice && <div><span className="text-muted-foreground">Matrice:</span> {m.matrice}</div>}
            {m.colonna && <div><span className="text-muted-foreground">Colonna:</span> {m.colonna}</div>}
            {m.gradiente && <div><span className="text-muted-foreground">Gradiente:</span> {m.gradiente}</div>}
            {m.flusso && <div><span className="text-muted-foreground">Flusso:</span> {m.flusso}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
