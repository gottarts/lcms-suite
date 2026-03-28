// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.tsx  —  Parte 4 / 4  (componente principale)
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.tsx
//
// Contiene:
//   - ColonneWork         → colonne Work lv0 + Intermedie
//   - DrawerDettaglioWork → pannello laterale dettaglio
//   - SchemaCalibrazione  → root (esporta default)
//
// DIPENDENZE (tutti nella stessa cartella):
//   - SchemaCalibrazione.types.ts
//   - SchemaCalibrazione.logic.ts
//   - SchemaCalibrazione.grid.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import type {
  SorgenteSel, WorkInSchema, CrmItem, SchemaCalibrazioneProps, ConnectionLine, RegisterCardRef
} from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import {
  useSchemaData, targetColIdx,
  salvaWorkNelDb, getCompsFromWork, computeConnections,
} from './SchemaCalibrazione.logic'
import { GrigliaAnalitiCrm, ModalCreaWork } from './SchemaCalibrazione.grid'
import { ImportaWorkDialog } from './ImportaWorkDialog'
import { schemaCalApi, workApi } from '../../lib/api'
import { RicaricaDialog } from '../work/RicaricaDialog'
import { SlidePanel } from '@/components/shared/SlidePanel'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// ─────────────────────────────────────────────────────────────────────────────
// SVG Overlay per frecce di connessione
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionsOverlay({
  workCols, cardRefs, containerRef, gridScrollRef,
}: {
  workCols: WorkInSchema[][]
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  containerRef: React.RefObject<HTMLDivElement | null>
  gridScrollRef?: React.RefObject<HTMLDivElement | null>
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
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
      if (grid) grid.removeEventListener('scroll', update)
    }
  }, [workCols, cardRefs, containerRef, gridScrollRef])

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
  hasCon: boolean
  onToggleWork: (w: WorkInSchema, colIdx: number) => void
  onDeleteWork: (colIdx: number, workIdx: number) => void
  onOpenDrawer: (w: WorkInSchema, colIdx: number) => void
  onAddCol: () => void
  registerCardRef: RegisterCardRef
  blockedMap: Map<number, { bloccata: boolean; haScaduti: boolean }>
  onRicaricaWork: (dbId: number) => void
}

function ColonneWork({
  workCols, selSrcs, hasCon,
  onToggleWork, onDeleteWork, onOpenDrawer, onAddCol, registerCardRef,
  blockedMap, onRicaricaWork,
}: ColonneWorkProps) {
  return (
    <div style={{ display:'flex', flexDirection:'row', flexShrink:0,
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
                const canBeSrc   = !hasCon
                const isSel      = selSrcs.has(w.id)
                const stateEntry = w.dbId ? (blockedMap.get(w.dbId) ?? null) : null
                const isBloccata = stateEntry?.bloccata ?? false
                const haScaduti  = stateEntry?.haScaduti ?? false
                const usedVol    = w.vols.reduce((a, v) => a + v.vol, 0)
                const solvVol    = Math.max(0, w.volFin - usedVol)
                const neg        = usedVol > w.volFin
                const isInter    = ci > 0
                const col        = isInter ? C.inter : C.work

                return (
                  <div
                    key={w.id}
                    ref={el => registerCardRef(w.id, el)}
                    onClick={() => canBeSrc && onToggleWork(w, ci)}
                    style={{
                      borderRadius:10, padding:`8px 12px ${isBloccata ? 28 : 8}px`, position:'relative',
                      background: isSel ? (isInter ? '#ddd4f5' : '#f5e8c8') : col.bg,
                      border:`1.5px solid ${col.border}`,
                      borderLeft:`3px solid ${col.border}`,
                      boxShadow: isSel
                        ? `0 0 0 3px rgba(155,134,214,.35)`
                        : '0 1px 2px rgba(0,0,0,0.04)',
                      cursor: canBeSrc ? 'pointer' : 'default',
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

                    {/* Pulsante Ricarica (lotti dismessi) */}
                    {isBloccata && w.dbId && (
                      <button
                        onClick={e => { e.stopPropagation(); onRicaricaWork(w.dbId!) }}
                        style={{
                          position:'absolute', bottom:7, right:7,
                          padding:'1px 8px', borderRadius:4,
                          border:'1px solid #fb923c',
                          background:'#fff7ed', color:'#ea580c',
                          cursor:'pointer', fontSize:9, fontWeight:700,
                        }}
                        title="Lotti CRM dismessi — aggiorna la work"
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawer dettaglio Work
// ─────────────────────────────────────────────────────────────────────────────
interface DrawerProps {
  work: WorkInSchema | null
  colIdx: number
  workCols: WorkInSchema[][]
  crmItems: CrmItem[]
  onClose: () => void
  onDelete: (colIdx: number, workIdx: number) => void
}

function DrawerDettaglioWork({ work, colIdx, workCols, crmItems, onClose, onDelete }: DrawerProps) {
  const [search, setSearch] = useState('')
  if (!work) return null

  const isInter  = colIdx > 0
  const col      = isInter ? C.inter : C.work
  const usedVol  = work.vols.reduce((a, v) => a + v.vol, 0)
  const solvVol  = Math.max(0, work.volFin - usedVol)
  const neg      = usedVol > work.volFin
  const allComps = getCompsFromWork(work, workCols, crmItems)
  const comps    = search
    ? allComps.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()))
    : allComps

  const workIdx = workCols[colIdx]?.findIndex(x => x.id === work.id) ?? -1

  // Funzione ricorsiva per catena tracciabilità
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
          // Foglia CRM
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
                          const comps = crmItems.filter(c => c.mix_id === src.id)
                          if (comps.length === 0) return null
                          const tip = comps.map(c => `${c.nome} · ${c.cv} ${c.unita_conc}`).join('\n')
                          return (
                            <span title={tip}
                                  style={{ marginLeft:4, cursor:'help', opacity:0.6 }}>ⓘ</span>
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

  return (
    <SlidePanel open={!!work} onClose={onClose} title={work.nome}
                subtitle={isInter ? `Intermedia lv.${colIdx}` : 'Work'} width="460px">
      <div className="space-y-4">

        {/* Badge validità + info */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
          <span style={{
            fontSize:10, padding:'2px 8px', borderRadius:3, fontWeight:700,
            background: work.validitaMesi ? C.sng.chip : '#d3d1c7',
            color: work.validitaMesi ? C.sng.text : C.page.t2,
          }}>
            {work.validitaMesi ? `valida ${work.validitaMesi} mesi` : 'al momento'}
          </span>
          {[
            work.conc ? `${work.conc} mg/L` : (work.concVariabile ? 'variabile' : null),
            work.volFin ? `${work.volFin} mL` : null,
            work.solv || null,
          ].filter(Boolean).map((kv, i) => (
            <span key={i} style={{ fontSize:11, color:C.page.t2,
                                   fontFamily:'IBM Plex Mono, monospace' }}>{kv}</span>
          ))}
        </div>

        {/* Azioni */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-destructive"
            onClick={() => { if (workIdx >= 0) { onDelete(colIdx, workIdx); onClose() } }}>
            Elimina
          </Button>
        </div>

        <Separator />

        {/* Tabella volumi */}
        <div>
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
              {work.vols.map((v, i) => (
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
                      {work.solv || 'Solvente'} (completamento)
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
                    {work.volFin.toFixed(3)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Separator />

        {/* Catena tracciabilità */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                        textTransform:'uppercase', letterSpacing:'0.08em',
                        marginBottom:6 }}>Catena di tracciabilità</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <ChainNode w={work} ci={colIdx} />
          </div>
        </div>

        <Separator />

        {/* Lista composti */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                        textTransform:'uppercase', letterSpacing:'0.08em',
                        marginBottom:6 }}>
            Composti ({allComps.length})
          </div>
          <input
            placeholder="Filtra composti..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width:'100%', padding:'6px 9px', border:`1px solid ${C.page.brd}`,
              borderRadius:8, fontSize:12, fontFamily:'Lato, sans-serif',
              outline:'none', background:'#fafafa', color:C.page.t1, marginBottom:8,
            }}
          />
          {comps.length === 0 ? (
            <div style={{ fontSize:11, color:C.page.th, fontStyle:'italic' }}>
              {search ? 'Nessun composto corrisponde al filtro' : 'Nessun composto trovato'}
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
        </div>

      </div>
    </SlidePanel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principale SchemaCalibrazione
// ─────────────────────────────────────────────────────────────────────────────
export default function SchemaCalibrazione({ metodoId, metodoNome, onClose }: SchemaCalibrazioneProps) {
  const { crmItems, analiti, loading, error, reload } = useSchemaData(metodoId)

  // ── Ref registry per SVG connections ───────────────────────────────────────
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const workspaceRef = useRef<HTMLDivElement>(null)
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const registerCardRef: RegisterCardRef = useCallback((id, el) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }, [])

  // ── Stato principale ──────────────────────────────────────────────────────
  const [selSrcs,      setSelSrcs]      = useState<Map<string, SorgenteSel>>(new Map())
  const [removedCon,   setRemovedCon]   = useState<Set<string>>(new Set())
  const [removedMix,   setRemovedMix]   = useState<Set<string>>(new Set())
  const [workCols,     setWorkCols]     = useState<WorkInSchema[][]>([[]])
  const [modalOpen,    setModalOpen]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [drawerWork,   setDrawerWork]   = useState<WorkInSchema | null>(null)
  const [drawerCol,    setDrawerCol]    = useState(0)
  const [schemaLoaded, setSchemaLoaded] = useState(false)
  const [confirmReset, setConfirmReset] = useState<'reload'|'full'|null>(null)
  const [blockedMap, setBlockedMap] = useState<Map<number, { bloccata: boolean; haScaduti: boolean }>>(new Map())
  const [ricaricaSchemaWorkId, setRicaricaSchemaWorkId] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  // ── Carica schema salvato (dopo il caricamento CRM) ───────────────────────
  useEffect(() => {
    if (loading || schemaLoaded) return
    schemaCalApi.get(metodoId).then(saved => {
      if (saved?.workCols) setWorkCols(saved.workCols)
      if (saved?.removedCon) setRemovedCon(new Set(saved.removedCon))
      if (saved?.removedMix) setRemovedMix(new Set(saved.removedMix))
      setSchemaLoaded(true)
    }).catch(() => setSchemaLoaded(true))
  }, [loading, metodoId, schemaLoaded])

  // ── Auto-save schema (debounced, solo dopo il caricamento iniziale) ────────
  useEffect(() => {
    if (!schemaLoaded) return
    const timer = setTimeout(() => {
      schemaCalApi.save(metodoId, workCols, Array.from(removedCon), Array.from(removedMix))
    }, 500)
    return () => clearTimeout(timer)
  }, [workCols, removedCon, removedMix, metodoId, schemaLoaded])

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
      const map = new Map<number, { bloccata: boolean; haScaduti: boolean }>()
      for (const w of results) {
        if (w?.id != null) map.set(w.id, { bloccata: !!w.bloccata, haScaduti: !!w.ha_crm_scaduti })
      }
      setBlockedMap(map)
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaLoaded, workCols])

  // ── Ricarica / Reset schema ─────────────────────────────────────────────────
  const handleReloadSchema = useCallback(async () => {
    setSchemaLoaded(false)
    setWorkCols([[]])
    setRemovedCon(new Set())
    setRemovedMix(new Set())
    setSelSrcs(new Map())
    await reload()
    // schemaLoaded=false + loading→false triggera il useEffect che ri-carica dal DB
  }, [reload])

  const handleFullReset = useCallback(async () => {
    await schemaCalApi.save(metodoId, [[]], [], [])
    setWorkCols([[]])
    setRemovedCon(new Set())
    setRemovedMix(new Set())
    setSelSrcs(new Map())
    setSchemaLoaded(true) // stato già pulito, non ri-caricare dal DB
    await reload()
  }, [metodoId, reload])

  // Duplicato ancora attivo = analita che ha sia mix (non rimosso) che singolo (non rimosso)
  const hasCon = analiti.some(a =>
    a.isCon &&
    a.sngIds.some(id => !removedCon.has(id)) &&
    a.mixId && !removedMix.has(a.mixId)
  )
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

  const toggleWork = useCallback((w: WorkInSchema, colSrc: number) => {
    setSelSrcs(prev => {
      const m = new Map(prev)
      if (m.has(w.id)) { m.delete(w.id) }
      else m.set(w.id, { id: w.id, nome: w.nome, cv: w.conc ?? 0, tipo: 'work', colSrc,
                         concVariabile: w.concVariabile })
      return m
    })
  }, [])

  const removeCon = useCallback((sngId: string) => {
    setRemovedCon(prev => new Set([...prev, sngId]))
    setSelSrcs(prev => { const m = new Map(prev); m.delete(sngId); return m })
  }, [])

  const removeMix = useCallback((mixId: string) => {
    setRemovedMix(prev => new Set([...prev, mixId]))
    setSelSrcs(prev => { const m = new Map(prev); m.delete(mixId); return m })
  }, [])

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
      // Archivia il record DB se la work aveva un dbId (evita orfani nel DB)
      if (w?.dbId) {
        workApi.archivia(w.dbId, 'Rimossa dallo schema').catch(() => {})
      }
      cols[colIdx].splice(workIdx, 1)
      if (wid) setSelSrcs(p => { const m = new Map(p); m.delete(wid); return m })
      // Rimuovi colonne vuote in coda (mantieni la 0)
      while (cols.length > 1 && cols[cols.length - 1].length === 0) cols.pop()
      return cols
    })
  }, [])

  // ── Importa Work esistente ─────────────────────────────────────────────────
  const handleImportWork = useCallback((work: WorkInSchema, colIdx: number) => {
    setWorkCols(prev => {
      const cols = prev.map(c => [...c])
      while (cols.length <= colIdx) cols.push([])
      cols[colIdx] = [...cols[colIdx], work]
      if (cols.length <= colIdx + 1) cols.push([])
      return cols
    })
    setImportOpen(false)
  }, [])

  // ── Step bar ──────────────────────────────────────────────────────────────
  const stepStatus = (() => {
    if (hasCon)            return 2   // step 2 attivo
    if (selSrcs.size === 0) return 3  // step 3 attivo
    return 4                          // step 4 attivo
  })()

  const steps = [
    { n: 1, label: 'Lettura CRM' },
    { n: 2, label: 'Rimuovi CRM indesiderati' },
    { n: 3, label: 'Seleziona sorgenti' },
    { n: 4, label: 'Crea Work' },
  ]

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
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:15, fontWeight:600 }}>Schema Calibrazione</span>
          <span style={{ fontSize:11, color:C.page.t2,
                         fontFamily:'IBM Plex Mono, monospace',
                         background:'#f0f0f0', borderRadius:12, padding:'2px 10px' }}>{metodoNome}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Legenda */}
          {[
            { color:C.mix.chip, border:C.mix.border, label:'Mix CRM' },
            { color:C.sng.chip, border:C.sng.border, label:'Singoli' },
            { color:C.con.bg,   border:C.con.border, label:'Duplicato' },
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

      {/* ── Step bar ── */}
      <div style={{ background:C.page.sur, boxShadow:'0 1px 0 rgba(0,0,0,0.06)',
                    padding:'7px 24px', display:'flex', alignItems:'center',
                    gap:5, flexShrink:0 }}>
        {steps.map((s, i) => {
          const isDone = s.n < stepStatus
          const isOn   = s.n === stepStatus
          const color  = isDone ? '#7db85a' : isOn ? '#6ba3d6' : C.page.th
          return (
            <div key={s.n} style={{ display:'flex', alignItems:'center', gap:5 }}>
              {i > 0 && <div style={{ width:24, height:0, borderTop:`1.5px dashed ${C.page.brd}` }} />}
              <div style={{ display:'flex', alignItems:'center', gap:5,
                            fontSize:11, color, fontWeight: isOn ? 600 : 400,
                            whiteSpace:'nowrap' }}>
                <div style={{
                  width:20, height:20, borderRadius:'50%',
                  border: (isDone || isOn) ? `1.5px solid ${color}` : '1.5px dashed #d0d0d0',
                  background: isDone ? '#7db85a' : isOn ? '#6ba3d6' : 'transparent',
                  color: (isDone || isOn) ? '#fff' : color,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, fontWeight:700,
                }}>
                  {isDone ? '✓' : s.n}
                </div>
                {s.label}
              </div>
            </div>
          )
        })}
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
          />
          <GrigliaAnalitiCrm
            analiti={analiti}
            crmItems={crmItems}
            selSrcs={selSrcs}
            removedCon={removedCon}
            removedMix={removedMix}
            onToggleMix={toggleMix}
            onToggleSng={toggleSng}
            onRemoveCon={removeCon}
            onRemoveMix={removeMix}
            onClose={onClose}
            registerCardRef={registerCardRef}
            gridBodyRef={gridBodyRef}
          />
          <ColonneWork
            workCols={workCols}
            selSrcs={selSrcs}
            hasCon={hasCon}
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
          {hasCon && (
            <span style={{ fontSize:12, color:C.con.text, fontWeight:600 }}>
              ⚠ Ci sono analiti con sia mix che singolo — elimina quelli non voluti con ×
            </span>
          )}
          <button onClick={() => setConfirmReset('reload')} style={{
            padding:'5px 12px', borderRadius:8, border:`1px solid ${C.page.brd}`,
            background:C.page.sur, cursor:'pointer', fontSize:11,
            fontWeight:500, color:C.page.t2,
          }}>&#x21bb; Ricarica</button>
          <button onClick={() => setConfirmReset('full')} style={{
            padding:'5px 12px', borderRadius:8, border:`1px solid ${C.con.border}`,
            background:C.page.sur, cursor:'pointer', fontSize:11,
            fontWeight:500, color:C.con.text,
          }}>Ricomincia da zero</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:11, color:C.page.t2,
                         fontFamily:'IBM Plex Mono, monospace' }}>
            {selSrcs.size} sorgent{selSrcs.size === 1 ? 'e' : 'i'} selezionat{selSrcs.size === 1 ? 'a' : 'e'}
          </span>
          <button onClick={onClose} style={{
            padding:'7px 14px', borderRadius:8, border:`1px solid ${C.page.brd}`,
            background:C.page.sur, cursor:'pointer', fontSize:13,
            fontWeight:700, color:C.page.t2,
          }}>← Chiudi schema</button>
          <div style={{ width:1, height:20, background:C.page.brd }} />
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
      {drawerWork && (
        <DrawerDettaglioWork
          work={drawerWork}
          colIdx={drawerCol}
          workCols={workCols}
          crmItems={crmItems}
          onClose={() => setDrawerWork(null)}
          onDelete={handleDeleteWork}
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
              schemaCalApi.save(metodoId, updated, Array.from(removedCon), Array.from(removedMix))
              return updated
            })
          }
          setRicaricaSchemaWorkId(null)
        }}
      />

      {/* ── Dialog conferma ricarica / reset ── */}
      <ConfirmDialog
        open={confirmReset !== null}
        title={confirmReset === 'full' ? 'Ricominciare da zero?' : 'Ricaricare lo schema?'}
        message={confirmReset === 'full'
          ? 'Tutti i Work e le rimozioni CRM verranno cancellati. I dati CRM verranno ricaricati dal database.'
          : 'I dati CRM verranno ricaricati dal database e lo schema verrà ripristinato dall\'ultimo salvataggio automatico.'}
        confirmLabel={confirmReset === 'full' ? 'Ricomincia da zero' : 'Ricarica'}
        variant={confirmReset === 'full' ? 'danger' : 'default'}
        onConfirm={() => {
          const mode = confirmReset
          setConfirmReset(null)
          if (mode === 'full') handleFullReset()
          else handleReloadSchema()
        }}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  )
}
