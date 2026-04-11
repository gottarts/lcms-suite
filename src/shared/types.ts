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
  classe_metodo: string | null
  nome_esteso: string | null
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
  unita_conc: string
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
  /** @deprecated — non visualizzare in UI; mantenuto per retrocompatibilità DB */
  matrice: string | null
  peso_molecolare: number | null
  ubicazione: string | null
  arpa: string
  mix: string | null
  mix_id: string | null
  stoccaggio: string | null
  accreditamento_crm: string | null
  volume_ml: number | null  // NEW: volume soluzione in mL (solo per Solution)
  created_at: string
  updated_at: string
  // Joined/computed fields
  metodi_ids?: string[]
  stato?: CompostoStato
  prep_attive_count?: number
  prep_scadute_count?: number
  fiale_aperte_count?: number
  ultima_rivalidazione?: string | null
}

// Tutti i valori possibili restituiti da computeStato()
export type CompostoStato =
  | 'attivo'
  | 'in_scadenza'
  | 'scaduto'
  | 'dismesso'
  | 'da_aprire'
  | 'rivalidato_attivo'
  | 'rivalidato_in_scadenza'
  | 'rivalidato_scaduto'

export interface CompostoStoria {
  id: number
  composto_id: number
  tipo: 'Rivalidazione' | 'Dismissione' | 'apertura_fiala'
  data: string
  note: string | null
  n_registro_qc: string | null
  batch_analitico: string | null
  lotto_crm_valido: string | null
  fiala_numero: number | null
  nuova_scadenza: string | null
  created_at: string
}

export interface Preparazione {
  id: number
  composto_id: number
  forma: string | null
  stato: string | null
  flacone: string | null
  concentrazione: string | null
  unita_conc: string
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

// ── Work ──
export type StatoLab = 'attiva' | 'in_scadenza' | 'scaduta' | 'non_preparata'

export interface WorkPreparazione {
  id: number
  work_id: number
  data_prep: string   // YYYY-MM-DD
  note: string | null
  operatore: string | null
  created_at: string
}

export interface Work {
  id: number
  nome: string
  concentrazione: number | null
  conc_variabile: number        // 0 = omogenea, 1 = variabile
  unita_conc: string
  volume_ml: number | null
  solvente: string | null
  validita_mesi: number | null  // NULL = "al momento" (non tracciata)
  operatore: string | null
  note: string | null
  livello: number               // 0 = Work, 1+ = Intermedia
  created_at: string
  // Archivio
  archiviato?: number
  archiviato_at?: string | null
  archiviato_motivo?: string | null
  sostituito_da_id?: number | null
  // Joined/computed
  n_ingredienti?: number
  n_metodi?: number
  ingredienti?: WorkIngrediente[]
  metodi_ids?: string[]
  ultima_preparazione?: WorkPreparazione | null
  stato_lab?: StatoLab | null
  bloccata?: boolean            // true se almeno 1 CRM ingrediente è dismesso
  motivo_blocco?: 'dismesso' | null
  ha_crm_scaduti?: boolean      // true se almeno 1 CRM non dismesso ha scadenza passata e nessuna rivalidazione valida
  ha_prep_scadute?: boolean     // true se almeno 1 prep NEAT usata ha scadenza passata
  n_ingredienti_bloccati?: number
}

export interface WorkIngrediente {
  id: number
  work_id: number
  source_type: 'crm' | 'work'
  source_id: number
  volume_prelievo_ml: number | null
  fattore_diluizione: number | null
  conc_target_mgL: number | null
  modo_calcolo: 'conc' | 'dil' | null
  lotto_usato: string | null          // snapshot lotto alla creazione
  // Joined
  source_nome?: string
  source_lotto?: string | null        // lotto attuale da composti
  source_dismissione?: string | null  // data_dismissione attuale da composti
}

export interface WorkIngredienteLotStatus {
  id: number
  source_id: number
  nome: string
  lotto_usato: string | null
  lotto_corrente: string | null
  data_dismissione: string | null
  stato: 'ok' | 'auto' | 'ambiguo' | 'mancante'
  sostituti: Array<{
    id: number
    lotto: string | null
    concentrazione: number | null
    unita_conc: string
  }>
}


declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}