import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerConsumabiliIpc(): void {
  ipcMain.handle('consumabili:list', (_, filters?: { tipo?: string }) => {
    const db = getDb()
    let sql = 'SELECT * FROM consumabili'
    const params: unknown[] = []

    if (filters?.tipo) {
      sql += ' WHERE tipo = ?'
      params.push(filters.tipo)
    }
    sql += ' ORDER BY data_apertura DESC'

    const items = db.prepare(sql).all(...params) as any[]
    const metodoStmt = db.prepare(
      'SELECT metodo_id FROM consumabili_metodi WHERE consumabile_id = ?'
    )
    for (const item of items) {
      item.metodi_ids = metodoStmt.all(item.id).map((r: any) => r.metodo_id)
    }
    return items
  })

  ipcMain.handle('consumabili:get', (_, id: number) => {
    const db = getDb()
    const item = db.prepare('SELECT * FROM consumabili WHERE id = ?').get(id) as any
    if (!item) return null
    item.metodi_ids = db.prepare(
      'SELECT metodo_id FROM consumabili_metodi WHERE consumabile_id = ?'
    ).all(id).map((r: any) => r.metodo_id)
    return item
  })

  ipcMain.handle('consumabili:create', (_, data: Record<string, unknown>) => {
    const db = getDb()
    const metodiIds = (data.metodi_ids as string[] | undefined) || []
    const itemData = { ...data }
    delete itemData.metodi_ids

    const insertItem = db.prepare(
      `INSERT INTO consumabili (tipo, nome, lotto, fornitore, data_apertura, data_chiusura, note)
       VALUES (@tipo, @nome, @lotto, @fornitore, @data_apertura, @data_chiusura, @note)`
    )
    const insertLink = db.prepare(
      'INSERT INTO consumabili_metodi (consumabile_id, metodo_id) VALUES (?, ?)'
    )

    let newId: number | bigint = 0
    db.transaction(() => {
      const result = insertItem.run(itemData)
      newId = result.lastInsertRowid
      for (const mid of metodiIds) {
        insertLink.run(newId, mid)
      }
    })()

    return db.prepare('SELECT * FROM consumabili WHERE id = ?').get(newId)
  })

  ipcMain.handle('consumabili:update', (_, id: number, data: Record<string, unknown>) => {
    const db = getDb()
    const metodiIds = (data.metodi_ids as string[] | undefined) || []
    const itemData = { ...data }
    delete itemData.metodi_ids

    const updateItem = db.prepare(
      `UPDATE consumabili SET tipo=@tipo, nome=@nome, lotto=@lotto, fornitore=@fornitore,
       data_apertura=@data_apertura, data_chiusura=@data_chiusura, note=@note,
       updated_at=datetime('now') WHERE id=@id`
    )
    const deleteLinks = db.prepare('DELETE FROM consumabili_metodi WHERE consumabile_id = ?')
    const insertLink = db.prepare(
      'INSERT INTO consumabili_metodi (consumabile_id, metodo_id) VALUES (?, ?)'
    )

    db.transaction(() => {
      updateItem.run({ ...itemData, id })
      deleteLinks.run(id)
      for (const mid of metodiIds) {
        insertLink.run(id, mid)
      }
    })()

    return db.prepare('SELECT * FROM consumabili WHERE id = ?').get(id)
  })

  ipcMain.handle('consumabili:close', (_, id: number) => {
    getDb().prepare(
      `UPDATE consumabili SET data_chiusura = date('now'), updated_at=datetime('now') WHERE id = ?`
    ).run(id)
    return { ok: true }
  })

  ipcMain.handle('consumabili:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM consumabili WHERE id = ?').run(id)
    return { ok: true }
  })
}
