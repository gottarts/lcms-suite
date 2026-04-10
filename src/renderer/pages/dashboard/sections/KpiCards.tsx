import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { compostiApi } from '@/lib/api'
import { computeStato } from '@/components/shared/StatusBadge'
import type { CompostoStato } from '@/components/shared/StatusBadge'

type KpiBucket = {
  label: string
  value: number
  tone: 'red' | 'amber' | 'green' | 'gray' | 'blue'
  onClick?: () => void
}

const toneClass: Record<KpiBucket['tone'], string> = {
  red:   'border-red-300 bg-red-50 text-red-800',
  amber: 'border-amber-300 bg-amber-50 text-amber-800',
  green: 'border-green-300 bg-green-50 text-green-800',
  gray:  'border-gray-300 bg-gray-50 text-gray-700',
  blue:  'border-blue-300 bg-blue-50 text-blue-800',
}

// Stati "scaduti" (sia originali che rivalidazione scaduta)
const scadutiStates: CompostoStato[] = ['scaduto', 'rivalidato_scaduto']
const inScadenzaStates: CompostoStato[] = ['in_scadenza', 'rivalidato_in_scadenza']
const attiviStates: CompostoStato[] = ['attivo', 'rivalidato_attivo']

export function KpiCards() {
  const nav = useNavigate()
  const [composti, setComposti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    compostiApi.list().then(rows => {
      setComposti(rows ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const counts = { scaduti: 0, in_scadenza: 0, attivi: 0, dismessi: 0, da_aprire: 0 }
    for (const c of composti) {
      const s = computeStato(c)
      if (scadutiStates.includes(s)) counts.scaduti++
      else if (inScadenzaStates.includes(s)) counts.in_scadenza++
      else if (attiviStates.includes(s)) counts.attivi++
      else if (s === 'dismesso') counts.dismessi++
      else if (s === 'da_aprire') counts.da_aprire++
    }
    return counts
  }, [composti])

  const buckets: KpiBucket[] = [
    { label: 'CRM scaduti',       value: stats.scaduti,     tone: 'red',   onClick: () => nav('/composti') },
    { label: 'CRM in scadenza',   value: stats.in_scadenza, tone: 'amber', onClick: () => nav('/composti') },
    { label: 'CRM attivi',        value: stats.attivi,      tone: 'green', onClick: () => nav('/composti') },
    { label: 'CRM da aprire',     value: stats.da_aprire,   tone: 'blue',  onClick: () => nav('/composti') },
    { label: 'CRM dismessi',      value: stats.dismessi,    tone: 'gray',  onClick: () => nav('/composti') },
  ]

  if (loading) {
    return <div className="text-sm text-muted-foreground">Caricamento KPI…</div>
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {buckets.map(b => (
        <Card
          key={b.label}
          className={`cursor-pointer transition-shadow hover:shadow-md ${toneClass[b.tone]}`}
          onClick={b.onClick}
        >
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide opacity-75">{b.label}</span>
            <span className="text-3xl font-heading font-bold">{b.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
