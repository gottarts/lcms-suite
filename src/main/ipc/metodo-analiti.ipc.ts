import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerMetodoAnalitiIpc(): void {
  ipcMain.handle('metodo-analiti:list', (_, metodoId: string) => {
    const db = getDb()
    // Verifica se le colonne extra esistono già (migrazione 018 potrebbe non essere ancora applicata)
    const cols = (db.prepare(`PRAGMA table_info(metodo_analiti)`).all() as { name: string }[]).map(r => r.name)
    const hasExtra = cols.includes('accreditato')
    const selectCols = hasExtra
      ? 'id, nome, ordine, accreditato, alias_strumento'
      : 'id, nome, ordine, 0 AS accreditato, NULL AS alias_strumento'
    return db.prepare(
      `SELECT ${selectCols} FROM metodo_analiti
       WHERE metodo_id = ?
       ORDER BY COALESCE(ordine, 9999), id ASC`
    ).all(metodoId)
  })

  ipcMain.handle('metodo-analiti:update', (_, id: number, patch: { accreditato?: number; alias_strumento?: string | null }) => {
    const db = getDb()
    const cols = (db.prepare(`PRAGMA table_info(metodo_analiti)`).all() as { name: string }[]).map(r => r.name)
    const fields: string[] = []
    const values: unknown[] = []
    if ('accreditato' in patch && cols.includes('accreditato')) { fields.push('accreditato = ?'); values.push(patch.accreditato) }
    if ('alias_strumento' in patch && cols.includes('alias_strumento')) { fields.push('alias_strumento = ?'); values.push(patch.alias_strumento ?? null) }
    if (fields.length === 0) return { ok: true }
    values.push(id)
    db.prepare(`UPDATE metodo_analiti SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { ok: true }
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
