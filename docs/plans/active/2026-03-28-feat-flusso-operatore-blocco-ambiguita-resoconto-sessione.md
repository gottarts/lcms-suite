# Resoconto sessione — Flusso operatore: blocco preparazione e archiviazione automatica work

**Data:** 2026-03-28
**Oggetto:** Implementazione del flusso operatore per gestione lotti ambigui e archiviazione automatica work bloccate

---

## Cosa è stato fatto

Sessione di design e implementazione del flusso operatore per la gestione delle work in laboratorio. Il punto di partenza era una riflessione ad alto livello su come dovrebbe funzionare il sistema: l'operatore può preparare una work solo se tutti i CRM ingredienti hanno un unico lotto valido e non ambiguo. In caso di problemi (CRM dismesso o più lotti validi), deve tornare allo Schema per aggiornare e ricreare la work.

- **Design del flusso** in plan mode, con discussione delle alternative (schema mutabile vs versionato, RicaricaDialog vs flusso schema-centrico)
- **Aggiunto rilevamento ambiguità**: `work.bloccata` ora scatta anche per CRM con ≥2 lotti validi con lo stesso nome (non solo per CRM dismessi)
- **Aggiunto `motivo_blocco`** (`'dismesso' | 'ambiguo' | null`) sia in `work:list` che `work:get`
- **Rimosso `RicaricaDialog`** da WorkPage e WorkDrawer; sostituito con banner contestuale + pulsante "Vai allo Schema ↗"
- **WorkCard aggiornata**: pulsante "Schema ↗" visibile sempre (arancione + testo "Aggiorna Schema ↗" se bloccata), badge distingue "CRM dismessi" da "Lotti ambigui"
- **Archiviazione automatica in `salvaWorkNelDb`**: se la work ha già un `dbId` nel DB e risulta bloccata, la nuova work creata dallo schema archivia automaticamente quella vecchia con motivo tracciato

---

## Feature aggiunte

### Rilevamento ambiguità CRM in work.bloccata

**Motivazione:** Una work con CRM non dismesso ma con più lotti validi (stesso nome, tutti non dismessi) non veniva bloccata. L'operatore poteva registrare preparazioni su una work che faceva riferimento a un lotto che potrebbe non essere quello corretto.

**Implementazione:**
- In `work:list` (IPC): aggiunta subquery che conta ingredienti CRM non dismessi per cui esistono ≥2 record con lo stesso nome non dismessi in `composti`. Campo `n_ingredienti_ambigui`.
- In `work:get` (IPC): aggiunto `n_lotti_validi_stesso_nome` alla query ingredienti, calcolato con subquery.
- `bloccata = (n_bloccati > 0) OR (n_ambigui > 0)`. Campo `motivo_blocco` per distinguere il tipo.
- `types.ts`: aggiunto `motivo_blocco?: 'dismesso' | 'ambiguo' | null` all'interfaccia `Work`.

### Flusso "Vai allo Schema" al posto di RicaricaDialog

**Motivazione:** L'utente ha scelto che tutte le risoluzioni (sia dismessi che ambigui) devono avvenire nello Schema, non nella WorkPage. RicaricaDialog permetteva di bypassare lo schema ma non era chiaro quale fosse il lotto corretto scelto.

**Implementazione:**
- Rimosso import e rendering di `RicaricaDialog` da `WorkPage.tsx`
- Rimosso stato `ricaricaWorkId` e prop `onRicarica`
- Banner in `WorkDrawer` ora mostra messaggi distinti per `dismesso` vs `ambiguo` e un pulsante "Vai allo Schema ↗" che naviga con `navigate('/metodi', { state: { schemaMetodoId: metodoId } })`
- `WorkDrawer` riceve nuova prop `onVaiASchema?: (metodoId: string) => void`

### Archiviazione automatica work bloccata da SchemaCalibrazione

**Motivazione:** Quando l'operatore crea una nuova work dallo schema (con i CRM aggiornati), la vecchia work bloccata deve sparire da WorkPage automaticamente, con il suo storico di preparazioni conservato (soft-delete).

**Implementazione:** In `salvaWorkNelDb()` (`SchemaCalibrazione.logic.ts`), prima della creazione della nuova work, si carica la work attuale via `work:get`. Se è bloccata, dopo la creazione della nuova work si chiama `work:archivia` con motivo `"Sostituita da work '${w.nome}' — lotti aggiornati"`. Solo la work bloccata specifica viene archiviata, non tutte le work del metodo.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | `work:list`: aggiunto `n_ingredienti_ambigui` + `motivo_blocco`; `work:get`: aggiunto `n_lotti_validi_stesso_nome` e calcolo `motivo_blocco` |
| `src/shared/types.ts` | Aggiunto `motivo_blocco?: 'dismesso' | 'ambiguo' | null` a interfaccia `Work` |
| `src/renderer/pages/work/WorkPage.tsx` | Rimosso `RicaricaDialog`; WorkCard: badge distinto per motivo blocco, pulsante schema sempre visibile, rimosso pulsante Ricarica; WorkDrawer riceve `onVaiASchema` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Aggiunta prop `onVaiASchema`; banner bloccata con messaggi distinti e pulsante navigazione schema |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `salvaWorkNelDb()`: verifica se la work precedente è bloccata e la archivia automaticamente alla creazione della nuova |

---

## Analisi critica del sistema di gestione Work — problemi aperti

Questa sezione è una riflessione estesa sui limiti architetturali e di UX del sistema attuale, emersi durante la sessione di design. Servirà come base per una revisione futura più profonda.

### 1. Il concetto di "ambiguità" è opaco per l'operatore

Il sistema rileva l'ambiguità (≥2 lotti non dismessi con lo stesso nome in `composti`) e blocca la work, ma **non mostra all'operatore quali CRM specifici sono ambigui né quali lotti esistono**. Il banner dice genericamente "Più lotti disponibili per uno o più CRM. Vai allo Schema per scegliere." — ma nello Schema non c'è nessun indicatore visivo che dica "questo CRM ha un'ambiguità". L'operatore deve intuirlo.

**Soluzione ipotetica:** Il banner dovrebbe elencare i nomi dei CRM ambigui con i lotti disponibili. Nello Schema, le card dei CRM ambigui dovrebbero essere evidenziate.

### 2. Lo Schema non mostra lo stato delle work collegate

Quando un operatore apre SchemaCalibrazione per risolvere un'ambiguità, **non vede** quale work è bloccata, né quando è stata preparata l'ultima volta, né se è in scadenza. Le card work nello schema non hanno indicatori di stato. L'operatore lavora "alla cieca" sullo stato di laboratorio delle work.

**Soluzione ipotetica:** Le work card nello schema dovrebbero mostrare il badge stato (`attiva | in_scadenza | scaduta | bloccata`) e l'ultima data di preparazione, caricati live da `work:get`.

### 3. La relazione schema→work non è esplicita nel DB

La corrispondenza tra una colonna dello schema e il `dbId` di una work è salvata **solo nel JSON blob** di `schema_calibrazione`. Non esiste una FK che dica "la colonna X dello schema corrisponde alla work Y". Se il JSON viene corrotto o riscritto, la relazione è persa silenziosamente. Il `dbId` nello schema può puntare a una work archiviata senza che il sistema se ne accorga.

**Conseguenza pratica:** Dopo l'archiviazione automatica implementata oggi, il `dbId` nello schema rimane il vecchio ID archiviato, non viene aggiornato al nuovo. Lo schema deve essere ricaricato/resalvato per aggiornare il `dbId`. Se non lo fa, la prossima volta che l'operatore apre lo schema vedrà lo stesso `dbId` che punta a una work archiviata.

**Soluzione ipotetica:** Dopo `salvaWorkNelDb`, il chiamante deve aggiornare `w.dbId = newId` e richiamere `schema-cal:save`. Verificare che questo avvenga nel flusso attuale di `SchemaCalibrazione.tsx`.

### 4. `salvaWorkNelDb` crea sempre una nuova work, anche senza necessità

La funzione `salvaWorkNelDb` chiama sempre `work:create` anche quando `w.dbId` esiste e la work non è bloccata (modifica parametri senza cambiare i CRM). Il risultato è un **duplicato** della work con un nuovo ID, non un aggiornamento in-place. La vecchia work rimane attiva con il vecchio set di parametri.

Questo è un bug preesistente non affrontato in questa sessione. Il sistema non ha mai avuto un `work:update` invocato da `salvaWorkNelDb`.

**Soluzione ipotetica:** Distinguere il caso "modifica parametri (nome, volume, solvente)" da "cambio CRM". Il primo caso dovrebbe chiamare `work:update(dbId, ...)`, il secondo creare una nuova work e archiviare la vecchia.

### 5. Work condivise tra metodi complicano il flusso di blocco

Una work può essere associata a più metodi via `work_metodi`. Il blocco (`bloccata`) è calcolato sui CRM ingredienti indipendentemente dal metodo. Se un CRM è ambiguo per il metodo A ma non per il metodo B (perché lo schema del metodo B non usa quel CRM), la work risulta comunque bloccata per entrambi i metodi.

Il pulsante "Vai allo Schema ↗" naviga a `metodi_ids[0]` — il primo metodo in lista. Se la work è condivisa tra più metodi, l'operatore potrebbe essere portato al metodo sbagliato.

**Soluzione ipotetica:** Se la work ha più metodi, mostrare una lista di metodi da cui scegliere prima di navigare allo schema.

### 6. Il backend `work:ricarica` esiste ma non ha più UI

Con la rimozione di `RicaricaDialog`, il handler `work:ricarica` in `work.ipc.ts` è diventato codice morto. È ancora funzionale e potrebbe essere utile in futuro (es. per una feature di "aggiornamento rapido lotti" senza passare per lo schema). Per ora non va rimosso, ma va documentato come non usato dalla UI.

### 7. Nessun vincolo che garantisca "una work per slot di schema"

Il sistema non impone che ci sia **al massimo una work attiva** per colonna/livello di schema per un dato metodo. Nulla impedisce di avere 3 work lv0 attive per il metodo X. La logica "archivia la vecchia" implementata oggi aiuta, ma è opt-in (dipende dall'utente che passa dallo schema) e non è un vincolo DB.

### 8. L'operatore non riceve feedback sullo stato della work PRIMA di tentare la preparazione

Il flusso ideale sarebbe: operatore apre WorkDrawer → vede subito badge prominente con stato CRM → sa se può preparare o no. Attualmente il banner bloccata è presente, ma l'esperienza di scoprire che una work è bloccata solo quando si clicca "Registra preparazione" (pulsante disabilitato con tooltip) non è ottimale. Il controllo avviene al caricamento del drawer, quindi tecnicamente il banner è visibile — ma potrebbe essere reso più prominente o anticipato nella WorkCard.

---

## Note per sessioni future

- **Priorità alta**: verificare che dopo `salvaWorkNelDb` il `dbId` venga aggiornato nello schema JSON e richiamato `schema-cal:save`. Se non avviene, lo schema continua a puntare alla work archiviata.
- **Priorità media**: aggiungere la lista dei CRM ambigui nel banner bloccata (nome CRM + lotti disponibili, caricati da `work:check-lot-status`).
- **Priorità media**: mostrare il badge stato work (bloccata / in scadenza) nelle card work di SchemaCalibrazione.
- **Bug preesistente da risolvere**: `salvaWorkNelDb` crea duplicati invece di aggiornare work non bloccate con `dbId` esistente.
- **Codice morto**: `work:ricarica` IPC e `RicaricaDialog.tsx` — decidere se rimuovere o mantenere per uso futuro.
- **Riferimento piano sessione**: `docs/plans/active/2026-03-28-feat-flusso-operatore-blocco-ambiguita-plan.md`
