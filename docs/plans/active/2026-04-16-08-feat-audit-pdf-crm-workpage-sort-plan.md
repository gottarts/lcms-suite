# Piano: Audit PDF — sezione CRM + WorkPage ordinamento per data prep

## Context

Due miglioramenti indipendenti:

1. **Export PDF Audit**: il PDF attuale include solo le schede Work. L'utente vuole aggiungere una sezione che mostra le schede complete (stile "Quaderno CRM") dei CRM coinvolti nelle work che coprono almeno 1 analita accreditato.

2. **WorkPage ordinamento**: le work sono ordinate per `created_at DESC` (data creazione). L'utente vuole che siano ordinate per `ultima_prep_data ASC` (le più recentemente preparate vanno in fondo), così Prepara/Rinnova sposta la riga verso il basso.

---

## Task 1 — Sezione CRM nel PDF Audit

### File da modificare

- `src/renderer/pages/dashboard/lib/auditModel.ts`
- `src/renderer/pages/dashboard/lib/auditReport.ts`
- `src/main/ipc/dashboard.ipc.ts`

### Step 1 — Estendere AuditModel con dati CRM (`auditModel.ts`)

Aggiungere `crm_coinvolti: CrmDetailRow[]` all'`AuditModel`.

```ts
export type CrmDetailRow = {
  composto_id: number
  composto_nome: string
  lotto: string | null
  produttore: string | null
  concentrazione: number | null
  unita_conc: string | null
  forma: string | null
  scadenza_prodotto: string | null
  ultima_rivalidazione: string | null
  scadenza_effettiva: string | null  // ultima_rivalidazione ?? scadenza_prodotto
  destinazione_uso: string | null
}
```

In `buildAuditModel`, dopo la costruzione di `righe_work`, raccogliere i CRM unici:
- Iterare tutte le `righe_work`
- Per ogni `analiti_coperti`, per ogni `crm_ingredienti`, raccogliere `composto_id` unici
- Per ogni id unico, cercare il `CrmItem` in `crmItems` (già disponibile nella funzione)
- Costruire `CrmDetailRow` dal `CrmItem`
- Deduplicare per `composto_id`
- Ordinare per `composto_nome`

Aggiungere `crm_coinvolti` all'oggetto restituito da `buildAuditModel`.
Aggiungere il conteggio `n_crm` nelle stats (opzionale, utile per copertina).

### Step 2 — Aggiungere sezione CRM al PDF (`auditReport.ts`)

Aggiungere la funzione `drawCrmSheet(doc, crm: CrmDetailRow)` e la sezione nel flusso principale:

**Posizione**: dopo le schede Work (`for (const w of model.righe_work)`), prima della sezione "Analiti scoperti".

**Struttura sezione CRM** (ispirata a ExportDialog.tsx `exportPDF`):
1. `doc.addPage()` + banner grigio chiaro + titolo "CRM coinvolti nell'audit" + conteggio
2. Tabella sommario con colonne: `Nome · Lotto · Scadenza effettiva · Stato`
3. Loop `for (const crm of model.crm_coinvolti)`: `doc.addPage()` + `drawCrmSheet(doc, crm)`

**`drawCrmSheet`**:
- Banner header con nome CRM (stile simile a `drawWorkSheet`)
- Badge stato (Attivo / In scadenza / Scaduto / Dismesso) basato su `scadenza_effettiva`
- Tabella 2-colonne (label | valore) con: Lotto, Produttore, Concentrazione + unità, Forma, Scadenza prodotto, Ultima rivalidazione, Destinazione d'uso

I dati per la scheda CRM (lotto, produttore, concentrazione, forma, scadenza, rivalidazione, destinazione_uso) sono già in `CrmItem` (che viene da `crm_validi` nell'IPC) — nessuna query aggiuntiva necessaria.

### Step 3 — Verificare che `crm_validi` nell'IPC contenga tutti i campi necessari (`dashboard.ipc.ts`)

Verificare che la query `crm_validi` in `dashboard:audit-crm` includa: `lotto, produttore, concentrazione, unita_conc, forma, scadenza_prodotto, ultima_rivalidazione, destinazione_uso`. Aggiungere eventuali campi mancanti alla SELECT.

---

## Task 2 — Ordinamento WorkPage per data prep

### File da modificare

- `src/main/ipc/work.ipc.ts`
- (eventualmente `src/renderer/pages/work/WorkPage.tsx` se si vuole ordinamento lato renderer)

### Approccio: ordinamento in SQL

Il campo `_up_data_prep` (già calcolato nella subquery di `work:list`) contiene l'ultima data di preparazione. Modificare l'`ORDER BY` della query `work:list`:

```sql
-- Attuale
ORDER BY w.created_at DESC

-- Nuovo
ORDER BY
  CASE WHEN _up_data_prep IS NULL THEN 0 ELSE 1 END ASC,  -- work non preparate in cima
  _up_data_prep ASC  -- le più recentemente preparate in fondo
```

> Nota: SQLite non permette alias di subquery nell'ORDER BY direttamente in tutti i casi. La subquery `_up_data_prep` è già espressa inline — se l'alias non funziona nell'ORDER BY, replicare la subquery:
> ```sql
> ORDER BY
>   CASE WHEN (SELECT wp.data_prep FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) IS NULL THEN 0 ELSE 1 END ASC,
>   (SELECT wp.data_prep FROM work_preparazioni wp WHERE wp.work_id = w.id ORDER BY wp.data_prep DESC LIMIT 1) ASC
> ```

Le work senza preparazioni (stato `non_preparata`) rimarranno in testa, ordinate per `created_at DESC` tra di loro (comportamento naturale o accettabile).

---

## File critici

| File | Modifica |
|------|----------|
| `src/renderer/pages/dashboard/lib/auditModel.ts` | Aggiungere tipo `CrmDetailRow`, popolare `crm_coinvolti` in `buildAuditModel` |
| `src/renderer/pages/dashboard/lib/auditReport.ts` | Aggiungere `drawCrmSheet`, loop sezione CRM nel flusso PDF |
| `src/main/ipc/dashboard.ipc.ts` | Verificare/aggiungere campi a `crm_validi` SELECT |
| `src/main/ipc/work.ipc.ts` | Cambiare `ORDER BY` in `work:list` |

---

## Verifica

1. **Audit PDF CRM**: eseguire un audit con metodo che ha work e CRM → esportare PDF → controllare che dopo le schede Work compaia la sezione "CRM coinvolti" con sommario + schede individuali
2. **Audit PDF senza CRM**: audit senza work che coprono analiti → sezione CRM assente (o con messaggio vuoto)
3. **WorkPage ordinamento**: aprire WorkPage → le work senza prep sono in cima; le work preparate sono ordinate dal preparato meno recente (in alto) al più recente (in basso); fare Prepara → la work scende in fondo alla lista
