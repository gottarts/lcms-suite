import { AlertTriangle, Clock, PackageCheck } from 'lucide-react'

interface Stats {
  attivi: number
  inScadenza: number
  attenzione: number
}

interface CompostiStatsProps {
  stats: Stats
  onClickInScadenza: () => void
  onClickAttenzione: () => void
}

export function CompostiStats({ stats, onClickInScadenza, onClickAttenzione }: CompostiStatsProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Attivi */}
      <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
        <PackageCheck className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Attivi</span>
        <span className="font-semibold text-foreground">{stats.attivi}</span>
      </div>

      {/* In scadenza */}
      <button
        onClick={onClickInScadenza}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-opacity hover:opacity-75 cursor-pointer
          ${stats.inScadenza > 0
            ? 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700'
            : 'bg-card'
          }`}
      >
        <Clock className={`w-3.5 h-3.5 ${stats.inScadenza > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
        <span className={stats.inScadenza > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>In scadenza</span>
        <span className={`font-semibold ${stats.inScadenza > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>{stats.inScadenza}</span>
      </button>

      {/* Attenzione */}
      <button
        onClick={onClickAttenzione}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-opacity hover:opacity-75 cursor-pointer
          ${stats.attenzione > 0
            ? 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700'
            : 'bg-card'
          }`}
      >
        <AlertTriangle className={`w-3.5 h-3.5 ${stats.attenzione > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
        <span className={stats.attenzione > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>Scaduti</span>
        <span className={`font-semibold ${stats.attenzione > 0 ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>{stats.attenzione}</span>
      </button>
    </div>
  )
}