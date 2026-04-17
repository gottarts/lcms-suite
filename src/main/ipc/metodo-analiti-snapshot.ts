import type Database from 'better-sqlite3'

/**
 * Cattura uno snapshot completo di metodo_analiti per il metodo indicato.
 * Da chiamare DENTRO la stessa transazione che muta la lista analiti,
 * DOPO che la mutazione è stata applicata.
 */
export function snapshotMetodoAnaliti(
  db: Database.Database,
  metodoId: string,
  motivo: string
): void {
  const rows = db.prepare(
    `SELECT nome, ordine, accreditato, alias_strumento, alias_lims, alias_oqlab
     FROM metodo_analiti
     WHERE metodo_id = ?
     ORDER BY COALESCE(ordine, 9999), id ASC`
  ).all(metodoId)

  const snapshot = JSON.stringify(rows)

  db.prepare(
    `INSERT INTO metodo_analiti_versioni (metodo_id, snapshot, motivo)
     VALUES (?, ?, ?)`
  ).run(metodoId, snapshot, motivo)
}
