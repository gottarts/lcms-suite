import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dashboardApi } from '@/lib/api'

type Stats = {
  work_con_lotto_mismatch: number
  analiti_accreditati_scoperti: number
}

type WorkItem = {
  id: number
  nome: string
  bloccata: boolean
  ha_crm_scaduti: boolean
}

export function TracciabilitaCard() {
  const nav = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [workIssues, setWorkIssues] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.summary()
      .then(s => {
        setStats(s.stats_tracciabilita)
        setWorkIssues(
          (s.work ?? [])
            .filter((w: any) => w.bloccata || w.ha_crm_scaduti)
            .map((w: any) => ({ id: w.id, nome: w.nome, bloccata: !!w.bloccata, ha_crm_scaduti: !!w.ha_crm_scaduti })),
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stato tracciabilità</CardTitle>
        <CardDescription>
          Work con CRM dismessi/scaduti, lotti disallineati, analiti accreditati senza CRM
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
        {!loading && stats && (
          <div className="space-y-4">
            {/* KPI tracciabilità */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => nav('/work')}
                className="text-left border rounded-md p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Work bloccate</div>
                <div className="text-2xl font-heading font-bold">
                  {workIssues.filter(w => w.bloccata).length}
                </div>
                <div className="text-[11px] text-muted-foreground">CRM ingrediente dismesso</div>
              </button>
              <button
                type="button"
                onClick={() => nav('/work')}
                className="text-left border rounded-md p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Work con CRM scaduti</div>
                <div className="text-2xl font-heading font-bold">
                  {workIssues.filter(w => w.ha_crm_scaduti).length}
                </div>
                <div className="text-[11px] text-muted-foreground">Scadenza effettiva superata</div>
              </button>
              <div className="border rounded-md p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Analiti accreditati scoperti</div>
                <div className="text-2xl font-heading font-bold">
                  {stats.analiti_accreditati_scoperti}
                </div>
                <div className="text-[11px] text-muted-foreground">Nessun CRM attivo con nome corrispondente</div>
              </div>
            </div>

            {/* Lotto mismatch */}
            {stats.work_con_lotto_mismatch > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                ⚠ {stats.work_con_lotto_mismatch} work con lotto snapshot diverso dal lotto corrente del CRM
              </div>
            )}

            {/* Lista compatta work con issue */}
            {workIssues.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1.5">Work con problemi</div>
                <div className="flex flex-wrap gap-1.5">
                  {workIssues.map(w => (
                    <Badge
                      key={w.id}
                      variant="outline"
                      className={
                        w.bloccata
                          ? 'bg-red-50 text-red-800 border-red-300 cursor-pointer'
                          : 'bg-amber-50 text-amber-800 border-amber-300 cursor-pointer'
                      }
                      onClick={() => nav('/work')}
                    >
                      {w.bloccata ? '⛔' : '⚠'} {w.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
