import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerEluentiIpc(): void {
  ipcMain.handle('eluenti:list', (_, strumentoId: string) => {
    const db = getDb()
    const eluenti = db.prepare(
      'SELECT * FROM eluenti WHERE strumento_id = ? ORDER BY data_inizio DESC'
    ).all(strumentoId) as any[]
    for (const e of eluenti) {
      e.componenti = db.prepare(
        'SELECT * FROM eluenti_componenti WHERE eluente_id = ?'
      ).all(e.id)
    }
    return eluenti
  })

  ipcMain.handle('eluenti:create', (_, data: {
    strumento_id: string
    nome: string
    data_inizio: string
    componenti: { sostanza: string; lotto: string; fornitore: string }[]
  }) => {
    const db = getDb()
    const id = crypto.randomUUID()

    const insertEluente = db.prepare(
      `INSERT INTO eluenti (id, strumento_id, nome, data_inizio)
       VALUES (?, ?, ?, ?)`
    )
    const insertComp = db.prepare(
      `INSERT INTO eluenti_componenti (eluente_id, sostanza, lotto, fornitore)
       VALUES (?, ?, ?, ?)`
    )

    db.transaction(() => {
      insertEluente.run(id, data.strumento_id, data.nome, data.data_inizio)
      for (const c of data.componenti) {
        insertComp.run(id, c.sostanza, c.lotto, c.fornitore)
      }
    })()

    const eluente = db.prepare('SELECT * FROM eluenti WHERE id = ?').get(id) as any
    eluente.componenti = db.prepare(
      'SELECT * FROM eluenti_componenti WHERE eluente_id = ?'
    ).all(id)
    return eluente
  })

  ipcMain.handle('eluenti:update', (_, id: string, data: {
    nome: string
    data_inizio: string
    data_fine?: string | null
    componenti: { sostanza: string; lotto: string; fornitore: string }[]
  }) => {
    const db = getDb()

    const updateEluente = db.prepare(
      `UPDATE eluenti SET nome=?, data_inizio=?, data_fine=? WHERE id=?`
    )
    const deleteComps = db.prepare('DELETE FROM eluenti_componenti WHERE eluente_id = ?')
    const insertComp = db.prepare(
      `INSERT INTO eluenti_componenti (eluente_id, sostanza, lotto, fornitore)
       VALUES (?, ?, ?, ?)`
    )

    db.transaction(() => {
      updateEluente.run(data.nome, data.data_inizio, data.data_fine || null, id)
      deleteComps.run(id)
      for (const c of data.componenti) {
        insertComp.run(id, c.sostanza, c.lotto, c.fornitore)
      }
    })()

    const eluente = db.prepare('SELECT * FROM eluenti WHERE id = ?').get(id) as any
    eluente.componenti = db.prepare(
      'SELECT * FROM eluenti_componenti WHERE eluente_id = ?'
    ).all(id)
    return eluente
  })

  ipcMain.handle('eluenti:close', (_, id: string) => {
    getDb().prepare(
      `UPDATE eluenti SET data_fine = date('now') WHERE id = ?`
    ).run(id)
    return { ok: true }
  })

  ipcMain.handle('eluenti:delete', (_, id: string) => {
    getDb().prepare('DELETE FROM eluenti WHERE id = ?').run(id)
    return { ok: true }
  })
}
