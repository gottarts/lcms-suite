import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { dashboardApi, metodiApi } from '@/lib/api'
import { buildAuditModel, type AuditModel, type AuditWorkRow, type AuditScopertoRow } from '../lib/auditModel'
import { exportAuditPdf } from '../lib/auditReport'
import type { StatoLab } from '../../../../shared/types'

const statoLabTone: Record<StatoLab, string> = {
  attiva:        'bg-green-50 text-green-800 border-green-300',
  in_scadenza:   'bg-amber-50 text-amber-800 border-amber-300',
  scaduta:       'bg-red-50 text-red-800 border-red-300',
  non_preparata: 'bg-slate-50 text-slate-700 border-slate-300',
}

const statoLabLabel: Record<StatoLab, string> = {
  attiva:        'Valida',
  in_scadenza:   'In scadenza',
  scaduta:       'Scaduta',
  non_preparata: 'Non preparata',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function WorkRowBlock({ row }: { row: AuditWorkRow }) {
  const stato = row.stato_work
  const navigate = useNavigate()
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <div className="font-medium text-sm flex-1 truncate">{row.work_nome}</div>
        {row.bloccata && (
          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">⛔ bloccata</Badge>
        )}
        {row.ha_crm_scaduti && !row.bloccata && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">⚠ CRM scaduti</Badge>
        )}
        {row.ha_prep_scadute_at_data && !row.bloccata && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">⚠ Prep Neat scadute</Badge>
        )}
        {stato && (
          <Badge variant="outline" className={statoLabTone[stato]}>{statoLabLabel[stato]}</Badge>
        )}
        {row.work_scadenza && (
          <span className="text-[11px] text-muted-foreground">scad. {row.work_scadenza}</span>
        )}
      </div>
      {row.analiti_coperti.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Nessun analita accreditato coperto da questo Work.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {row.analiti_coperti.map(a => (
            <div key={a.analita_id} className="px-3 py-2 text-xs flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{a.analita_nome}</div>
                {a.alias_strumento && (
                  <div className="text-[11px] text-muted-foreground">alias: {a.alias_strumento}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                {a.crm_ingredienti.length === 0 && (
                  <span className="text-[11px] text-muted-foreground italic">nessun CRM diretto</span>
                )}
                {a.crm_ingredienti.map(c => (
                  <Badge
                    key={c.composto_id}
                    variant="outline"
                    className={`cursor-pointer hover:opacity-75 transition-opacity ${c.prep_scaduta
                      ? 'bg-red-50 text-red-900 border-red-300 font-normal'
                      : 'bg-purple-50 text-purple-800 border-purple-200 font-normal'}`}
                    onClick={() => navigate('/composti', { state: { searchFilter: c.composto_nome } })}
                  >
                    <span className="flex flex-col gap-0">
                      <span>
                        {c.composto_nome}
                        {c.lotto && <span className="opacity-60 ml-1">· {c.lotto}</span>}
                        {c.scadenza_effettiva && <span className="opacity-60 ml-1">· scad. {c.scadenza_effettiva}</span>}
                      </span>
                      {c.prep_flacone != null && (
                        <span className={`text-[10px] ${c.prep_scaduta ? 'text-red-700' : 'opacity-70'}`}>
                          prep: {c.prep_flacone ?? '—'}
                          {c.prep_data_prep && <span className="ml-1">· {c.prep_data_prep}</span>}
                          {c.prep_scadenza && <span className="ml-1">· scad. {c.prep_scadenza}</span>}
                        </span>
                      )}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScopertoRowBlock({ row }: { row: AuditScopertoRow }) {
  const navigate = useNavigate()
  return (
    <div className="border border-red-200 rounded-md overflow-hidden bg-red-50/30">
      <div className="px-3 py-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-red-900">{row.analita_nome}</div>
          {row.alias_strumento && (
            <div className="text-[11px] text-muted-foreground">alias: {row.alias_strumento}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
          {row.crm_disponibili.length === 0 ? (
            <span className="text-[11px] text-red-800 italic">nessun CRM valido disponibile</span>
          ) : (
            row.crm_disponibili.map(c => (
              <Badge
                key={c.composto_id}
                variant="outline"
                className="bg-white text-red-800 border-red-200 font-normal cursor-pointer hover:opacity-75 transition-opacity"
                title={`scad. ${c.scadenza_effettiva ?? '—'}`}
                onClick={() => navigate('/composti', { state: { searchFilter: c.composto_nome } })}
              >
                {c.composto_nome}
                {c.lotto && <span className="opacity-60 ml-1">· {c.lotto}</span>}
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function AuditCrmSection() {
  const [metodi, setMetodi] = useState<any[]>([])
  const [metodoId, setMetodoId] = useState<string>('')
  const [data, setData] = useState<string>(today())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<AuditModel | null>(null)

  useEffect(() => {
    metodiApi.list()
      .then(rows => setMetodi(rows ?? []))
      .catch(err => setError(String(err?.message ?? err)))
  }, [])

  const handleRun = async () => {
    if (!metodoId) return
    setLoading(true)
    setError(null)
    try {
      const raw = await dashboardApi.auditCrm(metodoId, data)
      setModel(buildAuditModel(raw))
    } catch (err: any) {
      setError(String(err?.message ?? err))
      setModel(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit CRM</CardTitle>
        <CardDescription>
          Copertura analiti accreditati per metodo e data — Work registrati che coprono ogni analita
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="audit-metodo" className="text-xs">Metodo</Label>
            <Select value={metodoId} onValueChange={setMetodoId}>
              <SelectTrigger id="audit-metodo">
                <SelectValue placeholder="Seleziona metodo…" />
              </SelectTrigger>
              <SelectContent>
                {metodi.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}{m.nome ? ` — ${m.nome}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="audit-data" className="text-xs">Data audit</Label>
            <Input
              id="audit-data"
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <Button onClick={handleRun} disabled={!metodoId || loading}>
            {loading ? 'Analisi…' : 'Esegui audit'}
          </Button>
          {model && (
            <Button variant="outline" onClick={() => { setModel(null); setError(null) }}>
              Pulisci
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!model}
            onClick={() => model && exportAuditPdf(model)}
          >
            Esporta PDF
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">Errore: {error}</p>}

        {/* Risultati */}
        {model && (
          <div className="space-y-4">
            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border rounded-md p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Accreditati</div>
                <div className="text-lg font-heading font-bold">{model.stats.n_accreditati}</div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Coperti</div>
                <div className="text-lg font-heading font-bold text-green-700">{model.stats.n_coperti}</div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Scoperti</div>
                <div className={`text-lg font-heading font-bold ${model.stats.n_scoperti > 0 ? 'text-red-700' : ''}`}>
                  {model.stats.n_scoperti}
                </div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Work</div>
                <div className="text-lg font-heading font-bold">
                  {model.stats.n_works}
                  {(model.stats.n_work_scadute + model.stats.n_work_in_scadenza + model.stats.n_work_bloccate) > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({model.stats.n_work_scadute} scad. · {model.stats.n_work_in_scadenza} in scad. · {model.stats.n_work_bloccate} bloc.)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Work registrati */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Work registrati · {model.righe_work.length}
              </div>
              {model.righe_work.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nessun Work registrato per questo metodo.
                </p>
              ) : (
                <div className="space-y-2">
                  {model.righe_work.map(r => (
                    <WorkRowBlock key={r.work_id} row={r} />
                  ))}
                </div>
              )}
            </div>

            {/* Analiti scoperti */}
            {model.righe_scoperte.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-800 mb-2">
                  Analiti scoperti · {model.righe_scoperte.length}
                </div>
                <div className="space-y-2">
                  {model.righe_scoperte.map(r => (
                    <ScopertoRowBlock key={r.analita_id} row={r} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
