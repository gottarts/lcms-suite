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
const GROUP_GAP = 120 // Spazio verticale extra tra cluster CRM
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
// Clustering: raggruppa CRM (mix/sng) con analiti in comune (union-find)
// ─────────────────────────────────────────────────────────────────────────────
function computeClusters(
  moduli: ModuloMeta[],
  analiti: AnalitoItem[],
): Map<string, { nodeIds: string[]; analitiCondivisi: string[] }> {
  const nodeAnaliti = new Map<string, Set<string>>()
  for (const m of moduli) {
    if (m.kind !== 'mix' && m.kind !== 'sng') continue
    const covered = new Set<string>()
    for (const a of analiti) {
      if (m.kind === 'mix' && m.mixIds.some(mid => a.mixIds.includes(mid))) covered.add(a.nome)
      if (m.kind === 'sng' && a.sngIds.includes(m.id)) covered.add(a.nome)
    }
    if (covered.size > 0) nodeAnaliti.set(m.id, covered)
  }
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x)
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }
  const union = (a: string, b: string) => { parent.set(find(a), find(b)) }
  const nodeIds = [...nodeAnaliti.keys()]
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const ai = nodeAnaliti.get(nodeIds[i])!
      const aj = nodeAnaliti.get(nodeIds[j])!
      for (const nome of ai) { if (aj.has(nome)) { union(nodeIds[i], nodeIds[j]); break } }
    }
  }
  const groups = new Map<string, string[]>()
  for (const id of nodeIds) {
    const root = find(id)
    const arr = groups.get(root) || []; arr.push(id); groups.set(root, arr)
  }
  const result = new Map<string, { nodeIds: string[]; analitiCondivisi: string[] }>()
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue
    const countMap = new Map<string, number>()
    for (const id of ids) for (const nome of nodeAnaliti.get(id)!) countMap.set(nome, (countMap.get(nome) || 0) + 1)
    const condivisi = [...countMap.entries()].filter(([, cnt]) => cnt >= 2).map(([nome]) => nome)
    result.set(root, { nodeIds: ids, analitiCondivisi: condivisi })
  }
  return result
}

const GROUP_PADDING = 60

function groupDimensions(nodeIds: string[], moduli: ModuloMeta[], positions: Positions) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of nodeIds) {
    const pos = positions[id]; if (!pos) continue
    const m = moduli.find(x => x.id === id)
    const w = m ? LAYOUT.MODULE_W[m.kind] : 260
    const h = m ? estimatedHeight(m) : 200
    minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + w); maxY = Math.max(maxY, pos.y + h)
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 400, height: 300 }
  return { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING, width: maxX - minX + GROUP_PADDING * 2, height: maxY - minY + GROUP_PADDING * 2 }
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
function computeInitialLayout(moduli: ModuloMeta[], edges: Edge[], clusters?: Map<string, { nodeIds: string[]; analitiCondivisi: string[] }>): Positions {
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

  // Calcola Y stacked per colonna con ROW_GAP e GROUP_GAP
  // Se clusters forniti: riordina ogni colonna in modo che i nodi dello stesso
  // cluster siano consecutivi (minimizza dimensioni GroupNode).
  const positions: Positions = {}
  const modById = new Map<string, ModuloMeta>(moduli.map(m => [m.id, m]))

  // Mappa nodeId → clusterId (solo mix/sng)
  const nodeClusterMap = new Map<string, string>()
  if (clusters) {
    let ci = 0
    for (const [, cl] of clusters) {
      const gid = `c${ci++}`
      for (const id of cl.nodeIds) nodeClusterMap.set(id, gid)
    }
  }

  for (const [k, arr] of grouped) {
    // Se clusters presenti, riordina: prima i cluster raggruppati, poi i singoli
    let ordered = arr
    if (clusters && nodeClusterMap.size > 0) {
      const clusterOrder = new Map<string, number>()
      let clusterRank = 0
      for (const n of arr) {
        const cid = nodeClusterMap.get(n.id)
        if (cid && !clusterOrder.has(cid)) clusterOrder.set(cid, clusterRank++ * 1000)
      }
      ordered = [...arr].sort((a, b) => {
        const ca = nodeClusterMap.get(a.id); const cb = nodeClusterMap.get(b.id)
        if (ca && cb && ca === cb) return a.dagreY - b.dagreY
        const rankA = ca ? (clusterOrder.get(ca) ?? 0) + a.dagreY : 1e9 + a.dagreY
        const rankB = cb ? (clusterOrder.get(cb) ?? 0) + b.dagreY : 1e9 + b.dagreY
        return rankA - rankB
      })
    }

    let cursorY = LAYOUT.Y_START
    let currentCluster: string | null = null

    for (const n of ordered) {
      const m = modById.get(n.id)
      if (!m) continue

      const clusterId = nodeClusterMap.get(n.id) || null

      // Aggiungi gap quando si cambia cluster (o si passa a nodi senza cluster)
      if (currentCluster !== clusterId && cursorY > LAYOUT.Y_START) {
        cursorY += GROUP_GAP
      }

      positions[n.id] = { x: xOf(k), y: cursorY }
      cursorY += estimatedHeight(m) + LAYOUT.ROW_GAP
      currentCluster = clusterId
    }
  }
  return positions
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: posizioni in localStorage (per metodoId) — chiave v2
// ─────────────────────────────────────────────────────────────────────────────
function useLavagnaPositions(metodoId: string, moduli: ModuloMeta[], edges: Edge[], clusters: Map<string, { nodeIds: string[]; analitiCondivisi: string[] }>) {
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
      const auto = computeInitialLayout(moduli, edges, clusters)
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
    const auto = computeInitialLayout(moduli, edges, clusters)
    dirtyRef.current = true
    setPositions(auto)
  }, [key, moduli, edges, clusters])

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
  width,
  bg, border, borderLeftColor,
  highlighted,
  selected,
  children,
}: {
  width: number
  bg: string; border: string; borderLeftColor: string
  highlighted: boolean
  selected?: boolean
  children: React.ReactNode
}) {
  // Stili base
  const baseStyle: React.CSSProperties = {
    width,
    background: bg,
    border: `1.5px solid ${border}`,
    borderLeft: `4px solid ${borderLeftColor}`,
    borderRadius: 6,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.1s ease, border-color 0.1s ease',
  }

  // Stile per evidenziazione (hover / connessione)
  if (highlighted && !selected) {
    baseStyle.boxShadow = `0 0 0 3px rgba(155,134,214,0.35), 0 2px 6px rgba(0,0,0,0.05)`
  }

  // Stile per selezione (click sulla card) – molto più visibile
  if (selected) {
    baseStyle.border = `2px solid #2b6cb0`          // bordo blu spesso
    baseStyle.boxShadow = `0 0 0 2px rgba(49,130,206,0.4), 0 4px 12px rgba(0,0,0,0.15)`
  }

  return (
    <div style={baseStyle}>
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
type MixNodeData = { meta: Extract<ModuloMeta, { kind: 'mix' }>; highlighted: boolean; selected?: boolean; onRemoveMix?: (mixId: string) => void }
function ModuloMixNode({ data }: NodeProps<Node<MixNodeData>>) {
  const meta = data.meta
  const crm = meta.crm
  const [expanded, setExpanded] = useState(false)
  const sBadge = scadenzaBadge(crm.scadenza_prodotto)
  const rival = crm.ultima_rivalidazione
  const nomeMix = crm.mix || meta.mixId
  const nComp = meta.comps.length
  const MAX_CHIP = 4
  const compVisible = expanded ? meta.comps : meta.comps.slice(0, MAX_CHIP)
  const rimanenti = nComp - MAX_CHIP

  return (
    <CardBase
      width={LAYOUT.MODULE_W.mix}
      bg={C.mix.bg} border={C.mix.border} borderLeftColor={C.mix.border}
      highlighted={data.highlighted}
      selected={data.selected}
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
        {sBadge && sBadge.color !== C.page.th && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            background: sBadge.color, color: '#fff',
            whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700,
          }}>{sBadge.color === '#dc2626' ? 'SCAD' : 'SCAD~'}</span>
        )}
        {meta.lottiAlt > 0 && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            background: C.page.sur, border: `1px solid ${C.mix.border}`,
            color: C.mix.text, whiteSpace: 'nowrap', flexShrink: 0,
          }}>+{meta.lottiAlt} lotti</span>
        )}
        {data.onRemoveMix && (
          <button
            onClick={(e) => { e.stopPropagation(); data.onRemoveMix!(meta.mixId) }}
            title="Rimuovi dalla lavagna"
            style={{
              width: 18, height: 18, borderRadius: '50%', border: 'none',
              background: C.con.bg, color: C.con.text, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, padding: 0,
            }}
          >×</button>
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
        {!expanded && rimanenti > 0 && (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(true) }} style={{
            display: 'inline-block', fontSize: 9.5, padding: '1px 6px', margin: '1px 3px',
            background: 'transparent', border: `1px solid ${C.mix.border}`,
            borderRadius: 2, color: C.mix.text, cursor: 'pointer',
          }}>▼ +{rimanenti}</button>
        )}
        {expanded && nComp > MAX_CHIP && (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(false) }} style={{
            display: 'block', marginTop: 4, fontSize: 9.5, padding: '1px 6px',
            background: 'transparent', border: `1px solid ${C.mix.border}`,
            borderRadius: 2, color: C.mix.text, cursor: 'pointer',
          }}>▲ Comprimi</button>
        )}
      </div>
    </CardBase>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Sng
// ─────────────────────────────────────────────────────────────────────────────
type SngNodeData = { meta: Extract<ModuloMeta, { kind: 'sng' }>; highlighted: boolean; selected?: boolean; onRemoveSng?: (sngId: string) => void }
function ModuloSngNode({ data }: NodeProps<Node<SngNodeData>>) {
  const meta = data.meta
  const crm = meta.crm
  const [prepExpanded, setPrepExpanded] = useState(false)
  const isNeat = (crm.forma || '').toLowerCase().includes('neat')
  const sBadge = scadenzaBadge(crm.scadenza_prodotto)
  const rival = crm.ultima_rivalidazione
  // Badge alert prep NEAT scadute/in scadenza
  const worstPrepBadge = isNeat ? meta.preps.reduce<{ color: string; label: string } | null>((worst, p) => {
    const b = scadenzaBadge(p.scadenza)
    if (!b || b.color === C.page.th) return worst
    if (!worst) return b
    return b.color === '#dc2626' ? b : worst
  }, null) : null
  const MAX_PREP = 2
  const preps = prepExpanded ? meta.preps : meta.preps.slice(0, MAX_PREP)
  const prepExtra = meta.preps.length - MAX_PREP

  return (
    <CardBase
      width={LAYOUT.MODULE_W.sng}
      bg={C.sng.bg} border={C.sng.border} borderLeftColor={C.sng.border}
      highlighted={data.highlighted}
      selected={data.selected}
    >
      <div style={{
        padding: '8px 12px 6px', borderBottom: `1px solid ${C.sng.chip}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: C.sng.text, opacity: 0.7, fontWeight: 600, marginBottom: 2,
          }}>{isNeat ? 'Singolo · Neat' : 'Singolo CRM'}</div>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: C.sng.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={crm.nome}>{crm.nome}</div>
        </div>
        {sBadge && sBadge.color !== C.page.th && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            background: sBadge.color, color: '#fff',
            whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700,
          }}>{sBadge.color === '#dc2626' ? 'SCAD' : 'SCAD~'}</span>
        )}
        {worstPrepBadge && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            background: worstPrepBadge.color, color: '#fff',
            whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700,
          }}>{worstPrepBadge.color === '#dc2626' ? 'NEAT SCAD' : 'NEAT~'}</span>
        )}
        {data.onRemoveSng && (
          <button
            onClick={(e) => { e.stopPropagation(); data.onRemoveSng!(meta.id) }}
            title="Rimuovi dalla lavagna"
            style={{
              width: 18, height: 18, borderRadius: '50%', border: 'none',
              background: C.con.bg, color: C.con.text, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, padding: 0,
            }}
          >×</button>
        )}
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
          {!prepExpanded && prepExtra > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setPrepExpanded(true) }} style={{
              marginTop: 3, fontSize: 9.5, padding: '1px 6px',
              background: 'transparent', border: `1px solid ${C.sng.border}`,
              borderRadius: 2, color: C.sng.text, cursor: 'pointer',
            }}>▼ +{prepExtra} prep.</button>
          )}
          {prepExpanded && meta.preps.length > MAX_PREP && (
            <button onClick={(e) => { e.stopPropagation(); setPrepExpanded(false) }} style={{
              marginTop: 3, fontSize: 9.5, padding: '1px 6px',
              background: 'transparent', border: `1px solid ${C.sng.border}`,
              borderRadius: 2, color: C.sng.text, cursor: 'pointer',
            }}>▲ Comprimi</button>
          )}
        </div>
      )}
    </CardBase>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Work
// ─────────────────────────────────────────────────────────────────────────────
type WorkNodeData = {
  meta: Extract<ModuloMeta, { kind: 'work' }>
  highlighted: boolean
  selected?: boolean
  alertBadge?: { color: string; label: string } | null
  onOpenDrawer?: (work: WorkInSchema, colIdx: number) => void
  onRicarica?: (workId: number) => void
  onDelete?: (colIdx: number, workIdx: number) => void
}
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
      selected={data.selected}
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
        {data.alertBadge && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            background: data.alertBadge.color, color: '#fff',
            whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700, alignSelf: 'flex-start',
          }}>{data.alertBadge.label}</span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {w.dbId != null && data.onOpenDrawer && (
              <button onClick={(e) => { e.stopPropagation(); data.onOpenDrawer!(w, meta.colIdx) }}
                style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${col.border}`, background: col.chip, color: col.text, cursor: 'pointer' }}>
                Dettaglio
              </button>
            )}
            {w.dbId != null && data.onRicarica && (
              <button onClick={(e) => { e.stopPropagation(); data.onRicarica!(w.dbId!) }}
                style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${col.border}`, background: col.chip, color: col.text, cursor: 'pointer' }}>
                Ricarica
              </button>
            )}
            {data.onDelete && (
              <button onClick={(e) => { e.stopPropagation(); data.onDelete!(meta.colIdx, meta.rowIdx) }}
                style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${C.con.border}`, background: C.con.bg, color: C.con.text, cursor: 'pointer' }}>
                ×
              </button>
            )}
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node: Gruppo CRM con analiti in comune (modificato per essere draggabile)
// ─────────────────────────────────────────────────────────────────────────────
type CrmGroupNodeData = { analitiCondivisi: string[] }
function CrmGroupNode({ data }: NodeProps<Node<CrmGroupNodeData>>) {
  const MAX_LABEL = 4
  const visible = data.analitiCondivisi.slice(0, MAX_LABEL)
  const resto = data.analitiCondivisi.length - MAX_LABEL
  return (
    <div style={{
      width: '100%', height: '100%',
      border: `1.5px dashed ${C.page.brd2}`, borderRadius: 10,
      background: 'rgba(245,245,243,0.55)', boxSizing: 'border-box',
      cursor: 'grab',               // ← indica che l'area è trascinabile
    }}>
      <div style={{
        padding: '5px 10px', fontSize: 9, color: C.page.t2, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        display: 'flex', flexWrap: 'wrap', gap: 3,
        pointerEvents: 'none',       // i badge non devono interferire con il drag del gruppo
      }}>
        {visible.map(n => (
          <span key={n} style={{ background: C.page.bg, border: `1px solid ${C.page.brd}`, borderRadius: 2, padding: '0 4px' }}>{n}</span>
        ))}
        {resto > 0 && <span style={{ color: C.page.th }}>+{resto}</span>}
      </div>
    </div>
  )
}

// Calcola il badge alert peggiore per una Work (CRM scaduto, dismisso o prep NEAT scaduta)
function workAlertBadge(work: WorkInSchema, crmById: Map<number, CrmItem>): { color: string; label: string } | null {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let worst: { color: string; label: string } | null = null
  const upgrade = (b: { color: string; label: string } | null) => {
    if (!b) return
    if (!worst || (worst.color !== '#dc2626' && b.color === '#dc2626')) worst = b
  }
  for (const src of work.srcs) {
    if (src.tipo === 'prep' && src.scadenza) {
      const b = scadenzaBadge(src.scadenza)
      if (b && b.color !== C.page.th) upgrade({ color: b.color, label: b.color === '#dc2626' ? 'NEAT SCAD' : 'NEAT~' })
    } else if (src.tipo === 'mix' || src.tipo === 'sng') {
      const crm = crmById.get(Number(src.id))
      if (crm) {
        const b = scadenzaBadge(crm.scadenza_prodotto)
        if (b && b.color !== C.page.th) upgrade({ color: b.color, label: b.color === '#dc2626' ? 'CRM SCAD' : 'CRM~' })
      }
    }
  }
  return worst
}

// nodeTypes definito fuori dal componente per evitare ri-render spuri di RF
const nodeTypes = {
  mix: ModuloMixNode,
  sng: ModuloSngNode,
  work: ModuloWorkNode,
  analiti: AnalitiNode,
  group: CrmGroupNode,
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

  const crmById = useMemo(() => new Map(crmItems.map(c => [c.id, c])), [crmItems])

  const moduli = useMemo(
    () => deriveModuli(analiti, crmItems, removedMix, mixLottoSel, workCols),
    [analiti, crmItems, removedMix, mixLottoSel, workCols],
  )

  const clusters = useMemo(() => computeClusters(moduli, analiti), [moduli, analiti])

  const nodeToCluster = useMemo(() => {
    const map = new Map<string, string>()
    let idx = 0
    for (const [, cluster] of clusters) {
      const groupId = `GROUP-${idx++}`
      for (const id of cluster.nodeIds) map.set(id, groupId)
    }
    return map
  }, [clusters])

  const moduliEdges = useMemo(() => computeEdges(moduli), [moduli])
  const analitiEdgesBase = useMemo(() => computeAnalitiEdges(analiti, moduli), [analiti, moduli])

  const { positions, setPosition, resetLayout } = useLavagnaPositions(metodoId, moduli, moduliEdges, clusters)

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

  // highlightedIds: hover analita OR connessioni (escluso il nodo selezionato stesso)
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
      // Evidenzia solo i nodi connessi, non il selezionato stesso (che avrà selected=true)
      return new Set<string>(connectedToSelected)
    }
    return new Set<string>()
  }, [hoveredAnalita, selectedId, connectedToSelected, analiti, removedMix])

  // Merge: evidenzia anche i CRM/Work selezionati in selSrcs E il nodo cliccato (per ombra)
  const highlightedIdsWithSel = useMemo(() => {
    const out = new Set(highlightedIds)
    for (const m of moduli) {
      if (m.kind === 'mix' && selSrcs.has(m.mixId)) out.add(m.id)
      if (m.kind === 'sng' && selSrcs.has(m.id)) out.add(m.id)
      if (m.kind === 'work' && selSrcs.has(m.id)) out.add(m.id)
    }
    // Aggiungi il nodo cliccato (selectedId) in modo che riceva l'ombra (highlighted)
    if (selectedId) out.add(selectedId)
    return out
  }, [highlightedIds, selSrcs, moduli, selectedId])

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

  // Nodi strutturali: posizioni + meta. NON include highlighted/selected per evitare
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

    // GroupNode per cluster di CRM con analiti in comune
    const groupNodes: Node[] = []
    let clusterIdx = 0
    for (const [, cluster] of clusters) {
      const groupId = `GROUP-${clusterIdx++}`
      const dims = groupDimensions(cluster.nodeIds, moduli, positions)
      groupNodes.push({
        id: groupId,
        type: 'group',
        position: { x: dims.x, y: dims.y },
        style: { width: dims.width, height: dims.height },
        draggable: true,          // ← abilita il trascinamento del gruppo
        selectable: false,
        data: { analitiCondivisi: cluster.analitiCondivisi } as CrmGroupNodeData,
        zIndex: -1,
      })
    }

    const moduliNodes = moduli.map(m => {
      const p = positions[m.id] || { x: 0, y: 0 }
      const clusterId = nodeToCluster.get(m.id)
      let nodePos = p
      if (clusterId) {
        const gn = groupNodes.find(g => g.id === clusterId)
        if (gn) nodePos = { x: p.x - gn.position.x, y: p.y - gn.position.y }
      }
      const base = {
        id: m.id, position: nodePos, draggable: true, selectable: true,
        ...(clusterId ? { parentId: clusterId, extent: 'parent' as const } : {}),
      }
      if (m.kind === 'mix') {
        return { ...base, type: 'mix', data: { meta: m, highlighted: false, selected: false, onRemoveMix } as MixNodeData }
      }
      if (m.kind === 'sng') {
        return { ...base, type: 'sng', data: { meta: m, highlighted: false, selected: false, onRemoveSng } as SngNodeData }
      }
      return { ...base, type: 'work', data: { meta: m, highlighted: false, selected: false, alertBadge: workAlertBadge(m.work, crmById), onOpenDrawer: onOpenWorkDrawer, onRicarica: onRicaricaWork, onDelete: onDeleteWork } as WorkNodeData }
    })
    return [...groupNodes, analitiNode, ...moduliNodes]
  }, [moduli, positions, analitiPos, analitiNodeData, clusters, nodeToCluster, crmById, onRemoveMix, onRemoveSng, onOpenWorkDrawer, onRicaricaWork, onDeleteWork])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(structuralNodes)

  // Sincronizza struttura (posizioni, lista moduli) senza toccare highlighted/selected
  const isDraggingRef = useRef(false)
  useEffect(() => {
    if (isDraggingRef.current) return
    setRfNodes(prev => {
      // Aggiorna solo id/position/data strutturale — preserva highlighted/selected dal prev
      const prevMap = new Map(prev.map(n => [n.id, n]))
      return structuralNodes.map(n => {
        const old = prevMap.get(n.id)
        if (!old) return n
        // Preserva highlighted e selected dal prev per non cancellare lo stato corrente
        const oldHighlighted = (old.data as { highlighted?: boolean }).highlighted ?? false
        const oldSelected = (old.data as { selected?: boolean }).selected ?? false
        return {
          ...n,
          position: old.position, // usa posizione RF (potrebbe essere diversa da structuralNodes dopo drag)
          data: { ...n.data, highlighted: oldHighlighted, selected: oldSelected },
        }
      })
    })
  }, [structuralNodes, setRfNodes])

  // Aggiorna solo i flag highlighted — chirurgico, non tocca posizioni
  useEffect(() => {
    if (isDraggingRef.current) return
    setRfNodes(prev => prev.map(n => {
      const shouldHighlight = highlightedIdsWithSel.has(n.id)
      const currentHighlight = (n.data as { highlighted?: boolean }).highlighted ?? false
      if (shouldHighlight === currentHighlight) return n
      return { ...n, data: { ...n.data, highlighted: shouldHighlight } }
    }))
  }, [highlightedIdsWithSel, setRfNodes])

  // Aggiorna il flag selected in base a selSrcs (selezione persistente per costruire Work)
  useEffect(() => {
    if (isDraggingRef.current) return
    setRfNodes(prev => prev.map(node => {
      let shouldBeSelected = false
      // Mix
      if (node.type === 'mix') {
        const mixId = (node.data as MixNodeData)?.meta?.mixId
        if (mixId && selSrcs.has(mixId)) shouldBeSelected = true
      }
      // Singolo
      else if (node.type === 'sng') {
        const sngId = (node.data as SngNodeData)?.meta?.id
        if (sngId && selSrcs.has(sngId)) shouldBeSelected = true
      }
      // Work
      else if (node.type === 'work') {
        const workId = (node.data as WorkNodeData)?.meta?.id
        if (workId && selSrcs.has(workId)) shouldBeSelected = true
      }
      const currentSelected = (node.data as any).selected ?? false
      if (shouldBeSelected === currentSelected) return node
      return { ...node, data: { ...node.data, selected: shouldBeSelected } }
    }))
  }, [selSrcs, setRfNodes])

  // Persisti posizione a fine drag (converti relativa→assoluta per nodi in gruppo)
  // Gestisce anche il trascinamento dei gruppi, aggiornando le posizioni assolute delle card figlie.
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    let dragging = false

    for (const ch of changes) {
      if (ch.type === 'position') {
        if (ch.dragging) {
          dragging = true
        } else if (ch.position) {
          const node = rfNodes.find(n => n.id === ch.id)
          if (!node) continue

          if (node.type === 'group') {
            // Spostamento di un gruppo → aggiorna posizioni assolute di tutte le card figlie
            const groupId = ch.id
            const newGroupPos = ch.position
            const oldGroupNode = rfNodes.find(n => n.id === groupId)
            if (!oldGroupNode) continue

            const dx = newGroupPos.x - oldGroupNode.position.x
            const dy = newGroupPos.y - oldGroupNode.position.y

            const childNodes = rfNodes.filter(n => n.parentId === groupId)
            for (const child of childNodes) {
              const oldChildAbs = {
                x: oldGroupNode.position.x + child.position.x,
                y: oldGroupNode.position.y + child.position.y,
              }
              setPosition(child.id, oldChildAbs.x + dx, oldChildAbs.y + dy)
            }
          } else {
            // Card normale (mix, sng, work, analiti)
            const clusterId = nodeToCluster.get(ch.id)
            const groupNode = clusterId ? rfNodes.find(n => n.id === clusterId) : undefined
            const absX = groupNode ? ch.position.x + groupNode.position.x : ch.position.x
            const absY = groupNode ? ch.position.y + groupNode.position.y : ch.position.y
            setPosition(ch.id, absX, absY)
          }
        }
      }
    }
    isDraggingRef.current = dragging
  }, [onNodesChange, setPosition, nodeToCluster, rfNodes])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const id = node.id
    setHoveredAnalita(null)
    // Se clicchi lo stesso nodo, deseleziona; altrimenti seleziona il nuovo
    setSelectedId(prev => prev === id ? null : id)

    const m = moduli.find(x => x.id === id)
    if (!m) return

    if (m.kind === 'mix' && onToggleMix) {
      onToggleMix(m.mixId)
    } else if (m.kind === 'sng' && onToggleSng) {
      onToggleSng(m.id)
    } else if (m.kind === 'work' && onToggleWork) {
      onToggleWork(m.work, m.colIdx)
    }
  }, [moduli, onToggleMix, onToggleSng, onToggleWork])

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