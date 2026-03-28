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

## Analisi critica del sistema di gestione Work — stato aggiornato

Questa sezione è una riflessione estesa sui limiti architetturali e di UX del sistema. Aggiornata dopo le sessioni del 2026-03-28.

> **Legenda stato:** ✅ Risolto · ⚠️ Parzialmente risolto · 🔴 Aperto

---

### 1. Il concetto di "ambiguità" blocca work in modo fuorviante ✅ Rimosso

Il sistema bloccava le work per "ambiguità CRM" (≥2 lotti attivi con lo stesso nome). Questa condizione era un falso positivo: `work_ingredienti.source_id` identifica già univocamente il CRM scelto dall'operatore alla creazione.

**Stato:** Rimosso completamente nella sessione `2026-03-28-rimozione-ambiguita-warning-crm-scaduti`. Il campo `motivo_blocco` ora ha solo valori `'dismesso' | null`. Aggiunto in sostituzione un **warning non bloccante** per CRM scaduti (`ha_crm_scaduti`): badge giallo in WorkCard, banner giallo in WorkDrawer. L'operatore può ancora preparare la work ma viene avvisato.

---

### 2. Lo Schema non mostra lo stato delle work collegate 🔴 Aperto

Quando un operatore apre SchemaCalibrazione per risolvere un problema, non vede quale work è bloccata, né quando è stata preparata l'ultima volta, né se ha CRM scaduti. Le work card nello schema non hanno indicatori di stato.

**Soluzione ipotetica:** Le work card nello schema dovrebbero mostrare il badge stato e l'ultima data di preparazione, caricati live da `work:get`.

---

### 3. La relazione schema→work non è esplicita nel DB — race condition sul salvataggio dbId ✅ Risolto (parzialmente)

La corrispondenza schema→work è salvata solo nel JSON blob di `schema_calibrazione`. Il `dbId` nello schema può puntare a una work archiviata se il salvataggio non avviene correttamente dopo la sostituzione.

**Stato:** Il rischio race-condition è risolto nella sessione `2026-03-28-fix-dbid-schema-ricarica`: `RicaricaDialog.onSuccess` ora chiama `schemaCalApi.save` **immediatamente** dentro l'updater di `setWorkCols`, senza dipendere dal debounce da 500ms.

**Ancora aperto:** Il path di archiviazione in `salvaWorkNelDb` (linee 263–269 di `SchemaCalibrazione.logic.ts`) è **dead code**: `handleSaveWork` crea sempre work con `Omit<..., 'dbId'>`, quindi `w.dbId` è sempre undefined e il blocco non si attiva mai. La relazione schema→work rimane implicita nel JSON senza FK DB.

---

### 4. `salvaWorkNelDb` crea sempre una nuova work, anche senza necessità 🔴 Aperto

La funzione chiama sempre `work:create` anche quando la work non è bloccata (modifica parametri senza cambiare CRM). Il risultato è un **duplicato** con nuovo ID, non un aggiornamento in-place. La vecchia work rimane attiva.

**Soluzione ipotetica:** Distinguere "modifica parametri" (→ `work:update`) da "cambio CRM" (→ crea nuova + archivia vecchia).

---

### 5. Work condivise tra metodi complicano il flusso di blocco 🔴 Aperto

Il blocco (`bloccata`) è calcolato sui CRM ingredienti indipendentemente dal metodo. Il pulsante "Vai allo Schema ↗" naviga a `metodi_ids[0]` — se la work è condivisa tra più metodi, l'operatore potrebbe essere portato al metodo sbagliato.

**Soluzione ipotetica:** Mostrare una lista di metodi da scegliere prima di navigare allo schema.

---

### 6. `work:ricarica` IPC e `RicaricaDialog` ⚠️ Parzialmente risolto

`RicaricaDialog` è stato rimosso da `WorkPage`/`WorkDrawer` (rimpiazzato dal flusso schema-centrico). Tuttavia **è ancora presente e attivo in `SchemaCalibrazione.tsx`** per il caso in cui l'utente voglia aggiornare i lotti di una work direttamente dallo schema senza ricrearla da zero. Il handler `work:ricarica` in `work.ipc.ts` è quindi ancora usato.

**Stato attuale:** Non è dead code. Va documentato che il flusso corretto per l'operatore (blocco CRM dismesso) passa per lo schema, ma `RicaricaDialog` rimane come shortcut per il chimico che gestisce lo schema.

---

### 7. Nessun vincolo "una work per slot di schema" 🔴 Aperto

Il sistema non impone al massimo una work attiva per colonna/livello per un dato metodo. La logica "archivia la vecchia" è opt-in e non è un vincolo DB.

---

### 8. Feedback stato work prima di tentare la preparazione ⚠️ Parzialmente risolto

**Stato:** Il banner bloccata (rosso) e il warning scaduti (giallo) sono visibili in WorkDrawer al caricamento. Il badge in WorkCard anticipa lo stato prima di aprire il drawer. Il flusso è migliorato rispetto alla situazione iniziale, ma le work card nello schema non rispecchiano ancora lo stato lab.

---

## Note per sessioni future

- **Chiuso**: race condition dbId dopo `RicaricaDialog` (risolto con save esplicito).
- **Chiuso**: falso blocco "ambiguo" (rimosso; sostituito da warning scaduti non bloccante).
- **Aperto — priorità media**: mostrare badge stato work (bloccata / scaduta) nelle card work di SchemaCalibrazione.
- **Aperto — bug preesistente**: `salvaWorkNelDb` crea duplicati invece di aggiornare work non bloccate con `dbId` esistente.
- **Aperto — dead code**: path archiviazione in `salvaWorkNelDb` (linee 263–269) non viene mai raggiunto nel flusso corrente.
- **Riferimento piano sessione**: `docs/plans/active/2026-03-28-feat-flusso-operatore-blocco-ambiguita-plan.md`
