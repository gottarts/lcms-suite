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
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AnalitoItem, CrmItem, SorgenteSel, WorkInSchema, RegisterCardRef } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import { getConcInfo, calcolaVols, targetColIdx, getCompsFromWork, computeMixFragmentsAndLanes } from './SchemaCalibrazione.logic'

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
  gridBodyRef?: React.RefObject<HTMLDivElement | null>
}

export function GrigliaAnalitiCrm({
  analiti, crmItems, selSrcs, removedCon, removedMix,
  onToggleMix, onToggleSng, onRemoveCon, onRemoveMix, onClose, registerCardRef, gridBodyRef,
}: GrigliaProps) {
  const navigate = useNavigate()

  const goToComposto = (nome: string, mostraDismessi: boolean) => {
    onClose()
    navigate('/composti', { state: { searchFilter: nome, mostraDismessi } })
  }

  // mix_id → array nomi analiti (include sia mix primari che secondari)
  const mixAnaliti = new Map<string, string[]>()
  for (const a of analiti) {
    for (const mid of a.mixIds) {
      const arr = mixAnaliti.get(mid) ?? []
      arr.push(a.nome)
      mixAnaliti.set(mid, arr)
    }
  }

  // mix_id → tutti i nomi componenti del mix (contenuto reale, inclusi non-analiti)
  const mixAllComps = new Map<string, string[]>()
  for (const c of crmItems) {
    if (c.mix_id) {
      const arr = mixAllComps.get(c.mix_id) ?? []
      if (!arr.includes(c.nome)) arr.push(c.nome)
      mixAllComps.set(c.mix_id, arr)
    }
  }

  // mix_id → primo CrmItem (per metadati)
  const mixInfo = new Map<string, CrmItem>()
  for (const c of crmItems) {
    if (c.mix_id && !mixInfo.has(c.mix_id)) mixInfo.set(c.mix_id, c)
  }

  // mix_id → set di cv distinti (per rilevare mix eterogenei)
  const mixCvSets = new Map<string, Set<number>>()
  for (const c of crmItems) {
    if (c.mix_id) {
      const s = mixCvSets.get(c.mix_id) ?? new Set<number>()
      s.add(c.cv)
      mixCvSets.set(c.mix_id, s)
    }
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

  // Stima altezza reale di una card singolo in base al contenuto
  const sngCardH = (crm: CrmItem): number => {
    let h = 14 + 10 // riga cv/forma + padding top+bottom
    if (crm.lotto)                h += 13
    if (crm.scadenza_prodotto)    h += 13
    if (crm.ultima_rivalidazione) h += 13
    return h
  }

  // Stima altezza naturale di una cella singoli (padding cella + cards + gap)
  const sngCellH = (a: AnalitoItem): number => {
    if (a.sngIds.length === 0) return ROW
    const cards = a.sngIds
      .map(id => sngById.get(id))
      .filter((c): c is CrmItem => !!c)
    const totalCards = cards.reduce((s, c) => s + sngCardH(c), 0)
    const gaps       = Math.max(0, cards.length - 1) * 3 // gap:3 tra cards
    return totalCards + gaps + 6 // padding cella 3px top + 3px bottom
  }

  // Fase 1: altezza totale del contenuto della chips mix (simula flex-wrap)
  const mixChipsH: Record<string, number> = {}
  for (const [mixId, comps] of mixAllComps.entries()) {
    const nAna = (mixAnaliti.get(mixId) ?? []).length
    if (nAna === 0) continue
    const CHIP_AREA = 236 // card 254px - padding 18px
    let rw = 0, cr = 1
    for (const name of comps) {
      const ci = mixItemByNome.get(name)
      const lbl = ci?.cv ? `${name} · ${ci.cv} mg/L` : name
      const cw = lbl.length * 6 + 14 // char ~6px (IBM Plex Mono 9px) + padding 14px
      if (rw > 0 && rw + 2 + cw > CHIP_AREA) { cr++; rw = cw }
      else { rw += (rw > 0 ? 2 : 0) + cw }
    }
    mixChipsH[mixId] = 62 + cr * 18 + 20 // header + chip rows + padding — totale (non per-riga)
  }

  // Fase 2: altezze righe per ogni analita del mix
  // Se la somma delle altezze naturali (nSingoli * ROW) < altezza chips → scala proporzionalmente
  const mixRowHeights = new Map<string, number[]>()
  for (const [mixId, anaArr] of mixAnaliti.entries()) {
    const chipH = mixChipsH[mixId] ?? 0
    const naturals = anaArr.map(nome => {
      const a = analiti.find(x => x.nome === nome)
      return a ? Math.max(ROW, sngCellH(a)) : ROW
    })
    const sumNat = naturals.reduce((s, h) => s + h, 0)
    if (sumNat >= chipH) {
      mixRowHeights.set(mixId, naturals)
    } else {
      // Scala proporzionalmente: la somma deve coprire chipH
      const scale = chipH / sumNat
      mixRowHeights.set(mixId, naturals.map(h => Math.round(h * scale)))
    }
  }

  // altezza riga: per analiti con mix usa mixRowHeights del mix primario (mixIds[0])
  const rowHeight = (a: AnalitoItem): number => {
    if (a.mixIds.length === 0) return Math.max(ROW, sngCellH(a))
    const primaryMid = a.mixIds[0]
    const anaArr  = mixAnaliti.get(primaryMid) ?? []
    const idx     = anaArr.indexOf(a.nome)
    const heights = mixRowHeights.get(primaryMid)
    if (heights && idx >= 0) return heights[idx]
    return Math.max(1, a.sngIds.length) * ROW
  }

  // Separatori tra gruppi
  const nSoloSng    = analiti.filter(a => a.mixIds.length === 0 && a.sngIds.length > 0).length
  const nConMix     = analiti.filter(a => a.mixIds.length > 0).length
  const hasSenzaCrm = analiti.some(a => a.mixIds.length === 0 && a.sngIds.length === 0)
  const hasConMix   = nConMix > 0

  // Calcola posizioni verticali righe (per lane assignment)
  let cumY = 0
  const rowTopsArr: number[] = []
  const sepAtRow: number[] = []
  for (let i = 0; i < analiti.length; i++) {
    const hasSep = (i === nSoloSng && nSoloSng > 0 && hasConMix) ||
                   (i === nSoloSng + nConMix && nConMix > 0 && hasSenzaCrm)
    sepAtRow.push(hasSep ? 9 : 0)
    if (hasSep) cumY += 9
    rowTopsArr.push(cumY)
    cumY += rowHeight(analiti[i])
  }
  const totalMixHeight = cumY

  // Lane assignment: calcola frammenti e corsie per tutti i mix
  const { fragments, totalLanes } = computeMixFragmentsAndLanes(
    analiti,
    a => rowHeight(a),
    i  => sepAtRow[i] ?? 0,
  )
  const LANE_W = 270  // larghezza fissa per corsia — la colonna si allarga e scrolla

  // Raggruppa frammenti per mix_id (per connettori SVG)
  const fragmentsByMix = new Map<string, typeof fragments>()
  for (const frag of fragments) {
    const arr = fragmentsByMix.get(frag.mixId) ?? []
    arr.push(frag)
    fragmentsByMix.set(frag.mixId, arr)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flexShrink:0,
                  minHeight:0,
                  background:C.page.sur, margin:0, borderRadius:12,
                  border:`1.5px dashed ${C.page.brd2}`, position:'relative',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>

      {/* Label sezione */}
      <span style={{
        position:'absolute', top:-9, left:16, background:C.page.bg,
        padding:'0 8px', fontSize:9, fontWeight:600, color:C.page.th,
        textTransform:'uppercase', letterSpacing:'0.1em', zIndex:2,
      }}>CRM &amp; Analiti</span>

      {/* ── Header ── */}
      <div style={{ display:'flex', background:C.page.sur, borderRadius:'12px 12px 0 0',
                    borderBottom:'1px solid rgba(0,0,0,0.06)', flexShrink:0 }}>
        {([
          { w:190,              label:'Analiti',        sub:`${analiti.length} composti` },
          { w:270 * totalLanes, label:'CRM Mix',        sub:'clicca per selezionare', br:true },
          { w:260,              label:'Singoli / Neat', sub:'preparazioni non scadute' },
        ] as { w:number; label:string; sub:string; br?:boolean }[]).map((h, i) => (
          <div key={i} style={{ width:h.w, padding:'9px 11px', flexShrink:0,
                                borderRight: h.br ? `1px solid ${C.page.brd}` : undefined }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em' }}>{h.label}</div>
            <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                          fontFamily:'IBM Plex Mono, monospace' }}>{h.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Corpo scrollabile ── */}
      <div ref={gridBodyRef} style={{ flex:1, overflowY:'auto', overflowX:'auto',
                    display:'flex', position:'relative' }}>

        {/* Colonna Analiti + Singoli (scorrono insieme) */}
        <div style={{ display:'flex', flexDirection:'column', flexShrink:0 }}>
          {analiti.map((a, i) => {
            const isSepSngMix  = i === nSoloSng && nSoloSng > 0 && hasConMix
            const isSepSenzaCrm = i === nSoloSng + nConMix && nConMix > 0 && hasSenzaCrm
            const senzaCrm = a.mixIds.length === 0 && a.sngIds.length === 0
            const h = rowHeight(a)

            return (
              <div key={a.nome}>
                {(isSepSngMix || isSepSenzaCrm) && (
                  <div style={{ height:1, background:C.page.brd2, margin:'4px 0' }} />
                )}

                <div style={{ display:'flex', height:h,
                              borderBottom:`1px solid rgba(0,0,0,.05)`, flexShrink:0 }}>

                  {/* Cella Analita */}
                  <div style={{ width:190, flexShrink:0, padding:'5px 9px',
                                borderRight:`1px solid ${C.page.brd}`,
                                display:'flex', alignItems:'center' }}>
                    <div style={{
                      background: senzaCrm ? C.page.sur : C.ana.bg,
                      border:`1px ${senzaCrm ? 'dashed' : (a.isIS ? 'dashed' : 'solid')} ${senzaCrm ? C.page.brd : C.ana.border}`,
                      opacity: senzaCrm ? 0.4 : (a.isIS ? 0.68 : 1),
                      borderRadius:8, padding:'4px 8px', fontSize:11,
                      fontFamily:'IBM Plex Mono, monospace', width:'100%',
                      color: senzaCrm ? C.page.th : undefined,
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:4,
                    }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
                        {a.nome}{a.isIS ? ' [IS]' : ''}{senzaCrm ? ' ·' : ''}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); goToComposto(a.nome, senzaCrm) }}
                        title="Apri nel DB Composti"
                        style={{
                          flexShrink:0, background:'none', border:'none', cursor:'pointer',
                          padding:'0 1px', fontSize:10, opacity:0.55, color:'inherit', lineHeight:1,
                        }}
                      >↗</button>
                    </div>
                  </div>

                  {/* Placeholder Mix (il blocco vero è assoluto) */}
                  <div style={{ width:270 * totalLanes, flexShrink:0,
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
                      const isCon = a.isCon && a.mixIds.length > 0 && a.mixIds.some(id => !removedMix.has(id))
                      return (
                        <div
                          key={sngId}
                          ref={el => registerCardRef(sngId, el)}
                          onClick={() => !isRem && onToggleSng(sngId)}
                          style={{
                            borderRadius:10, padding:'5px 8px',
                            background: isRem ? C.page.sur
                              : (isCon ? C.con.bg : (isSel ? '#c8e8a8' : C.sng.bg)),
                            border:`1.5px solid ${isCon ? C.con.border : C.sng.border}`,
                            borderLeft:`3px solid ${isCon ? C.con.border : C.sng.border}`,
                            borderStyle: a.isIS ? 'dashed' : 'solid',
                            boxShadow: isSel ? '0 0 0 2px rgba(125,184,90,.35)' : '0 1px 2px rgba(0,0,0,0.04)',
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
                            {crm.lotto && (
                              <div style={{ fontSize:9, color:C.page.t2,
                                            fontFamily:'IBM Plex Mono, monospace' }}>
                                {crm.lotto}
                              </div>
                            )}
                            {crm.scadenza_prodotto && (
                              <div style={{ fontSize:9, color:C.page.th,
                                            fontFamily:'IBM Plex Mono, monospace' }}>
                                scad. {crm.scadenza_prodotto}
                              </div>
                            )}
                            {crm.ultima_rivalidazione && (
                              <div style={{ fontSize:9, color:'#b45309',
                                            fontFamily:'IBM Plex Mono, monospace' }}>
                                Rivalidato · scad. est. {crm.ultima_rivalidazione}
                              </div>
                            )}
                          </div>
                          {!isRem && (
                            <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                              <button
                                onClick={e => { e.stopPropagation(); goToComposto(crm.nome, false) }}
                                style={{
                                  width:15, height:15, borderRadius:3,
                                  border:`1px solid ${C.page.brd}`,
                                  background:'#fff', color:C.page.t2,
                                  cursor:'pointer', display:'flex', alignItems:'center',
                                  justifyContent:'center', fontSize:9,
                                }}
                                title="Vedi nel DB composti"
                              >↗</button>
                              <button
                                onClick={e => { e.stopPropagation(); onRemoveCon(sngId) }}
                                style={{
                                  width:15, height:15, borderRadius:'50%',
                                  border:`1.5px solid ${C.page.brd}`,
                                  background:'#fff',
                                  color: C.page.t2,
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

        {/* Blocchi Mix in position:absolute — lane system */}
        <div style={{
          position:'absolute', left:190, width: LANE_W * Math.min(totalLanes, 4),
          height: totalMixHeight, pointerEvents:'none', overflow:'hidden',
        }}>
          {/* Frammenti mix */}
          {fragments.map((frag, idx) => {
            const info     = mixInfo.get(frag.mixId)
            const sel      = selSrcs.has(frag.mixId)
            const isRmMx   = removedMix.has(frag.mixId)
            const allComps = frag.isFirst ? (mixAllComps.get(frag.mixId) ?? []) : []
            const analitiSet = frag.isFirst ? new Set(mixAnaliti.get(frag.mixId) ?? []) : new Set<string>()
            const cardLeft = frag.lane * LANE_W + 8
            const cardW    = LANE_W - 16
            const showChips = frag.isFirst && frag.heightPx > 60
            return (
              <div
                key={`${frag.mixId}-${idx}`}
                ref={frag.isFirst ? el => registerCardRef(frag.mixId, el) : undefined}
                onClick={() => !isRmMx && onToggleMix(frag.mixId)}
                style={{
                  position:'absolute',
                  left: cardLeft, width: cardW,
                  top: frag.topPx + 5, height: frag.heightPx - 10,
                  borderRadius:10,
                  background: isRmMx ? C.page.sur : (sel ? '#d4e8fa' : C.mix.bg),
                  border:`1.5px solid ${C.mix.border}`,
                  borderLeft:`3px solid ${C.mix.border}`,
                  padding:'6px 9px',
                  boxShadow: sel ? '0 0 0 2px rgba(107,163,214,.35)' : '0 1px 2px rgba(0,0,0,0.04)',
                  cursor: isRmMx ? 'default' : 'pointer',
                  opacity: isRmMx ? 0.28 : 1,
                  textDecoration: isRmMx ? 'line-through' : undefined,
                  overflow:'hidden', zIndex:2, pointerEvents:'all',
                  transition:'box-shadow .12s, background .1s',
                }}
              >
                {/* Pulsanti ↗ e × solo sul primo frammento */}
                {frag.isFirst && !isRmMx && (
                  <div style={{ position:'absolute', top:4, right:4,
                                display:'flex', gap:3, zIndex:3 }}>
                    <button
                      onClick={e => { e.stopPropagation(); goToComposto(frag.mixId, false) }}
                      style={{
                        width:15, height:15, borderRadius:3,
                        border:`1px solid ${C.page.brd}`,
                        background:'#fff', color:C.page.t2,
                        cursor:'pointer', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:9,
                      }}
                      title="Vedi nel DB composti"
                    >↗</button>
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveMix(frag.mixId) }}
                      style={{
                        width:15, height:15, borderRadius:'50%',
                        border:`1.5px solid ${C.page.brd}`,
                        background:'#fff', color:C.page.t2,
                        cursor:'pointer', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:11, fontWeight:700,
                      }}
                      title="Rimuovi questo CRM dallo schema"
                    >×</button>
                  </div>
                )}

                {frag.isFirst ? (
                  <>
                    <div style={{ fontSize:11, fontWeight:700,
                                  fontFamily:'IBM Plex Mono, monospace',
                                  color:C.mix.text,
                                  paddingRight: isRmMx ? 0 : 42,
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {info?.mix ?? info?.mix_id ?? frag.mixId}
                    </div>
                    <div style={{ fontSize:10, color:C.page.t2, marginTop:2 }}>
                      {info?.produttore ?? ''}
                    </div>
                    {info?.lotto && (
                      <div style={{ fontSize:9, color:C.page.t2, marginTop:1,
                                    fontFamily:'IBM Plex Mono, monospace' }}>
                        {info.lotto}
                      </div>
                    )}
                    <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                                  fontFamily:'IBM Plex Mono, monospace' }}>
                      {(mixCvSets.get(frag.mixId)?.size ?? 0) <= 1 && info?.cv ? `${info.cv} mg/L` : ''}
                      {info?.scadenza_prodotto ? ` · scad. ${info.scadenza_prodotto}` : ''}
                    </div>
                    {info?.ultima_rivalidazione && (
                      <div style={{ fontSize:10, color:'#b45309', marginTop:2,
                                    fontFamily:'IBM Plex Mono, monospace' }}>
                        Rivalidato · scad. est. {info.ultima_rivalidazione}
                      </div>
                    )}
                    {showChips && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:5 }}>
                        {allComps.map(n => {
                          const mixItem   = mixItemByNome.get(n)
                          const concLabel = mixItem?.cv ? ` · ${mixItem.cv} mg/L` : ''
                          const isAnalita = analitiSet.has(n)
                          return (
                            <span key={n} style={{
                              fontSize:9, fontFamily:'IBM Plex Mono, monospace',
                              background: isAnalita ? C.mix.chip : 'rgba(212,232,250,0.4)',
                              color: isAnalita ? C.mix.text : C.page.t2,
                              borderRadius:4, padding:'2px 6px',
                              opacity: isAnalita ? 1 : 0.7,
                            }}>{n}{concLabel}</span>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  /* Frammento non-primo: nome del mix (full width, stesso stile) */
                  <div style={{ fontSize:11, fontWeight:700,
                                fontFamily:'IBM Plex Mono, monospace',
                                color:C.mix.text, opacity:0.7,
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {info?.mix ?? frag.mixId}
                  </div>
                )}
              </div>
            )
          })}

          {/* Linee SVG di connessione tra frammenti dello stesso mix */}
          {(() => {
            // Palette colori per connettori (visivamente distinti)
            const CONN_COLORS = [
              '#6ba3d6', '#e08050', '#7db85a', '#9b86d6',
              '#c49540', '#d06090', '#50a8c0', '#a05050',
            ]
            // Per ogni corsia, calcola quanti mix hanno connettori e assegna sub-indice
            // sub-indice → x offset entro la corsia per separare le linee
            const laneSubIdx   = new Map<string, number>()  // mixId → sub-idx nella sua corsia
            const laneCounts   = new Map<number, number>()  // lane → contatore
            const mixColorIdx  = new Map<string, number>()  // mixId → indice colore
            let globalIdx = 0
            for (const [mixId, frags] of fragmentsByMix.entries()) {
              if (frags.length <= 1) continue
              const lane = frags[0].lane
              const sub  = laneCounts.get(lane) ?? 0
              laneSubIdx.set(mixId, sub)
              laneCounts.set(lane, sub + 1)
              mixColorIdx.set(mixId, globalIdx % CONN_COLORS.length)
              globalIdx++
            }
            return (
              <svg style={{ position:'absolute', left:0, top:0,
                            width: LANE_W * totalLanes, height: totalMixHeight,
                            pointerEvents:'none', overflow:'visible' }}>
                {Array.from(fragmentsByMix.entries()).map(([mixId, frags]) => {
                  if (frags.length <= 1) return null
                  const color   = CONN_COLORS[mixColorIdx.get(mixId) ?? 0]
                  const sub     = laneSubIdx.get(mixId) ?? 0
                  const total   = laneCounts.get(frags[0].lane) ?? 1
                  return frags.slice(0, -1).map((f, i) => {
                    const next = frags[i + 1]
                    // Distribuisce le linee orizzontalmente entro la corsia
                    const x = f.lane * LANE_W + LANE_W * (sub + 1) / (total + 1)
                    return (
                      <line key={`${mixId}-conn-${i}`}
                        x1={x} y1={f.topPx + f.heightPx - 5}
                        x2={x} y2={next.topPx + 5}
                        stroke={color} strokeWidth={2}
                        strokeDasharray="4 3" opacity={0.7}
                      />
                    )
                  })
                })}
              </svg>
            )
          })()}
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
  crmItems: CrmItem[]
  onClose: () => void
  onSave: (w: Omit<WorkInSchema, 'id' | 'dbId'>) => Promise<void>
  saving: boolean
}

export function ModalCreaWork({ open, selSrcs, workCols, crmItems, onClose, onSave, saving }: ModalProps) {
  const [nome,        setNome]       = useState('')
  const [volFin,      setVolFin]     = useState('')
  const [solv,        setSolv]       = useState('MeOH')
  const [validita,    setValidita]   = useState('')
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
      setNome(''); setVolFin(''); setSolv('MeOH'); setValidita('')
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
      op: '',
      srcs,
      vols,
    })
  }

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'7px 10px', border:`1px solid ${C.page.brd}`,
    borderRadius:8, fontSize:13, fontFamily:'Lato, sans-serif',
    color:C.page.t1, background:'#fafafa', outline:'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize:10, fontWeight:700, color:C.page.t2,
    textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3, display:'block',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.3)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
      }}
    >
      <div style={{
        background:C.page.sur, borderRadius:14, width:440, maxWidth:'95vw',
        maxHeight:'88vh', overflowY:'auto', padding:24,
        boxShadow:'0 12px 40px rgba(0,0,0,.12)',
        border:`1px solid ${C.page.brd}`,
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
                const tooltipText = (() => {
                  if (!isVar) return null
                  if (s.tipo === 'mix') {
                    const comps = crmItems.filter(c => c.mix_id === s.id)
                    if (comps.length === 0) return null
                    return comps.map(c => `${c.nome} · ${c.cv} ${c.unita_conc}`).join('\n')
                  }
                  if (s.tipo === 'work') {
                    let w: WorkInSchema | undefined
                    for (const col of workCols) { w = col.find(x => x.id === s.id); if (w) break }
                    if (!w) return null
                    const comps = getCompsFromWork(w, workCols, crmItems)
                    if (comps.length === 0) return null
                    return comps.map(c => `${c.nome} · ${c.concInWork.toFixed(3)} ${c.unita}`).join('\n')
                  }
                  return null
                })()
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
                      {isVar && tooltipText && (
                        <span
                          title={tooltipText}
                          style={{ marginLeft:4, cursor:'help', opacity:0.6, fontStyle:'normal' }}
                        >ⓘ</span>
                      )}
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
        {/* Preview calcoli */}
        {srcs.length > 0 && parseFloat(volFin) > 0 && (
          <div style={{
            background:C.work.bg, border:`1px solid ${C.work.border}`,
            borderRadius:10, padding:'9px 11px', marginBottom:10,
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
            padding:'6px 14px', borderRadius:8, border:`1px solid ${C.page.brd}`,
            background:C.page.sur, color:C.page.t2, cursor:'pointer',
            fontSize:13, fontWeight:700,
          }}>Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            style={{
              padding:'6px 14px', borderRadius:8, border:'none',
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
