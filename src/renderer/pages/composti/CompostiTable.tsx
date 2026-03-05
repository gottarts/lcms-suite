import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge, computeStato } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface CompostiTableProps {
  data: any[]
  onRowClick: (row: any) => void
}

export function CompostiTable({ data, onRowClick }: CompostiTableProps) {
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
  ]

  return <DataTable columns={columns} data={data} onRowClick={onRowClick} emptyMessage="Nessun composto trovato" />
}
