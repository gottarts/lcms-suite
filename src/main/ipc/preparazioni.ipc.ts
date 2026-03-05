import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerPreparazioniIpc(): void {
  ipcMain.handle('preparazioni:list', (_, compostoId: number) => {
    return getDb().prepare(
      'SELECT * FROM preparazioni WHERE composto_id = ? ORDER BY data_prep DESC'
    ).all(compostoId)
  })

  ipcMain.handle('preparazioni:create', (_, data: Record<string, unknown>) => {
    const result = getDb().prepare(
      `INSERT INTO preparazioni (composto_id, flacone, concentrazione, solvente, data_prep, scadenza, operatore, note)
       VALUES (@composto_id, @flacone, @concentrazione, @solvente, @data_prep, @scadenza, @operatore, @note)`
    ).run(data)
    return getDb().prepare('SELECT * FROM preparazioni WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('preparazioni:update', (_, id: number, data: Record<string, unknown>) => {
    getDb().prepare(
      `UPDATE preparazioni SET flacone=@flacone, concentrazione=@concentrazione,
       solvente=@solvente, data_prep=@data_prep, scadenza=@scadenza,
       operatore=@operatore, note=@note WHERE id=@id`
    ).run({ ...data, id })
    return getDb().prepare('SELECT * FROM preparazioni WHERE id = ?').get(id)
  })

  ipcMain.handle('preparazioni:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM preparazioni WHERE id = ?').run(id)
    return { ok: true }
  })
}
