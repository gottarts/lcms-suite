// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.tsx  —  Parte 4 / 4  (componente principale)
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.tsx
//
// Contiene:
//   - ColonneWork         → colonne Work lv0 + Intermedie
//   - SchemaCalibrazione  → root (esporta default)
//
// DIPENDENZE (tutti nella stessa cartella):
//   - SchemaCalibrazione.types.ts
//   - SchemaCalibrazione.logic.ts
//   - SchemaCalibrazione.grid.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useRef, useLayoutEffect, useEffect, useMemo } from 'react'
import type {
  SorgenteSel, WorkInSchema, SchemaCalibrazioneProps, ConnectionLine, RegisterCardRef, DestUso
} from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import {
  useSchemaData, buildAnalitiData, targetColIdx,
  salvaWorkNelDb, computeConnections,
} from './SchemaCalibrazione.logic'
import { GrigliaAnalitiCrm, ModalCreaWork } from './SchemaCalibrazione.grid'
import { ScenarDialog } from './ScenarDialog'
import { AutoSelectDialog } from './AutoSelectDialog'
import { buildMixComposizioni, generaScenari } from './SchemaCalibrazione.scenari'
import { ImportaWorkDialog } from './ImportaWorkDialog'
import { schemaCalApi, workApi } from '../../lib/api'
import { RicaricaDialog } from '../work/RicaricaDialog'
import { WorkDrawer } from '../work/WorkDrawer'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

// ─────────────────────────────────────────────────────────────────────────────
// SVG Overlay per frecce di connessione
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionsOverlay({
  workCols, cardRefs, containerRef, gridScrollRef, workScrollRef,
}: {
  workCols: WorkInSchema[][]
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  containerRef: React.RefObject<HTMLDivElement | null>
  gridScrollRef?: React.RefObject<HTMLDivElement | null>
  workScrollRef?: React.RefObject<HTMLDivElement | null>
}) {
  const [lines, setLines] = useState<ConnectionLine[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      setSize({ w: el.scrollWidth, h: el.scrollHeight })
      setLines(computeConnections(workCols, cardRefs.current, el))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    const grid = gridScrollRef?.current
    if (grid) grid.addEventListener('scroll', update, { passive: true })
    const workWrap = workScrollRef?.current
    if (workWrap) workWrap.addEventListener('scroll', update, { passive: true, capture: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
      if (grid) grid.removeEventListener('scroll', update)
      if (workWrap) workWrap.removeEventListener('scroll', update, { capture: true })
    }
  }, [workCols, cardRefs, containerRef, gridScrollRef, workScrollRef])

  if (lines.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: size.w, height: size.h,
        pointerEvents: 'none', zIndex: 1,
      }}
    >
      <defs>
        {['mix', 'sng', 'work'].map(t => {
          const col = t === 'mix' ? C.mix.border : t === 'sng' ? C.sng.border : C.work.border
          return (
            <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 8" refX="9" refY="4"
              markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 4 L 0 8 z" fill={col} />
            </marker>
          )
        })}
      </defs>
      {lines.map((l, i) => {
        const dx = Math.abs(l.x2 - l.x1)
        const cpx = Math.max(30, dx * 0.4)
        const d = `M ${l.x1} ${l.y1} C ${l.x1 + cpx} ${l.y1}, ${l.x2 - cpx} ${l.y2}, ${l.x2} ${l.y2}`
        return (
          <path key={i} d={d}
            fill="none" stroke={l.color} strokeWidth={1.2}
            strokeDasharray="6 4" opacity={0.4}
            markerEnd={`url(#arrow-${l.sourceType})`}
          />
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Colonne Work dinamiche
// ─────────────────────────────────────────────────────────────────────────────
interface ColonneWorkProps {
  workCols: WorkInSchema[][]
  selSrcs: Map<string, SorgenteSel>
  onToggleWork: (w: WorkInSchema, colIdx: number) => void
  onDeleteWork: (colIdx: number, workIdx: number) => void
  onOpenDrawer: (w: WorkInSchema, colIdx: number) => void
  onAddCol: () => void
  registerCardRef: RegisterCardRef
  blockedMap: Map<number, { bloccata: boolean; haScaduti: boolean; haStockScadute: boolean }>
  onRicaricaWork: (dbId: number) => void
}

const ColonneWork = React.forwardRef<HTMLDivElement, ColonneWorkProps>(function ColonneWork({
  workCols, selSrcs,
  onToggleWork, onDeleteWork, onOpenDrawer, onAddCol, registerCardRef,
  blockedMap, onRicaricaWork,
}, ref) {
  return (
    <div ref={ref} style={{ display:'flex', flexDirection:'row', flexShrink:0,
                  margin:0, borderRadius:12, border:`1.5px dashed ${C.page.brd2}`,
                  position:'relative', background:C.page.sur,
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>

      {/* Label sezione */}
      <span style={{
        position:'absolute', top:-9, left:16, background:C.page.bg,
        padding:'0 8px', fontSize:9, fontWeight:600, color:C.page.th,
        textTransform:'uppercase', letterSpacing:'0.1em', zIndex:2,
      }}>Soluzioni Work</span>

      {workCols.map((works, ci) => {
        const isFirst = ci === 0
        const lbl  = isFirst ? 'Work' : `Intermedia ${ci}`
        const sub  = isFirst
          ? `${works.length} solution${works.length !== 1 ? 's' : ''}`
          : `livello ${ci}`

        return (
          <div key={ci} style={{
            width:270, flexShrink:0,
            borderRight:`1px solid ${C.page.brd}`,
            display:'flex', flexDirection:'column', overflow:'hidden',
          }}>
            {/* Header colonna */}
            <div style={{ padding:'9px 11px 7px', background:C.page.sur,
                          borderBottom:'1px solid rgba(0,0,0,0.06)', flexShrink:0 }}>
              <div style={{ fontSize:10, fontWeight:600, color:C.page.t2,
                            textTransform:'uppercase', letterSpacing:'0.08em' }}>{lbl}</div>
              <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                            fontFamily:'IBM Plex Mono, monospace' }}>{sub}</div>
            </div>

            {/* Corpo */}
            <div style={{ flex:1, overflowY:'auto', padding:8,
                          display:'flex', flexDirection:'column', gap:7 }}>
              {works.length === 0 && (
                <div style={{
                  border:`2px dashed ${C.page.brd}`, borderRadius:10,
                  padding:'18px 12px', textAlign:'center', color:C.page.th,
                  fontSize:11, lineHeight:1.6, background:'transparent',
                }}>
                  {isFirst
                    ? <>Seleziona CRM e clicca <strong>Crea Work</strong></>
                    : <>Clicca le card Work a sinistra, poi <strong>Crea Work</strong></>}
                </div>
              )}

              {works.map((w, wi) => {
                const isSel      = selSrcs.has(w.id)
                const stateEntry    = w.dbId ? (blockedMap.get(w.dbId) ?? null) : null
                const isBloccata    = stateEntry?.bloccata ?? false
                const haScaduti     = stateEntry?.haScaduti ?? false
                const haStockScadute = stateEntry?.haStockScadute ?? false
                const usedVol    = w.vols.reduce((a, v) => a + v.vol, 0)
                const solvVol    = Math.max(0, w.volFin - usedVol)
                const neg        = usedVol > w.volFin
                const isInter    = ci > 0
                const col        = isInter ? C.inter : C.work

                return (
                  <div
                    key={w.id}
                    ref={el => registerCardRef(w.id, el)}
                    onClick={() => onToggleWork(w, ci)}
                    style={{
                      borderRadius:10, padding:`8px 12px ${(isBloccata || haScaduti || haStockScadute) ? 28 : 8}px`, position:'relative',
                      background: isSel ? (isInter ? '#ddd4f5' : '#f5e8c8') : col.bg,
                      border:`1.5px solid ${col.border}`,
                      borderLeft:`3px solid ${col.border}`,
                      boxShadow: isSel
                        ? `0 0 0 3px rgba(155,134,214,.35)`
                        : '0 1px 2px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      outline: isSel ? `2px solid ${col.border}` : undefined,
                      outlineOffset: isSel ? 2 : undefined,
                      transition:'box-shadow .12s, background .1s',
                    }}
                  >
                    {/* Pulsante elimina */}
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteWork(ci, wi) }}
                      style={{
                        position:'absolute', top:7, right:7, width:17, height:17,
                        borderRadius:'50%', border:`1px solid ${C.page.brd}`,
                        background:C.page.sur, color:C.page.th, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11,
                      }}
                    >×</button>

                    {/* Pulsante dettaglio ⊙ */}
                    <button
                      onClick={e => { e.stopPropagation(); onOpenDrawer(w, ci) }}
                      style={{
                        position:'absolute', top:7, right:28, width:17, height:17,
                        borderRadius:'50%', border:`1px solid ${C.page.brd}`,
                        background:C.page.sur, color:C.page.th, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11,
                      }}
                      title="Dettaglio"
                    >⊙</button>

                    {/* Pulsante Ricarica (lotti dismessi o scaduti) */}
                    {(isBloccata || haScaduti || haStockScadute) && w.dbId && (
                      <button
                        onClick={e => { e.stopPropagation(); onRicaricaWork(w.dbId!) }}
                        style={{
                          position:'absolute', bottom:7, right:7,
                          padding:'1px 8px', borderRadius:4,
                          border: isBloccata ? '1px solid #fb923c' : '1px solid #d97706',
                          background: isBloccata ? '#fff7ed' : '#fffbeb',
                          color: isBloccata ? '#ea580c' : '#b45309',
                          cursor:'pointer', fontSize:9, fontWeight:700,
                        }}
                        title={isBloccata ? 'Lotti CRM dismessi — aggiorna la work' : haScaduti ? 'CRM scaduti — aggiorna la work' : 'Prep stock scadute — aggiorna la work'}
                      >Ricarica ↻</button>
                    )}

                    {/* Contenuto card */}
                    <div style={{ fontSize:12, fontWeight:700, color: isBloccata ? '#b45309' : col.text,
                                  paddingRight:40 }}>{w.nome}</div>
                    {isBloccata && (
                      <div style={{ fontSize:9, color:'#dc2626', fontWeight:600, marginTop:1 }}>
                        ⚠ Lotti CRM dismessi
                      </div>
                    )}
                    {haScaduti && !isBloccata && (
                      <div style={{ fontSize:9, color:'#92400e', fontWeight:600, marginTop:1 }}>
                        ⚠ CRM scaduti
                      </div>
                    )}
                    {haStockScadute && !isBloccata && (
                      <div style={{ fontSize:9, color:'#92400e', fontWeight:600, marginTop:1 }}>
                        ⚠ Prep stock scadute
                      </div>
                    )}
                    <div style={{ fontSize:10, color:C.page.t2, marginTop:2,
                                  fontFamily:'IBM Plex Mono, monospace' }}>
                      {w.concVariabile ? 'variabile' : (w.conc ? `${w.conc} mg/L` : '—')}
                      {' · '}{w.volFin || '—'} mL{' · '}{w.solv || '—'}
                    </div>

                    {/* Badge validità */}
                    <span style={{
                      display:'inline-block', fontSize:9, padding:'1px 8px',
                      borderRadius:10, fontWeight:700, marginTop:4,
                      background: w.validitaMesi ? C.sng.chip : '#d3d1c7',
                      color: w.validitaMesi ? C.sng.text : C.page.t2,
                    }}>
                      {w.validitaMesi ? `valida ${w.validitaMesi} mesi` : 'al momento'}
                    </span>


                    {/* Chips sorgenti */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:5 }}>
                      {w.srcs.map(s => (
                        <span key={s.id} style={{
                          fontSize:9, fontFamily:'IBM Plex Mono, monospace',
                          background:col.chip, color:col.text,
                          borderRadius:4, padding:'2px 6px',
                        }}>{s.nome}</span>
                      ))}
                      {(w.extraSrcs ?? []).map(s => (
                        <span key={s.id} style={{
                          fontSize:9, fontFamily:'IBM Plex Mono, monospace',
                          background:'#fef3c7', color:'#92400e',
                          border:'1px solid #f59e0b',
                          borderRadius:4, padding:'2px 6px',
                        }} title="Presente nella work ma non in questo schema">
                          ⚠ {s.nome}
                        </span>
                      ))}
                    </div>

                    {/* Tabella volumi mini */}
                    <div style={{ marginTop:6, borderTop:`1px dashed ${C.page.brd}`,
                                  paddingTop:5 }}>
                      {w.vols.map(v => (
                        <div key={v.nome} style={{
                          display:'flex', justifyContent:'space-between',
                          fontSize:10, fontFamily:'IBM Plex Mono, monospace',
                          color:C.page.t2, padding:'1px 0',
                        }}>
                          <span style={{ fontWeight:500, color:col.text }}>{v.nome}</span>
                          <span>{v.vol.toFixed(3)} mL</span>
                        </div>
                      ))}
                      {neg ? (
                        <div style={{ fontSize:9, color:'#a32d2d', fontWeight:700,
                                      borderTop:`1px dashed ${C.page.brd}`,
                                      marginTop:3, paddingTop:3 }}>
                          ⚠ prelievi ({usedVol.toFixed(3)}) &gt; vol. finale
                        </div>
                      ) : (
                        <div style={{
                          display:'flex', justifyContent:'space-between',
                          fontSize:10, fontFamily:'IBM Plex Mono, monospace',
                          borderTop:`1px dashed ${C.page.brd}`,
                          marginTop:3, paddingTop:3, opacity:0.5,
                        }}>
                          <span>{w.solv || 'Solvente'}</span>
                          <span>{solvVol.toFixed(3)} mL</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Pulsante + aggiungi colonna intermedia */}
      {workCols[0]?.length > 0 && (
        <button
          onClick={onAddCol}
          style={{
            width:40, flexShrink:0, background:'transparent', border:'none',
            borderLeft:`1.5px dashed ${C.page.brd}`, cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', gap:4, color:C.page.th, fontSize:20,
          }}
          title="Aggiungi colonna intermedia"
        >
          <span>+</span>
          <span style={{
            fontSize:9, fontFamily:'IBM Plex Mono, monospace',
            writingMode:'vertical-rl', textOrientation:'mixed', letterSpacing:'0.05em',
          }}>Intermedia</span>
        </button>
      )}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Componente principale SchemaCalibrazione
// ─────────────────────────────────────────────────────────────────────────────
export default function SchemaCalibrazione({ metodoId, metodoNome, onClose }: SchemaCalibrazioneProps) {
  const { crmItems, analiti: analitiAll, loading, error, reload, firmaToMixIds, mixNomiMap, analitiRows } = useSchemaData(metodoId)

  // ── Ref registry per SVG connections ───────────────────────────────────────
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const workspaceRef = useRef<HTMLDivElement>(null)
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const workColsRef = useRef<HTMLDivElement>(null)
  const registerCardRef: RegisterCardRef = useCallback((id, el) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }, [])

  // ── Stato principale ──────────────────────────────────────────────────────
  const [selSrcs,      setSelSrcs]      = useState<Map<string, SorgenteSel>>(new Map())
  const [removedMix,   setRemovedMix]   = useState<Set<string>>(new Set())
  const [workCols,     setWorkCols]     = useState<WorkInSchema[][]>([[]])
  const [modalOpen,    setModalOpen]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [drawerWork,   setDrawerWork]   = useState<WorkInSchema | null>(null)
  const [drawerCol,    setDrawerCol]    = useState(0)
  const [schemaLoaded, setSchemaLoaded] = useState(false)
  const [confirmReset, setConfirmReset] = useState<'full'|null>(null)
  const [blockedMap, setBlockedMap] = useState<Map<number, { bloccata: boolean; haScaduti: boolean; haStockScadute: boolean }>>(new Map())
  const [ricaricaSchemaWorkId, setRicaricaSchemaWorkId] = useState<number | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [importOpen,      setImportOpen]      = useState(false)
  const [scenarOpen,      setScenarOpen]      = useState(false)
  const [scenarioScelto,  setScenarioScelto]  = useState(false)
  const [autoSelectOpen,  setAutoSelectOpen]  = useState(false)
  const [filtroDestUso,   setFiltroDestUso]   = useState<DestUso>('taratura')

  // Filtra crmItems per destinazione d'uso selezionata e ricalcola analitiAll filtrati
  const { crmItemsPerDestUso, analitiAllFiltrati, firmaToMixIdsFiltrati, mixNomiMapFiltrati } = useMemo(() => {
    function passaDest(dest: string | null): boolean {
      if (!dest) return filtroDestUso !== 'is' // null → visibile in Taratura e QC, non in IS
      const d = dest.toLowerCase()
      if (filtroDestUso === 'taratura') return d.includes('taratura')
      if (filtroDestUso === 'qc') return d.includes('controllo')
      if (filtroDestUso === 'is') return d.includes('intern') || d.includes(' is')
      return true
    }
    // Per i mix: la destinazione_uso è la stessa su tutti i componenti oppure null sui componenti
    // e valorizzata solo su uno. Prendi il primo valore non-null per mix_id.
    const mixDestMap = new Map<string, string | null>()
    for (const c of crmItems) {
      if (c.mix_id && !mixDestMap.has(c.mix_id)) {
        mixDestMap.set(c.mix_id, c.destinazione_uso)
      } else if (c.mix_id && c.destinazione_uso && !mixDestMap.get(c.mix_id)) {
        mixDestMap.set(c.mix_id, c.destinazione_uso)
      }
    }
    const mixIdValidi = new Set(
      [...mixDestMap.entries()].filter(([, dest]) => passaDest(dest)).map(([id]) => id)
    )

    const filtered = crmItems.filter(c => c.mix_id ? mixIdValidi.has(c.mix_id) : passaDest(c.destinazione_uso))
    const { analiti: analitiAllFiltrati, firmaToMixIds: firmaToMixIdsFiltrati, mixNomiMap: mixNomiMapFiltrati } = buildAnalitiData(filtered, analitiRows)
    return { crmItemsPerDestUso: filtered, analitiAllFiltrati, firmaToMixIdsFiltrati, mixNomiMapFiltrati }
  }, [crmItems, analitiRows, filtroDestUso])

  // Dopo la scelta dello scenario, ricalcola analiti e crmItems escludendo le
  // composizioni (firme) non nello scenario. Tutti i lotti di una composizione
  // ammessa vengono mantenuti (il filtraggio è per firma, non per mix_id singolo).
  const { analiti, crmItemsFiltrati } = useMemo(() => {
    if (!scenarioScelto || removedMix.size === 0) {
      return { analiti: analitiAllFiltrati, crmItemsFiltrati: crmItemsPerDestUso }
    }
    // Calcola le firme ammesse = firme i cui mix_id non sono tutti in removedMix
    const firmeAmmesse = new Set<string>()
    for (const [firma, mixIds] of firmaToMixIds.entries()) {
      if (mixIds.some(mid => !removedMix.has(mid))) firmeAmmesse.add(firma)
    }
    // mix_id ammessi = tutti i lotti delle firme ammesse
    const mixIdAmmessi = new Set<string>()
    for (const firma of firmeAmmesse) {
      for (const mid of firmaToMixIds.get(firma) ?? []) mixIdAmmessi.add(mid)
    }
    const filtered = crmItemsPerDestUso.filter(c => !c.mix_id || mixIdAmmessi.has(c.mix_id))
    const { analiti } = buildAnalitiData(filtered, analitiRows)
    return { analiti, crmItemsFiltrati: filtered }
  }, [scenarioScelto, removedMix, crmItemsPerDestUso, analitiAllFiltrati, analitiRows, firmaToMixIds])

  // ── removedMix effettivo per la griglia ──────────────────────────────────
  // Se un mix_id è in removedMix ma è l'unico lotto disponibile nel filtro
  // corrente (filtroDestUso), non deve essere mostrato come sbarrato.
  const removedMixEffettivo = useMemo(() => {
    const result = new Set(removedMix)
    for (const a of analiti) {
      if (!a.mixId) continue
      // Se tutti i mix_id di questa firma che sono disponibili (in analiti) sono in removedMix,
      // rimuovi dall'effettivo il primo disponibile così appare attivo
      const disponibili = a.mixIds.filter(mid => crmItemsFiltrati.some(c => c.mix_id === mid))
      if (disponibili.length > 0 && disponibili.every(mid => result.has(mid))) {
        result.delete(disponibili[0])
      }
    }
    return result
  }, [removedMix, analiti, crmItemsFiltrati])

  // ── Deriva mixLottoSel da removedMix ─────────────────────────────────────
  // Il lotto attivo di ogni firma è il primo mix_id NON escluso da removedMix.
  // Questo garantisce coerenza dopo reload (mixLottoSel non era persistito nel DB).
  const mixLottoSel = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of analiti) {
      if (!a.mixId || !a.mixIds || a.mixIds.length <= 1) continue
      if (m.has(a.mixId)) continue
      const attivo = a.mixIds.find(mid => !removedMixEffettivo.has(mid))
      if (attivo && attivo !== a.mixId) m.set(a.mixId, attivo)
    }
    return m
  }, [analiti, removedMixEffettivo])

  // ── Carica schema salvato (dopo il caricamento CRM) ───────────────────────
  useEffect(() => {
    if (loading || schemaLoaded) return
    schemaCalApi.get(metodoId).then(saved => {
      if (saved?.workCols) setWorkCols(saved.workCols)
      const savedRemovedMix = new Set<string>(saved?.removedMix ?? [])
      if (saved?.removedMix) setRemovedMix(savedRemovedMix)
      const giàScelto = !!saved?.scenarioScelto
      setScenarioScelto(giàScelto)
      if (!giàScelto) {
        // Apri dialog solo se ci sono ≥2 scenari CRM mix tra cui scegliere
        const comps = buildMixComposizioni(analitiAll, crmItems, firmaToMixIds, mixNomiMap)
          .filter(c => c.mixIds.some(mid => !savedRemovedMix.has(mid)))
        const scenari = generaScenari(analitiAll, comps)
        if (scenari.length > 1) {
          setScenarOpen(true)
        } else {
          setScenarioScelto(true)
        }
      }
      setSchemaLoaded(true)
    }).catch(() => { setScenarOpen(true); setSchemaLoaded(true) })
  }, [loading, metodoId, schemaLoaded])

  // ── Auto-save schema (debounced, solo dopo il caricamento iniziale) ────────
  useEffect(() => {
    if (!schemaLoaded) return
    const timer = setTimeout(() => {
      schemaCalApi.save(metodoId, workCols, [], Array.from(removedMix), scenarioScelto)
    }, 500)
    return () => clearTimeout(timer)
  }, [workCols, removedMix, scenarioScelto, metodoId, schemaLoaded])

  // ── Controlla quali work hanno lotti CRM dismessi ────────────────────────────
  useEffect(() => {
    if (!schemaLoaded) return
    const allDbIds = workCols.flatMap(col =>
      col.map(w => w.dbId).filter((id): id is number => id != null)
    )
    if (allDbIds.length === 0) { setBlockedMap(new Map()); return }
    let cancelled = false
    Promise.all(allDbIds.map(id => workApi.get(id))).then(results => {
      if (cancelled) return
      const map = new Map<number, { bloccata: boolean; haScaduti: boolean; haStockScadute: boolean }>()
      for (const w of results) {
        if (w?.id != null) map.set(w.id, { bloccata: !!w.bloccata, haScaduti: !!w.ha_crm_scaduti, haStockScadute: !!w.ha_prep_scadute })
      }
      setBlockedMap(map)
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaLoaded, workCols])

  // ── Reset schema ────────────────────────────────────────────────────────────
  const handleFullReset = useCallback(async () => {
    await schemaCalApi.save(metodoId, [[]], [], [], false)
    setWorkCols([[]])
    setRemovedMix(new Set())
    setSelSrcs(new Map())
    setScenarioScelto(false)
    setScenarOpen(true)
    setSchemaLoaded(true) // stato già pulito, non ri-caricare dal DB
    await reload()
  }, [metodoId, reload])

  const tgtCol = targetColIdx(selSrcs)

  // ── Toggle selezione sorgenti ──────────────────────────────────────────────
  const toggleMix = useCallback((mixId: string) => {
    setSelSrcs(prev => {
      const m = new Map(prev)
      if (m.has(mixId)) { m.delete(mixId) }
      else {
        const comps = crmItems.filter(c => c.mix_id === mixId)
        const crm = comps[0]
        const cvSet = new Set(comps.map(c => c.cv))
        const eterogenea = cvSet.size > 1
        m.set(mixId, {
          id: mixId,
          nome: crm?.mix ?? mixId,
          cv: crm?.cv ?? 0,
          tipo: 'mix',
          concVariabile: eterogenea,
        })
      }
      return m
    })
  }, [crmItems])

  const toggleSng = useCallback((sngId: string) => {
    setSelSrcs(prev => {
      const m = new Map(prev)
      if (m.has(sngId)) { m.delete(sngId) }
      else {
        const crm = crmItems.find(c => String(c.id) === sngId)
        if (crm) m.set(sngId, { id: sngId, nome: crm.nome, cv: crm.cv, tipo: 'sng' })
      }
      return m
    })
  }, [crmItems])

  const togglePrepStock = useCallback((prepKey: string, prepId: number, crmNome: string, cv: number, lotto: string | null, flacone: string | null, progressivo: number | null) => {
    setSelSrcs(prev => {
      const m = new Map(prev)
      if (m.has(prepKey)) { m.delete(prepKey) }
      else m.set(prepKey, { id: prepKey, nome: crmNome, cv, tipo: 'prep', prepId, lotto, flacone, progressivo })
      return m
    })
  }, [])

  const toggleWork = useCallback((w: WorkInSchema, colSrc: number) => {
    setSelSrcs(prev => {
      const m = new Map(prev)
      if (m.has(w.id)) { m.delete(w.id) }
      else m.set(w.id, { id: w.id, nome: w.nome, cv: w.conc ?? 0, tipo: 'work', colSrc,
                         concVariabile: w.concVariabile })
      return m
    })
  }, [])

  // Quando l'utente cambia lotto di un mix dalla griglia CRM:
  // swappa removedMix (il nuovo lotto diventa attivo, il vecchio escluso)
  // e trasferisce la selezione se il vecchio era selezionato
  const handleChangeMixLotto = useCallback((_firmaId: string, oldMixId: string, newMixId: string) => {
    setRemovedMix(prev => {
      const s = new Set(prev)
      s.delete(newMixId)  // il nuovo lotto non è più escluso
      s.add(oldMixId)     // il vecchio lotto viene escluso
      return s
    })
    setSelSrcs(prev => {
      if (!prev.has(oldMixId)) return prev
      const m = new Map(prev)
      const entry = m.get(oldMixId)!
      m.delete(oldMixId)
      const comps = crmItems.filter(c => c.mix_id === newMixId)
      const crm = comps[0]
      const cvSet = new Set(comps.map(c => c.cv))
      m.set(newMixId, {
        ...entry,
        id: newMixId,
        nome: crm?.mix ?? entry.nome,
        cv: crm?.cv ?? entry.cv,
        concVariabile: cvSet.size > 1,
      })
      return m
    })
  }, [crmItems])


  const handleApplyScenario = useCallback((mixIds: string[]) => {
    const scenarioSet = new Set(mixIds)

    // Tutti i mix_id distinti presenti nello schema (da crmItems)
    const tuttiMixIds = new Set<string>()
    for (const c of crmItems) { if (c.mix_id) tuttiMixIds.add(c.mix_id) }

    // removedMix = tutti i mix NON nello scenario
    setRemovedMix(() => {
      const s = new Set<string>()
      for (const mid of tuttiMixIds) { if (!scenarioSet.has(mid)) s.add(mid) }
      return s
    })

    // Rimuovi dalla selezione i mix che non fanno più parte dello scenario
    setSelSrcs(prev => {
      const m = new Map(prev)
      for (const [k, v] of m) { if (v.tipo === 'mix' && !scenarioSet.has(k)) m.delete(k) }
      return m
    })

    setScenarioScelto(true)
    setScenarOpen(false)
  }, [crmItems])

  const handleAutoSelect = useCallback((mixIds: string[], sngIds: string[]) => {
    // Applica scenario mix (aggiorna removedMix, scenarioScelto)
    handleApplyScenario(mixIds)
    // Aggiunge mix e singoli a selSrcs
    setSelSrcs(prev => {
      const m = new Map(prev)
      for (const mixId of mixIds) {
        const comps = crmItems.filter(c => c.mix_id === mixId)
        const crm = comps[0]
        const cvSet = new Set(comps.map(c => c.cv))
        const eterogenea = cvSet.size > 1
        m.set(mixId, { id: mixId, nome: crm?.mix ?? mixId, cv: crm?.cv ?? 0, tipo: 'mix', concVariabile: eterogenea })
      }
      for (const sngId of sngIds) {
        const crm = crmItems.find(c => String(c.id) === sngId)
        if (!crm) continue
        const isNeat = String(crm.forma ?? '').toLowerCase() === 'neat'
        const preps = crm.prepStock ?? []
        if (isNeat && preps.length > 0) {
          // Seleziona il preparato con progressivo maggiore
          const prep = preps.reduce((best, p) =>
            (p.progressivo ?? 0) > (best.progressivo ?? 0) ? p : best
          )
          const cv = (prep.concReale ?? prep.concTarget ?? (prep.conc != null ? Number(prep.conc) : 0)) || 0
          const prepKey = `prep_${prep.id}`
          m.set(prepKey, { id: prepKey, nome: crm.nome, cv, tipo: 'prep', prepId: prep.id, lotto: crm.lotto ?? null, flacone: prep.flacone ?? null, progressivo: prep.progressivo ?? null })
        } else if (!isNeat) {
          m.set(sngId, { id: sngId, nome: crm.nome, cv: crm.cv, tipo: 'sng' })
        }
        // Neat senza preparazioni: non selezionare nulla
      }
      return m
    })
    setAutoSelectOpen(false)
  }, [handleApplyScenario, crmItems])

  // ── Crea Work ──────────────────────────────────────────────────────────────
  const handleSaveWork = async (data: Omit<WorkInSchema, 'id' | 'dbId'>) => {
    setSaving(true)
    const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
    const work: WorkInSchema = { ...data, id }

    let dbId: number | undefined
    try {
      const result = await salvaWorkNelDb(work, metodoId, crmItems)
      if (result) dbId = result
    } catch (e) {
      console.error('Errore salvataggio Work nel DB:', e)
      alert(`Errore salvataggio Work nel DB:\n${(e as any)?.message ?? e}`)
      setSaving(false)
      return
    }


    const finalWork: WorkInSchema = dbId ? { ...work, dbId } : work

    // Inserisce nella colonna target
    setWorkCols(prev => {
      const cols = prev.map(c => [...c])
      while (cols.length <= tgtCol) cols.push([])
      cols[tgtCol] = [...cols[tgtCol], finalWork]
      // Assicura colonna successiva vuota
      if (cols.length <= tgtCol + 1) cols.push([])
      return cols
    })

    setSelSrcs(new Map())
    setModalOpen(false)
    setSaving(false)
  }

  // ── Elimina Work ──────────────────────────────────────────────────────────
  const handleDeleteWork = useCallback((colIdx: number, workIdx: number) => {
    setWorkCols(prev => {
      const cols = prev.map(c => [...c])
      const w    = cols[colIdx]?.[workIdx]
      const wid  = w?.id
      if (w?.dbId) {
        // Rimuovi solo il link al metodo — non archiviare mai dallo schema
        workApi.removeFromMetodo(w.dbId, metodoId).catch(() => {})
      }
      cols[colIdx].splice(workIdx, 1)
      if (wid) setSelSrcs(p => { const m = new Map(p); m.delete(wid); return m })
      // Rimuovi colonne vuote in coda (mantieni la 0)
      while (cols.length > 1 && cols[cols.length - 1].length === 0) cols.pop()
      return cols
    })
  }, [metodoId])

  // ── Importa Work esistente ─────────────────────────────────────────────────
  const handleImportWork = useCallback((work: WorkInSchema, colIdx: number) => {
    setWorkCols(prev => {
      const cols = prev.map(c => [...c])
      while (cols.length <= colIdx) cols.push([])
      cols[colIdx] = [...cols[colIdx], { ...work }]
      if (cols.length <= colIdx + 1) cols.push([])
      return cols
    })
    setImportOpen(false)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position:'relative', background:C.page.bg,
      display:'flex', flexDirection:'column',
      height:'calc(100vh - 48px - 32px)', margin:-16, overflow:'hidden',
      fontFamily:'Lato, sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{ background:C.page.sur, boxShadow:'0 1px 0 rgba(0,0,0,0.06)',
                    padding:'12px 24px', display:'flex', alignItems:'center',
                    justifyContent:'space-between', flexShrink:0 }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="h-8 px-3 rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors" style={{ background:'transparent', border:'none', cursor:'pointer' }}>← Torna a Metodi</button>
          <div className="h-4 w-px bg-border" />
          <span className="font-heading text-lg font-semibold">Schema Calibrazione</span>
          <span className="text-sm text-muted-foreground bg-muted rounded-full px-3 py-0.5 font-mono">{metodoNome}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Legenda */}
          {[
            { color:C.mix.chip, border:C.mix.border, label:'Mix CRM' },
            { color:C.sng.chip, border:C.sng.border, label:'Singoli' },
            { color:C.work.chip,border:C.work.border,label:'Work' },
            { color:C.inter.chip,border:C.inter.border,label:'Intermedia' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center',
                                        gap:4, fontSize:11, color:C.page.t2 }}>
              <div style={{ width:8, height:8, borderRadius:'50%',
                            background:l.color, border:`1px solid ${l.border}` }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Workspace ── */}
      {loading ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                      color:C.page.th, fontSize:13 }}>
          Caricamento CRM del metodo…
        </div>
      ) : error ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                      color:C.con.text, fontSize:13 }}>
          Errore: {error}
        </div>
      ) : (
        <div ref={workspaceRef} style={{ flex:1, display:'flex', flexDirection:'row',
                      overflowX:'auto', overflowY:'hidden', minHeight:0, position:'relative',
                      gap:16, padding:'16px 12px 8px' }}>
          <ConnectionsOverlay
            workCols={workCols}
            cardRefs={cardRefs}
            containerRef={workspaceRef}
            gridScrollRef={gridBodyRef}
            workScrollRef={workColsRef}
          />
          <GrigliaAnalitiCrm
            analiti={analiti}
            crmItems={crmItemsFiltrati}
            selSrcs={selSrcs}
            removedMix={removedMixEffettivo}
            onToggleMix={toggleMix}
            onToggleSng={toggleSng}
            onTogglePrepStock={togglePrepStock}
            onClose={onClose}
            registerCardRef={registerCardRef}
            gridBodyRef={gridBodyRef}
            onOpenScenar={() => setScenarOpen(true)}
            onChangeMixLotto={handleChangeMixLotto}
            mixLottoSel={mixLottoSel}
          />
          <ColonneWork
            ref={workColsRef}
            workCols={workCols}
            selSrcs={selSrcs}
            onToggleWork={toggleWork}
            onDeleteWork={handleDeleteWork}
            onOpenDrawer={(w, ci) => { setDrawerWork(w); setDrawerCol(ci) }}
            onAddCol={() => setWorkCols(prev => [...prev, []])}
            registerCardRef={registerCardRef}
            blockedMap={blockedMap}
            onRicaricaWork={setRicaricaSchemaWorkId}
          />
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div style={{ background:C.page.sur, boxShadow:'0 -1px 0 rgba(0,0,0,0.06)',
                    padding:'10px 24px', display:'flex', alignItems:'center',
                    justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* ── Selector destinazione d'uso ── */}
          <div style={{ display:'flex', alignItems:'center', gap:4, marginRight:4 }}>
            {(['taratura', 'qc', 'is'] as DestUso[]).map(d => {
              const labels: Record<DestUso, string> = { taratura: 'Taratura', qc: 'QC', is: 'IS' }
              const colors: Record<DestUso, { border: string; text: string; bg: string }> = {
                taratura: { border: C.mix.border, text: C.mix.text, bg: C.mix.bg },
                qc:       { border: C.sng.border, text: C.sng.text, bg: C.sng.bg },
                is:       { border: C.inter.border, text: C.inter.text, bg: C.inter.bg },
              }
              const active = filtroDestUso === d
              return (
                <button key={d} onClick={() => setFiltroDestUso(d)} style={{
                  padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                  cursor:'pointer',
                  border:`1px solid ${colors[d].border}`,
                  background: active ? colors[d].border : C.page.sur,
                  color: active ? '#fff' : colors[d].text,
                }}>{labels[d]}</button>
              )
            })}
          </div>
          <button onClick={() => setConfirmReset('full')} style={{
            padding:'5px 12px', borderRadius:8, border:`1px solid ${C.con.border}`,
            background:C.page.sur, cursor:'pointer', fontSize:11,
            fontWeight:500, color:C.con.text,
          }}>Ricomincia da zero</button>
          <button onClick={() => setAutoSelectOpen(true)} style={{
            padding:'5px 12px', borderRadius:8, border:`1px solid ${C.mix.border}`,
            background:C.page.sur, cursor:'pointer', fontSize:11,
            fontWeight:500, color:C.mix.text,
          }}>Selezione automatica</button>
          {selSrcs.size > 0 && (
            <button onClick={() => setSelSrcs(new Set())} style={{
              padding:'5px 12px', borderRadius:8, border:`1px solid ${C.page.brd}`,
              background:C.page.sur, cursor:'pointer', fontSize:11,
              fontWeight:500, color:C.page.t2,
            }}>Deseleziona tutto</button>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:11, color:C.page.t2,
                         fontFamily:'IBM Plex Mono, monospace' }}>
            {selSrcs.size} sorgent{selSrcs.size === 1 ? 'e' : 'i'} selezionat{selSrcs.size === 1 ? 'a' : 'e'}
          </span>
          <button
            onClick={() => setModalOpen(true)}
            disabled={selSrcs.size === 0}
            style={{
              padding:'7px 18px', borderRadius:8, border:'none', cursor:'pointer',
              fontSize:13, fontWeight:700,
              background: selSrcs.size === 0 ? C.page.brd : C.work.border,
              color: selSrcs.size === 0 ? C.page.th : '#fff',
            }}
          >+ Crea Work</button>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              padding:'7px 18px', borderRadius:8, border:`1px solid ${C.work.border}`,
              cursor:'pointer', fontSize:13, fontWeight:700,
              background:'transparent', color: C.work.border,
            }}
          >Importa Work</button>
        </div>
      </div>

      {/* ── Dialog scenari copertura CRM Mix ── */}
      {scenarOpen && (
        <ScenarDialog
          analiti={analitiAll}
          crmItems={crmItems}
          firmaToMixIds={firmaToMixIds}
          mixNomiMap={mixNomiMap}
          removedMix={new Set()}
          obbligatorio={!scenarioScelto}
          onClose={() => setScenarOpen(false)}
          onApply={handleApplyScenario}
        />
      )}

      {/* ── Dialog selezione automatica CRM ── */}
      {autoSelectOpen && (
        <AutoSelectDialog
          analiti={analitiAllFiltrati}
          crmItems={crmItemsPerDestUso}
          firmaToMixIds={firmaToMixIdsFiltrati}
          mixNomiMap={mixNomiMapFiltrati}
          removedMix={removedMix}
          onClose={() => setAutoSelectOpen(false)}
          onApply={handleAutoSelect}
        />
      )}

      {/* ── Modal crea Work ── */}
      <ModalCreaWork
        open={modalOpen}
        selSrcs={selSrcs}
        workCols={workCols}
        crmItems={crmItems}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveWork}
        saving={saving}
      />

      {/* ── Dialog importa Work ── */}
      <ImportaWorkDialog
        open={importOpen}
        metodoId={metodoId}
        crmItems={crmItems}
        workCols={workCols}
        onClose={() => setImportOpen(false)}
        onImported={handleImportWork}
      />

      {/* ── Drawer dettaglio Work ── */}
      {drawerWork?.dbId != null && (
        <WorkDrawer
          workId={drawerWork.dbId}
          onClose={() => setDrawerWork(null)}
          onEdit={() => {}}
          onDelete={(id) => {
            const workIdx = workCols[drawerCol]?.findIndex(x => x.dbId === id) ?? -1
            if (workIdx >= 0) handleDeleteWork(drawerCol, workIdx)
            setDrawerWork(null)
          }}
          metodiNomi={metodoNome ? { [metodoId]: metodoNome } : undefined}
        />
      )}

      {/* ── Dialog ricarica lotti work ── */}
      <RicaricaDialog
        workId={ricaricaSchemaWorkId}
        onClose={() => setRicaricaSchemaWorkId(null)}
        onSuccess={newWorkId => {
          // Aggiorna dbId nella colonna per puntare alla nuova work e salva subito
          // (senza attendere il debounce, per evitare di perdere la modifica se l'utente naviga via)
          if (ricaricaSchemaWorkId != null) {
            setWorkCols(prev => {
              const updated = prev.map(col =>
                col.map(w => w.dbId === ricaricaSchemaWorkId ? { ...w, dbId: newWorkId } : w)
              )
              schemaCalApi.save(metodoId, updated, [], Array.from(removedMix), scenarioScelto)
              return updated
            })
          }
          setRicaricaSchemaWorkId(null)
          setToastMsg('Work aggiornata. La precedente versione è stata archiviata.')
          setTimeout(() => setToastMsg(null), 4000)
        }}
      />

      {/* ── Toast notifica ── */}
      {toastMsg && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'#1e293b', color:'#f8fafc', borderRadius:10,
          padding:'10px 20px', fontSize:13, fontWeight:500,
          boxShadow:'0 4px 16px rgba(0,0,0,0.25)',
          zIndex:9999, pointerEvents:'none',
          display:'flex', alignItems:'center', gap:8,
        }}>
          <span style={{ color:'#4ade80', fontSize:16 }}>✓</span>
          {toastMsg}
        </div>
      )}

      {/* ── Dialog conferma reset ── */}
      <ConfirmDialog
        open={confirmReset !== null}
        title="Ricominciare da zero?"
        message="Tutti i Work e le rimozioni CRM verranno cancellati. I dati CRM verranno ricaricati dal database."
        confirmLabel="Ricomincia da zero"
        variant="danger"
        onConfirm={() => {
          setConfirmReset(null)
          handleFullReset()
        }}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  )
}
