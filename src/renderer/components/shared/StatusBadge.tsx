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
  | 'da_aprire'

const statusConfig: Record<CompostoStato, { label: string; className: string }> = {
  attivo:                  { label: 'Attivo',                   className: 'bg-green-100 text-green-800 border-green-200' },
  in_scadenza:             { label: 'In scadenza',              className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  scaduto:                 { label: 'Scaduto',                  className: 'bg-red-100 text-red-800 border-red-200' },
  rivalidato_attivo:       { label: 'Rivalidato — Attivo',      className: 'bg-green-100 text-green-800 border-green-200' },
  rivalidato_in_scadenza:  { label: 'Rivalidato — In scadenza', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  rivalidato_scaduto:      { label: 'Rivalidato — Scaduto',     className: 'bg-red-100 text-red-800 border-red-200' },
  dismesso:                { label: 'Dismesso',                  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  da_aprire:               { label: 'Da aprire',                className: 'bg-blue-50 text-blue-700 border-blue-200' },
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
  data_apertura?: string | null
  scadenza_prodotto?: string | null
  ultima_rivalidazione?: string | null
}): CompostoStato {
  if (composto.data_dismissione) return 'dismesso'

  // Fiala non ancora aperta → Da aprire
  if (!composto.data_apertura) return 'da_aprire'

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
  if (!composto.ultima_rivalidazione) return 'scaduto'

  const scadenzaEstesa = new Date(composto.ultima_rivalidazione)
  scadenzaEstesa.setHours(0, 0, 0, 0)

  if (scadenzaEstesa < now) return 'rivalidato_scaduto'
  if (scadenzaEstesa.getTime() - now.getTime() < thirtyDays) return 'rivalidato_in_scadenza'
  return 'rivalidato_attivo'
}

// ─── Campi incompleti ─────────────────────────────────────────────────────────
// Restituisce la lista dei nomi leggibili dei campi mancanti.
// Lista vuota = composto completo.
export function getCampiMancanti(c: any): string[] {
  const mancanti: string[] = []

  const empty = (v: any) => v === null || v === undefined || String(v).trim() === ''

  if (empty(c.nome))            mancanti.push('Nome')
  if (empty(c.forma))           mancanti.push('Forma')
  if (empty(c.lotto))           mancanti.push('Lotto')
  if (empty(c.produttore))      mancanti.push('Produttore')
  if (empty(c.classe))          mancanti.push('Classe')
  if (empty(c.solvente))        mancanti.push('Solvente')
  if (empty(c.ubicazione))      mancanti.push('Ubicazione')
  if (empty(c.destinazione_uso))mancanti.push('Destinazione uso')
  if (empty(c.data_apertura))   mancanti.push('Data apertura')
  if (empty(c.fiala))           mancanti.push('Fiala')

  // Concentrazione: obbligatoria a meno che forma=Neat E purezza presente
  const isNeat = String(c.forma ?? '').toLowerCase() === 'neat'
  const hasPurezza = !empty(c.purezza)
  const hasConc = !empty(c.concentrazione)
  if (!hasConc) {
    if (!isNeat || !hasPurezza) {
      mancanti.push('Concentrazione')
    }
  }

  // Purezza: obbligatoria solo se forma=Neat E concentrazione assente
  if (isNeat && !hasConc && !hasPurezza) {
    mancanti.push('Purezza')
  }

  return mancanti
}

export function isIncompleto(c: any): boolean {
  return getCampiMancanti(c).length > 0
}