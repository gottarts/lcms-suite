import type { Database } from 'better-sqlite3'

// ─────────────────────────────────────────────────────────────────────────────
// Tipi esposti dall'albero ricorsivo Work
// ─────────────────────────────────────────────────────────────────────────────

export type WorkTreeLeaf = {
  source_type: 'crm' | 'prep'
  source_id: number
  nome: string | null
  lotto: string | null
  scadenza_effettiva: string | null  // ultima_rivalidazione ?? scadenza_prodotto
  data_dismissione: string | null
  concentrazione: number | null
  unita_conc: string | null
  mix_id: string | null
  // Usato da ingredienti 'prep'
  prep_id: number | null
  prep_flacone: string | null
  prep_scadenza: string | null
  prep_data_prep: string | null
  // Fattori diluizione dall'ingrediente padre
  volume_prelievo_ml: number | null
  fattore_diluizione: number | null
  conc_target_mgL: number | null
  modo_calcolo: string | null
}

export type WorkTreeProblemi = {
  crm_dismessi: boolean
  crm_scaduti: boolean
  prep_scadute: boolean
  prep_dismesse: boolean
  work_scadute: boolean
  work_bloccate: boolean
}

export type ExpandedWork = {
  work_id: number
  work_nome: string
  validita_mesi: number | null
  ultima_prep_data: string | null
  leaves: WorkTreeLeaf[]
  children_works: ExpandedWork[]
  problemi: WorkTreeProblemi
  // Fattori di diluizione come visti dal nodo PADRE (null per la radice)
  parent_volume_prelievo_ml: number | null
  parent_fattore_diluizione: number | null
  parent_conc_target_mgL: number | null
  parent_modo_calcolo: string | null
  parent_work_conc: number | null       // concentrazione della work padre (per fallback)
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: espansione ricorsiva
// ─────────────────────────────────────────────────────────────────────────────

const oggi = () => new Date().toISOString().slice(0, 10)

function isScaduto(scadenza_prodotto: string | null, ultima_rivalidazione: string | null): boolean {
  const scad = ultima_rivalidazione ?? scadenza_prodotto
  if (!scad) return false
  return scad < oggi()
}

export function expandWorkTree(
  db: Database,
  workId: number,
  visited: Set<number> = new Set(),
  parentIngrediente?: {
    volume_prelievo_ml: number | null
    fattore_diluizione: number | null
    conc_target_mgL: number | null
    modo_calcolo: string | null
    parent_work_conc: number | null
  }
): ExpandedWork | null {
  if (visited.has(workId)) return null  // ciclo — interrompi
  visited.add(workId)

  const work = db.prepare('SELECT id, nome, concentrazione, conc_variabile, validita_mesi FROM work WHERE id = ?').get(workId) as any
  if (!work) return null

  const ultimaPrep = db.prepare(
    'SELECT data_prep FROM work_preparazioni WHERE work_id = ? ORDER BY data_prep DESC LIMIT 1'
  ).get(workId) as any

  const ingredienti = db.prepare(`
    SELECT wi.id, wi.source_type, wi.source_id, wi.prep_id,
           wi.volume_prelievo_ml, wi.fattore_diluizione, wi.conc_target_mgL, wi.modo_calcolo,
           CASE
             WHEN wi.source_type = 'crm'  THEN c.nome
             WHEN wi.source_type = 'work' THEN w2.nome
             WHEN wi.source_type = 'prep' THEN cp.nome
           END AS nome,
           CASE
             WHEN wi.source_type = 'crm'  THEN c.lotto
             WHEN wi.source_type = 'prep' THEN p.flacone
           END AS lotto,
           CASE
             WHEN wi.source_type = 'crm'  THEN c.data_dismissione
             WHEN wi.source_type = 'prep' THEN p.data_dismissione
           END AS data_dismissione,
           CASE
             WHEN wi.source_type = 'crm' THEN (
               SELECT MAX(nuova_scadenza) FROM composti_storia
               WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL
             )
           END AS ultima_rivalidazione,
           CASE
             WHEN wi.source_type = 'crm'  THEN c.scadenza_prodotto
             WHEN wi.source_type = 'prep' THEN p.scadenza
           END AS scadenza_prodotto,
           CASE
             WHEN wi.source_type = 'crm'  THEN c.concentrazione
             WHEN wi.source_type = 'prep' THEN p.concentrazione_reale
           END AS concentrazione,
           CASE
             WHEN wi.source_type = 'crm' THEN c.unita_conc
           END AS unita_conc,
           CASE
             WHEN wi.source_type = 'crm' THEN c.mix_id
           END AS mix_id,
           p.scadenza  AS prep_scadenza,
           p.data_prep AS prep_data_prep,
           p.flacone   AS prep_flacone
    FROM work_ingredienti wi
    LEFT JOIN composti c    ON wi.source_type = 'crm'  AND c.id  = wi.source_id
    LEFT JOIN work w2       ON wi.source_type = 'work' AND w2.id = wi.source_id
    LEFT JOIN preparazioni p  ON wi.source_type = 'prep' AND p.id  = COALESCE(wi.prep_id, wi.source_id)
    LEFT JOIN composti cp   ON wi.source_type = 'prep' AND cp.id = p.composto_id
    WHERE wi.work_id = ?
  `).all(workId) as any[]

  const leaves: WorkTreeLeaf[] = []
  const children_works: ExpandedWork[] = []
  const problemi: WorkTreeProblemi = {
    crm_dismessi: false,
    crm_scaduti: false,
    prep_scadute: false,
    prep_dismesse: false,
    work_scadute: false,
    work_bloccate: false,
  }

  const dataOggi = oggi()

  for (const ing of ingredienti) {
    if (ing.source_type === 'work') {
      const child = expandWorkTree(db, ing.source_id, new Set(visited), {
        volume_prelievo_ml: ing.volume_prelievo_ml ?? null,
        fattore_diluizione: ing.fattore_diluizione ?? null,
        conc_target_mgL: ing.conc_target_mgL ?? null,
        modo_calcolo: ing.modo_calcolo ?? null,
        parent_work_conc: (work as any).concentrazione ?? null,
      })
      if (child) {
        children_works.push(child)
        // Propaga i problemi verso l'alto (OR logico)
        if (child.problemi.crm_dismessi)  problemi.crm_dismessi  = true
        if (child.problemi.crm_scaduti)   problemi.crm_scaduti   = true
        if (child.problemi.prep_scadute)  problemi.prep_scadute  = true
        if (child.problemi.prep_dismesse) problemi.prep_dismesse = true
        if (child.problemi.work_scadute)  problemi.work_scadute  = true
        if (child.problemi.work_bloccate) problemi.work_bloccate = true
        // Verifica stato della child work stessa
        if (child.ultima_prep_data && child.validita_mesi) {
          const scadenzaMs = new Date(child.ultima_prep_data).getTime() + child.validita_mesi * 30.44 * 24 * 60 * 60 * 1000
          if (Date.now() > scadenzaMs) problemi.work_scadute = true
        }
        if (child.problemi.crm_dismessi) problemi.work_bloccate = true
      }
    } else {
      const scadenza_effettiva = ing.ultima_rivalidazione ?? ing.scadenza_prodotto ?? null
      const leaf: WorkTreeLeaf = {
        source_type: ing.source_type,
        source_id: ing.source_id,
        nome: ing.nome ?? null,
        lotto: ing.lotto ?? null,
        scadenza_effettiva,
        data_dismissione: ing.data_dismissione ?? null,
        concentrazione: ing.concentrazione ?? null,
        unita_conc: ing.unita_conc ?? null,
        mix_id: ing.mix_id ?? null,
        prep_id: ing.prep_id ?? null,
        prep_flacone: ing.prep_flacone ?? null,
        prep_scadenza: ing.prep_scadenza ?? null,
        prep_data_prep: ing.prep_data_prep ?? null,
        volume_prelievo_ml: ing.volume_prelievo_ml ?? null,
        fattore_diluizione: ing.fattore_diluizione ?? null,
        conc_target_mgL: ing.conc_target_mgL ?? null,
        modo_calcolo: ing.modo_calcolo ?? null,
      }
      leaves.push(leaf)

      if (ing.source_type === 'crm') {
        if (ing.data_dismissione) {
          problemi.crm_dismessi = true
        } else if (isScaduto(ing.scadenza_prodotto, ing.ultima_rivalidazione)) {
          problemi.crm_scaduti = true
        }
      } else if (ing.source_type === 'prep') {
        if (ing.data_dismissione) {
          problemi.prep_dismesse = true
        } else if (ing.prep_scadenza && ing.prep_scadenza < dataOggi) {
          problemi.prep_scadute = true
        }
      }
    }
  }

  return {
    work_id: work.id,
    work_nome: work.nome,
    validita_mesi: work.validita_mesi ?? null,
    ultima_prep_data: ultimaPrep?.data_prep ?? null,
    leaves,
    children_works,
    problemi,
    parent_volume_prelievo_ml: parentIngrediente?.volume_prelievo_ml ?? null,
    parent_fattore_diluizione: parentIngrediente?.fattore_diluizione ?? null,
    parent_conc_target_mgL: parentIngrediente?.conc_target_mgL ?? null,
    parent_modo_calcolo: parentIngrediente?.modo_calcolo ?? null,
    parent_work_conc: parentIngrediente?.parent_work_conc ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilità: appiattisce tutte le foglie (CRM/prep) dell'albero ricorsivamente
// ─────────────────────────────────────────────────────────────────────────────
export function flattenLeaves(tree: ExpandedWork): WorkTreeLeaf[] {
  const result: WorkTreeLeaf[] = [...tree.leaves]
  for (const child of tree.children_works) {
    result.push(...flattenLeaves(child))
  }
  return result
}
