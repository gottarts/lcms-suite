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

      {/* Riga 1 — KPI (sinistra) + Scadenze 60gg (destra) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <KpiCards />
        <ScadenzeTimeline />
      </div>

      {/* Riga 2 — Tracciabilità */}
      <TracciabilitaCard />

      {/* Riga 3 — Audit CRM */}
      <AuditCrmSection />
    </div>
  )
}
