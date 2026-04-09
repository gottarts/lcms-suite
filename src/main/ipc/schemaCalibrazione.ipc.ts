import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerSchemaCalibrazioneIpc(): void {

  ipcMain.handle('schema-cal:get', (_, metodoId: string) => {
    const db = getDb()
    const row = db.prepare('SELECT schema_json FROM schema_calibrazione WHERE metodo_id = ?').get(metodoId) as any
    if (!row) return null

    return JSON.parse(row.schema_json)
  })

  ipcMain.handle('schema-cal:save', (_, metodoId: string, schemaJson: string) => {
    const db = getDb()
    db.prepare(`
      INSERT INTO schema_calibrazione (metodo_id, schema_json, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(metodo_id) DO UPDATE SET
        schema_json = excluded.schema_json,
        updated_at  = excluded.updated_at
    `).run(metodoId, schemaJson)

    // Aggiunge i link work↔metodo per i dbId presenti nel JSON.
    // Non rimuove mai link esistenti: le work già create rimangono congelate e collegate al metodo.
    // I link orfani (work eliminate dal DB) vengono gestiti dall'ON DELETE CASCADE sulla FK.
    const schema = JSON.parse(schemaJson)
    const dbIds: number[] = (schema.workCols ?? []).flat()
      .map((w: any) => w.dbId).filter((id: any) => id != null)
    for (const dbId of dbIds) {
      db.prepare('INSERT OR IGNORE INTO work_metodi (work_id, metodo_id) VALUES (?, ?)').run(dbId, metodoId)
    }

    return { ok: true }
  })
}
