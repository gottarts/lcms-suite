import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerSchemaCalibrazioneIpc(): void {

  ipcMain.handle('schema-cal:get', (_, metodoId: string) => {
    const db = getDb()
    const row = db.prepare('SELECT schema_json FROM schema_calibrazione WHERE metodo_id = ?').get(metodoId) as any
    if (!row) return null

    const schema = JSON.parse(row.schema_json)

    // Cleanup passivo: rimuove da work_metodi le entries spurie per questo metodo
    // (work con link in work_metodi ma assenti dal schema_json)
    const dbIds: number[] = (schema.workCols ?? []).flat()
      .map((w: any) => w.dbId).filter((id: any) => id != null)
    if (dbIds.length > 0) {
      const placeholders = dbIds.map(() => '?').join(',')
      db.prepare(`DELETE FROM work_metodi WHERE metodo_id = ? AND work_id NOT IN (${placeholders})`)
        .run(metodoId, ...dbIds)
    } else {
      db.prepare('DELETE FROM work_metodi WHERE metodo_id = ?').run(metodoId)
    }

    return schema
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

    // Sincronizza work_metodi con i dbIds nel JSON (source of truth = schema_json)
    const schema = JSON.parse(schemaJson)
    const dbIds: number[] = (schema.workCols ?? []).flat()
      .map((w: any) => w.dbId).filter((id: any) => id != null)
    if (dbIds.length > 0) {
      const placeholders = dbIds.map(() => '?').join(',')
      db.prepare(`DELETE FROM work_metodi WHERE metodo_id = ? AND work_id NOT IN (${placeholders})`)
        .run(metodoId, ...dbIds)
      for (const dbId of dbIds) {
        db.prepare('INSERT OR IGNORE INTO work_metodi (work_id, metodo_id) VALUES (?, ?)').run(dbId, metodoId)
      }
    } else {
      db.prepare('DELETE FROM work_metodi WHERE metodo_id = ?').run(metodoId)
    }

    return { ok: true }
  })
}
