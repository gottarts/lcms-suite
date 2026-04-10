import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dashboardApi } from '@/lib/api'
import {
  buildScadenzeItems,
  bucketOf,
  BUCKET_LABELS,
  type ScadenzaItem,
  type BucketKey,
} from '../lib/scadenzeModel'

const bucketOrder: BucketKey[] = ['scadute', 'urgenti', 'prossime', 'future']

const bucketTone: Record<BucketKey, string> = {
  scadute:  'bg-red-50 border-red-300 text-red-800',
  urgenti:  'bg-amber-50 border-amber-300 text-amber-800',
  prossime: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  future:   'bg-blue-50 border-blue-200 text-blue-800',
}

const kindLabel: Record<ScadenzaItem['kind'], string> = {
  composto: 'CRM',
  preparazione: 'Prep',
  work: 'Work',
}

const kindBadgeTone: Record<ScadenzaItem['kind'], string> = {
  composto:      'bg-purple-100 text-purple-800 border-purple-200',
  preparazione:  'bg-cyan-100 text-cyan-800 border-cyan-200',
  work:          'bg-teal-100 text-teal-800 border-teal-200',
}

function formatScadenza(giorni: number): string {
  if (giorni < 0) return `Scaduto ${-giorni}g fa`
  if (giorni === 0) return 'Scade oggi'
  if (giorni === 1) return 'Scade domani'
  return `Scade in ${giorni}g`
}

function ItemRow({ item, onClick }: { item: ScadenzaItem; onClick?: () => void }) {
  let titolo = ''
  let sottotitolo = ''
  switch (item.kind) {
    case 'composto':
      titolo = item.nome
      sottotitolo = item.lotto ? `Lotto ${item.lotto}` : '(senza lotto)'
      break
    case 'preparazione':
      titolo = item.composto_nome
      sottotitolo = item.flacone ? `Flacone ${item.flacone}` : 'Preparazione'
      break
    case 'work':
      titolo = item.nome
      sottotitolo = [
        item.bloccata ? '⛔ bloccata' : null,
        item.ha_crm_scaduti ? '⚠ CRM scaduti' : null,
      ].filter(Boolean).join(' · ') || item.stato_lab
      break
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-muted/50 transition-colors"
    >
      <Badge variant="outline" className={kindBadgeTone[item.kind]}>
        {kindLabel[item.kind]}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{titolo}</div>
        <div className="text-xs text-muted-foreground truncate">{sottotitolo}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium">{formatScadenza(item.giorni)}</div>
        <div className="text-[10px] text-muted-foreground">{item.scadenza}</div>
      </div>
    </button>
  )
}

export function ScadenzeTimeline() {
  const nav = useNavigate()
  const [items, setItems] = useState<ScadenzaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dashboardApi.summary()
      .then(s => {
        setItems(buildScadenzeItems(s))
        setLoading(false)
      })
      .catch(err => {
        setError(String(err?.message ?? err))
        setLoading(false)
      })
  }, [])

  const byBucket = useMemo(() => {
    const map: Record<BucketKey, ScadenzaItem[]> = { scadute: [], urgenti: [], prossime: [], future: [] }
    for (const it of items) map[bucketOf(it.giorni)].push(it)
    return map
  }, [items])

  const handleClick = (item: ScadenzaItem) => {
    switch (item.kind) {
      case 'composto':
      case 'preparazione':
        nav('/composti')
        break
      case 'work':
        nav('/work')
        break
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scadenze prossimi 60 giorni</CardTitle>
        <CardDescription>
          Timeline unificata di CRM, preparazioni e Work registrate
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
        {error && <p className="text-sm text-red-600">Errore: {error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna scadenza imminente.</p>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {bucketOrder.map(key => {
              const bItems = byBucket[key]
              if (bItems.length === 0) return null
              return (
                <div key={key}>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold mb-1.5 ${bucketTone[key]}`}>
                    {BUCKET_LABELS[key]} · {bItems.length}
                  </div>
                  <div className="divide-y divide-border border rounded-md">
                    {bItems.map((it, i) => (
                      <ItemRow key={`${it.kind}-${it.id}-${i}`} item={it} onClick={() => handleClick(it)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
