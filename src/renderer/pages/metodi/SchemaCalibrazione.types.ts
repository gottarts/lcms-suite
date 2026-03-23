// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.types.ts  —  Parte 1 / 4
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type SorgenteTipo = 'mix' | 'sng' | 'work'

export interface SorgenteSel {
  id: string
  nome: string
  cv: number
  tipo: SorgenteTipo
  colSrc?: number
  concVariabile?: boolean
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
}

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
}

export interface AnalitoItem {
  nome: string
  mixId: string | null
  sngIds: string[]          // id (String) di tutti i CRM singoli non scaduti per questo analita
  isCon: boolean            // ha sia mix che almeno un singolo
  isIS: boolean
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
  mix:  { bg: '#deedf9', border: '#185FA5', text: '#0C447C', chip: '#b5d4f4' },
  sng:  { bg: '#e4f2d8', border: '#3B6D11', text: '#27500A', chip: '#c0dd97' },
  con:  { bg: '#faece7', border: '#D85A30', text: '#993C1D' },
  work: { bg: '#fef9ec', border: '#BA7517', text: '#633806', chip: '#FAC775' },
  inter:{ bg: '#f0ecfe', border: '#6B50C8', text: '#3D2A8A', chip: '#c9bef7' },
  ana:  { bg: '#f7f6f2', border: '#888780' },
  page: { bg: '#f2f0eb', sur: '#fff', brd: '#d6d3cc', brd2: '#b8b5ae',
          t1: '#1a1917', t2: '#5c5a56', th: '#9c9a96' },
} as const
