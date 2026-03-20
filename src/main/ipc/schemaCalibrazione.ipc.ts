import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerSchemaCalibrazioneIpc(): void {

  ipcMain.handle('schema-cal:get', (_, metodoId: string) => {
    const row = getDb()
      .prepare('SELECT schema_json FROM schema_calibrazione WHERE metodo_id = ?')
      .get(metodoId) as any
    return row ? JSON.parse(row.schema_json) : null
  })

  ipcMain.handle('schema-cal:save', (_, metodoId: string, schemaJson: string) => {
    getDb().prepare(`
      INSERT INTO schema_calibrazione (metodo_id, schema_json, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(metodo_id) DO UPDATE SET
        schema_json = excluded.schema_json,
        updated_at  = excluded.updated_at
    `).run(metodoId, schemaJson)
    return { ok: true }
  })
}
