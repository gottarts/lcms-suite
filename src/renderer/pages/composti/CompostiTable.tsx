import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge, computeStato } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FialeSelector } from './FialeSelector'
import { ApriAperturaDialog } from './ApriAperturaDialog'
import { useState } from 'react'
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
  onRefresh: () => void
  onOpenStorico?: (row: any) => void
}

export function CompostiTable({ data, onRowClick, onNewLotto, onRivalida, onDismetti, onRefresh, onOpenStorico }: CompostiTableProps) {
  const [apriTarget, setApriTarget] = useState<{ compostoId: number; fialaNumero: number; nome: string } | null>(null)

  const columns: Column<any>[] = [
    {
      key: 'nome',
      label: 'Nome',
      className: 'font-medium',
      render: (v, row) => {
        const numeroFiale = parseInt(row.fiala) || 1
        const stato = computeStato(row)
        const isRivalidato = stato === 'rivalidato_attivo' || stato === 'rivalidato_in_scadenza' || stato === 'rivalidato_scaduto'
        return (
          <span className="flex items-center gap-2">
            <span>
              {row.mix_id && (
                <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">
                  MIX
                </Badge>
              )}
              {/* Tag RIVAL. — identico per stile a MIX ma arancione, compare solo se rivalidato oltre scadenza */}
              {isRivalidato && (
                <Badge className="mr-1.5 text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">
                  RIVAL.
                </Badge>
              )}
              {String(v)}
              {row.prep_attive_count > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">{row.prep_attive_count} prep.</Badge>
              )}
              {row.prep_scadute_count > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">⚠</Badge>
              )}
            </span>
            {numeroFiale > 1 && (
              <FialeSelector
                numeroFiale={numeroFiale}
                fialeAperte={row.fiale_aperte_count ?? 0}
                onApri={(fialaNumero) => setApriTarget({ compostoId: row.id, fialaNumero, nome: row.nome })}
              />
            )}
          </span>
        )
      },
    },
    { key: 'codice_interno', label: 'Codice' },
    { key: 'classe', label: 'Classe', render: (v) => v ? <Badge variant="outline" className="text-xs">{String(v)}</Badge> : '—' },
    { key: 'forma', label: 'Forma', render: (v, row) => row.mix_id ? 'Mix' : v },
    { key: 'produttore', label: 'Produttore' },
    { key: 'lotto', label: 'Lotto' },
    { key: 'scadenza_prodotto', label: 'Scadenza', render: (v) => formatDate(v as string) },
    {
      key: 'stato',
      label: 'Stato',
      sortable: false,
      render: (_, row) => {
        const stato = computeStato(row)
        const isRivalidato = stato === 'rivalidato_attivo' || stato === 'rivalidato_in_scadenza' || stato === 'rivalidato_scaduto'
        return (
          <div className="flex flex-col items-start gap-0.5">
            <StatusBadge status={stato} />
            {isRivalidato && (
              <button
                className="text-[10px] text-blue-500 hover:underline leading-tight"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenStorico?.(row)
                }}
              >
                Scadenza estesa — vedi storico
              </button>
            )}
          </div>
        )
      },
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

  return (
    <>
      <ApriAperturaDialog
        open={!!apriTarget}
        onOpenChange={(v) => { if (!v) setApriTarget(null) }}
        compostoId={apriTarget?.compostoId ?? null}
        compostoNome={apriTarget?.nome}
        fialaNumero={apriTarget?.fialaNumero ?? 1}
        onSaved={() => { setApriTarget(null); onRefresh() }}
      />
      <DataTable columns={columns} data={data} onRowClick={onRowClick} emptyMessage="Nessun composto trovato" />
    </>
  )
}