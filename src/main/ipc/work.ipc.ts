import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { StatoLab, WorkPreparazione } from '../../shared/types'

// Calcola lo stato laboratorio in base all'ultima preparazione e alla validità
function calcolaStatoLab(
  ultimaPrep: WorkPreparazione | null | undefined,
  validita_mesi: number | null
): StatoLab | null {
  if (!validita_mesi) return null           // "al momento" — nessun badge
  if (!ultimaPrep) return 'non_preparata'

  const dataPrepMs  = new Date(ultimaPrep.data_prep).getTime()
  const oggi        = Date.now()
  const validitaMs  = validita_mesi * 30.44 * 24 * 60 * 60 * 1000
  const scadenzaMs  = dataPrepMs + validitaMs
  const sogliaMs    = validitaMs * 0.2     // 20% del periodo = "in scadenza"

  if (oggi > scadenzaMs) return 'scaduta'
  if (oggi > scadenzaMs - sogliaMs) return 'in_scadenza'
  return 'attiva'
}

export function registerWorkIpc(): void {

  // ── LIST: tutte le work, con conteggio ingredienti e metodi ──────────────
  ipcMain.handle('work:list', () => {
    const db = getDb()
    const works = db.prepare(`
      SELECT w.*,
        (SELECT COUNT(*) FROM work_ingredienti WHERE work_id = w.id) AS n_ingredienti,
        (SELECT COUNT(*) FROM work_metodi WHERE work_id = w.id)      AS n_metodi,
        (SELECT metodo_id FROM work_metodi WHERE work_id = w.id LIMIT 1) AS primo_metodo_id,
        (SELECT wp.id         FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_id,
        (SELECT wp.data_prep  FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_data_prep,
        (SELECT wp.note       FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_note,
        (SELECT wp.operatore  FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_operatore,
        (SELECT wp.created_at FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_created_at
      FROM work w
      ORDER BY w.created_at DESC
    `).all() as any[]

    return works.map((w: any) => {
      const ultimaPrep: WorkPreparazione | null = w._up_id ? {
        id: w._up_id,
        work_id: w.id,
        data_prep: w._up_data_prep,
        note: w._up_note,
        operatore: w._up_operatore,
        created_at: w._up_created_at,
      } : null
      const { _up_id, _up_data_prep, _up_note, _up_operatore, _up_created_at, ...rest } = w
      return {
        ...rest,
        ultima_preparazione: ultimaPrep,
        stato_lab: calcolaStatoLab(ultimaPrep, w.validita_mesi),
      }
    })
  })

  // ── GET: singola work con ingredienti e metodi ────────────────────────────
  ipcMain.handle('work:get', (_, id: number) => {
    const db = getDb()
    const work = db.prepare('SELECT * FROM work WHERE id = ?').get(id) as any
    if (!work) return null

    work.ingredienti = db.prepare(`
      SELECT wi.*,
        CASE
          WHEN wi.source_type = 'crm'  THEN (SELECT nome FROM composti WHERE id = wi.source_id)
          WHEN wi.source_type = 'work' THEN (SELECT nome FROM work    WHERE id = wi.source_id)
        END AS source_nome,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT lotto FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_lotto,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT forma_commerciale FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix
      FROM work_ingredienti wi
      WHERE wi.work_id = ?
    `).all(id)

    work.metodi_ids = db.prepare(
      'SELECT metodo_id FROM work_metodi WHERE work_id = ?'
    ).all(id).map((r: any) => r.metodo_id)

    const ultimaPrep = db.prepare(
      'SELECT * FROM work_preparazioni WHERE work_id = ? ORDER BY data_prep DESC LIMIT 1'
    ).get(id) as WorkPreparazione | undefined
    work.ultima_preparazione = ultimaPrep ?? null
    work.stato_lab = calcolaStatoLab(ultimaPrep, work.validita_mesi)

    return work
  })

  // ── CREATE ────────────────────────────────────────────────────────────────
  ipcMain.handle('work:create', (_, data: {
    nome: string
    concentrazione?: number | null
    conc_variabile?: boolean
    unita_conc?: string
    volume_ml?: number | null
    solvente?: string | null
    validita_mesi?: number | null
    operatore?: string | null
    note?: string | null
    livello?: number
    ingredienti?: Array<{
      source_type: 'crm' | 'work'
      source_id: number
      volume_prelievo_ml?: number | null
      fattore_diluizione?: number | null
      conc_target_mgL?: number | null
      modo_calcolo?: 'conc' | 'dil' | null
    }>
    metodi_ids?: string[]
  }) => {
    const db = getDb()
    const ingredienti = data.ingredienti || []
    const metodiIds  = data.metodi_ids  || []

    const insertWork = db.prepare(`
      INSERT INTO work (nome, concentrazione, conc_variabile, unita_conc,
        volume_ml, solvente, validita_mesi, operatore, note, livello)
      VALUES (@nome, @concentrazione, @conc_variabile, @unita_conc,
        @volume_ml, @solvente, @validita_mesi, @operatore, @note, @livello)
    `)
    const insertIngr = db.prepare(`
      INSERT INTO work_ingredienti
        (work_id, source_type, source_id, volume_prelievo_ml,
         fattore_diluizione, conc_target_mgL, modo_calcolo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertLink = db.prepare(
      'INSERT INTO work_metodi (work_id, metodo_id) VALUES (?, ?)'
    )

    let newId: number | bigint = 0
    db.transaction(() => {
      const result = insertWork.run({
        nome:           data.nome,
        concentrazione: data.concentrazione ?? null,
        conc_variabile: data.conc_variabile ? 1 : 0,
        unita_conc:     data.unita_conc     ?? 'mg/L',
        volume_ml:      data.volume_ml      ?? null,
        solvente:       data.solvente       ?? null,
        validita_mesi:  data.validita_mesi  ?? null,
        operatore:      data.operatore      ?? null,
        note:           data.note           ?? null,
        livello:        data.livello        ?? 0,
      })
      newId = result.lastInsertRowid
      for (const ing of ingredienti) {
        insertIngr.run(
          newId, ing.source_type, ing.source_id,
          ing.volume_prelievo_ml  ?? null,
          ing.fattore_diluizione  ?? null,
          ing.conc_target_mgL     ?? null,
          ing.modo_calcolo        ?? null
        )
      }
      for (const mid of metodiIds) {
        insertLink.run(newId, mid)
      }
    })()

    return db.prepare('SELECT * FROM work WHERE id = ?').get(newId)
  })

  // ── UPDATE ────────────────────────────────────────────────────────────────
  ipcMain.handle('work:update', (_, id: number, data: {
    nome?: string
    concentrazione?: number | null
    conc_variabile?: boolean
    unita_conc?: string
    volume_ml?: number | null
    solvente?: string | null
    validita_mesi?: number | null
    operatore?: string | null
    note?: string | null
    ingredienti?: Array<{
      source_type: 'crm' | 'work'
      source_id: number
      volume_prelievo_ml?: number | null
      fattore_diluizione?: number | null
      conc_target_mgL?: number | null
      modo_calcolo?: 'conc' | 'dil' | null
    }>
    metodi_ids?: string[]
  }) => {
    const db = getDb()
    const current = db.prepare('SELECT * FROM work WHERE id = ?').get(id) as any
    if (!current) return null

    const ingredienti = data.ingredienti
    const metodiIds   = data.metodi_ids

    const updateWork = db.prepare(`
      UPDATE work SET
        nome           = @nome,
        concentrazione = @concentrazione,
        conc_variabile = @conc_variabile,
        unita_conc     = @unita_conc,
        volume_ml      = @volume_ml,
        solvente       = @solvente,
        validita_mesi  = @validita_mesi,
        operatore      = @operatore,
        note           = @note
      WHERE id = @id
    `)
    const deleteIngr = db.prepare('DELETE FROM work_ingredienti WHERE work_id = ?')
    const insertIngr = db.prepare(`
      INSERT INTO work_ingredienti
        (work_id, source_type, source_id, volume_prelievo_ml,
         fattore_diluizione, conc_target_mgL, modo_calcolo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const deleteLinks = db.prepare('DELETE FROM work_metodi WHERE work_id = ?')
    const insertLink  = db.prepare(
      'INSERT INTO work_metodi (work_id, metodo_id) VALUES (?, ?)'
    )

    db.transaction(() => {
      updateWork.run({
        id,
        nome:           data.nome           ?? current.nome,
        concentrazione: data.concentrazione !== undefined ? data.concentrazione : current.concentrazione,
        conc_variabile: data.conc_variabile !== undefined ? (data.conc_variabile ? 1 : 0) : current.conc_variabile,
        unita_conc:     data.unita_conc     ?? current.unita_conc,
        volume_ml:      data.volume_ml      !== undefined ? data.volume_ml      : current.volume_ml,
        solvente:       data.solvente       !== undefined ? data.solvente       : current.solvente,
        validita_mesi:  data.validita_mesi  !== undefined ? data.validita_mesi  : current.validita_mesi,
        operatore:      data.operatore      !== undefined ? data.operatore      : current.operatore,
        note:           data.note           !== undefined ? data.note           : current.note,
      })
      if (ingredienti !== undefined) {
        deleteIngr.run(id)
        for (const ing of ingredienti) {
          insertIngr.run(
            id, ing.source_type, ing.source_id,
            ing.volume_prelievo_ml  ?? null,
            ing.fattore_diluizione  ?? null,
            ing.conc_target_mgL     ?? null,
            ing.modo_calcolo        ?? null
          )
        }
      }
      if (metodiIds !== undefined) {
        deleteLinks.run(id)
        for (const mid of metodiIds) {
          insertLink.run(id, mid)
        }
      }
    })()

    return db.prepare('SELECT * FROM work WHERE id = ?').get(id)
  })

  // ── DELETE ────────────────────────────────────────────────────────────────
  ipcMain.handle('work:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM work WHERE id = ?').run(id)
    return { ok: true }
  })

  // ── LIST per metodo ───────────────────────────────────────────────────────
  ipcMain.handle('work:list-by-metodo', (_, metodoId: string) => {
    return getDb().prepare(`
      SELECT w.* FROM work w
      JOIN work_metodi wm ON wm.work_id = w.id
      WHERE wm.metodo_id = ?
      ORDER BY w.created_at DESC
    `).all(metodoId)
  })

  // ── PREPARA: registra una nuova preparazione ──────────────────────────────
  ipcMain.handle('work:prepara', (_, data: {
    work_id: number
    data_prep: string
    note?: string | null
    operatore?: string | null
  }) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO work_preparazioni (work_id, data_prep, note, operatore)
      VALUES (?, ?, ?, ?)
    `).run(data.work_id, data.data_prep, data.note ?? null, data.operatore ?? null)
    return db.prepare('SELECT * FROM work_preparazioni WHERE id = ?').get(result.lastInsertRowid)
  })

  // ── PREPARAZIONI LIST: storico preparazioni di una work ───────────────────
  ipcMain.handle('work:preparazioni-list', (_, workId: number) => {
    return getDb().prepare(
      'SELECT * FROM work_preparazioni WHERE work_id = ? ORDER BY data_prep DESC'
    ).all(workId)
  })
}
