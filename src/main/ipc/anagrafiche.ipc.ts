import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerAnagraficheIpc(): void {
  ipcMain.handle('anagrafiche:list', () => {
    const anags = getDb().prepare('SELECT * FROM anagrafiche ORDER BY nome').all() as any[]
    for (const a of anags) {
      a.voci = getDb().prepare(
        'SELECT * FROM anagrafiche_voci WHERE anagrafica_id = ? ORDER BY valore'
      ).all(a.id)
    }
    return anags
  })

  ipcMain.handle('anagrafiche:create', (_, nome: string) => {
    const result = getDb().prepare('INSERT INTO anagrafiche (nome) VALUES (?)').run(nome)
    return { id: result.lastInsertRowid, nome, voci: [] }
  })

  ipcMain.handle('anagrafiche:rename', (_, id: number, nome: string) => {
    getDb().prepare('UPDATE anagrafiche SET nome = ? WHERE id = ?').run(nome, id)
    return { ok: true }
  })

  ipcMain.handle('anagrafiche:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM anagrafiche WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('anagrafiche:add-voce', (_, anagId: number, valore: string) => {
    const result = getDb().prepare(
      'INSERT INTO anagrafiche_voci (anagrafica_id, valore) VALUES (?, ?)'
    ).run(anagId, valore)
    return { id: result.lastInsertRowid, anagrafica_id: anagId, valore }
  })

  ipcMain.handle('anagrafiche:update-voce', (_, id: number, valore: string) => {
    getDb().prepare('UPDATE anagrafiche_voci SET valore = ? WHERE id = ?').run(valore, id)
    return { ok: true }
  })

  ipcMain.handle('anagrafiche:delete-voce', (_, id: number) => {
    getDb().prepare('DELETE FROM anagrafiche_voci WHERE id = ?').run(id)
    return { ok: true }
  })
}
