import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerQueryIpc(): void {
  ipcMain.handle('query:snapshot', (_, request: {
    strumento_id: string
    metodo_id?: string
    data: string
  }) => {
    const db = getDb()

    // Active eluenti on strumento at date
    const eluenti = db.prepare(
      `SELECT e.* FROM eluenti e
       WHERE e.strumento_id = ?
         AND e.data_inizio <= ?
         AND (e.data_fine IS NULL OR e.data_fine >= ?)`
    ).all(request.strumento_id, request.data, request.data) as any[]

    for (const e of eluenti) {
      e.componenti = db.prepare(
        'SELECT * FROM eluenti_componenti WHERE eluente_id = ?'
      ).all(e.id)
    }

    let consumabili: any[] = []
    let composti: any[] = []

    if (request.metodo_id) {
      // Active consumabili for metodo at date
      consumabili = db.prepare(
        `SELECT c.* FROM consumabili c
         JOIN consumabili_metodi cm ON cm.consumabile_id = c.id
         WHERE cm.metodo_id = ?
           AND c.data_apertura <= ?
           AND (c.data_chiusura IS NULL OR c.data_chiusura >= ?)`
      ).all(request.metodo_id, request.data, request.data)

      // Composti associated with metodo, with active preparazione at date
      composti = db.prepare(
        `SELECT comp.*, p.id AS prep_id, p.flacone, p.concentrazione AS prep_conc,
                p.data_prep, p.scadenza AS prep_scadenza
         FROM composti comp
         JOIN composti_metodi cm ON cm.composto_id = comp.id
         LEFT JOIN preparazioni p ON p.composto_id = comp.id
           AND p.data_prep <= ?
           AND (p.scadenza IS NULL OR p.scadenza >= ?)
         WHERE cm.metodo_id = ?`
      ).all(request.data, request.data, request.metodo_id)
    }

    return { eluenti, consumabili, composti }
  })
}
