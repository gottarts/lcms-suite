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

  // ── LIST: tutte le work attive (non archiviate), con conteggio e flag bloccata ─
  ipcMain.handle('work:list', () => {
    const db = getDb()
    const works = db.prepare(`
      SELECT w.*,
        (SELECT COUNT(*) FROM work_ingredienti WHERE work_id = w.id) AS n_ingredienti,
        (SELECT COUNT(*) FROM work_metodi WHERE work_id = w.id)      AS n_metodi,
        (SELECT metodo_id FROM work_metodi WHERE work_id = w.id LIMIT 1) AS primo_metodo_id,
        (SELECT COUNT(*)
          FROM work_ingredienti wi
          JOIN composti c ON c.id = wi.source_id
          WHERE wi.work_id = w.id AND wi.source_type = 'crm' AND c.data_dismissione IS NOT NULL
        ) AS n_ingredienti_bloccati,
        (SELECT COUNT(*)
          FROM work_ingredienti wi
          JOIN composti c ON c.id = wi.source_id
          WHERE wi.work_id = w.id
            AND wi.source_type = 'crm'
            AND c.data_dismissione IS NULL
            AND c.scadenza_prodotto IS NOT NULL
            AND c.scadenza_prodotto < date('now')
            AND (
              (SELECT MAX(nuova_scadenza) FROM composti_storia
               WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) IS NULL
              OR
              (SELECT MAX(nuova_scadenza) FROM composti_storia
               WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) < date('now')
            )
        ) AS n_ingredienti_scaduti,
        (SELECT COUNT(*)
          FROM work_ingredienti wi
          JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
          WHERE wi.work_id = w.id
            AND wi.source_type = 'prep'
            AND p.data_dismissione IS NULL
            AND p.scadenza IS NOT NULL
            AND p.scadenza < date('now')
        ) AS n_prep_scadute,
        (SELECT wp.id         FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_id,
        (SELECT wp.data_prep  FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_data_prep,
        (SELECT wp.note       FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_note,
        (SELECT wp.operatore  FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_operatore,
        (SELECT wp.created_at FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS _up_created_at,
        (SELECT GROUP_CONCAT(metodo_id) FROM work_metodi WHERE work_id = w.id) AS _metodi_ids_raw
      FROM work w
      WHERE w.archiviato = 0 OR w.archiviato IS NULL
      ORDER BY w.created_at DESC
    `).all() as any[]

    return works.map((w: any) => {
      const metodi_ids: string[] = w._metodi_ids_raw ? w._metodi_ids_raw.split(',') : []
      const ultimaPrep: WorkPreparazione | null = w._up_id ? {
        id: w._up_id,
        work_id: w.id,
        data_prep: w._up_data_prep,
        note: w._up_note,
        operatore: w._up_operatore,
        created_at: w._up_created_at,
      } : null
      const { _up_id, _up_data_prep, _up_note, _up_operatore, _up_created_at, _metodi_ids_raw, ...rest } = w
      const nBloccati    = w.n_ingredienti_bloccati as number
      const nScaduti     = w.n_ingredienti_scaduti  as number
      const nPrepScadute = w.n_prep_scadute         as number
      return {
        ...rest,
        metodi_ids,
        ultima_preparazione: ultimaPrep,
        stato_lab: calcolaStatoLab(ultimaPrep, w.validita_mesi),
        bloccata: nBloccati > 0,
        motivo_blocco: nBloccati > 0 ? 'dismesso' : null,
        ha_crm_scaduti: nScaduti > 0,
        ha_prep_scadute: nPrepScadute > 0,
      }
    })
  })

  // ── LIST ARCHIVIO: work archiviate ───────────────────────────────────────
  ipcMain.handle('work:list-archivio', () => {
    const db = getDb()
    const works = db.prepare(`
      SELECT w.*,
        (SELECT COUNT(*) FROM work_ingredienti WHERE work_id = w.id) AS n_ingredienti,
        (SELECT COUNT(*) FROM work_metodi WHERE work_id = w.id)      AS n_metodi,
        (SELECT metodo_id FROM work_metodi WHERE work_id = w.id LIMIT 1) AS primo_metodo_id,
        (SELECT GROUP_CONCAT(metodo_id) FROM work_metodi WHERE work_id = w.id) AS _metodi_ids_raw
      FROM work w
      WHERE w.archiviato = 1
      ORDER BY w.archiviato_at DESC
    `).all() as any[]

    return works.map((w: any) => {
      const { _metodi_ids_raw, ...rest } = w
      return {
        ...rest,
        metodi_ids: _metodi_ids_raw ? _metodi_ids_raw.split(',') : [],
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
          WHEN wi.source_type = 'prep' THEN (SELECT c.nome FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
        END AS source_nome,
        CASE
          WHEN wi.source_type = 'crm'  THEN (SELECT lotto FROM composti WHERE id = wi.source_id)
          WHEN wi.source_type = 'prep' THEN (SELECT c.lotto FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
          ELSE NULL
        END AS source_lotto,
        CASE
          WHEN wi.source_type = 'prep' THEN (SELECT flacone FROM preparazioni WHERE id = COALESCE(wi.prep_id, wi.source_id))
          ELSE NULL
        END AS source_flacone,
        CASE
          WHEN wi.source_type = 'prep' THEN (
            SELECT COUNT(*) FROM preparazioni p2
            WHERE p2.composto_id = (SELECT composto_id FROM preparazioni WHERE id = COALESCE(wi.prep_id, wi.source_id))
              AND p2.id <= COALESCE(wi.prep_id, wi.source_id)
          )
          ELSE NULL
        END AS source_progressivo,
        CASE
          WHEN wi.source_type = 'prep' THEN (SELECT scadenza FROM preparazioni WHERE id = COALESCE(wi.prep_id, wi.source_id))
          ELSE NULL
        END AS source_scadenza,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT data_dismissione FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_dismissione,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT forma_commerciale FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT concentrazione FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_cv,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT mix_id FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix_id,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT COALESCE(forma_commerciale, mix) FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix_nome,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT unita_conc FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_unita_conc,
        CASE
          WHEN wi.source_type = 'crm' THEN (
            SELECT COUNT(*) FROM composti c3
            WHERE c3.nome = (SELECT nome FROM composti WHERE id = wi.source_id)
              AND c3.data_dismissione IS NULL
          )
          ELSE NULL
        END AS n_lotti_validi_stesso_nome
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

    const nBloccati = (work.ingredienti as any[]).filter(
      (i: any) => i.source_type === 'crm' && i.source_dismissione !== null
    ).length
    const nScaduti = (db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM work_ingredienti wi
      JOIN composti c ON c.id = wi.source_id
      WHERE wi.work_id = ?
        AND wi.source_type = 'crm'
        AND c.data_dismissione IS NULL
        AND c.scadenza_prodotto IS NOT NULL
        AND c.scadenza_prodotto < date('now')
        AND (
          (SELECT MAX(nuova_scadenza) FROM composti_storia
           WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) IS NULL
          OR
          (SELECT MAX(nuova_scadenza) FROM composti_storia
           WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) < date('now')
        )
    `).get(id) as any).cnt as number
    const nPrepScadute = (db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM work_ingredienti wi
      JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
      WHERE wi.work_id = ?
        AND wi.source_type = 'prep'
        AND p.data_dismissione IS NULL
        AND p.scadenza IS NOT NULL
        AND p.scadenza < date('now')
    `).get(id) as any).cnt as number
    work.bloccata       = nBloccati > 0
    work.motivo_blocco  = nBloccati > 0 ? 'dismesso' : null
    work.ha_crm_scaduti = nScaduti > 0
    work.ha_prep_scadute = nPrepScadute > 0

    return work
  })

  // ── CREATE ────────────────────────────────────────────────────────────────
  ipcMain.handle('work:create', async (_, data: {
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
      source_type: 'crm' | 'work' | 'prep'
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
         fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertIngrPrep = db.prepare(`
      INSERT INTO work_ingredienti
        (work_id, source_type, source_id, volume_prelievo_ml,
         fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato, prep_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertLink = db.prepare(
      'INSERT INTO work_metodi (work_id, metodo_id) VALUES (?, ?)'
    )
    const getLotto       = db.prepare('SELECT lotto FROM composti WHERE id = ?')
    const getPrepFlacone = db.prepare(
      'SELECT c.lotto FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = ?'
    )

    let newId: number | bigint = 0
    try {
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
          let lottoUsato: string | null = null
          if (ing.source_type === 'crm') {
            const row = getLotto.get(ing.source_id) as any
            lottoUsato = row?.lotto ?? null
            insertIngr.run(
              newId, ing.source_type, ing.source_id,
              ing.volume_prelievo_ml  ?? null,
              ing.fattore_diluizione  ?? null,
              ing.conc_target_mgL     ?? null,
              ing.modo_calcolo        ?? null,
              lottoUsato
            )
          } else if (ing.source_type === 'prep') {
            const row = getPrepFlacone.get(ing.source_id) as any
            lottoUsato = row?.lotto ?? null
            insertIngrPrep.run(
              newId, ing.source_type, ing.source_id,
              ing.volume_prelievo_ml  ?? null,
              ing.fattore_diluizione  ?? null,
              ing.conc_target_mgL     ?? null,
              ing.modo_calcolo        ?? null,
              lottoUsato,
              ing.source_id
            )
          } else {
            insertIngr.run(
              newId, ing.source_type, ing.source_id,
              ing.volume_prelievo_ml  ?? null,
              ing.fattore_diluizione  ?? null,
              ing.conc_target_mgL     ?? null,
              ing.modo_calcolo        ?? null,
              lottoUsato
            )
          }
        }
        for (const mid of metodiIds) {
          insertLink.run(newId, mid)
        }
      })()
    } catch (e) {
      console.error('[work:create] ERRORE:', e)
      throw e
    }

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
      source_type: 'crm' | 'work' | 'prep'
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
         fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertIngrPrep = db.prepare(`
      INSERT INTO work_ingredienti
        (work_id, source_type, source_id, volume_prelievo_ml,
         fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato, prep_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const deleteLinks = db.prepare('DELETE FROM work_metodi WHERE work_id = ?')
    const insertLink  = db.prepare(
      'INSERT INTO work_metodi (work_id, metodo_id) VALUES (?, ?)'
    )
    const getLotto       = db.prepare('SELECT lotto FROM composti WHERE id = ?')
    const getPrepFlacone = db.prepare(
      'SELECT c.lotto FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = ?'
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
          let lottoUsato: string | null = null
          if (ing.source_type === 'crm') {
            const row = getLotto.get(ing.source_id) as any
            lottoUsato = row?.lotto ?? null
            insertIngr.run(
              id, ing.source_type, ing.source_id,
              ing.volume_prelievo_ml  ?? null,
              ing.fattore_diluizione  ?? null,
              ing.conc_target_mgL     ?? null,
              ing.modo_calcolo        ?? null,
              lottoUsato
            )
          } else if (ing.source_type === 'prep') {
            const row = getPrepFlacone.get(ing.source_id) as any
            lottoUsato = row?.lotto ?? null
            insertIngrPrep.run(
              id, ing.source_type, ing.source_id,
              ing.volume_prelievo_ml  ?? null,
              ing.fattore_diluizione  ?? null,
              ing.conc_target_mgL     ?? null,
              ing.modo_calcolo        ?? null,
              lottoUsato,
              ing.source_id
            )
          } else {
            insertIngr.run(
              id, ing.source_type, ing.source_id,
              ing.volume_prelievo_ml  ?? null,
              ing.fattore_diluizione  ?? null,
              ing.conc_target_mgL     ?? null,
              ing.modo_calcolo        ?? null,
              lottoUsato
            )
          }
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
    const db = getDb()
    db.prepare('UPDATE work SET sostituito_da_id = NULL WHERE sostituito_da_id = ?').run(id)
    db.prepare('DELETE FROM work WHERE id = ?').run(id)
    return { ok: true }
  })

  // ── LIST per metodo ───────────────────────────────────────────────────────
  ipcMain.handle('work:list-by-metodo', (_, metodoId: string) => {
    return getDb().prepare(`
      SELECT w.* FROM work w
      JOIN work_metodi wm ON wm.work_id = w.id
      WHERE wm.metodo_id = ? AND (w.archiviato = 0 OR w.archiviato IS NULL)
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

  // ── ARCHIVIA: soft-delete di una work ────────────────────────────────────
  ipcMain.handle('work:archivia', (_, id: number, motivo: string) => {
    getDb().prepare(`
      UPDATE work SET
        archiviato = 1,
        archiviato_at = datetime('now'),
        archiviato_motivo = ?
      WHERE id = ?
    `).run(motivo, id)
    return { ok: true }
  })

  // ── SET-SOSTITUITO-DA: imposta il link di tracciabilità sulla work archiviata
  ipcMain.handle('work:set-sostituito-da', (_, oldId: number, newId: number) => {
    getDb().prepare(`
      UPDATE work SET sostituito_da_id = ? WHERE id = ?
    `).run(newId, oldId)
    return { ok: true }
  })

  // ── CHECK-LOT-STATUS: verifica stato lotti ingredienti di una work ────────
  ipcMain.handle('work:check-lot-status', (_, workId: number) => {
    const db = getDb()
    const ingredienti = db.prepare(`
      SELECT wi.id, wi.source_id, wi.prep_id, wi.lotto_usato, wi.source_type,
        CASE
          WHEN wi.source_type = 'crm'  THEN c.nome
          WHEN wi.source_type = 'prep' THEN cp.nome
        END AS nome,
        CASE
          WHEN wi.source_type = 'crm'  THEN c.lotto
          WHEN wi.source_type = 'prep' THEN p.flacone
        END AS lotto_corrente,
        CASE
          WHEN wi.source_type = 'crm'  THEN c.data_dismissione
          WHEN wi.source_type = 'prep' THEN p.data_dismissione
        END AS data_dismissione,
        CASE WHEN wi.source_type = 'crm' THEN c.mix_id              END AS mix_id,
        CASE WHEN wi.source_type = 'crm' THEN c.forma_commerciale   END AS forma_commerciale,
        CASE
          WHEN wi.source_type = 'crm'  THEN c.scadenza_prodotto
          WHEN wi.source_type = 'prep' THEN p.scadenza
        END AS scadenza_prodotto,
        CASE WHEN wi.source_type = 'crm' THEN (
          SELECT MAX(nuova_scadenza) FROM composti_storia
          WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL
        ) END AS ultima_rivalidazione,
        cp.id AS prep_composto_id,
        cp.data_dismissione AS prep_composto_dismissione,
        cp.scadenza_prodotto AS prep_composto_scadenza
      FROM work_ingredienti wi
      LEFT JOIN composti c  ON wi.source_type = 'crm'  AND c.id  = wi.source_id
      LEFT JOIN preparazioni p  ON wi.source_type = 'prep' AND p.id  = COALESCE(wi.prep_id, wi.source_id)
      LEFT JOIN composti cp ON wi.source_type = 'prep' AND cp.id = p.composto_id
      WHERE wi.work_id = ? AND wi.source_type IN ('crm', 'prep')
    `).all(workId) as any[]

    const oggi = new Date().toISOString().slice(0, 10)

    const stmtSostitutiCrm = db.prepare(`
      SELECT id, lotto, concentrazione, unita_conc, mix_id
      FROM composti
      WHERE nome = ? AND data_dismissione IS NULL AND id != ?
        AND (
          scadenza_prodotto IS NULL OR scadenza_prodotto >= ?
          OR (
            SELECT MAX(nuova_scadenza) FROM composti_storia
            WHERE composto_id = composti.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL
          ) >= ?
        )
      ORDER BY id DESC
    `)

    const stmtSostitutiPrep = db.prepare(`
      SELECT p2.id AS id, p2.flacone AS lotto, p2.concentrazione_reale AS concentrazione,
        p2.unita_conc AS unita_conc, NULL AS mix_id
      FROM preparazioni p2
      WHERE p2.composto_id = ?
        AND p2.id != ?
        AND p2.data_dismissione IS NULL
        AND (p2.scadenza IS NULL OR p2.scadenza >= ?)
      ORDER BY p2.id DESC
    `)

    // Preparazioni valide di altri composti con lo stesso nome (caso: composto padre
    // dismesso/scaduto → nuovo lotto ha nuovo composto_id → servono le sue preparazioni).
    const stmtSostitutiPrepAltriComposti = db.prepare(`
      SELECT p2.id AS id, p2.flacone AS lotto, p2.concentrazione_reale AS concentrazione,
        p2.unita_conc AS unita_conc, NULL AS mix_id
      FROM preparazioni p2
      JOIN composti c2 ON c2.id = p2.composto_id
      WHERE c2.nome = ?
        AND c2.id != ?
        AND c2.data_dismissione IS NULL
        AND (
          c2.scadenza_prodotto IS NULL OR c2.scadenza_prodotto >= ?
          OR (
            SELECT MAX(nuova_scadenza) FROM composti_storia
            WHERE composto_id = c2.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL
          ) >= ?
        )
        AND p2.data_dismissione IS NULL
        AND (p2.scadenza IS NULL OR p2.scadenza >= ?)
      ORDER BY p2.id DESC
    `)

    return ingredienti.map((ing: any) => {
      if (ing.source_type === 'prep') {
        const prepId = ing.prep_id ?? ing.source_id
        const prepScaduto = !ing.data_dismissione &&
          ing.scadenza_prodotto && ing.scadenza_prodotto < oggi
        const compostoScaduto = !ing.prep_composto_dismissione &&
          ing.prep_composto_scadenza && ing.prep_composto_scadenza < oggi
        const compostoDismesso = !!ing.prep_composto_dismissione

        if (!ing.data_dismissione && !prepScaduto && !compostoScaduto && !compostoDismesso) {
          return { ...ing, stato: 'ok', sostituti: [] }
        }
        // 1) Preparazioni ancora valide sullo STESSO composto padre (rara: il composto
        //    è ancora OK ma il prep è scaduto/dismesso).
        let sostituti = stmtSostitutiPrep.all(ing.prep_composto_id, prepId, oggi) as any[]
        // 2) Se il composto padre è dismesso/scaduto (caso tipico della ricarica Neat),
        //    cerca preparazioni su composti diversi con lo stesso nome.
        if ((compostoDismesso || compostoScaduto) && sostituti.length === 0) {
          sostituti = stmtSostitutiPrepAltriComposti.all(
            ing.nome, ing.prep_composto_id, oggi, oggi, oggi
          ) as any[]
        }
        const stato =
          sostituti.length === 1 ? 'auto' :
          sostituti.length  >  1 ? 'ambiguo' : 'mancante'
        return { ...ing, stato, sostituti }
      }

      // source_type === 'crm'
      const isScaduto = !ing.data_dismissione &&
        ing.scadenza_prodotto && ing.scadenza_prodotto < oggi &&
        (!ing.ultima_rivalidazione || ing.ultima_rivalidazione < oggi)

      if (!ing.data_dismissione && !isScaduto) {
        return { ...ing, stato: 'ok', sostituti: [] }
      }
      const sostituti = stmtSostitutiCrm.all(ing.nome, ing.source_id, oggi, oggi) as any[]
      const stato =
        sostituti.length === 1 ? 'auto' :
        sostituti.length  >  1 ? 'ambiguo' : 'mancante'
      return { ...ing, stato, sostituti }
    })
  })

  // ── RICARICA: crea nuova work con lotti aggiornati, archivia la vecchia ───
  ipcMain.handle('work:ricarica', (_, params: {
    old_work_id: number
    nuovi_ingredienti: Array<{ old_source_id: number; new_source_id: number }>
    metodi_ids: string[]
  }) => {
    console.log('[work:ricarica] START params=', JSON.stringify(params))
    const db = getDb()
    const old = db.prepare('SELECT * FROM work WHERE id = ?').get(params.old_work_id) as any
    if (!old) throw new Error('Work non trovata')

    // Fallback: se il renderer non ha passato metodi_ids (o li ha passati vuoti),
    // recuperarli autonomamente da work_metodi per evitare che schema_json non venga aggiornato.
    if (!params.metodi_ids || params.metodi_ids.length === 0) {
      const rows = db.prepare('SELECT metodo_id FROM work_metodi WHERE work_id = ?').all(params.old_work_id) as any[]
      params = { ...params, metodi_ids: rows.map(r => String(r.metodo_id)) }
      console.log('[work:ricarica] metodi_ids era vuoto, recuperati dal DB:', params.metodi_ids)
    }

    const oldIngr = db.prepare(
      'SELECT * FROM work_ingredienti WHERE work_id = ?'
    ).all(params.old_work_id) as any[]

    // Mappa old_source_id → new_source_id
    const subst = new Map(params.nuovi_ingredienti.map(n => [n.old_source_id, n.new_source_id]))
    const getLotto = db.prepare('SELECT lotto FROM composti WHERE id = ?')

    let newId: number | bigint = 0
    try {
    db.transaction(() => {
      // Crea nuova work con gli stessi metadati
      const r = db.prepare(`
        INSERT INTO work (nome, concentrazione, conc_variabile, unita_conc,
          volume_ml, solvente, validita_mesi, operatore, note, livello)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        old.nome, old.concentrazione, old.conc_variabile, old.unita_conc,
        old.volume_ml, old.solvente, old.validita_mesi, old.operatore, old.note, old.livello
      )
      newId = r.lastInsertRowid

      // Copia ingredienti con source_id sostituiti e lotto_usato aggiornato
      const getPrepFlaconeR = db.prepare('SELECT flacone FROM preparazioni WHERE id = ?')
      for (const ing of oldIngr) {
        const newSrcId = subst.get(ing.source_id) ?? ing.source_id
        let lottoUsato: string | null = ing.lotto_usato
        if (ing.source_type === 'crm' && subst.has(ing.source_id)) {
          const c = getLotto.get(newSrcId) as any
          lottoUsato = c?.lotto ?? null
        }
        if (ing.source_type === 'prep') {
          const p = getPrepFlaconeR.get(newSrcId) as any
          lottoUsato = p?.flacone ?? ing.lotto_usato
          db.prepare(`
            INSERT INTO work_ingredienti
              (work_id, source_type, source_id, volume_prelievo_ml,
               fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato, prep_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newId, ing.source_type, newSrcId,
            ing.volume_prelievo_ml, ing.fattore_diluizione,
            ing.conc_target_mgL, ing.modo_calcolo, lottoUsato, newSrcId
          )
        } else {
          db.prepare(`
            INSERT INTO work_ingredienti
              (work_id, source_type, source_id, volume_prelievo_ml,
               fattore_diluizione, conc_target_mgL, modo_calcolo, lotto_usato)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newId, ing.source_type, newSrcId,
            ing.volume_prelievo_ml, ing.fattore_diluizione,
            ing.conc_target_mgL, ing.modo_calcolo, lottoUsato
          )
        }
      }

      // Archivia la vecchia work
      db.prepare(`
        UPDATE work SET
          archiviato = 1,
          archiviato_at = datetime('now'),
          archiviato_motivo = 'Lotti dismessi — sostituita da work ' || ?,
          sostituito_da_id = ?
        WHERE id = ?
      `).run(newId, newId, params.old_work_id)

      // Rileggi gli ingredienti della NUOVA work per rigenerare srcs/vols nello schema_json.
      // Senza questo, le frecce tra sorgenti e Work non vengono disegnate: i src.id nello
      // schema continuerebbero a puntare a mix_id/composto_id del lotto pre-ricarica.
      const newIngr = db.prepare(
        'SELECT * FROM work_ingredienti WHERE work_id = ?'
      ).all(newId) as any[]

      const getCompostoFull = db.prepare(
        'SELECT id, nome, mix_id, forma_commerciale, concentrazione FROM composti WHERE id = ?'
      )
      const getPrepFull = db.prepare(`
        SELECT p.id, p.composto_id, p.flacone,
          (SELECT COUNT(*) FROM preparazioni p2
           WHERE p2.composto_id = p.composto_id AND p2.id <= p.id) AS progressivo
        FROM preparazioni p WHERE p.id = ?
      `)

      // Costruisce srcs[] + vols[] dai nuovi ingredienti, replicando la logica di
      // ricostruisciWorkInSchema() lato renderer. Per source_type === 'work' richiede
      // di trovare la work dipendente nello stesso schema.workCols (l'id locale della card).
      function buildSrcsAndVols(workCols: any[][]): { srcs: any[]; vols: any[] } {
        const srcs: any[] = []
        const vols: any[] = []
        const seenMix = new Set<string>()
        for (const ing of newIngr) {
          if (ing.source_type === 'crm') {
            const c = getCompostoFull.get(ing.source_id) as any
            if (!c) continue
            if (c.mix_id) {
              // Dedup mix: una sola entry in srcs E in vols per mix_id
              // (altrimenti la "tabella volumi mini" mostra N righe identiche,
              // una per ogni componente del mix in work_ingredienti)
              if (seenMix.has(c.mix_id)) continue
              seenMix.add(c.mix_id)
              srcs.push({
                id: c.mix_id,
                nome: c.forma_commerciale ?? c.nome ?? '',
                cv: Number(c.concentrazione) || 0,
                tipo: 'mix',
              })
            } else {
              srcs.push({
                id: String(c.id),
                nome: c.nome ?? '',
                cv: Number(c.concentrazione) || 0,
                tipo: 'sng',
              })
            }
            vols.push({
              nome: c.mix_id ? (c.forma_commerciale ?? c.nome ?? '') : (c.nome ?? ''),
              vol: ing.volume_prelievo_ml ?? 0,
              concTarget: ing.conc_target_mgL ?? undefined,
              dilFactor: ing.fattore_diluizione ?? undefined,
              modo: ing.modo_calcolo ?? 'conc',
            })
          } else if (ing.source_type === 'work') {
            // Cerca la work dipendente nello schema per riemettere l'id locale della card
            let found: any | undefined
            let foundColIdx = -1
            for (let ci = 0; ci < workCols.length; ci++) {
              const wf = (workCols[ci] ?? []).find((w: any) => w.dbId === ing.source_id)
              if (wf) { found = wf; foundColIdx = ci; break }
            }
            if (!found) continue
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
            // La chiave della card nell'UI è `prep_<preparazioni.id>`
            // (vedi SchemaCalibrazione.grid.tsx: `prepKey = prep_${prep.id}`).
            // Quindi src.id deve essere `prep_<newPrepId>` altrimenti computeConnections
            // non trova la card sorgente e la freccia non viene disegnata.
            const prepId = Number(ing.prep_id ?? ing.source_id)
            const prep = getPrepFull.get(prepId) as any
            if (!prep) continue
            const c = getCompostoFull.get(prep.composto_id) as any
            if (!c) continue
            srcs.push({
              id: `prep_${prepId}`,
              nome: c.nome ?? '',
              cv: Number(c.concentrazione) || 0,
              tipo: 'prep',
              prepId,
              flacone: prep.flacone ?? null,
              progressivo: prep.progressivo ?? null,
              lotto: null,
            })
            vols.push({
              nome: c.nome ?? '',
              vol: ing.volume_prelievo_ml ?? 0,
              concTarget: ing.conc_target_mgL ?? undefined,
              dilFactor: ing.fattore_diluizione ?? undefined,
              modo: ing.modo_calcolo ?? 'conc',
            })
          }
        }
        return { srcs, vols }
      }

      // Collega in composti_metodi i nuovi CRM alla work_metodi → altrimenti
      // composti:list-for-schema non li restituirebbe e i CRM non comparirebbero come card.
      const newCrmIds = new Set<number>()
      for (const ing of newIngr) {
        if (ing.source_type === 'crm') newCrmIds.add(Number(ing.source_id))
      }
      const insertCompMet = db.prepare(
        'INSERT OR IGNORE INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
      )

      // Aggiorna schema_json e collega work_metodi SOLO per i metodi dove la vecchia work era presente
      // (evita di propagare entries spurie in work_metodi)
      for (const mid of params.metodi_ids) {
        const schemaRow = db.prepare('SELECT schema_json FROM schema_calibrazione WHERE metodo_id = ?').get(mid) as any
        if (!schemaRow) continue
        const schema = JSON.parse(schemaRow.schema_json)
        let changed = false
        const { srcs: newSrcs, vols: newVols } = buildSrcsAndVols(schema.workCols ?? [])
        for (const col of schema.workCols ?? []) {
          for (const w of col) {
            if (w.dbId === params.old_work_id) {
              w.dbId = Number(newId)
              w.srcs = newSrcs
              w.vols = newVols
              if (w.extraSrcs) delete w.extraSrcs
              changed = true
            }
          }
        }
        if (changed) {
          db.prepare("UPDATE schema_calibrazione SET schema_json = ?, updated_at = datetime('now') WHERE metodo_id = ?")
            .run(JSON.stringify(schema), mid)
          db.prepare('INSERT OR IGNORE INTO work_metodi (work_id, metodo_id) VALUES (?, ?)').run(newId, mid)
          for (const cid of newCrmIds) insertCompMet.run(cid, mid)
        }
        // else: la vecchia work non era nel schema di questo metodo → non creare link spuri
      }
    })()
    } catch (err) {
      console.error('[work:ricarica] ERRORE transazione:', err)
      throw err
    }

    console.log('[work:ricarica] OK new_work_id=', Number(newId))
    return { ok: true, new_work_id: Number(newId) }
  })

  // ── LIST-FOR-IMPORT: works importabili in un metodo ──
  // Regola: work non archiviata, appartenente a un metodo che condivide almeno un analita
  // con il metodo corrente. Il check "già nel schema" è delegato al renderer (schemaDbIds).
  // Non si esclude tramite work_metodi perché entries spurie bloccherebbero work importabili.
  ipcMain.handle('work:list-for-import', (_, metodoId: string) => {
    const db = getDb()
    const works = db.prepare(`
      SELECT DISTINCT w.*,
        (SELECT GROUP_CONCAT(wm.metodo_id) FROM work_metodi wm WHERE wm.work_id = w.id) AS metodi_csv,
        (SELECT COUNT(*) FROM work_ingredienti WHERE work_id = w.id) AS n_ingredienti
      FROM work w
      JOIN work_metodi wm_other ON wm_other.work_id = w.id
      JOIN metodo_analiti ma_other ON ma_other.metodo_id = wm_other.metodo_id
      JOIN metodo_analiti ma_cur   ON LOWER(ma_cur.nome) = LOWER(ma_other.nome)
                                   AND ma_cur.metodo_id = ?
      WHERE (w.archiviato = 0 OR w.archiviato IS NULL)
      ORDER BY w.created_at DESC
    `).all(metodoId) as any[]

    const stmtIngr = db.prepare(`
      SELECT wi.*,
        CASE
          WHEN wi.source_type = 'crm'  THEN (SELECT nome FROM composti WHERE id = wi.source_id)
          WHEN wi.source_type = 'work' THEN (SELECT nome FROM work    WHERE id = wi.source_id)
        END AS source_nome
      FROM work_ingredienti wi
      WHERE wi.work_id = ?
    `)

    const stmtMetodi = db.prepare(`
      SELECT m.id, m.nome FROM metodi m
      JOIN work_metodi wm ON wm.metodo_id = m.id
      WHERE wm.work_id = ?
    `)

    for (const w of works) {
      w.ingredienti = stmtIngr.all(w.id)
      w.metodi = stmtMetodi.all(w.id) as Array<{ id: string; nome: string }>
      w.metodi_ids = w.metodi_csv ? w.metodi_csv.split(',') : []
      delete w.metodi_csv
    }
    return works
  })

  // ── ADD-TO-METODO: collega una work esistente a un metodo ─────────────────
  ipcMain.handle('work:add-to-metodo', (_, workId: number, metodoId: string) => {
    getDb().prepare(
      'INSERT OR IGNORE INTO work_metodi (work_id, metodo_id) VALUES (?, ?)'
    ).run(workId, metodoId)
    return { ok: true }
  })

  // ── REMOVE-FROM-METODO: de-linka una work importata da un metodo (senza archiviare) ─
  ipcMain.handle('work:remove-from-metodo', (_, workId: number, metodoId: string) => {
    getDb().prepare(
      'DELETE FROM work_metodi WHERE work_id = ? AND metodo_id = ?'
    ).run(workId, metodoId)
    return { ok: true }
  })
}
