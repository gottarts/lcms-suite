import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function formatScadenza(giorni: number): string {
  if (giorni < 0) return `Scaduto ${-giorni}g fa`
  if (giorni === 0) return 'Scade oggi'
  if (giorni === 1) return 'Scade domani'
  return `Scade in ${giorni}g`
}

// ─────────────────────────────────────────────────────────────────────────────
// Riga CRM
// ─────────────────────────────────────────────────────────────────────────────
function CrmRow({ item, onClick }: { item: ScadenzaItem & { kind: 'composto' }; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.nome}</div>
        <div className="text-xs text-muted-foreground truncate">
          {item.lotto ? `Lotto ${item.lotto}` : '(senza lotto)'}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium">{formatScadenza(item.giorni)}</div>
        <div className="text-[10px] text-muted-foreground">{item.scadenza}</div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Riga Preparazione — con link al CRM di origine
// ─────────────────────────────────────────────────────────────────────────────
function PrepRow({
  item,
  onClickPrep,
  onClickCrm,
}: {
  item: ScadenzaItem & { kind: 'preparazione' }
  onClickPrep: () => void
  onClickCrm: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onClickPrep}
            className="text-sm font-medium text-left hover:underline truncate"
          >
            {item.flacone ? `Flacone ${item.flacone}` : 'Preparazione'}
          </button>
          <button
            type="button"
            onClick={onClickCrm}
            className="text-xs text-blue-600 hover:underline shrink-0"
          >
            → {item.composto_nome}
          </button>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium">{formatScadenza(item.giorni)}</div>
        <div className="text-[10px] text-muted-foreground">{item.scadenza}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Riga Work
// ─────────────────────────────────────────────────────────────────────────────
function WorkRow({ item, onClick }: { item: ScadenzaItem & { kind: 'work' }; onClick: () => void }) {
  const sottotitolo = [
    item.bloccata ? '⛔ bloccata' : null,
    item.ha_crm_scaduti ? '⚠ CRM scaduti' : null,
  ].filter(Boolean).join(' · ') || item.stato_lab

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.nome}</div>
        <div className="text-xs text-muted-foreground truncate">{sottotitolo}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium">{formatScadenza(item.giorni)}</div>
        <div className="text-[10px] text-muted-foreground">{item.scadenza}</div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sotto-sezione generica con bucket temporali
// ─────────────────────────────────────────────────────────────────────────────
function BucketList<T extends ScadenzaItem>({
  items,
  renderRow,
}: {
  items: T[]
  renderRow: (item: T) => React.ReactNode
}) {
  const byBucket = useMemo(() => {
    const map: Record<BucketKey, T[]> = { scadute: [], urgenti: [], prossime: [], future: [] }
    for (const it of items) map[bucketOf(it.giorni)].push(it)
    return map
  }, [items])

  const hasAny = items.length > 0

  if (!hasAny) {
    return <p className="text-xs text-muted-foreground italic px-1">Nessuna scadenza nel periodo.</p>
  }

  return (
    <div className="space-y-3">
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
                <div key={`${it.kind}-${it.id}-${i}`}>{renderRow(it)}</div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sezione collassabile (open controllato dall'esterno)
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
// Componente principale
// ─────────────────────────────────────────────────────────────────────────────
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

  const crm = useMemo(() => items.filter((i): i is ScadenzaItem & { kind: 'composto' } => i.kind === 'composto'), [items])
  const prep = useMemo(() => items.filter((i): i is ScadenzaItem & { kind: 'preparazione' } => i.kind === 'preparazione'), [items])
  const work = useMemo(() => items.filter((i): i is ScadenzaItem & { kind: 'work' } => i.kind === 'work'), [items])

  // Apertura sezioni: di default aperte se hanno elementi entro 30 giorni
  const [openCrm, setOpenCrm] = useState(true)
  const [openPrep, setOpenPrep] = useState(true)
  const [openWork, setOpenWork] = useState(true)

  // Aggiorna apertura default dopo il caricamento
  useEffect(() => {
    if (!loading) {
      setOpenCrm(crm.some(i => i.giorni <= 30))
      setOpenPrep(prep.some(i => i.giorni <= 30))
      setOpenWork(work.some(i => i.giorni <= 30))
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const allOpen = openCrm && openPrep && openWork
  const allClosed = !openCrm && !openPrep && !openWork

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Scadenze prossimi 60 giorni</CardTitle>
            <CardDescription>
              CRM, preparazioni e Work — separati per tipo
            </CardDescription>
          </div>
          {!loading && !error && (
            <div className="flex items-center gap-2 shrink-0">
              {!allOpen && (
                <Button variant="ghost" size="sm" onClick={() => { setOpenCrm(true); setOpenPrep(true); setOpenWork(true) }}>
                  Espandi tutto
                </Button>
              )}
              {!allClosed && (
                <Button variant="ghost" size="sm" onClick={() => { setOpenCrm(false); setOpenPrep(false); setOpenWork(false) }}>
                  Comprimi tutto
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
        {error && <p className="text-sm text-red-600">Errore: {error}</p>}
        {!loading && !error && (
          <div className="space-y-3">
            {/* ── CRM ── */}
            <Sezione
              title="CRM"
              count={crm.length}
              accentClass="bg-purple-100 text-purple-800 border-purple-200"
              open={openCrm}
              onToggle={() => setOpenCrm(o => !o)}
            >
              <BucketList
                items={crm}
                renderRow={(item) => (
                  <CrmRow
                    item={item}
                    onClick={() => nav('/composti', { state: { searchFilter: item.nome } })}
                  />
                )}
              />
            </Sezione>

            {/* ── Preparati ── */}
            <Sezione
              title="Preparati"
              count={prep.length}
              accentClass="bg-cyan-100 text-cyan-800 border-cyan-200"
              open={openPrep}
              onToggle={() => setOpenPrep(o => !o)}
            >
              <BucketList
                items={prep}
                renderRow={(item) => (
                  <PrepRow
                    item={item}
                    onClickPrep={() => nav('/composti', { state: { searchFilter: item.composto_nome } })}
                    onClickCrm={() => nav('/composti', { state: { searchFilter: item.composto_nome } })}
                  />
                )}
              />
            </Sezione>

            {/* ── Work ── */}
            <Sezione
              title="Work"
              count={work.length}
              accentClass="bg-teal-100 text-teal-800 border-teal-200"
              open={openWork}
              onToggle={() => setOpenWork(o => !o)}
            >
              <BucketList
                items={work}
                renderRow={(item) => (
                  <WorkRow
                    item={item}
                    onClick={() => nav('/work')}
                  />
                )}
              />
            </Sezione>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
