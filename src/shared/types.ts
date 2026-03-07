// ── Strumenti ──
export interface Strumento {
  id: string
  codice: string
  tipo: string | null
  seriale: string | null
  status: 'on' | 'idle' | 'off'
  created_at: string
  updated_at: string
}

// ── Metodi ──
export interface Metodo {
  id: string
  nome: string
  strumento_id: string | null
  matrice: string | null
  colonna: string | null
  fase_a: string | null
  fase_b: string | null
  gradiente: string | null
  flusso: string | null
  ionizzazione: string | null
  polarita: string | null
  acquisizione: string | null
  srm: string | null
  lims_id: string | null
  oqlab_id: string | null
  note: string | null
  created_at: string
  updated_at: string
  // Joined fields (not in DB)
  strumento_codice?: string
}

// ── Composti ──
export interface Composto {
  id: number
  nome: string
  codice_interno: string | null
  formula: string | null
  classe: string | null
  forma: string | null
  forma_commerciale: string | null
  purezza: number | null
  concentrazione: number | null
  solvente: string | null
  fiala: string | null
  produttore: string | null
  lotto: string | null
  operatore_apertura: string | null
  data_apertura: string | null
  scadenza_prodotto: string | null
  data_dismissione: string | null
  destinazione_uso: string | null
  work_standard: string | null
  matrice: string | null
  peso_molecolare: number | null
  ubicazione: string | null
  arpa: string
  mix: string | null
  mix_id: string | null
  stoccaggio: string | null
  accreditamento_crm: string | null
  created_at: string
  updated_at: string
  // Joined/computed fields
  metodi_ids?: string[]
  stato?: CompostoStato
}

export type CompostoStato = 'attivo' | 'in_scadenza' | 'scaduto' | 'rivalidato' | 'dismesso'

export interface CompostoStoria {
  id: number
  composto_id: number
  tipo: 'Rivalidazione' | 'Dismissione'
  data: string
  note: string | null
  n_registro_qc: string | null
  batch_analitico: string | null
  lotto_crm_valido: string | null
  created_at: string
}

export interface Preparazione {
  id: number
  composto_id: number
  forma: string | null
  stato: string | null
  flacone: string | null
  concentrazione: string | null
  solvente: string | null
  data_prep: string | null
  scadenza: string | null
  operatore: string | null
  posizione: string | null
  note: string | null
  data_dismissione: string | null
  massa_pesata: number | null
  purezza_usata: number | null
  densita_solvente: number | null
  modalita_aggiunta: 'volume' | 'pesata' | null
  concentrazione_reale: number | null
  concentrazione_target: number | null
  created_at: string
}

// ── Eluenti ──
export interface Eluente {
  id: string
  strumento_id: string
  nome: string
  data_inizio: string
  data_fine: string | null
  created_at: string
  componenti?: EluenteComponente[]
}

export interface EluenteComponente {
  id: number
  eluente_id: string
  sostanza: string | null
  lotto: string | null
  fornitore: string | null
}

// ── Consumabili ──
export type ConsumabileTipo = 'colonna_hplc' | 'spe' | 'solvente' | 'sale' | 'altro'

export interface Consumabile {
  id: number
  tipo: ConsumabileTipo
  nome: string
  lotto: string | null
  fornitore: string | null
  data_apertura: string | null
  data_chiusura: string | null
  note: string | null
  created_at: string
  updated_at: string
  // Joined
  metodi_ids?: string[]
}

// ── Diario ──
export interface DiarioEntry {
  id: number
  strumento_id: string
  metodo_id: string | null
  data: string
  autore: string | null
  testo: string
  created_at: string
  // Joined
  metodo_codice?: string
}

// ── Anagrafiche ──
export interface Anagrafica {
  id: number
  nome: string
  voci?: AnagraficaVoce[]
}

export interface AnagraficaVoce {
  id: number
  anagrafica_id: number
  valore: string
}

// ── Query / Traceability ──
export interface SnapshotRequest {
  strumento_id: string
  metodo_id?: string
  data: string
}

export interface SnapshotResult {
  eluenti: (Eluente & { componenti: EluenteComponente[] })[]
  consumabili: Consumabile[]
  composti: (Composto & { preparazione_attiva?: Preparazione })[]
}

// ── IPC API shape ──
export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  getConfig: () => Promise<{ dbPath: string | null; dbExists: boolean }>
  selectFolder: () => Promise<{ ok: boolean; dbPath?: string; isNew?: boolean }>
  selectJson: () => Promise<{ ok: boolean; path?: string }>
  importLegacyJson: (jsonPath: string) => Promise<{ ok: boolean; error?: string; counts?: Record<string, number> }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
