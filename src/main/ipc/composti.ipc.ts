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
    let sql = 'SELECT DISTINCT c.* FROM composti c'
    const params: unknown[] = []
    const conditions: string[] = []

    if (filters?.metodo_id) {
      sql += ' JOIN composti_metodi cm ON cm.composto_id = c.id'
      conditions.push('cm.metodo_id = ?')
      params.push(filters.metodo_id)
    }

    if (filters?.search) {
      conditions.push('(c.nome LIKE ? OR c.codice_interno LIKE ?)')
      params.push(`%${filters.search}%`, `%${filters.search}%`)
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
    sql += ' ORDER BY c.nome'

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

    // Costruisci un oggetto completo con tutti i campi della tabella, usando null per i campi mancanti
    const row = {
      nome: data.nome,
      codice_interno: data.codice_interno ?? null,
      formula: data.formula ?? null,
      classe: data.classe ?? null,
      forma: data.forma ?? null,
      forma_commerciale: data.forma_commerciale ?? null,
      purezza: data.purezza ?? null,
      concentrazione: data.concentrazione ?? null,
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
    }

    const cols = ['nome', 'codice_interno', 'formula', 'classe', 'forma', 'forma_commerciale',
      'purezza', 'concentrazione', 'solvente', 'fiala', 'produttore', 'lotto',
      'operatore_apertura', 'data_apertura', 'scadenza_prodotto', 'data_dismissione',
      'destinazione_uso', 'work_standard', 'matrice', 'peso_molecolare', 'ubicazione',
      'arpa', 'mix', 'mix_id']
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

    // Costruisci un oggetto completo con tutti i campi della tabella, usando null per i campi mancanti
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
    }

    const updateComposto = db.prepare(
      `UPDATE composti SET nome=@nome, codice_interno=@codice_interno, formula=@formula,
       classe=@classe, forma=@forma, forma_commerciale=@forma_commerciale,
       purezza=@purezza, concentrazione=@concentrazione, solvente=@solvente,
       fiala=@fiala, produttore=@produttore, lotto=@lotto,
       operatore_apertura=@operatore_apertura, data_apertura=@data_apertura,
       scadenza_prodotto=@scadenza_prodotto, data_dismissione=@data_dismissione,
       destinazione_uso=@destinazione_uso, work_standard=@work_standard,
       matrice=@matrice, peso_molecolare=@peso_molecolare, ubicazione=@ubicazione,
       arpa=@arpa, mix=@mix, mix_id=@mix_id,
       updated_at=datetime('now') WHERE id=@id`
    )
    const deleteLinks = db.prepare('DELETE FROM composti_metodi WHERE composto_id = ?')
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )

    db.transaction(() => {
      updateComposto.run(row)
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

  ipcMain.handle('composti:create-mix', (_, data: {
    forma_commerciale: string
    forma: string
    concentrazione: number | null
    solvente: string | null
    produttore: string | null
    lotto: string | null
    data_apertura: string | null
    scadenza_prodotto: string | null
    classe: string | null
    destinazione_uso: string | null
    nomi: string[]
  }) => {
    const db = getDb()
    const mix_id = 'mix_' + Date.now().toString(36)
    const cols = ['nome', 'codice_interno', 'formula', 'classe', 'forma', 'forma_commerciale',
      'purezza', 'concentrazione', 'solvente', 'fiala', 'produttore', 'lotto',
      'operatore_apertura', 'data_apertura', 'scadenza_prodotto', 'data_dismissione',
      'destinazione_uso', 'work_standard', 'matrice', 'peso_molecolare', 'ubicazione',
      'arpa', 'mix', 'mix_id']
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const insert = db.prepare(
      `INSERT INTO composti (${cols.join(', ')}) VALUES (${placeholders})`
    )

    const common = {
      codice_interno: null,
      formula: null,
      classe: data.classe || null,
      forma: data.forma || 'Solution',
      forma_commerciale: data.forma_commerciale,
      purezza: null,
      concentrazione: data.concentrazione,
      solvente: data.solvente || null,
      fiala: null,
      produttore: data.produttore || null,
      lotto: data.lotto || null,
      operatore_apertura: null,
      data_apertura: data.data_apertura || null,
      scadenza_prodotto: data.scadenza_prodotto || null,
      data_dismissione: null,
      destinazione_uso: data.destinazione_uso || null,
      work_standard: null,
      matrice: null,
      peso_molecolare: null,
      ubicazione: null,
      arpa: 'N',
      mix: data.forma_commerciale,
      mix_id,
    }

    const count = db.transaction(() => {
      for (const nome of data.nomi) {
        insert.run({ ...common, nome })
      }
      return data.nomi.length
    })()

    return { mix_id, count }
  })

  ipcMain.handle('composti:storia-add', (_, compostoId: number, data: { tipo: string; data: string; note?: string }) => {
    const result = getDb().prepare(
      'INSERT INTO composti_storia (composto_id, tipo, data, note) VALUES (?, ?, ?, ?)'
    ).run(compostoId, data.tipo, data.data, data.note || null)
    return { id: result.lastInsertRowid }
  })
}
