import { useState, useEffect } from 'react'
import { queryApi, metodiApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface QueryTabProps {
  strumentoId: string
}

export function QueryTab({ strumentoId }: QueryTabProps) {
  const [metodi, setMetodi] = useState<any[]>([])
  const [metodoId, setMetodoId] = useState<string>('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    metodiApi.list().then(all => {
      setMetodi(all.filter((m: any) => m.strumento_id === strumentoId))
    })
  }, [strumentoId])

  const handleQuery = async () => {
    setLoading(true)
    const res = await queryApi.snapshot({
      strumento_id: strumentoId,
      metodo_id: metodoId || undefined,
      data,
    })
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label className="text-xs">Metodo</Label>
          <Select value={metodoId} onValueChange={setMetodoId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Tutti i metodi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tutti i metodi</SelectItem>
              {metodi.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleQuery} disabled={loading}>
          <Search className="h-4 w-4 mr-1" /> Interroga
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div>
            <h3 className="font-heading font-semibold text-sm mb-2">Eluenti attivi ({result.eluenti?.length || 0})</h3>
            {result.eluenti?.length ? result.eluenti.map((e: any) => (
              <div key={e.id} className="p-2 border rounded-md mb-2 text-sm">
                <div className="font-medium">{e.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(e.data_inizio)} — {formatDate(e.data_fine) || 'presente'}
                </div>
                {e.componenti?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {e.componenti.map((c: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {c.sostanza} — Lotto: {c.lotto || '—'} ({c.fornitore || '—'})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )) : <p className="text-xs text-muted-foreground">Nessun eluente attivo</p>}
          </div>

          {metodoId && (
            <>
              <Separator />
              <div>
                <h3 className="font-heading font-semibold text-sm mb-2">Consumabili attivi ({result.consumabili?.length || 0})</h3>
                {result.consumabili?.length ? result.consumabili.map((c: any) => (
                  <div key={c.id} className="p-2 border rounded-md mb-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{c.tipo}</Badge>
                      <span className="font-medium">{c.nome}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Lotto: {c.lotto || '—'} | Fornitore: {c.fornitore || '—'} | Apertura: {formatDate(c.data_apertura)}
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nessun consumabile attivo</p>}
              </div>

              <Separator />
              <div>
                <h3 className="font-heading font-semibold text-sm mb-2">Composti associati ({result.composti?.length || 0})</h3>
                {result.composti?.length ? result.composti.map((c: any, i: number) => (
                  <div key={i} className="p-2 border rounded-md mb-2 text-sm">
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      Lotto: {c.lotto || '—'} | Produttore: {c.produttore || '—'}
                      {c.prep_conc && ` | Prep: ${c.prep_conc} (${formatDate(c.data_prep)} - ${formatDate(c.prep_scadenza)})`}
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nessun composto associato</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
