import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type CompostoStato =
  | 'attivo'
  | 'in_scadenza'
  | 'scaduto'
  | 'rivalidato_attivo'
  | 'rivalidato_in_scadenza'
  | 'rivalidato_scaduto'
  | 'dismesso'

const statusConfig: Record<CompostoStato, { label: string; className: string }> = {
  attivo:                  { label: 'Attivo',                   className: 'bg-green-100 text-green-800 border-green-200' },
  in_scadenza:             { label: 'In scadenza',              className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  scaduto:                 { label: 'Scaduto',                  className: 'bg-red-100 text-red-800 border-red-200' },
  rivalidato_attivo:       { label: 'Rivalidato — Attivo',      className: 'bg-green-100 text-green-800 border-green-200' },
  rivalidato_in_scadenza:  { label: 'Rivalidato — In scadenza', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  rivalidato_scaduto:      { label: 'Rivalidato — Scaduto',     className: 'bg-red-100 text-red-800 border-red-200' },
  dismesso:                { label: 'Dismesso',                  className: 'bg-gray-100 text-gray-600 border-gray-200' },
}

interface StatusBadgeProps {
  status: CompostoStato
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.attivo
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

export function computeStato(composto: {
  data_dismissione?: string | null
  scadenza_prodotto?: string | null
  ultima_rivalidazione?: string | null  // MAX(nuova_scadenza) dall'IPC
}): CompostoStato {
  if (composto.data_dismissione) return 'dismesso'

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thirtyDays = 30 * 24 * 60 * 60 * 1000

  // Scadenza originale non presente → attivo
  if (!composto.scadenza_prodotto) return 'attivo'

  const scadenzaOriginale = new Date(composto.scadenza_prodotto)
  scadenzaOriginale.setHours(0, 0, 0, 0)

  // Scadenza originale NON ancora superata → stati normali
  if (scadenzaOriginale >= now) {
    if (scadenzaOriginale.getTime() - now.getTime() < thirtyDays) return 'in_scadenza'
    return 'attivo'
  }

  // Scadenza originale SUPERATA — cerco estensione da rivalidazione
  // ultima_rivalidazione = MAX(nuova_scadenza) tra tutte le rivalidazioni con nuova_scadenza
  if (!composto.ultima_rivalidazione) return 'scaduto'  // nessuna estensione → scaduto normale

  const scadenzaEstesa = new Date(composto.ultima_rivalidazione)
  scadenzaEstesa.setHours(0, 0, 0, 0)

  if (scadenzaEstesa < now) return 'rivalidato_scaduto'
  if (scadenzaEstesa.getTime() - now.getTime() < thirtyDays) return 'rivalidato_in_scadenza'
  return 'rivalidato_attivo'
}