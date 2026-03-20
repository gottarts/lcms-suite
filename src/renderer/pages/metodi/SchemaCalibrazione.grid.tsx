// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.grid.tsx  —  Parte 3 / 4
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx
//
// Contiene:
//   - GrigliaAnalitiCrm    → colonne Analiti | Mix CRM | Singoli
//   - ModalCreaWork        → form modale per creare una Work
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AnalitoItem, CrmItem, SorgenteSel, WorkInSchema, RegisterCardRef } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import { getConcInfo, calcolaVols, targetColIdx } from './SchemaCalibrazione.logic'

const ROW = 48 // px altezza riga singola

// ─────────────────────────────────────────────────────────────────────────────
// Griglia Analiti | Mix CRM | Singoli
// ─────────────────────────────────────────────────────────────────────────────
interface GrigliaProps {
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  selSrcs: Map<string, SorgenteSel>
  removedCon: Set<string>    // id singoli rimossi
  removedMix: Set<string>    // mix_id mix rimossi
  onToggleMix: (mixId: string) => void
  onToggleSng: (sngId: string) => void
  onRemoveCon: (sngId: string) => void
  onRemoveMix: (mixId: string) => void
  onClose: () => void        // per chiudere lo schema prima di navigare
  registerCardRef: RegisterCardRef
}

export function GrigliaAnalitiCrm({
  analiti, crmItems, selSrcs, removedCon, removedMix,
  onToggleMix, onToggleSng, onRemoveCon, onRemoveMix, onClose, registerCardRef,
}: GrigliaProps) {
  const navigate = useNavigate()

  const goToComposto = (nome: string) => {
    onClose()
    navigate('/composti', { state: { searchFilter: nome } })
  }

  // mix_id → array nomi analiti
  const mixAnaliti = new Map<string, string[]>()
  for (const a of analiti) {
    if (a.mixId) {
      const arr = mixAnaliti.get(a.mixId) ?? []
      arr.push(a.nome)
      mixAnaliti.set(a.mixId, arr)
    }
  }

  // mix_id → primo CrmItem (per metadati)
  const mixInfo = new Map<string, CrmItem>()
  for (const c of crmItems) {
    if (c.mix_id && !mixInfo.has(c.mix_id)) mixInfo.set(c.mix_id, c)
  }

  // nome analita → CrmItem del mix (per concentrazioni nei chip)
  const mixItemByNome = new Map<string, CrmItem>()
  for (const c of crmItems) {
    if (c.mix_id) mixItemByNome.set(c.nome, c)
  }

  // id (string) → CrmItem per i singoli
  const sngById = new Map<string, CrmItem>()
  for (const c of crmItems) {
    if (!c.mix_id) sngById.set(String(c.id), c)
  }

  // altezza riga = max(1, numero singoli) * ROW
  const rowHeight = (a: AnalitoItem) => Math.max(1, a.sngIds.length) * ROW

  // Posizione verticale assoluta di ogni mix (top e height in px)
  const mixTopPx: Record<string, number>    = {}
  const mixHeightPx: Record<string, number> = {}
  let cumY = 0
  for (const a of analiti) {
    const h = rowHeight(a)
    if (a.mixId) {
      if (mixTopPx[a.mixId] === undefined) mixTopPx[a.mixId] = cumY
      mixHeightPx[a.mixId] = (mixHeightPx[a.mixId] ?? 0) + h
    }
    cumY += h + 1  // +1 per border-bottom
  }
  const totalMixHeight = cumY

  // Prima occorrenza di ogni mix (per decidere dove renderizzare il blocco assoluto)
  const mixFirstAnalita = new Map<string, string>()
  for (const a of analiti) {
    if (a.mixId && !mixFirstAnalita.has(a.mixId)) mixFirstAnalita.set(a.mixId, a.nome)
  }

  // Separatori tra gruppi
  const nSoloSng  = analiti.filter(a => !a.mixId && a.sngIds.length > 0).length
  const nEntrambi = analiti.filter(a =>  a.mixId && a.sngIds.length > 0).length

  return (
    <div style={{ display:'flex', flexDirection:'column', flexShrink:0,
                  background:C.page.sur, margin:8, borderRadius:10,
                  border:`1.5px dashed ${C.page.brd2}`, position:'relative' }}>

      {/* Label sezione */}
      <span style={{
        position:'absolute', top:-9, left:14, background:C.page.bg,
        padding:'0 6px', fontSize:9, fontWeight:700, color:C.page.th,
        textTransform:'uppercase', letterSpacing:'0.08em', zIndex:2,
      }}>CRM &amp; Analiti</span>

      {/* ── Header ── */}
      <div style={{ display:'flex', background:C.page.sur, borderRadius:'10px 10px 0 0',
                    borderBottom:`1px solid ${C.page.brd}`, flexShrink:0 }}>
        {([
          { w:190, label:'Analiti',        sub:`${analiti.length} composti` },
          { w:270, label:'CRM Mix',        sub:'clicca per selezionare', br:true },
          { w:260, label:'Singoli / Neat', sub:'preparazioni non scadute' },
        ] as { w:number; label:string; sub:string; br?:boolean }[]).map((h, i) => (
          <div key={i} style={{ width:h.w, padding:'9px 11px', flexShrink:0,
                                borderRight: h.br ? `1px solid ${C.page.brd}` : undefined }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em' }}>{h.label}</div>
            <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                          fontFamily:'IBM Plex Mono, monospace' }}>{h.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Corpo scrollabile ── */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden',
                    display:'flex', position:'relative' }}>

        {/* Colonna Analiti + Singoli (scorrono insieme) */}
        <div style={{ display:'flex', flexDirection:'column', flexShrink:0 }}>
          {analiti.map((a, i) => {
            const isSepSngEnt = i === nSoloSng && nSoloSng > 0 && nEntrambi > 0
            const isSepEntMix = i === nSoloSng + nEntrambi &&
                                analiti.filter(x => x.mixId && x.sngIds.length === 0).length > 0
            const h = rowHeight(a)

            return (
              <div key={a.nome}>
                {(isSepSngEnt || isSepEntMix) && (
                  <div style={{ height:1, background:C.page.brd2, margin:'4px 0' }} />
                )}

                <div style={{ display:'flex', height:h,
                              borderBottom:`1px solid rgba(0,0,0,.05)`, flexShrink:0 }}>

                  {/* Cella Analita */}
                  <div style={{ width:190, flexShrink:0, padding:'5px 9px',
                                borderRight:`1px solid ${C.page.brd}`,
                                display:'flex', alignItems:'center' }}>
                    <div style={{
                      background: C.ana.bg, border:`1px solid ${C.ana.border}`,
                      borderStyle: a.isIS ? 'dashed' : 'solid',
                      opacity: a.isIS ? 0.68 : 1,
                      borderRadius:6, padding:'4px 8px', fontSize:11,
                      boxShadow:'0 1px 2px rgba(0,0,0,0.06)',
                      fontFamily:'IBM Plex Mono, monospace', whiteSpace:'nowrap',
                      overflow:'hidden', textOverflow:'ellipsis', width:'100%',
                    }}>
                      {a.nome}{a.isIS ? ' [IS]' : ''}
                    </div>
                  </div>

                  {/* Placeholder Mix (il blocco vero è assoluto) */}
                  <div style={{ width:270, flexShrink:0,
                                borderRight:`1px solid ${C.page.brd}` }} />

                  {/* Cella Singoli — una card per sngId */}
                  <div style={{ width:260, flexShrink:0, padding:'3px 6px',
                                display:'flex', flexDirection:'column', gap:3,
                                justifyContent:'center' }}>
                    {a.sngIds.map(sngId => {
                      const crm   = sngById.get(sngId)
                      if (!crm) return null
                      const isRem = removedCon.has(sngId)
                      const isSel = selSrcs.has(sngId)
                      // duplicato attivo = ha anche un mix non rimosso
                      const isCon = a.isCon && !!a.mixId && !removedMix.has(a.mixId)
                      return (
                        <div
                          key={sngId}
                          ref={el => registerCardRef(sngId, el)}
                          onClick={() => !isRem && onToggleSng(sngId)}
                          style={{
                            borderRadius:8, padding:'5px 8px',
                            background: isRem ? C.page.sur
                              : (isCon ? C.con.bg : (isSel ? '#b4d97c' : C.sng.bg)),
                            border:`1.5px solid ${isCon ? C.con.border : C.sng.border}`,
                            borderLeft:`3px solid ${isCon ? C.con.border : C.sng.border}`,
                            borderStyle: a.isIS ? 'dashed' : 'solid',
                            boxShadow: isSel ? '0 0 0 2px rgba(59,109,17,.28)' : '0 1px 3px rgba(0,0,0,0.08)',
                            opacity: isRem ? 0.28 : 1,
                            textDecoration: isRem ? 'line-through' : undefined,
                            cursor: isRem ? 'default' : 'pointer',
                            display:'flex', alignItems:'center',
                            justifyContent:'space-between', gap:4,
                            transition:'box-shadow .12s, background .1s',
                          }}
                        >
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:10, fontWeight:700,
                                          fontFamily:'IBM Plex Mono, monospace',
                                          color: isCon ? C.con.text : C.sng.text,
                                          whiteSpace:'nowrap', overflow:'hidden',
                                          textOverflow:'ellipsis' }}>
                              {crm.cv ? `${crm.cv} mg/L` : '—'}
                              {crm.forma ? ` · ${crm.forma}` : ''}
                            </div>
                            <div style={{ fontSize:9, color:C.page.th,
                                          fontFamily:'IBM Plex Mono, monospace' }}>
                              {crm.lotto ?? '—'}
                              {crm.scadenza_prodotto ? ` · scad. ${crm.scadenza_prodotto}` : ''}
                            </div>
                          </div>
                          {!isRem && (
                            <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                              <button
                                onClick={e => { e.stopPropagation(); goToComposto(crm.nome) }}
                                style={{
                                  width:15, height:15, borderRadius:3,
                                  border:`1px solid ${C.sng.border}`,
                                  background:'#fff', color:C.sng.text,
                                  cursor:'pointer', display:'flex', alignItems:'center',
                                  justifyContent:'center', fontSize:9,
                                }}
                                title="Vedi nel DB composti"
                              >↗</button>
                              <button
                                onClick={e => { e.stopPropagation(); onRemoveCon(sngId) }}
                                style={{
                                  width:15, height:15, borderRadius:'50%',
                                  border:`1.5px solid ${isCon ? C.con.border : C.sng.border}`,
                                  background:'#fff',
                                  color: isCon ? C.con.text : C.sng.text,
                                  cursor:'pointer', display:'flex', alignItems:'center',
                                  justifyContent:'center', fontSize:11, fontWeight:700,
                                }}
                                title="Rimuovi dallo schema"
                              >×</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                </div>
              </div>
            )
          })}
        </div>

        {/* Blocchi Mix in position:absolute rispetto al corpo scrollabile */}
        <div style={{
          position:'absolute', left:190, width:270,
          height: totalMixHeight, pointerEvents:'none',
        }}>
          {analiti.map(a => {
            if (!a.mixId || mixFirstAnalita.get(a.mixId) !== a.nome) return null
            const info   = mixInfo.get(a.mixId)
            const sel    = selSrcs.has(a.mixId)
            const isRmMx = removedMix.has(a.mixId)
            const nomi   = mixAnaliti.get(a.mixId) ?? []
            const top    = mixTopPx[a.mixId] ?? 0
            const height = mixHeightPx[a.mixId] ?? ROW
            return (
              <div
                key={a.mixId}
                ref={el => registerCardRef(a.mixId!, el)}
                onClick={() => !isRmMx && onToggleMix(a.mixId!)}
                style={{
                  position:'absolute', left:8, right:8,
                  top: top + 5, height: height - 10,
                  borderRadius:8,
                  background: isRmMx ? C.page.sur : (sel ? '#cee3f8' : C.mix.bg),
                  border:`1.5px solid ${C.mix.border}`,
                  borderLeft:`3px solid ${C.mix.border}`,
                  padding:'6px 9px',
                  boxShadow: sel ? '0 0 0 3px rgba(24,95,165,.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                  cursor: isRmMx ? 'default' : 'pointer',
                  opacity: isRmMx ? 0.28 : 1,
                  textDecoration: isRmMx ? 'line-through' : undefined,
                  overflow:'hidden', zIndex:2, pointerEvents:'all',
                  transition:'box-shadow .12s, background .1s',
                }}
              >
                {!isRmMx && (
                  <div style={{ position:'absolute', top:4, right:4,
                                display:'flex', gap:3, zIndex:3 }}>
                    <button
                      onClick={e => { e.stopPropagation(); goToComposto(a.mixId!) }}
                      style={{
                        width:15, height:15, borderRadius:3,
                        border:`1px solid ${C.mix.border}`,
                        background:'#fff', color:C.mix.text,
                        cursor:'pointer', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:9,
                      }}
                      title="Vedi nel DB composti"
                    >↗</button>
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveMix(a.mixId!) }}
                      style={{
                        width:15, height:15, borderRadius:'50%',
                        border:`1.5px solid ${C.mix.border}`,
                        background:'#fff', color:C.mix.text,
                        cursor:'pointer', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:11, fontWeight:700,
                      }}
                      title="Rimuovi questo CRM dallo schema"
                    >×</button>
                  </div>
                )}
                <div style={{ fontSize:11, fontWeight:700,
                              fontFamily:'IBM Plex Mono, monospace',
                              color:C.mix.text, paddingRight: isRmMx ? 0 : 42 }}>
                  {info?.mix ?? info?.mix_id ?? a.mixId}
                </div>
                <div style={{ fontSize:10, color:C.page.t2, marginTop:2 }}>
                  {info?.produttore ?? ''}{info?.lotto ? ` · ${info.lotto}` : ''}
                </div>
                <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                              fontFamily:'IBM Plex Mono, monospace' }}>
                  {info?.cv ? `${info.cv} mg/L` : ''}
                  {info?.scadenza_prodotto ? ` · scad. ${info.scadenza_prodotto}` : ''}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:5 }}>
                  {nomi.map(n => {
                    const analitoN = analiti.find(x => x.nome === n)
                    const allRem   = !!analitoN && analitoN.sngIds.length > 0
                                     && analitoN.sngIds.every(id => removedCon.has(id))
                    const mixItem  = mixItemByNome.get(n)
                    const concLabel = mixItem?.cv ? ` · ${mixItem.cv} mg/L` : ''
                    return (
                      <span key={n} style={{
                        fontSize:9, fontFamily:'IBM Plex Mono, monospace',
                        background:C.mix.chip, color:C.mix.text,
                        borderRadius:2, padding:'1px 4px',
                        opacity: allRem ? 0.3 : 1,
                        textDecoration: allRem ? 'line-through' : undefined,
                      }}>{n}{concLabel}</span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal "Crea Work"
// ─────────────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  selSrcs: Map<string, SorgenteSel>
  workCols: WorkInSchema[][]
  onClose: () => void
  onSave: (w: Omit<WorkInSchema, 'id' | 'dbId'>) => Promise<void>
  saving: boolean
}

export function ModalCreaWork({ open, selSrcs, workCols, onClose, onSave, saving }: ModalProps) {
  const [nome,        setNome]       = useState('')
  const [volFin,      setVolFin]     = useState('')
  const [solv,        setSolv]       = useState('MeOH')
  const [validita,    setValidita]   = useState('')
  const [op,          setOp]         = useState('')
  const [customMode,  setCustomMode] = useState(false)
  // Map id → valore inserito dall'utente
  const [customVals,  setCustomVals] = useState<Map<string,string>>(new Map())
  const [valUnico,    setValUnico]   = useState('')
  const nomeRef = useRef<HTMLInputElement>(null)

  const srcs = Array.from(selSrcs.values())
  const tgt  = targetColIdx(selSrcs)
  const isInter = tgt > 0
  const hasVar  = srcs.some(s => !getConcInfo(s, workCols).omogenea)

  // Reset quando il modal si apre
  useEffect(() => {
    if (open) {
      setNome(''); setVolFin(''); setSolv('MeOH'); setValidita(''); setOp('')
      setCustomMode(false); setCustomVals(new Map()); setValUnico('')
      setTimeout(() => nomeRef.current?.focus(), 80)
    }
  }, [open])

  const getValori = (): Map<string, number> => {
    const m = new Map<string, number>()
    if (customMode) {
      srcs.forEach(s => { const v = parseFloat(customVals.get(s.id) ?? ''); if (v) m.set(s.id, v) })
    } else {
      const v = parseFloat(valUnico); if (v) srcs.forEach(s => m.set(s.id, v))
    }
    return m
  }

  const vols = calcolaVols(
    srcs, workCols, getValori(), customMode, parseFloat(valUnico) || 0, parseFloat(volFin) || 0
  )
  const usedVol  = vols.reduce((a, v) => a + v.vol, 0)
  const solvVol  = Math.max(0, (parseFloat(volFin) || 0) - usedVol)
  const overflow = usedVol > (parseFloat(volFin) || 0) + 0.001

  const concNominale = (() => {
    if (customMode || hasVar) return null
    const v = parseFloat(valUnico); return v > 0 ? v : null
  })()
  const concVariabile = hasVar || (customMode && vols.some(v => v.modo === 'dil'))

  const handleSave = async () => {
    if (!nome.trim()) { nomeRef.current?.focus(); return }
    await onSave({
      nome: nome.trim(),
      conc: concNominale,
      concVariabile,
      unitaConc: 'mg/L',
      volFin: parseFloat(volFin) || 0,
      solv: solv.trim(),
      validitaMesi: validita ? parseInt(validita) : null,
      op: op.trim(),
      srcs,
      vols,
    })
  }

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'6px 9px', border:`1px solid ${C.page.brd}`,
    borderRadius:5, fontSize:13, fontFamily:'Lato, sans-serif',
    color:C.page.t1, background:C.page.bg, outline:'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize:10, fontWeight:700, color:C.page.t2,
    textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3, display:'block',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
      }}
    >
      <div style={{
        background:C.page.sur, borderRadius:10, width:430, maxWidth:'95vw',
        maxHeight:'88vh', overflowY:'auto', padding:22,
        boxShadow:'0 8px 32px rgba(0,0,0,.2)',
      }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>
          {isInter ? 'Nuova Work intermedia' : 'Nuova Work'}
        </div>
        <div style={{ fontSize:11, color:C.page.t2, marginBottom:14,
                      fontFamily:'IBM Plex Mono, monospace' }}>
          {isInter
            ? 'Diluisce Work precedenti e/o CRM — di solito senza validità'
            : 'Da CRM selezionati — aggiungi validità per tracciarla'}
        </div>

        {srcs.length === 0 ? (
          <div style={{ fontSize:11, color:C.con.text, background:C.con.bg,
                        border:`1px solid ${C.con.border}`, borderRadius:4,
                        padding:'6px 9px', marginBottom:10 }}>
            Nessuna sorgente selezionata.
          </div>
        ) : (
          <>
            {/* Toggle + lista sorgenti */}
            <div style={{ display:'flex', justifyContent:'space-between',
                          alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:10, fontWeight:700, color:C.page.t2,
                             textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Sorgenti selezionate
              </span>
              <label style={{ display:'flex', alignItems:'center', gap:6,
                              fontSize:11, color:C.page.t2, cursor:'pointer' }}>
                Valori per sorgente
                <input type="checkbox" checked={customMode}
                  onChange={e => { setCustomMode(e.target.checked); setValUnico('') }} />
              </label>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:3,
                          marginBottom:12, maxHeight:120, overflowY:'auto' }}>
              {srcs.map(s => {
                const info  = getConcInfo(s, workCols)
                const isVar = !info.omogenea
                return (
                  <div key={s.id} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    background: s.tipo === 'work' ? C.inter.bg : C.page.bg,
                    border:`1px solid ${s.tipo === 'work' ? C.inter.border : C.page.brd}`,
                    borderRadius:4, padding:'4px 8px', fontSize:11,
                    fontFamily:'IBM Plex Mono, monospace',
                  }}>
                    <span style={{ fontWeight:500,
                                   color: s.tipo === 'work' ? C.inter.text : C.page.t1 }}>
                      {s.nome}
                    </span>
                    <span style={{ color:C.page.th, fontStyle: isVar ? 'italic' : undefined }}>
                      {info.label}
                    </span>
                    {customMode && (
                      <input
                        type="number" step={isVar ? '1' : '0.001'}
                        placeholder={isVar ? '÷N' : 'mg/L'}
                        value={customVals.get(s.id) ?? ''}
                        onChange={e => {
                          const m = new Map(customVals); m.set(s.id, e.target.value)
                          setCustomVals(m)
                        }}
                        style={{ ...inputStyle, width:80, marginLeft:8 }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Campi form */}
        <div style={{ marginBottom:10 }}>
          <label style={labelStyle}>Nome *</label>
          <input ref={nomeRef} style={inputStyle} placeholder="es. Work PFAS taratura gen-2026"
            value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={labelStyle}>
              {!customMode
                ? (hasVar ? 'Fattore diluizione (÷N)' : 'Conc. target (mg/L)')
                : 'Valore unico (disabilitato)'}
            </label>
            <input type="number" step={hasVar ? '1' : '0.001'}
              placeholder={hasVar ? 'es. 10' : 'es. 1'}
              disabled={customMode}
              value={valUnico} onChange={e => setValUnico(e.target.value)}
              style={{ ...inputStyle, opacity: customMode ? 0.4 : 1 }} />
          </div>
          <div>
            <label style={labelStyle}>Volume finale (mL)</label>
            <input type="number" step="0.1" placeholder="es. 10"
              value={volFin} onChange={e => setVolFin(e.target.value)}
              style={inputStyle} />
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={labelStyle}>Solvente</label>
            <input style={inputStyle} placeholder="es. MeOH"
              value={solv} onChange={e => setSolv(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Validità (mesi)</label>
            <input type="number" step="1" min="1" placeholder="vuoto = al momento"
              value={validita} onChange={e => setValidita(e.target.value)}
              style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={labelStyle}>Operatore</label>
          <input style={inputStyle} placeholder="es. Mario Rossi"
            value={op} onChange={e => setOp(e.target.value)} />
        </div>

        {/* Preview calcoli */}
        {srcs.length > 0 && parseFloat(volFin) > 0 && (
          <div style={{
            background:C.work.bg, border:`1px solid ${C.work.border}`,
            borderRadius:6, padding:'9px 11px', marginBottom:10,
            fontSize:11, fontFamily:'IBM Plex Mono, monospace',
          }}>
            <div style={{ fontWeight:700, color:C.work.text, marginBottom:5, fontSize:12 }}>
              Volumi di prelievo
            </div>
            {vols.map(v => (
              <div key={v.nome} style={{ display:'flex', justifyContent:'space-between',
                                         color:C.page.t2, padding:'1px 0' }}>
                <span>
                  {v.nome}&nbsp;
                  <small style={{ opacity:0.6 }}>
                    {v.modo === 'conc' ? `${v.concTarget} mg/L` : `÷${v.dilFactor}`}
                  </small>
                </span>
                <span style={{ fontWeight:500, color:C.page.t1 }}>{v.vol.toFixed(3)} mL</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between',
                          borderTop:`1px dashed ${C.page.brd}`, marginTop:4, paddingTop:4 }}>
              <span>{solv || 'Solvente'} (completamento)</span>
              <span style={{ fontWeight:500 }}>{solvVol.toFixed(3)} mL</span>
            </div>
            {overflow && (
              <div style={{ color:'#a32d2d', fontWeight:700, marginTop:4 }}>
                ⚠ I prelievi ({usedVol.toFixed(3)} mL) superano il volume finale
              </div>
            )}
          </div>
        )}

        {/* Badge validità */}
        {validita ? (
          <div style={{ fontSize:11, color:C.sng.text, background:C.sng.chip,
                        display:'inline-block', padding:'2px 8px', borderRadius:3,
                        fontWeight:700, marginBottom:10 }}>
            → Work tracciata · valida {validita} mesi · verrà salvata nel DB
          </div>
        ) : (
          <div style={{ fontSize:11, color:C.page.th, marginBottom:10,
                        fontStyle:'italic' }}>
            Senza validità → al momento (non salvata nel DB)
          </div>
        )}

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14 }}>
          <button onClick={onClose} style={{
            padding:'6px 14px', borderRadius:5, border:`1px solid ${C.page.brd}`,
            background:C.page.sur, color:C.page.t2, cursor:'pointer',
            fontSize:13, fontWeight:700,
          }}>Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            style={{
              padding:'6px 14px', borderRadius:5, border:'none',
              background: saving || !nome.trim() ? C.page.brd : C.work.border,
              color:'#fff', cursor: saving || !nome.trim() ? 'not-allowed' : 'pointer',
              fontSize:13, fontWeight:700,
            }}
          >{saving ? 'Salvataggio…' : 'Salva Work'}</button>
        </div>
      </div>
    </div>
  )
}
