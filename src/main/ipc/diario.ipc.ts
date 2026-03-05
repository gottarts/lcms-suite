import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerDiarioIpc(): void {
  ipcMain.handle('diario:list', (_, strumentoId: string, metodoId?: string) => {
    const db = getDb()
    let sql = `SELECT d.*, m.nome AS metodo_nome
               FROM diario d
               LEFT JOIN metodi m ON m.id = d.metodo_id
               WHERE d.strumento_id = ?`
    const params: unknown[] = [strumentoId]

    if (metodoId) {
      sql += ' AND d.metodo_id = ?'
      params.push(metodoId)
    }
    sql += ' ORDER BY d.data DESC, d.created_at DESC'

    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('diario:create', (_, data: Record<string, unknown>) => {
    const result = getDb().prepare(
      `INSERT INTO diario (strumento_id, metodo_id, data, autore, testo)
       VALUES (@strumento_id, @metodo_id, @data, @autore, @testo)`
    ).run(data)
    return getDb().prepare('SELECT * FROM diario WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('diario:update', (_, id: number, data: Record<string, unknown>) => {
    getDb().prepare(
      `UPDATE diario SET metodo_id=@metodo_id, data=@data, autore=@autore, testo=@testo
       WHERE id=@id`
    ).run({ ...data, id })
    return getDb().prepare('SELECT * FROM diario WHERE id = ?').get(id)
  })

  ipcMain.handle('diario:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM diario WHERE id = ?').run(id)
    return { ok: true }
  })
}
