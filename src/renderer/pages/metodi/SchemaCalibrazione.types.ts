// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.types.ts  —  Parte 1 / 4
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type SorgenteTipo = 'mix' | 'sng' | 'work' | 'prep'

export interface PrepStockItem {
  id: number
  flacone: string | null
  progressivo: number | null
  conc: string | null
  concReale: number | null
  concTarget: number | null
  unitaConc: string
  scadenza: string | null
  dataDismissione: string | null
}

export interface SorgenteSel {
  id: string
  nome: string
  cv: number
  tipo: SorgenteTipo
  colSrc?: number
  concVariabile?: boolean
  prepId?: number
  lotto?: string | null
  flacone?: string | null
  progressivo?: number | null
  scadenza?: string | null      // solo per tipo 'prep' (NEAT)
}

export interface Ingrediente {
  nome: string
  vol: number
  concTarget?: number
  dilFactor?: number
  modo: 'conc' | 'dil'
}

export interface WorkInSchema {
  id: string
  dbId?: number
  nome: string
  conc: number | null
  concVariabile: boolean
  unitaConc: string
  volFin: number
  solv: string
  validitaMesi: number | null
  op: string
  srcs: SorgenteSel[]
  vols: Ingrediente[]
  extraSrcs?: Array<{ id: string; nome: string; tipo: 'mix' | 'sng' }>
}

export type DestUso = 'taratura' | 'qc' | 'is'

export interface CrmItem {
  id: number
  nome: string
  mix_id: string | null
  mix: string | null           // nome commerciale del mix (campo composti.mix)
  concentrazione: number | null
  unita_conc: string
  forma: string | null
  lotto: string | null
  produttore: string | null
  scadenza_prodotto: string | null
  ultima_rivalidazione: string | null
  cv: number
  concVariabile: boolean
  isIS: boolean
  destinazione_uso: string | null
  prepStock?: PrepStockItem[]
}

export interface AnalitoItem {
  nome: string
  mixId: string | null
  mixIds: string[]          // tutti i mix_id disponibili (lotti diversi dello stesso mix)
  sngIds: string[]          // id (String) di tutti i CRM singoli non scaduti per questo analita
  isCon: boolean            // ha sia mix che almeno un singolo
  isIS: boolean
  crmFiltrati?: boolean     // true = ha CRM ma esclusi dal filtro destinazione d'uso corrente
  destUsoCrm?: DestUso[]    // destinazioni d'uso in cui ha CRM (se crmFiltrati=true)
}

export interface ConnectionLine {
  x1: number; y1: number
  x2: number; y2: number
  color: string
  sourceType: SorgenteTipo
}

export type RegisterCardRef = (id: string, el: HTMLDivElement | null) => void

export interface SchemaCalibrazioneProps {
  metodoId: string
  metodoNome: string
  onClose: () => void
}

// Palette colori (usata come oggetto stile inline)
export const C = {
  mix:  { bg: '#eef6ff', border: '#6ba3d6', text: '#2b5f8a', chip: '#d4e8fa' },
  sng:  { bg: '#eef8e8', border: '#7db85a', text: '#3a6b24', chip: '#d2edbe' },
  con:  { bg: '#fef0ec', border: '#d4806a', text: '#8c3e2a' },
  work: { bg: '#fdf6e8', border: '#c49540', text: '#6b4f1a', chip: '#f5e2b8' },
  inter:{ bg: '#f2effe', border: '#9b86d6', text: '#5a3fa0', chip: '#d8cff5' },
  ana:  { bg: '#f5f5f3', border: '#b0afaa' },
  page: { bg: '#ffffff', sur: '#ffffff', brd: '#e5e5e5', brd2: '#d0d0d0',
          t1: '#1e1e1e', t2: '#6b6b6b', th: '#a0a0a0' },
} as const
