// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.lavagna.tsx
//
// Vista "Lavagna" dello Schema di Calibrazione (read-only, flusso L→R).
// Alternativa a GrigliaAnalitiCrm (modalità edit), montata via toggle dentro
// SchemaCalibrazione.tsx. Pan/zoom nativi, moduli draggabili, archi dinamici
// solo tra sorgenti effettivamente usate e Work che le consumano.
//
// Persistenza posizioni in localStorage (chiave per metodoId).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnalitoItem, CrmItem, SorgenteSel, SorgenteTipo,
  WorkInSchema, DestUso, PrepStockItem,
} from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface SchemaLavagnaProps {
  metodoId: string
  metodoNome: string
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  selSrcs: Map<string, SorgenteSel>
  removedMix: Set<string>
  mixLottoSel: Map<string, string>
  workCols: WorkInSchema[][]
  filtroDestUso: DestUso
  onSelectModulo?: (id: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Costanti layout
// ─────────────────────────────────────────────────────────────────────────────
const LAYOUT = {
  COL_X: [40, 440, 900] as const,        // Mix | Sng/Neat | Work (prima colonna)
  COL_WORK_GAP: 440,
  MODULE_W: { mix: 340, sng: 260, work: 360 } as Record<'mix' | 'sng' | 'work', number>,
  MODULE_H: { mix: 180, sng: 130, work: 210 } as Record<'mix' | 'sng' | 'work', number>,
  ROW_GAP: 20,
  Y_START: 40,
}
const SIDEBAR_W = 240
const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const LS_VERSION = 1
const LS_KEY_PREFIX = 'lcms:lavagna:positions:'

type Position = { x: number; y: number }
type Positions = Record<string, Position>
type FiltroSidebar = 'tutti' | 'coperti' | 'scoperti'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: badge scadenza uniforme
// ─────────────────────────────────────────────────────────────────────────────
function scadenzaBadge(scad: string | null): { color: string; label: string } | null {
  if (!scad) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(scad)
  if (isNaN(d.getTime())) return null
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000)
  const iso = scad.length >= 10 ? scad.substring(0, 10) : scad
  if (diffDays < 0) return { color: '#dc2626', label: `scad. ${iso} · SCADUTA` }
  if (diffDays < 120) return { color: '#d97706', label: `scad. ${iso} · in scadenza` }
  return { color: C.page.th, label: `scad. ${iso}` }
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivazione moduli dai dati (mix attivi, singoli/prep, work)
// ─────────────────────────────────────────────────────────────────────────────
type ModuloMeta =
  | { kind: 'mix'; id: string; mixId: string; crm: CrmItem; comps: string[]; lottiAlt: number }
  | { kind: 'sng'; id: string; crm: CrmItem; preps: PrepStockItem[] }
  | { kind: 'work'; id: string; work: WorkInSchema; colIdx: number; rowIdx: number }

function deriveModuli(
  analiti: AnalitoItem[],
  crmItems: CrmItem[],
  removedMix: Set<string>,
  mixLottoSel: Map<string, string>,
  workCols: WorkInSchema[][],
): ModuloMeta[] {
  // Index CRM per id e mix_id
  const byId = new Map<number, CrmItem>()
  const byMix = new Map<string, CrmItem[]>()
  for (const c of crmItems) {
    byId.set(c.id, c)
    if (c.mix_id) {
      const arr = byMix.get(c.mix_id) || []
      arr.push(c)
      byMix.set(c.mix_id, arr)
    }
  }

  const result: ModuloMeta[] = []
  const seenMix = new Set<string>()
  const seenSng = new Set<string>()

  // MIX (uno per "firma-mix-attivo")
  for (const a of analiti) {
    if (!a.mixIds || a.mixIds.length === 0) continue
    const firma = a.mixIds.join('|')
    const attivoCandidate = mixLottoSel.get(firma)
    // Pick the first mix_id non rimosso, preferendo quello selezionato dall'utente
    const availableMixIds = a.mixIds.filter(m => !removedMix.has(m))
    if (availableMixIds.length === 0) continue
    const attivo = attivoCandidate && availableMixIds.includes(attivoCandidate)
      ? attivoCandidate
      : availableMixIds[0]
    if (seenMix.has(attivo)) continue
    seenMix.add(attivo)
    const comps = byMix.get(attivo) || []
    if (comps.length === 0) continue
    const head = comps[0]
    const nomiComp = comps.map(c => c.nome)
    const lottiAlt = (byMix.get(attivo)?.length ?? 0) > 0 ? a.mixIds.length - 1 : 0
    result.push({
      kind: 'mix',
      id: `MIX-${attivo}`,
      mixId: attivo,
      crm: head,
      comps: nomiComp,
      lottiAlt: Math.max(0, lottiAlt),
    })
  }

  // SINGOLI + NEAT (un modulo per CRM id)
  for (const a of analiti) {
    for (const sid of a.sngIds) {
      if (seenSng.has(sid)) continue
      seenSng.add(sid)
      const crm = byId.get(Number(sid))
      if (!crm) continue
      const preps = (crm.prepStock || []).filter(p => !p.dataDismissione)
      result.push({ kind: 'sng', id: sid, crm, preps })
    }
  }

  // WORK
  workCols.forEach((col, ci) => {
    col.forEach((w, wi) => {
      result.push({ kind: 'work', id: w.id, work: w, colIdx: ci, rowIdx: wi })
    })
  })

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-layout L→R per moduli senza posizione salvata
// ─────────────────────────────────────────────────────────────────────────────
function computeAutoLayout(moduli: ModuloMeta[]): Positions {
  const out: Positions = {}
  let mixRow = 0
  let sngRow = 0
  const workRowsByCol: Record<number, number> = {}

  for (const m of moduli) {
    if (m.kind === 'mix') {
      out[m.id] = {
        x: LAYOUT.COL_X[0],
        y: LAYOUT.Y_START + mixRow * (LAYOUT.MODULE_H.mix + LAYOUT.ROW_GAP),
      }
      mixRow++
    } else if (m.kind === 'sng') {
      out[m.id] = {
        x: LAYOUT.COL_X[1],
        y: LAYOUT.Y_START + sngRow * (LAYOUT.MODULE_H.sng + LAYOUT.ROW_GAP),
      }
      sngRow++
    } else {
      const ci = m.colIdx
      const cur = workRowsByCol[ci] ?? 0
      out[m.id] = {
        x: LAYOUT.COL_X[2] + ci * LAYOUT.COL_WORK_GAP,
        y: LAYOUT.Y_START + cur * (LAYOUT.MODULE_H.work + LAYOUT.ROW_GAP),
      }
      workRowsByCol[ci] = cur + 1
    }
  }
  return out
}

function computeWorldSize(moduli: ModuloMeta[], positions: Positions): { w: number; h: number } {
  let maxX = 600, maxY = 400
  for (const m of moduli) {
    const p = positions[m.id]
    if (!p) continue
    const w = LAYOUT.MODULE_W[m.kind]
    const h = LAYOUT.MODULE_H[m.kind]
    if (p.x + w > maxX) maxX = p.x + w
    if (p.y + h > maxY) maxY = p.y + h
  }
  return { w: maxX + 120, h: maxY + 120 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: posizioni in localStorage (per metodoId)
// ─────────────────────────────────────────────────────────────────────────────
function useLavagnaPositions(metodoId: string, moduli: ModuloMeta[]) {
  const key = LS_KEY_PREFIX + metodoId
  const [positions, setPositions] = useState<Positions>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      if (parsed && parsed.positions && typeof parsed.positions === 'object') {
        return parsed.positions as Positions
      }
    } catch { /* noop */ }
    return {}
  })
  const dirtyRef = useRef(false)

  // Auto-layout incrementale per moduli nuovi senza posizione salvata
  const modIdsKey = useMemo(() => moduli.map(m => m.id).join('|'), [moduli])
  useEffect(() => {
    setPositions(prev => {
      const missing = moduli.filter(m => !(m.id in prev))
      if (missing.length === 0) return prev
      // Calcola layout automatico SOLO sui mancanti per evitare di spostare quelli esistenti
      const auto = computeAutoLayout(moduli)
      const merged = { ...prev }
      for (const m of missing) merged[m.id] = auto[m.id]
      return merged
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modIdsKey])

  // Save debounced
  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({
          version: LS_VERSION,
          updatedAt: new Date().toISOString(),
          positions,
        }))
      } catch { /* noop */ }
      dirtyRef.current = false
    }, 200)
    return () => clearTimeout(t)
  }, [positions, key])

  const setPosition = useCallback((id: string, x: number, y: number) => {
    dirtyRef.current = true
    setPositions(prev => ({ ...prev, [id]: { x, y } }))
  }, [])

  const resetLayout = useCallback(() => {
    try { localStorage.removeItem(key) } catch { /* noop */ }
    const auto = computeAutoLayout(moduli)
    setPositions(auto)
  }, [key, moduli])

  return { positions, setPosition, resetLayout }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcolo archi (strategia A: solo stream attivi)
// ─────────────────────────────────────────────────────────────────────────────
type Arco = {
  x1: number; y1: number; x2: number; y2: number
  color: string; tipo: SorgenteTipo; dashed: boolean; key: string
}

function computeArchi(moduli: ModuloMeta[], positions: Positions): Arco[] {
  const archi: Arco[] = []
  const workMod = new Map<string, ModuloMeta>()
  const mixMod = new Map<string, ModuloMeta>()
  const sngMod = new Map<string, ModuloMeta>()
  const prepInSng = new Map<string, string>() // prepId → sngModuleId
  for (const m of moduli) {
    if (m.kind === 'work') workMod.set(m.id, m)
    else if (m.kind === 'mix') mixMod.set(m.mixId, m)
    else if (m.kind === 'sng') {
      sngMod.set(m.id, m)
      for (const p of m.preps) prepInSng.set(String(p.id), m.id)
    }
  }

  for (const m of moduli) {
    if (m.kind !== 'work') continue
    const w = m.work
    const pWork = positions[m.id]
    if (!pWork) continue
    const to = { x: pWork.x, y: pWork.y + LAYOUT.MODULE_H.work / 2 }

    for (const s of w.srcs) {
      let fromMod: ModuloMeta | undefined
      let color: string = C.page.t2
      let dashed = false
      if (s.tipo === 'mix') {
        fromMod = mixMod.get(s.id)
        color = C.mix.border
      } else if (s.tipo === 'sng') {
        fromMod = sngMod.get(s.id)
        color = C.sng.border
      } else if (s.tipo === 'prep') {
        const sngId = s.prepId != null ? prepInSng.get(String(s.prepId)) : undefined
        fromMod = sngId ? sngMod.get(sngId) : undefined
        color = C.sng.border
        dashed = true
      } else if (s.tipo === 'work') {
        fromMod = workMod.get(s.id)
        color = C.work.border
      }
      if (!fromMod) continue
      const pFrom = positions[fromMod.id]
      if (!pFrom) continue
      const fromW = LAYOUT.MODULE_W[fromMod.kind]
      const fromH = LAYOUT.MODULE_H[fromMod.kind]
      const from = { x: pFrom.x + fromW, y: pFrom.y + fromH / 2 }
      archi.push({
        x1: from.x, y1: from.y,
        x2: to.x, y2: to.y,
        color, tipo: s.tipo, dashed,
        key: `${fromMod.id}→${m.id}:${s.id}:${s.prepId ?? ''}`,
      })
    }
  }
  return archi
}

// ─────────────────────────────────────────────────────────────────────────────
// Sotto-componente: SidebarAnaliti
// ─────────────────────────────────────────────────────────────────────────────
function SidebarAnaliti({
  analiti, filtro, onCambiaFiltro, onHoverAnalita,
}: {
  analiti: AnalitoItem[]
  filtro: FiltroSidebar
  onCambiaFiltro: (f: FiltroSidebar) => void
  onHoverAnalita: (nome: string | null) => void
}) {
  const filtered = useMemo(() => {
    return analiti.filter(a => {
      const coperto = !!a.mixId || a.sngIds.length > 0
      if (filtro === 'coperti') return coperto
      if (filtro === 'scoperti') return !coperto
      return true
    })
  }, [analiti, filtro])

  const counts = useMemo(() => {
    let coperti = 0, scoperti = 0
    for (const a of analiti) {
      if (a.mixId || a.sngIds.length > 0) coperti++
      else scoperti++
    }
    return { tot: analiti.length, coperti, scoperti }
  }, [analiti])

  return (
    <div style={{
      flex: `0 0 ${SIDEBAR_W}px`, background: C.page.sur,
      borderRight: `1px solid ${C.page.brd}`,
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${C.page.brd}` }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.page.th, display: 'flex', justifyContent: 'space-between',
          marginBottom: 8, fontWeight: 600,
        }}>
          <span>Analiti</span>
          <span style={{ color: C.page.t2 }}>{counts.tot}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['tutti', 'coperti', 'scoperti'] as FiltroSidebar[]).map(f => {
            const active = filtro === f
            const labels: Record<FiltroSidebar, string> = { tutti: 'Tutti', coperti: `Cop. ${counts.coperti}`, scoperti: `Sco. ${counts.scoperti}` }
            return (
              <button key={f} onClick={() => onCambiaFiltro(f)} style={{
                flex: 1, padding: '4px 6px', borderRadius: 4, fontSize: 10.5,
                border: `1px solid ${C.page.brd2}`, cursor: 'pointer',
                background: active ? C.page.t1 : C.page.sur,
                color: active ? '#fff' : C.page.t2,
                fontWeight: active ? 600 : 400,
              }}>{labels[f]}</button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {filtered.map(a => {
          const hasMix = !!a.mixId
          const hasSng = a.sngIds.length > 0
          const scoperto = !hasMix && !hasSng
          return (
            <div
              key={a.nome}
              onMouseEnter={() => onHoverAnalita(a.nome)}
              onMouseLeave={() => onHoverAnalita(null)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 14px', fontSize: 11.5,
                color: scoperto ? C.page.th : C.page.t1,
                borderLeft: a.isIS ? `3px solid ${C.inter.border}` : '3px solid transparent',
                cursor: 'default',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = C.page.bg }}
              onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 140, fontWeight: a.isIS ? 600 : 400,
              }} title={a.nome}>{a.nome}</span>
              <span style={{ display: 'flex', gap: 3 }}>
                {a.isIS && (
                  <span style={{
                    fontSize: 8.5, padding: '1px 4px', borderRadius: 2,
                    background: C.inter.chip, color: C.inter.text, fontWeight: 600,
                  }}>IS</span>
                )}
                {hasMix && (
                  <span style={{
                    fontSize: 8.5, padding: '1px 4px', borderRadius: 2,
                    background: C.mix.chip, color: C.mix.text, fontWeight: 600,
                  }}>M</span>
                )}
                {hasSng && (
                  <span style={{
                    fontSize: 8.5, padding: '1px 4px', borderRadius: 2,
                    background: C.sng.chip, color: C.sng.text, fontWeight: 600,
                  }}>S</span>
                )}
                {scoperto && (
                  <span style={{
                    fontSize: 8.5, padding: '1px 4px', borderRadius: 2,
                    background: C.con.bg, color: C.con.text, fontWeight: 600,
                    border: `1px solid ${C.con.border}`,
                  }}>—</span>
                )}
              </span>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '20px 14px', fontSize: 11, color: C.page.th, textAlign: 'center' }}>
            Nessun analita in questo filtro.
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sotto-componenti: Moduli (Mix, Sng, Work)
// ─────────────────────────────────────────────────────────────────────────────
function ModuloBaseWrapper({
  id, x, y, width, height, onDragEnd, scale, registerRef, highlighted, children, bg, border, borderLeftColor,
}: {
  id: string; x: number; y: number; width: number; height: number
  onDragEnd: (id: string, x: number, y: number) => void
  scale: number
  registerRef: (id: string, el: HTMLDivElement | null) => void
  highlighted: boolean
  children: React.ReactNode
  bg: string; border: string; borderLeftColor: string
}) {
  const [localPos, setLocalPos] = useState<Position | null>(null)
  const draggingRef = useRef(false)
  const startRef = useRef<{ mx: number; my: number; x0: number; y0: number }>({ mx: 0, my: 0, x0: 0, y0: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    draggingRef.current = true
    startRef.current = { mx: e.clientX, my: e.clientY, x0: x, y0: y }
    setLocalPos({ x, y })
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = (ev.clientX - startRef.current.mx) / scale
      const dy = (ev.clientY - startRef.current.my) / scale
      setLocalPos({ x: startRef.current.x0 + dx, y: startRef.current.y0 + dy })
    }
    const onUp = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const dx = (ev.clientX - startRef.current.mx) / scale
      const dy = (ev.clientY - startRef.current.my) / scale
      const fx = startRef.current.x0 + dx
      const fy = startRef.current.y0 + dy
      setLocalPos(null)
      onDragEnd(id, fx, fy)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [id, x, y, scale, onDragEnd])

  const px = localPos?.x ?? x
  const py = localPos?.y ?? y

  return (
    <div
      ref={el => registerRef(id, el)}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: px, top: py, width, height,
        background: bg,
        border: `1.5px solid ${border}`,
        borderLeft: `4px solid ${borderLeftColor}`,
        borderRadius: 6,
        boxShadow: highlighted
          ? `0 0 0 3px rgba(155,134,214,0.35), 0 2px 6px rgba(0,0,0,0.05)`
          : '0 1px 3px rgba(0,0,0,0.06)',
        userSelect: 'none',
        cursor: draggingRef.current ? 'grabbing' : 'grab',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

function ModuloMix({
  meta, pos, scale, onDragEnd, registerRef, highlighted,
}: {
  meta: Extract<ModuloMeta, { kind: 'mix' }>
  pos: Position
  scale: number
  onDragEnd: (id: string, x: number, y: number) => void
  registerRef: (id: string, el: HTMLDivElement | null) => void
  highlighted: boolean
}) {
  const crm = meta.crm
  const sBadge = scadenzaBadge(crm.scadenza_prodotto)
  const rival = crm.ultima_rivalidazione
  const nomeMix = crm.mix || meta.mixId
  const nComp = meta.comps.length
  const compVisible = meta.comps.slice(0, 6)
  const rimanenti = nComp - compVisible.length

  return (
    <ModuloBaseWrapper
      id={meta.id} x={pos.x} y={pos.y}
      width={LAYOUT.MODULE_W.mix} height={LAYOUT.MODULE_H.mix}
      onDragEnd={onDragEnd} scale={scale} registerRef={registerRef}
      highlighted={highlighted}
      bg={C.mix.bg} border={C.mix.border} borderLeftColor={C.mix.border}
    >
      <div style={{
        padding: '8px 12px 6px', borderBottom: `1px solid ${C.mix.chip}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: C.mix.text, opacity: 0.7, fontWeight: 600, marginBottom: 2,
          }}>Mix CRM · {nComp} comp.</div>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: C.mix.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={nomeMix}>{nomeMix}</div>
        </div>
        {meta.lottiAlt > 0 && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            background: C.page.sur, border: `1px solid ${C.mix.border}`,
            color: C.mix.text, whiteSpace: 'nowrap', flexShrink: 0,
          }}>+{meta.lottiAlt} lotti</span>
        )}
      </div>
      <div style={{ padding: '6px 12px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10.5, lineHeight: 1.55 }}>
        {crm.produttore && (
          <div style={{ color: C.page.t2 }}>
            <span style={{ color: C.page.th }}>prod.</span> {crm.produttore}
          </div>
        )}
        <div style={{ color: C.page.t2 }}>
          <span style={{ color: C.page.th }}>lotto</span> {crm.lotto || '—'}
          <span style={{ color: C.page.th, marginLeft: 10 }}>conc</span>{' '}
          {crm.concVariabile ? 'variabile' : `${crm.cv} ${crm.unita_conc || 'mg/L'}`}
        </div>
        {sBadge && (
          <div style={{ color: sBadge.color, fontWeight: 500 }}>{sBadge.label}</div>
        )}
        {rival && (
          <div style={{ color: '#b45309' }}>
            <span style={{ color: C.page.th }}>rival.</span> {rival.substring(0, 10)}
          </div>
        )}
      </div>
      <div style={{ padding: '4px 12px 10px' }}>
        {compVisible.map(n => (
          <span key={n} style={{
            display: 'inline-block', fontSize: 9.5,
            padding: '1px 5px', margin: '1px 3px 1px 0',
            background: C.mix.chip, color: C.mix.text, borderRadius: 2,
            maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', verticalAlign: 'bottom',
          }}>{n}</span>
        ))}
        {rimanenti > 0 && (
          <span style={{
            display: 'inline-block', fontSize: 9.5,
            padding: '1px 5px', margin: '1px 3px',
            color: C.page.t2, fontWeight: 600,
          }}>+{rimanenti}</span>
        )}
      </div>
    </ModuloBaseWrapper>
  )
}

function ModuloSng({
  meta, pos, scale, onDragEnd, registerRef, highlighted,
}: {
  meta: Extract<ModuloMeta, { kind: 'sng' }>
  pos: Position
  scale: number
  onDragEnd: (id: string, x: number, y: number) => void
  registerRef: (id: string, el: HTMLDivElement | null) => void
  highlighted: boolean
}) {
  const crm = meta.crm
  const isNeat = (crm.forma || '').toLowerCase().includes('neat')
  const sBadge = scadenzaBadge(crm.scadenza_prodotto)
  const rival = crm.ultima_rivalidazione
  const preps = meta.preps.slice(0, 2)
  const prepExtra = meta.preps.length - preps.length

  return (
    <ModuloBaseWrapper
      id={meta.id} x={pos.x} y={pos.y}
      width={LAYOUT.MODULE_W.sng}
      height={LAYOUT.MODULE_H.sng + (isNeat && preps.length ? 56 + preps.length * 18 : 0)}
      onDragEnd={onDragEnd} scale={scale} registerRef={registerRef}
      highlighted={highlighted}
      bg={C.sng.bg} border={C.sng.border} borderLeftColor={C.sng.border}
    >
      <div style={{
        padding: '8px 12px 6px', borderBottom: `1px solid ${C.sng.chip}`,
      }}>
        <div style={{
          fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.sng.text, opacity: 0.7, fontWeight: 600, marginBottom: 2,
        }}>{isNeat ? 'Singolo · Neat' : 'Singolo CRM'}</div>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: C.sng.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={crm.nome}>{crm.nome}</div>
      </div>
      <div style={{ padding: '6px 12px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10.5, lineHeight: 1.55 }}>
        <div style={{ color: C.page.t2 }}>
          <span style={{ color: C.page.th }}>conc</span>{' '}
          {crm.concVariabile ? 'variabile' : `${crm.cv} ${crm.unita_conc || 'mg/L'}`}
          {crm.forma && (
            <><span style={{ color: C.page.th, marginLeft: 10 }}>forma</span> {crm.forma}</>
          )}
        </div>
        <div style={{ color: C.page.t2 }}>
          <span style={{ color: C.page.th }}>lotto</span> {crm.lotto || '—'}
        </div>
        {sBadge && (
          <div style={{ color: sBadge.color, fontWeight: 500 }}>{sBadge.label}</div>
        )}
        {rival && (
          <div style={{ color: '#b45309' }}>
            <span style={{ color: C.page.th }}>rival.</span> {rival.substring(0, 10)}
          </div>
        )}
      </div>
      {isNeat && preps.length > 0 && (
        <div style={{
          margin: '4px 10px 10px', padding: '6px 8px',
          background: C.page.sur, borderRadius: 4, border: `1px dashed ${C.sng.border}`,
        }}>
          <div style={{
            fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: C.sng.text, fontWeight: 600, marginBottom: 4,
          }}>Prep. NEAT</div>
          {preps.map(p => {
            const pBadge = scadenzaBadge(p.scadenza)
            return (
              <div key={p.id} style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: C.page.t2, lineHeight: 1.5 }}>
                <span style={{ color: C.page.th }}>fl.</span> {p.flacone || '—'}
                {p.progressivo != null && <span> · #{p.progressivo}</span>}
                {p.concReale != null && (
                  <span> · {p.concReale} {p.unitaConc}</span>
                )}
                {pBadge && <div style={{ color: pBadge.color, fontSize: 9.5 }}>{pBadge.label}</div>}
              </div>
            )
          })}
          {prepExtra > 0 && (
            <div style={{ fontSize: 9.5, color: C.page.th, marginTop: 3 }}>+{prepExtra} altre preparazioni</div>
          )}
        </div>
      )}
    </ModuloBaseWrapper>
  )
}

function ModuloWork({
  meta, pos, scale, onDragEnd, registerRef, highlighted,
}: {
  meta: Extract<ModuloMeta, { kind: 'work' }>
  pos: Position
  scale: number
  onDragEnd: (id: string, x: number, y: number) => void
  registerRef: (id: string, el: HTMLDivElement | null) => void
  highlighted: boolean
}) {
  const w = meta.work
  const isInter = meta.colIdx > 0
  const col = isInter ? C.inter : C.work
  const srcsNames = w.srcs.map(s => s.nome)
  const chipVis = srcsNames.slice(0, 5)
  const chipRest = srcsNames.length - chipVis.length
  const vols = w.vols.slice(0, 4)
  const volsRest = w.vols.length - vols.length

  return (
    <ModuloBaseWrapper
      id={meta.id} x={pos.x} y={pos.y}
      width={LAYOUT.MODULE_W.work}
      height={LAYOUT.MODULE_H.work + vols.length * 14}
      onDragEnd={onDragEnd} scale={scale} registerRef={registerRef}
      highlighted={highlighted}
      bg={col.bg} border={col.border} borderLeftColor={col.border}
    >
      <div style={{
        padding: '8px 12px 6px', borderBottom: `1px solid ${col.chip}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: col.text, opacity: 0.75, fontWeight: 600, marginBottom: 2,
          }}>{isInter ? `Intermedia · col ${meta.colIdx + 1}` : 'Work · Lv0'}</div>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: col.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={w.nome}>{w.nome}</div>
        </div>
      </div>
      <div style={{ padding: '6px 12px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10.5, lineHeight: 1.55 }}>
        <div style={{ color: C.page.t2 }}>
          <span style={{ color: C.page.th }}>conc</span>{' '}
          {w.concVariabile ? 'variabile' : (w.conc != null ? `${w.conc} ${w.unitaConc}` : '—')}
          <span style={{ color: C.page.th, marginLeft: 10 }}>vol</span> {w.volFin} mL
        </div>
        <div style={{ color: C.page.t2 }}>
          <span style={{ color: C.page.th }}>solv.</span> {w.solv || '—'}
          {w.validitaMesi != null && (
            <><span style={{ color: C.page.th, marginLeft: 10 }}>valid.</span> {w.validitaMesi}m</>
          )}
        </div>
        {w.op && (
          <div style={{ color: C.page.t2 }}>
            <span style={{ color: C.page.th }}>op.</span> {w.op}
          </div>
        )}
      </div>
      {srcsNames.length > 0 && (
        <div style={{ padding: '2px 12px 4px' }}>
          {chipVis.map((n, i) => (
            <span key={i} style={{
              display: 'inline-block', fontSize: 9.5,
              padding: '1px 5px', margin: '1px 3px 1px 0',
              background: col.chip, color: col.text, borderRadius: 2,
              maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', verticalAlign: 'bottom',
            }}>{n}</span>
          ))}
          {chipRest > 0 && (
            <span style={{ fontSize: 9.5, color: C.page.t2, fontWeight: 600, marginLeft: 2 }}>+{chipRest}</span>
          )}
        </div>
      )}
      {vols.length > 0 && (
        <div style={{ padding: '2px 12px 10px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 9.5 }}>
          <div style={{
            fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: col.text, opacity: 0.7, fontWeight: 600, marginBottom: 2,
          }}>Prelievi</div>
          {vols.map((v, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              color: C.page.t2, borderBottom: `1px dotted ${C.page.brd}`,
              padding: '1px 0',
            }}>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 200,
              }} title={v.nome}>{v.nome}</span>
              <span style={{ fontWeight: 500, color: col.text }}>
                {(v.vol * 1000).toFixed(v.vol < 0.01 ? 2 : 0)} µL
              </span>
            </div>
          ))}
          {volsRest > 0 && (
            <div style={{ color: C.page.th, fontSize: 9, marginTop: 2 }}>+{volsRest} altri prelievi</div>
          )}
        </div>
      )}
    </ModuloBaseWrapper>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Archi SVG overlay (dentro il world)
// ─────────────────────────────────────────────────────────────────────────────
function ArchiSVG({ archi, worldW, worldH }: { archi: Arco[]; worldW: number; worldH: number }) {
  return (
    <svg
      width={worldW} height={worldH}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      <defs>
        {['mix', 'sng', 'work', 'prep'].map(tipo => {
          const color = tipo === 'mix' ? C.mix.border : tipo === 'sng' ? C.sng.border : tipo === 'work' ? C.work.border : C.sng.border
          return (
            <marker key={tipo} id={`arr-${tipo}`} viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          )
        })}
      </defs>
      {archi.map(a => {
        const dx = a.x2 - a.x1
        const cp = Math.max(60, Math.abs(dx) / 2)
        const d = `M ${a.x1} ${a.y1} C ${a.x1 + cp} ${a.y1}, ${a.x2 - cp} ${a.y2}, ${a.x2} ${a.y2}`
        return (
          <path
            key={a.key}
            d={d}
            stroke={a.color}
            strokeWidth={1.4}
            fill="none"
            strokeDasharray={a.dashed ? '5 3' : undefined}
            markerEnd={`url(#arr-${a.tipo})`}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root: SchemaLavagna
// ─────────────────────────────────────────────────────────────────────────────
export function SchemaLavagna(props: SchemaLavagnaProps) {
  const { metodoId, analiti, crmItems, removedMix, mixLottoSel, workCols } = props

  // Deriva moduli
  const moduli = useMemo(
    () => deriveModuli(analiti, crmItems, removedMix, mixLottoSel, workCols),
    [analiti, crmItems, removedMix, mixLottoSel, workCols],
  )

  // Posizioni
  const { positions, setPosition, resetLayout } = useLavagnaPositions(metodoId, moduli)

  // Viewport state
  const viewportRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ tx: 20, ty: 20, scale: 1 })
  const panningRef = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null)

  // Refs moduli (per future integrazioni)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }, [])

  // Sidebar state
  const [filtroSidebar, setFiltroSidebar] = useState<FiltroSidebar>('tutti')
  const [hoveredAnalita, setHoveredAnalita] = useState<string | null>(null)

  // Highlighted modules: mix/sng che coprono l'analita hover
  const highlightedIds = useMemo(() => {
    if (!hoveredAnalita) return new Set<string>()
    const a = analiti.find(x => x.nome === hoveredAnalita)
    if (!a) return new Set<string>()
    const out = new Set<string>()
    for (const mid of a.mixIds) if (!removedMix.has(mid)) out.add(`MIX-${mid}`)
    for (const sid of a.sngIds) out.add(sid)
    return out
  }, [hoveredAnalita, analiti, removedMix])

  // Archi
  const archi = useMemo(() => computeArchi(moduli, positions), [moduli, positions])

  // World size
  const worldSize = useMemo(() => computeWorldSize(moduli, positions), [moduli, positions])

  // Wheel: zoom-to-cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setView(prev => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev.scale * factor))
      if (newScale === prev.scale) return prev
      const worldX = (mx - prev.tx) / prev.scale
      const worldY = (my - prev.ty) / prev.scale
      return {
        tx: mx - worldX * newScale,
        ty: my - worldY * newScale,
        scale: newScale,
      }
    })
  }, [])

  // Non-passive wheel listener per consentire preventDefault
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView(prev => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev.scale * factor))
        if (newScale === prev.scale) return prev
        const worldX = (mx - prev.tx) / prev.scale
        const worldY = (my - prev.ty) / prev.scale
        return {
          tx: mx - worldX * newScale,
          ty: my - worldY * newScale,
          scale: newScale,
        }
      })
    }
    vp.addEventListener('wheel', handler, { passive: false })
    return () => vp.removeEventListener('wheel', handler as EventListener)
  }, [])

  // Pan: mouse down su viewport (solo se target è viewport stesso)
  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    panningRef.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty }
    const onMove = (ev: MouseEvent) => {
      if (!panningRef.current) return
      const dx = ev.clientX - panningRef.current.sx
      const dy = ev.clientY - panningRef.current.sy
      setView(prev => ({ ...prev, tx: panningRef.current!.tx0 + dx, ty: panningRef.current!.ty0 + dy }))
    }
    const onUp = () => {
      panningRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [view.tx, view.ty])

  // Double-click su sfondo → reset viewport
  const handleViewportDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    setView({ tx: 20, ty: 20, scale: 1 })
  }, [])

  // Zoom buttons
  const zoomBy = useCallback((factor: number) => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const mx = rect.width / 2
    const my = rect.height / 2
    setView(prev => {
      const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev.scale * factor))
      if (newScale === prev.scale) return prev
      const worldX = (mx - prev.tx) / prev.scale
      const worldY = (my - prev.ty) / prev.scale
      return { tx: mx - worldX * newScale, ty: my - worldY * newScale, scale: newScale }
    })
  }, [])

  // Handler drag modulo → salva posizione
  const handleModuleDragEnd = useCallback((id: string, x: number, y: number) => {
    setPosition(id, x, y)
  }, [setPosition])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'row',
      minHeight: 0, background: C.page.bg,
    }}>
      <SidebarAnaliti
        analiti={analiti}
        filtro={filtroSidebar}
        onCambiaFiltro={setFiltroSidebar}
        onHoverAnalita={setHoveredAnalita}
      />
      <div
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onDoubleClick={handleViewportDoubleClick}
        onWheel={handleWheel}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: '#fafaf7',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(20,17,15,0.08) 1px, transparent 0)',
          backgroundSize: '22px 22px',
          cursor: panningRef.current ? 'grabbing' : 'default',
        }}
      >
        {/* World trasformato */}
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: worldSize.w, height: worldSize.h,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: '0 0',
        }}>
          <ArchiSVG archi={archi} worldW={worldSize.w} worldH={worldSize.h} />
          {moduli.map(m => {
            const p = positions[m.id]
            if (!p) return null
            const hl = highlightedIds.has(m.id)
            if (m.kind === 'mix') {
              return <ModuloMix key={m.id} meta={m} pos={p} scale={view.scale}
                                onDragEnd={handleModuleDragEnd}
                                registerRef={registerRef} highlighted={hl} />
            }
            if (m.kind === 'sng') {
              return <ModuloSng key={m.id} meta={m} pos={p} scale={view.scale}
                                onDragEnd={handleModuleDragEnd}
                                registerRef={registerRef} highlighted={hl} />
            }
            return <ModuloWork key={m.id} meta={m} pos={p} scale={view.scale}
                               onDragEnd={handleModuleDragEnd}
                               registerRef={registerRef} highlighted={hl} />
          })}
        </div>

        {/* Controlli zoom (bottom right) */}
        <div style={{
          position: 'absolute', right: 16, bottom: 16, display: 'flex',
          gap: 4, background: C.page.sur, border: `1px solid ${C.page.brd}`,
          borderRadius: 6, padding: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        }}>
          <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out" style={zoomBtnStyle()}>−</button>
          <button onClick={() => setView({ tx: 20, ty: 20, scale: 1 })} title="Reset vista"
                  style={zoomBtnStyle()}>⤾</button>
          <button onClick={() => zoomBy(1.2)} title="Zoom in" style={zoomBtnStyle()}>＋</button>
          <div style={{ width: 1, background: C.page.brd, margin: '2px 2px' }} />
          <button onClick={resetLayout} title="Riallinea moduli (L→R)" style={{
            ...zoomBtnStyle(), width: 'auto', padding: '0 10px', fontSize: 11,
          }}>Riallinea</button>
          <div style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: C.page.t2,
            display: 'flex', alignItems: 'center', padding: '0 6px',
          }}>{Math.round(view.scale * 100)}%</div>
        </div>
      </div>
    </div>
  )
}

function zoomBtnStyle(): React.CSSProperties {
  return {
    width: 26, height: 26, border: `1px solid ${C.page.brd2}`,
    borderRadius: 4, background: C.page.sur, color: C.page.t1,
    fontSize: 14, cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}
