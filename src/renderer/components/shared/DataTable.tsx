import { useState, useMemo, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  // Il ref va sul contenitore scrollabile — è il div wrappato da <Table> in table.tsx
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // righe extra renderizzate fuori viewport (sopra e sotto)
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Padding superiore e inferiore per simulare le righe non renderizzate
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    )
  }

  // Liste corte: rendering normale senza virtualizzazione
  if (sorted.length < VIRTUALIZE_THRESHOLD) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead
                key={col.key}
                className={cn(col.sortable !== false && 'cursor-pointer select-none', col.className)}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
            ))}
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

  // Liste lunghe: virtualizzazione con altezza fissa del contenitore
  // Il contenitore scrollabile ha altezza massima di 75vh per non occupare
  // tutto lo schermo. L'header della tabella è sticky grazie a `top-0`.
  return (
    <div
      ref={scrollRef}
      className="relative w-full overflow-auto"
      style={{ maxHeight: '75vh' }}
    >
      <table className="w-full caption-bottom text-sm">
        <thead className="sticky top-0 z-10 bg-background [&_tr]:border-b">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'h-10 px-2 text-left align-middle font-medium text-muted-foreground',
                  col.sortable !== false && 'cursor-pointer select-none',
                  col.className
                )}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {/* Riga di padding superiore — simula le righe sopra il viewport */}
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

          {/* Riga di padding inferiore — simula le righe sotto il viewport */}
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