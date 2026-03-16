import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { compostiApi } from '@/lib/api'
import { CompostiTable } from './CompostiTable'
import { CompostoForm } from './CompostoForm'
import { CompostoPanel } from './CompostoPanel'
import { MixPesticidiForm } from './MixPesticidiForm'
import { StoriaDialog } from './StoriaDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, computeStato, isIncompleto } from '@/components/shared/StatusBadge'
import { CompostiStats } from './CompostiStats'
import { Plus, Search, FlaskConical, Filter, Upload, Download, ChevronDown,
         Copy, RotateCcw, Archive, Trash2, Columns } from 'lucide-react'
import { ImportDialog } from './ImportDialog'
import { ExportDialog } from './ExportDialog'
import { EtichetteDialog } from './EtichetteDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const STATO_MAP: Record<string, string> = {
  'Attivo':                  'attivo',
  'In scadenza':             'in_scadenza',
  'Scaduto':                 'scaduto',
  'Rivalidato — Attivo':     'rivalidato_attivo',
  'Rivalidato — In scadenza':'rivalidato_in_scadenza',
  'Rivalidato — Scaduto':    'rivalidato_scaduto',
  'Dismesso':                'dismesso',
  'Da aprire':               'da_aprire',
}

const DESTINAZIONI_USO = [
  'Taratura',
  'Controllo qualità',
  'Taratura+Controllo qualità',
  'Standard Interno',
]

const COL_DEFS: { key: string; label: string }[] = [
  { key: 'nome',             label: 'Nome' },
  { key: 'codice_interno',   label: 'Codice' },
  { key: 'classe',           label: 'Classe' },
  { key: 'forma',            label: 'Forma' },
  { key: 'produttore',       label: 'Produttore' },
  { key: 'lotto',            label: 'Lotto' },
  { key: 'scadenza_prodotto',label: 'Scadenza' },
  { key: 'solvente',         label: 'Solvente' },
  { key: 'ubicazione',       label: 'Ubicazione' },
  { key: 'stoccaggio',       label: 'Stoccaggio' },
  { key: 'accreditamento_crm', label: 'Accreditamento' },
  { key: 'work_standard',    label: 'Work' },
  { key: 'stato',            label: 'Stato' },
  { key: 'destinazione_uso', label: 'Destinazione' },
  { key: 'forma_commerciale',label: 'Forma comm.' },
  { key: 'matrice',          label: 'Matrice' },
  { key: 'mw',               label: 'MW' },
  { key: 'formula',          label: 'Formula' },
]

const DEFAULT_COL_VISIBLE: Record<string, boolean> = {
  nome:              true,
  codice_interno:    true,
  classe:            true,
  forma:             true,
  produttore:        true,
  lotto:             true,
  scadenza_prodotto: true,
  solvente:          true,
  ubicazione:        true,
  stoccaggio:        false,
  accreditamento_crm: false,
  work_standard:     true,
  stato:             true,
  destinazione_uso:  false,
  forma_commerciale: false,
  matrice:           false,
  mw:                false,
  formula:           false,
}

// ─── Tipi mix-scope (per decidere selected/all sui mix parziali) ──────────────
interface MixScopeItem {
  mixId: string
  mixLotto: string
  selectedIds: number[]
  totalCount: number
  firstCompostoId: number
}

interface MixScopeDecision {
  scope: 'selected' | 'all'
}

// ─── Tipi lotto-scope (per lotto CRM e nuova scadenza per-lotto) ─────────────
// Usato solo per la Rivalidazione bulk.
// Chiave: lotto (stringa). Raggruppa tutti gli ID selezionati con lo stesso lotto.
interface LottoScopeItem {
  lotto: string               // lotto del gruppo
  ids: number[]               // tutti gli ID della selezione con questo lotto
  firstCompostoId: number     // per caricare i lotti CRM validi da DB
}

interface LottoScopeDecision {
  lotto_crm_valido?: string
  nuova_scadenza?: string
}

// ─── Dialog lotto-scope: chiede lotto CRM e nuova scadenza per ogni lotto ────
function LottoRivalidaDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: LottoScopeItem
  onConfirm: (decision: LottoScopeDecision) => void
  onCancel: () => void
}) {
  const [lottiValidi, setLottiValidi] = useState<any[]>([])
  const [lottoCrmValido, setLottoCrmValido] = useState('')
  const [nuovaScadenza, setNuovaScadenza] = useState('')

  useEffect(() => {
    setLottoCrmValido('')
    setNuovaScadenza('')
    if (item.firstCompostoId) {
      window.electronAPI.invoke('composti:lotti-validi', item.firstCompostoId)
        .then((lotti: any) => setLottiValidi(lotti ?? []))
        .catch(() => setLottiValidi([]))
    }
  }, [item.lotto])

  return (
    <Dialog open={true} onOpenChange={v => !v && onCancel()}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={onCancel}
      >
        <DialogHeader>
          <DialogTitle>Rivalidazione — Lotto {item.lotto}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Specifica il lotto CRM valido e la nuova scadenza per{' '}
            <strong>{item.ids.length} compost{item.ids.length === 1 ? 'o' : 'i'}</strong>{' '}
            con lotto <strong>"{item.lotto}"</strong>.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">
              Lotto CRM valido
              {lottiValidi.length > 0 && (
                <span className="ml-1 text-muted-foreground font-normal">
                  ({lottiValidi.length} disponibil{lottiValidi.length === 1 ? 'e' : 'i'})
                </span>
              )}
            </Label>
            {lottiValidi.length > 0 && (
              <Select
                value={lottoCrmValido || '_manual'}
                onValueChange={v => setLottoCrmValido(v === '_manual' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleziona lotto..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_manual">— Inserisci manualmente —</SelectItem>
                  {lottiValidi.map((l: any) => (
                    <SelectItem key={l.id} value={l.lotto || String(l.id)}>
                      <span className="font-mono text-xs">
                        {l.lotto || 'N/D'}
                        {l.scadenza_prodotto && (
                          <span className="text-muted-foreground ml-2">scad. {l.scadenza_prodotto}</span>
                        )}
                        {l.forma_commerciale && (
                          <span className="text-muted-foreground ml-1">· {l.forma_commerciale}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(lottiValidi.length === 0 || lottoCrmValido === '') && (
              <Input
                className={lottiValidi.length > 0 ? 'mt-1' : ''}
                value={lottoCrmValido}
                onChange={e => setLottoCrmValido(e.target.value)}
                placeholder="es. FN0872121"
              />
            )}
          </div>
          <div>
            <Label className="text-xs">Nuova data di scadenza</Label>
            <Input
              type="date"
              value={nuovaScadenza}
              onChange={e => setNuovaScadenza(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se compilata, determina lo stato Rivalidato per questo lotto.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button onClick={() => onConfirm({
            lotto_crm_valido: lottoCrmValido || undefined,
            nuova_scadenza: nuovaScadenza || undefined,
          })}>
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog mix-scope (per decidere selected/all sui mix parziali) ────────────
function MixScopeDialog({
  item,
  onConfirmAll,
  onConfirmSelected,
  onCancel,
}: {
  item: MixScopeItem
  onConfirmAll: () => void
  onConfirmSelected: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={true} onOpenChange={v => !v && onCancel()}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={onCancel}
      >
        <DialogHeader>
          <DialogTitle>Mix parzialmente selezionato</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Hai selezionato <strong>{item.selectedIds.length}</strong> di{' '}
            <strong>{item.totalCount}</strong> componenti del mix lotto{' '}
            <strong>"{item.mixLotto}"</strong>.
            Vuoi applicare l'azione solo ai selezionati o a tutti i componenti del mix?
          </p>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button variant="secondary" onClick={onConfirmSelected}>
            Solo i {item.selectedIds.length} selezionati
          </Button>
          <Button onClick={onConfirmAll}>
            Tutti i {item.totalCount} del mix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── MultiSelectDropdown ─────────────────────────────────────────────────────
function MultiSelectDropdown({
  label, options, selected, onChange, renderLabel,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  renderLabel?: (v: string) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 h-8 px-3 text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
      >
        {label}
        {selected.length > 0 && <Badge className="ml-1 h-4 px-1 text-xs py-0">{selected.length}</Badge>}
        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[200px] rounded-md border bg-popover shadow-md p-1">
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Nessuna opzione</p>
          )}
          {options.map(v => (
            <label
              key={v}
              className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded select-none"
            >
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} className="rounded" />
              {renderLabel ? renderLabel(v) : v}
            </label>
          ))}
          {selected.length > 0 && (
            <>
              <div className="border-t my-1" />
              <button
                type="button"
                className="w-full text-xs text-muted-foreground px-2 py-1 hover:text-foreground text-left"
                onClick={() => onChange([])}
              >
                Rimuovi filtro
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function CompostiPage() {
  const location = useLocation()
  const [composti, setComposti] = useState<any[]>([])
  const [metodi, setMetodi] = useState<any[]>([])

  const initialSearch = (location.state as any)?.searchFilter ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 500)
  }

  const [filtroStati, setFiltroStati] = useState<string[]>([])
  const [filtroWorks, setFiltroWorks] = useState<string[]>([])
  const [filtroDestinazioni, setFiltroDestinazioni] = useState<string[]>([])
  const [filtroMetodi, setFiltroMetodi] = useState<string[]>([])
  const [filtroAttenzione, setFiltroAttenzione] = useState(false)
  const [filtroInScadenza, setFiltroInScadenza] = useState(false)
  const [mostraDismessi, setMostraDismessi] = useState(false)
  const [mostraDaAprire, setMostraDaAprire] = useState(true)
  const [nascondiScaduti, setNascondiScaduti] = useState(false)
  const [soloIncompleti, setSoloIncompleti] = useState(false)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  const [colVisible, setColVisible] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('composti-col-visible')
      return saved ? { ...DEFAULT_COL_VISIBLE, ...JSON.parse(saved) } : DEFAULT_COL_VISIBLE
    } catch { return DEFAULT_COL_VISIBLE }
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleColVisibleChange = useCallback((key: string, visible: boolean) => {
    setColVisible(prev => {
      const next = { ...prev, [key]: visible }
      localStorage.setItem('composti-col-visible', JSON.stringify(next))
      return next
    })
  }, [])

  const resetColVisible = useCallback(() => {
    setColVisible(DEFAULT_COL_VISIBLE)
    localStorage.removeItem('composti-col-visible')
  }, [])

  const nascosteCount = useMemo(
    () => COL_DEFS.filter(d => colVisible[d.key] === false).length,
    [colVisible]
  )

  const handleColFilter = useCallback((key: string, value: string) => {
    setColFilters(prev => {
      if (!value) { const next = { ...prev }; delete next[key]; return next }
      return { ...prev, [key]: value }
    })
  }, [])

  const [formOpen, setFormOpen] = useState(false)
  const [editComposto, setEditComposto] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [panelId, setPanelId] = useState<number | null>(null)
  const [panelTab, setPanelTab] = useState<string>('dettaglio')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteMixInfo, setDeleteMixInfo] = useState<{ count: number; lotto: string | null } | null>(null)
  const [mixOpen, setMixOpen] = useState(false)
  const [mixTemplate, setMixTemplate] = useState<any>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [etichetteOpen, setEtichetteOpen] = useState(false)
  const [storiaTarget, setStoriaTarget] = useState<{ id: number; nome: string; tipo: 'Rivalidazione' | 'Dismissione' } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkStoriaAction, setBulkStoriaAction] = useState<'Rivalidazione' | 'Dismissione' | null>(null)

  // ─── Fase 1: mix-scope (selected/all per mix parziali) ───────────────────
  const [mixScopeQueue, setMixScopeQueue] = useState<MixScopeItem[]>([])
  const [mixScopeIndex, setMixScopeIndex] = useState(0)
  const mixScopeDecisionsRef = useRef<Map<string, MixScopeDecision>>(new Map())

  // ─── Fase 2: lotto-scope (lotto CRM + nuova scadenza per ogni lotto) ─────
  // Solo per rivalidazione bulk. Parte dopo la fase mix-scope.
  const [lottoScopeQueue, setLottoScopeQueue] = useState<LottoScopeItem[]>([])
  const [lottoScopeIndex, setLottoScopeIndex] = useState(0)
  const lottoScopeDecisionsRef = useRef<Map<string, LottoScopeDecision>>(new Map())

  // Ref che tiene la funzione di esecuzione finale (execStoria/execDelete)
  const pendingBulkOpRef = useRef<((
    mixDecisions: Map<string, MixScopeDecision>,
    lottoDecisions: Map<string, LottoScopeDecision>
  ) => Promise<void>) | null>(null)

  const load = useCallback(() =>
    compostiApi.list().then(rows =>
      setComposti(rows.map((c: any) => ({
        ...c,
        metodi_ids: c.metodi_ids_raw ? c.metodi_ids_raw.split(',') : [],
      })))
    ), [])

  const loadMetodi = useCallback(() =>
    window.electronAPI.invoke('metodi:list').then(setMetodi), [])

  useEffect(() => { load(); loadMetodi() }, [load, loadMetodi])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [debouncedSearch, filtroStati, filtroWorks, filtroDestinazioni, filtroMetodi,
      filtroAttenzione, filtroInScadenza, mostraDismessi, mostraDaAprire,
      nascondiScaduti, soloIncompleti, colFilters])

  const metodiNomeMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of metodi) map[m.id] = m.nome?.toLowerCase() ?? ''
    return map
  }, [metodi])

  const opzioniWork = useMemo(() =>
    Array.from(new Set(composti.map(c => c.work_standard).filter((v): v is string => !!v && v.trim() !== ''))).sort()
  , [composti])

  const filtered = useMemo(() => {
    let result = composti
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(c =>
        c.nome?.toLowerCase().includes(q) ||
        c.codice_interno?.toLowerCase().includes(q) ||
        c.classe?.toLowerCase().includes(q) ||
        c.produttore?.toLowerCase().includes(q) ||
        c.lotto?.toLowerCase().includes(q) ||
        c.ubicazione?.toLowerCase().includes(q) ||
        c.solvente?.toLowerCase().includes(q) ||
        c.forma_commerciale?.toLowerCase().includes(q) ||
        c.destinazione_uso?.toLowerCase().includes(q) ||
        c.forma?.toLowerCase().includes(q) ||
        c.formula?.toLowerCase().includes(q) ||
        c.fiala?.toLowerCase().includes(q) ||
        c.operatore_apertura?.toLowerCase().includes(q) ||
        c.stoccaggio?.toLowerCase().includes(q) ||
        c.accreditamento_crm?.toLowerCase().includes(q) ||
        c.work_standard?.toLowerCase().includes(q) ||
        c.metodi_ids?.some((id: string) => metodiNomeMap[id]?.includes(q))
      )
    }
    if (Object.keys(colFilters).length > 0) {
      result = result.filter(c =>
        Object.entries(colFilters).every(([key, val]) =>
          String(c[key] ?? '').toLowerCase().includes(val.toLowerCase())
        )
      )
    }
    if (filtroStati.length > 0) result = result.filter(c => filtroStati.some(s => computeStato(c) === STATO_MAP[s]))
    if (filtroWorks.length > 0) result = result.filter(c => filtroWorks.includes(c.work_standard))
    if (filtroDestinazioni.length > 0) result = result.filter(c => filtroDestinazioni.includes(c.destinazione_uso))
    if (filtroMetodi.length > 0) result = result.filter(c => c.metodi_ids?.some((id: string) => filtroMetodi.includes(id)))
    if (filtroInScadenza) result = result.filter(c => { const s = computeStato(c); return s === 'in_scadenza' || s === 'rivalidato_in_scadenza' })
    if (filtroAttenzione) result = result.filter(c => { const s = computeStato(c); return s === 'scaduto' || s === 'rivalidato_scaduto' })
    if (!mostraDismessi) result = result.filter(c => computeStato(c) !== 'dismesso')
    if (!mostraDaAprire) result = result.filter(c => computeStato(c) !== 'da_aprire')
    if (nascondiScaduti) result = result.filter(c => { const s = computeStato(c); return s !== 'scaduto' && s !== 'rivalidato_scaduto' })
    if (soloIncompleti) result = result.filter(c => isIncompleto(c))
    return result
  }, [composti, metodiNomeMap, debouncedSearch, colFilters,
      filtroStati, filtroWorks, filtroDestinazioni, filtroMetodi,
      filtroAttenzione, filtroInScadenza, mostraDismessi, mostraDaAprire,
      nascondiScaduti, soloIncompleti])

  const stats = useMemo(() => ({
    attivi: filtered.filter(c => { const s = computeStato(c); return s === 'attivo' || s === 'rivalidato_attivo' }).length,
    inScadenza: filtered.filter(c => { const s = computeStato(c); return s === 'in_scadenza' || s === 'rivalidato_in_scadenza' }).length,
    attenzione: filtered.filter(c => { const s = computeStato(c); return s === 'scaduto' || s === 'rivalidato_scaduto' }).length,
  }), [filtered])

  // ─── buildMixQueue: mix parzialmente selezionati ─────────────────────────
  const buildMixQueue = useCallback(async (ids: Set<number>): Promise<MixScopeItem[]> => {
    const mixMap = new Map<string, { selectedIds: number[]; lotto: string; firstId: number }>()
    for (const id of ids) {
      const comp = composti.find((c: any) => c.id === id)
      if (!comp?.mix_id) continue
      if (!mixMap.has(comp.mix_id)) {
        mixMap.set(comp.mix_id, { selectedIds: [], lotto: comp.lotto ?? comp.mix_id, firstId: id })
      }
      mixMap.get(comp.mix_id)!.selectedIds.push(id)
    }
    const queue: MixScopeItem[] = []
    for (const [mixId, { selectedIds: selIds, lotto, firstId }] of mixMap.entries()) {
      const totalCount = await window.electronAPI.invoke('composti:count-by-mix', mixId) as number
      if (selIds.length < totalCount) {
        queue.push({ mixId, mixLotto: lotto, selectedIds: selIds, totalCount, firstCompostoId: firstId })
      }
    }
    return queue
  }, [composti])

  // ─── buildLottoQueue: un item per ogni lotto distinto nella selezione ────
  // Usato solo per la rivalidazione. Raggruppa per lotto — stesso lotto = stesso dialog.
  const buildLottoQueue = useCallback((
    ids: Set<number>,
    compostiSnapshot: any[]
  ): LottoScopeItem[] => {
    const lottoMap = new Map<string, { ids: number[]; firstId: number }>()
    for (const id of ids) {
      const comp = compostiSnapshot.find((c: any) => c.id === id)
      const lotto: string = comp?.lotto ?? `id:${id}`
      if (!lottoMap.has(lotto)) {
        lottoMap.set(lotto, { ids: [], firstId: id })
      }
      lottoMap.get(lotto)!.ids.push(id)
    }
    return Array.from(lottoMap.entries()).map(([lotto, { ids: lottoIds, firstId }]) => ({
      lotto,
      ids: lottoIds,
      firstCompostoId: firstId,
    }))
  }, [])

  // ─── cancelBulk: azzera tutto ─────────────────────────────────────────────
  const cancelBulk = useCallback(() => {
    setMixScopeQueue([])
    setMixScopeIndex(0)
    mixScopeDecisionsRef.current = new Map()
    setLottoScopeQueue([])
    setLottoScopeIndex(0)
    lottoScopeDecisionsRef.current = new Map()
    pendingBulkOpRef.current = null
  }, [])

  // ─── Fase mix-scope: decisione selected/all ───────────────────────────────
  const handleMixScopeDecision = useCallback((scope: 'selected' | 'all') => {
    const current = mixScopeQueue[mixScopeIndex]
    mixScopeDecisionsRef.current.set(current.mixId, { scope })

    const nextIndex = mixScopeIndex + 1
    if (nextIndex < mixScopeQueue.length) {
      setMixScopeIndex(nextIndex)
    } else {
      // Fase mix-scope completata — avvia fase lotto-scope se presente
      setMixScopeQueue([])
      setMixScopeIndex(0)
      if (lottoScopeQueue.length > 0) {
        setLottoScopeIndex(0)
        // lottoScopeQueue è già impostato da handleBulkStoria
      } else {
        // Nessuna fase lotto (es. dismissione/delete) — esegui direttamente
        const mixDecisions = new Map(mixScopeDecisionsRef.current)
        const op = pendingBulkOpRef.current
        mixScopeDecisionsRef.current = new Map()
        pendingBulkOpRef.current = null
        if (op) op(mixDecisions, new Map())
      }
    }
  }, [mixScopeQueue, mixScopeIndex, lottoScopeQueue])

  // ─── Fase lotto-scope: decisione lotto CRM + nuova scadenza ──────────────
  const handleLottoScopeDecision = useCallback((decision: LottoScopeDecision) => {
    const current = lottoScopeQueue[lottoScopeIndex]
    lottoScopeDecisionsRef.current.set(current.lotto, decision)

    const nextIndex = lottoScopeIndex + 1
    if (nextIndex < lottoScopeQueue.length) {
      setLottoScopeIndex(nextIndex)
    } else {
      // Fase lotto-scope completata — esegui operazione finale
      const mixDecisions = new Map(mixScopeDecisionsRef.current)
      const lottoDecisions = new Map(lottoScopeDecisionsRef.current)
      const op = pendingBulkOpRef.current

      setLottoScopeQueue([])
      setLottoScopeIndex(0)
      mixScopeDecisionsRef.current = new Map()
      lottoScopeDecisionsRef.current = new Map()
      pendingBulkOpRef.current = null

      if (op) op(mixDecisions, lottoDecisions)
    }
  }, [lottoScopeQueue, lottoScopeIndex])

  // ─── Delete singolo ───────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (deleteId !== null) {
      if (deleteMixInfo && deleteMixInfo.lotto && deleteMixInfo.count > 1) {
        await window.electronAPI.invoke('composti:delete-by-lotto', deleteMixInfo.lotto)
      } else {
        await compostiApi.delete(deleteId)
      }
      setDeleteId(null); setDeleteMixInfo(null); setPanelId(null); load()
    }
  }, [deleteId, deleteMixInfo, load])

  // ─── Bulk delete (solo fase mix-scope, nessuna fase lotto) ───────────────
  const handleBulkDelete = useCallback(async () => {
    setBulkDeleteOpen(false)
    const ids = new Set(selectedIds)
    const compostiSnapshot = [...composti]

    const execDelete = async (
      mixDecisions: Map<string, MixScopeDecision>,
      _lottoDecisions: Map<string, LottoScopeDecision>
    ) => {
      for (const id of ids) {
        const comp = compostiSnapshot.find((c: any) => c.id === id)
        if (!comp?.mix_id) await compostiApi.delete(id)
      }
      const processedMix = new Set<string>()
      for (const id of ids) {
        const comp = compostiSnapshot.find((c: any) => c.id === id)
        if (!comp?.mix_id) continue
        if (processedMix.has(comp.mix_id)) continue
        processedMix.add(comp.mix_id)
        const decision = mixDecisions.get(comp.mix_id)
        if (!decision || decision.scope === 'all') {
          await window.electronAPI.invoke('composti:delete-by-mix-id', comp.mix_id)
        } else {
          const mixSelected = [...ids].filter(
            sid => compostiSnapshot.find((c: any) => c.id === sid)?.mix_id === comp.mix_id
          )
          for (const sid of mixSelected) await compostiApi.delete(sid)
        }
      }
      setSelectedIds(new Set()); load()
    }

    const mixQueue = await buildMixQueue(ids)
    if (mixQueue.length === 0) {
      await execDelete(new Map(), new Map())
    } else {
      pendingBulkOpRef.current = execDelete
      mixScopeDecisionsRef.current = new Map()
      setLottoScopeQueue([])  // nessuna fase lotto per il delete
      setMixScopeQueue(mixQueue)
      setMixScopeIndex(0)
    }
  }, [selectedIds, composti, load, buildMixQueue])

  // ─── Bulk storia (Rivalidazione / Dismissione) ────────────────────────────
  const handleBulkStoria = useCallback(async (payload: any) => {
    const ids = new Set(selectedIds)
    const compostiSnapshot = [...composti]
    const isRivalidazione = payload.tipo === 'Rivalidazione'

    const execStoria = async (
      mixDecisions: Map<string, MixScopeDecision>,
      lottoDecisions: Map<string, LottoScopeDecision>
    ) => {
      const processedMix = new Set<string>()

      for (const id of ids) {
        const comp = compostiSnapshot.find((c: any) => c.id === id)
        const mixId: string | null = comp?.mix_id ?? null
        const lotto: string = comp?.lotto ?? `id:${id}`

        // Payload arricchito con lotto/scadenza per-lotto (solo rivalidazione)
        const lottoDecision = lottoDecisions.get(lotto)
        const perLottoPayload = isRivalidazione ? {
          ...payload,
          lotto_crm_valido: lottoDecision?.lotto_crm_valido,
          nuova_scadenza: lottoDecision?.nuova_scadenza,
        } : payload

        if (!mixId) {
          // Composto singolo
          await compostiApi.addStoria(id, perLottoPayload)
          continue
        }

        if (processedMix.has(mixId)) continue
        processedMix.add(mixId)

        const mixDecision = mixDecisions.get(mixId)
        if (!mixDecision || mixDecision.scope === 'all') {
          // Tutto il mix: una sola chiamata con propagate: true
          await compostiApi.addStoria(id, { ...perLottoPayload, propagate: true })
        } else {
          // Solo i selezionati del mix
          const mixSelected = [...ids].filter(
            sid => compostiSnapshot.find((c: any) => c.id === sid)?.mix_id === mixId
          )
          for (const sid of mixSelected) {
            await compostiApi.addStoria(sid, { ...perLottoPayload, propagate: false })
          }
        }
      }

      setSelectedIds(new Set()); setBulkStoriaAction(null); load()
    }

    const mixQueue = await buildMixQueue(ids)
    const lottoQueue = isRivalidazione ? buildLottoQueue(ids, compostiSnapshot) : []

    if (mixQueue.length === 0 && lottoQueue.length === 0) {
      // Nessun dialog: esegui subito
      await execStoria(new Map(), new Map())
    } else {
      pendingBulkOpRef.current = execStoria
      mixScopeDecisionsRef.current = new Map()
      lottoScopeDecisionsRef.current = new Map()

      if (mixQueue.length > 0) {
        // Parte prima la fase mix-scope, poi quella lotto-scope
        setLottoScopeQueue(lottoQueue)  // pre-carica per dopo
        setLottoScopeIndex(0)
        setMixScopeQueue(mixQueue)
        setMixScopeIndex(0)
      } else {
        // Nessun mix parziale: vai diretto alla fase lotto-scope
        setLottoScopeQueue(lottoQueue)
        setLottoScopeIndex(0)
      }
    }
  }, [selectedIds, composti, load, buildMixQueue, buildLottoQueue])

  const handleEdit = useCallback((composto: any) => {
    setEditComposto(composto); setPanelId(null); setFormOpen(true)
  }, [])

  const handleNewLotto = useCallback(async (composto: any) => {
    if (composto.mix_id) {
      try {
        const componenti = await window.electronAPI.invoke('composti:list-by-mix', composto.mix_id) as any[]
        const template = {
          forma_commerciale: composto.forma_commerciale || composto.mix || '',
          concentrazione: composto.concentrazione ? String(composto.concentrazione) : '',
          unita_conc: composto.unita_conc || '',
          solvente: composto.solvente || '',
          classe: composto.classe || '',
          destinazione_uso: composto.destinazione_uso || '',
          work_standard: composto.work_standard || '',
          ubicazione: composto.ubicazione || '',
          stoccaggio: composto.stoccaggio || '',
          accreditamento_crm: composto.accreditamento_crm || 'ISO 17034',
          codice_interno: composto.codice_interno || '',
          fiala: composto.fiala || '1',
          volume_ml: composto.volume_ml ? String(composto.volume_ml) : '',
          lotto: '', data_apertura: '', scadenza_prodotto: '', operatore_apertura: '',
          produttore: composto.produttore || '',
          _nomi: componenti.map((c: any) => c.nome),
          _metodi_ids: composto.metodi_ids || [],
        }
        setMixTemplate(template); setMixOpen(true); setPanelId(null)
      } catch (err) { console.error('Errore caricamento componenti mix:', err) }
      return
    }
    setTemplate(composto); setEditComposto(null); setPanelId(null); setFormOpen(true)
  }, [])

  const handleRowClick = useCallback((row: any) => { setPanelTab('dettaglio'); setPanelId(row.id) }, [])
  const handleRivalida = useCallback((row: any) => setStoriaTarget({ id: row.id, nome: row.nome, tipo: 'Rivalidazione' }), [])
  const handleDismetti = useCallback((row: any) => setStoriaTarget({ id: row.id, nome: row.nome, tipo: 'Dismissione' }), [])
  const handleOpenStorico = useCallback((row: any) => { setPanelTab('storico'); setPanelId(row.id) }, [])
  const handleOpenPreparazioni = useCallback((row: any) => { setPanelTab('preparazioni'); setPanelId(row.id) }, [])
  const handleRequestDelete = useCallback(async (id: number) => {
    setPanelId(null)
    const info = await window.electronAPI.invoke('composti:count-by-lotto', id)
    setDeleteMixInfo(info); setDeleteId(id)
  }, [])

  const hasFiltriAttivi = filtroStati.length > 0 || filtroWorks.length > 0 ||
    filtroDestinazioni.length > 0 || filtroMetodi.length > 0 ||
    nascondiScaduti || soloIncompleti || Object.keys(colFilters).length > 0

  const nSel = selectedIds.size
  const selLabel = `${nSel} compost${nSel === 1 ? 'o' : 'i'}`

  const currentMixScope = mixScopeQueue[mixScopeIndex] ?? null
  const currentLottoScope = !currentMixScope ? (lottoScopeQueue[lottoScopeIndex] ?? null) : null

  // Numero di lotti distinti nella selezione — per banner avviso StoriaDialog bulk
  const bulkLottiDistinti = useMemo(() => {
    const lotti = new Set<string>()
    for (const id of selectedIds) {
      const comp = composti.find((c: any) => c.id === id)
      if (comp?.lotto) lotti.add(comp.lotto)
    }
    return lotti.size
  }, [selectedIds, composti])

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">
          Visualizzati: {filtered.length} / Totali: {composti.length}
        </span>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo composto
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setMixTemplate(null); setMixOpen(true) }}>
            <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Importa
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" /> Esporta
          </Button>
          <Button
            size="sm" variant="outline" onClick={() => setEtichetteOpen(true)}
            title={nSel > 0 ? `Etichette per ${nSel} selezionati` : 'Etichette per tutti i visualizzati'}
          >
            🏷️ Etichette{nSel > 0 && <span className="ml-1 text-xs text-primary font-medium">({nSel})</span>}
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <div className="relative" ref={colMenuRef}>
            <Button size="sm" variant="outline" onClick={() => setColMenuOpen(v => !v)}>
              <Columns className="h-4 w-4 mr-1" /> Colonne
              {nascosteCount > 0 && (
                <Badge className="ml-1 h-4 px-1 text-xs py-0 bg-muted text-muted-foreground">
                  {nascosteCount}
                </Badge>
              )}
            </Button>
            {colMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border bg-popover shadow-md p-2">
                <div className="text-xs font-medium text-muted-foreground px-1 mb-2">Colonne visibili</div>
                {COL_DEFS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-accent rounded select-none">
                    <input type="checkbox" checked={colVisible[key] !== false} onChange={e => handleColVisibleChange(key, e.target.checked)} />
                    {label}
                  </label>
                ))}
                <div className="border-t mt-2 pt-2">
                  <button className="w-full text-xs text-muted-foreground px-1 py-1 hover:text-foreground text-left" onClick={resetColVisible}>
                    Ripristina default
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Cerca nome, lotto, metodo, accreditamento..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 border-l pl-3 flex-wrap">
            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <MultiSelectDropdown label="Stato" options={Object.keys(STATO_MAP)} selected={filtroStati} onChange={setFiltroStati} />
            <MultiSelectDropdown label="Work" options={opzioniWork} selected={filtroWorks} onChange={setFiltroWorks} />
            <MultiSelectDropdown label="Destinazione" options={DESTINAZIONI_USO} selected={filtroDestinazioni} onChange={setFiltroDestinazioni} />
            <MultiSelectDropdown label="Metodo" options={metodi.map(m => m.id)} selected={filtroMetodi} onChange={setFiltroMetodi} renderLabel={id => metodi.find(m => m.id === id)?.nome ?? id} />
          </div>
        </div>

        {hasFiltriAttivi && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {filtroStati.map(s => (
              <Badge key={s} variant="secondary" className="flex items-center gap-1">
                Stato: {s}
                <button onClick={() => setFiltroStati(prev => prev.filter(x => x !== s))} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
              </Badge>
            ))}
            {filtroWorks.map(w => (
              <Badge key={w} variant="secondary" className="flex items-center gap-1">
                Work: {w}
                <button onClick={() => setFiltroWorks(prev => prev.filter(x => x !== w))} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
              </Badge>
            ))}
            {filtroDestinazioni.map(d => (
              <Badge key={d} variant="secondary" className="flex items-center gap-1">
                Dest.: {d}
                <button onClick={() => setFiltroDestinazioni(prev => prev.filter(x => x !== d))} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
              </Badge>
            ))}
            {filtroMetodi.map(id => (
              <Badge key={id} variant="secondary" className="flex items-center gap-1">
                Metodo: {metodi.find(m => m.id === id)?.nome ?? id}
                <button onClick={() => setFiltroMetodi(prev => prev.filter(x => x !== id))} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
              </Badge>
            ))}
            {nascondiScaduti && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Scaduti esclusi
                <button onClick={() => setNascondiScaduti(false)} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
              </Badge>
            )}
            {soloIncompleti && (
              <Badge variant="secondary" className="flex items-center gap-1 border-amber-300 bg-amber-50 text-amber-800">
                Solo incompleti
                <button onClick={() => setSoloIncompleti(false)} className="ml-1 hover:bg-amber-100 rounded px-0.5">×</button>
              </Badge>
            )}
            {Object.entries(colFilters).map(([key, val]) => (
              <Badge key={key} variant="secondary" className="flex items-center gap-1">
                {COL_DEFS.find(d => d.key === key)?.label ?? key}: "{val}"
                <button onClick={() => handleColFilter(key, '')} className="ml-1 hover:bg-muted rounded px-0.5">×</button>
              </Badge>
            ))}
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFiltroStati([]); setFiltroWorks([]); setFiltroDestinazioni([])
                setFiltroMetodi([]); setNascondiScaduti(false); setSoloIncompleti(false); setColFilters({})
              }}
            >
              Rimuovi tutti
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={mostraDismessi} onChange={e => setMostraDismessi(e.target.checked)} className="rounded" />
            Mostra dismessi
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={mostraDaAprire} onChange={e => setMostraDaAprire(e.target.checked)} className="rounded" />
            Mostra da aprire
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={nascondiScaduti} onChange={e => setNascondiScaduti(e.target.checked)} className="rounded" />
            Escludi scaduti
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-amber-700">
            <input type="checkbox" checked={soloIncompleti} onChange={e => setSoloIncompleti(e.target.checked)} className="rounded accent-amber-500" />
            Solo incompleti
          </label>
        </div>
      </div>

      <CompostiStats
        stats={stats}
        onClickInScadenza={() => {
          if (filtroInScadenza) { setFiltroInScadenza(false) }
          else { setFiltroAttenzione(false); setFiltroStati([]); setFiltroInScadenza(true) }
        }}
        onClickAttenzione={() => {
          if (filtroAttenzione) { setFiltroAttenzione(false) }
          else { setFiltroStati([]); setFiltroInScadenza(false); setFiltroAttenzione(true) }
        }}
      />

      {/* ─── Barra bulk actions ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 my-2 rounded-md bg-muted border text-sm min-h-[44px]">
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <input
            type="checkbox" className="rounded"
            checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
            onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(c => c.id)) : new Set())}
          />
          <span className="text-muted-foreground text-xs">
            {nSel > 0 ? `${selLabel} selezionat${nSel === 1 ? 'o' : 'i'}` : `Seleziona tutti (${filtered.length})`}
          </span>
        </label>
        {nSel > 0 && (
          <>
            <div className="border-l h-4 mx-1 shrink-0" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => { const first = composti.find(c => selectedIds.has(c.id)); if (first) handleNewLotto(first) }}>
                <Copy className="h-3 w-3 mr-1" /> Nuovo lotto
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkStoriaAction('Rivalidazione')}>
                <RotateCcw className="h-3 w-3 mr-1" /> Rivalidazione
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkStoriaAction('Dismissione')}>
                <Archive className="h-3 w-3 mr-1" /> Dismetti
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3 w-3 mr-1" /> Cancella
              </Button>
            </div>
            <button className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0" onClick={() => setSelectedIds(new Set())}>
              Deseleziona
            </button>
          </>
        )}
      </div>

      <CompostiTable
        data={filtered} onRowClick={handleRowClick} onNewLotto={handleNewLotto}
        onRivalida={handleRivalida} onDismetti={handleDismetti} onRefresh={load}
        onOpenStorico={handleOpenStorico} onOpenPreparazioni={handleOpenPreparazioni}
        selectedIds={selectedIds} onSelectionChange={setSelectedIds}
        colVisible={colVisible} colFilters={colFilters} onColFilter={handleColFilter}
      />

      <CompostoForm open={formOpen} onClose={() => { setFormOpen(false); setTemplate(null) }} composto={editComposto} template={template} onSave={() => { load(); setTemplate(null) }} />
      <MixPesticidiForm open={mixOpen} onClose={() => { setMixOpen(false); setMixTemplate(null) }} onSave={load} mixTemplate={mixTemplate} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onSave={load} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} filteredIds={filtered.map((c: any) => c.id)} selectedIds={nSel > 0 ? [...selectedIds] : []} />
      <EtichetteDialog open={etichetteOpen} onClose={() => setEtichetteOpen(false)} filteredIds={nSel > 0 ? [...selectedIds] : filtered.map((c: any) => c.id)} />
      <CompostoPanel
        key={panelId ?? 'none'} compostoId={panelId}
        onClose={() => { setPanelId(null); setPanelTab('dettaglio') }}
        onEdit={handleEdit} onDelete={handleRequestDelete} onNewLotto={handleNewLotto}
        onRefreshList={load} defaultTab={panelTab}
      />

      {/* StoriaDialog singolo */}
      <StoriaDialog
        open={storiaTarget !== null} onOpenChange={v => !v && setStoriaTarget(null)}
        compostoId={storiaTarget?.id ?? null} compostoNome={storiaTarget?.nome}
        tipo={storiaTarget?.tipo ?? ''} onSaved={() => { load(); setStoriaTarget(null) }}
      />

      {/* StoriaDialog bulk — isBulk=true nasconde lotto/scadenza */}
      <StoriaDialog
        open={bulkStoriaAction !== null} onOpenChange={v => !v && setBulkStoriaAction(null)}
        compostoId={[...selectedIds][0] ?? null}
        compostoNome={`${selLabel} selezionat${nSel === 1 ? 'o' : 'i'}`}
        tipo={bulkStoriaAction ?? ''} onSaved={() => {}} onSavedBulk={handleBulkStoria}
        isBulk={true}
        bulkLottiDistinti={bulkLottiDistinti}
      />

      {/* ConfirmDialog eliminazione singola */}
      <ConfirmDialog
        open={deleteId !== null} title="Elimina composto"
        message={
          deleteMixInfo && deleteMixInfo.lotto && deleteMixInfo.count > 1
            ? `Questo composto fa parte di un mix (lotto: ${deleteMixInfo.lotto}). Verranno eliminati ${deleteMixInfo.count} composti con tutti i dati correlati. Continuare?`
            : 'Eliminare questo composto e tutti i dati correlati (preparazioni, storia, associazioni metodi)?'
        }
        confirmLabel="Elimina" variant="danger" onConfirm={handleDelete}
        onCancel={() => { setDeleteId(null); setDeleteMixInfo(null) }}
      />

      {/* ConfirmDialog eliminazione bulk */}
      <ConfirmDialog
        open={bulkDeleteOpen} title="Elimina composti selezionati"
        message={`Stai per eliminare ${selLabel} e tutti i dati correlati (preparazioni, storia, associazioni metodi). L'operazione non è reversibile.`}
        confirmLabel={`Elimina ${selLabel}`} variant="danger"
        onConfirm={handleBulkDelete} onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Fase 1 — Dialog mix-scope (selected/all per mix parziali) */}
      {currentMixScope && (
        <MixScopeDialog
          item={currentMixScope}
          onConfirmAll={() => handleMixScopeDecision('all')}
          onConfirmSelected={() => handleMixScopeDecision('selected')}
          onCancel={cancelBulk}
        />
      )}

      {/* Fase 2 — Dialog lotto-scope (lotto CRM + nuova scadenza per ogni lotto) */}
      {currentLottoScope && (
        <LottoRivalidaDialog
          item={currentLottoScope}
          onConfirm={handleLottoScopeDecision}
          onCancel={cancelBulk}
        />
      )}
    </div>
  )
}