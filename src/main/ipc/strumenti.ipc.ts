import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerStrumentiIpc(): void {
  ipcMain.handle('strumenti:list', () => {
    return getDb().prepare('SELECT * FROM strumenti ORDER BY codice').all()
  })

  ipcMain.handle('strumenti:get', (_, id: string) => {
    return getDb().prepare('SELECT * FROM strumenti WHERE id = ?').get(id)
  })

  ipcMain.handle('strumenti:create', (_, data: Record<string, unknown>) => {
    const stmt = getDb().prepare(
      `INSERT INTO strumenti (id, codice, tipo, seriale, status)
       VALUES (@id, @codice, @tipo, @seriale, @status)`
    )
    stmt.run(data)
    return getDb().prepare('SELECT * FROM strumenti WHERE id = ?').get(data.id)
  })

  ipcMain.handle('strumenti:update', (_, id: string, data: Record<string, unknown>) => {
    getDb().prepare(
      `UPDATE strumenti SET codice=@codice, tipo=@tipo, seriale=@seriale, status=@status,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...data, id })
    return getDb().prepare('SELECT * FROM strumenti WHERE id = ?').get(id)
  })

  ipcMain.handle('strumenti:delete', (_, id: string) => {
    getDb().prepare('DELETE FROM strumenti WHERE id = ?').run(id)
    return { ok: true }
  })
}
