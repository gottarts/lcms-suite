import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dashboardApi } from '@/lib/api'
import { useDbChange } from '@/lib/useDbChange'

type AnalitaScoperto = {
  analita_nome: string
  metodo_id: string
  metodo_nome: string
  composto_dismesso_id: number | null
  composto_scaduto_id: number | null
}

type AnalitaNonCoperto17034 = {
  analita_nome: string
  metodo_id: string
  metodo_nome: string
}

type Stats = {
  work_con_lotto_mismatch: number
  work_da_preparare: number
  analiti_scoperti: AnalitaScoperto[]
  analiti_non_coperti_17034: AnalitaNonCoperto17034[]
}

type WorkItem = {
  id: number
  nome: string
  bloccata: boolean
  ha_crm_scaduti: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Sezione collassabile generica
// ─────────────────────────────────────────────────────────────────────────────
function Sezione({
  title,
  count,
  accentClass,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  accentClass: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="outline" className={`text-xs ${accentClass}`}>{count}</Badge>
        </div>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista analiti con raggruppamento per metodo
// ─────────────────────────────────────────────────────────────────────────────
function AnalitiList({
  items,
  onClickAnalita,
}: {
  items: (AnalitaScoperto | AnalitaNonCoperto17034)[]
  onClickAnalita: (nome: string) => void
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic px-1">Nessun analita.</p>
  }

  // Raggruppa per metodo_nome
  const byMetodo: Record<string, typeof items> = {}
  for (const item of items) {
    if (!byMetodo[item.metodo_nome]) byMetodo[item.metodo_nome] = []
    byMetodo[item.metodo_nome].push(item)
  }

  return (
    <div className="space-y-2">
      {Object.entries(byMetodo).map(([metodo, analiti]) => (
        <div key={metodo}>
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{metodo}</div>
          <div className="divide-y divide-border border rounded-md">
            {analiti.map((item, i) => {
              const hasLink = 'composto_dismesso_id' in item
                ? (item.composto_dismesso_id !== null || item.composto_scaduto_id !== null)
                : true
              return (
                <button
                  key={`${item.metodo_id}-${item.analita_nome}-${i}`}
                  type="button"
                  disabled={!hasLink}
                  onClick={() => onClickAnalita(item.analita_nome)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${hasLink ? 'hover:bg-muted/50 transition-colors cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="flex-1 truncate">{item.analita_nome}</span>
                  {'composto_dismesso_id' in item && item.composto_dismesso_id !== null && (
                    <span className="text-[10px] text-red-600 shrink-0">Dismesso</span>
                  )}
                  {'composto_scaduto_id' in item && item.composto_scaduto_id !== null && !('composto_dismesso_id' in item && item.composto_dismesso_id !== null) && (
                    <span className="text-[10px] text-amber-600 shrink-0">Scaduto</span>
                  )}
                  {hasLink && <span className="text-[10px] text-blue-500 shrink-0">→ DB</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────────────────────────────────────
export function TracciabilitaCard() {
  const nav = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [workIssues, setWorkIssues] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openScoperti, setOpenScoperti] = useState(false)
  const [open17034, setOpen17034] = useState(false)

  const load = useCallback(() => {
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

  useEffect(() => { load() }, [load])
  useDbChange(load)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stato tracciabilità</CardTitle>
        <CardDescription>
          Work con CRM dismessi/scaduti, lotti disallineati, work da preparare, analiti accreditati scoperti
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
        {!loading && stats && (
          <div className="space-y-4">
            {/* Lotto mismatch — full width */}
            {stats.work_con_lotto_mismatch > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                ⚠ {stats.work_con_lotto_mismatch} work con lotto snapshot diverso dal lotto corrente del CRM
              </div>
            )}

            {/* Layout 2 colonne */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

              {/* ── Colonna sinistra: KPI + lista work con problemi ── */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
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
                  <button
                    type="button"
                    onClick={() => nav('/work', { state: { filtroStatoLab: 'da_preparare' } })}
                    className="text-left border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Work da preparare</div>
                    <div className="text-2xl font-heading font-bold">
                      {stats.work_da_preparare}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Senza prep attiva o scaduta/in scadenza</div>
                  </button>
                </div>

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

              {/* ── Colonna destra: Analiti scoperti + non coperti 17034 ── */}
              <div className="space-y-3">
                <Sezione
                  title="Analiti accreditati scoperti"
                  count={stats.analiti_scoperti.length}
                  accentClass="bg-red-100 text-red-800 border-red-200"
                  open={openScoperti}
                  onToggle={() => setOpenScoperti(o => !o)}
                >
                  <AnalitiList
                    items={stats.analiti_scoperti}
                    onClickAnalita={(nome) => nav('/composti', { state: { searchFilter: nome } })}
                  />
                </Sezione>

                <Sezione
                  title="Accreditati senza CRM 17034"
                  count={stats.analiti_non_coperti_17034.length}
                  accentClass="bg-amber-100 text-amber-800 border-amber-200"
                  open={open17034}
                  onToggle={() => setOpen17034(o => !o)}
                >
                  <AnalitiList
                    items={stats.analiti_non_coperti_17034}
                    onClickAnalita={(nome) => nav('/composti', { state: { searchFilter: nome } })}
                  />
                </Sezione>
              </div>

            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
