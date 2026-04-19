# Piano — Ristrutturazione blocco "Stato Tracciabilità" in Dashboard

## Context

La card "Analiti accreditati scoperti" nel blocco Stato Tracciabilità mostra solo un numero senza informazioni utili (non dice *quali* analiti sono scoperti), risultando in un KPI inazionabile. Analogamente, una card che somma work "bloccate" + "con CRM scaduti" dà conteggi ma non linka verso azioni concrete.

**Obiettivi:**
1. **Sostituire** la card "Analiti accreditati scoperti" con una card "Work da preparare" (work senza preparazioni attive o con preparazioni scadute/in scadenza) che linka a `/work` con un filtro dedicato: **l'utente vede la lista filtrata e preme "Prepara" sulla work specifica** (nessun dialog aperto automaticamente).
2. **Aggiungere** una sezione-elenco in stile "Scadenze prossimi 60 giorni" dentro lo stesso blocco Stato Tracciabilità, con:
   - **Analiti accreditati scoperti** (con nome analita + metodo + link a `/composti` quando esiste un composto scaduto/dismesso con quel nome)
   - **Analiti accreditati non coperti da CRM con accreditamento 17034** (stessa struttura)
3. **Riorganizzare il layout** del blocco tracciabilità in **due colonne**: a sinistra i 3 KPI + lista Work con problemi, a destra la sezione "Analiti scoperti" in stile lista.

## Approccio

### 1. Backend — estendere `dashboard:summary`

File: [src/main/ipc/dashboard.ipc.ts](src/main/ipc/dashboard.ipc.ts)

**1.a)** Cambiare `analiti_accreditati_scoperti` da semplice count a **lista** con dettaglio:

```sql
SELECT ma.nome AS analita_nome, ma.metodo_id, m.nome AS metodo_nome,
       (SELECT c.id FROM composti c
         WHERE LOWER(c.nome) = LOWER(ma.nome)
           AND c.data_dismissione IS NOT NULL
         ORDER BY c.data_dismissione DESC LIMIT 1) AS composto_dismesso_id,
       (SELECT c.id FROM composti c
         WHERE LOWER(c.nome) = LOWER(ma.nome)
           AND c.scadenza_prodotto < date('now')
           AND c.data_dismissione IS NULL
         LIMIT 1) AS composto_scaduto_id
FROM metodo_analiti ma
JOIN metodi m ON m.id = ma.metodo_id
WHERE ma.accreditato = 1
  AND NOT EXISTS (
    SELECT 1 FROM composti c
    WHERE LOWER(c.nome) = LOWER(ma.nome)
      AND c.data_dismissione IS NULL
  )
ORDER BY m.nome, ma.ordine, ma.nome
```

Il count `analiti_accreditati_scoperti` diventa `analiti_scoperti: AnaliteScopertoItem[]` con `length` per il conteggio.

**1.b)** Aggiungere nuovo elenco `analiti_non_coperti_17034`: analiti accreditati che hanno un composto matchato per nome, ma **nessuno** ha `accreditamento_crm LIKE '%17034%'`:

```sql
SELECT ma.nome AS analita_nome, ma.metodo_id, m.nome AS metodo_nome
FROM metodo_analiti ma
JOIN metodi m ON m.id = ma.metodo_id
WHERE ma.accreditato = 1
  AND EXISTS (
    SELECT 1 FROM composti c
    WHERE LOWER(c.nome) = LOWER(ma.nome)
      AND c.data_dismissione IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM composti c
    WHERE LOWER(c.nome) = LOWER(ma.nome)
      AND c.data_dismissione IS NULL
      AND c.accreditamento_crm LIKE '%17034%'
  )
ORDER BY m.nome, ma.ordine, ma.nome
```

**1.c)** Aggiungere nuovo count `work_da_preparare`.

**Logica definita**: work **attive** (`archiviato = 0`), **tracciate** (`validita_mesi IS NOT NULL`), **non bloccate** (nessun CRM dismesso fra gli ingredienti) e con `stato_lab ∈ {'non_preparata', 'scaduta', 'in_scadenza'}`. Si **escludono esplicitamente** le work bloccate (flusso "aggiorna schema") e quelle con solo CRM scaduti senza problema di preparazione (altro flusso). L'intersezione con "ha_crm_scaduti" è ammessa solo se anche la preparazione è scaduta/in scadenza/mancante.

Query SQL dedicata in `dashboard:summary`: riutilizzare le stesse CTE di `work:list` per `n_bloccati` e derivare `stato_lab` lato SQL (impossibile direttamente, meglio replicare il calcolo JS lato server con una CTE su `ultima_prep_data` + `validita_mesi`). **Alternativa semplice**: restituire dal summary anche `work_preparazioni_summary` (data_prep ultima + validita) e lasciare il calcolo al renderer, che già lo fa per la timeline.

**Scelta**: implementare il count **lato main** con una query che:
1. Calcola `ultima_prep_data` per ogni work tracciata non archiviata
2. Esclude le work con `n_bloccati > 0`
3. Per ogni work residua calcola in SQL: `scadenza_prep = DATE(ultima_prep_data, '+' || CAST(validita_mesi * 30.44 AS INT) || ' days')` e classifica come da preparare se `ultima_prep_data IS NULL` (non preparata) oppure `scadenza_prep < DATE('now', '+' || CAST(validita_mesi * 30.44 * 0.2 AS INT) || ' days')` (scaduta o entro soglia 20% di `in_scadenza`, coerente con `calcolaStatoLab` in [work.ipc.ts](src/main/ipc/work.ipc.ts)).

**Output finale** del summary:
```ts
stats_tracciabilita: {
  work_con_lotto_mismatch: number
  work_da_preparare: number
  analiti_scoperti: { analita_nome, metodo_id, metodo_nome, composto_dismesso_id, composto_scaduto_id }[]
  analiti_non_coperti_17034: { analita_nome, metodo_id, metodo_nome }[]
}
```

### 2. Frontend — filtro "Work da preparare" in WorkPage

File: [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx#L57)

**2.a)** Estendere la gestione di `location.state` già presente (linee 57-68) aggiungendo `filtroStatoLab?: 'da_preparare'`.

**2.b)** Aggiungere nel `useMemo` di `filtered` (linea 78) un filtro: se `filtroStatoLab === 'da_preparare'`, includere solo `w` con `stato_lab ∈ {'non_preparata', 'scaduta', 'in_scadenza'}` (reutilizza il computed field già restituito da `work:list`).

**2.c)** Aggiungere in testa alla lista una **barra di stato filtro attivo** (badge rimovibile "Filtro: Work da preparare × ") quando il filtro è attivo, per UX chiara.

### 3. Frontend — ristrutturare `TracciabilitaCard`

File: [src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx](src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx)

**3.a) Layout a 2 colonne** (`grid grid-cols-1 lg:grid-cols-2 gap-4`):

- **Colonna sinistra** — i 3 KPI (verticalmente stacked) + lista compatta Work con problemi:
  1. **Work bloccate** (invariata, link a `/work`)
  2. **Work con CRM scaduti** (invariata, link a `/work`)
  3. **Work da preparare** *(nuova, sostituisce "Analiti accreditati scoperti")*:
     - Conta: `stats.work_da_preparare`
     - Sottotitolo: "Senza prep attiva o scaduta/in scadenza"
     - Click → `nav('/work', { state: { filtroStatoLab: 'da_preparare' } })`

- **Colonna destra** — nuovo componente `AnalitiScopertiList`:
  - Due sezioni collassabili (pattern `Sezione` copiato da `ScadenzeTimeline`):
    - **"Analiti accreditati scoperti"** (rosso), count = `analiti_scoperti.length`
    - **"Accreditati senza CRM 17034"** (giallo/ambra), count = `analiti_non_coperti_17034.length`
  - Righe:
    - Nome analita (principale) + nome metodo (secondario)
    - Per "scoperti": se esiste `composto_dismesso_id` o `composto_scaduto_id`, riga cliccabile che fa `nav('/composti', { state: { searchFilter: item.analita_nome } })`; altrimenti riga non interattiva.
    - Per "non coperti 17034": riga cliccabile verso `/composti` con filtro nome.

**3.b)** Lascia invariati:
- L'alert warning "lotto mismatch" (linea 89-93), ma **spostalo fuori dalla grid 2-col**, in testa al card (full-width).
- La lista "Work con problemi" (linea 96-115) resta sotto la colonna sinistra.

### 4. Riutilizzo componenti esistenti

- Pattern `Sezione` collassabile: copiare da [ScadenzeTimeline.tsx:170-205](src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx#L170-L205). **Valutare** estrazione in modulo condiviso `src/renderer/pages/dashboard/lib/SezioneCollassabile.tsx` se ≥3 usi; altrimenti duplicare inline (minimale).
- `useDbChange` già usato per live refresh.
- `dashboardApi.summary()` da `@/lib/api` — estendere tipo TypeScript in [src/renderer/lib/api.ts] per matchare il nuovo shape.

## File coinvolti

| File | Tipo modifica |
|---|---|
| [src/main/ipc/dashboard.ipc.ts](src/main/ipc/dashboard.ipc.ts) | Estensione SQL `dashboard:summary` — nuovi campi |
| [src/renderer/lib/api.ts](src/renderer/lib/api.ts) | Aggiornare tipo `DashboardSummary` |
| [src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx](src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx) | Refactor layout 2 colonne + nuova card + lista analiti |
| [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx#L57) | Supporto `filtroStatoLab` da `location.state` + badge filtro attivo |

**Non toccati**: [ScadenzeTimeline.tsx](src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx) (pattern di riferimento), [KpiCards.tsx](src/renderer/pages/dashboard/sections/KpiCards.tsx), [DashboardPage.tsx](src/renderer/pages/dashboard/DashboardPage.tsx), [work.ipc.ts](src/main/ipc/work.ipc.ts) (il campo `stato_lab` è già calcolato).

## Verifica end-to-end

1. **Backend** — lanciare `npm run dev` e verificare in devtools che `dashboardApi.summary()` restituisca i nuovi campi `analiti_scoperti[]`, `analiti_non_coperti_17034[]`, `work_da_preparare`.
2. **Card "Work da preparare"** — cliccarla, verificare navigazione a `/work` con filtro attivo; il numero nella card deve coincidere con le righe visualizzate.
3. **Lista "Analiti scoperti"** — aprire la sezione, verificare che:
   - Compaia un item per ogni coppia (metodo, analita) accreditato senza composto attivo con stesso nome.
   - Il click porti a `/composti` con il nome pre-filtrato, quando esiste un composto scaduto/dismesso corrispondente.
4. **Lista "Senza CRM 17034"** — verificare che compaiano solo analiti per cui esiste un CRM attivo col nome ma `accreditamento_crm` non contiene "17034".
5. **Layout responsive** — ridurre finestra sotto lg: le due colonne devono impilarsi verticalmente.
6. **Live refresh** — modificare un composto (dismettere / cambiare accreditamento) e verificare aggiornamento automatico grazie a `useDbChange`.

## Decisioni prese (confermate con utente)

- **Work da preparare**: esclude bloccate (CRM dismesso → altro flusso "aggiorna schema") ed esclude quelle dove l'unico problema sono CRM scaduti senza problema di preparazione (altro flusso dedicato). Include solo: `non_preparata`, `scaduta`, `in_scadenza`.
- **Click card "Work da preparare"**: apre solo `/work` con filtro `filtroStatoLab: 'da_preparare'`, **senza** auto-aprire il dialog di preparazione. L'utente preme poi "Prepara" sulla work voluta.
- **Lista analiti scoperti**: una riga per **coppia (metodo, analita)** — struttura coerente con `metodo_analiti` nel DB.
- **Struttura liste scoperti / 17034**: **lista piatta** (no bucket temporali), raggruppata per metodo per leggibilità.
- **Click righe analiti scoperti / 17034**: righe cliccabili → `nav('/composti', { state: { searchFilter: analita_nome } })` (coerente con pattern ScadenzeTimeline).

## Note operative

- Non modificare file fuori scope (rispetto CLAUDE.md § "File critici"). In particolare `CompostiTable.tsx`, `StoriaDialog.tsx`, `CompostiPage.tsx` non vanno toccati: il routing verso composti usa solo il meccanismo `location.state.searchFilter` già esistente.
- La query "17034" usa `LIKE '%17034%'`: il campo `accreditamento_crm` è testo libero — accettiamo qualsiasi stringa che contenga "17034". Se in futuro serve logica più strutturata, valutare migrazione dedicata.
