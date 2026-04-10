import { KpiCards } from './sections/KpiCards'
import { ScadenzeTimeline } from './sections/ScadenzeTimeline'
import { TracciabilitaCard } from './sections/TracciabilitaCard'
import { AuditCrmSection } from './sections/AuditCrmSection'

export function DashboardPage() {
  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground capitalize">{oggi}</p>
        </div>
      </div>

      {/* Riga 1 — KPI */}
      <KpiCards />

      {/* Riga 2 — Tracciabilità */}
      <TracciabilitaCard />

      {/* Riga 3 — Audit CRM */}
      <AuditCrmSection />

      {/* Riga 4 — Scadenze separate per tipo */}
      <ScadenzeTimeline />
    </div>
  )
}
