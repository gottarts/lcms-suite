import { useState, useEffect } from 'react'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Trash2, Archive, FlaskConical, ChevronDown, ChevronUp, AlertCircle, ExternalLink } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { workApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { getCompsFromWork } from '../metodi/SchemaCalibrazione.logic'
import type { WorkInSchema, SorgenteSel, Ingrediente, CrmItem } from '../metodi/SchemaCalibrazione.types'
import { C } from '../metodi/SchemaCalibrazione.types'

interface WorkDrawerProps {
  workId: number | null
  onClose: () => void
  onEdit: (work: any) => void
  onDelete: (id: number) => void
  onArchivia?: (id: number) => void
  onVaiASchema?: (metodoId: string) => void
  metodiNomi?: Record<string, string>
}

const STATO_LAB_BADGE: Record<string, { label: string; className: string }> = {
  attiva:        { label: 'Attiva',        className: 'border-green-300 text-green-700 bg-green-50' },
  in_scadenza:   { label: 'In scadenza',   className: 'border-amber-400 text-amber-700 bg-amber-50' },
  scaduta:       { label: 'Scaduta',       className: 'border-red-300 text-red-700 bg-red-50' },
  non_preparata: { label: 'Non preparata', className: 'text-muted-foreground' },
}

function scadenzaDate(dataPrepISO: string, validita_mesi: number): string {
  const d = new Date(dataPrepISO)
  d.setDate(d.getDate() + Math.round(validita_mesi * 30.44))
  return d.toISOString().slice(0, 10)
}

// ── Ricostruzione WorkInSchema da record DB ──────────────────────────────────

function buildCrmItems(allDbWorks: Map<number, any>): CrmItem[] {
  const map = new Map<number, CrmItem>()
  for (const dbW of allDbWorks.values()) {
    for (const ing of dbW.ingredienti ?? []) {
      if (ing.source_type === 'crm' && !map.has(ing.source_id)) {
        map.set(ing.source_id, {
          id:                   ing.source_id,
          nome:                 ing.source_nome ?? '',
          mix_id:               ing.source_mix_id ?? null,
          mix:                  ing.source_mix_nome ?? null,
          concentrazione:       ing.source_cv ?? null,
          unita_conc:           ing.source_unita_conc ?? 'mg/L',
          forma:                null,
          lotto:                ing.source_lotto ?? null,
          produttore:           null,
          scadenza_prodotto:    null,
          ultima_rivalidazione: null,
          cv:                   ing.source_cv ?? 0,
          concVariabile:        false, // calcolato sotto
          isIS:                 false,
        })
      }
    }
  }
  // Imposta concVariabile per mix con componenti a cv diversi
  const mixCvSets = new Map<string, Set<number>>()
  for (const item of map.values()) {
    if (item.mix_id) {
      const s = mixCvSets.get(item.mix_id) ?? new Set<number>()
      s.add(item.cv)
      mixCvSets.set(item.mix_id, s)
    }
  }
  return Array.from(map.values()).map(item => ({
    ...item,
    concVariabile: item.mix_id ? (mixCvSets.get(item.mix_id)?.size ?? 0) > 1 : false,
  }))
}

const buildWorkSchemaCache = new Map<number, WorkInSchema>()

function buildWorkSchema(dbWork: any, allDbWorks: Map<number, any>): WorkInSchema {
  if (buildWorkSchemaCache.has(dbWork.id)) return buildWorkSchemaCache.get(dbWork.id)!

  const srcs: SorgenteSel[] = []
  const vols: Ingrediente[] = []
  const seenMix = new Set<string>()

  for (const ing of dbWork.ingredienti ?? []) {
    if (ing.source_type === 'crm') {
      if (ing.source_mix_id) {
        if (seenMix.has(ing.source_mix_id)) continue
        seenMix.add(ing.source_mix_id)
        // Calcola concVariabile per questo mix
        const mixComps = (dbWork.ingredienti as any[]).filter(
          (i: any) => i.source_type === 'crm' && i.source_mix_id === ing.source_mix_id
        )
        const cvSet = new Set(mixComps.map((i: any) => i.source_cv ?? 0))
        srcs.push({
          id:           ing.source_mix_id,
          nome:         ing.source_mix_nome ?? ing.source_nome ?? '',
          cv:           ing.source_cv ?? 0,
          tipo:         'mix',
          concVariabile: cvSet.size > 1,
        })
        vols.push({
          nome:       ing.source_mix_nome ?? ing.source_nome ?? '',
          vol:        ing.volume_prelievo_ml ?? 0,
          concTarget: ing.conc_target_mgL ?? undefined,
          dilFactor:  ing.fattore_diluizione ?? undefined,
          modo:       ing.modo_calcolo ?? 'conc',
        })
      } else {
        srcs.push({
          id:           String(ing.source_id),
          nome:         ing.source_nome ?? '',
          cv:           ing.source_cv ?? 0,
          tipo:         'sng',
          concVariabile: false,
        })
        vols.push({
          nome:       ing.source_nome ?? '',
          vol:        ing.volume_prelievo_ml ?? 0,
          concTarget: ing.conc_target_mgL ?? undefined,
          dilFactor:  ing.fattore_diluizione ?? undefined,
          modo:       ing.modo_calcolo ?? 'conc',
        })
      }
    } else if (ing.source_type === 'work') {
      const srcDbWork = allDbWorks.get(ing.source_id)
      if (!srcDbWork) continue
      const srcWis = buildWorkSchema(srcDbWork, allDbWorks)
      srcs.push({
        id:    srcWis.id,
        nome:  srcWis.nome,
        cv:    srcWis.concVariabile ? 0 : (srcWis.conc ?? 0),
        tipo:  'work',
        colSrc: 0,
      })
      vols.push({
        nome:       srcWis.nome,
        vol:        ing.volume_prelievo_ml ?? 0,
        concTarget: ing.conc_target_mgL ?? undefined,
        dilFactor:  ing.fattore_diluizione ?? undefined,
        modo:       ing.modo_calcolo ?? 'conc',
      })
    }
  }

  const wis: WorkInSchema = {
    id:           String(dbWork.id),
    dbId:         dbWork.id,
    nome:         dbWork.nome,
    conc:         dbWork.concentrazione,
    concVariabile: !!dbWork.conc_variabile,
    unitaConc:    dbWork.unita_conc ?? 'mg/L',
    volFin:       dbWork.volume_ml ?? 0,
    solv:         dbWork.solvente ?? '',
    validitaMesi: dbWork.validita_mesi,
    op:           dbWork.operatore ?? '',
    srcs,
    vols,
  }
  buildWorkSchemaCache.set(dbWork.id, wis)
  return wis
}

// ── Componente principale ────────────────────────────────────────────────────

export function WorkDrawer({ workId, onClose, onEdit, onDelete, onArchivia, onVaiASchema, metodiNomi }: WorkDrawerProps) {
  const [work, setWork]           = useState<any>(null)
  const [workChain, setWorkChain] = useState<Map<number, any>>(new Map())
  const [storico, setStorico]     = useState<any[]>([])
  const [storicoOpen, setStoricoOpen] = useState(false)
  const [prepForm, setPrepForm]   = useState(false)
  const [prepData, setPrepData]   = useState('')
  const [prepNote, setPrepNote]   = useState('')
  const [prepOp,   setPrepOp]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [compSearch, setCompSearch] = useState('')

  async function loadChain(id: number, map: Map<number, any>) {
    if (map.has(id)) return
    const w = await workApi.get(id)
    if (!w) return
    map.set(id, w)
    for (const ing of w.ingredienti ?? []) {
      if (ing.source_type === 'work') await loadChain(ing.source_id, map)
    }
  }

  const reload = async (id: number) => {
    buildWorkSchemaCache.clear()
    const map = new Map<number, any>()
    await loadChain(id, map)
    setWorkChain(map)
    setWork(map.get(id) ?? null)
  }

  useEffect(() => {
    if (workId) {
      reload(workId)
      setStorico([])
      setStoricoOpen(false)
      setPrepForm(false)
      setPrepData(new Date().toISOString().slice(0, 10))
      setPrepNote('')
      setPrepOp('')
      setCompSearch('')
    } else {
      setWork(null)
      setWorkChain(new Map())
    }
  }, [workId])

  const loadStorico = async () => {
    if (!workId) return
    const data = await workApi.preparazioniList(workId)
    setStorico(data)
    setStoricoOpen(true)
  }

  const handlePrepara = async () => {
    if (!workId || !prepData || !prepOp.trim()) return
    setSaving(true)
    await workApi.prepara({ work_id: workId, data_prep: prepData, note: prepNote || null, operatore: prepOp.trim() })
    await reload(workId)
    setPrepForm(false)
    setPrepNote('')
    setPrepOp('')
    if (storicoOpen) await loadStorico()
    setSaving(false)
  }

  if (!work) return null

  const isTracciata  = !!work.validita_mesi
  const isIntermedia = (work.livello ?? 0) > 0
  const isBloccata   = !!work.bloccata
  const statoLab     = work.stato_lab as string | null | undefined
  const statoBadge   = statoLab ? STATO_LAB_BADGE[statoLab] : null

  // ── Costruzione WorkInSchema ─────────────────────────────────────────────
  buildWorkSchemaCache.clear()
  const crmItems   = buildCrmItems(workChain)
  const workSchema = buildWorkSchema(work, workChain)
  const workCols: WorkInSchema[][] = [Array.from(workChain.keys()).map(id => {
    const dbW = workChain.get(id)!
    return buildWorkSchema(dbW, workChain)
  })]

  const usedVol = workSchema.vols.reduce((a, v) => a + v.vol, 0)
  const solvVol = Math.max(0, workSchema.volFin - usedVol)
  const neg     = usedVol > workSchema.volFin
  const allComps = getCompsFromWork(workSchema, workCols, crmItems)
  const comps    = compSearch
    ? allComps.filter(c => c.nome.toLowerCase().includes(compSearch.toLowerCase()))
    : allComps

  const col = isIntermedia ? C.inter : C.work

  // ── ChainNode ────────────────────────────────────────────────────────────
  function ChainNode({ w, ci, depth = 0 }: { w: WorkInSchema; ci: number; depth?: number }) {
    const c = ci > 0 ? C.inter : C.work
    return (
      <>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11,
                      paddingLeft: depth * 16 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                        background:c.border }} />
          <div>
            <div style={{ fontFamily:'IBM Plex Mono, monospace' }}>{w.nome}</div>
            <div style={{ fontSize:10, color:C.page.th }}>
              {w.conc ? `${w.conc} mg/L` : ''}{w.volFin ? ` · ${w.volFin} mL` : ''}
            </div>
          </div>
        </div>
        {w.srcs.map(src => {
          if (src.tipo === 'work') {
            let srcWork: WorkInSchema | undefined
            for (const col2 of workCols) { srcWork = col2.find(x => x.id === src.id); if (srcWork) break }
            if (srcWork) {
              const srcCi = workCols.findIndex(col2 => col2.some(x => x.id === src.id))
              return (
                <div key={src.id}>
                  <div style={{ width:1, height:10, background:C.page.brd,
                                marginLeft: depth * 16 + 3 }} />
                  <ChainNode w={srcWork} ci={srcCi} depth={depth + 1} />
                </div>
              )
            }
          }
          return (
            <div key={src.id}>
              <div style={{ width:1, height:10, background:C.page.brd,
                            marginLeft: depth * 16 + 3 }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11,
                            paddingLeft:(depth + 1) * 16 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                              background: src.tipo === 'mix' ? C.mix.border : C.sng.border }} />
                <div>
                  <div style={{ fontFamily:'IBM Plex Mono, monospace' }}>{src.nome}</div>
                  {src.tipo === 'mix' && (() => {
                    const lotto = crmItems.find(c => c.mix_id === src.id)?.lotto
                    return lotto
                      ? <div style={{ fontSize:9, color:C.page.t2,
                                      fontFamily:'IBM Plex Mono, monospace' }}>{lotto}</div>
                      : null
                  })()}
                  <div style={{ fontSize:10, color:C.page.th }}>
                    {src.concVariabile ? (
                      <>
                        <span style={{ fontStyle:'italic' }}>variabile</span>
                        {(() => {
                          const mixComps = crmItems.filter(c => c.mix_id === src.id)
                          if (mixComps.length === 0) return null
                          const tip = mixComps.map(c => `${c.nome} · ${c.cv} ${c.unita_conc}`).join('\n')
                          return (
                            <span title={tip} style={{ marginLeft:4, cursor:'help', opacity:0.6 }}>ⓘ</span>
                          )
                        })()}
                        {' · CRM'}
                      </>
                    ) : (
                      `${src.cv} mg/L · CRM`
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  const Field = ({ label, value }: { label: string; value?: string | number | null }) => {
    if (value == null || value === '') return null
    return (
      <div className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right">{String(value)}</span>
      </div>
    )
  }

  return (
    <SlidePanel
      open={!!workId}
      onClose={onClose}
      title={work.nome}
      subtitle={isIntermedia ? 'Work Intermedia' : 'Work Solution'}
      width="460px"
    >
      <div className="space-y-4">

        {/* Azioni */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => onEdit(work)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(work.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
          </Button>
          {onArchivia && (
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => onArchivia(work.id)}>
              <Archive className="h-3.5 w-3.5 mr-1" /> Archivia
            </Button>
          )}
        </div>

        {/* Metodi associati */}
        {work.metodi_ids && work.metodi_ids.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Metodi associati ({work.metodi_ids.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {work.metodi_ids.map((mid: string) => (
                <Badge key={mid} variant="outline" className="text-xs">
                  {metodiNomi?.[mid] ?? mid}
                </Badge>
              ))}
            </div>
          </>
        )}

        {/* Banner bloccata */}
        {isBloccata && (
          <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Uno o più CRM sono stati dismessi. Aggiorna i lotti nello Schema.</span>
            </div>
            {onVaiASchema && work.metodi_ids?.length > 0 && (
              work.metodi_ids.length === 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-400 text-orange-800 hover:bg-orange-100 h-7 text-xs w-full"
                  onClick={() => onVaiASchema(work.metodi_ids[0])}
                >
                  Vai allo Schema ↗
                </Button>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-xs opacity-70">Scegli il metodo:</div>
                  {(work.metodi_ids as string[]).map((mid: string) => (
                    <Button
                      key={mid}
                      size="sm"
                      variant="outline"
                      className="border-orange-400 text-orange-800 hover:bg-orange-100 h-7 text-xs w-full"
                      onClick={() => onVaiASchema(mid)}
                    >
                      {metodiNomi?.[mid] ?? mid} ↗
                    </Button>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Banner CRM scaduti (warning, non blocco) */}
        {!isBloccata && !!work.ha_crm_scaduti && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1.5">
                <span>Uno o più CRM usati in questa work risultano scaduti. Verifica lo stato nel DB Composti.</span>
                {onVaiASchema && work.metodi_ids && work.metodi_ids.length > 0 && (
                  work.metodi_ids.length === 1 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start h-7 text-xs border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                      onClick={() => onVaiASchema(work.metodi_ids[0])}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Vai a schema
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="self-start h-7 text-xs border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" /> Vai a schema
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {work.metodi_ids.map((mid: string) => (
                          <DropdownMenuItem key={mid} onClick={() => onVaiASchema(mid)}>
                            {metodiNomi?.[mid] ?? mid}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Badge stato */}
        <div className="flex gap-2 flex-wrap">
          {isIntermedia && (
            <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
              Intermedia liv. {work.livello}
            </Badge>
          )}
          {isTracciata ? (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
              Tracciata · valida {work.validita_mesi} mesi
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Al momento — non tracciata
            </Badge>
          )}
          {statoBadge && (
            <Badge variant="outline" className={statoBadge.className}>
              {statoBadge.label}
            </Badge>
          )}
        </div>

        {/* Sezione Preparazione (solo work tracciate) */}
        {isTracciata && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <FlaskConical className="h-3.5 w-3.5" /> Preparazione in laboratorio
            </div>

            {work.ultima_preparazione ? (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Ultima: {formatDate(work.ultima_preparazione.data_prep)}
                  </span>
                  {statoBadge && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statoBadge.className}`}>
                      {statoBadge.label}
                    </Badge>
                  )}
                </div>
                {work.validita_mesi && (
                  <div className="text-xs text-muted-foreground">
                    Scade il: {formatDate(scadenzaDate(work.ultima_preparazione.data_prep, work.validita_mesi))}
                  </div>
                )}
                {work.ultima_preparazione.operatore && (
                  <div className="text-xs text-muted-foreground">Op: {work.ultima_preparazione.operatore}</div>
                )}
                {work.ultima_preparazione.note && (
                  <div className="text-xs text-muted-foreground italic">{work.ultima_preparazione.note}</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna preparazione registrata.</p>
            )}

            {/* Form registrazione */}
            {prepForm ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Nuova preparazione</div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12 shrink-0">Data</label>
                  <input
                    type="date"
                    value={prepData}
                    onChange={e => setPrepData(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12 shrink-0">Operatore *</label>
                  <input
                    type="text"
                    value={prepOp}
                    onChange={e => setPrepOp(e.target.value)}
                    placeholder="es. V.G."
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs text-muted-foreground w-12 shrink-0 pt-1.5">Note</label>
                  <Textarea
                    value={prepNote}
                    onChange={e => setPrepNote(e.target.value)}
                    placeholder="Opzionale..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handlePrepara} disabled={saving || !prepData || !prepOp.trim()}>
                    {saving ? 'Salvo...' : 'Registra'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPrepForm(false)}>Annulla</Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setPrepData(new Date().toISOString().slice(0, 10)); setPrepForm(true) }}
                disabled={isBloccata}
                title={isBloccata ? 'Work bloccata: uno o più CRM sono stati dismessi' : undefined}
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1" />
                {work.ultima_preparazione ? 'Rinnova preparazione' : 'Registra preparazione'}
              </Button>
            )}

            {/* Storico */}
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={async () => {
                if (storicoOpen) { setStoricoOpen(false) } else { await loadStorico() }
              }}
            >
              {storicoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Storico preparazioni
            </button>
            {storicoOpen && storico.length > 0 && (
              <div className="space-y-1">
                {storico.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground border-b pb-1 last:border-0">
                    <span>{formatDate(p.data_prep)}{p.operatore ? ` · ${p.operatore}` : ''}</span>
                    {p.note && <span className="italic truncate max-w-[160px]">{p.note}</span>}
                  </div>
                ))}
              </div>
            )}
            {storicoOpen && storico.length === 0 && (
              <p className="text-xs text-muted-foreground">Nessuna preparazione nello storico.</p>
            )}
          </>
        )}

        <Separator />

        {/* Dettagli */}
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dettagli</div>

        {work.conc_variabile ? (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Concentrazione</span>
            <span className="italic text-muted-foreground">variabile</span>
          </div>
        ) : (
          <Field
            label="Concentrazione"
            value={work.concentrazione != null ? `${work.concentrazione} ${work.unita_conc ?? 'mg/L'}` : null}
          />
        )}
        <Field label="Volume finale" value={work.volume_ml != null ? `${work.volume_ml} mL` : null} />
        <Field label="Solvente" value={work.solvente} />
        <Field label="Validità" value={isTracciata ? `${work.validita_mesi} mesi` : 'Al momento'} />
        <Field label="Operatore" value={work.operatore} />
        {work.note && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note</div>
            <p className="text-sm whitespace-pre-wrap">{work.note}</p>
          </>
        )}

        {/* Tabella volumi */}
        {workSchema.vols.length > 0 && (
          <>
            <Separator />
            <div style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em',
                          marginBottom:6 }}>Volumi di prelievo</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['Sorgente', 'Diluizione', 'Preleva (mL)'].map(h => (
                    <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:700,
                                        color:C.page.th, textTransform:'uppercase',
                                        letterSpacing:'0.06em', padding:'3px 6px',
                                        borderBottom:`1px solid ${C.page.brd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workSchema.vols.map((v, i) => (
                  <tr key={i} style={{ background:col.bg }}>
                    <td style={{ padding:'4px 6px', fontFamily:'IBM Plex Mono, monospace',
                                  fontSize:11, borderBottom:`1px solid rgba(0,0,0,.04)` }}>
                      {v.nome}
                    </td>
                    <td style={{ padding:'4px 6px', fontFamily:'IBM Plex Mono, monospace',
                                  fontSize:11, borderBottom:`1px solid rgba(0,0,0,.04)` }}>
                      {v.dilFactor ? `÷${v.dilFactor}` : (v.concTarget ? `${v.concTarget} mg/L` : '—')}
                    </td>
                    <td style={{ padding:'4px 6px', fontFamily:'IBM Plex Mono, monospace',
                                  fontSize:11, fontWeight:700,
                                  borderBottom:`1px solid rgba(0,0,0,.04)` }}>
                      {v.vol.toFixed(3)}
                    </td>
                  </tr>
                ))}
                {/* Riga solvente / warning */}
                <tr style={{ color:neg ? '#a32d2d' : C.page.th, fontStyle:'italic' }}>
                  {neg ? (
                    <td colSpan={2} style={{ padding:'4px 6px', fontSize:11,
                                             fontWeight:700, fontStyle:'normal',
                                             fontFamily:'IBM Plex Mono, monospace' }}>
                      ⚠ Prelievi ({usedVol.toFixed(3)} mL) superano il volume finale
                    </td>
                  ) : (
                    <>
                      <td style={{ padding:'4px 6px', fontSize:11,
                                   fontFamily:'IBM Plex Mono, monospace' }}>
                        {workSchema.solv || 'Solvente'} (completamento)
                      </td>
                      <td style={{ padding:'4px 6px', fontSize:11,
                                   fontFamily:'IBM Plex Mono, monospace' }}>—</td>
                    </>
                  )}
                  <td style={{ padding:'4px 6px', fontSize:11,
                               fontFamily:'IBM Plex Mono, monospace',
                               color: neg ? '#a32d2d' : C.page.th }}>
                    {neg ? '—' : solvVol.toFixed(3)}
                  </td>
                </tr>
                {/* Riga totale */}
                <tr style={{ fontWeight:700, borderTop:`2px solid ${C.page.brd}`,
                             color: neg ? '#a32d2d' : undefined }}>
                  <td style={{ padding:'4px 6px', fontSize:11,
                               fontFamily:'IBM Plex Mono, monospace' }}>Totale prelievi</td>
                  <td />
                  <td style={{ padding:'4px 6px', fontSize:11,
                               fontFamily:'IBM Plex Mono, monospace' }}>
                    {usedVol.toFixed(3)}
                  </td>
                </tr>
                {!neg && (
                  <tr style={{ fontWeight:700 }}>
                    <td style={{ padding:'4px 6px', fontSize:11,
                                 fontFamily:'IBM Plex Mono, monospace' }}>Volume finale</td>
                    <td />
                    <td style={{ padding:'4px 6px', fontSize:11,
                                 fontFamily:'IBM Plex Mono, monospace' }}>
                      {workSchema.volFin.toFixed(3)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Catena tracciabilità */}
        {workSchema.srcs.length > 0 && (
          <>
            <Separator />
            <div style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em',
                          marginBottom:6 }}>Catena di tracciabilità</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <ChainNode w={workSchema} ci={isIntermedia ? 1 : 0} />
            </div>
          </>
        )}

        {/* Lista composti */}
        {workSchema.srcs.length > 0 && (
          <>
            <Separator />
            <div style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em',
                          marginBottom:6 }}>
              Composti ({allComps.length})
            </div>
            <input
              placeholder="Filtra composti..."
              value={compSearch}
              onChange={e => setCompSearch(e.target.value)}
              style={{
                width:'100%', padding:'6px 9px',
                border:`1px solid ${C.page.brd}`,
                borderRadius:8, fontSize:12, fontFamily:'Lato, sans-serif',
                outline:'none',
                background:'hsl(var(--background))',
                color:'hsl(var(--foreground))',
                marginBottom:8,
              }}
            />
            {comps.length === 0 ? (
              <div style={{ fontSize:11, color:C.page.th, fontStyle:'italic' }}>
                {compSearch ? 'Nessun composto corrisponde al filtro' : 'Nessun composto trovato'}
              </div>
            ) : comps.map((c, i) => (
              <div key={i} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'5px 8px', borderBottom:`1px solid rgba(0,0,0,.04)`,
                fontSize:11,
              }}>
                <div>
                  <div style={{ fontWeight:500, color:C.page.t1 }}>{c.nome}</div>
                  <div style={{ fontSize:10, color:C.page.th,
                                fontFamily:'IBM Plex Mono, monospace' }}>{c.srcPath}</div>
                </div>
                <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11,
                              color:C.page.t2, fontWeight:500 }}>
                  {c.concInWork.toFixed(4)} {c.unita}
                </div>
              </div>
            ))}
          </>
        )}


      </div>
    </SlidePanel>
  )
}
