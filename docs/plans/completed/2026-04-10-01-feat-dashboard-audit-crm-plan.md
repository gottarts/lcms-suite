# Piano: Dashboard LCMS Suite

## Contesto

L'app LCMS Suite oggi non ha un punto unico dove l'operatore vede cosa sta per scadere o è scaduto. I problemi §8.3 dell'[analisi funzionale](docs/ANALISI_FUNZIONALE.md) segnalano esplicitamente "assenza di notifiche proattive" e "mancanza di stampa/report".

Questa modifica introduce una nuova pagina **`/dashboard`** che diventa la home dell'app e centralizza:

1. **Avvisi scadenze proattivi** per tutte le entità con vera scadenza — composti (CRM), preparazioni, Work. _Eluenti e consumabili sono fuori scope in questo giro (verranno aggiunti più avanti quando sarà chiaro il loro concetto di "scadenza")._
2. **Stato tracciabilità** — indicatori sintetici sulla coerenza dei Work (lotto snapshot vs lotto corrente, CRM dismessi/scaduti dentro Work).
3. **Sezione Audit CRM** — per un **metodo + data**, tabella che mostra per ogni analita accreditato quale **Work registrato** lo copre (con quali CRM sottostanti), esportabile in PDF.
4. **Sezione Report PDF** (MVP: solo l'Audit CRM; altri report saranno definiti in seguito).

Il PDF deve avere lo stile omogeneo al "Quaderno CRM" già generato da [ExportDialog.tsx](src/renderer/pages/composti/ExportDialog.tsx) — stesso font Helvetica, stessa palette header RGB(30,30,30), stessa architettura copertina + sommario + schede.

---

## Modello Audit CRM (chiarito con l'utente)

L'audit **non matcha direttamente analita → CRM**, bensì **analita → Work registrato**:

- Un **Work registrato** è un `work.validita_mesi IS NOT NULL AND archiviato = 0` (ha scadenza, quindi è tracciato)
- Per un dato metodo, tutti i Work con `work_metodi.metodo_id = @metodo_id` sono candidati
- Ogni Work "copre" un insieme di analiti derivabili dai suoi ingredienti (espandendo Mix e Work intermedie) — logica già implementata in [`getCompsFromWork()`](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L320-L372) e riutilizzata da [WorkDrawer.tsx:271](src/renderer/pages/work/WorkDrawer.tsx#L271)
- Un analita può essere coperto da più Work (es. bentazone in `work_taratura` e in `work_qc`) → vanno mostrati **entrambi**
- **Raggruppamento visivo**: in tabella i Work compaiono come righe/sezioni, con gli analiti accreditati elencati sotto; ogni analita appare una sola volta per Work
- **Fallback**: se un analita accreditato non è coperto da nessun Work registrato, mostrare in una sezione "Analiti scoperti" i CRM validi disponibili (composto attivo, non dismesso, scadenza effettiva > data)
- **Stato per riga Work**: valido / in_scadenza (<30gg) / scaduto (calcolato sulla scadenza effettiva del Work stesso, oppure sul Worst-CRM-ingrediente se più restrittivo)

---

## Architettura

### Backend — nuovo file [src/main/ipc/dashboard.ipc.ts](src/main/ipc/dashboard.ipc.ts)

Espone 2 handler IPC:

#### `dashboard:summary` → dati aggregati per KPI + timeline
Query SQL per ogni entità con scadenza (entro +60gg o già scaduta), ciascuna restituisce campi grezzi + subquery `ultima_rivalidazione` dove serve. Pattern già usato in [work.ipc.ts:34-54](src/main/ipc/work.ipc.ts#L34-L54).

Return type:
```ts
type DashboardSummary = {
  composti: Array<{ id, nome, lotto, scadenza_prodotto, data_dismissione, data_apertura, ultima_rivalidazione }>
  preparazioni: Array<{ id, composto_id, composto_nome, flacone, scadenza, data_prep }>
  work: Array<{ id, nome, validita_mesi, ultima_prep_data, bloccata, ha_crm_scaduti, metodi_ids: string[] }>
  stats_tracciabilita: {
    work_con_lotto_mismatch: number  // snapshot lotto_usato ≠ lotto corrente
    analiti_accreditati_scoperti: number  // cross-metodo
  }
}
```

Il renderer calcola gli stati finali con `computeStato` (composti) e `calcolaStatoLab` (work) già esistenti — **non duplichiamo la logica**. Le 3 query `composti`/`preparazioni`/`work` sono leggere (prepared statements, dataset piccolo).

#### `dashboard:audit-crm` → dati per l'Audit per metodo + data

Input: `{ metodo_id: string, data: string }`

Non restituisce già il risultato "finito": restituisce i **building block** necessari al renderer per applicare `getCompsFromWork`. Questo evita di duplicare in backend la logica complessa di espansione Mix + Work intermedie.

Return type:
```ts
type AuditCrmData = {
  metodo_id: string
  metodo_nome: string
  data: string
  analiti_accreditati: Array<{ id, nome, alias_strumento, ordine }>
  // Tutti i Work registrati del metodo (validita_mesi NOT NULL, archiviato=0)
  // con ingredienti già arricchiti come in work:get (source_nome, source_lotto, source_mix, ecc.)
  works_registrati: Array<{
    id, nome, conc, unita_conc, volume_ml, validita_mesi, livello,
    ultima_prep_data: string | null,
    stato_lab: StatoLab | null,  // calcolato come in work:list MA con riferimento alla `data` passata, non `now`
    bloccata: boolean,
    ha_crm_scaduti: boolean,
    ingredienti: WorkIngrediente[]  // shape identica a work:get
  }>
  // CRM validi per il metodo alla data (fallback per analiti scoperti)
  crm_validi: Array<{
    id, nome, lotto, scadenza_prodotto, ultima_rivalidazione, mix_id, mix, concentrazione, unita_conc, data_apertura
  }>
}
```

Il renderer:
1. Per ogni Work registrato, usa `getCompsFromWork` (o una sua variante che ricostruisce `WorkInSchema` dai dati IPC — la ricostruzione esiste già in [`ricostruisciWorkInSchema`](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L480)) per ottenere l'elenco di analiti coperti
2. Interseca con `analiti_accreditati` → lista analiti coperti per ogni Work
3. Analiti scoperti = `analiti_accreditati \ ∪(coperture Work)`
4. Per ognuno, trova in `crm_validi` i CRM che matchano per `LOWER(nome)`
5. Costruisce il render-model della tabella

#### Calcolo stato Work alla data storica

`calcolaStatoLab` in [work.ipc.ts:6-22](src/main/ipc/work.ipc.ts#L6-L22) usa `Date.now()`. Per l'audit a data arbitraria serve una variante parametrizzata. La aggiungo **in un helper nuovo nel renderer** (`scadenzeModel.ts`), **non** modifico `work.ipc.ts`. Il renderer riceve `ultima_prep_data` e `validita_mesi` grezzi e calcola il `stato_lab` rispetto alla data di audit.

### Frontend — nuovi file

```
src/renderer/pages/dashboard/
├─ DashboardPage.tsx                  orchestratore, 4 sezioni
├─ sections/
│  ├─ KpiCards.tsx                    riga 1 — contatori cliccabili
│  ├─ ScadenzeTimeline.tsx            riga 2 — lista unificata ordinata per giorni
│  ├─ TracciabilitaCard.tsx           riga 3 — stat sintetica + link a QueryTab
│  └─ AuditCrmSection.tsx             riga 4 — form metodo+data + tabella + bottone PDF
└─ lib/
   ├─ scadenzeModel.ts                ScadenzaItem discriminato, buildScadenzeItems,
   │                                  computeStatoAllaData, calcolaStatoLabAllaData
   └─ auditReport.ts                  generatore PDF Audit CRM (usa pdfReport.ts)
```

Tipo chiave `ScadenzaItem` in `scadenzeModel.ts`:
```ts
type ScadenzaItem =
  | { kind: 'composto';     id: number; nome: string; scadenza: string; giorni: number; stato: CompostoStato }
  | { kind: 'preparazione'; id: number; composto_nome: string; flacone: string; scadenza: string; giorni: number }
  | { kind: 'work';         id: number; nome: string; scadenza: string; giorni: number; stato_lab: StatoLab; bloccata: boolean; ha_crm_scaduti: boolean }
```
Bucket timeline: `<0 (scadute)`, `0-7 giorni`, `8-30 giorni`, `31-60 giorni`.

### Modulo PDF condiviso — nuovo file [src/renderer/lib/pdfReport.ts](src/renderer/lib/pdfReport.ts)

Estrazione **passiva** dei pattern da [ExportDialog.tsx:106-314](src/renderer/pages/composti/ExportDialog.tsx#L106-L314). **`ExportDialog.tsx` non viene toccato** — i nuovi helper sono usati solo dai nuovi report, il "Quaderno CRM" continua a funzionare identico.

Export:
- `PDF_COLORS` — palette: `headerDark: [30,30,30]`, `rowAlt: [248,248,248]`, `statoAttivo: [40,140,80]`, `statoInScadenza: [200,130,0]`, `statoScaduto: [200,60,60]`, `statoDismesso: [150,150,150]`
- `cleanText(s: any): string` — copia di [ExportDialog.tsx:22-32](src/renderer/pages/composti/ExportDialog.tsx#L22-L32)
- `drawCover(doc, opts: { title, subtitle, stats: Array<{ label, value }>, date })` — copertina standard
- `drawPageFooter(doc, pageNum, totalPages)` — numerazione bottom-right
- `tableHeaderStyle` / `tableBodyStyle` — config `jspdf-autotable` standard (Helvetica 7.5pt, header scuro, righe alternate)
- `DEFAULT_MARGINS = { top: 16, left: 14, right: 14, bottom: 14 }`

### File esistenti — modifiche minime

| File | Modifica |
|---|---|
| [src/main/index.ts](src/main/index.ts) | `import { registerDashboardIpc }` + chiamata |
| [src/renderer/App.tsx](src/renderer/App.tsx) | Import `DashboardPage` + `<Route path="/dashboard">` + redirect default da `/composti` → `/dashboard` |
| [src/renderer/components/layout/Sidebar.tsx](src/renderer/components/layout/Sidebar.tsx) | Aggiunta `{ to: '/dashboard', label: 'Dashboard', icon: '📊' }` come primo item di `navItems` |
| [src/renderer/components/layout/AppLayout.tsx](src/renderer/components/layout/AppLayout.tsx) | `pageTitles['/dashboard'] = 'Dashboard'` |
| [src/renderer/lib/api.ts](src/renderer/lib/api.ts) | Nuovo blocco `dashboardApi = { summary(), auditCrm(metodoId, data) }` |

### File NON toccati (conformi a [CLAUDE.md](CLAUDE.md))

`ExportDialog.tsx`, `StatusBadge.tsx`, `CompostiTable.tsx`, `StoriaDialog.tsx`, `CompostiPage.tsx`, `work.ipc.ts`, `composti.ipc.ts`, `SchemaCalibrazione.*`. Il riuso di `getCompsFromWork` e `ricostruisciWorkInSchema` avviene via import read-only dal codice dashboard.

---

## SQL chiave

### `dashboard:audit-crm` — works registrati del metodo

```sql
SELECT
  w.id, w.nome, w.conc, w.unita_conc, w.volume_ml, w.validita_mesi, w.livello,
  (SELECT MAX(wp.data_prep) FROM work_preparazioni wp WHERE wp.work_id = w.id) AS ultima_prep_data,
  (SELECT COUNT(*)
     FROM work_ingredienti wi JOIN composti c ON c.id = wi.source_id
     WHERE wi.work_id = w.id AND wi.source_type = 'crm' AND c.data_dismissione IS NOT NULL
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
ORDER BY w.nome
```

Per ogni Work ritornato, seconda query con la stessa forma di [work.ipc.ts:120-179](src/main/ipc/work.ipc.ts#L120-L179) per arricchire gli ingredienti con `source_nome`, `source_lotto`, `source_mix_id`, `source_mix_nome`, `source_cv`, `source_unita_conc`.

### `dashboard:audit-crm` — analiti accreditati

```sql
SELECT id, nome, alias_strumento, ordine
FROM metodo_analiti
WHERE metodo_id = @metodo_id AND accreditato = 1
ORDER BY ordine, nome
```

### `dashboard:audit-crm` — CRM validi per il metodo alla data (fallback)

```sql
SELECT DISTINCT
  c.id, c.nome, c.lotto, c.scadenza_prodotto, c.mix_id, c.forma_commerciale AS mix,
  c.concentrazione, c.unita_conc, c.data_apertura,
  (SELECT MAX(cs.nuova_scadenza) FROM composti_storia cs
    WHERE cs.composto_id = c.id AND cs.tipo='Rivalidazione'
      AND cs.nuova_scadenza IS NOT NULL AND cs.data <= @data) AS ultima_rivalidazione
FROM composti c
JOIN composti_metodi cm ON cm.composto_id = c.id
WHERE cm.metodo_id = @metodo_id
  AND (c.data_dismissione IS NULL OR c.data_dismissione > @data)
  AND (c.data_apertura IS NULL OR c.data_apertura <= @data)
```

Il renderer filtra poi per scadenza effettiva ≥ data.

---

## Render model Audit

```ts
type AuditRow =
  | {
      kind: 'work'
      work_id: number
      work_nome: string
      work_scadenza: string | null
      stato_work: StatoLab | null
      analiti_coperti: Array<{
        analita_nome: string
        alias_strumento: string | null
        crm_ingredienti: Array<{ composto_nome: string, lotto: string, scadenza_effettiva: string | null }>
      }>
    }
  | {
      kind: 'scoperto'  // analita accreditato non coperto da nessun Work
      analita_nome: string
      alias_strumento: string | null
      crm_disponibili: Array<{ id: number, nome: string, lotto: string, scadenza_effettiva: string }>
    }
```

La tabella UI mostra:
- Sezione "Work registrati" — un blocco per ogni Work, con header (nome Work + badge stato + scadenza) e righe analita sotto (nome analita, alias, CRM sottostanti)
- Sezione "Analiti scoperti" — solo se non vuota, con i CRM validi disponibili come suggerimento
- Sommario in testata: `N_accreditati`, `N_coperti`, `N_scoperti`, `N_work_scaduti/in_scadenza`

---

## Ordine di implementazione incrementale

Ogni step è committabile indipendentemente e lascia l'app funzionante.

1. **Skeleton** — rotta `/dashboard`, sidebar item, title mapping, pagina con 4 card vuote. Redirect default a `/dashboard`.
2. **KPI composti** — riga 1 usando `compostiApi.list()` + `computeStato` esistenti. Nessun IPC nuovo. Primo valore reale.
3. **IPC `dashboard:summary`** + **ScadenzeTimeline** cross-entità (composti + preparazioni + work).
4. **TracciabilitaCard** — stat Work con lotto mismatch + analiti scoperti.
5. **AuditCrmSection** — handler `dashboard:audit-crm`, form (select metodo, date picker), ricostruzione render model via `getCompsFromWork`, tabella.
6. **Modulo `pdfReport.ts`** + **export PDF Audit** (bottone in `AuditCrmSection`).
7. _(Futuro)_ Altri report (scadenze, inventario, snapshot) — fuori MVP, da definire.

---

## Verifica end-to-end

Dopo ogni step:
- `npm run dev` (Electron in dev) → la pagina carica, nessun errore in console
- Navigare `/dashboard` dalla sidebar → titolo "Dashboard" nel topbar
- Step 2+: verificare che i conteggi corrispondano a quelli visibili filtrando la pagina `/composti` per stato
- Step 3: creare in DB un composto con scadenza entro 7gg, una prep entro 30gg, una work non preparata → devono apparire nella timeline con bucket corretti
- Step 5: selezionare un metodo con analiti accreditati noti + data odierna → verificare che le Work del metodo (visibili in `/work`) compaiano come righe, e che gli analiti non coperti da nessuna Work compaiano in "Analiti scoperti"
- Step 5 (regressione): aprire un CRM nel DB Composti e dismetterlo → riaprire l'audit per lo stesso metodo → la Work che lo usa deve risultare `bloccata`, lo stato deve cambiare
- Step 6: cliccare "Esporta PDF" → il file generato deve aprirsi, avere copertina con statistiche, sommario dei Work, sezione scoperti, stile coerente al "Quaderno CRM"
- Regressione: `/composti` → `Esporta → PDF` → il "Quaderno CRM" esistente deve continuare a funzionare identico (nessuna modifica a `ExportDialog.tsx`)

## Assunzioni e rischi

- **Match per nome case-insensitive** (`LOWER()=LOWER()`): coerente con il resto del codebase (usato in [composti.ipc.ts:104-106](src/main/ipc/composti.ipc.ts#L104-L106) e [metodo-analiti.ipc.ts:39](src/main/ipc/metodo-analiti.ipc.ts#L39)). Non gestiamo sinonimi / typo.
- **`alias_strumento` mostrato in colonna dedicata** del report audit (utile al revisore). _Confermare all'utente in fase di revisione UI._
- **Work "al momento"** (`validita_mesi IS NULL`) sono escluse dall'audit per scelta esplicita utente.
- **`ricostruisciWorkInSchema`** può fallire se un Work intermedio dipende da un'altra Work non presente negli input — va gestito con fallback a lista ingredienti piatta.
- **Eluenti e consumabili fuori scope** — verranno aggiunti in una fase successiva con modello "scadenza" da definire.
