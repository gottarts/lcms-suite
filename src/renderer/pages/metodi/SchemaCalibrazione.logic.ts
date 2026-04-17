// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.logic.ts  —  Parte 2 / 4
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.logic.ts
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import type { CrmItem, AnalitoItem, SorgenteSel, WorkInSchema, ConnectionLine, Ingrediente, DestUso } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'

// ─────────────────────────────────────────────────────────────────────────────
// Funzione pura: costruisce AnalitoItem[] e mappe da un insieme di CrmItem
// già filtrati. Può essere chiamata sia dal hook (tutti i CRM) sia dopo la
// scelta di uno scenario (CRM filtrati per mix_id ammessi).
// ─────────────────────────────────────────────────────────────────────────────
function matchesFiltroDestUso(destinazione_uso: string | null, filtro: DestUso): boolean {
  if (!destinazione_uso) return filtro !== 'is' // null → visibile in Taratura e QC, non in IS
  const d = destinazione_uso.toLowerCase()
  if (filtro === 'taratura') return d.includes('taratura')
  if (filtro === 'qc') return d.includes('controllo')
  if (filtro === 'is') return d.includes('intern') || d.includes(' is')
  return true
}

// Costruisce le mappe mix (privato): mixNomiMap, mixFirma, firmaToMixIds, mixMap, mixIdsByNome
function _buildMixMaps(itemsFiltrati: CrmItem[]): {
  mixNomiMap: Map<string, Set<string>>
  mixFirma: Map<string, string>
  firmaToMixIds: Map<string, string[]>
  mixMap: Map<string, string[]>
  mixIdsByNome: Map<string, string[]>
} {
  // Firma di un mix = nomi componenti ordinati alfabeticamente
  const mixNomiMap = new Map<string, Set<string>>()
  for (const item of itemsFiltrati) {
    if (item.mix_id) {
      const s = mixNomiMap.get(item.mix_id) ?? new Set<string>()
      s.add(item.nome)
      mixNomiMap.set(item.mix_id, s)
    }
  }
  const mixFirma = new Map<string, string>()
  for (const [mid, nomi] of mixNomiMap.entries()) {
    mixFirma.set(mid, Array.from(nomi).sort().join('|'))
  }
  const firmaToMixIds = new Map<string, string[]>()
  for (const [mid, firma] of mixFirma.entries()) {
    const arr = firmaToMixIds.get(firma) ?? []
    arr.push(mid)
    firmaToMixIds.set(firma, arr)
  }

  // nome analita → lista mix_id che lo contengono
  const mixIdsByNome = new Map<string, string[]>()
  for (const item of itemsFiltrati) {
    if (item.mix_id) {
      const key = item.nome.toUpperCase()
      const arr = mixIdsByNome.get(key) ?? []
      if (!arr.includes(item.mix_id)) arr.push(item.mix_id)
      mixIdsByNome.set(key, arr)
    }
  }

  // nome analita (uppercase) → lista mix_id attivi (collassa firme identiche)
  const mixMap = new Map<string, string[]>()
  for (const item of itemsFiltrati) {
    if (!item.mix_id) continue
    const key = item.nome.toUpperCase()
    const tuttiMixIds = mixIdsByNome.get(key)!
    const firme = new Set(tuttiMixIds.map(mid => mixFirma.get(mid)!))
    if (firme.size === 1) {
      if (!mixMap.has(key)) mixMap.set(key, tuttiMixIds)
    } else {
      mixMap.set(key, [item.mix_id])
    }
  }

  return { mixNomiMap, mixFirma, firmaToMixIds, mixMap, mixIdsByNome }
}

// Costruisce le mappe singoli e IS (privato): sngMap, isMap
function _buildSngMaps(itemsFiltrati: CrmItem[]): {
  sngMap: Map<string, string[]>
  isMap: Map<string, boolean>
} {
  const sngMap = new Map<string, string[]>()
  const isMap  = new Map<string, boolean>()
  for (const item of itemsFiltrati) {
    const key = item.nome.toUpperCase()
    if (!item.mix_id) {
      const arr = sngMap.get(key) ?? []
      arr.push(String(item.id))
      sngMap.set(key, arr)
    }
    if (item.isIS) isMap.set(key, true)
  }
  return { sngMap, isMap }
}

export function buildAnalitiData(
  items: CrmItem[],
  analitiRows: { id: number; nome: string }[],
  filtroDestUso?: DestUso,
): {
  analiti: AnalitoItem[]
  firmaToMixIds: Map<string, string[]>
  mixNomiMap: Map<string, Set<string>>
} {
  const itemsFiltrati = filtroDestUso
    ? items.filter(item => matchesFiltroDestUso(item.destinazione_uso, filtroDestUso))
    : items

  const { mixNomiMap, firmaToMixIds, mixMap } = _buildMixMaps(itemsFiltrati)
  const { sngMap, isMap } = _buildSngMaps(itemsFiltrati)

  const analitiCalc: AnalitoItem[] = analitiRows.map(row => ({
    nome:   row.nome,
    mixId:  mixMap.get(row.nome.toUpperCase())?.[0] ?? null,
    mixIds: mixMap.get(row.nome.toUpperCase()) ?? [],
    sngIds: sngMap.get(row.nome.toUpperCase()) ?? [],
    isCon:  mixMap.has(row.nome.toUpperCase()) && sngMap.has(row.nome.toUpperCase()),
    isIS:   isMap.get(row.nome.toUpperCase()) ?? false,
  }))

  // Ordine: singoli senza mix → analiti con mix (raggruppati per mix) → senza CRM
  const soloSng  = analitiCalc.filter(a => !a.mixId && a.sngIds.length > 0)
  const conMix   = analitiCalc.filter(a =>  a.mixId)
  const senzaCrm = analitiCalc.filter(a => !a.mixId && a.sngIds.length === 0)
  const mixOrder: string[] = []
  for (const a of conMix) {
    if (!mixOrder.includes(a.mixId!)) mixOrder.push(a.mixId!)
  }
  const mixGrouped: AnalitoItem[] = []
  for (const mid of mixOrder) {
    const gruppo = conMix.filter(a => a.mixId === mid)
    mixGrouped.push(...gruppo.filter(a => a.sngIds.length > 0), ...gruppo.filter(a => a.sngIds.length === 0))
  }

  return {
    analiti: [...soloSng, ...mixGrouped, ...senzaCrm],
    firmaToMixIds,
    mixNomiMap,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: carica CRM del metodo dal DB (tutti tranne dismessi)
// ─────────────────────────────────────────────────────────────────────────────
export function useSchemaData(metodoId: string) {
  const [crmItems,       setCrmItems]       = useState<CrmItem[]>([])
  const [analiti,        setAnaliti]        = useState<AnalitoItem[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [firmaToMixIds,  setFirmaToMixIds]  = useState<Map<string, string[]>>(new Map())
  const [mixNomiMap,     setMixNomiMap]     = useState<Map<string, Set<string>>>(new Map())
  // Raw data esposti per permettere il ricalcolo filtrato dopo la scelta dello scenario
  const [analitiRows,    setAnalitiRows]    = useState<{ id: number; nome: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Lista analiti persistente (fonte autorevole)
      const analitiRows: { id: number; nome: string }[] = await (window as any).electronAPI.invoke(
        'metodo-analiti:list',
        metodoId
      )

      // 2. CRM disponibili per il metodo (per nome analita, include mix completi)
      const rows: any[] = await (window as any).electronAPI.invoke(
        'composti:list-for-schema',
        metodoId
      )

      // Escludi i dismessi e i CRM singoli scaduti (senza rivalidazione attiva)
      const oggi = new Date().toISOString().slice(0, 10)
      const disponibili = rows.filter((r: any) => {
        if (r.data_dismissione) return false
        // Per i singoli (non mix) escludi se scaduti E senza rivalidazione ancora valida
        if (!r.mix_id && r.scadenza_prodotto && r.scadenza_prodotto < oggi) {
          if (!r.ultima_rivalidazione || r.ultima_rivalidazione < oggi) return false
        }
        return true
      })

      // Mappa → CrmItem
      const items: CrmItem[] = disponibili.map((r: any) => {
        const cv = Number(r.concentrazione) || 0
        // Considera IS se il nome inizia per 'M' o il campo destinazione_uso lo indica
        const raw = String(r.destinazione_uso ?? r.nome ?? '').toLowerCase()
        const isIS = raw.includes('intern') || raw.includes(' is') || /^m[0-9]/.test(r.nome ?? '')
        return {
          id:               r.id,
          nome:             r.nome ?? '',
          mix_id:           r.mix_id ?? null,
          mix:              r.forma_commerciale ?? r.mix ?? null,
          concentrazione:   r.concentrazione ?? null,
          unita_conc:       r.unita_conc ?? 'mg/L',
          forma:            r.forma ?? null,
          lotto:            r.lotto ?? null,
          produttore:       r.produttore ?? null,
          scadenza_prodotto:    r.scadenza_prodotto ?? null,
          ultima_rivalidazione: r.ultima_rivalidazione ?? null,
          cv,
          concVariabile: false, // verrà ricalcolato sotto
          isIS,
          destinazione_uso: r.destinazione_uso ?? null,
        }
      })

      // Rileva mix eterogenei e imposta concVariabile correttamente
      const mixCvSets = new Map<string, Set<number>>()
      for (const item of items) {
        if (item.mix_id) {
          const s = mixCvSets.get(item.mix_id) ?? new Set<number>()
          s.add(item.cv)
          mixCvSets.set(item.mix_id, s)
        }
      }
      const itemsWithConc = items.map(item => ({
        ...item,
        concVariabile: item.mix_id ? (mixCvSets.get(item.mix_id)?.size ?? 0) > 1 : false,
      }))

      // Carica le prep stock per i CRM Neat (singoli con forma Neat)
      for (const item of itemsWithConc) {
        if (item.mix_id === null && String(item.forma ?? '').toLowerCase() === 'neat') {
          const rows: any[] = await (window as any).electronAPI.invoke(
            'preparazioni:list-for-schema', item.id
          )
          item.prepStock = rows.map((r: any) => ({
            id: r.id,
            flacone: r.flacone ?? null,
            progressivo: r.progressivo ?? null,
            conc: r.concentrazione ?? null,
            concReale: r.concentrazione_reale ?? null,
            concTarget: r.concentrazione_target ?? null,
            unitaConc: r.unita_conc ?? 'mg/L',
            scadenza: r.scadenza ?? null,
            dataDismissione: r.data_dismissione ?? null,
          }))
        }
      }

      const itemsFinal = itemsWithConc
      setCrmItems(itemsFinal)

      setAnalitiRows(analitiRows)

      // 3 + 4. Costruisce mappe e AnalitoItem[] — usa tutti i CRM (dati grezzi)
      //        Le mappe firmaToMixIds/mixNomiMap servono al dialog scenari
      const { analiti: analitiCalc, firmaToMixIds, mixNomiMap } =
        buildAnalitiData(itemsFinal, analitiRows)

      // Esponi firmaToMixIds e mixNomiMap per il dialog scenari
      setFirmaToMixIds(firmaToMixIds)
      setMixNomiMap(mixNomiMap)
      setAnaliti(analitiCalc)
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }, [metodoId])

  useEffect(() => { load() }, [load])
  return { crmItems, analiti, loading, error, reload: load, firmaToMixIds, mixNomiMap, analitiRows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcola info concentrazione di una sorgente
// ─────────────────────────────────────────────────────────────────────────────
export function getConcInfo(
  s: SorgenteSel,
  workCols: WorkInSchema[][]
): { omogenea: boolean; cv: number; label: string } {
  if (s.tipo === 'sng' || s.tipo === 'mix' || s.tipo === 'prep') {
    if (s.concVariabile) return { omogenea: false, cv: s.cv, label: 'variabile' }
    if (s.cv > 0) return { omogenea: true, cv: s.cv, label: `${s.cv} mg/L` }
    return { omogenea: false, cv: 0, label: 'variabile' }
  }
  // tipo = 'work'
  let w: WorkInSchema | undefined
  for (const col of workCols) {
    w = col.find(x => x.id === s.id)
    if (w) break
  }
  if (!w)                           return { omogenea: false, cv: 0, label: 'variabile' }
  if (w.concVariabile || !w.conc)   return { omogenea: false, cv: 0, label: 'variabile' }
  return { omogenea: true, cv: w.conc, label: `${w.conc} ${w.unitaConc}` }
}

// ─────────────────────────────────────────────────────────────────────────────
// Costruisce un SorgenteSel di tipo 'mix' da un mix_id e dalla lista CRM
// ─────────────────────────────────────────────────────────────────────────────
export function buildSorgenteMix(mixId: string, crmItems: CrmItem[]): SorgenteSel {
  const comps = crmItems.filter(c => c.mix_id === mixId)
  const crm = comps[0]
  const cvSet = new Set(comps.map(c => c.cv))
  return {
    id: mixId,
    nome: crm?.mix ?? mixId,
    cv: crm?.cv ?? 0,
    tipo: 'mix',
    concVariabile: cvSet.size > 1,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Determina la colonna di destinazione della prossima Work
// ─────────────────────────────────────────────────────────────────────────────
export function targetColIdx(selSrcs: Map<string, SorgenteSel>): number {
  let max = -1
  selSrcs.forEach(s => {
    if (s.tipo === 'work' && s.colSrc !== undefined) max = Math.max(max, s.colSrc)
  })
  return max + 1
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcola i volumi di prelievo per ogni sorgente
// ─────────────────────────────────────────────────────────────────────────────
export function calcolaVols(
  srcs: SorgenteSel[],
  workCols: WorkInSchema[][],
  valori: Map<string, number>,   // id → valore (conc target o fattore dil)
  customMode: boolean,
  valoreUnico: number,
  volFin: number
): { nome: string; vol: number; concTarget?: number; dilFactor?: number; modo: 'conc' | 'dil' }[] {
  if (!volFin || srcs.length === 0) return []
  const hasVar = srcs.some(s => !getConcInfo(s, workCols).omogenea)

  return srcs.map(s => {
    const info  = getConcInfo(s, workCols)
    const isVar = !info.omogenea
    const val   = customMode ? (valori.get(s.id) ?? 0) : valoreUnico
    if (!val) return { nome: s.nome, vol: 0, modo: isVar ? 'dil' : 'conc' as 'conc' | 'dil' }

    // In customMode: usa isVar per-sorgente (non hasVar globale) perché ogni sorgente
    // ha il suo campo con semantica distinta (÷N se variabile, mg/L se omogenea).
    // In modalità unica: usa hasVar globale per decidere la formula uniforme.
    const useConc = customMode ? (!isVar) : (!isVar && !hasVar)
    if (useConc) {
      // Modalità concentrazione: C1V1 = C2V2
      const vol = Math.round(((val * volFin) / (info.cv || 1)) * 1000) / 1000
      return { nome: s.nome, vol, modo: 'conc' as const, concTarget: val }
    } else {
      // Modalità diluizione: V = Vfin / N
      const vol = Math.round((volFin / val) * 1000) / 1000
      return { nome: s.nome, vol, modo: 'dil' as const, dilFactor: val }
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Catena tracciabilità: lista composti con conc calcolata
// ─────────────────────────────────────────────────────────────────────────────
export interface CompostoInWork {
  nome: string
  concInWork: number
  unita: string
  srcPath: string
}

export function getCompsFromWork(
  w: WorkInSchema,
  workCols: WorkInSchema[][],
  crmItems: CrmItem[],
  visited: Set<string> = new Set()
): CompostoInWork[] {
  const result: CompostoInWork[] = []
  for (let i = 0; i < w.srcs.length; i++) {
    const src = w.srcs[i]
    const ing = w.vols[i]
    let dilFactor: number
    if (ing?.modo === 'dil' && ing.dilFactor) {
      dilFactor = 1 / ing.dilFactor   // ÷10 → conc finale = conc_sorgente × 0.1
    } else if (ing?.modo === 'conc' && ing.concTarget && src.cv) {
      dilFactor = ing.concTarget / src.cv
    } else if (w.conc && src.cv) {
      dilFactor = w.conc / src.cv     // fallback originale
    } else {
      dilFactor = 1
    }
    if (src.tipo === 'work') {
      let srcWork: WorkInSchema | undefined
      for (const col of workCols) { srcWork = col.find(x => x.id === src.id); if (srcWork) break }
      if (srcWork && !visited.has(srcWork.id)) {
        const nextVisited = new Set(visited)
        nextVisited.add(w.id)
        getCompsFromWork(srcWork, workCols, crmItems, nextVisited).forEach(sc =>
          result.push({ ...sc, concInWork: sc.concInWork * dilFactor })
        )
      }
    } else if (src.tipo === 'mix') {
      crmItems.filter(c => c.mix_id === src.id).forEach(c =>
        result.push({ nome: c.nome, concInWork: c.cv * dilFactor, unita: c.unita_conc, srcPath: src.nome })
      )
    } else if (src.tipo === 'prep') {
      result.push({ nome: src.nome, concInWork: src.cv * dilFactor, unita: 'mg/L', srcPath: src.nome + ' (Stock)' })
    } else {
      result.push({ nome: src.nome, concInWork: src.cv * dilFactor, unita: 'mg/L', srcPath: src.nome + ' (CRM)' })
    }
  }
  // Aggrega per nome: somma le concentrazioni e unisce i srcPath
  const map = new Map<string, CompostoInWork>()
  for (const c of result) {
    const key = c.nome.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.concInWork += c.concInWork
      if (!existing.srcPath.includes(c.srcPath)) {
        existing.srcPath = existing.srcPath + ', ' + c.srcPath
      }
    } else {
      map.set(key, { ...c })
    }
  }
  return Array.from(map.values())
}

// ─────────────────────────────────────────────────────────────────────────────
// Salvataggio Work nel DB (solo se ha validitaMesi)
// Ritorna dbId assegnato oppure null se "al momento"
// ─────────────────────────────────────────────────────────────────────────────
export async function salvaWorkNelDb(
  w: WorkInSchema,
  metodoId: string,
  crmItems: CrmItem[],
  workCols?: WorkInSchema[][]
): Promise<number | null> {
  if (!w.validitaMesi) return null   // "al momento" → non salvare nel DB

  // Risolvi gli ingredienti: per i mix usa l'id numerico del primo composto del mix
  type Ing = { source_type: 'crm' | 'work' | 'prep'; source_id: number; volume_prelievo_ml: number; fattore_diluizione: number | null; conc_target_mgL: number | null; modo_calcolo: 'conc' | 'dil' }
  const ingredienti = w.vols.flatMap((ing, i): Ing[] => {
    const src = w.srcs[i]
    if (!src) return []
    if (src.tipo === 'work') {
      // Cerca il dbId della work sorgente nei workCols (id locale → dbId numerico)
      let srcDbId: number = 0
      if (workCols) {
        for (const col of workCols) {
          const found = col.find(x => x.id === src.id)
          if (found?.dbId) { srcDbId = found.dbId; break }
        }
      }
      return [{
        source_type:        'work' as const,
        source_id:          srcDbId,
        volume_prelievo_ml: ing.vol,
        fattore_diluizione: ing.dilFactor ?? null,
        conc_target_mgL:    ing.concTarget ?? null,
        modo_calcolo:       ing.modo,
      }]
    }
    if (src.tipo === 'prep') {
      return [{
        source_type:        'prep' as const,
        source_id:          src.prepId!,
        volume_prelievo_ml: ing.vol,
        fattore_diluizione: ing.dilFactor ?? null,
        conc_target_mgL:    ing.concTarget ?? null,
        modo_calcolo:       ing.modo,
      }]
    }
    if (src.tipo === 'mix') {
      // Trova tutti i composti del mix e inserisci uno per ciascuno
      const comps = crmItems.filter(c => c.mix_id === src.id)
      if (comps.length === 0) return []
      return comps.map(c => ({
        source_type:        'crm' as const,
        source_id:          c.id,
        volume_prelievo_ml: ing.vol,
        fattore_diluizione: ing.dilFactor ?? null,
        conc_target_mgL:    ing.concTarget ?? null,
        modo_calcolo:       ing.modo,
      }))
    }
    // tipo === 'sng'
    const srcId = parseInt(src.id ?? '0')
    if (!srcId) return []
    return [{
      source_type:        'crm' as const,
      source_id:          srcId,
      volume_prelievo_ml: ing.vol,
      fattore_diluizione: ing.dilFactor ?? null,
      conc_target_mgL:    ing.concTarget ?? null,
      modo_calcolo:       ing.modo,
    }]
  })

  const payload = {
    nome:           w.nome,
    concentrazione: w.concVariabile ? null : w.conc,
    conc_variabile: w.concVariabile ? 1 : 0,
    unita_conc:     w.unitaConc,
    volume_ml:      w.volFin,
    solvente:       w.solv || null,
    validita_mesi:  w.validitaMesi,
    operatore:      w.op || null,
    note:           null,
    livello:        0,
    metodi_ids:     [metodoId],
    ingredienti,
  }

  const result: any = await (window as any).electronAPI.invoke('work:create', payload)
  const newId: number | null = result?.id ?? null

  return newId
}

// ─────────────────────────────────────────────────────────────────────────────
// Verifica compatibilità CRM di una work importata con il metodo corrente
// ─────────────────────────────────────────────────────────────────────────────
export function verificaCompatibilitaCrm(
  dbWork: any,
  crmItems: CrmItem[]
): { compatibile: boolean; mancanti: string[] } {
  const crmIds = new Set(crmItems.map(c => c.id))
  const mancanti: string[] = []

  for (const ing of (dbWork.ingredienti ?? [])) {
    if (ing.source_type === 'crm' && !crmIds.has(ing.source_id)) {
      const label = ing.source_mix_nome ?? ing.source_nome ?? `ID ${ing.source_id}`
      if (!mancanti.includes(label))
        mancanti.push(label)
    }
  }
  return { compatibile: mancanti.length === 0, mancanti }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ricostruisce un WorkInSchema da un record DB (per import da altro metodo)
// Ritorna null se ci sono dipendenze work mancanti nello schema corrente
// ─────────────────────────────────────────────────────────────────────────────
export function ricostruisciWorkInSchema(
  dbWork: any,
  crmItems: CrmItem[],
  workColsFlat: WorkInSchema[],
  workCols: WorkInSchema[][]
): WorkInSchema | null {
  const ingredienti: any[] = dbWork.ingredienti ?? []
  const srcs: SorgenteSel[] = []
  const vols: Ingrediente[] = []
  const seenMix = new Set<string>()
  const extraSrcs: Array<{ id: string; nome: string; tipo: 'mix' | 'sng' }> = []
  const seenExtraMix = new Set<string>()

  for (const ing of ingredienti) {
    if (ing.source_type === 'crm') {
      const crm = crmItems.find(c => c.id === ing.source_id)
      if (!crm) {
        // Compound non in schema corrente: raccogliamo come "extra"
        if (ing.source_mix_id) {
          if (!seenExtraMix.has(ing.source_mix_id)) {
            seenExtraMix.add(ing.source_mix_id)
            extraSrcs.push({ id: ing.source_mix_id, nome: ing.source_mix_nome ?? ing.source_nome ?? '', tipo: 'mix' })
          }
        } else if (ing.source_mix_nome) {
          const key = `fc:${ing.source_mix_nome}`
          if (!seenExtraMix.has(key)) {
            seenExtraMix.add(key)
            extraSrcs.push({ id: key, nome: ing.source_mix_nome, tipo: 'mix' })
          }
        } else {
          extraSrcs.push({ id: String(ing.source_id), nome: ing.source_nome ?? `ID ${ing.source_id}`, tipo: 'sng' })
        }
        continue
      }

      if (crm.mix_id) {
        if (seenMix.has(crm.mix_id)) continue // già aggiunto come mix
        seenMix.add(crm.mix_id)
        srcs.push({
          id: crm.mix_id,
          nome: crm.mix ?? crm.nome,
          cv: crm.cv,
          tipo: 'mix',
          concVariabile: crm.concVariabile,
        })
      } else {
        srcs.push({
          id: String(crm.id),
          nome: crm.nome,
          cv: crm.cv,
          tipo: 'sng',
          concVariabile: crm.concVariabile,
        })
      }
      vols.push({
        nome: crm.mix_id ? (crm.mix ?? crm.nome) : crm.nome,
        vol: ing.volume_prelievo_ml ?? 0,
        concTarget: ing.conc_target_mgL ?? undefined,
        dilFactor: ing.fattore_diluizione ?? undefined,
        modo: ing.modo_calcolo ?? 'conc',
      })
    } else if (ing.source_type === 'work') {
      // Cerca la work dipendente nello schema corrente
      let found: WorkInSchema | undefined
      let foundColIdx = -1
      for (let ci = 0; ci < workCols.length; ci++) {
        const w = workCols[ci].find(w => w.dbId === ing.source_id)
        if (w) { found = w; foundColIdx = ci; break }
      }
      if (!found) return null // dipendenza mancante
      srcs.push({
        id: found.id,
        nome: found.nome,
        cv: found.concVariabile ? 1 : 0,
        tipo: 'work',
        colSrc: foundColIdx,
      })
      vols.push({
        nome: found.nome,
        vol: ing.volume_prelievo_ml ?? 0,
        concTarget: ing.conc_target_mgL ?? undefined,
        dilFactor: ing.fattore_diluizione ?? undefined,
        modo: ing.modo_calcolo ?? 'conc',
      })
    } else if (ing.source_type === 'prep') {
      // CRM Neat: risali al composto padre tramite source_composto_id
      const crm = crmItems.find(c => c.id === ing.source_composto_id)
      if (crm) {
        srcs.push({
          id: String(crm.id),
          nome: crm.nome,
          cv: crm.cv,
          tipo: 'prep',
          concVariabile: false,
        })
        vols.push({
          nome: crm.nome,
          vol: ing.volume_prelievo_ml ?? 0,
          concTarget: ing.conc_target_mgL ?? undefined,
          dilFactor: ing.fattore_diluizione ?? undefined,
          modo: ing.modo_calcolo ?? 'conc',
        })
      }
    }
  }

  const id = Math.random().toString(36).slice(2, 10) // id locale
  return {
    id,
    dbId: dbWork.id,
    nome: dbWork.nome,
    conc: dbWork.concentrazione,
    concVariabile: !!dbWork.conc_variabile,
    unitaConc: dbWork.unita_conc ?? 'mg/L',
    volFin: dbWork.volume_ml ?? 0,
    solv: dbWork.solvente ?? '',
    validitaMesi: dbWork.validita_mesi,
    op: dbWork.operatore ?? '',
    srcs,
    vols,
    extraSrcs: extraSrcs.length > 0 ? extraSrcs : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcola le connessioni SVG tra card sorgente → card Work
// ─────────────────────────────────────────────────────────────────────────────
export function computeConnections(
  workCols: WorkInSchema[][],
  cardRefs: Map<string, HTMLDivElement>,
  scrollContainer: HTMLDivElement
): ConnectionLine[] {
  const lines: ConnectionLine[] = []
  const containerRect = scrollContainer.getBoundingClientRect()

  for (const works of workCols) {
    for (const w of works) {
      const targetEl = cardRefs.get(w.id)
      if (!targetEl) continue

      for (const src of w.srcs) {
        const sourceEl = cardRefs.get(src.id)
        if (!sourceEl) continue

        const sRect = sourceEl.getBoundingClientRect()
        const tRect = targetEl.getBoundingClientRect()

        const x1 = sRect.right  - containerRect.left + scrollContainer.scrollLeft
        const y1 = sRect.top + sRect.height / 2 - containerRect.top + scrollContainer.scrollTop
        const x2 = tRect.left   - containerRect.left + scrollContainer.scrollLeft
        const y2 = tRect.top + tRect.height / 2 - containerRect.top + scrollContainer.scrollTop

        const color = src.tipo === 'mix'  ? C.mix.border
                    : src.tipo === 'sng'  ? C.sng.border
                    : src.tipo === 'prep' ? C.sng.border
                    : C.work.border

        lines.push({ x1, y1, x2, y2, color, sourceType: src.tipo })
      }
    }
  }
  return lines
}
