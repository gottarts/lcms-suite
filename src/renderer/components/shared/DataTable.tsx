import { useState, useMemo, useRef, useEffect, useCallback, memo, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Input filtro con stato locale per evitare perdita di focus.
 * L'input mantiene il proprio stato interno e sincronizza verso l'alto onChange,
 * così React non ricrea il DOM element ad ogni keystroke.
 */
const ColumnFilterInput = memo(function ColumnFilterInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sincronizza se il valore esterno cambia (es. reset filtri)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalValue(v)
    onChange(v)
  }, [onChange])

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder="Filtra..."
      className="w-full h-6 px-1.5 text-xs rounded border border-input bg-background
                 text-foreground placeholder:text-muted-foreground focus:outline-none
                 focus:ring-1 focus:ring-ring font-normal"
    />
  )
})

// Altezza fissa di ogni riga in px.
// TableCell ha padding p-2 (8px top + 8px bottom) + ~20px testo = ~36px.
// Impostato a 41 per includere il border-b di TableRow.
// Se le righe appaiono schiacciate o con gap, aggiusta questo valore.
const ROW_HEIGHT = 41

// Soglia: sotto questa quantità di righe non si virtualizza
// (overhead non vale per liste corte)
const VIRTUALIZE_THRESHOLD = 50

export interface Column<T> {
  key: string
  label: string
  render?: (value: unknown, row: T) => ReactNode
  sortable?: boolean
  className?: string
  // Filtro per colonna — opzionale
  filterValue?: string
  onFilterChange?: (value: string) => void
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  rowClassName?: (row: T) => string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'Nessun elemento',
  rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(null)
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = String(av).localeCompare(String(bv), 'it', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  // Il ref va sul contenitore scrollabile
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

  // Determina se almeno una colonna ha il filtro per colonna attivo
  const hasColFilters = columns.some(col => col.onFilterChange !== undefined)

  // Blocca la scelta virtualizzato/non-virtualizzato per evitare switch di branch
  // durante la digitazione nei filtri (che causerebbe perdita di focus).
  // Si aggiorna solo quando nessun filtro è attivo.
  const isFilterActive = columns.some(col => col.filterValue)
  const useVirtual = useRef(data.length >= VIRTUALIZE_THRESHOLD)
  if (!isFilterActive) {
    useVirtual.current = data.length >= VIRTUALIZE_THRESHOLD
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    )
  }

  // ─── Render dell'header di una singola colonna (riutilizzato nei due branch) ───
  const renderTh = (col: Column<T>, isNative: boolean) => {
    const sortable = col.sortable !== false

    if (isNative) {
      // Branch virtualizzato: <th> nativo
      return (
        <th
          key={col.key}
          className={cn(
            'px-2 text-left align-top font-medium text-muted-foreground',
            hasColFilters ? 'py-2' : 'h-10',
            sortable && 'cursor-pointer select-none',
            col.className
          )}
          onClick={() => sortable && handleSort(col.key)}
        >
          <div className="flex items-center gap-1">
            {col.label}
            {sortKey === col.key && (
              sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            )}
          </div>
          {col.onFilterChange && (
            <div onClick={e => e.stopPropagation()} className="mt-1">
              <ColumnFilterInput
                value={col.filterValue ?? ''}
                onChange={col.onFilterChange}
              />
            </div>
          )}
        </th>
      )
    } else {
      // Branch shadcn: <TableHead>
      return (
        <TableHead
          key={col.key}
          className={cn(
            sortable && 'cursor-pointer select-none',
            hasColFilters && 'align-top py-2',
            col.className
          )}
          onClick={() => sortable && handleSort(col.key)}
        >
          <div className="flex items-center gap-1">
            {col.label}
            {sortKey === col.key && (
              sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            )}
          </div>
          {col.onFilterChange && (
            <div onClick={e => e.stopPropagation()} className="mt-1">
              <ColumnFilterInput
                value={col.filterValue ?? ''}
                onChange={col.onFilterChange}
              />
            </div>
          )}
        </TableHead>
      )
    }
  }

  // Liste corte: rendering normale senza virtualizzazione
  if (!useVirtual.current) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => renderTh(col, false))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow
              key={i}
              className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#cbd5e1')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
            >
              {columns.map(col => (
                <TableCell key={col.key} className={col.className}>
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // Liste lunghe: virtualizzazione
  return (
    <div
      ref={scrollRef}
      className="relative w-full overflow-auto"
      style={{ maxHeight: '75vh' }}
    >
      <table className="w-full caption-bottom text-sm">
        <thead className="sticky top-0 z-10 bg-background [&_tr]:border-b">
          <tr>
            {columns.map(col => renderTh(col, true))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {paddingTop > 0 && (
            <tr style={{ height: paddingTop }}>
              <td colSpan={columns.length} />
            </tr>
          )}

          {virtualItems.map(virtualRow => {
            const row = sorted[virtualRow.index]
            return (
              <tr
                key={virtualRow.index}
                className={cn(
                  'border-b transition-colors',
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row)
                )}
                style={{ height: ROW_HEIGHT }}
                onClick={() => onRowClick?.(row)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#cbd5e1')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('p-2 align-middle', col.className)}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            )
          })}

          {paddingBottom > 0 && (
            <tr style={{ height: paddingBottom }}>
              <td colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}