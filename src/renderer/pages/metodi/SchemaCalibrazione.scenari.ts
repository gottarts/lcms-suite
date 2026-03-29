// ─────────────────────────────────────────────────────────────────────────────
// SchemaCalibrazione.scenari.ts  —  Algoritmo scenari di copertura CRM Mix
//
// Modulo puro TypeScript (no React, no side effects).
// Genera una sequenza ordinata di scenari disgiunti che massimizzano
// la copertura degli analiti del metodo con i CRM mix disponibili.
// ─────────────────────────────────────────────────────────────────────────────

import type { AnalitoItem, CrmItem } from './SchemaCalibrazione.types'

// ── Tipi esportati ──────────────────────────────────────────────────────────

export interface MixComposizione {
  firma: string           // chiave composizione (nomi componenti ordinati, join '|')
  mixIds: string[]        // tutti i lotti (mix_id) con questa composizione
  analiti: Set<string>    // analiti del metodo coperti da questa composizione
  nomeDisplay: string     // nome commerciale (dal primo mix_id disponibile)
}

export interface Scenario {
  composizioni: MixComposizione[]  // mix selezionati in questo scenario
  copertura: number                // frazione 0..1
  analitiCopertiPerMix: Array<{ firma: string; nome: string; analiti: string[] }>
  analitiNonCoperti: string[]
}

// ── buildMixComposizioni ────────────────────────────────────────────────────

/**
 * Costruisce la lista di composizioni uniche (per firma) a partire dai dati
 * già computati in useSchemaData. Scarta composizioni che non coprono nessun
 * analita del metodo.
 */
export function buildMixComposizioni(
  analiti: AnalitoItem[],
  crmItems: CrmItem[],
  firmaToMixIds: Map<string, string[]>,
  mixNomiMap: Map<string, Set<string>>,
): MixComposizione[] {
  const analitiNomi = new Set(analiti.map(a => a.nome))

  // mix_id → nome commerciale (dal primo CrmItem del mix)
  const mixNomeComm = new Map<string, string>()
  for (const c of crmItems) {
    if (c.mix_id && !mixNomeComm.has(c.mix_id)) {
      mixNomeComm.set(c.mix_id, c.mix ?? c.nome)
    }
  }

  const result: MixComposizione[] = []

  for (const [firma, mixIds] of firmaToMixIds.entries()) {
    // Componenti della composizione (da un qualsiasi lotto — tutti hanno la stessa firma)
    const nomiComp = mixNomiMap.get(mixIds[0]) ?? new Set<string>()

    // Intersezione con gli analiti del metodo
    const analitiCoperti = new Set<string>()
    for (const n of nomiComp) {
      if (analitiNomi.has(n)) analitiCoperti.add(n)
    }

    if (analitiCoperti.size === 0) continue // nessun analita del metodo → salta

    result.push({
      firma,
      mixIds,
      analiti: analitiCoperti,
      nomeDisplay: mixNomeComm.get(mixIds[0]) ?? mixIds[0],
    })
  }

  return result
}

// ── Algoritmo core ──────────────────────────────────────────────────────────

/**
 * Trova il sottoinsieme disgiunto di composizioni che massimizza la copertura.
 * Se `mandatory` è fornito, quella composizione DEVE essere inclusa.
 * Usa backtracking esatto per |composizioni| ≤ 20, greedy altrimenti.
 */
function trovaScenarioMigliore(
  composizioni: MixComposizione[],
  totalAnaliti: number,
  mandatory?: MixComposizione,
): { firme: string[]; copertura: number } {
  if (composizioni.length === 0 && !mandatory) return { firme: [], copertura: 0 }

  if (composizioni.length <= 20) {
    return _esattoBacktracking(composizioni, totalAnaliti, mandatory)
  }
  return _greedy(composizioni, totalAnaliti, mandatory)
}

function _esattoBacktracking(
  composizioni: MixComposizione[],
  totalAnaliti: number,
  mandatory?: MixComposizione,
): { firme: string[]; copertura: number } {
  // Ordina per dimensione decrescente (migliore pruning)
  const sorted = [...composizioni].sort((a, b) => b.analiti.size - a.analiti.size)

  let bestFirme: string[] = []
  let bestCount = 0

  // Prefisso obbligatorio
  const mandFirme: string[] = mandatory ? [mandatory.firma] : []
  const mandCoperto: Set<string> = mandatory ? new Set(mandatory.analiti) : new Set()

  function bt(idx: number, firmeAtt: string[], copertaAtt: Set<string>) {
    const count = copertaAtt.size
    if (count > bestCount) {
      bestCount = count
      bestFirme = [...firmeAtt]
    }

    // Pruning: anche aggiungendo tutti i rimanenti non si può migliorare
    let maxAggiuntivo = 0
    for (let k = idx; k < sorted.length; k++) {
      for (const n of sorted[k].analiti) {
        if (!copertaAtt.has(n)) maxAggiuntivo++
      }
    }
    if (count + maxAggiuntivo <= bestCount) return

    for (let i = idx; i < sorted.length; i++) {
      const comp = sorted[i]
      // Verifica disgiunzione con quanto già selezionato
      let disgiunto = true
      for (const n of comp.analiti) {
        if (copertaAtt.has(n)) { disgiunto = false; break }
      }
      if (!disgiunto) continue

      const nuovaCoperta = new Set(copertaAtt)
      for (const n of comp.analiti) nuovaCoperta.add(n)

      bt(i + 1, [...firmeAtt, comp.firma], nuovaCoperta)
    }
  }

  // Rimuovi mandatory dall'array di candidati prima di esplorare
  const candidati = mandatory
    ? sorted.filter(c => c.firma !== mandatory.firma)
    : sorted

  bt(0, mandFirme, mandCoperto)

  return {
    firme: bestFirme,
    copertura: totalAnaliti > 0 ? bestCount / totalAnaliti : 0,
  }
}

function _greedy(
  composizioni: MixComposizione[],
  totalAnaliti: number,
  mandatory?: MixComposizione,
): { firme: string[]; copertura: number } {
  const firme: string[] = []
  const coperta = new Set<string>()

  if (mandatory) {
    firme.push(mandatory.firma)
    for (const n of mandatory.analiti) coperta.add(n)
  }

  const rimanenti = composizioni.filter(c => c.firma !== mandatory?.firma)

  let progresso = true
  while (progresso) {
    progresso = false
    let bestComp: MixComposizione | null = null
    let bestGain = 0

    for (const comp of rimanenti) {
      // Verifica disgiunzione
      let disgiunto = true
      for (const n of comp.analiti) {
        if (coperta.has(n)) { disgiunto = false; break }
      }
      if (!disgiunto) continue

      const gain = comp.analiti.size
      if (gain > bestGain) {
        bestGain = gain
        bestComp = comp
      }
    }

    if (bestComp && bestGain > 0) {
      firme.push(bestComp.firma)
      for (const n of bestComp.analiti) coperta.add(n)
      rimanenti.splice(rimanenti.indexOf(bestComp), 1)
      progresso = true
    }
  }

  return {
    firme,
    copertura: totalAnaliti > 0 ? coperta.size / totalAnaliti : 0,
  }
}

// ── generaScenari ────────────────────────────────────────────────────────────

/**
 * Genera la sequenza di scenari.
 *
 * Scenario 1: miglior sottoinsieme disgiunto su tutte le mix → marca tutte come usate.
 *
 * Scenari successivi:
 *   Finché ci sono mix non ancora usate:
 *   1. Base: miglior sottoinsieme disgiunto formato SOLO dalle mix residue
 *      (massimizza la copertura usando solo le non-ancora-usate).
 *   2. Riempimento: aggiunge mix già usate (disgiunte con la base) per
 *      aumentare ulteriormente la copertura.
 *   3. Tutte le mix residue presenti nella base vengono marcate come usate.
 *   4. Se la copertura risultante è 0, termina.
 */
export function generaScenari(
  analiti: AnalitoItem[],
  composizioni: MixComposizione[],
): Scenario[] {
  if (composizioni.length === 0 || analiti.length === 0) return []

  const totalAnaliti = analiti.length
  const analitiNomi = analiti.map(a => a.nome)

  const scenari: Scenario[] = []
  const nonAncoraUsati = new Set<string>(composizioni.map(c => c.firma))
  const firmaToComp = new Map<string, MixComposizione>()
  for (const c of composizioni) firmaToComp.set(c.firma, c)

  // ── Scenario 1: tutte le mix disponibili ──
  const primo = trovaScenarioMigliore(composizioni, totalAnaliti)
  if (primo.copertura > 0) {
    scenari.push(_buildScenario(primo.firme, firmaToComp, analitiNomi))
    for (const f of primo.firme) nonAncoraUsati.delete(f)
  } else {
    return []
  }

  // ── Scenari successivi ──
  while (nonAncoraUsati.size > 0) {
    // 1. Base: miglior sottoinsieme disgiunto tra le sole mix residue
    const residue = composizioni.filter(c => nonAncoraUsati.has(c.firma))
    const base = trovaScenarioMigliore(residue, totalAnaliti)

    if (base.copertura === 0) break

    // 2. Riempimento: aggiunge mix già usate (non in base) per aumentare la copertura
    //    Costruisce l'insieme coperto dalla base, poi esegue greedy con le mix già usate
    const copertainBase = new Set<string>()
    for (const f of base.firme) {
      for (const n of firmaToComp.get(f)!.analiti) copertainBase.add(n)
    }

    const giàUsate = composizioni.filter(c => !nonAncoraUsati.has(c.firma))
    const firmeFill = _greedyFill(giàUsate, copertainBase)

    const firmeScenario = [...base.firme, ...firmeFill]
    scenari.push(_buildScenario(firmeScenario, firmaToComp, analitiNomi))

    // 3. Marca tutte le mix residue presenti nella base come usate
    for (const f of base.firme) nonAncoraUsati.delete(f)
  }

  return scenari
}

/**
 * Greedy fill: aggiunge mix dalla lista `candidati` (già usate) che sono
 * disgiunte con `giàCoperto`, massimizzando la copertura aggiuntiva.
 * Ritorna le firme aggiunte.
 */
function _greedyFill(
  candidati: MixComposizione[],
  giàCoperto: Set<string>,
): string[] {
  const coperta = new Set(giàCoperto)
  const rimanenti = [...candidati]
  const firme: string[] = []

  let progresso = true
  while (progresso) {
    progresso = false
    let bestComp: MixComposizione | null = null
    let bestGain = 0

    for (const comp of rimanenti) {
      let disgiunto = true
      for (const n of comp.analiti) {
        if (coperta.has(n)) { disgiunto = false; break }
      }
      if (!disgiunto) continue

      const gain = comp.analiti.size
      if (gain > bestGain) { bestGain = gain; bestComp = comp }
    }

    if (bestComp && bestGain > 0) {
      firme.push(bestComp.firma)
      for (const n of bestComp.analiti) coperta.add(n)
      rimanenti.splice(rimanenti.indexOf(bestComp), 1)
      progresso = true
    }
  }

  return firme
}

// ── Helper privato ───────────────────────────────────────────────────────────

function _buildScenario(
  firme: string[],
  firmaToComp: Map<string, MixComposizione>,
  analitiNomi: string[],
): Scenario {
  const coperti = new Set<string>()
  const analitiCopertiPerMix: Scenario['analitiCopertiPerMix'] = []

  for (const firma of firme) {
    const comp = firmaToComp.get(firma)!
    const gruppo: string[] = []
    for (const n of analitiNomi) {
      if (comp.analiti.has(n)) { coperti.add(n); gruppo.push(n) }
    }
    analitiCopertiPerMix.push({ firma, nome: comp.nomeDisplay, analiti: gruppo })
  }

  const analitiNonCoperti = analitiNomi.filter(n => !coperti.has(n))
  const copertura = analitiNomi.length > 0 ? coperti.size / analitiNomi.length : 0

  return {
    composizioni: firme.map(f => firmaToComp.get(f)!),
    copertura,
    analitiCopertiPerMix,
    analitiNonCoperti,
  }
}
