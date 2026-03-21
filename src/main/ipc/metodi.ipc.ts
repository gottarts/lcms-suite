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
    const getNomeComposto = db.prepare('SELECT nome FROM composti WHERE id = ?')
    const insertAnalita = db.prepare(
      'INSERT OR IGNORE INTO metodo_analiti (metodo_id, nome) VALUES (?, ?)'
    )

    db.transaction(() => {
      insertMetodo.run(metodoData)
      for (const cid of compostiIds) {
        insertLink.run(cid, data.id)
        const c = getNomeComposto.get(cid) as { nome: string } | undefined
        if (c?.nome) insertAnalita.run(data.id, c.nome)
      }
    })()

    return db.prepare('SELECT * FROM metodi WHERE id = ?').get(data.id)
  })

  ipcMain.handle('metodi:update', (_, id: string, data: Record<string, unknown>) => {
    const db = getDb()
    const compostiIds = (data.composti_ids as number[] | undefined) || []
    const metodoData = { ...data }
    delete metodoData.composti_ids

    // FIX-merge: se il nuovo nome collide con un metodo esistente (diverso da questo),
    // non salvare — restituisce un segnale al frontend per chiedere conferma
    const nuovoNome = (data.nome as string)?.trim()
    if (nuovoNome) {
      const conflict = db.prepare(
        `SELECT id, nome FROM metodi WHERE LOWER(nome) = LOWER(?) AND id != ?`
      ).get(nuovoNome, id) as any
      if (conflict) {
        return {
          needsMerge: true,
          conflictId: conflict.id,
          conflictNome: conflict.nome,
          sourceId: id,
          data: metodoData,
          compostiIds,
        }
      }
    }

    const updateMetodo = db.prepare(
      `UPDATE metodi SET nome=@nome, strumento_id=@strumento_id, matrice=@matrice,
       colonna=@colonna, fase_a=@fase_a, fase_b=@fase_b, gradiente=@gradiente,
       flusso=@flusso, ionizzazione=@ionizzazione, polarita=@polarita,
       acquisizione=@acquisizione, srm=@srm, lims_id=@lims_id, oqlab_id=@oqlab_id,
       note=@note, updated_at=datetime('now') WHERE id=@id`
    )
    const deleteLinks = db.prepare('DELETE FROM composti_metodi WHERE metodo_id = ?')
    const deleteAllAnaliti = db.prepare('DELETE FROM metodo_analiti WHERE metodo_id = ?')
    const insertLink = db.prepare(
      'INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
    )
    const getNomeCompostoUpd = db.prepare('SELECT nome FROM composti WHERE id = ?')
    const insertAnalitaUpd = db.prepare(
      'INSERT OR IGNORE INTO metodo_analiti (metodo_id, nome) VALUES (?, ?)'
    )

    db.transaction(() => {
      updateMetodo.run({ ...metodoData, id })
      deleteLinks.run(id)
      deleteAllAnaliti.run(id)
      for (const cid of compostiIds) {
        insertLink.run(cid, id)
        const c = getNomeCompostoUpd.get(cid) as { nome: string } | undefined
        if (c?.nome) insertAnalitaUpd.run(id, c.nome)
      }
    })()

    return db.prepare('SELECT * FROM metodi WHERE id = ?').get(id)
  })

  // FIX-merge: unisce i composti del metodo sorgente nel metodo destinazione,
  // poi aggiorna i campi del metodo destinazione con i dati del sorgente ed elimina il sorgente.
  // sourceId = metodo da eliminare, destId = metodo che sopravvive
  ipcMain.handle('metodi:merge', (_, sourceId: string, destId: string, data: Record<string, unknown>, compostiIds: number[]) => {
    const db = getDb()

    const updateMetodo = db.prepare(
      `UPDATE metodi SET nome=@nome, strumento_id=@strumento_id, matrice=@matrice,
       colonna=@colonna, fase_a=@fase_a, fase_b=@fase_b, gradiente=@gradiente,
       flusso=@flusso, ionizzazione=@ionizzazione, polarita=@polarita,
       acquisizione=@acquisizione, srm=@srm, lims_id=@lims_id, oqlab_id=@oqlab_id,
       note=@note, updated_at=datetime('now') WHERE id=@id`
    )
    const getDestLinks = db.prepare('SELECT composto_id FROM composti_metodi WHERE metodo_id = ?')
    const deleteSrcLinks = db.prepare('DELETE FROM composti_metodi WHERE metodo_id = ?')
    const deleteDestLinks = db.prepare('DELETE FROM composti_metodi WHERE metodo_id = ?')
    const insertLink = db.prepare('INSERT INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)')
    const deleteSource = db.prepare('DELETE FROM metodi WHERE id = ?')

    db.transaction(() => {
      // Raccoglie tutti i composti già collegati al metodo destinazione
      const existingDestIds = new Set(
        (getDestLinks.all(destId) as any[]).map(r => r.composto_id)
      )
      // Raccoglie i composti del sorgente (quelli che stanno per essere spostati)
      const srcLinks = getDestLinks.all(sourceId) as any[]

      // Aggiorna i campi del metodo destinazione con i dati del form
      updateMetodo.run({ ...data, id: destId })

      // Rimuove tutti i link del destinazione e del sorgente
      deleteDestLinks.run(destId)
      deleteSrcLinks.run(sourceId)

      // Unione: tutti i composti di entrambi + quelli selezionati nel form
      const allIds = new Set<number>([
        ...existingDestIds,
        ...srcLinks.map(r => r.composto_id),
        ...compostiIds,
      ])
      for (const cid of allIds) {
        insertLink.run(cid, destId)
      }

      // Ricalcola analiti del destinazione da zero (composti uniti)
      db.prepare('DELETE FROM metodo_analiti WHERE metodo_id = ?').run(destId)
      const getNomeCompostoMerge = db.prepare('SELECT nome FROM composti WHERE id = ?')
      const insertAnalitaMerge = db.prepare(
        'INSERT OR IGNORE INTO metodo_analiti (metodo_id, nome) VALUES (?, ?)'
      )
      for (const cid of allIds) {
        const c = getNomeCompostoMerge.get(cid) as { nome: string } | undefined
        if (c?.nome) insertAnalitaMerge.run(destId, c.nome)
      }

      // Elimina il metodo sorgente (ON DELETE CASCADE rimuove i suoi metodo_analiti)
      deleteSource.run(sourceId)
    })()

    return db.prepare('SELECT * FROM metodi WHERE id = ?').get(destId)
  })

  ipcMain.handle('metodi:delete', (_, id: string) => {
    getDb().prepare('DELETE FROM metodi WHERE id = ?').run(id)
    return { ok: true }
  })

  // FEAT-metodi-campo: crea il metodo se non esiste già (ricerca per nome, case-insensitive)
  // Usato dal form composto quando l'utente digita un nuovo nome metodo
  ipcMain.handle('metodi:get-or-create', (_, nome: string) => {
    const db = getDb()
    const existing = db.prepare(
      `SELECT * FROM metodi WHERE LOWER(nome) = LOWER(?)`
    ).get(nome) as any
    if (existing) return existing

    const id = 'met_' + Date.now().toString(36)
    db.prepare(
      `INSERT INTO metodi (id, nome) VALUES (?, ?)`
    ).run(id, nome)
    return db.prepare('SELECT * FROM metodi WHERE id = ?').get(id)
  })
}