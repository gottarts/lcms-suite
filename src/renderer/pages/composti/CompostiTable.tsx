import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge, computeStato } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Copy, RotateCcw, XCircle } from 'lucide-react'

interface CompostiTableProps {
  data: any[]
  onRowClick: (row: any) => void
  onNewLotto: (row: any) => void
  onRivalida: (row: any) => void
  onDismetti: (row: any) => void
}

export function CompostiTable({ data, onRowClick, onNewLotto, onRivalida, onDismetti }: CompostiTableProps) {
  const columns: Column<any>[] = [
    {
      key: 'nome',
      label: 'Nome',
      className: 'font-medium',
      render: (v, row) => (
        <span>
          {row.mix_id && <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">MIX</Badge>}
          {String(v)}
        </span>
      ),
    },
    { key: 'codice_interno', label: 'Codice' },
    { key: 'classe', label: 'Classe', render: (v) => v ? <Badge variant="outline" className="text-xs">{String(v)}</Badge> : '—' },
    { key: 'forma', label: 'Forma' },
    { key: 'produttore', label: 'Produttore' },
    { key: 'lotto', label: 'Lotto' },
    { key: 'scadenza_prodotto', label: 'Scadenza', render: (v) => formatDate(v as string) },
    {
      key: 'stato',
      label: 'Stato',
      sortable: false,
      render: (_, row) => <StatusBadge status={computeStato(row)} />,
    },
    {
      key: 'id',
      label: '',
      sortable: false,
      className: 'w-10',
      render: (_, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onRowClick(row)}>
              <Eye className="h-3.5 w-3.5 mr-2" /> Apri
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNewLotto(row)}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Nuovo lotto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRivalida(row)}>
              <RotateCcw className="h-3.5 w-3.5 mr-2" /> Rivalidazione
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDismetti(row)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="h-3.5 w-3.5 mr-2" /> Dismetti
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return <DataTable columns={columns} data={data} onRowClick={onRowClick} emptyMessage="Nessun composto trovato" />
}
