// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.lavagna.tsx
//
// Vista "Lavagna" dello Schema di Calibrazione (read-only, flusso L→R).
// Canvas pan/zoom/drag gestito da React Flow (@xyflow/react). Archi calcolati
// da computeEdges() e aggiornati automaticamente dalla libreria durante il drag.
// Layout iniziale a colonne Mix → Sng → Work(colIdx) con dagre per ordinare Y
// e minimizzare gli incroci delle frecce.
//
// Persistenza posizioni in localStorage (chiave v2 per metodoId).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls,
  useNodesState,
  Handle, Position as HandlePosition, MarkerType,
  type Node, type Edge, type NodeProps, type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
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
  onToggleMix?: (mixId: string) => void
  onToggleSng?: (sngId: string) => void
  onTogglePrepStock?: (prepKey: string, prepId: number, crmNome: string, cv: number, lotto: string | null, flacone: string | null, progressivo: number | null) => void
  onToggleWork?: (work: WorkInSchema, colSrc: number) => void
  onDeleteWork?: (colIdx: number, workIdx: number) => void
  onOpenWorkDrawer?: (work: WorkInSchema, colIdx: number) => void
  onRicaricaWork?: (workId: number) => void
  onRemoveMix?: (mixId: string) => void
  onRemoveSng?: (sngId: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Costanti layout (più espanse rispetto alla v1 per ridurre sovrapposizioni)
// ─────────────────────────────────────────────────────────────────────────────
const LAYOUT = {
  COL_X: { mix: 60, sng: 560 } as const,
  COL_WORK_BASE: 1160,
  COL_WORK_GAP: 560,
  MODULE_W: { mix: 340, sng: 260, work: 360 } as const,
  MODULE_H_MIN: { mix: 180, sng: 130, work: 210 } as const,
  ROW_GAP: 80,
  Y_START: 40,
}
const SIDEBAR_W = 240
const LS_KEY_PREFIX = 'lcms:lavagna:positions:v2:'
const LS_VERSION = 2

type Position = { x: number; y: number }
type Positions = Record<string, Position>
type FiltroSidebar = 'tutti' | 'coperti' | 'scoperti'

type ModuloKind = 'mix' | 'sng' | 'work'

// ModuloMeta: estesa per portare tutti i mix_id associati (attivo + alternativi)
// in modo che le sorgenti di una Work riferite a un lotto alternativo risolvano.
type ModuloMeta =
  | { kind: 'mix'; id: string; mixId: string; mixIds: string[]; crm: CrmItem; comps: string[]; lottiAlt: number }
  | { kind: 'sng'; id: string; crm: CrmItem; preps: PrepStockItem[] }
  | { kind: 'work'; id: string; work: WorkInSchema; colIdx: number; rowIdx: number }

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
function deriveModuli(
  analiti: AnalitoItem[],
  crmItems: CrmItem[],
  removedMix: Set<string>,
  mixLottoSel: Map<string, string>,
  workCols: WorkInSchema[][],
): ModuloMeta[] {
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

  for (const a of analiti) {
    if (!a.mixIds || a.mixIds.length === 0) continue
    const firma = a.mixIds.join('|')
    const attivoCandidate = mixLottoSel.get(firma)
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
    const lottiAlt = a.mixIds.length > 1 ? a.mixIds.length - 1 : 0
    result.push({
      kind: 'mix',
      id: `MIX-${attivo}`,
      mixId: attivo,
      mixIds: a.mixIds.slice(),    // tutti i lotti (per lookup archi)
      crm: head,
      comps: nomiComp,
      lottiAlt,
    })
  }

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

  workCols.forEach((col, ci) => {
    col.forEach((w, wi) => {
      result.push({ kind: 'work', id: w.id, work: w, colIdx: ci, rowIdx: wi })
    })
  })

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Altezza stimata del modulo (l'altezza reale può essere leggermente diversa
// ma questa stima serve solo a dagre per ordinare le righe)
// ─────────────────────────────────────────────────────────────────────────────
function estimatedHeight(m: ModuloMeta): number {
  if (m.kind === 'mix') return LAYOUT.MODULE_H_MIN.mix
  if (m.kind === 'sng') {
    const isNeat = (m.crm.forma || '').toLowerCase().includes('neat')
    const preps = m.preps.slice(0, 2)
    return LAYOUT.MODULE_H_MIN.sng + (isNeat && preps.length ? 56 + preps.length * 18 : 0)
  }
  const vols = m.work.vols.slice(0, 4)
  return LAYOUT.MODULE_H_MIN.work + vols.length * 14
}

// ─────────────────────────────────────────────────────────────────────────────
// Edges di React Flow (stessa logica di matching di computeArchi v1 ma con
// mixMod indicizzato su TUTTI i mix_id — attivo + alternativi).
// ─────────────────────────────────────────────────────────────────────────────
function computeEdges(moduli: ModuloMeta[]): Edge[] {
  const edges: Edge[] = []
  const workMod = new Map<string, ModuloMeta>()
  const mixMod = new Map<string, ModuloMeta>()
  const sngMod = new Map<string, ModuloMeta>()
  const prepInSng = new Map<string, string>()

  for (const m of moduli) {
    if (m.kind === 'work') workMod.set(m.id, m)
    else if (m.kind === 'mix') {
      for (const mid of m.mixIds) mixMod.set(mid, m)
    } else if (m.kind === 'sng') {
      sngMod.set(m.id, m)
      for (const p of m.preps) prepInSng.set(String(p.id), m.id)
    }
  }

  for (const m of moduli) {
    if (m.kind !== 'work') continue
    const w = m.work
    for (let i = 0; i < w.srcs.length; i++) {
      const s = w.srcs[i]
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

      edges.push({
        id: `${fromMod.id}→${m.id}:${s.tipo}:${s.id}:${s.prepId ?? ''}:${i}`,
        source: fromMod.id,
        target: m.id,
        type: 'default',
        data: { tipo: s.tipo as SorgenteTipo },
        style: {
          stroke: color,
          strokeWidth: 1.6,
          strokeDasharray: dashed ? '5 3' : undefined,
          opacity: 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 14,
          height: 14,
        },
      })
    }
  }

  return edges
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout iniziale: colonne L→R fisse + dagre per ordinare Y riducendo incroci
// ─────────────────────────────────────────────────────────────────────────────
function computeInitialLayout(moduli: ModuloMeta[], edges: Edge[]): Positions {
  // 1) Costruisco un grafo dagre solo per capire l'ordinamento verticale
  //    suggerito da una layout Left→Right standard.
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: LAYOUT.ROW_GAP, ranksep: 280, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const m of moduli) {
    g.setNode(m.id, {
      width: LAYOUT.MODULE_W[m.kind],
      height: estimatedHeight(m),
    })
  }
  for (const e of edges) g.setEdge(e.source, e.target)

  try { dagre.layout(g) } catch { /* no-op: se dagre fallisce, usa fallback a colonne */ }

  // 2) Ricavo l'ordine verticale suggerito da dagre per ogni "rank"
  //    (= kind/colonna). Poi stacco le X sulle colonne L→R fisse.
  type WithY = { id: string; dagreY: number; kind: ModuloKind; colIdx?: number }
  const nodes: WithY[] = moduli.map(m => {
    const dg = g.node(m.id)
    return {
      id: m.id,
      dagreY: dg ? dg.y : 0,
      kind: m.kind,
      colIdx: m.kind === 'work' ? m.colIdx : undefined,
    }
  })

  // Raggruppa per colonna: mix | sng | work-col-0 | work-col-1 ...
  const colKey = (n: WithY) =>
    n.kind === 'mix' ? 'mix' : n.kind === 'sng' ? 'sng' : `work-${n.colIdx ?? 0}`

  const grouped = new Map<string, WithY[]>()
  for (const n of nodes) {
    const k = colKey(n)
    const arr = grouped.get(k) || []
    arr.push(n)
    grouped.set(k, arr)
  }

  // Ordina ogni colonna per dagreY crescente
  for (const [, arr] of grouped) arr.sort((a, b) => a.dagreY - b.dagreY)

  // X fissa per colonna
  const xOf = (k: string): number => {
    if (k === 'mix') return LAYOUT.COL_X.mix
    if (k === 'sng') return LAYOUT.COL_X.sng
    const m = k.match(/^work-(\d+)$/)
    const ci = m ? parseInt(m[1], 10) : 0
    return LAYOUT.COL_WORK_BASE + ci * LAYOUT.COL_WORK_GAP
  }

  // Calcola Y stacked per colonna con ROW_GAP
  const positions: Positions = {}
  const modById = new Map<string, ModuloMeta>(moduli.map(m => [m.id, m]))
  for (const [k, arr] of grouped) {
    let cursorY = LAYOUT.Y_START
    for (const n of arr) {
      const m = modById.get(n.id)
      if (!m) continue
      positions[n.id] = { x: xOf(k), y: cursorY }
      cursorY += estimatedHeight(m) + LAYOUT.ROW_GAP
    }
  }
  return positions
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: posizioni in localStorage (per metodoId) — chiave v2
// ─────────────────────────────────────────────────────────────────────────────
function useLavagnaPositions(metodoId: string, moduli: ModuloMeta[], edges: Edge[]) {
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

  // Auto-layout per moduli senza posizione salvata (nuovi o primo mount)
  const modIdsKey = useMemo(() => moduli.map(m => m.id).join('|'), [moduli])
  useEffect(() => {
    setPositions(prev => {
      const missing = moduli.filter(m => !(m.id in prev))
      if (missing.length === 0) return prev
      const auto = computeInitialLayout(moduli, edges)
      const merged = { ...prev }
      for (const m of missing) merged[m.id] = auto[m.id] ?? { x: 0, y: 0 }
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
    const auto = computeInitialLayout(moduli, edges)
    dirtyRef.current = true
    setPositions(auto)
  }, [key, moduli, edges])

  return { positions, setPosition, resetLayout }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sotto-componente: SidebarAnaliti (invariato dalla v1)
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
// Card wrapper: base stilistica + Handle L/R per React Flow
// ─────────────────────────────────────────────────────────────────────────────
function CardBase({
  width, bg, border, borderLeftColor, highlighted, children,
}: {
  width: number
  bg: string; border: string; borderLeftColor: string
  highlighted: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      width,
      background: bg,
      border: `1.5px solid ${border}`,
      borderLeft: `4px solid ${borderLeftColor}`,
      borderRadius: 6,
      boxShadow: highlighted
        ? `0 0 0 3px rgba(155,134,214,0.35), 0 2px 6px rgba(0,0,0,0.05)`
        : '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <Handle
        type="target"
        position={HandlePosition.Left}
        style={{ background: border, width: 8, height: 8, border: 'none' }}
      />
      {children}
      <Handle
        type="source"
        position={HandlePosition.Right}
        style={{ background: border, width: 8, height: 8, border: 'none' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Analiti (lista analiti sulla lavagna con filtri e chip)
// ─────────────────────────────────────────────────────────────────────────────
const ANALITI_NODE_ID = 'ANALITI'
const ANALITI_NODE_W = 240

type AnalitiNodeData = {
  analiti: AnalitoItem[]
  filtro: FiltroSidebar
  onCambiaFiltro: (f: FiltroSidebar) => void
  onHoverAnalita: (nome: string | null) => void
}

function AnalitiNode({ data }: NodeProps<Node<AnalitiNodeData>>) {
  const { analiti, filtro, onCambiaFiltro, onHoverAnalita } = data

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
      width: ANALITI_NODE_W,
      background: C.page.sur,
      border: `1.5px solid ${C.page.brd2}`,
      borderLeft: `4px solid ${C.page.t2}`,
      borderRadius: 6,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 480,
    }}>
      <Handle
        type="source"
        position={HandlePosition.Right}
        style={{ background: C.page.t2, width: 8, height: 8, border: 'none' }}
      />
      <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${C.page.brd}` }}>
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

// Calcola edges dal nodo Analiti verso i moduli Mix/Sng che coprono ogni analita
function computeAnalitiEdges(analiti: AnalitoItem[], moduli: ModuloMeta[]): Edge[] {
  const edges: Edge[] = []
  const mixModById = new Map<string, string>() // mixId → nodo id
  const sngModById = new Map<string, string>()  // sng id → nodo id
  for (const m of moduli) {
    if (m.kind === 'mix') for (const mid of m.mixIds) mixModById.set(mid, m.id)
    else if (m.kind === 'sng') sngModById.set(m.id, m.id)
  }
  const seen = new Set<string>()
  for (const a of analiti) {
    if (a.mixId) {
      const targetId = mixModById.get(a.mixId)
      if (targetId && !seen.has(targetId)) {
        seen.add(targetId)
        edges.push({
          id: `ANALITI→${targetId}`,
          source: ANALITI_NODE_ID,
          target: targetId,
          type: 'default',
          style: { stroke: C.mix.border, strokeWidth: 1.2, opacity: 0.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: C.mix.border, width: 12, height: 12 },
        })
      }
    }
    for (const sid of a.sngIds) {
      const targetId = sngModById.get(sid)
      if (targetId && !seen.has(targetId)) {
        seen.add(targetId)
        edges.push({
          id: `ANALITI→${targetId}`,
          source: ANALITI_NODE_ID,
          target: targetId,
          type: 'default',
          style: { stroke: C.sng.border, strokeWidth: 1.2, opacity: 0.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: C.sng.border, width: 12, height: 12 },
        })
      }
    }
  }
  return edges
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Mix
// ─────────────────────────────────────────────────────────────────────────────
type MixNodeData = { meta: Extract<ModuloMeta, { kind: 'mix' }>; highlighted: boolean }
function ModuloMixNode({ data }: NodeProps<Node<MixNodeData>>) {
  const meta = data.meta
  const crm = meta.crm
  const sBadge = scadenzaBadge(crm.scadenza_prodotto)
  const rival = crm.ultima_rivalidazione
  const nomeMix = crm.mix || meta.mixId
  const nComp = meta.comps.length
  const compVisible = meta.comps.slice(0, 6)
  const rimanenti = nComp - compVisible.length

  return (
    <CardBase
      width={LAYOUT.MODULE_W.mix}
      bg={C.mix.bg} border={C.mix.border} borderLeftColor={C.mix.border}
      highlighted={data.highlighted}
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
    </CardBase>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Sng
// ─────────────────────────────────────────────────────────────────────────────
type SngNodeData = { meta: Extract<ModuloMeta, { kind: 'sng' }>; highlighted: boolean }
function ModuloSngNode({ data }: NodeProps<Node<SngNodeData>>) {
  const meta = data.meta
  const crm = meta.crm
  const isNeat = (crm.forma || '').toLowerCase().includes('neat')
  const sBadge = scadenzaBadge(crm.scadenza_prodotto)
  const rival = crm.ultima_rivalidazione
  const preps = meta.preps.slice(0, 2)
  const prepExtra = meta.preps.length - preps.length

  return (
    <CardBase
      width={LAYOUT.MODULE_W.sng}
      bg={C.sng.bg} border={C.sng.border} borderLeftColor={C.sng.border}
      highlighted={data.highlighted}
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
    </CardBase>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Work
// ─────────────────────────────────────────────────────────────────────────────
type WorkNodeData = { meta: Extract<ModuloMeta, { kind: 'work' }>; highlighted: boolean }
function ModuloWorkNode({ data }: NodeProps<Node<WorkNodeData>>) {
  const meta = data.meta
  const w = meta.work
  const isInter = meta.colIdx > 0
  const col = isInter ? C.inter : C.work
  const srcsNames = w.srcs.map(s => s.nome)
  const chipVis = srcsNames.slice(0, 5)
  const chipRest = srcsNames.length - chipVis.length
  const vols = w.vols.slice(0, 4)
  const volsRest = w.vols.length - vols.length

  return (
    <CardBase
      width={LAYOUT.MODULE_W.work}
      bg={col.bg} border={col.border} borderLeftColor={col.border}
      highlighted={data.highlighted}
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
    </CardBase>
  )
}

// nodeTypes definito fuori dal componente per evitare ri-render spuri di RF
const nodeTypes = {
  mix: ModuloMixNode,
  sng: ModuloSngNode,
  work: ModuloWorkNode,
  analiti: AnalitiNode,
}

// ─────────────────────────────────────────────────────────────────────────────
// Root: SchemaLavagna
// ─────────────────────────────────────────────────────────────────────────────
export function SchemaLavagna(props: SchemaLavagnaProps) {
  const {
    metodoId, analiti, crmItems, removedMix, mixLottoSel, workCols,
    selSrcs,
    onToggleMix, onToggleSng, onTogglePrepStock, onToggleWork,
    onDeleteWork, onOpenWorkDrawer, onRicaricaWork,
    onRemoveMix, onRemoveSng,
  } = props

  const moduli = useMemo(
    () => deriveModuli(analiti, crmItems, removedMix, mixLottoSel, workCols),
    [analiti, crmItems, removedMix, mixLottoSel, workCols],
  )

  const moduliEdges = useMemo(() => computeEdges(moduli), [moduli])
  const analitiEdgesBase = useMemo(() => computeAnalitiEdges(analiti, moduli), [analiti, moduli])

  const { positions, setPosition, resetLayout } = useLavagnaPositions(metodoId, moduli, moduliEdges)

  const [filtroSidebar, setFiltroSidebar] = useState<FiltroSidebar>('tutti')
  const [hoveredAnalita, setHoveredAnalita] = useState<string | null>(null)
  // Selezione: nodeId o null (click su card) — deseleziona cliccando su sfondo
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const analitiPos = useMemo(() => {
    if (positions[ANALITI_NODE_ID]) return positions[ANALITI_NODE_ID]
    return { x: LAYOUT.COL_X.mix - ANALITI_NODE_W - 80, y: LAYOUT.Y_START }
  }, [positions])

  // Nodi connessi al selectedId (via edge source/target)
  const connectedToSelected = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const out = new Set<string>()
    for (const e of [...moduliEdges, ...analitiEdgesBase]) {
      if (e.source === selectedId) out.add(e.target)
      if (e.target === selectedId) out.add(e.source)
    }
    return out
  }, [selectedId, moduliEdges, analitiEdgesBase])

  // highlightedIds: hover analita OR selezione nodo
  const highlightedIds = useMemo(() => {
    if (hoveredAnalita) {
      const a = analiti.find(x => x.nome === hoveredAnalita)
      if (!a) return new Set<string>()
      const out = new Set<string>()
      for (const mid of a.mixIds) if (!removedMix.has(mid)) out.add(`MIX-${mid}`)
      for (const sid of a.sngIds) out.add(sid)
      return out
    }
    if (selectedId) {
      return new Set<string>([selectedId, ...connectedToSelected])
    }
    return new Set<string>()
  }, [hoveredAnalita, selectedId, connectedToSelected, analiti, removedMix])

  // Merge: evidenzia anche i CRM selezionati in selSrcs
  const highlightedIdsWithSel = useMemo(() => {
    const out = new Set(highlightedIds)
    for (const m of moduli) {
      if (m.kind === 'mix' && selSrcs.has(m.mixId)) out.add(m.id)
      if (m.kind === 'sng' && selSrcs.has(m.id)) out.add(m.id)
    }
    return out
  }, [highlightedIds, moduli, selSrcs])

  // Edges con evidenziazione quando c'è selezione
  const edges = useMemo(() => {
    const allEdges = [...moduliEdges, ...analitiEdgesBase]
    if (!selectedId) return allEdges
    return allEdges.map(e => {
      const active = e.source === selectedId || e.target === selectedId
      return {
        ...e,
        style: {
          ...e.style,
          opacity: active ? 1 : 0.15,
          strokeWidth: active ? 2.5 : (e.style?.strokeWidth ?? 1.6),
        },
        animated: active,
      }
    })
  }, [moduliEdges, analitiEdgesBase, selectedId])

  const analitiNodeData = useMemo<AnalitiNodeData>(() => ({
    analiti,
    filtro: filtroSidebar,
    onCambiaFiltro: setFiltroSidebar,
    onHoverAnalita: setHoveredAnalita,
  }), [analiti, filtroSidebar])

  // Nodi strutturali: posizioni + meta. NON include highlighted per evitare
  // che l'hover ricostruisca tutti i nodi e triggeri setRfNodes in loop.
  const structuralNodes: Node[] = useMemo(() => {
    const analitiNode: Node = {
      id: ANALITI_NODE_ID,
      type: 'analiti',
      position: analitiPos,
      draggable: true,
      selectable: true,
      data: analitiNodeData,
    }
    const moduliNodes = moduli.map(m => {
      const p = positions[m.id] || { x: 0, y: 0 }
      const base = { id: m.id, position: p, draggable: true, selectable: true }
      if (m.kind === 'mix') {
        return { ...base, type: 'mix', data: { meta: m, highlighted: false } as MixNodeData }
      }
      if (m.kind === 'sng') {
        return { ...base, type: 'sng', data: { meta: m, highlighted: false } as SngNodeData }
      }
      return { ...base, type: 'work', data: { meta: m, highlighted: false } as WorkNodeData }
    })
    return [analitiNode, ...moduliNodes]
  }, [moduli, positions, analitiPos, analitiNodeData])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(structuralNodes)

  // Sincronizza struttura (posizioni, lista moduli) senza toccare highlighted
  const isDraggingRef = useRef(false)
  useEffect(() => {
    if (isDraggingRef.current) return
    setRfNodes(prev => {
      // Aggiorna solo id/position/data strutturale — preserva highlighted dal prev
      const prevMap = new Map(prev.map(n => [n.id, n]))
      return structuralNodes.map(n => {
        const old = prevMap.get(n.id)
        if (!old) return n
        // Preserva highlighted dal prev per non cancellare l'evidenziazione corrente
        const oldHighlighted = (old.data as { highlighted?: boolean }).highlighted ?? false
        return {
          ...n,
          position: old.position, // usa posizione RF (potrebbe essere diversa da structuralNodes dopo drag)
          data: { ...n.data, highlighted: oldHighlighted },
        }
      })
    })
  }, [structuralNodes, setRfNodes])

  // Aggiorna solo il flag highlighted — chirurgico, non tocca posizioni
  useEffect(() => {
    if (isDraggingRef.current) return
    setRfNodes(prev => prev.map(n => {
      const shouldHighlight = highlightedIdsWithSel.has(n.id)
      const currentHighlight = (n.data as { highlighted?: boolean }).highlighted ?? false
      if (shouldHighlight === currentHighlight) return n
      return { ...n, data: { ...n.data, highlighted: shouldHighlight } }
    }))
  }, [highlightedIdsWithSel, setRfNodes])

  // Persisti posizione a fine drag
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    let dragging = false
    for (const ch of changes) {
      if (ch.type === 'position') {
        if (ch.dragging) { dragging = true }
        else if (ch.position) { setPosition(ch.id, ch.position.x, ch.position.y) }
      }
    }
    isDraggingRef.current = dragging
  }, [onNodesChange, setPosition])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const id = node.id
    // Selezione visiva (highlight connessioni)
    setSelectedId(prev => prev === id ? null : id)
    setHoveredAnalita(null)

    // Toggle selSrcs per CRM mix e sng (aggiorna lo stato condiviso nel parent)
    const m = moduli.find(x => x.id === id)
    if (!m) return

    if (m.kind === 'mix' && onToggleMix) {
      onToggleMix(m.mixId)
    } else if (m.kind === 'sng' && onToggleSng) {
      onToggleSng(m.id)
    }
    // I nodi Work non aggiornano selSrcs al click semplice
  }, [moduli, onToggleMix, onToggleSng])

  const handlePaneClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleEdgeClick = useCallback((_evt: React.MouseEvent, edge: Edge) => {
    // Click su freccia seleziona il nodo sorgente
    setSelectedId(prev => prev === edge.source ? null : edge.source)
    setHoveredAnalita(null)
  }, [])

  return (
    <div style={{ flex: 1, minHeight: 0, background: C.page.bg }}>
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        minZoom={0.25}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'default' }}
      >
        <Background gap={22} size={1} color="rgba(20,17,15,0.08)" />
        <Controls showInteractive={false} />
        <div style={{
          position: 'absolute', right: 16, top: 16, zIndex: 5,
          display: 'flex', gap: 4,
        }}>
          <button
            onClick={resetLayout}
            title="Riallinea moduli (L→R)"
            style={{
              height: 26, padding: '0 10px',
              border: `1px solid ${C.page.brd2}`, borderRadius: 4,
              background: C.page.sur, color: C.page.t1,
              fontSize: 11, cursor: 'pointer',
            }}
          >Riallinea</button>
        </div>
      </ReactFlow>
    </div>
  )
}
