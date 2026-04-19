import type { CrmItem, WorkInSchema } from '../../metodi/SchemaCalibrazione.types'
import { getCompsFromWork, ricostruisciWorkInSchema } from '../../metodi/SchemaCalibrazione.logic'
import { calcolaStatoLabAllaData } from './scadenzeModel'
import type { StatoLab } from '../../../../shared/types'
import { computeCompostiFromWorkTree, type ExpandedWorkLike } from '../../../lib/workCalc'

// ─────────────────────────────────────────────────────────────────────────────
// Audit CRM — render model
// ─────────────────────────────────────────────────────────────────────────────

export type AuditCrmInput = {
  metodo_id: string
  metodo_nome: string | null
  data: string
  analiti_accreditati: Array<{ id: number; nome: string; alias_strumento: string | null; ordine: number | null }>
  works_registrati: any[]
  crm_validi: any[]
}

export type CrmUsato = {
  composto_id: number
  composto_nome: string
  lotto: string | null
  scadenza_effettiva: string | null  // ultima_rivalidazione ?? scadenza_prodotto
  // Presenti solo se il CRM è usato via preparazione Neat (source_type='prep')
  prep_flacone?: string | null
  prep_progressivo?: number | null
  prep_data_prep?: string | null
  prep_scadenza?: string | null
  prep_scaduta?: boolean             // prep_scadenza < data audit
}

export type AuditAnalitaCoperto = {
  analita_id: number
  analita_nome: string
  alias_strumento: string | null
  crm_ingredienti: CrmUsato[]  // CRM sottostanti che contengono questo analita
}

export type AuditWorkChildRow = {
  work_id: number
  work_nome: string
  work_scadenza: string | null
  stato_work: StatoLab | null
  problemi: ExpandedWorkLike['problemi'] | null
}

export type AuditWorkRow = {
  kind: 'work'
  work_id: number
  work_nome: string
  work_codice: string | null
  work_scadenza: string | null
  stato_work: StatoLab | null
  bloccata: boolean
  ha_crm_scaduti: boolean
  ha_prep_scadute_at_data: boolean
  ha_prep_scadute_solo_non_accreditati: boolean
  archiviate_alla_data: boolean
  analiti_coperti: AuditAnalitaCoperto[]
  children_works: AuditWorkChildRow[]
}

export type AuditScopertoRow = {
  kind: 'scoperto'
  analita_id: number
  analita_nome: string
  alias_strumento: string | null
  crm_disponibili: CrmUsato[]
}

export type AuditRow = AuditWorkRow | AuditScopertoRow

export type AuditModel = {
  metodo_id: string
  metodo_nome: string | null
  data: string
  righe_work: AuditWorkRow[]
  righe_scoperte: AuditScopertoRow[]
  /** ID composti unici coinvolti (per fetch dati completi da composti:export-data) */
  crm_coinvolti_ids: number[]
  stats: {
    n_accreditati: number
    n_coperti: number         // analiti coperti da almeno un Work
    n_scoperti: number        // analiti NON coperti da nessun Work
    n_works: number
    n_work_in_scadenza: number
    n_work_scadute: number
    n_work_bloccate: number
    n_crm: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversione composti grezzi (dal IPC) → CrmItem richiesto da SchemaCalibrazione
// ─────────────────────────────────────────────────────────────────────────────
function toCrmItem(raw: any): CrmItem {
  const cv = typeof raw.concentrazione === 'number'
    ? raw.concentrazione
    : Number.parseFloat(String(raw.concentrazione ?? '0')) || 0
  return {
    id: raw.id,
    nome: raw.nome ?? '',
    mix_id: raw.mix_id ?? null,
    mix: raw.mix ?? null,
    concentrazione: raw.concentrazione ?? null,
    unita_conc: raw.unita_conc ?? 'mg/L',
    forma: raw.forma ?? null,
    lotto: raw.lotto ?? null,
    produttore: raw.produttore ?? null,
    scadenza_prodotto: raw.scadenza_prodotto ?? null,
    ultima_rivalidazione: raw.ultima_rivalidazione ?? null,
    cv,
    concVariabile: false,
    isIS: false,
    destinazione_uso: raw.destinazione_uso ?? null,
  }
}

// Wrappa un work IPC nella forma che ricostruisciWorkInSchema si aspetta
// (si aspetta `ingredienti` array; il resto dei campi non è critico).
function toDbWorkShape(w: any) {
  return {
    id: w.id,
    nome: w.nome,
    conc: w.conc,
    conc_variabile: w.conc_variabile,
    unita_conc: w.unita_conc,
    volume_ml: w.volume_ml,
    validita_mesi: w.validita_mesi,
    solvente: w.solvente,
    livello: w.livello,
    ingredienti: w.ingredienti ?? [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildAuditModel
// Data = data di audit selezionata dall'utente (stringa ISO 'YYYY-MM-DD')
// ─────────────────────────────────────────────────────────────────────────────
export function buildAuditModel(input: AuditCrmInput): AuditModel {
  const dataRif = new Date(input.data + 'T00:00:00')

  const crmItems: CrmItem[] = (input.crm_validi ?? []).map(toCrmItem)

  // Index CRM per nome (lowercase) per il mapping analita → CRM sottostanti
  const crmByNome = new Map<string, CrmItem[]>()
  for (const c of crmItems) {
    const key = c.nome.toLowerCase()
    const arr = crmByNome.get(key) ?? []
    arr.push(c)
    crmByNome.set(key, arr)
  }

  // Crea una mappa analita accreditato → item
  const analitiByNome = new Map<string, { id: number; nome: string; alias_strumento: string | null }>()
  for (const a of input.analiti_accreditati ?? []) {
    analitiByNome.set(a.nome.toLowerCase(), {
      id: a.id, nome: a.nome, alias_strumento: a.alias_strumento,
    })
  }

  // Per ogni Work, ricostruisci WorkInSchema e calcola analiti coperti
  const righe_work: AuditWorkRow[] = []
  const analitiCopertiSet = new Set<string>()  // nome lowercase

  for (const wRaw of input.works_registrati ?? []) {
    // ricostruisciWorkInSchema lavora su un "schema corrente": passiamo
    // workCols/workColsFlat vuoti (non ci sono work intermedie nel nostro
    // contesto audit; se un ingrediente è di tipo 'work' finirà in extraSrcs
    // e non verrà espanso — accettabile al primo giro).
    const workInSchema = ricostruisciWorkInSchema(
      toDbWorkShape(wRaw),
      crmItems,
      [],
      [[]],
    )

    let comps: Array<{ nome: string; concInWork: number; unita: string; srcPath: string }> = []
    const hasWorkSources = (wRaw.ingredienti ?? []).some((i: any) => i.source_type === 'work')

    if (wRaw.work_tree && hasWorkSources) {
      // Usa il tree ricorsivo per espandere anche le Work intermedie
      comps = computeCompostiFromWorkTree(wRaw.work_tree as ExpandedWorkLike)
    } else if (workInSchema) {
      comps = getCompsFromWork(workInSchema, [[]], crmItems)
    } else {
      // Fallback: se la ricostruzione fallisce, derivo gli analiti dai nomi
      // diretti degli ingredienti CRM singoli. Per i mix non avremo i componenti.
      for (const ing of wRaw.ingredienti ?? []) {
        if (ing.source_type === 'crm' && !ing.source_mix_id && ing.source_nome) {
          comps.push({
            nome: ing.source_nome,
            concInWork: 0,
            unita: ing.source_unita_conc ?? 'mg/L',
            srcPath: `${ing.source_nome} (CRM)`,
          })
        }
      }
    }

    // Costruisce l'insieme di CRM fisici usati da questa work:
    // - CRM singoli: gli ingredienti source_type='crm' senza mix_id → identificati da source_id
    // - Mix: per ogni ingrediente-mix, i componenti in crm_validi con quel mix_id
    const crmUsatiInWork = new Map<string, CrmItem>()  // keyed by id
    // Info preparazione Neat associata a un composto (per source_type='prep')
    // Keyed by composto_id; in caso di più prep dello stesso composto teniamo la più problematica
    type PrepInfo = { flacone: string | null; progressivo: number | null; data_prep: string | null; scadenza: string | null; scaduta: boolean }
    const prepInfoByCompostoId = new Map<number, PrepInfo>()

    for (const ing of wRaw.ingredienti ?? []) {
      if (ing.source_type === 'crm') {
        if (!ing.source_mix_id) {
          // CRM singolo: cerca in crmItems per source_id
          const found = crmItems.find(c => c.id === ing.source_id)
          if (found) crmUsatiInWork.set(String(found.id), found)
        } else {
          // Mix: aggiungi tutti i componenti del mix da crmItems
          for (const c of crmItems) {
            if (c.mix_id === ing.source_mix_id) crmUsatiInWork.set(String(c.id), c)
          }
        }
      } else if (ing.source_type === 'prep') {
        // CRM Neat: risali al composto padre tramite source_composto_id
        const found = crmItems.find(c => c.id === ing.source_composto_id)
        if (found) {
          crmUsatiInWork.set(String(found.id), found)
          // Memorizza info prep (la scaduta ha precedenza)
          const scaduta = !!(ing.source_prep_scadenza && ing.source_prep_scadenza < input.data)
          const existing = prepInfoByCompostoId.get(found.id)
          if (!existing || (scaduta && !existing.scaduta)) {
            prepInfoByCompostoId.set(found.id, {
              flacone: ing.source_prep_flacone ?? null,
              progressivo: ing.source_prep_progressivo ?? null,
              data_prep: ing.source_prep_data_prep ?? null,
              scadenza: ing.source_prep_scadenza ?? null,
              scaduta,
            })
          }
        }
      }
    }
    // Aggiungi anche le foglie CRM/prep dalle Work intermedie (tracciabilità ricorsiva)
    if (wRaw.work_tree) {
      const addLeavesFromTree = (tree: ExpandedWorkLike) => {
        for (const leaf of tree.leaves) {
          if (leaf.source_type === 'crm') {
            const found = crmItems.find(c => c.id === leaf.source_id)
            if (found && !leaf.mix_id) crmUsatiInWork.set(String(found.id), found)
            if (found && leaf.mix_id) {
              for (const c of crmItems) {
                if (c.mix_id === leaf.mix_id) crmUsatiInWork.set(String(c.id), c)
              }
            }
          } else if (leaf.source_type === 'prep') {
            const found = crmItems.find(c => c.id === leaf.source_id)
            if (found) crmUsatiInWork.set(String(found.id), found)
          }
        }
        for (const child of tree.children_works) {
          addLeavesFromTree(child)
        }
      }
      addLeavesFromTree(wRaw.work_tree as ExpandedWorkLike)
    }

    // Index per nome dei CRM realmente usati dalla work
    const crmUsatiByNome = new Map<string, CrmItem[]>()
    for (const c of crmUsatiInWork.values()) {
      const k = c.nome.toLowerCase()
      const arr = crmUsatiByNome.get(k) ?? []
      arr.push(c)
      crmUsatiByNome.set(k, arr)
    }

    // Interseca con analiti accreditati
    const coperti: AuditAnalitaCoperto[] = []
    for (const comp of comps) {
      const key = comp.nome.toLowerCase()
      const accr = analitiByNome.get(key)
      if (!accr) continue
      analitiCopertiSet.add(key)

      // Trova i CRM sottostanti che contengono questo analita (solo quelli della work)
      const crmSottostanti = (crmUsatiByNome.get(key) ?? []).map(c => {
        const prepInfo = prepInfoByCompostoId.get(c.id)
        return {
          composto_id: c.id,
          composto_nome: c.nome,
          lotto: c.lotto,
          scadenza_effettiva: c.ultima_rivalidazione ?? c.scadenza_prodotto ?? null,
          ...(prepInfo ? {
            prep_flacone: prepInfo.flacone,
            prep_progressivo: prepInfo.progressivo,
            prep_data_prep: prepInfo.data_prep,
            prep_scadenza: prepInfo.scadenza,
            prep_scaduta: prepInfo.scaduta,
          } : {}),
        }
      })

      coperti.push({
        analita_id: accr.id,
        analita_nome: accr.nome,
        alias_strumento: accr.alias_strumento,
        crm_ingredienti: crmSottostanti,
      })
    }

    // Ordina coperti per nome analita
    coperti.sort((a, b) => a.analita_nome.localeCompare(b.analita_nome))

    const stato_work = calcolaStatoLabAllaData(
      wRaw.ultima_prep_data ?? null,
      wRaw.validita_mesi ?? null,
      dataRif,
    )

    let work_scadenza: string | null = null
    if (wRaw.ultima_prep_data && wRaw.validita_mesi) {
      const ms = new Date(wRaw.ultima_prep_data).getTime() + wRaw.validita_mesi * 30.44 * 24 * 60 * 60 * 1000
      work_scadenza = new Date(ms).toISOString().slice(0, 10)
    }

    // Costruisce children_works dalla lista di work figlie nel tree
    const children_works: AuditWorkChildRow[] = []
    if (wRaw.work_tree) {
      for (const child of (wRaw.work_tree as ExpandedWorkLike).children_works) {
        let child_scadenza: string | null = null
        if (child.ultima_prep_data && child.validita_mesi) {
          const ms = new Date(child.ultima_prep_data).getTime() + child.validita_mesi * 30.44 * 24 * 60 * 60 * 1000
          child_scadenza = new Date(ms).toISOString().slice(0, 10)
        }
        children_works.push({
          work_id: child.work_id,
          work_nome: child.work_nome,
          work_scadenza: child_scadenza,
          stato_work: calcolaStatoLabAllaData(child.ultima_prep_data ?? null, child.validita_mesi ?? null, dataRif),
          problemi: child.problemi,
        })
      }
    }

    righe_work.push({
      kind: 'work',
      work_id: wRaw.id,
      work_nome: wRaw.nome,
      work_codice: wRaw.codice ?? null,
      work_scadenza,
      stato_work,
      bloccata: !!wRaw.bloccata,
      ha_crm_scaduti: !!wRaw.ha_crm_scaduti,
      ha_prep_scadute_at_data: !!wRaw.ha_prep_scadute_at_data,
      ha_prep_scadute_solo_non_accreditati: !!wRaw.ha_prep_scadute_at_data && !coperti.some(a =>
        a.crm_ingredienti.some(c => c.prep_scaduta === true)
      ),
      archiviate_alla_data: !!(wRaw.archiviato_at && wRaw.archiviato_at.slice(0, 10) <= input.data),
      analiti_coperti: coperti,
      children_works,
    })
  }

  // Righe scoperte: analiti accreditati NON in analitiCopertiSet
  const righe_scoperte: AuditScopertoRow[] = []
  for (const a of input.analiti_accreditati ?? []) {
    const key = a.nome.toLowerCase()
    if (analitiCopertiSet.has(key)) continue

    // Fallback: cerca CRM validi con lo stesso nome
    const crm_disponibili: CrmUsato[] = (crmByNome.get(key) ?? [])
      .filter(c => {
        const eff = c.ultima_rivalidazione ?? c.scadenza_prodotto ?? null
        if (!eff) return true  // nessuna scadenza = considerato valido
        return new Date(eff) >= dataRif
      })
      .map(c => ({
        composto_id: c.id,
        composto_nome: c.nome,
        lotto: c.lotto,
        scadenza_effettiva: c.ultima_rivalidazione ?? c.scadenza_prodotto ?? null,
      }))

    righe_scoperte.push({
      kind: 'scoperto',
      analita_id: a.id,
      analita_nome: a.nome,
      alias_strumento: a.alias_strumento,
      crm_disponibili,
    })
  }

  // CRM coinvolti: IDs unici dei composti che compaiono in analiti_coperti di almeno una work
  const crmCoinvoltiIds = new Set<number>()
  for (const w of righe_work) {
    for (const a of w.analiti_coperti) {
      for (const c of a.crm_ingredienti) {
        crmCoinvoltiIds.add(c.composto_id)
      }
    }
  }
  const crm_coinvolti_ids = [...crmCoinvoltiIds]

  // Stats
  const n_accreditati = input.analiti_accreditati?.length ?? 0
  const n_coperti = analitiCopertiSet.size
  const n_scoperti = n_accreditati - n_coperti
  const n_works = righe_work.length
  const n_work_in_scadenza = righe_work.filter(r => r.stato_work === 'in_scadenza').length
  const n_work_scadute = righe_work.filter(r => r.stato_work === 'scaduta').length
  const n_work_bloccate = righe_work.filter(r => r.bloccata).length
  const n_crm = crm_coinvolti_ids.length

  return {
    metodo_id: input.metodo_id,
    metodo_nome: input.metodo_nome,
    data: input.data,
    righe_work,
    righe_scoperte,
    crm_coinvolti_ids,
    stats: {
      n_accreditati, n_coperti, n_scoperti,
      n_works, n_work_in_scadenza, n_work_scadute, n_work_bloccate,
      n_crm,
    },
  }
}

// Helper: suppress unused warning
void (null as unknown as WorkInSchema)
