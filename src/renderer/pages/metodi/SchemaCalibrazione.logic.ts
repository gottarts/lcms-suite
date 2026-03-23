// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.logic.ts  —  Parte 2 / 4
//
// PERCORSO FINALE:
//   src/renderer/pages/metodi/SchemaCalibrazione.logic.ts
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import type { CrmItem, AnalitoItem, SorgenteSel, WorkInSchema, ConnectionLine } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'

// ─────────────────────────────────────────────────────────────────────────────
// Hook: carica CRM del metodo dal DB (tutti tranne dismessi)
// ─────────────────────────────────────────────────────────────────────────────
export function useSchemaData(metodoId: string) {
  const [crmItems, setCrmItems] = useState<CrmItem[]>([])
  const [analiti,  setAnaliti]  = useState<AnalitoItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

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
          mix:              r.mix ?? null,
          concentrazione:   r.concentrazione ?? null,
          unita_conc:       r.unita_conc ?? 'mg/L',
          forma:            r.forma ?? null,
          lotto:            r.lotto ?? null,
          produttore:       r.produttore ?? null,
          scadenza_prodotto:    r.scadenza_prodotto ?? null,
          ultima_rivalidazione: r.ultima_rivalidazione ?? null,
          cv,
          concVariabile: false,
          isIS,
        }
      })
      setCrmItems(items)

      // 3. Costruisce mappe CRM disponibili per nome
      const mixMap = new Map<string, string>()      // nome → mix_id
      const sngMap = new Map<string, string[]>()    // nome → array di String(id) (tutti i singoli)
      const isMap  = new Map<string, boolean>()

      for (const item of items) {
        if (item.mix_id) {
          mixMap.set(item.nome, item.mix_id)
        } else {
          const arr = sngMap.get(item.nome) ?? []
          arr.push(String(item.id))
          sngMap.set(item.nome, arr)
        }
        if (item.isIS) isMap.set(item.nome, true)
      }

      // 4. Costruisce AnalitoItem[] dalla lista persistente (non dai CRM)
      //    Gli analiti senza CRM disponibili sono comunque inclusi (senzaCrm)
      const analitiCalc: AnalitoItem[] = analitiRows.map(row => ({
        nome:   row.nome,
        mixId:  mixMap.get(row.nome) ?? null,
        sngIds: sngMap.get(row.nome) ?? [],
        isCon:  mixMap.has(row.nome) && sngMap.has(row.nome),
        isIS:   isMap.get(row.nome) ?? false,
      }))

      // Ordine: solo-singoli → entrambi → solo-mix → senza CRM (in coda)
      const conCrm   = analitiCalc.filter(a => a.mixId || a.sngIds.length > 0)
      const senzaCrm = analitiCalc.filter(a => !a.mixId && a.sngIds.length === 0)
      const soloSng  = conCrm.filter(a => !a.mixId)
      const entrambi = conCrm.filter(a =>  a.mixId && a.sngIds.length > 0)
      const soloMix  = conCrm.filter(a =>  a.mixId && a.sngIds.length === 0)
      setAnaliti([...soloSng, ...entrambi, ...soloMix, ...senzaCrm])
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }, [metodoId])

  useEffect(() => { load() }, [load])
  return { crmItems, analiti, loading, error, reload: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcola info concentrazione di una sorgente
// ─────────────────────────────────────────────────────────────────────────────
export function getConcInfo(
  s: SorgenteSel,
  workCols: WorkInSchema[][]
): { omogenea: boolean; cv: number; label: string } {
  if (s.tipo === 'sng' || s.tipo === 'mix') {
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

    if (!isVar && !hasVar) {
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
  crmItems: CrmItem[]
): CompostoInWork[] {
  const result: CompostoInWork[] = []
  for (const src of w.srcs) {
    const dilFactor = w.conc && src.cv ? w.conc / src.cv : 1
    if (src.tipo === 'work') {
      let srcWork: WorkInSchema | undefined
      for (const col of workCols) { srcWork = col.find(x => x.id === src.id); if (srcWork) break }
      if (srcWork) {
        getCompsFromWork(srcWork, workCols, crmItems).forEach(sc =>
          result.push({ ...sc, concInWork: sc.concInWork * dilFactor })
        )
      }
    } else if (src.tipo === 'mix') {
      crmItems.filter(c => c.mix_id === src.id).forEach(c =>
        result.push({ nome: c.nome, concInWork: c.cv * dilFactor, unita: c.unita_conc, srcPath: src.nome })
      )
    } else {
      result.push({ nome: src.nome, concInWork: src.cv * dilFactor, unita: 'mg/L', srcPath: src.nome + ' (CRM)' })
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Salvataggio Work nel DB (solo se ha validitaMesi)
// Ritorna dbId assegnato oppure null se "al momento"
// ─────────────────────────────────────────────────────────────────────────────
export async function salvaWorkNelDb(
  w: WorkInSchema,
  metodoId: string,
  crmItems: CrmItem[]
): Promise<number | null> {
  if (!w.validitaMesi) return null   // "al momento" → non salvare nel DB

  // Risolvi gli ingredienti: per i mix usa l'id numerico del primo composto del mix
  const ingredienti = w.vols.flatMap((ing, i) => {
    const src = w.srcs[i]
    if (!src) return []
    if (src.tipo === 'work') {
      return [{
        source_type:        'work' as const,
        source_id:          (src as any).dbId ?? 0,
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
  return result?.id ?? null
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

        const color = src.tipo === 'mix' ? C.mix.border
                    : src.tipo === 'sng' ? C.sng.border
                    : C.work.border

        lines.push({ x1, y1, x2, y2, color, sourceType: src.tipo })
      }
    }
  }
  return lines
}
