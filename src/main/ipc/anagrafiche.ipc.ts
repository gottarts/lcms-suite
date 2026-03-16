import { ipcMain } from 'electron'
import { getDb } from '../db'

const ALLOWED_CAMPI = ['classe', 'produttore', 'solvente', 'stoccaggio', 'operatore_apertura', 'ubicazione'] as const
type CampoDB = typeof ALLOWED_CAMPI[number]

export function registerAnagraficheIpc(): void {

  // ─── Handlers esistenti ────────────────────────────────────────────────────

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

  // ─── TASK B-1: sync-voce ───────────────────────────────────────────────────
  // Trova o crea l'anagrafica per nome, poi aggiunge la voce se non esiste già.
  // Chiamato dopo ogni salvataggio composto da anagrafiche-sync.ts.

  ipcMain.handle('anagrafiche:sync-voce', (_, nomeAnagrafica: string, valore: string) => {
    if (!valore || !valore.trim()) return { ok: true, skipped: true }
    const db = getDb()

    // Trova o crea l'anagrafica (ricerca case-insensitive)
    let anagrafica = db.prepare(
      `SELECT * FROM anagrafiche WHERE LOWER(nome) = LOWER(?)`
    ).get(nomeAnagrafica.trim()) as any

    if (!anagrafica) {
      const result = db.prepare(
        `INSERT INTO anagrafiche (nome) VALUES (?)`
      ).run(nomeAnagrafica.trim())
      anagrafica = { id: result.lastInsertRowid }
    }

    // Inserisce la voce solo se non esiste già (ignora violazione UNIQUE)
    try {
      db.prepare(
        `INSERT INTO anagrafiche_voci (anagrafica_id, valore) VALUES (?, ?)`
      ).run(anagrafica.id, valore.trim())
    } catch {
      // UNIQUE constraint: voce già presente, nessun problema
    }

    return { ok: true }
  })

  // ─── TASK C-1: rename-voce-propagate ──────────────────────────────────────
  // Rinomina una voce nell'anagrafica E aggiorna tutti i composti che usavano
  // il vecchio valore nel campo DB corrispondente, in una singola transazione.

  ipcMain.handle('anagrafiche:rename-voce-propagate',
    (_, voceId: number, nuovoValore: string, campoDB: string) => {
      if (!(ALLOWED_CAMPI as readonly string[]).includes(campoDB)) {
        return { ok: false, error: 'Campo non consentito' }
      }

      const db = getDb()
      const voce = db.prepare('SELECT * FROM anagrafiche_voci WHERE id = ?').get(voceId) as any
      if (!voce) return { ok: false, error: 'Voce non trovata' }

      const vecchioValore = voce.valore

      db.transaction(() => {
        // Aggiorna la voce nell'anagrafica
        db.prepare('UPDATE anagrafiche_voci SET valore = ? WHERE id = ?')
          .run(nuovoValore.trim(), voceId)
        // Propaga il nuovo valore a tutti i composti che avevano il vecchio
        db.prepare(`UPDATE composti SET ${campoDB} = ? WHERE ${campoDB} = ?`)
          .run(nuovoValore.trim(), vecchioValore)
      })()

      return { ok: true }
    }
  )

  // ─── TASK C-2: merge-voci ─────────────────────────────────────────────────
  // Unisce due voci della stessa anagrafica: riassegna tutti i composti dal
  // valore sorgente al valore destinazione, poi elimina la voce sorgente.
  // sourceId = voce da eliminare, destId = voce che sopravvive.

  ipcMain.handle('anagrafiche:merge-voci',
    (_, voceSourceId: number, voceDestId: number, campoDB: string) => {
      if (!(ALLOWED_CAMPI as readonly string[]).includes(campoDB)) {
        return { ok: false, error: 'Campo non consentito' }
      }

      const db = getDb()
      const src  = db.prepare('SELECT * FROM anagrafiche_voci WHERE id = ?').get(voceSourceId) as any
      const dest = db.prepare('SELECT * FROM anagrafiche_voci WHERE id = ?').get(voceDestId)   as any
      if (!src || !dest) return { ok: false, error: 'Voci non trovate' }

      db.transaction(() => {
        // Riassegna tutti i composti dal valore sorgente al valore destinazione
        db.prepare(`UPDATE composti SET ${campoDB} = ? WHERE ${campoDB} = ?`)
          .run(dest.valore, src.valore)
        // Elimina la voce sorgente
        db.prepare('DELETE FROM anagrafiche_voci WHERE id = ?').run(voceSourceId)
      })()

      return { ok: true }
    }
  )
}