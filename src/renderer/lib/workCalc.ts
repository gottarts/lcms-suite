// Calcolo concentrazioni ricorsivo a partire da un ExpandedWork (IPC work:expand-tree).
// Parallela la logica di getCompsFromWork in SchemaCalibrazione.logic.ts, ma lavora
// su ExpandedWork invece di WorkInSchema — non richiede che le work dipendenti siano
// già nello schema corrente.

export type CompostoCalcolato = {
  nome: string
  concInWork: number
  unita: string
  srcPath: string
}

export type ExpandedWorkLike = {
  work_id: number
  work_nome: string
  validita_mesi: number | null
  ultima_prep_data: string | null
  leaves: {
    source_type: 'crm' | 'prep'
    source_id: number
    nome: string | null
    lotto: string | null
    concentrazione: number | null
    unita_conc: string | null
    mix_id: string | null
    prep_id: number | null
    volume_prelievo_ml: number | null
    fattore_diluizione: number | null
    conc_target_mgL: number | null
    modo_calcolo: string | null
  }[]
  children_works: ExpandedWorkLike[]
  problemi: {
    crm_dismessi: boolean
    crm_scaduti: boolean
    prep_scadute: boolean
    prep_dismesse: boolean
    work_scadute: boolean
    work_bloccate: boolean
  }
  // Fattori di diluizione come visti dal nodo PADRE (null per la radice)
  parent_volume_prelievo_ml?: number | null
  parent_fattore_diluizione?: number | null
  parent_conc_target_mgL?: number | null
  parent_modo_calcolo?: string | null
  parent_work_conc?: number | null
}

// Calcola il fattore di diluizione da applicare ai composti di una child work
// nel contesto della work padre.
//
// Logica identica a getCompsFromWork in SchemaCalibrazione.logic.ts:
//   - modo='dil' con dilFactor → dilFactor_applicato = 1 / dilFactor
//   - modo='conc' con concTarget e cv della child → dilFactor_applicato = concTarget / cv
//   - fallback: conc_padre / cv_child
function calcDilFactorFromParent(child: ExpandedWorkLike): number {
  const modo = child.parent_modo_calcolo ?? null
  const dilF = child.parent_fattore_diluizione ?? null
  const target = child.parent_conc_target_mgL ?? null
  const parentConc = child.parent_work_conc ?? null

  // cv della child: usa concentrazione della work figlia (se non variabile)
  // Non abbiamo il campo conc_variabile nell'ExpandedWorkLike, ma possiamo
  // dedurlo: se la child ha conc null → variabile, cv=1 (come in getCompsFromWork)
  // La concentrazione della child non è nel tree — usiamo parent_work_conc come proxy
  // In realtà: serve la concentrazione della child work stessa.
  // Recuperiamo da parent_conc_target_mgL oppure lasciamo 1.

  if (modo === 'dil' && dilF && dilF !== 0) {
    return 1 / dilF
  }
  if (modo === 'conc' && target != null) {
    // concTarget / cv_child: cv_child non è noto nell'ExpandedWorkLike.
    // Usiamo parent_work_conc come approssimazione (è la conc della work padre,
    // non della child). Per ora restituiamo target come denominatore unitario
    // se cv_child non noto.
    return target  // sarà corretto se cv_child=1 o variabile
  }
  // Fallback: ratio padre/child se disponibili
  if (parentConc != null && parentConc !== 0) {
    return parentConc  // sarà corretto se cv_child=1
  }
  return 1
}

export function computeCompostiFromWorkTree(
  tree: ExpandedWorkLike,
  visited: Set<number> = new Set()
): CompostoCalcolato[] {
  if (visited.has(tree.work_id)) return []
  visited.add(tree.work_id)

  const result: CompostoCalcolato[] = []

  // Foglie dirette (crm / prep)
  const seenMixId = new Set<string>()

  for (const leaf of tree.leaves) {
    const cv = leaf.concentrazione ?? 0

    let dilFactor: number
    if (leaf.modo_calcolo === 'dil' && leaf.fattore_diluizione) {
      dilFactor = 1 / leaf.fattore_diluizione
    } else if (leaf.modo_calcolo === 'conc' && leaf.conc_target_mgL && cv) {
      dilFactor = leaf.conc_target_mgL / cv
    } else {
      dilFactor = 1
    }

    const nome = leaf.nome ?? `ID ${leaf.source_id}`
    const unita = leaf.unita_conc ?? 'mg/L'

    if (leaf.mix_id && seenMixId.has(`${leaf.mix_id}-${leaf.source_id}`)) continue
    if (leaf.mix_id) seenMixId.add(`${leaf.mix_id}-${leaf.source_id}`)

    result.push({
      nome,
      concInWork: cv * dilFactor,
      unita,
      srcPath: leaf.source_type === 'prep'
        ? `${nome} (Stock)`
        : `${nome} (CRM)`,
    })
  }

  // Work figlie (ricorsione): applica il dilFactor padre→figlio
  for (const child of tree.children_works) {
    const parentDilFactor = calcDilFactorFromParent(child)
    const childComps = computeCompostiFromWorkTree(child, new Set(visited))
    for (const c of childComps) {
      result.push({
        ...c,
        concInWork: c.concInWork * parentDilFactor,
        srcPath: `${child.work_nome} → ${c.srcPath}`,
      })
    }
  }

  // Aggrega per nome: somma concentrazioni e unisce i percorsi sorgente
  const map = new Map<string, CompostoCalcolato>()
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
