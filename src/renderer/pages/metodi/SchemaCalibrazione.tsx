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
import { useState, useCallback } from 'react'
import type {
  SorgenteSel, WorkInSchema, CrmItem, SchemaCalibrazioneProps
} from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import {
  useSchemaData, targetColIdx,
  salvaWorkNelDb, getCompsFromWork,
} from './SchemaCalibrazione.logic'
import { GrigliaAnalitiCrm, ModalCreaWork } from './SchemaCalibrazione.grid'

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
}

function ColonneWork({
  workCols, selSrcs, hasCon,
  onToggleWork, onDeleteWork, onOpenDrawer, onAddCol,
}: ColonneWorkProps) {
  return (
    <div style={{ display:'flex', flexDirection:'row', flexShrink:0 }}>
      {workCols.map((works, ci) => {
        const isFirst = ci === 0
        const lbl  = isFirst ? 'Work' : `Intermedia ${ci}`
        const sub  = isFirst
          ? `${works.length} solution${works.length !== 1 ? 's' : ''}`
          : `livello ${ci}`

        return (
          <div key={ci} style={{
            width:255, flexShrink:0,
            borderRight:`1px solid ${C.page.brd}`,
            display:'flex', flexDirection:'column', overflow:'hidden',
          }}>
            {/* Header colonna */}
            <div style={{ padding:'9px 11px 7px', background:C.page.sur,
                          borderBottom:`1px solid ${C.page.brd}`, flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.page.t2,
                            textTransform:'uppercase', letterSpacing:'0.08em' }}>{lbl}</div>
              <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                            fontFamily:'IBM Plex Mono, monospace' }}>{sub}</div>
            </div>

            {/* Corpo */}
            <div style={{ flex:1, overflowY:'auto', padding:8,
                          display:'flex', flexDirection:'column', gap:7 }}>
              {works.length === 0 && (
                <div style={{
                  border:`1.5px dashed ${C.page.brd2}`, borderRadius:7,
                  padding:'18px 12px', textAlign:'center', color:C.page.th,
                  fontSize:11, lineHeight:1.6,
                }}>
                  {isFirst
                    ? <>Seleziona CRM e clicca <strong>Crea Work</strong></>
                    : <>Clicca le card Work a sinistra, poi <strong>Crea Work</strong></>}
                </div>
              )}

              {works.map((w, wi) => {
                const canBeSrc = !hasCon
                const isSel    = selSrcs.has(w.id)
                const usedVol  = w.vols.reduce((a, v) => a + v.vol, 0)
                const solvVol  = Math.max(0, w.volFin - usedVol)
                const neg      = usedVol > w.volFin
                const isInter  = ci > 0
                const col      = isInter ? C.inter : C.work

                return (
                  <div
                    key={w.id}
                    onClick={() => canBeSrc && onToggleWork(w, ci)}
                    style={{
                      borderRadius:7, padding:'9px 10px', position:'relative',
                      background: isSel ? (isInter ? '#d5caf7' : '#fcedc7') : col.bg,
                      border:`1.5px solid ${col.border}`,
                      cursor: canBeSrc ? 'pointer' : 'default',
                      boxShadow: isSel
                        ? `0 0 0 3px rgba(107,80,200,.42), outline 2px solid ${col.border}`
                        : undefined,
                      outline: isSel ? `2px solid ${col.border}` : undefined,
                      outlineOffset: isSel ? 1 : undefined,
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

                    {/* Contenuto card */}
                    <div style={{ fontSize:12, fontWeight:700, color:col.text,
                                  paddingRight:40 }}>{w.nome}</div>
                    <div style={{ fontSize:10, color:C.page.t2, marginTop:2,
                                  fontFamily:'IBM Plex Mono, monospace' }}>
                      {w.concVariabile ? 'variabile' : (w.conc ? `${w.conc} mg/L` : '—')}
                      {' · '}{w.volFin || '—'} mL{' · '}{w.solv || '—'}
                    </div>

                    {/* Badge validità */}
                    <span style={{
                      display:'inline-block', fontSize:9, padding:'1px 6px',
                      borderRadius:3, fontWeight:700, marginTop:4,
                      background: w.validitaMesi ? C.sng.chip : '#d3d1c7',
                      color: w.validitaMesi ? C.sng.text : C.page.t2,
                    }}>
                      {w.validitaMesi ? `valida ${w.validitaMesi} mesi` : 'al momento'}
                    </span>

                    {w.op && (
                      <div style={{ fontSize:10, color:C.page.t2, marginTop:2,
                                    fontFamily:'IBM Plex Mono, monospace' }}>
                        Op: {w.op}
                      </div>
                    )}

                    {/* Chips sorgenti */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:5 }}>
                      {w.srcs.map(s => (
                        <span key={s.id} style={{
                          fontSize:9, fontFamily:'IBM Plex Mono, monospace',
                          background:col.chip, color:col.text,
                          borderRadius:2, padding:'1px 4px',
                        }}>{s.nome}</span>
                      ))}
                    </div>

                    {/* Tabella volumi mini */}
                    <div style={{ marginTop:6, borderTop:`1px solid ${C.page.brd}`,
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
            width:38, flexShrink:0, background:C.page.bg, border:'none',
            borderLeft:`1px solid ${C.page.brd}`, cursor:'pointer',
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
                  <div style={{ fontSize:10, color:C.page.th }}>{src.cv} mg/L · CRM</div>
                </div>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.28)', zIndex:200,
      }} />

      {/* Pannello */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:440, maxWidth:'100vw',
        background:C.page.sur, borderLeft:`1px solid ${C.page.brd}`,
        display:'flex', flexDirection:'column',
        boxShadow:'-4px 0 24px rgba(0,0,0,.1)', zIndex:201,
      }}>
        {/* Header */}
        <div style={{ padding:'16px 18px 12px', borderBottom:`1px solid ${C.page.brd}`,
                      flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
                        alignItems:'flex-start', gap:8, marginBottom:8 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.page.t1,
                          lineHeight:1.2 }}>{work.nome}</div>
            <button onClick={onClose} style={{
              width:26, height:26, borderRadius:'50%',
              border:`1px solid ${C.page.brd}`, background:C.page.bg,
              cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:15, color:C.page.t2, flexShrink:0,
            }}>×</button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
            <span style={{
              fontSize:10, padding:'2px 8px', borderRadius:3, fontWeight:700,
              background:col.chip, color:col.text,
            }}>{isInter ? `Intermedia ${colIdx}` : 'Work'}</span>
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
              work.op ? `Op: ${work.op}` : null,
            ].filter(Boolean).map((kv, i) => (
              <span key={i} style={{ fontSize:11, color:C.page.t2,
                                     fontFamily:'IBM Plex Mono, monospace' }}>{kv}</span>
            ))}
          </div>
        </div>

        {/* Azioni */}
        <div style={{ display:'flex', gap:8, padding:'10px 18px',
                      borderBottom:`1px solid ${C.page.brd}`, flexShrink:0 }}>
          <button
            onClick={() => { if (workIdx >= 0) { onDelete(colIdx, workIdx); onClose() } }}
            style={{
              padding:'5px 14px', borderRadius:5,
              border:`1px solid ${C.con.border}`, background:C.page.sur,
              cursor:'pointer', fontSize:12, fontWeight:700,
              fontFamily:'Lato, sans-serif', color:C.con.text,
            }}
          >✕ Elimina</button>
        </div>

        {/* Body scrollabile */}
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px',
                      display:'flex', flexDirection:'column', gap:16 }}>

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

          {/* Catena tracciabilità */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em',
                          marginBottom:6 }}>Catena di tracciabilità</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <ChainNode w={work} ci={colIdx} />
            </div>
          </div>

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
                borderRadius:5, fontSize:12, fontFamily:'Lato, sans-serif',
                outline:'none', background:C.page.bg, color:C.page.t1, marginBottom:8,
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
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principale SchemaCalibrazione
// ─────────────────────────────────────────────────────────────────────────────
export default function SchemaCalibrazione({ metodoId, metodoNome, onClose }: SchemaCalibrazioneProps) {
  const { crmItems, analiti, loading, error } = useSchemaData(metodoId)

  // ── Stato principale ──────────────────────────────────────────────────────
  const [selSrcs,    setSelSrcs]    = useState<Map<string, SorgenteSel>>(new Map())
  const [removedCon, setRemovedCon] = useState<Set<string>>(new Set())
  const [removedMix, setRemovedMix] = useState<Set<string>>(new Set())
  const [workCols,   setWorkCols]   = useState<WorkInSchema[][]>([[]])
  const [modalOpen,  setModalOpen]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [drawerWork, setDrawerWork] = useState<WorkInSchema | null>(null)
  const [drawerCol,  setDrawerCol]  = useState(0)

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
        const crm = crmItems.find(c => c.mix_id === mixId)
        m.set(mixId, { id: mixId, nome: mixId, cv: crm?.cv ?? 0, tipo: 'mix' })
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
      const result = await salvaWorkNelDb(work, metodoId)
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
      const wid  = cols[colIdx]?.[workIdx]?.id
      cols[colIdx].splice(workIdx, 1)
      if (wid) setSelSrcs(p => { const m = new Map(p); m.delete(wid); return m })
      // Rimuovi colonne vuote in coda (mantieni la 0)
      while (cols.length > 1 && cols[cols.length - 1].length === 0) cols.pop()
      return cols
    })
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
      display:'flex', flexDirection:'column', height:'100%', minHeight:0,
      fontFamily:'Lato, sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{ background:C.page.sur, borderBottom:`1px solid ${C.page.brd}`,
                    padding:'10px 18px', display:'flex', alignItems:'center',
                    justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:14, fontWeight:700 }}>Schema Calibrazione</span>
          <span style={{ fontSize:11, color:C.page.t2,
                         fontFamily:'IBM Plex Mono, monospace' }}>{metodoNome}</span>
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
              <div style={{ width:10, height:10, borderRadius:2,
                            background:l.color, border:`1px solid ${l.border}` }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step bar ── */}
      <div style={{ background:C.page.sur, borderBottom:`1px solid ${C.page.brd}`,
                    padding:'7px 18px', display:'flex', alignItems:'center',
                    gap:5, flexShrink:0 }}>
        {steps.map((s, i) => {
          const isDone = s.n < stepStatus
          const isOn   = s.n === stepStatus
          const color  = isDone ? '#3B6D11' : isOn ? '#185FA5' : C.page.th
          return (
            <div key={s.n} style={{ display:'flex', alignItems:'center', gap:5 }}>
              {i > 0 && <div style={{ width:18, height:1, background:C.page.brd }} />}
              <div style={{ display:'flex', alignItems:'center', gap:5,
                            fontSize:11, color, fontWeight: isOn ? 700 : 400,
                            whiteSpace:'nowrap' }}>
                <div style={{
                  width:18, height:18, borderRadius:'50%',
                  border:`1.5px solid ${color}`,
                  background: isDone ? '#3B6D11' : isOn ? '#185FA5' : 'transparent',
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
        <div style={{ flex:1, display:'flex', flexDirection:'row',
                      overflowX:'auto', overflowY:'hidden', minHeight:0 }}>
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
          />
          <ColonneWork
            workCols={workCols}
            selSrcs={selSrcs}
            hasCon={hasCon}
            onToggleWork={toggleWork}
            onDeleteWork={handleDeleteWork}
            onOpenDrawer={(w, ci) => { setDrawerWork(w); setDrawerCol(ci) }}
            onAddCol={() => setWorkCols(prev => [...prev, []])}
          />
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div style={{ background:C.page.sur, borderTop:`1px solid ${C.page.brd}`,
                    padding:'8px 18px', display:'flex', alignItems:'center',
                    justifyContent:'space-between', flexShrink:0 }}>
        <div>
          {hasCon && (
            <span style={{ fontSize:12, color:C.con.text, fontWeight:600 }}>
              ⚠ Ci sono analiti con sia mix che singolo — elimina quelli non voluti con ×
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:11, color:C.page.t2,
                         fontFamily:'IBM Plex Mono, monospace' }}>
            {selSrcs.size} sorgent{selSrcs.size === 1 ? 'e' : 'i'} selezionat{selSrcs.size === 1 ? 'a' : 'e'}
          </span>
          <button onClick={onClose} style={{
            padding:'7px 14px', borderRadius:6, border:`1px solid ${C.page.brd}`,
            background:C.page.sur, cursor:'pointer', fontSize:13,
            fontWeight:700, color:C.page.t2,
          }}>← Chiudi schema</button>
          <div style={{ width:1, height:20, background:C.page.brd }} />
          <button
            onClick={() => setModalOpen(true)}
            disabled={selSrcs.size === 0}
            style={{
              padding:'7px 18px', borderRadius:6, border:'none', cursor:'pointer',
              fontSize:13, fontWeight:700,
              background: selSrcs.size === 0 ? C.page.brd : C.work.border,
              color: selSrcs.size === 0 ? C.page.th : '#fff',
            }}
          >+ Crea Work</button>
        </div>
      </div>

      {/* ── Modal crea Work ── */}
      <ModalCreaWork
        open={modalOpen}
        selSrcs={selSrcs}
        workCols={workCols}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveWork}
        saving={saving}
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
    </div>
  )
}
