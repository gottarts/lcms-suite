import { useState, useEffect, useMemo, useRef } from 'react'
import { compostiApi } from '@/lib/api'
import { CompostiTable } from './CompostiTable'
import { CompostoForm } from './CompostoForm'
import { CompostoPanel } from './CompostoPanel'
import { MixPesticidiForm } from './MixPesticidiForm'
import { StoriaDialog } from './StoriaDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, computeStato } from '@/components/shared/StatusBadge'
import { CompostiStats } from './CompostiStats'
import { Plus, Search, FlaskConical, Filter, Upload, Download, ChevronDown } from 'lucide-react'
import { ImportDialog } from './ImportDialog'
import { ExportDialog } from './ExportDialog'
import { EtichetteDialog } from './EtichetteDialog'

// Tutti gli stati possibili mappati al valore interno di computeStato
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

// FEAT-J: valori fissi per destinazione uso
const DESTINAZIONI_USO = [
  'Taratura',
  'Controllo qualità',
  'Taratura+Controllo qualità',
  'Standard Interno',
]

// Componente dropdown multi-select riutilizzabile
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  renderLabel,
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
        {selected.length > 0 && (
          <Badge className="ml-1 h-4 px-1 text-xs py-0">{selected.length}</Badge>
        )}
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
              <input
                type="checkbox"
                checked={selected.includes(v)}
                onChange={() => toggle(v)}
                className="rounded"
              />
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

export function CompostiPage() {
  const [composti, setComposti] = useState<any[]>([])
  const [metodi, setMetodi] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 500)
  }

  // --- Filtri multi-select ---
  const [filtroStati, setFiltroStati] = useState<string[]>([])
  const [filtroWorks, setFiltroWorks] = useState<string[]>([])
  const [filtroDestinazioni, setFiltroDestinazioni] = useState<string[]>([])
  const [filtroMetodi, setFiltroMetodi] = useState<string[]>([])

  // --- Filtri toggle (pill statistiche) ---
  const [filtroAttenzione, setFiltroAttenzione] = useState(false)
  const [filtroInScadenza, setFiltroInScadenza] = useState(false)

  // --- Toggle visibilità ---
  const [mostraDismessi, setMostraDismessi] = useState(false)
  const [mostraDaAprire, setMostraDaAprire] = useState(true)

  // --- UI state ---
  const [formOpen, setFormOpen] = useState(false)
  const [editComposto, setEditComposto] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [panelId, setPanelId] = useState<number | null>(null)
  const [panelTab, setPanelTab] = useState<string>('dettaglio')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteMixInfo, setDeleteMixInfo] = useState<{ count: number; lotto: string | null } | null>(null)
  const [mixOpen, setMixOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [etichetteOpen, setEtichetteOpen] = useState(false)
  const [storiaTarget, setStoriaTarget] = useState<{ id: number; nome: string; tipo: 'Rivalidazione' | 'Dismissione' } | null>(null)

  const load = () => compostiApi.list().then(setComposti)
  const loadMetodi = () => window.electronAPI.invoke('metodi:list').then(setMetodi)

  useEffect(() => {
    load()
    loadMetodi()
  }, [])

  // Mappa id -> nome metodo pre-calcolata per ricerca veloce
  const metodiNomeMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of metodi) {
      map[m.id] = m.nome?.toLowerCase() ?? ''
    }
    return map
  }, [metodi])

  // Opzioni Work dinamiche dai dati
  const opzioniWork = useMemo(() =>
    Array.from(
      new Set(
        composti
          .map(c => c.work_standard)
          .filter((v): v is string => !!v && v.trim() !== '')
      )
    ).sort()
  , [composti])

  const filtered = useMemo(() => {
    let result = composti

    // --- Ricerca testuale: tutti i campi stringa + nome metodo ---
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
        // ricerca per nome metodo associato (usa mappa pre-calcolata)
        c.metodi_ids?.some((id: string) => metodiNomeMap[id]?.includes(q))
      )
    }

    // --- Filtro Stato (multi) ---
    if (filtroStati.length > 0) {
      result = result.filter(c =>
        filtroStati.some(s => computeStato(c) === STATO_MAP[s])
      )
    }

    // --- Filtro Work Solution (multi) ---
    if (filtroWorks.length > 0) {
      result = result.filter(c => filtroWorks.includes(c.work_standard))
    }

    // --- Filtro Destinazione d'Uso (multi) ---
    if (filtroDestinazioni.length > 0) {
      result = result.filter(c => filtroDestinazioni.includes(c.destinazione_uso))
    }

    // --- Filtro Metodo (multi) ---
    if (filtroMetodi.length > 0) {
      result = result.filter(c =>
        c.metodi_ids?.some((id: string) => filtroMetodi.includes(id))
      )
    }

    // --- Filtri pill statistiche ---
    if (filtroInScadenza) {
      result = result.filter(c => {
        const s = computeStato(c)
        return s === 'in_scadenza' || s === 'rivalidato_in_scadenza'
      })
    }

    if (filtroAttenzione) {
      result = result.filter(c => {
        const s = computeStato(c)
        return s === 'scaduto' || s === 'rivalidato_scaduto'
      })
    }

    // --- Toggle visibilità ---
    if (!mostraDismessi) {
      result = result.filter(c => computeStato(c) !== 'dismesso')
    }

    if (!mostraDaAprire) {
      result = result.filter(c => computeStato(c) !== 'da_aprire')
    }

    return result
  }, [composti, metodiNomeMap, debouncedSearch, filtroStati, filtroWorks, filtroDestinazioni, filtroMetodi, filtroAttenzione, filtroInScadenza, mostraDismessi, mostraDaAprire])

  const stats = useMemo(() => ({
    attivi: filtered.filter(c => {
      const s = computeStato(c)
      return s === 'attivo' || s === 'rivalidato_attivo'
    }).length,
    inScadenza: filtered.filter(c => {
      const s = computeStato(c)
      return s === 'in_scadenza' || s === 'rivalidato_in_scadenza'
    }).length,
    attenzione: filtered.filter(c => {
      const s = computeStato(c)
      return s === 'scaduto' || s === 'rivalidato_scaduto'
    }).length,
  }), [filtered])

  const handleDelete = async () => {
    if (deleteId !== null) {
      if (deleteMixInfo && deleteMixInfo.lotto && deleteMixInfo.count > 1) {
        await window.electronAPI.invoke('composti:delete-by-lotto', deleteMixInfo.lotto)
      } else {
        await compostiApi.delete(deleteId)
      }
      setDeleteId(null)
      setDeleteMixInfo(null)
      setPanelId(null)
      load()
    }
  }

  const handleEdit = (composto: any) => {
    setEditComposto(composto)
    setPanelId(null)
    setFormOpen(true)
  }

  const handleNewLotto = (composto: any) => {
    setTemplate(composto)
    setEditComposto(null)
    setPanelId(null)
    setFormOpen(true)
  }

  const handleRivalida = (row: any) => {
    setStoriaTarget({ id: row.id, nome: row.nome, tipo: 'Rivalidazione' })
  }

  const handleDismetti = (row: any) => {
    setStoriaTarget({ id: row.id, nome: row.nome, tipo: 'Dismissione' })
  }

  const handleOpenStorico = (row: any) => {
    setPanelTab('storico')
    setPanelId(row.id)
  }

  const handleOpenPreparazioni = (row: any) => {
    setPanelTab('preparazioni')
    setPanelId(row.id)
  }

  const handleRequestDelete = async (id: number) => {
    setPanelId(null)
    const info = await window.electronAPI.invoke('composti:count-by-lotto', id)
    setDeleteMixInfo(info)
    setDeleteId(id)
  }

  // Badge attivi totali (per mostrare se ci sono filtri attivi)
  const hasFiltriAttivi =
    filtroStati.length > 0 ||
    filtroWorks.length > 0 ||
    filtroDestinazioni.length > 0 ||
    filtroMetodi.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">Reference Standards</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Visualizzati: {filtered.length} / Totali: {composti.length}
          </span>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Importa CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMixOpen(true)}>
            <FlaskConical className="h-4 w-4 mr-1" /> Aggiungi Mix
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" /> Esporta
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEtichetteOpen(true)}>
            🏷️ Etichette
          </Button>
          <Button size="sm" onClick={() => { setEditComposto(null); setTemplate(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo composto
          </Button>
        </div>
      </div>

      <div className="mb-4">
        {/* Riga 1: ricerca + filtri multi-select */}
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

            <MultiSelectDropdown
              label="Stato"
              options={Object.keys(STATO_MAP)}
              selected={filtroStati}
              onChange={setFiltroStati}
            />

            <MultiSelectDropdown
              label="Work"
              options={opzioniWork}
              selected={filtroWorks}
              onChange={setFiltroWorks}
            />

            <MultiSelectDropdown
              label="Destinazione"
              options={DESTINAZIONI_USO}
              selected={filtroDestinazioni}
              onChange={setFiltroDestinazioni}
            />

            <MultiSelectDropdown
              label="Metodo"
              options={metodi.map(m => m.id)}
              selected={filtroMetodi}
              onChange={setFiltroMetodi}
              renderLabel={id => metodi.find(m => m.id === id)?.nome ?? id}
            />
          </div>
        </div>

        {/* Riga 2: badge filtri attivi */}
        {hasFiltriAttivi && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {filtroStati.map(s => (
              <Badge key={s} variant="secondary" className="flex items-center gap-1">
                Stato: {s}
                <button
                  onClick={() => setFiltroStati(prev => prev.filter(x => x !== s))}
                  className="ml-1 hover:bg-muted rounded px-0.5"
                >×</button>
              </Badge>
            ))}
            {filtroWorks.map(w => (
              <Badge key={w} variant="secondary" className="flex items-center gap-1">
                Work: {w}
                <button
                  onClick={() => setFiltroWorks(prev => prev.filter(x => x !== w))}
                  className="ml-1 hover:bg-muted rounded px-0.5"
                >×</button>
              </Badge>
            ))}
            {filtroDestinazioni.map(d => (
              <Badge key={d} variant="secondary" className="flex items-center gap-1">
                Dest.: {d}
                <button
                  onClick={() => setFiltroDestinazioni(prev => prev.filter(x => x !== d))}
                  className="ml-1 hover:bg-muted rounded px-0.5"
                >×</button>
              </Badge>
            ))}
            {filtroMetodi.map(id => (
              <Badge key={id} variant="secondary" className="flex items-center gap-1">
                Metodo: {metodi.find(m => m.id === id)?.nome ?? id}
                <button
                  onClick={() => setFiltroMetodi(prev => prev.filter(x => x !== id))}
                  className="ml-1 hover:bg-muted rounded px-0.5"
                >×</button>
              </Badge>
            ))}
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFiltroStati([])
                setFiltroWorks([])
                setFiltroDestinazioni([])
                setFiltroMetodi([])
              }}
            >
              Rimuovi tutti
            </button>
          </div>
        )}

        {/* Riga 3: toggle checkbox */}
        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostraDismessi}
              onChange={e => setMostraDismessi(e.target.checked)}
              className="rounded"
            />
            Mostra dismessi
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostraDaAprire}
              onChange={e => setMostraDaAprire(e.target.checked)}
              className="rounded"
            />
            Mostra da aprire
          </label>
        </div>
      </div>

      <CompostiStats
        stats={stats}
        onClickInScadenza={() => {
          if (filtroInScadenza) {
            setFiltroInScadenza(false)
          } else {
            setFiltroAttenzione(false)
            setFiltroStati([])
            setFiltroInScadenza(true)
          }
        }}
        onClickAttenzione={() => {
          if (filtroAttenzione) {
            setFiltroAttenzione(false)
          } else {
            setFiltroStati([])
            setFiltroInScadenza(false)
            setFiltroAttenzione(true)
          }
        }}
      />

      <CompostiTable
        data={filtered}
        onRowClick={row => { setPanelTab('dettaglio'); setPanelId(row.id) }}
        onNewLotto={handleNewLotto}
        onRivalida={handleRivalida}
        onDismetti={handleDismetti}
        onRefresh={load}
        onOpenStorico={handleOpenStorico}
        onOpenPreparazioni={handleOpenPreparazioni}
      />

      <CompostoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setTemplate(null) }}
        composto={editComposto}
        template={template}
        onSave={() => { load(); setTemplate(null) }}
      />
      <MixPesticidiForm open={mixOpen} onClose={() => setMixOpen(false)} onSave={load} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onSave={load} />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filteredIds={filtered.map((c: any) => c.id)}
      />
      <EtichetteDialog
        open={etichetteOpen}
        onClose={() => setEtichetteOpen(false)}
        filteredIds={filtered.map((c: any) => c.id)}
      />
      <CompostoPanel
        key={panelId ?? 'none'}
        compostoId={panelId}
        onClose={() => { setPanelId(null); setPanelTab('dettaglio') }}
        onEdit={handleEdit}
        onDelete={handleRequestDelete}
        onNewLotto={handleNewLotto}
        onRefreshList={load}
        defaultTab={panelTab}
      />
      <StoriaDialog
        open={storiaTarget !== null}
        onOpenChange={v => !v && setStoriaTarget(null)}
        compostoId={storiaTarget?.id ?? null}
        compostoNome={storiaTarget?.nome}
        tipo={storiaTarget?.tipo ?? ''}
        onSaved={() => { load(); setStoriaTarget(null) }}
      />
      <ConfirmDialog
        open={deleteId !== null}
        title="Elimina composto"
        message={
          deleteMixInfo && deleteMixInfo.lotto && deleteMixInfo.count > 1
            ? `Questo composto fa parte di un mix (lotto: ${deleteMixInfo.lotto}). Verranno eliminati ${deleteMixInfo.count} composti con tutti i dati correlati. Continuare?`
            : 'Eliminare questo composto e tutti i dati correlati (preparazioni, storia, associazioni metodi)?'
        }
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteId(null); setDeleteMixInfo(null) }}
      />
    </div>
  )
}