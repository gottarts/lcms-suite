import { memo, useMemo, useState, useRef, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge, computeStato, getCampiMancanti } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FialeSelector } from './FialeSelector'
import { ApriAperturaDialog } from './ApriAperturaDialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Copy, RotateCcw, XCircle, AlertTriangle } from 'lucide-react'

interface CompostiTableProps {
  data: any[]
  onRowClick: (row: any) => void
  onNewLotto: (row: any) => void
  onRivalida: (row: any) => void
  onDismetti: (row: any) => void
  onRefresh: () => void
  onOpenStorico?: (row: any) => void
  onOpenPreparazioni?: (row: any) => void
  selectedIds?: Set<number>
  onSelectionChange?: (ids: Set<number>) => void
  // Visibilità colonne
  colVisible?: Record<string, boolean>
  // Ordine colonne
  colOrder?: string[]
  // Filtri per colonna
  colFilters?: Record<string, string>
  onColFilter?: (key: string, value: string) => void
}

export const CompostiTable = memo(function CompostiTable({
  data,
  onRowClick,
  onNewLotto,
  onRivalida,
  onDismetti,
  onRefresh,
  onOpenStorico,
  onOpenPreparazioni,
  selectedIds = new Set(),
  onSelectionChange,
  colVisible,
  colOrder,
  colFilters,
  onColFilter,
}: CompostiTableProps) {
  const [apriTarget, setApriTarget] = useState<{
    compostoId: number; fialaNumero: number; nome: string; lotto: string | null
  } | null>(null)

  const lastCheckedIndexRef = useRef<number>(-1)

  const handleCheckboxChange = useCallback((row: any, checked: boolean, shiftKey: boolean) => {
    const rowIndex = data.findIndex(r => r.id === row.id)
    const next = new Set(selectedIds)
    if (shiftKey && lastCheckedIndexRef.current >= 0) {
      const from = Math.min(lastCheckedIndexRef.current, rowIndex)
      const to   = Math.max(lastCheckedIndexRef.current, rowIndex)
      for (let i = from; i <= to; i++) { if (checked) next.add(data[i].id); else next.delete(data[i].id) }
    } else {
      if (checked) next.add(row.id); else next.delete(row.id)
    }
    lastCheckedIndexRef.current = rowIndex
    onSelectionChange?.(next)
  }, [data, selectedIds, onSelectionChange])

  const columns: Column<any>[] = useMemo(() => {
    // ── Tutte le colonne dati, senza __select__ e id (azioni) ────────────────
    const dataCols: Column<any>[] = [
      {
        key: 'nome', label: 'Nome', className: 'font-medium',
        filterValue: colFilters?.['nome'] ?? '',
        onFilterChange: onColFilter ? (v) => onColFilter('nome', v) : undefined,
        render: (v, row) => {
          const numeroFiale = parseInt(row.fiala) || 1
          const stato = computeStato(row)
          const isRivalidato = stato === 'rivalidato_attivo' || stato === 'rivalidato_in_scadenza' || stato === 'rivalidato_scaduto'
          const campiMancanti = getCampiMancanti(row)
          return (
            <span className="flex items-center gap-2">
              <span>
                {row.forma?.toLowerCase() === 'mix' && (
                  <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">MIX</Badge>
                )}
                {isRivalidato && (
                  <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">RIVAL.</Badge>
                )}
                {String(v)}
                {row.forma === 'Neat' && (
                  <Badge variant="outline" className="ml-2 text-xs cursor-pointer hover:bg-accent"
                    onClick={(e) => { e.stopPropagation(); onOpenPreparazioni?.(row) }}>
                    prep {row.prep_attive_count ?? 0}
                  </Badge>
                )}
                {row.prep_scadute_count > 0 && <Badge variant="destructive" className="ml-2 text-xs">⚠</Badge>}
              </span>
              {numeroFiale > 1 && (
                <FialeSelector numeroFiale={numeroFiale} fialeAperte={row.fiale_aperte_count ?? 0}
                  onApri={(fialaNumero) => setApriTarget({ compostoId: row.id, fialaNumero, nome: row.nome, lotto: row.lotto ?? null })} />
              )}
              {campiMancanti.length > 0 && (
                <span title={`Campi mancanti: ${campiMancanti.join(', ')}`}
                  className="inline-flex items-center text-amber-500 shrink-0" onClick={e => e.stopPropagation()}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              )}
            </span>
          )
        },
      },
      { key: 'codice_interno', label: 'Codice', filterValue: colFilters?.['codice_interno'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('codice_interno', v) : undefined },
      { key: 'classe', label: 'Classe', filterValue: colFilters?.['classe'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('classe', v) : undefined,
        render: (v) => v ? <Badge variant="outline" className="text-xs">{String(v)}</Badge> : '—' },
      { key: 'forma', label: 'Forma', filterValue: colFilters?.['forma'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('forma', v) : undefined, render: (v) => v || '—' },
      { key: 'produttore', label: 'Produttore', filterValue: colFilters?.['produttore'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('produttore', v) : undefined },
      { key: 'lotto', label: 'Lotto', filterValue: colFilters?.['lotto'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('lotto', v) : undefined },
      { key: 'scadenza_prodotto', label: 'Scadenza', render: (v) => formatDate(v as string) },
      { key: 'solvente', label: 'Solvente', filterValue: colFilters?.['solvente'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('solvente', v) : undefined, render: (v) => v || '—' },
      { key: 'ubicazione', label: 'Ubicazione', filterValue: colFilters?.['ubicazione'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('ubicazione', v) : undefined, render: (v) => v || '—' },
      { key: 'stoccaggio', label: 'Stoccaggio', filterValue: colFilters?.['stoccaggio'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('stoccaggio', v) : undefined, render: (v) => v || '—' },
      { key: 'accreditamento_crm', label: 'Accreditamento', filterValue: colFilters?.['accreditamento_crm'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('accreditamento_crm', v) : undefined, render: (v) => v || '—' },
      { key: 'work_standard', label: 'Work', filterValue: colFilters?.['work_standard'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('work_standard', v) : undefined, render: (v) => v || '—' },
      { key: 'destinazione_uso', label: 'Destinazione', filterValue: colFilters?.['destinazione_uso'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('destinazione_uso', v) : undefined, render: (v) => v || '—' },
      { key: 'forma_commerciale', label: 'Forma comm.', filterValue: colFilters?.['forma_commerciale'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('forma_commerciale', v) : undefined, render: (v) => v || '—' },
      { key: 'matrice', label: 'Matrice', filterValue: colFilters?.['matrice'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('matrice', v) : undefined, render: (v) => v || '—' },
      { key: 'mw', label: 'MW', render: (v) => v || '—' },
      { key: 'formula', label: 'Formula', filterValue: colFilters?.['formula'] ?? '', onFilterChange: onColFilter ? (v) => onColFilter('formula', v) : undefined, render: (v) => v || '—' },
      {
        key: 'stato', label: 'Stato', sortable: false,
        render: (_, row) => {
          const stato = computeStato(row)
          const isRivalidato = stato === 'rivalidato_attivo' || stato === 'rivalidato_in_scadenza' || stato === 'rivalidato_scaduto'
          return (
            <div className="flex flex-col items-start gap-0.5">
              <StatusBadge status={stato} />
              {isRivalidato && (
                <button className="text-[10px] text-blue-500 hover:underline leading-tight"
                  onClick={(e) => { e.stopPropagation(); onOpenStorico?.(row) }}>
                  Scadenza estesa — vedi storico
                </button>
              )}
            </div>
          )
        },
      },
    ]

    // ── Colonna checkbox — sempre prima ──────────────────────────────────────
    const selectCol: Column<any> = {
      key: '__select__', label: '', sortable: false, className: 'w-8 pr-0',
      render: (_: unknown, row: any) => (
        <div onClick={e => e.stopPropagation()}>
          <input type="checkbox" className="rounded cursor-pointer" checked={selectedIds.has(row.id)}
            onChange={(e) => handleCheckboxChange(row, e.target.checked, e.nativeEvent.shiftKey)} />
        </div>
      ),
    }

    // ── Colonna azioni — sempre ultima ───────────────────────────────────────
    const actionsCol: Column<any> = {
      key: 'id', label: '', sortable: false, className: 'w-10',
      render: (_, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onRowClick(row)}><Eye className="h-3.5 w-3.5 mr-2" /> Apri</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNewLotto(row)}><Copy className="h-3.5 w-3.5 mr-2" /> Nuovo lotto</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRivalida(row)}><RotateCcw className="h-3.5 w-3.5 mr-2" /> Rivalidazione</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDismetti(row)} className="text-destructive focus:text-destructive">
              <XCircle className="h-3.5 w-3.5 mr-2" /> Dismetti
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }

    // ── 1. Filtra per visibilità ─────────────────────────────────────────────
    const visibleDataCols = colVisible
      ? dataCols.filter(col => colVisible[col.key] !== false)
      : dataCols

    // ── 2. Riordina secondo colOrder ─────────────────────────────────────────
    let orderedDataCols = visibleDataCols
    if (colOrder && colOrder.length > 0) {
      const colMap = new Map(visibleDataCols.map(c => [c.key, c]))
      // Colonne nell'ordine voluto (solo quelle presenti e visibili)
      const ordered = colOrder.filter(k => colMap.has(k)).map(k => colMap.get(k)!)
      // Aggiunge eventuali colonne visibili non presenti in colOrder (sicurezza)
      const inOrder = new Set(colOrder)
      const extra = visibleDataCols.filter(c => !inOrder.has(c.key))
      orderedDataCols = [...ordered, ...extra]
    }

    // ── 3. Ricompone: checkbox | dati ordinati | azioni ──────────────────────
    return [selectCol, ...orderedDataCols, actionsCol]
  }, [
    onRowClick, onNewLotto, onRivalida, onDismetti, onOpenStorico, onOpenPreparazioni,
    selectedIds, onSelectionChange, handleCheckboxChange,
    colVisible, colOrder, colFilters, onColFilter,
  ])

  return (
    <>
      <ApriAperturaDialog
        open={!!apriTarget} onOpenChange={(v) => { if (!v) setApriTarget(null) }}
        compostoId={apriTarget?.compostoId ?? null} compostoNome={apriTarget?.nome}
        fialaNumero={apriTarget?.fialaNumero ?? 1} compostoLotto={apriTarget?.lotto}
        conteggioLotto={apriTarget?.lotto ? data.filter((c) => c.lotto === apriTarget.lotto).length : 0}
        onSaved={() => { setApriTarget(null); onRefresh() }}
      />
      <DataTable columns={columns} data={data} onRowClick={onRowClick}
        emptyMessage="Nessun composto trovato"
        rowClassName={(row) => computeStato(row) === 'dismesso' ? 'opacity-40 text-muted-foreground' : ''} />
    </>
  )
})