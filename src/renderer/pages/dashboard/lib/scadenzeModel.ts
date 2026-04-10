import { computeStato, type CompostoStato } from '@/components/shared/StatusBadge'
import type { StatoLab } from '../../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// Modelli e helper per la timeline scadenze della Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export type ScadenzaItem =
  | {
      kind: 'composto'
      id: number
      nome: string
      lotto: string | null
      scadenza: string      // ISO date (scadenza effettiva = rivalidazione ?? originale)
      giorni: number        // giorni residui rispetto a oggi (negativo = scaduto)
      stato: CompostoStato
    }
  | {
      kind: 'preparazione'
      id: number
      composto_nome: string
      flacone: string | null
      scadenza: string
      giorni: number
    }
  | {
      kind: 'work'
      id: number
      nome: string
      scadenza: string      // data_prep + validita_mesi
      giorni: number
      stato_lab: StatoLab
      bloccata: boolean
      ha_crm_scaduti: boolean
    }

// ─────────────────────────────────────────────────────────────────────────────
// calcolaStatoLabAllaData
// Variante parametrizzata di `calcolaStatoLab` (in work.ipc.ts): rispetto a
// una data arbitraria, non "oggi". Usata per l'Audit CRM a data storica.
// Stessa logica: validita_mesi * 30.44gg, soglia 20% per "in_scadenza".
// ─────────────────────────────────────────────────────────────────────────────
export function calcolaStatoLabAllaData(
  ultimaPrepData: string | null | undefined,
  validita_mesi: number | null | undefined,
  dataRif: Date,
): StatoLab | null {
  if (!validita_mesi) return null
  if (!ultimaPrepData) return 'non_preparata'
  const dataPrepMs = new Date(ultimaPrepData).getTime()
  const rifMs = dataRif.getTime()
  const validitaMs = validita_mesi * 30.44 * 24 * 60 * 60 * 1000
  const scadenzaMs = dataPrepMs + validitaMs
  const sogliaMs = validitaMs * 0.2
  if (rifMs > scadenzaMs) return 'scaduta'
  if (rifMs > scadenzaMs - sogliaMs) return 'in_scadenza'
  return 'attiva'
}

// ─────────────────────────────────────────────────────────────────────────────
// computeStatoAllaData
// Variante di `computeStato` (StatusBadge.tsx) parametrizzata su una data
// arbitraria. Usata nell'Audit CRM. Mantiene la stessa logica:
// dismesso → da_aprire → scadenza → rivalidazione. Soglia 30 giorni.
// ─────────────────────────────────────────────────────────────────────────────
export function computeStatoAllaData(
  c: {
    data_dismissione?: string | null
    data_apertura?: string | null
    scadenza_prodotto?: string | null
    ultima_rivalidazione?: string | null
  },
  dataRif: Date,
): CompostoStato {
  if (c.data_dismissione && new Date(c.data_dismissione) <= dataRif) return 'dismesso'
  if (!c.data_apertura || new Date(c.data_apertura) > dataRif) return 'da_aprire'

  const rif = new Date(dataRif)
  rif.setHours(0, 0, 0, 0)
  const thirty = 30 * 24 * 60 * 60 * 1000

  if (!c.scadenza_prodotto) return 'attivo'

  const scadOrig = new Date(c.scadenza_prodotto)
  scadOrig.setHours(0, 0, 0, 0)

  if (scadOrig >= rif) {
    if (scadOrig.getTime() - rif.getTime() < thirty) return 'in_scadenza'
    return 'attivo'
  }

  if (!c.ultima_rivalidazione) return 'scaduto'
  const scadExt = new Date(c.ultima_rivalidazione)
  scadExt.setHours(0, 0, 0, 0)
  if (scadExt < rif) return 'rivalidato_scaduto'
  if (scadExt.getTime() - rif.getTime() < thirty) return 'rivalidato_in_scadenza'
  return 'rivalidato_attivo'
}

// ─────────────────────────────────────────────────────────────────────────────
// giorniTra: giorni interi tra `data` (ISO) e oggi (a mezzanotte).
// ─────────────────────────────────────────────────────────────────────────────
function giorniTra(isoDate: string): number {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const target = new Date(isoDate)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - oggi.getTime()) / (24 * 60 * 60 * 1000))
}

// scadenzaEffettivaComposto: rivalidazione se esiste, altrimenti originale
function scadenzaEffettivaComposto(c: { scadenza_prodotto?: string | null; ultima_rivalidazione?: string | null }): string | null {
  return c.ultima_rivalidazione ?? c.scadenza_prodotto ?? null
}

// scadenzaWork: data_prep + validita_mesi in ISO
function scadenzaWork(ultimaPrep: string | null, validitaMesi: number | null): string | null {
  if (!ultimaPrep || !validitaMesi) return null
  const ms = new Date(ultimaPrep).getTime() + validitaMesi * 30.44 * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// buildScadenzeItems: trasforma un DashboardSummary nel modello unificato,
// ordinato per giorni residui crescente.
// ─────────────────────────────────────────────────────────────────────────────
export function buildScadenzeItems(summary: {
  composti: any[]
  preparazioni: any[]
  work: any[]
}): ScadenzaItem[] {
  const items: ScadenzaItem[] = []

  for (const c of summary.composti ?? []) {
    const scad = scadenzaEffettivaComposto(c)
    if (!scad) continue
    items.push({
      kind: 'composto',
      id: c.id,
      nome: c.nome,
      lotto: c.lotto ?? null,
      scadenza: scad,
      giorni: giorniTra(scad),
      stato: computeStato(c),
    })
  }

  for (const p of summary.preparazioni ?? []) {
    if (!p.scadenza) continue
    items.push({
      kind: 'preparazione',
      id: p.id,
      composto_nome: p.composto_nome ?? '(?)',
      flacone: p.flacone ?? null,
      scadenza: p.scadenza,
      giorni: giorniTra(p.scadenza),
    })
  }

  for (const w of summary.work ?? []) {
    const scad = scadenzaWork(w.ultima_prep_data ?? null, w.validita_mesi ?? null)
    // Escludiamo le work "non preparate": non hanno ancora una scadenza
    if (!scad) continue
    const stato = calcolaStatoLabAllaData(w.ultima_prep_data, w.validita_mesi, new Date()) ?? 'attiva'
    items.push({
      kind: 'work',
      id: w.id,
      nome: w.nome,
      scadenza: scad,
      giorni: giorniTra(scad),
      stato_lab: stato,
      bloccata: !!w.bloccata,
      ha_crm_scaduti: !!w.ha_crm_scaduti,
    })
  }

  items.sort((a, b) => a.giorni - b.giorni)
  return items
}

// Bucket temporali per la timeline
export type BucketKey = 'scadute' | 'urgenti' | 'prossime' | 'future'

export const BUCKET_LABELS: Record<BucketKey, string> = {
  scadute:  'Scadute',
  urgenti:  'Entro 7 giorni',
  prossime: 'Entro 30 giorni',
  future:   '31–60 giorni',
}

export function bucketOf(giorni: number): BucketKey {
  if (giorni < 0) return 'scadute'
  if (giorni <= 7) return 'urgenti'
  if (giorni <= 30) return 'prossime'
  return 'future'
}
