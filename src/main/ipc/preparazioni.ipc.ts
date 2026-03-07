import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerPreparazioniIpc(): void {
  ipcMain.handle('preparazioni:list', (_, compostoId: number) => {
    return getDb().prepare(
      'SELECT * FROM preparazioni WHERE composto_id = ? ORDER BY data_prep DESC'
    ).all(compostoId)
  })

  ipcMain.handle('preparazioni:create', (_, data: Record<string, unknown>) => {
    const row = {
      composto_id: data.composto_id,
      forma: data.forma ?? null,
      stato: data.stato ?? 'Attiva',
      flacone: data.flacone ?? null,
      concentrazione: data.concentrazione ?? null,
      solvente: data.solvente ?? null,
      data_prep: data.data_prep ?? null,
      scadenza: data.scadenza ?? null,
      operatore: data.operatore ?? null,
      posizione: data.posizione ?? null,
      note: data.note ?? null,
      massa_pesata: data.massa_pesata ?? null,
      purezza_usata: data.purezza_usata ?? null,
      densita_solvente: data.densita_solvente ?? null,
      modalita_aggiunta: data.modalita_aggiunta ?? null,
      concentrazione_reale: data.concentrazione_reale ?? null,
      concentrazione_target: data.concentrazione_target ?? null,
    }
    const result = getDb().prepare(
      `INSERT INTO preparazioni (
         composto_id, forma, stato, flacone, concentrazione, solvente,
         data_prep, scadenza, operatore, posizione, note,
         massa_pesata, purezza_usata, densita_solvente, modalita_aggiunta,
         concentrazione_reale, concentrazione_target
       ) VALUES (
         @composto_id, @forma, @stato, @flacone, @concentrazione, @solvente,
         @data_prep, @scadenza, @operatore, @posizione, @note,
         @massa_pesata, @purezza_usata, @densita_solvente, @modalita_aggiunta,
         @concentrazione_reale, @concentrazione_target
       )`
    ).run(row)
    return getDb().prepare('SELECT * FROM preparazioni WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('preparazioni:update', (_, id: number, data: Record<string, unknown>) => {
    const row = {
      id,
      forma: data.forma ?? null,
      stato: data.stato ?? 'Attiva',
      flacone: data.flacone ?? null,
      concentrazione: data.concentrazione ?? null,
      solvente: data.solvente ?? null,
      data_prep: data.data_prep ?? null,
      scadenza: data.scadenza ?? null,
      operatore: data.operatore ?? null,
      posizione: data.posizione ?? null,
      note: data.note ?? null,
      massa_pesata: data.massa_pesata ?? null,
      purezza_usata: data.purezza_usata ?? null,
      densita_solvente: data.densita_solvente ?? null,
      modalita_aggiunta: data.modalita_aggiunta ?? null,
      concentrazione_reale: data.concentrazione_reale ?? null,
      concentrazione_target: data.concentrazione_target ?? null,
    }
    getDb().prepare(
      `UPDATE preparazioni SET
         forma=@forma, stato=@stato, flacone=@flacone, concentrazione=@concentrazione,
         solvente=@solvente, data_prep=@data_prep, scadenza=@scadenza,
         operatore=@operatore, posizione=@posizione, note=@note,
         massa_pesata=@massa_pesata, purezza_usata=@purezza_usata, densita_solvente=@densita_solvente,
         modalita_aggiunta=@modalita_aggiunta, concentrazione_reale=@concentrazione_reale,
         concentrazione_target=@concentrazione_target
       WHERE id=@id`
    ).run(row)
    return getDb().prepare('SELECT * FROM preparazioni WHERE id = ?').get(id)
  })

  ipcMain.handle('preparazioni:dismiss', (_, id: number, data_dismissione: string) => {
    getDb().prepare(
      `UPDATE preparazioni SET stato='Dismessa', data_dismissione=@data_dismissione WHERE id=@id`
    ).run({ id, data_dismissione })
    return getDb().prepare('SELECT * FROM preparazioni WHERE id = ?').get(id)
  })

  ipcMain.handle('preparazioni:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM preparazioni WHERE id = ?').run(id)
    return { ok: true }
  })
}
