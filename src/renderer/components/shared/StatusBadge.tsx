import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type CompostoStato = 'attivo' | 'in_scadenza' | 'scaduto' | 'rivalidato' | 'dismesso'

const statusConfig: Record<CompostoStato, { label: string; className: string }> = {
  attivo: { label: 'Attivo', className: 'bg-green-100 text-green-800 border-green-200' },
  in_scadenza: { label: 'In scadenza', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  scaduto: { label: 'Scaduto', className: 'bg-red-100 text-red-800 border-red-200' },
  rivalidato: { label: 'Rivalidato', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  dismesso: { label: 'Dismesso', className: 'bg-gray-100 text-gray-600 border-gray-200' },
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
  data_apertura?: string | null
}): CompostoStato {
  if (composto.data_dismissione) return 'dismesso'
  if (!composto.scadenza_prodotto) return 'attivo'

  const now = new Date()
  const scadenza = new Date(composto.scadenza_prodotto)
  if (scadenza < now) return 'scaduto'

  // In scadenza: within 30 days
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  if (scadenza.getTime() - now.getTime() < thirtyDays) return 'in_scadenza'

  return 'attivo'
}
