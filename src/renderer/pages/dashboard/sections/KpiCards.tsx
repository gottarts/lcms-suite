import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { compostiApi, dashboardApi } from '@/lib/api'
import { computeStato } from '@/components/shared/StatusBadge'
import type { CompostoStato } from '@/components/shared/StatusBadge'
import { useDbChange } from '@/lib/useDbChange'
import { bucketOf, giorniTra } from '../lib/scadenzeModel'

type KpiBucket = {
  label: string
  value: number
  tone: 'red' | 'amber' | 'orange' | 'green' | 'gray' | 'blue'
  onClick?: () => void
}

const toneClass: Record<KpiBucket['tone'], string> = {
  red:    'border-red-300 bg-red-50 text-red-800',
  amber:  'border-amber-300 bg-amber-50 text-amber-800',
  orange: 'border-orange-300 bg-orange-50 text-orange-800',
  green:  'border-green-300 bg-green-50 text-green-800',
  gray:   'border-gray-300 bg-gray-50 text-gray-700',
  blue:   'border-blue-300 bg-blue-50 text-blue-800',
}

const scadutiStates: CompostoStato[] = ['scaduto', 'rivalidato_scaduto']
const inScadenzaStates: CompostoStato[] = ['in_scadenza', 'rivalidato_in_scadenza']
const attiviStates: CompostoStato[] = ['attivo', 'rivalidato_attivo']
const rivalidatiStates: CompostoStato[] = ['rivalidato_attivo', 'rivalidato_in_scadenza', 'rivalidato_scaduto']

function KpiCard({ bucket }: { bucket: KpiBucket }) {
  return (
    <Card
      className={`transition-shadow ${bucket.onClick ? 'cursor-pointer hover:shadow-md' : ''} ${toneClass[bucket.tone]}`}
      onClick={bucket.onClick}
    >
      <CardContent className="p-4 flex flex-col gap-1 h-full">
        <span className="text-xs font-medium uppercase tracking-wide opacity-75 leading-tight">{bucket.label}</span>
        <span className="text-3xl font-heading font-bold mt-auto">{bucket.value}</span>
      </CardContent>
    </Card>
  )
}

export function KpiCards() {
  const nav = useNavigate()
  const [composti, setComposti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [prepNeatScadute, setPrepNeatScadute] = useState(0)
  const [prepNeatInScadenza, setPrepNeatInScadenza] = useState(0)
  const [idsNeatScadute, setIdsNeatScadute] = useState<number[]>([])
  const [idsNeatInScadenza, setIdsNeatInScadenza] = useState<number[]>([])

  const load = useCallback(() => {
    compostiApi.list().then(rows => {
      setComposti(rows ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))

    dashboardApi.summary().then(s => {
      let scadute = 0, inScad = 0
      const setScad = new Set<number>()
      const setInScad = new Set<number>()
      for (const p of s.preparazioni ?? []) {
        if (p.composto_forma !== 'Neat' || !p.scadenza) continue
        const giorni = giorniTra(p.scadenza)
        const b = bucketOf(giorni)
        if (b === 'scadute' || giorni === 0) { scadute++; setScad.add(p.composto_id) }
        else if (b === 'urgenti' || b === 'prossime') { inScad++; setInScad.add(p.composto_id) }
      }
      setPrepNeatScadute(scadute)
      setPrepNeatInScadenza(inScad)
      setIdsNeatScadute(Array.from(setScad))
      setIdsNeatInScadenza(Array.from(setInScad))
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  useDbChange(load)

  const stats = useMemo(() => {
    const counts = {
      scaduti: 0, in_scadenza: 0, attivi: 0, dismessi: 0,
      da_aprire: 0, rivalidati: 0, totale: 0,
    }
    for (const c of composti) {
      const s = computeStato(c)
      if (s === 'dismesso') { counts.dismessi++; continue }
      counts.totale++
      if (scadutiStates.includes(s)) counts.scaduti++
      if (inScadenzaStates.includes(s)) counts.in_scadenza++
      if (attiviStates.includes(s)) counts.attivi++
      if (s === 'da_aprire') counts.da_aprire++
      if (rivalidatiStates.includes(s)) counts.rivalidati++
    }
    return counts
  }, [composti])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Caricamento KPI…</div>
  }

  const rigaCrm: KpiBucket[] = [
    { label: 'CRM in scadenza', value: stats.in_scadenza, tone: 'amber', onClick: () => nav('/composti', { state: { filtroStati: ['In scadenza', 'Rivalidato — In scadenza'] } }) },
    { label: 'CRM scaduti',     value: stats.scaduti,     tone: 'red',   onClick: () => nav('/composti', { state: { filtroStati: ['Scaduto', 'Rivalidato — Scaduto'] } }) },
    { label: 'Rivalidati',      value: stats.rivalidati,  tone: 'orange',onClick: () => nav('/composti', { state: { filtroStati: ['Rivalidato — Attivo', 'Rivalidato — In scadenza', 'Rivalidato — Scaduto'] } }) },
  ]

  const rigaNeat: KpiBucket[] = [
    { label: 'Prep Neat in scadenza', value: prepNeatInScadenza, tone: prepNeatInScadenza > 0 ? 'amber' : 'gray', onClick: () => nav('/composti', { state: { filtroCompostoIds: idsNeatInScadenza } }) },
    { label: 'Prep Neat scadute',     value: prepNeatScadute,    tone: 'red',                                     onClick: () => nav('/composti', { state: { filtroCompostoIds: idsNeatScadute } }) },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Riga 1 — Criticità CRM */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Stato CRM</p>
        <div className="grid grid-cols-3 gap-3">
          {rigaCrm.map(b => <KpiCard key={b.label} bucket={b} />)}
        </div>
      </div>

      {/* Riga 2 — Preparazioni Neat */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Preparazioni Neat</p>
        <div className="grid grid-cols-2 gap-3">
          {rigaNeat.map(b => <KpiCard key={b.label} bucket={b} />)}
        </div>
      </div>

      {/* Riepilogo testuale */}
      <div className="rounded-lg border bg-muted/30 px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span><span className="font-semibold text-foreground">{stats.totale}</span> CRM totali</span>
        <span><span className="font-semibold text-green-700">{stats.attivi}</span> attivi</span>
        <span><span className="font-semibold text-blue-700">{stats.da_aprire}</span> da aprire</span>
        <span><span className="font-semibold text-gray-600">{stats.dismessi}</span> dismessi</span>
      </div>
    </div>
  )
}
