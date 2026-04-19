# Audit CRM — info preparazioni + warning prep scadute + fix Ricarica

## Context

Tre richieste sulla pagina Audit e sullo Schema Calibrazione:

1. **Pagina Audit poco informativa sui CRM**: nella schermata audit, i CRM mostrati all'interno dei Work non riportano la scadenza né informazioni sulle preparazioni Neat (es. flacone/lotto prep, data prep, scadenza prep). Questo si riflette anche nel report PDF. L'utente vuole più contesto per valutare la copertura alla data di audit.

2. **Preparazioni Neat scadute non evidenziate**: i Work che usano preparazioni Neat con CRM scaduti alla data di audit devono essere visivamente segnalati sia in UI che in PDF. Oggi esiste `ha_crm_scaduti` (badge ambra), ma il flag copre solo gli ingredienti `source_type='crm'`: un Work che usa un CRM **tramite** una preparazione Neat (`source_type='prep'`) non viene marcato.

3. **Bug Ricarica da Schema Calibrazione**: cliccando la chip "⚠ Prep stock scadute" in [SchemaCalibrazione.tsx:267-271](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L267-L271) si apre `RicaricaDialog` che risulta vuoto — non si vedono preparazioni né pulsante Conferma attivo. Causa: la query [work.ipc.ts:546-562](src/main/ipc/work.ipc.ts#L546-L562) di `check-lot-status` filtra `WHERE wi.source_type = 'crm'`, escludendo totalmente gli ingredienti `source_type = 'prep'`. Quando un Work ha solo preparazioni scadute (e nessun CRM scaduto), il dialog riceve array vuoto e il pulsante "Conferma e Ricarica" resta disabilitato (`daRisolvere.length === 0`).

Outcome atteso: audit più ricco e fedele, evidenziazione delle catene CRM→Prep scadute, e ricarica da chip funzionante.

---

## Decisioni di scope

- **Informazioni prep mostrate nei CRM coperti**: per ogni CRM sottostante a un analita, mostriamo (oltre a nome/lotto/scadenza già presenti) anche la preparazione Neat quando il Work usa quel CRM via `source_type='prep'` — cioè `flacone_prep · data_prep · scadenza_prep`. Per ingredienti `source_type='crm'` resta la visualizzazione attuale (nome · lotto · scadenza effettiva).
- **Definizione "CRM scaduto alla data di audit" esteso alle prep**: un Work è marcato `ha_prep_scadute_at_data` (nuovo flag dedicato) se almeno un suo ingrediente `source_type='prep'` punta a una preparazione con `scadenza < @data` (e non dismessa alla data). Lasciamo `ha_crm_scaduti` invariato per retrocompatibilità, e aggiungiamo il nuovo flag.
- **Badge/evidenziazione**: un Work che ha `ha_prep_scadute_at_data=true` riceve badge ambra distinto "⚠ Prep Neat scadute" in UI, e banner PDF. Se è già bloccata, il badge scaduti resta nascosto (come già per CRM scaduti oggi).
- **Fix Ricarica**: estendere `check-lot-status` per gestire anche `source_type='prep'`, trattando ciascuna preparazione scaduta/dismessa come un "ingrediente da risolvere" con sostituti = altre preparazioni attive dello stesso composto. La logica `work:ricarica` già gestisce `source_type='prep'` (linee 637-649), quindi serve solo alimentare i dati di scelta.

## Out of scope

- Non tocchiamo [CompostiTable.tsx](src/renderer/pages/composti/CompostiTable.tsx), [StoriaDialog.tsx](src/renderer/pages/composti/StoriaDialog.tsx), [CompostiPage.tsx](src/renderer/pages/composti/CompostiPage.tsx) — file critici.
- Non riscriviamo `RicaricaDialog` — aggiungiamo solo il ramo per gli ingredienti `prep`.
- Nessun refactor del calcolo del model audit oltre alle nuove derivazioni.

---

## Implementazione

### 1. Backend — dashboard IPC: arricchire ingredienti con info prep e nuovo flag

File: [src/main/ipc/dashboard.ipc.ts](src/main/ipc/dashboard.ipc.ts)

**1.1** Nella query `works` ([dashboard.ipc.ts:154-187](src/main/ipc/dashboard.ipc.ts#L154-L187)), aggiungere una subquery `n_prep_scadute_at_data` che conta gli ingredienti `source_type='prep'` dove la preparazione ha `scadenza < @data` e non era dismessa alla data:

```sql
(SELECT COUNT(*)
   FROM work_ingredienti wi
   JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
   WHERE wi.work_id = w.id
     AND wi.source_type = 'prep'
     AND (p.data_dismissione IS NULL OR p.data_dismissione > @data)
     AND p.scadenza IS NOT NULL
     AND p.scadenza < @data
) AS n_prep_scadute_at_data
```

**1.2** Nella `stmtIngredienti` ([dashboard.ipc.ts:190-248](src/main/ipc/dashboard.ipc.ts#L190-L248)), aggiungere colonne per gli ingredienti `prep`:

```sql
CASE WHEN wi.source_type = 'prep' THEN
  (SELECT p.flacone FROM preparazioni p WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
END AS source_prep_flacone,
CASE WHEN wi.source_type = 'prep' THEN
  (SELECT p.data_prep FROM preparazioni p WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
END AS source_prep_data_prep,
CASE WHEN wi.source_type = 'prep' THEN
  (SELECT p.scadenza FROM preparazioni p WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
END AS source_prep_scadenza,
CASE WHEN wi.source_type = 'prep' THEN
  (SELECT p.data_dismissione FROM preparazioni p WHERE p.id = COALESCE(wi.prep_id, wi.source_id))
END AS source_prep_dismissione
```

**1.3** Nel `map` ([dashboard.ipc.ts:250-259](src/main/ipc/dashboard.ipc.ts#L250-L259)) estrarre e restituire il nuovo flag:

```ts
const { n_bloccati, n_scaduti, n_prep_scadute_at_data, ...rest } = w
...
ha_prep_scadute_at_data: (n_prep_scadute_at_data as number) > 0,
```

### 2. Model audit — propagare info prep e nuovo flag

File: [src/renderer/pages/dashboard/lib/auditModel.ts](src/renderer/pages/dashboard/lib/auditModel.ts)

**2.1** Estendere `CrmUsato` ([auditModel.ts:19-24](src/renderer/pages/dashboard/lib/auditModel.ts#L19-L24)) con campi prep opzionali:

```ts
export type CrmUsato = {
  composto_id: number
  composto_nome: string
  lotto: string | null
  scadenza_effettiva: string | null
  // Opzionali: presenti quando il CRM è usato via preparazione Neat
  prep_flacone?: string | null
  prep_data_prep?: string | null
  prep_scadenza?: string | null
  prep_scaduta?: boolean   // scadenza < dataRif
}
```

**2.2** Estendere `AuditWorkRow` ([auditModel.ts:33-42](src/renderer/pages/dashboard/lib/auditModel.ts#L33-L42)) con `ha_prep_scadute_at_data: boolean`.

**2.3** Estendere `AuditCrmInput.works_registrati` logicamente (tipo `any[]`) — nessun cambiamento di tipo esplicito necessario.

**2.4** Nella costruzione `crmUsatiInWork` ([auditModel.ts:177-195](src/renderer/pages/dashboard/lib/auditModel.ts#L177-L195)), quando `ing.source_type === 'prep'`, memorizzare oltre al CrmItem anche le info prep associate. Soluzione: creare una mappa parallela `prepInfoByCompostoId: Map<number, {flacone, data_prep, scadenza, prep_scaduta}>` alimentata dai campi `source_prep_*` dell'ingrediente. Nota: se più prep diverse dello stesso composto sono usate nel Work, teniamo la più "problematica" (scaduta ha precedenza).

**2.5** In `crmSottostanti` ([auditModel.ts:214-219](src/renderer/pages/dashboard/lib/auditModel.ts#L214-L219)), arricchire l'oggetto con i campi `prep_*` se `prepInfoByCompostoId.has(c.id)`. Il calcolo `prep_scaduta` = `prep.scadenza < input.data`.

**2.6** Calcolare `ha_prep_scadute_at_data` = `!!wRaw.ha_prep_scadute_at_data` e inserirlo nel push di `righe_work` ([auditModel.ts:244-253](src/renderer/pages/dashboard/lib/auditModel.ts#L244-L253)).

### 3. UI Audit — mostrare info prep e badge

File: [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx)

**3.1** In `WorkRowBlock` ([AuditCrmSection.tsx:31-85](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx#L31-L85)):
- Dopo il badge `ha_crm_scaduti` aggiungere un badge ambra (o rosso se scaduta+bloccata) `⚠ Prep Neat scadute` quando `row.ha_prep_scadute_at_data && !row.bloccata`.
- Nei CRM badge ([AuditCrmSection.tsx:68-77](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx#L68-L77)), estendere la render: aggiungere una riga sotto al nome/lotto con `scad. {scadenza_effettiva}` (anche per i CRM diretti), e — se presente `c.prep_flacone` — una seconda riga `prep: {flacone} · {data_prep} · scad. {prep_scadenza}` con colore rosso quando `c.prep_scaduta`.
- Classe del badge CRM: se `c.prep_scaduta` applicare `bg-red-50 text-red-900 border-red-300` invece della viola.

### 4. PDF — sommario, scheda work, sezione prep scadute

File: [src/renderer/pages/dashboard/lib/auditReport.ts](src/renderer/pages/dashboard/lib/auditReport.ts)

**4.1** Sommario ([auditReport.ts:103-125](src/renderer/pages/dashboard/lib/auditReport.ts#L103-L125)) — nella colonna "Flag" aggiungere `PREP SCAD` quando `w.ha_prep_scadute_at_data`.

**4.2** Banner `drawWorkSheet` ([auditReport.ts:185-232](src/renderer/pages/dashboard/lib/auditReport.ts#L185-L232)) — dopo il flag "CRM SCADUTI" aggiungere pillola ambra "PREP SCADUTE" quando `w.ha_prep_scadute_at_data`. Gestire avanzamento `flagX`.

**4.3** Tabella analiti ([auditReport.ts:250-270](src/renderer/pages/dashboard/lib/auditReport.ts#L250-L270)) — nella colonna "CRM sottostanti", estendere la stringa per includere la scadenza e, se presente, la riga `prep: {flacone} · {data_prep} · scad {scadenza} [SCADUTA]`. Il formato multi-riga via `\n` è già supportato da autoTable.

**4.4** Colorare la cella quando almeno un CRM ha `prep_scaduta`: tramite `didParseCell` impostare `cellStyles` con `fillColor` rosso chiaro (coerente con `PDF_COLORS.statoScaduto`).

### 5. Fix Ricarica — includere preparazioni nel check-lot-status

File: [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts)

**5.1** In `work:check-lot-status` ([work.ipc.ts:546-595](src/main/ipc/work.ipc.ts#L546-L595)), rimuovere il filtro `AND wi.source_type = 'crm'` e fare SELECT condizionale:

```sql
SELECT wi.id, wi.source_id, wi.prep_id, wi.lotto_usato, wi.source_type,
  CASE WHEN wi.source_type = 'crm' THEN c.nome
       WHEN wi.source_type = 'prep' THEN cp.nome
  END AS nome,
  CASE WHEN wi.source_type = 'crm' THEN c.lotto
       WHEN wi.source_type = 'prep' THEN p.flacone
  END AS lotto_corrente,
  CASE WHEN wi.source_type = 'crm' THEN c.data_dismissione
       WHEN wi.source_type = 'prep' THEN p.data_dismissione
  END AS data_dismissione,
  CASE WHEN wi.source_type = 'crm' THEN c.mix_id END AS mix_id,
  CASE WHEN wi.source_type = 'crm' THEN c.forma_commerciale END AS forma_commerciale,
  CASE WHEN wi.source_type = 'crm' THEN c.scadenza_prodotto
       WHEN wi.source_type = 'prep' THEN p.scadenza
  END AS scadenza_prodotto,
  CASE WHEN wi.source_type = 'crm' THEN (SELECT MAX(...) FROM composti_storia ...)
  END AS ultima_rivalidazione,
  cp.id AS prep_composto_id
FROM work_ingredienti wi
LEFT JOIN composti c ON wi.source_type='crm' AND c.id = wi.source_id
LEFT JOIN preparazioni p ON wi.source_type='prep' AND p.id = COALESCE(wi.prep_id, wi.source_id)
LEFT JOIN composti cp ON wi.source_type='prep' AND cp.id = p.composto_id
WHERE wi.work_id = ? AND wi.source_type IN ('crm','prep')
```

**5.2** Nel mapping successivo, quando `source_type='prep'`:
- `isScaduto` = `p.scadenza < oggi && !p.data_dismissione`
- Se stato non-ok, cercare `sostituti`: altre preparazioni attive dello stesso `composto_id`:
  ```sql
  SELECT p2.id AS id, p2.flacone AS lotto, p2.concentrazione, p2.unita_conc, NULL AS mix_id
  FROM preparazioni p2
  WHERE p2.composto_id = ?
    AND p2.id != ?
    AND p2.data_dismissione IS NULL
    AND (p2.scadenza IS NULL OR p2.scadenza >= ?)
  ORDER BY p2.id DESC
  ```
- Mappare il risultato sulla stessa shape `{id, lotto, concentrazione, unita_conc, mix_id}` usata dal renderer, così `RicaricaDialog` lo renderizza invariato.
- IMPORTANTE: per gli ingredienti `prep`, `source_id` nel dialog viene usato come chiave di `scelte`. Dato che il dialog usa `old_source_id → new_source_id` e `work:ricarica` per i `prep` rilegge poi `prep_id` ([work.ipc.ts:637-649](src/main/ipc/work.ipc.ts#L637-L649)), assicurarsi che il `source_id` ritornato dal check sia l'ID della preparazione (coerente con come `work:ricarica` calcola `newSrcId`). Verificare che i due percorsi siano allineati leggendo `work:ricarica` prima di finalizzare.

**5.3** Verificare `work:ricarica` ([work.ipc.ts:597-660+](src/main/ipc/work.ipc.ts#L597)): il ramo `if (ing.source_type === 'prep')` già sostituisce `prep_id = newSrcId`. Il nostro `check-lot-status` deve quindi ritornare per gli ingredienti prep `source_id` = id preparazione originale (quello usato come chiave di `scelte` → `nuovi_ingredienti[].old_source_id`), e sostituti con `id` = id nuova preparazione.

### 6. RicaricaDialog — piccoli adattamenti label

File: [src/renderer/pages/work/RicaricaDialog.tsx](src/renderer/pages/work/RicaricaDialog.tsx)

Nessuna modifica strutturale. Solo:
- Nella label del gruppo ([RicaricaDialog.tsx:244-252](src/renderer/pages/work/RicaricaDialog.tsx#L244-L252), [316](src/renderer/pages/work/RicaricaDialog.tsx#L316), etc.), quando `rep.source_type === 'prep'` mostrare "Prep: {nome}" invece del solo nome, per distinguere visivamente preparazioni da CRM. La shape dei membri già include `source_type` se il backend lo restituisce, quindi basta renderizzarlo.
- Il testo "Lotto attuale (dismesso/scaduto)" va bene per entrambi (flacone = lotto_corrente).

---

## File modificati (riepilogo)

- [src/main/ipc/dashboard.ipc.ts](src/main/ipc/dashboard.ipc.ts) — query `works` + `stmtIngredienti` + flag nuovo
- [src/main/ipc/work.ipc.ts](src/main/ipc/work.ipc.ts) — handler `work:check-lot-status` esteso alle prep
- [src/renderer/pages/dashboard/lib/auditModel.ts](src/renderer/pages/dashboard/lib/auditModel.ts) — tipi `CrmUsato`/`AuditWorkRow` + propagazione info prep + flag
- [src/renderer/pages/dashboard/lib/auditReport.ts](src/renderer/pages/dashboard/lib/auditReport.ts) — sommario flag, banner, cella analiti, colori
- [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx) — badge nuovo + rendering prep in CRM badge
- [src/renderer/pages/work/RicaricaDialog.tsx](src/renderer/pages/work/RicaricaDialog.tsx) — label "Prep: ..." per ingredienti prep

## File chiave già esistenti da riusare

- `calcolaStatoLabAllaData` in [scadenzeModel.ts:43](src/renderer/pages/dashboard/lib/scadenzeModel.ts#L43) — invariato
- `ricostruisciWorkInSchema` / `getCompsFromWork` in [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — invariato
- `work:ricarica` in [work.ipc.ts:597](src/main/ipc/work.ipc.ts#L597) — già gestisce il ramo prep, non va toccato
- `PDF_COLORS`, `tableBodyStyle`, `tableHeaderStyle` in [pdfReport.ts](src/renderer/lib/pdfReport.ts) — invariati

---

## Verifica

### Audit UI
1. Avvia l'app (`npm run dev` o equivalente)
2. Dashboard → Audit CRM: scegli un metodo che ha almeno un Work che usa preparazioni Neat scadute. Data audit = oggi.
3. Verifica che:
   - Ogni CRM badge sotto gli analiti mostri la scadenza effettiva
   - Per i Work che usano prep Neat, il badge mostri anche `prep: {flacone} · {data} · scad {scadenza}`
   - Se la prep è scaduta, il badge CRM è rosso e compare il badge ambra "⚠ Prep Neat scadute" nell'header del Work

### Audit PDF
4. Clicca "Esporta PDF" e verifica:
   - Sommario: colonna Flag contiene `PREP SCAD` per i Work interessati
   - Scheda Work: banner mostra la pillola "PREP SCADUTE"
   - Tabella analiti: la cella CRM sottostanti include la riga prep e ha sfondo rosso chiaro quando scaduta

### Ricarica da Schema Calibrazione
5. Vai su Metodi → Schema Calibrazione di un metodo con un Work che ha **solo** preparazioni scadute (nessun CRM scaduto)
6. Verifica che la chip "⚠ Prep stock scadute" sia visibile sulla card Work
7. Click sul pulsante "Ricarica ↻" — il dialog deve ora mostrare:
   - Sezione "Scelta richiesta" o "Sostituzione automatica" con la prep scaduta
   - Label tipo "Prep: {nome composto}" e lotto attuale = flacone prep
   - Sostituti = altre preparazioni attive dello stesso composto (se esistono), altrimenti stato "mancante" con pulsante verso DB
8. Conferma la ricarica e verifica che la nuova work venga creata con `prep_id` aggiornato (già gestito da `work:ricarica`)

### Edge case
9. Work con mix CRM + prep scadute → entrambi devono apparire nel dialog
10. Work senza preparazioni scadute ma con CRM scaduti → comportamento invariato
11. PDF audit per un metodo senza work con prep scadute → nessuna pillola aggiunta, output invariato
