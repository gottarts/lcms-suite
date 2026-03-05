import { ipcMain } from 'electron'
import fs from 'fs'
import { getDb } from '../db'

interface LegacyComposto {
  _id: number
  Name?: string
  CodiceInterno?: string
  Formula?: string
  Classe?: string
  Forma?: string
  FormaCommer?: string
  Purezza?: string | number
  Conc?: string | number
  Solvente?: string
  Fiala?: string
  Azienda?: string
  Lotto?: string
  OperatoreApertura?: string
  DataApertura?: string
  ScadenzaProdotto?: string
  DataDismissione?: string
  DestinazioneUso?: string
  WorkStandard?: string
  Matrice?: string
  MW?: string | number
  Ubicazione?: string
  ARPA?: string
  Mix?: string
  mix_id?: string
  metodiIds?: string[]
  _storia?: { tipo: string; data: string; note?: string }[]
}

interface LegacyStrumento {
  id: string
  code: string
  type?: string
  status?: string
  col?: string
  phA?: string
  phB?: string
  flow?: string
  temp?: string
  notes?: string
}

interface LegacyMetodo {
  id: string
  nome?: string
  name?: string
  strumento_id?: string
  matrice?: string
  colonna?: string
  fase_a?: string
  fase_b?: string
  gradiente?: string
  flusso?: string
  ionizzazione?: string
  polarita?: string
  acquisizione?: string
  srm?: string
  lims_id?: string
  oqlab_id?: string
  note?: string
}

interface LegacyPrep {
  flacone?: string
  concentrazione?: string
  solvente?: string
  data_prep?: string
  scadenza?: string
  operatore?: string
  note?: string
}

interface LegacyEluente {
  id?: string
  strumento_id: string
  nome: string
  data_inizio: string
  data_fine?: string
  componenti?: { sostanza?: string; lotto?: string; fornitore?: string }[]
}

interface LegacyDiarioEntry {
  strumento_id: string
  metodo_id?: string
  data: string
  autore?: string
  testo: string
}

interface LegacyAnagrafica {
  nome: string
  voci?: string[]
}

interface LegacyData {
  version?: number
  strumenti?: LegacyStrumento[]
  metodi?: LegacyMetodo[]
  composti?: LegacyComposto[]
  preps?: Record<string, LegacyPrep[]>
  eluenti?: LegacyEluente[]
  diario?: LegacyDiarioEntry[]
  anagrafiche?: LegacyAnagrafica[]
}

function toNumberOrNull(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(n) ? null : n
}

export function registerMigrationIpc(): void {
  ipcMain.handle('config:import-legacy', async (_, jsonPath: string) => {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8')
      const json: LegacyData = JSON.parse(raw)
      const db = getDb()

      const counts: Record<string, number> = {
        strumenti: 0,
        metodi: 0,
        composti: 0,
        composti_metodi: 0,
        composti_storia: 0,
        preparazioni: 0,
        eluenti: 0,
        eluenti_componenti: 0,
        diario: 0,
        anagrafiche: 0,
        anagrafiche_voci: 0
      }

      const migrate = db.transaction(() => {
        // ── 1. Strumenti ──
        const insertStrumento = db.prepare(
          `INSERT OR IGNORE INTO strumenti (id, codice, tipo, seriale, status)
           VALUES (@id, @codice, @tipo, @seriale, @status)`
        )
        for (const s of json.strumenti || []) {
          insertStrumento.run({
            id: s.id,
            codice: s.code || s.id,
            tipo: s.type || null,
            seriale: null,
            status: s.status || 'off'
          })
          counts.strumenti++
        }

        // ── 2. Metodi (deduplicate by id) ──
        const insertMetodo = db.prepare(
          `INSERT OR IGNORE INTO metodi (id, nome, strumento_id, matrice, colonna,
            fase_a, fase_b, gradiente, flusso, ionizzazione, polarita,
            acquisizione, srm, lims_id, oqlab_id, note)
           VALUES (@id, @nome, @strumento_id, @matrice, @colonna,
            @fase_a, @fase_b, @gradiente, @flusso, @ionizzazione, @polarita,
            @acquisizione, @srm, @lims_id, @oqlab_id, @note)`
        )
        const seenMetodi = new Set<string>()
        for (const m of json.metodi || []) {
          if (seenMetodi.has(m.id)) continue
          seenMetodi.add(m.id)
          insertMetodo.run({
            id: m.id,
            nome: m.nome || m.name || m.id,
            strumento_id: m.strumento_id || null,
            matrice: m.matrice || null,
            colonna: m.colonna || null,
            fase_a: m.fase_a || null,
            fase_b: m.fase_b || null,
            gradiente: m.gradiente || null,
            flusso: m.flusso || null,
            ionizzazione: m.ionizzazione || null,
            polarita: m.polarita || null,
            acquisizione: m.acquisizione || null,
            srm: m.srm || null,
            lims_id: m.lims_id || null,
            oqlab_id: m.oqlab_id || null,
            note: m.note || null
          })
          counts.metodi++
        }

        // ── 3. Composti ──
        // Map old _id → new autoincrement id for preps mapping
        const oldIdToNewId = new Map<number, number | bigint>()

        const insertComposto = db.prepare(
          `INSERT INTO composti (nome, codice_interno, formula, classe, forma,
            forma_commerciale, purezza, concentrazione, solvente, fiala,
            produttore, lotto, operatore_apertura, data_apertura,
            scadenza_prodotto, data_dismissione, destinazione_uso,
            work_standard, matrice, peso_molecolare, ubicazione,
            arpa, mix, mix_id)
           VALUES (@nome, @codice_interno, @formula, @classe, @forma,
            @forma_commerciale, @purezza, @concentrazione, @solvente, @fiala,
            @produttore, @lotto, @operatore_apertura, @data_apertura,
            @scadenza_prodotto, @data_dismissione, @destinazione_uso,
            @work_standard, @matrice, @peso_molecolare, @ubicazione,
            @arpa, @mix, @mix_id)`
        )

        const insertCompostoMetodo = db.prepare(
          'INSERT OR IGNORE INTO composti_metodi (composto_id, metodo_id) VALUES (?, ?)'
        )

        const insertStoria = db.prepare(
          `INSERT INTO composti_storia (composto_id, tipo, data, note)
           VALUES (?, ?, ?, ?)`
        )

        for (const c of json.composti || []) {
          const result = insertComposto.run({
            nome: c.Name || '',
            codice_interno: c.CodiceInterno || null,
            formula: c.Formula || null,
            classe: c.Classe || null,
            forma: c.Forma || null,
            forma_commerciale: c.FormaCommer || null,
            purezza: toNumberOrNull(c.Purezza),
            concentrazione: toNumberOrNull(c.Conc),
            solvente: c.Solvente || null,
            fiala: c.Fiala || null,
            produttore: c.Azienda || null,
            lotto: c.Lotto || null,
            operatore_apertura: c.OperatoreApertura || null,
            data_apertura: c.DataApertura || null,
            scadenza_prodotto: c.ScadenzaProdotto || null,
            data_dismissione: c.DataDismissione || null,
            destinazione_uso: c.DestinazioneUso || null,
            work_standard: c.WorkStandard || null,
            matrice: c.Matrice || null,
            peso_molecolare: toNumberOrNull(c.MW),
            ubicazione: c.Ubicazione || null,
            arpa: c.ARPA || 'N',
            mix: c.Mix || null,
            mix_id: c.mix_id || null
          })
          const newId = result.lastInsertRowid
          oldIdToNewId.set(c._id, newId)
          counts.composti++

          // ── 3a. composti_metodi links ──
          if (Array.isArray(c.metodiIds)) {
            for (const mid of c.metodiIds) {
              if (mid) {
                insertCompostoMetodo.run(newId, mid)
                counts.composti_metodi++
              }
            }
          }

          // ── 3b. composti_storia ──
          if (Array.isArray(c._storia)) {
            for (const s of c._storia) {
              insertStoria.run(newId, s.tipo || 'Rivalidazione', s.data, s.note || null)
              counts.composti_storia++
            }
          }
        }

        // ── 4. Preparazioni (from preps map) ──
        const insertPrep = db.prepare(
          `INSERT INTO preparazioni (composto_id, flacone, concentrazione, solvente,
            data_prep, scadenza, operatore, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )

        if (json.preps && typeof json.preps === 'object') {
          for (const [oldId, preps] of Object.entries(json.preps)) {
            const newId = oldIdToNewId.get(Number(oldId))
            if (!newId || !Array.isArray(preps)) continue
            for (const p of preps) {
              insertPrep.run(
                newId,
                p.flacone || null,
                p.concentrazione || null,
                p.solvente || null,
                p.data_prep || null,
                p.scadenza || null,
                p.operatore || null,
                p.note || null
              )
              counts.preparazioni++
            }
          }
        }

        // ── 5. Eluenti + componenti ──
        const insertEluente = db.prepare(
          `INSERT INTO eluenti (id, strumento_id, nome, data_inizio, data_fine)
           VALUES (?, ?, ?, ?, ?)`
        )
        const insertEluenteComp = db.prepare(
          `INSERT INTO eluenti_componenti (eluente_id, sostanza, lotto, fornitore)
           VALUES (?, ?, ?, ?)`
        )

        for (const e of json.eluenti || []) {
          const eid = e.id || crypto.randomUUID()
          insertEluente.run(
            eid,
            e.strumento_id,
            e.nome,
            e.data_inizio,
            e.data_fine || null
          )
          counts.eluenti++

          if (Array.isArray(e.componenti)) {
            for (const comp of e.componenti) {
              insertEluenteComp.run(
                eid,
                comp.sostanza || null,
                comp.lotto || null,
                comp.fornitore || null
              )
              counts.eluenti_componenti++
            }
          }
        }

        // ── 6. Diario ──
        const insertDiario = db.prepare(
          `INSERT INTO diario (strumento_id, metodo_id, data, autore, testo)
           VALUES (?, ?, ?, ?, ?)`
        )
        for (const d of json.diario || []) {
          insertDiario.run(
            d.strumento_id,
            d.metodo_id || null,
            d.data,
            d.autore || null,
            d.testo
          )
          counts.diario++
        }

        // ── 7. Anagrafiche + voci ──
        const insertAnagrafica = db.prepare(
          'INSERT INTO anagrafiche (nome) VALUES (?)'
        )
        const insertVoce = db.prepare(
          'INSERT INTO anagrafiche_voci (anagrafica_id, valore) VALUES (?, ?)'
        )

        for (const a of json.anagrafiche || []) {
          const res = insertAnagrafica.run(a.nome)
          counts.anagrafiche++
          if (Array.isArray(a.voci)) {
            for (const v of a.voci) {
              if (v) {
                insertVoce.run(res.lastInsertRowid, v)
                counts.anagrafiche_voci++
              }
            }
          }
        }
      })

      // Execute the transaction
      migrate()

      return { ok: true, counts }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })
}
