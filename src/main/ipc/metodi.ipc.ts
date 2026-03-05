import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerMetodiIpc(): void {
  ipcMain.handle('metodi:list', () => {
    return getDb().prepare(
      `SELECT m.*, s.codice AS strumento_codice
       FROM metodi m
       LEFT JOIN strumenti s ON s.id = m.strumento_id
       ORDER BY m.nome`
    ).all()
  })

  ipcMain.handle('metodi:get', (_, id: string) => {
    const metodo = getDb().prepare(
      `SELECT m.*, s.codice AS strumento_codice
       FROM metodi m
       LEFT JOIN strumenti s ON s.id = m.strumento_id
       WHERE m.id = ?`
    ).get(id)
    if (!metodo) return null
    const compostiIds = getDb().prepare(
      'SELECT composto_id FROM composti_metodi WHERE metodo_id = ?'
    ).all(id).map((r: any) => r.composto_id)
    return { ...metodo, composti_ids: compostiIds }
  })

  ipcMain.handle('metodi:create', (_, data: Record<string, unknown>) => {
    const db = getDb()
    const compostiIds = (data.composti_ids as number[] | undefined) || []
    const metodoData = { ...data }
    delete metodoData.composti_ids

    const insertMetodo = db.prepare(
      `INSERT INTO metodi (id, nome, strumento_id, matrice, colonna, fase_a, fase_b,
       gradiente, flusso, ionizzazione, polarita, acquisizione, srm, lims_id, oqlab_id, note)
       VALUES (@id, @nome, @strumento_id, @matrice, @colonna, @fase_a, @fase_b,
       @gradiente, @flusso, @ionizzazione, @polarita, @acquisizione, @srm, @lims_id, @oqlab_id, @note)`
    )
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )

    db.transaction(() => {
      insertMetodo.run(metodoData)
      for (const cid of compostiIds) {
        insertLink.run(cid, data.id)
      }
    })()

    return db.prepare('SELECT * FROM metodi WHERE id = ?').get(data.id)
  })

  ipcMain.handle('metodi:update', (_, id: string, data: Record<string, unknown>) => {
    const db = getDb()
    const compostiIds = (data.composti_ids as number[] | undefined) || []
    const metodoData = { ...data }
    delete metodoData.composti_ids

    const updateMetodo = db.prepare(
      `UPDATE metodi SET nome=@nome, strumento_id=@strumento_id, matrice=@matrice,
       colonna=@colonna, fase_a=@fase_a, fase_b=@fase_b, gradiente=@gradiente,
       flusso=@flusso, ionizzazione=@ionizzazione, polarita=@polarita,
       acquisizione=@acquisizione, srm=@srm, lims_id=@lims_id, oqlab_id=@oqlab_id,
       note=@note, updated_at=datetime('now') WHERE id=@id`
    )
    const deleteLinks = db.prepare('DELETE FROM composti_metodi WHERE metodo_id = ?')
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )

    db.transaction(() => {
      updateMetodo.run({ ...metodoData, id })
      deleteLinks.run(id)
      for (const cid of compostiIds) {
        insertLink.run(cid, id)
      }
    })()

    return db.prepare('SELECT * FROM metodi WHERE id = ?').get(id)
  })

  ipcMain.handle('metodi:delete', (_, id: string) => {
    getDb().prepare('DELETE FROM metodi WHERE id = ?').run(id)
    return { ok: true }
  })
}
