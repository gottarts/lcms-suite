import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerCompostiIpc(): void {
  ipcMain.handle('composti:list', (_, filters?: {
    search?: string
    classe?: string
    forma?: string
    metodo_id?: string
  }) => {
    const db = getDb()
    let sql = `SELECT c.*,
  COUNT(CASE WHEN p.stato = 'Attiva' THEN 1 END) AS prep_attive_count,
  COUNT(CASE WHEN p.stato = 'Attiva' AND p.scadenza < date('now') THEN 1 END) AS prep_scadute_count,
  COUNT(CASE WHEN cs.tipo = 'apertura_fiala' THEN 1 END) AS fiale_aperte_count,
   (SELECT MAX(nuova_scadenza) FROM composti_storia
   WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) AS ultima_rivalidazione,
  (SELECT GROUP_CONCAT(metodo_id) FROM composti_metodi WHERE composto_id = c.id) AS metodi_ids_raw
FROM composti c
LEFT JOIN preparazioni p ON p.composto_id = c.id
LEFT JOIN composti_storia cs ON cs.composto_id = c.id`
    const params: unknown[] = []
    const conditions: string[] = []

    if (filters?.metodo_id) {
      sql += ' JOIN composti_metodi cm ON cm.composto_id = c.id'
      conditions.push('cm.metodo_id = ?')
      params.push(filters.metodo_id)
    }

    if (filters?.classe) {
      conditions.push('c.classe = ?')
      params.push(filters.classe)
    }
    if (filters?.forma) {
      conditions.push('c.forma = ?')
      params.push(filters.forma)
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' GROUP BY c.id ORDER BY c.id ASC'

    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('composti:get', (_, id: number) => {
    const db = getDb()
    const composto = db.prepare('SELECT * FROM composti WHERE id = ?').get(id)
    if (!composto) return null

    const metodi_ids = db.prepare(
      'SELECT metodo_id FROM composti_metodi WHERE composto_id = ?'
    ).all(id).map((r: any) => r.metodo_id)

    const storia = db.prepare(
      'SELECT * FROM composti_storia WHERE composto_id = ? ORDER BY data DESC'
    ).all(id)

    const preparazioni = db.prepare(
      'SELECT * FROM preparazioni WHERE composto_id = ? ORDER BY data_prep DESC'
    ).all(id)

    return { ...composto, metodi_ids, storia, preparazioni }
  })

  ipcMain.handle('composti:create', (_, data: Record<string, unknown>) => {
    const db = getDb()
    const metodiIds = (data.metodi_ids as string[] | undefined) || []
    delete data.metodi_ids

    const row = {
      nome: data.nome,
      codice_interno: data.codice_interno ?? null,
      formula: data.formula ?? null,
      classe: data.classe ?? null,
      forma: data.forma ?? null,
      forma_commerciale: data.forma_commerciale ?? null,
      purezza: data.purezza ?? null,
      concentrazione: data.concentrazione ?? null,
      unita_conc: (data.unita_conc as string) ?? 'mg/L',
      solvente: data.solvente ?? null,
      fiala: data.fiala ?? null,
      produttore: data.produttore ?? null,
      lotto: data.lotto ?? null,
      operatore_apertura: data.operatore_apertura ?? null,
      data_apertura: data.data_apertura ?? null,
      scadenza_prodotto: data.scadenza_prodotto ?? null,
      data_dismissione: data.data_dismissione ?? null,
      destinazione_uso: data.destinazione_uso ?? null,
      work_standard: data.work_standard ?? null,
      matrice: data.matrice ?? null,
      peso_molecolare: data.peso_molecolare ?? null,
      ubicazione: data.ubicazione ?? null,
      arpa: data.arpa ?? 'N',
      mix: data.mix ?? null,
      mix_id: data.mix_id ?? null,
      stoccaggio: data.stoccaggio ?? null,
      accreditamento_crm: data.accreditamento_crm ?? null,
      volume_ml: data.volume_ml ?? null,
    }

    const cols = ['nome', 'codice_interno', 'formula', 'classe', 'forma', 'forma_commerciale',
      'purezza', 'concentrazione', 'unita_conc', 'solvente', 'fiala', 'produttore', 'lotto',
      'operatore_apertura', 'data_apertura', 'scadenza_prodotto', 'data_dismissione',
      'destinazione_uso', 'work_standard', 'matrice', 'peso_molecolare', 'ubicazione',
      'arpa', 'mix', 'mix_id', 'stoccaggio', 'accreditamento_crm', 'volume_ml']
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const insertComposto = db.prepare(
      `INSERT INTO composti (${cols.join(', ')}) VALUES (${placeholders})`
    )
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )

    let newId: number | bigint = 0
    db.transaction(() => {
      const result = insertComposto.run(row)
      newId = result.lastInsertRowid
      for (const mid of metodiIds) {
        insertLink.run(newId, mid)
      }
    })()

    return db.prepare('SELECT * FROM composti WHERE id = ?').get(newId)
  })

  ipcMain.handle('composti:update', (_, id: number, data: Record<string, unknown>) => {
    const db = getDb()
    const metodiIds = (data.metodi_ids as string[] | undefined) || []
    delete data.metodi_ids

    const row = {
      id,
      nome: data.nome,
      codice_interno: data.codice_interno ?? null,
      formula: data.formula ?? null,
      classe: data.classe ?? null,
      forma: data.forma ?? null,
      forma_commerciale: data.forma_commerciale ?? null,
      purezza: data.purezza ?? null,
      concentrazione: data.concentrazione ?? null,
      unita_conc: (data.unita_conc as string) ?? 'mg/L',
      solvente: data.solvente ?? null,
      fiala: data.fiala ?? null,
      produttore: data.produttore ?? null,
      lotto: data.lotto ?? null,
      operatore_apertura: data.operatore_apertura ?? null,
      data_apertura: data.data_apertura ?? null,
      scadenza_prodotto: data.scadenza_prodotto ?? null,
      data_dismissione: data.data_dismissione ?? null,
      destinazione_uso: data.destinazione_uso ?? null,
      work_standard: data.work_standard ?? null,
      matrice: data.matrice ?? null,
      peso_molecolare: data.peso_molecolare ?? null,
      ubicazione: data.ubicazione ?? null,
      arpa: data.arpa ?? 'N',
      mix: data.mix ?? null,
      mix_id: data.mix_id ?? null,
      stoccaggio: data.stoccaggio ?? null,
      accreditamento_crm: data.accreditamento_crm ?? null,
      volume_ml: data.volume_ml ?? null,
    }

    const updateComposto = db.prepare(
      `UPDATE composti SET nome=@nome, codice_interno=@codice_interno, formula=@formula,
       classe=@classe, forma=@forma, forma_commerciale=@forma_commerciale,
       purezza=@purezza, concentrazione=@concentrazione, unita_conc=@unita_conc, solvente=@solvente,
       fiala=@fiala, produttore=@produttore, lotto=@lotto,
       operatore_apertura=@operatore_apertura, data_apertura=@data_apertura,
       scadenza_prodotto=@scadenza_prodotto, data_dismissione=@data_dismissione,
       destinazione_uso=@destinazione_uso, work_standard=@work_standard,
       matrice=@matrice, peso_molecolare=@peso_molecolare, ubicazione=@ubicazione,
       arpa=@arpa, mix=@mix, mix_id=@mix_id,
       stoccaggio=@stoccaggio, accreditamento_crm=@accreditamento_crm,
       volume_ml=@volume_ml,
       updated_at=datetime('now') WHERE id=@id`
    )
    const deleteLinks = db.prepare('DELETE FROM composti_metodi WHERE composto_id = ?')
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )

    // Legge il vecchio lotto PRIMA dell'update, serve per LOTTO-SYNC
    const vecchioLotto = row.mix_id
      ? (db.prepare('SELECT lotto FROM composti WHERE id = ?').get(id) as any)?.lotto ?? null
      : null

    db.transaction(() => {
      updateComposto.run(row)

      if (row.fiala !== undefined && row.fiala !== null && row.lotto && !row.mix_id) {
        db.prepare('UPDATE composti SET fiala = ? WHERE lotto = ? AND id != ?')
          .run(row.fiala, row.lotto, id)
      }

      if (row.mix_id) {
        // MIX-SYNC: propaga solo i campi comuni a tutti i composti del mix.
        // I campi per-riga (lotto, scadenza_prodotto, data_apertura, produttore,
        // forma_commerciale) NON vengono toccati — ogni composto ha il suo valore.
        db.prepare(`
          UPDATE composti SET
            codice_interno      = ?,
            concentrazione      = ?,
            unita_conc          = ?,
            solvente            = ?,
            fiala               = ?,
            operatore_apertura  = ?,
            classe              = ?,
            destinazione_uso    = ?,
            work_standard       = ?,
            ubicazione          = ?,
            stoccaggio          = ?,
            accreditamento_crm  = ?,
            volume_ml           = ?,
            arpa                = ?,
            updated_at          = datetime('now')
          WHERE mix_id = ? AND id != ?
        `).run(
          row.codice_interno, row.concentrazione, row.unita_conc,
          row.solvente, row.fiala, row.operatore_apertura,
          row.classe, row.destinazione_uso,
          row.work_standard, row.ubicazione, row.stoccaggio, row.accreditamento_crm,
          row.volume_ml, row.arpa, row.mix_id, id
        )

        // LOTTO-SYNC: se il lotto è cambiato, aggiorna tutti i composti del mix
        // che avevano il vecchio lotto con il nuovo valore.
        if (row.lotto !== vecchioLotto && row.lotto) {
          db.prepare(
            'UPDATE composti SET lotto = ?, updated_at = datetime(\'now\') WHERE mix_id = ? AND lotto = ? AND id != ?'
          ).run(row.lotto, row.mix_id, vecchioLotto, id)
        }

        const altriIds = db.prepare(
          'SELECT id FROM composti WHERE mix_id = ? AND id != ?'
        ).all(row.mix_id, id) as { id: number }[]

        const deleteLinksMix = db.prepare('DELETE FROM composti_metodi WHERE composto_id = ?')
        const insertLinkMix = db.prepare(
          'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
        )
        for (const altro of altriIds) {
          deleteLinksMix.run(altro.id)
          for (const mid of metodiIds) {
            insertLinkMix.run(altro.id, mid)
          }
        }
      }

      deleteLinks.run(id)
      for (const mid of metodiIds) {
        insertLink.run(id, mid)
      }
    })()

    return db.prepare('SELECT * FROM composti WHERE id = ?').get(id)
  })

  ipcMain.handle('composti:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM composti WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('composti:count-by-lotto', (_, id: number) => {
    const db = getDb()
    const row = db.prepare('SELECT lotto, mix_id FROM composti WHERE id = ?').get(id) as any
    if (!row || !row.lotto || !row.mix_id) return { count: 1, lotto: null }
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM composti WHERE lotto = ?'
    ).get(row.lotto) as any
    return { count: result.count, lotto: row.lotto }
  })

  ipcMain.handle('composti:delete-by-lotto', (_, lotto: string) => {
    getDb().prepare('DELETE FROM composti WHERE lotto = ?').run(lotto)
    return { ok: true }
  })

  ipcMain.handle('composti:count-by-mix', (_, mix_id: string) => {
    const result = getDb().prepare(
      'SELECT COUNT(*) as count FROM composti WHERE mix_id = ?'
    ).get(mix_id) as { count: number }
    return result?.count ?? 0
  })

  ipcMain.handle('composti:create-mix', (_, data: {
    forma_commerciale: string
    forma: string
    concentrazione: number | null
    unita_conc?: string
    solvente: string | null
    produttore: string | null
    lotto: string | null
    data_apertura: string | null
    scadenza_prodotto: string | null
    classe: string | null
    destinazione_uso: string | null
    ubicazione?: string | null
    work_standard?: string | null
    volume_ml?: number | null
    fiala?: string | null
    codice_interno?: string | null
    operatore_apertura?: string | null
    metodi_ids?: string[]
    // Supporta sia il vecchio formato (nomi: string[]) che il nuovo (componenti: Array<{...}>)
    nomi?: string[]
    componenti?: Array<{
      nome: string
      forma_commerciale?: string | null
      lotto?: string | null
      scadenza_prodotto?: string | null
      data_apertura?: string | null
      produttore?: string | null
    }>
  }) => {
    const db = getDb()
    const mix_id = 'mix_' + Date.now().toString(36)
    const metodiIds = data.metodi_ids || []

    const cols = ['nome', 'codice_interno', 'formula', 'classe', 'forma', 'forma_commerciale',
      'purezza', 'concentrazione', 'unita_conc', 'solvente', 'fiala', 'produttore', 'lotto',
      'operatore_apertura', 'data_apertura', 'scadenza_prodotto', 'data_dismissione',
      'destinazione_uso', 'work_standard', 'matrice', 'peso_molecolare', 'ubicazione',
      'arpa', 'mix', 'mix_id', 'stoccaggio', 'accreditamento_crm', 'volume_ml']
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const insert = db.prepare(
      `INSERT INTO composti (${cols.join(', ')}) VALUES (${placeholders})`
    )
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )

    // Campi comuni a tutti i composti del mix (fallback se non specificati per riga)
    const common = {
      codice_interno: data.codice_interno || null,
      formula: null,
      classe: data.classe || null,
      forma: data.forma || 'Solution',
      forma_commerciale: data.forma_commerciale,
      purezza: null,
      concentrazione: data.concentrazione,
      unita_conc: (data.unita_conc as string) ?? 'mg/L',
      solvente: data.solvente || null,
      fiala: data.fiala ?? null,
      produttore: data.produttore || null,
      lotto: data.lotto || null,
      operatore_apertura: data.operatore_apertura || null,
      data_apertura: data.data_apertura || null,
      scadenza_prodotto: data.scadenza_prodotto || null,
      data_dismissione: null,
      destinazione_uso: data.destinazione_uso || null,
      work_standard: data.work_standard || null,
      matrice: null,
      peso_molecolare: null,
      ubicazione: data.ubicazione || null,
      arpa: 'N',
      mix: data.forma_commerciale,
      mix_id,
      stoccaggio: null,
      accreditamento_crm: null,
      volume_ml: data.volume_ml ?? null,
    }

    // Normalizza input: accetta sia componenti (nuovo, per-riga) che nomi (vecchio, .txt)
    const componenti: Array<{
      nome: string
      forma_commerciale?: string | null
      lotto?: string | null
      scadenza_prodotto?: string | null
      data_apertura?: string | null
      produttore?: string | null
    }> = data.componenti
      ? data.componenti
      : (data.nomi || []).map(nome => ({ nome }))

    const count = db.transaction(() => {
      for (const comp of componenti) {
        const row = {
          ...common,
          nome: comp.nome,
          // I valori per-riga sovrascrivono i comuni se presenti
          forma_commerciale: comp.forma_commerciale ?? common.forma_commerciale,
          mix:               comp.forma_commerciale ?? common.forma_commerciale,
          lotto:             comp.lotto             ?? common.lotto,
          scadenza_prodotto: comp.scadenza_prodotto ?? common.scadenza_prodotto,
          data_apertura:     comp.data_apertura     ?? common.data_apertura,
          produttore:        comp.produttore        ?? common.produttore,
        }
        const result = insert.run(row)
        const newId = result.lastInsertRowid
        for (const mid of metodiIds) {
          insertLink.run(newId, mid)
        }
      }
      return componenti.length
    })()

    return { mix_id, count }
  })

  ipcMain.handle('composti:storia-add', (_, compostoId: number, data: {
    tipo: string
    data: string
    note?: string
    n_registro_qc?: string
    batch_analitico?: string
    lotto_crm_valido?: string
    nuova_scadenza?: string
  }) => {
    const db = getDb()
    const result = db.prepare(
      `INSERT INTO composti_storia
         (composto_id, tipo, data, note, n_registro_qc, batch_analitico, lotto_crm_valido, nuova_scadenza)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      compostoId, data.tipo, data.data, data.note || null,
      data.n_registro_qc || null, data.batch_analitico || null,
      data.lotto_crm_valido || null, data.nuova_scadenza || null
    )

    if (data.tipo === 'Dismissione') {
      const comp = db.prepare('SELECT mix_id FROM composti WHERE id = ?').get(compostoId) as { mix_id: string | null } | undefined
      if (comp?.mix_id) {
        db.prepare(
          `UPDATE composti SET data_dismissione = ?, updated_at = datetime('now') WHERE mix_id = ?`
        ).run(data.data, comp.mix_id)
      } else {
        db.prepare(
          `UPDATE composti SET data_dismissione = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(data.data, compostoId)
      }
    }

    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('composti:lotti-validi', (_, compostoId: number) => {
    const db = getDb()
    const corrente = db.prepare('SELECT nome FROM composti WHERE id = ?').get(compostoId) as any
    if (!corrente) return []

    const oggi = new Date().toISOString().split('T')[0]

    return db.prepare(`
      SELECT id, nome, lotto, scadenza_prodotto, produttore, forma_commerciale
      FROM composti
      WHERE LOWER(nome) = LOWER(?)
        AND id != ?
        AND (data_dismissione IS NULL OR data_dismissione = '')
        AND (scadenza_prodotto IS NULL OR scadenza_prodotto > ?)
      ORDER BY scadenza_prodotto DESC
    `).all(corrente.nome, compostoId, oggi)
  })

  ipcMain.handle('composti:export-data', (_, scope: 'all' | 'filtered', ids?: number[]) => {
    const db = getDb()

    const composti = scope === 'filtered' && ids && ids.length > 0
      ? ids.map(id => db.prepare('SELECT * FROM composti WHERE id = ?').get(id)).filter(Boolean)
      : db.prepare('SELECT * FROM composti ORDER BY nome ASC').all()

    const result = (composti as any[]).map(c => {
      const storia = db.prepare(
        'SELECT * FROM composti_storia WHERE composto_id = ? ORDER BY data ASC'
      ).all(c.id)
      const preparazioni = db.prepare(
        'SELECT * FROM preparazioni WHERE composto_id = ? ORDER BY data_prep ASC'
      ).all(c.id)
      const metodi = db.prepare(`
        SELECT m.nome FROM metodi m
        INNER JOIN composti_metodi cm ON cm.metodo_id = m.id
        WHERE cm.composto_id = ?
        ORDER BY m.nome ASC
      `).all(c.id) as { nome: string }[]
      return { ...c, storia, preparazioni, metodi }
    })

    return result
  })
}