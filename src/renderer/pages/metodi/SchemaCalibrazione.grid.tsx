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
import type { AnalitoItem, CrmItem, SorgenteSel, WorkInSchema, RegisterCardRef, PrepStockItem } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import { getConcInfo, calcolaVols, targetColIdx, getCompsFromWork } from './SchemaCalibrazione.logic'

const ROW = 62 // px altezza riga singola

// ─────────────────────────────────────────────────────────────────────────────
// Griglia Analiti | Mix CRM | Singoli
// ─────────────────────────────────────────────────────────────────────────────
interface GrigliaProps {
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  selSrcs: Map<string, SorgenteSel>
  removedMix: Set<string>    // mix_id mix esclusi dallo scenario
  onToggleMix: (mixId: string) => void
  onToggleSng: (sngId: string) => void
  onTogglePrepStock: (prepKey: string, prepId: number, crmNome: string, cv: number, lotto: string | null, flacone: string | null, progressivo: number | null) => void
  onClose: () => void        // per chiudere lo schema prima di navigare
  registerCardRef: RegisterCardRef
  gridBodyRef?: React.RefObject<HTMLDivElement | null>
  onOpenScenar: () => void
  // Callback quando l'utente cambia lotto di un mix dal dropdown:
  // firmaId = a.mixId (primo mix_id della firma), oldMixId, newMixId
  onChangeMixLotto?: (firmaId: string, oldMixId: string, newMixId: string) => void
  // Lotto attivo per firma, derivato da removedMix nel componente padre (fix reload)
  mixLottoSel?: Map<string, string>
}

export function GrigliaAnalitiCrm({
  analiti, crmItems, selSrcs, removedMix,
  onToggleMix, onToggleSng, onTogglePrepStock, onClose, registerCardRef, gridBodyRef,
  onOpenScenar, onChangeMixLotto, mixLottoSel: mixLottoSelProp,
}: GrigliaProps) {
  const navigate = useNavigate()

  const goToComposto = (nome: string, mostraDismessi: boolean) => {
    onClose()
    navigate('/composti', { state: { searchFilter: nome, mostraDismessi } })
  }

  // mix_id → array nomi analiti (usato per layout righe)
  const mixAnaliti = new Map<string, string[]>()
  for (const a of analiti) {
    if (a.mixId) {
      const arr = mixAnaliti.get(a.mixId) ?? []
      arr.push(a.nome)
      mixAnaliti.set(a.mixId, arr)
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

  const mixLottoSel = mixLottoSelProp ?? new Map<string, string>()

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
    const isNeat = String(crm.forma ?? '').toLowerCase() === 'neat'
    if (isNeat) {
      const preps = crm.prepStock ?? []
      // Contenitore: padding top(7) + bottom(7) = 14px
      // Gap flex tra figli (gap:6): header + N chip → N gap totali
      const GAP = 6
      const PADDING_V = 14  // 7px top + 7px bottom
      const headerH = 22
      if (preps.length === 0) {
        // header + gap + riga "Nessuna prep attiva"
        return PADDING_V + headerH + GAP + 20
      }
      const chipsH = preps.reduce((s, p) => {
        let rh = 12 + 14  // padding chip 6px top+bottom + riga concentrazione (font 10px → ~14px)
        if (p.progressivo != null || crm.lotto) rh += 13  // riga "prep #N da lotto ..."
        if (p.scadenza) rh += 13
        return s + rh
      }, 0)
      const gapsH = GAP * preps.length  // gap tra header e chip1, poi tra chip i e i+1
      // padding cella: 6px; margine respiro: 8px
      return PADDING_V + headerH + gapsH + chipsH + 6 + 8
    }
    // padding chip: 5px top + 5px bottom = 10px; riga concentrazione ~14px
    let h = 14 + 10
    if (crm.lotto)                h += 13
    if (crm.scadenza_prodotto)    h += 13
    if (crm.ultima_rivalidazione) h += 13
    // padding cella: 3px top + 3px bottom = 6px; margine respiro = 8px
    return h + 6 + 8
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

  // altezza riga: per analiti con mix usa mixRowHeights, altrimenti altezza reale singoli
  const rowHeight = (a: AnalitoItem): number => {
    if (!a.mixId) return Math.max(ROW, sngCellH(a))
    const anaArr  = mixAnaliti.get(a.mixId) ?? []
    const idx     = anaArr.indexOf(a.nome)
    const heights = mixRowHeights.get(a.mixId)
    if (heights && idx >= 0) return heights[idx]
    return Math.max(1, a.sngIds.length) * ROW
  }

  // Separatori tra gruppi
  const nSoloSng    = analiti.filter(a => !a.mixId && a.sngIds.length > 0).length
  const nConMix     = analiti.filter(a =>  a.mixId).length
  const hasSenzaCrm = analiti.some(a => !a.mixId && a.sngIds.length === 0)
  const hasConMix   = nConMix > 0

  // Posizione verticale assoluta di ogni mix (top e height in px)
  const mixTopPx: Record<string, number>    = {}
  const mixHeightPx: Record<string, number> = {}
  let cumY = 0
  for (let i = 0; i < analiti.length; i++) {
    const a = analiti[i]
    // Separatori aggiungono 9px (height:1 + margin:4px*2)
    const hasSep = (i === nSoloSng && nSoloSng > 0 && hasConMix) ||
                   (i === nSoloSng + nConMix && nConMix > 0 && hasSenzaCrm)
    if (hasSep) cumY += 9
    const h = rowHeight(a)
    if (a.mixId) {
      if (mixTopPx[a.mixId] === undefined) mixTopPx[a.mixId] = cumY
      mixHeightPx[a.mixId] = (mixHeightPx[a.mixId] ?? 0) + h
    }
    cumY += h  // border-box: border è dentro h
  }
  const totalMixHeight = cumY

  // Prima occorrenza di ogni mix (per decidere dove renderizzare il blocco assoluto)
  const mixFirstAnalita = new Map<string, string>()
  for (const a of analiti) {
    if (a.mixId && !mixFirstAnalita.has(a.mixId)) mixFirstAnalita.set(a.mixId, a.nome)
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
          { w:190, label:'Analiti',        sub:`${analiti.length} composti` },
          { w:270, label:'CRM Mix',        sub:'clicca per selezionare', br:true },
          { w:260, label:'Singoli / Neat', sub:'preparazioni non scadute' },
        ] as { w:number; label:string; sub:string; br?:boolean }[]).map((h, i) => (
          <div key={i} style={{ width:h.w, padding:'9px 11px', flexShrink:0,
                                borderRight: h.br ? `1px solid ${C.page.brd}` : undefined }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.page.t2,
                          textTransform:'uppercase', letterSpacing:'0.08em' }}>{h.label}</div>
            <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                          fontFamily:'IBM Plex Mono, monospace' }}>{h.sub}</div>
            {i === 1 && (
              <button
                onClick={e => { e.stopPropagation(); onOpenScenar() }}
                title="Scenari di copertura"
                disabled={analiti.length === 0}
                style={{
                  marginTop: 4, padding: '1px 7px', fontSize: 9, fontWeight: 600,
                  borderRadius: 4, border: `1px solid ${C.mix.border}`,
                  background: C.mix.chip, color: C.mix.text, cursor: 'pointer',
                  opacity: analiti.length === 0 ? 0.4 : 1,
                }}
              >◎ Scenari</button>
            )}
          </div>
        ))}
      </div>

      {/* ── Corpo scrollabile ── */}
      <div ref={gridBodyRef} style={{ flex:1, overflowY:'auto', overflowX:'hidden',
                    display:'flex', position:'relative' }}>

        {/* Colonna Analiti + Singoli (scorrono insieme) */}
        <div style={{ display:'flex', flexDirection:'column', flexShrink:0 }}>
          {analiti.map((a, i) => {
            const isSepSngMix  = i === nSoloSng && nSoloSng > 0 && hasConMix
            const isSepSenzaCrm = i === nSoloSng + nConMix && nConMix > 0 && hasSenzaCrm
            const senzaCrm = !a.mixId && a.sngIds.length === 0
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
                  <div style={{ width:270, flexShrink:0,
                                borderRight:`1px solid ${C.page.brd}` }} />

                  {/* Cella Singoli — una card per sngId */}
                  <div style={{ width:260, flexShrink:0, padding:'3px 6px',
                                display:'flex', flexDirection:'column', gap:3,
                                justifyContent:'center' }}>
                    {a.sngIds.map(sngId => {
                      const crm   = sngById.get(sngId)
                      if (!crm) return null
                      const isSel = selSrcs.has(sngId)
                      const isNeat = String(crm.forma ?? '').toLowerCase() === 'neat'

                      if (isNeat) {
                        // CRM Neat: riquadro unico con le prep stock all'interno
                        const preps: PrepStockItem[] = crm.prepStock ?? []
                        return (
                          <div key={sngId} style={{
                            borderRadius:10, padding:'7px 8px',
                            background: C.sng.bg,
                            border:`1.5px dashed ${C.sng.border}`,
                            borderLeft:`3px solid ${C.sng.border}`,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            display:'flex', flexDirection:'column', gap:6,
                          }}>
                            {/* Header nome CRM Neat */}
                            <div style={{ display:'flex', alignItems:'center',
                                          justifyContent:'space-between', gap:4 }}>
                              <div style={{ fontSize:10, fontWeight:700,
                                            fontFamily:'IBM Plex Mono, monospace',
                                            color: C.sng.text, minWidth:0,
                                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {crm.nome}
                                <span style={{ fontWeight:400, opacity:0.6 }}> · Neat</span>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); goToComposto(crm.nome, false) }}
                                style={{
                                  width:15, height:15, borderRadius:3,
                                  border:`1px solid ${C.page.brd}`,
                                  background:'#fff', color:C.page.t2,
                                  cursor:'pointer', display:'flex', alignItems:'center',
                                  justifyContent:'center', fontSize:9, flexShrink:0,
                                }}
                                title="Vedi nel DB composti"
                              >↗</button>
                            </div>
                            {/* Prep stock attive come righe interne */}
                            {preps.length === 0 ? (
                              <div style={{ display:'flex', alignItems:'center',
                                            justifyContent:'space-between', gap:4 }}>
                                <span style={{ fontSize:9, color:C.page.th,
                                               fontFamily:'IBM Plex Mono, monospace',
                                               fontStyle:'italic' }}>
                                  Nessuna prep attiva
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); goToComposto(crm.nome, false) }}
                                  style={{
                                    padding:'1px 5px', fontSize:9, borderRadius:3,
                                    border:`1px solid ${C.sng.border}`,
                                    background: C.sng.chip, color: C.sng.text,
                                    cursor:'pointer', flexShrink:0,
                                  }}
                                  title="Crea preparazione stock nel DB Composti"
                                >Crea prep ↗</button>
                              </div>
                            ) : preps.map(prep => {
                              const prepKey = `prep_${prep.id}`
                              const isPrepSel = selSrcs.has(prepKey)
                              const cv = (prep.concReale ?? prep.concTarget ?? (prep.conc != null ? Number(prep.conc) : 0)) || 0
                              const concLabel = prep.concReale != null
                                ? `${prep.concReale} ${prep.unitaConc}`
                                : prep.concTarget != null
                                  ? `${prep.concTarget} ${prep.unitaConc}`
                                  : prep.conc
                                    ? `${prep.conc} ${prep.unitaConc}`
                                    : null
                              return (
                                <div
                                  key={prepKey}
                                  ref={el => registerCardRef(prepKey, el)}
                                  onClick={() => onTogglePrepStock(prepKey, prep.id, crm.nome, cv, crm.lotto ?? null, prep.flacone ?? null, prep.progressivo ?? null)}
                                  style={{
                                    borderRadius:7, padding:'6px 7px',
                                    background: isPrepSel ? '#c8e8a8' : '#fff',
                                    border:`1.5px solid ${C.sng.border}`,
                                    boxShadow: isPrepSel ? '0 0 0 2px rgba(125,184,90,.35)' : 'none',
                                    cursor: 'pointer',
                                    transition:'box-shadow .12s, background .1s',
                                  }}
                                >
                                  <div style={{ fontSize:10, fontWeight:700,
                                                fontFamily:'IBM Plex Mono, monospace',
                                                color: C.sng.text,
                                                whiteSpace:'nowrap', overflow:'hidden',
                                                textOverflow:'ellipsis' }}>
                                    {concLabel ?? <span style={{ fontStyle:'italic', fontWeight:400, opacity:0.5 }}>conc. assente</span>}
                                  </div>
                                  {(prep.progressivo != null || crm.lotto) && (
                                    <div style={{ fontSize:9, color:C.page.t2,
                                                  fontFamily:'IBM Plex Mono, monospace' }}>
                                      {`prep #${prep.progressivo ?? '?'}`}{crm.lotto ? ` da lotto ${crm.lotto} · Neat` : ''}
                                    </div>
                                  )}
                                  {prep.scadenza && (
                                    <div style={{ fontSize:9, color:C.page.th,
                                                  fontFamily:'IBM Plex Mono, monospace' }}>
                                      scad. {prep.scadenza}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      }

                      return (
                        <div
                          key={sngId}
                          ref={el => registerCardRef(sngId, el)}
                          onClick={() => onToggleSng(sngId)}
                          style={{
                            borderRadius:10, padding:'5px 8px',
                            background: isSel ? '#c8e8a8' : C.sng.bg,
                            border:`1.5px solid ${C.sng.border}`,
                            borderLeft:`3px solid ${C.sng.border}`,
                            borderStyle: a.isIS ? 'dashed' : 'solid',
                            boxShadow: isSel ? '0 0 0 2px rgba(125,184,90,.35)' : '0 1px 2px rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                            display:'flex', alignItems:'center',
                            justifyContent:'space-between', gap:4,
                            transition:'box-shadow .12s, background .1s',
                          }}
                        >
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:10, fontWeight:700,
                                          fontFamily:'IBM Plex Mono, monospace',
                                          color: C.sng.text,
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
                          <button
                            onClick={e => { e.stopPropagation(); goToComposto(crm.nome, false) }}
                            style={{
                              width:15, height:15, borderRadius:3,
                              border:`1px solid ${C.page.brd}`,
                              background:'#fff', color:C.page.t2,
                              cursor:'pointer', display:'flex', alignItems:'center',
                              justifyContent:'center', fontSize:9, flexShrink:0,
                            }}
                            title="Vedi nel DB composti"
                          >↗</button>
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
          height: totalMixHeight, pointerEvents:'none', overflow:'hidden',
        }}>
          {analiti.map(a => {
            if (!a.mixId || mixFirstAnalita.get(a.mixId) !== a.nome) return null
            // mix_id attivo = lotto selezionato (default: primo mix_id = a.mixId)
            const mixIdAttivo = mixLottoSel.get(a.mixId) ?? a.mixId
            const info   = mixInfo.get(mixIdAttivo)
            const sel    = selSrcs.has(mixIdAttivo)
            const isRmMx = removedMix.has(mixIdAttivo)
            const allComps = mixAllComps.get(mixIdAttivo) ?? mixAllComps.get(a.mixId) ?? []
            const analitiSet = new Set(mixAnaliti.get(a.mixId) ?? [])
            const top    = mixTopPx[a.mixId] ?? 0
            const height = mixHeightPx[a.mixId] ?? ROW
            return (
              <div
                key={a.mixId}
                ref={el => registerCardRef(mixIdAttivo, el)}
                onClick={() => !isRmMx && onToggleMix(mixIdAttivo)}
                style={{
                  position:'absolute', left:8, right:8,
                  top: top + 5, height: height - 10,
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
                {!isRmMx && (
                  <div style={{ position:'absolute', top:4, right:4, zIndex:3 }}>
                    <button
                      onClick={e => { e.stopPropagation(); goToComposto(a.mixId!, false) }}
                      style={{
                        width:15, height:15, borderRadius:3,
                        border:`1px solid ${C.page.brd}`,
                        background:'#fff', color:C.page.t2,
                        cursor:'pointer', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:9,
                      }}
                      title="Vedi nel DB composti"
                    >↗</button>
                  </div>
                )}
                <div style={{ fontSize:11, fontWeight:700,
                              fontFamily:'IBM Plex Mono, monospace',
                              color:C.mix.text, paddingRight: isRmMx ? 0 : 22 }}>
                  {info?.mix ?? info?.mix_id ?? a.mixId}
                </div>
                <div style={{ fontSize:10, color:C.page.t2, marginTop:2 }}>
                  {info?.produttore ?? ''}
                </div>
                {a.mixIds.length > 1 && !isRmMx ? (
                  <select
                    value={mixIdAttivo}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      e.stopPropagation()
                      const oldId = mixIdAttivo
                      const newId = e.target.value
                      onChangeMixLotto?.(a.mixId!, oldId, newId)
                    }}
                    style={{
                      fontSize:9, fontFamily:'IBM Plex Mono, monospace',
                      border:`1px solid ${C.mix.border}`, borderRadius:3,
                      background:'transparent', color:C.mix.text,
                      marginTop:2, padding:'1px 2px', cursor:'pointer',
                    }}
                  >
                    {a.mixIds.map(mid => {
                      const lbl = mixInfo.get(mid)?.lotto ?? mid
                      return <option key={mid} value={mid}>{lbl}</option>
                    })}
                  </select>
                ) : info?.lotto ? (
                  <div style={{ fontSize:9, color:C.page.t2, marginTop:1,
                                fontFamily:'IBM Plex Mono, monospace' }}>
                    {info.lotto}
                  </div>
                ) : null}
                <div style={{ fontSize:10, color:C.page.th, marginTop:2,
                              fontFamily:'IBM Plex Mono, monospace' }}>
                  {(mixCvSets.get(a.mixId)?.size ?? 0) <= 1 && info?.cv ? `${info.cv} mg/L` : ''}
                  {info?.scadenza_prodotto ? ` · scad. ${info.scadenza_prodotto}` : ''}
                </div>
                {info?.ultima_rivalidazione && (
                  <div style={{ fontSize:10, color:'#b45309', marginTop:2,
                                fontFamily:'IBM Plex Mono, monospace' }}>
                    Rivalidato · scad. est. {info.ultima_rivalidazione}
                  </div>
                )}
                <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:5 }}>
                  {allComps.map(n => {
                    const mixItem  = mixItemByNome.get(n)
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
