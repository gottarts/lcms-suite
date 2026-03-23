import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerMetodoAnalitiIpc(): void {
  ipcMain.handle('metodo-analiti:list', (_, metodoId: string) => {
    return getDb().prepare(
      `SELECT id, nome, ordine FROM metodo_analiti
       WHERE metodo_id = ?
       ORDER BY COALESCE(ordine, 9999), id ASC`
    ).all(metodoId)
  })

  ipcMain.handle('metodo-analiti:add', (_, metodoId: string, nomi: string[]) => {
    const db = getDb()
    const insert = db.prepare(
      'INSERT OR IGNORE INTO metodo_analiti (metodo_id, nome) VALUES (?, ?)'
    )
    const getComposto = db.prepare(
      'SELECT id FROM composti WHERE LOWER(nome) = LOWER(?)'
    )
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )
    db.transaction(() => {
      for (const nome of nomi) {
        const trimmed = nome.trim()
        insert.run(metodoId, trimmed)
        // Se esiste un composto con questo nome, collega anche composti_metodi
        const composto = getComposto.get(trimmed) as { id: number } | undefined
        if (composto) insertLink.run(composto.id, metodoId)
      }
    })()
    return { ok: true }
  })

  ipcMain.handle('metodo-analiti:remove', (_, metodoId: string, nomi: string[]) => {
    const db = getDb()
    const delAnalita = db.prepare(
      'DELETE FROM metodo_analiti WHERE metodo_id = ? AND LOWER(nome) = LOWER(?)'
    )
    // Scollega dal metodo tutti i composti il cui nome corrisponde all'analita rimosso
    const delLinks = db.prepare(`
      DELETE FROM composti_metodi
      WHERE metodo_id = ?
        AND composto_id IN (
          SELECT id FROM composti WHERE LOWER(nome) = LOWER(?)
        )
    `)
    db.transaction(() => {
      for (const nome of nomi) {
        delAnalita.run(metodoId, nome)
        delLinks.run(metodoId, nome)
      }
    })()
    return { ok: true }
  })
}
