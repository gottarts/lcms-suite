import { ipcMain } from 'electron'
import { getDb } from '../db'
import { snapshotMetodoAnaliti } from './metodo-analiti-snapshot'

export function registerMetodoAnalitiIpc(): void {
  ipcMain.handle('metodo-analiti:list', (_, metodoId: string) => {
    const db = getDb()
    // Verifica se le colonne extra esistono già (migrazione 018 potrebbe non essere ancora applicata)
    const cols = (db.prepare(`PRAGMA table_info(metodo_analiti)`).all() as { name: string }[]).map(r => r.name)
    const hasExtra = cols.includes('accreditato')
    const hasAliasLims = cols.includes('alias_lims')
    const selectCols = hasExtra
      ? `id, nome, ordine, accreditato, alias_strumento${hasAliasLims ? ', alias_lims, alias_oqlab' : ', NULL AS alias_lims, NULL AS alias_oqlab'}`
      : 'id, nome, ordine, 0 AS accreditato, NULL AS alias_strumento, NULL AS alias_lims, NULL AS alias_oqlab'
    return db.prepare(
      `SELECT ${selectCols} FROM metodo_analiti
       WHERE metodo_id = ?
       ORDER BY COALESCE(ordine, 9999), id ASC`
    ).all(metodoId)
  })

  ipcMain.handle('metodo-analiti:update', (_, id: number, patch: { accreditato?: number; alias_strumento?: string | null; alias_lims?: string | null; alias_oqlab?: string | null }) => {
    const db = getDb()
    const cols = (db.prepare(`PRAGMA table_info(metodo_analiti)`).all() as { name: string }[]).map(r => r.name)
    const fields: string[] = []
    const values: unknown[] = []
    if ('accreditato' in patch && cols.includes('accreditato')) { fields.push('accreditato = ?'); values.push(patch.accreditato) }
    if ('alias_strumento' in patch && cols.includes('alias_strumento')) { fields.push('alias_strumento = ?'); values.push(patch.alias_strumento ?? null) }
    if ('alias_lims' in patch && cols.includes('alias_lims')) { fields.push('alias_lims = ?'); values.push(patch.alias_lims ?? null) }
    if ('alias_oqlab' in patch && cols.includes('alias_oqlab')) { fields.push('alias_oqlab = ?'); values.push(patch.alias_oqlab ?? null) }
    if (fields.length === 0) return { ok: true }
    values.push(id)
    db.transaction(() => {
      db.prepare(`UPDATE metodo_analiti SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      const row = db.prepare('SELECT metodo_id FROM metodo_analiti WHERE id = ?').get(id) as { metodo_id: string } | undefined
      if (row) snapshotMetodoAnaliti(db, row.metodo_id, 'update')
    })()
    return { ok: true }
  })

  ipcMain.handle('metodo-analiti:bulk-set-accreditato', (_, metodoId: string, nomi: string[] | 'all', accreditato: 0 | 1) => {
    const db = getDb()
    db.transaction(() => {
      if (nomi === 'all') {
        db.prepare('UPDATE metodo_analiti SET accreditato = ? WHERE metodo_id = ?').run(accreditato, metodoId)
      } else if (nomi.length > 0) {
        const placeholders = nomi.map(() => 'LOWER(?)').join(', ')
        db.prepare(`UPDATE metodo_analiti SET accreditato = ? WHERE metodo_id = ? AND LOWER(nome) IN (${placeholders})`).run(accreditato, metodoId, ...nomi.map(n => n.toLowerCase()))
      }
      snapshotMetodoAnaliti(db, metodoId, 'bulk-accreditato')
    })()
    return { ok: true }
  })

  ipcMain.handle('metodo-analiti:bulk-update-alias', (_, metodoId: string, updates: Array<{ nome: string; alias_lims?: string | null; alias_oqlab?: string | null; alias_strumento?: string | null }>) => {
    const db = getDb()
    const cols = (db.prepare(`PRAGMA table_info(metodo_analiti)`).all() as { name: string }[]).map(r => r.name)
    db.transaction(() => {
      for (const u of updates) {
        const fields: string[] = []
        const values: unknown[] = []
        if ('alias_lims' in u && cols.includes('alias_lims')) { fields.push('alias_lims = ?'); values.push(u.alias_lims ?? null) }
        if ('alias_oqlab' in u && cols.includes('alias_oqlab')) { fields.push('alias_oqlab = ?'); values.push(u.alias_oqlab ?? null) }
        if ('alias_strumento' in u && cols.includes('alias_strumento')) { fields.push('alias_strumento = ?'); values.push(u.alias_strumento ?? null) }
        if (fields.length === 0) continue
        values.push(metodoId, u.nome)
        db.prepare(`UPDATE metodo_analiti SET ${fields.join(', ')} WHERE metodo_id = ? AND LOWER(nome) = LOWER(?)`).run(...values)
      }
      snapshotMetodoAnaliti(db, metodoId, 'bulk-alias')
    })()
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
        insert.run(metodoId, trimmed.toUpperCase())
        // Se esiste un composto con questo nome, collega anche composti_metodi
        const composto = getComposto.get(trimmed) as { id: number } | undefined
        if (composto) insertLink.run(composto.id, metodoId)
      }
      snapshotMetodoAnaliti(db, metodoId, 'add')
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
      snapshotMetodoAnaliti(db, metodoId, 'remove')
    })()
    return { ok: true }
  })

  ipcMain.handle('metodo-analiti:versioni', (_, metodoId: string) => {
    const db = getDb()
    return db.prepare(`
      SELECT id, metodo_id, snapshot, motivo, created_at
      FROM metodo_analiti_versioni
      WHERE metodo_id = ?
      ORDER BY created_at DESC
    `).all(metodoId)
  })
}
