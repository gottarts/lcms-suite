import { ipcMain } from 'electron'
import { getDb } from '../db'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard IPC
//
// Handler aggregati per la pagina /dashboard:
//  - dashboard:summary  → snapshot scadenze cross-entità (composti, prep, work)
//                         + stat tracciabilità (lotto mismatch, analiti scoperti)
//  - dashboard:audit-crm → dati grezzi per audit CRM (metodo + data)
//
// Design: il main restituisce dati grezzi o pre-calcolati via SQL. Il renderer
// si occupa di applicare `computeStato` / `calcolaStatoLab` già esistenti.
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 60 // timeline prossimi 60 giorni

export function registerDashboardIpc(): void {

  // ── dashboard:summary ───────────────────────────────────────────────────
  ipcMain.handle('dashboard:summary', () => {
    const db = getDb()

    // Composti con scadenza in finestra (+ già scaduti non dismessi) + rivalidazione
    const composti = db.prepare(`
      SELECT
        c.id, c.nome, c.lotto, c.scadenza_prodotto, c.data_dismissione, c.data_apertura,
        (SELECT MAX(cs.nuova_scadenza) FROM composti_storia cs
          WHERE cs.composto_id = c.id AND cs.tipo = 'Rivalidazione'
            AND cs.nuova_scadenza IS NOT NULL) AS ultima_rivalidazione
      FROM composti c
      WHERE c.data_dismissione IS NULL
        AND (
          c.scadenza_prodotto IS NOT NULL
          AND c.scadenza_prodotto <= date('now', '+${WINDOW_DAYS} days')
        )
      ORDER BY c.scadenza_prodotto ASC
    `).all()

    // Preparazioni attive con scadenza in finestra
    const preparazioni = db.prepare(`
      SELECT
        p.id, p.composto_id, p.flacone, p.scadenza, p.data_prep,
        c.nome AS composto_nome
      FROM preparazioni p
      JOIN composti c ON c.id = p.composto_id
      WHERE p.stato = 'Attiva'
        AND p.data_dismissione IS NULL
        AND p.scadenza IS NOT NULL
        AND p.scadenza <= date('now', '+${WINDOW_DAYS} days')
      ORDER BY p.scadenza ASC
    `).all()

    // Work attive con calcolo stato_lab effettuato lato renderer.
    // Includiamo solo quelle con validita_mesi (registrate).
    const work = db.prepare(`
      SELECT
        w.id, w.nome, w.validita_mesi,
        (SELECT wp.data_prep FROM work_preparazioni wp
          WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) AS ultima_prep_data,
        (SELECT COUNT(*)
           FROM work_ingredienti wi JOIN composti c ON c.id = wi.source_id
           WHERE wi.work_id = w.id AND wi.source_type = 'crm'
             AND c.data_dismissione IS NOT NULL
        ) AS n_bloccati,
        (SELECT COUNT(*)
           FROM work_ingredienti wi JOIN composti c ON c.id = wi.source_id
           WHERE wi.work_id = w.id AND wi.source_type = 'crm'
             AND c.data_dismissione IS NULL
             AND c.scadenza_prodotto IS NOT NULL
             AND c.scadenza_prodotto < date('now')
             AND COALESCE(
                   (SELECT MAX(cs.nuova_scadenza) FROM composti_storia cs
                     WHERE cs.composto_id = c.id AND cs.tipo = 'Rivalidazione'
                       AND cs.nuova_scadenza IS NOT NULL),
                   '1970-01-01'
                 ) < date('now')
        ) AS n_scaduti,
        (SELECT GROUP_CONCAT(metodo_id) FROM work_metodi WHERE work_id = w.id) AS _metodi_ids_raw
      FROM work w
      WHERE (w.archiviato = 0 OR w.archiviato IS NULL)
        AND w.validita_mesi IS NOT NULL
      ORDER BY w.nome ASC
    `).all() as any[]

    const workOut = work.map(w => {
      const { _metodi_ids_raw, n_bloccati, n_scaduti, ...rest } = w
      return {
        ...rest,
        metodi_ids: _metodi_ids_raw ? (_metodi_ids_raw as string).split(',') : [],
        bloccata: (n_bloccati as number) > 0,
        ha_crm_scaduti: (n_scaduti as number) > 0,
      }
    })

    // Stat tracciabilità
    // work con lotto mismatch (snapshot lotto_usato ≠ lotto corrente composto)
    const workConLottoMismatch = (db.prepare(`
      SELECT COUNT(DISTINCT wi.work_id) AS n
      FROM work_ingredienti wi
      JOIN composti c ON c.id = wi.source_id
      JOIN work w ON w.id = wi.work_id
      WHERE wi.source_type = 'crm'
        AND wi.lotto_usato IS NOT NULL
        AND c.lotto IS NOT NULL
        AND wi.lotto_usato <> c.lotto
        AND (w.archiviato = 0 OR w.archiviato IS NULL)
    `).get() as { n: number }).n

    // Analiti accreditati senza alcun composto matchato per nome (cross-metodo)
    const analitiAccreditatiScoperti = (db.prepare(`
      SELECT COUNT(*) AS n
      FROM metodo_analiti ma
      WHERE ma.accreditato = 1
        AND NOT EXISTS (
          SELECT 1 FROM composti c
          WHERE LOWER(c.nome) = LOWER(ma.nome)
            AND c.data_dismissione IS NULL
        )
    `).get() as { n: number }).n

    return {
      composti,
      preparazioni,
      work: workOut,
      stats_tracciabilita: {
        work_con_lotto_mismatch: workConLottoMismatch,
        analiti_accreditati_scoperti: analitiAccreditatiScoperti,
      },
    }
  })

  // ── dashboard:audit-crm ─────────────────────────────────────────────────
  ipcMain.handle('dashboard:audit-crm', (_, params: { metodo_id: string; data: string }) => {
    const db = getDb()
    const { metodo_id, data } = params

    const metodo = db.prepare('SELECT id, nome FROM metodi WHERE id = ?').get(metodo_id) as any
    if (!metodo) {
      return {
        metodo_id, metodo_nome: null, data,
        analiti_accreditati: [], works_registrati: [], crm_validi: [],
      }
    }

    const analiti_accreditati = db.prepare(`
      SELECT id, nome, alias_strumento, ordine
      FROM metodo_analiti
      WHERE metodo_id = ? AND accreditato = 1
      ORDER BY ordine, nome
    `).all(metodo_id)

    // Work registrati del metodo (validita_mesi NOT NULL, archiviato=0)
    const works = db.prepare(`
      SELECT
        w.id, w.nome, w.concentrazione AS conc, w.conc_variabile, w.unita_conc, w.volume_ml,
        w.validita_mesi, w.livello, w.solvente,
        (SELECT wp.data_prep FROM work_preparazioni wp
          WHERE wp.work_id = w.id AND wp.data_prep <= @data ORDER BY wp.data_prep DESC LIMIT 1) AS ultima_prep_data,
        (SELECT COUNT(*)
           FROM work_ingredienti wi JOIN composti c ON c.id = wi.source_id
           WHERE wi.work_id = w.id AND wi.source_type = 'crm'
             AND c.data_dismissione IS NOT NULL
        ) AS n_bloccati,
        (SELECT COUNT(*)
           FROM work_ingredienti wi JOIN composti c ON c.id = wi.source_id
           WHERE wi.work_id = w.id AND wi.source_type = 'crm'
             AND c.data_dismissione IS NULL
             AND c.scadenza_prodotto IS NOT NULL
             AND c.scadenza_prodotto < @data
             AND COALESCE(
                   (SELECT MAX(cs.nuova_scadenza) FROM composti_storia cs
                     WHERE cs.composto_id = c.id AND cs.tipo='Rivalidazione'
                       AND cs.nuova_scadenza IS NOT NULL AND cs.data <= @data),
                   '1970-01-01'
                 ) < @data
        ) AS n_scaduti
      FROM work w
      JOIN work_metodi wm ON wm.work_id = w.id
      WHERE wm.metodo_id = @metodo_id
        AND w.validita_mesi IS NOT NULL
        AND (w.archiviato = 0 OR w.archiviato IS NULL)
      ORDER BY w.nome ASC
    `).all({ metodo_id, data }) as any[]

    // Per ogni work, arricchisci ingredienti con dati source (stesso pattern di work:get)
    const stmtIngredienti = db.prepare(`
      SELECT wi.*,
        CASE
          WHEN wi.source_type = 'crm'  THEN (SELECT nome FROM composti WHERE id = wi.source_id)
          WHEN wi.source_type = 'work' THEN (SELECT nome FROM work    WHERE id = wi.source_id)
          WHEN wi.source_type = 'prep' THEN (SELECT c.nome FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
        END AS source_nome,
        CASE
          WHEN wi.source_type = 'crm'  THEN (SELECT lotto FROM composti WHERE id = wi.source_id)
          WHEN wi.source_type = 'prep' THEN (SELECT c.lotto FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
          ELSE NULL
        END AS source_lotto,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT data_dismissione FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_dismissione,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT forma_commerciale FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT concentrazione FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_cv,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT mix_id FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix_id,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT COALESCE(forma_commerciale, mix) FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_mix_nome,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT unita_conc FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_unita_conc,
        CASE
          WHEN wi.source_type = 'crm' THEN (SELECT scadenza_prodotto FROM composti WHERE id = wi.source_id)
          ELSE NULL
        END AS source_scadenza,
        CASE
          WHEN wi.source_type = 'crm' THEN (
            SELECT MAX(cs.nuova_scadenza) FROM composti_storia cs
            WHERE cs.composto_id = wi.source_id
              AND cs.tipo = 'Rivalidazione'
              AND cs.nuova_scadenza IS NOT NULL
              AND cs.data <= @data
          )
          ELSE NULL
        END AS source_rivalidazione
      FROM work_ingredienti wi
      WHERE wi.work_id = @work_id
    `)

    const works_registrati = works.map(w => {
      const { n_bloccati, n_scaduti, ...rest } = w
      const ingredienti = stmtIngredienti.all({ work_id: w.id, data })
      return {
        ...rest,
        bloccata: (n_bloccati as number) > 0,
        ha_crm_scaduti: (n_scaduti as number) > 0,
        ingredienti,
      }
    })

    // CRM rilevanti per l'audit: union di
    //   (a) CRM linkati al metodo e validi alla data
    //   (b) TUTTI i componenti di eventuali mix usati dai Work del metodo
    //       (anche se il singolo componente non è linkato al metodo, serve
    //       al renderer per ricostruire la composizione del mix e capire
    //       quali analiti copre)
    //   (c) Singoli usati come ingredienti dai Work del metodo
    // Tutti filtrati per stato alla data (non dismessi, aperti).
    const crm_validi = db.prepare(`
      WITH mix_usati AS (
        SELECT DISTINCT c.mix_id AS mix_id
        FROM work_ingredienti wi
        JOIN work_metodi wm ON wm.work_id = wi.work_id
        JOIN composti c ON c.id = wi.source_id
        WHERE wm.metodo_id = @metodo_id
          AND wi.source_type = 'crm'
          AND c.mix_id IS NOT NULL
      ),
      ids_rilevanti AS (
        -- (a) CRM linkati al metodo
        SELECT c.id
        FROM composti c
        JOIN composti_metodi cm ON cm.composto_id = c.id
        WHERE cm.metodo_id = @metodo_id
        UNION
        -- (b) tutti i componenti dei mix usati dai work del metodo
        SELECT c.id FROM composti c
        WHERE c.mix_id IN (SELECT mix_id FROM mix_usati)
        UNION
        -- (c) singoli ingredienti diretti dei work del metodo
        SELECT c.id
        FROM work_ingredienti wi
        JOIN work_metodi wm ON wm.work_id = wi.work_id
        JOIN composti c ON c.id = wi.source_id
        WHERE wm.metodo_id = @metodo_id
          AND wi.source_type = 'crm'
      )
      SELECT DISTINCT
        c.id, c.nome, c.lotto, c.scadenza_prodotto, c.mix_id,
        c.forma, c.forma_commerciale AS mix, c.concentrazione, c.unita_conc,
        c.data_apertura, c.data_dismissione,
        (SELECT MAX(cs.nuova_scadenza) FROM composti_storia cs
          WHERE cs.composto_id = c.id AND cs.tipo='Rivalidazione'
            AND cs.nuova_scadenza IS NOT NULL AND cs.data <= @data) AS ultima_rivalidazione
      FROM composti c
      WHERE c.id IN (SELECT id FROM ids_rilevanti)
        AND (c.data_dismissione IS NULL OR c.data_dismissione > @data)
      ORDER BY c.nome ASC
    `).all({ metodo_id, data })

    return {
      metodo_id,
      metodo_nome: metodo.nome,
      data,
      analiti_accreditati,
      works_registrati,
      crm_validi,
    }
  })
}
