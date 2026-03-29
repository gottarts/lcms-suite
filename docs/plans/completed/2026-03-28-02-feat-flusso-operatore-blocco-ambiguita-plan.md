# Piano: Flusso operatore — blocco preparazione e archiviazione automatica work

**Data:** 2026-03-28
**Tipo:** Feature design + implementazione

---

## Context

Il flusso operatore deve seguire questa regola:
- L'operatore può registrare una preparazione work **solo se tutti i CRM ingredienti hanno un unico lotto valido e attivo**.
- Se ci sono ambiguità (CRM dismesso, o più lotti validi per lo stesso CRM), la work viene bloccata e l'operatore deve **tornare allo Schema** per scegliere i CRM corretti e creare una nuova work.
- Quando si crea la nuova work da Schema, **la vecchia work bloccata viene archiviata automaticamente** (solo quella specifica, non tutte le work del metodo).
- Lo schema rimane **mutabile** — la tracciabilità è già garantita dallo snapshot nella work (lotto_usato per ogni ingrediente).

---

## Stato attuale — cosa già funziona

| Funzionalità | File | Stato |
|---|---|---|
| `work.bloccata` per CRM dismessi | `work.ipc.ts` work:list/get | ✅ implementato |
| `work:check-lot-status` — stati `ok\|auto\|ambiguo\|mancante` | `work.ipc.ts` | ✅ implementato |
| `work:archivia` soft-delete con motivo | `work.ipc.ts` | ✅ implementato |
| Pulsante "Vai a Schema" in WorkDrawer | `WorkDrawer.tsx` | da verificare |
| Calcolo ambiguità | — | ❌ mancante |
| Archiviazione automatica da SchemaCalibrazione | `SchemaCalibrazione.logic.ts` | ❌ mancante |

---

## Cosa manca da implementare

### 1 — Rilevamento "ambiguo" in work.bloccata

**Problema:** Attualmente `work.bloccata` scatta solo se `c.data_dismissione IS NOT NULL`. Il caso "ambiguo" (CRM attivo ma esistono ≥2 lotti validi con lo stesso nome) non blocca nulla.

**File:** `src/main/ipc/work.ipc.ts`

**Modifica in `work:list`:**
Aggiungere conteggio ingredienti ambigui alla query aggregata:
```sql
COUNT(CASE
  WHEN wi.source_type='crm'
   AND c.data_dismissione IS NULL
   AND (SELECT COUNT(*) FROM composti c2
        WHERE c2.nome = c.nome
          AND c2.data_dismissione IS NULL) > 1
  THEN 1 END
) as n_ingredienti_ambigui
```
Poi: `bloccata = (n_bloccati > 0) OR (n_ambigui > 0)`.

Aggiungere anche un campo `motivo_blocco: 'dismesso' | 'ambiguo' | null` nel risultato, per distinguere il tipo nel drawer.

**Modifica in `work:get`:**
Stesso calcolo per il singolo record, incluso `motivo_blocco`.

**Tipo:** Aggiungere `motivo_blocco` a `Work` in `src/shared/types.ts`.

---

### 2 — WorkDrawer: sostituire RicaricaDialog con "Vai allo Schema"

**File:** `src/renderer/pages/work/WorkDrawer.tsx`

- Rimuovere il pulsante "Ricarica" e il riferimento a `RicaricaDialog`.
- Se `work.bloccata`:
  - Mostrare banner con messaggio diverso per `motivo_blocco`:
    - `dismesso`: "Uno o più CRM sono stati dismessi. Vai allo Schema per aggiornare i lotti."
    - `ambiguo`: "Più lotti disponibili per uno o più CRM. Vai allo Schema per scegliere."
  - Mostrare pulsante **"Vai allo Schema"** che naviga a SchemaCalibrazione.
    - Se la work ha un solo metodo (`metodi_ids[0]`) → navigazione diretta.
    - Se la work è su più metodi → mostrare selezione metodo.
- Disabilitare il pulsante "Registra preparazione" quando `bloccata` (già presente, verificare che copra anche il caso ambiguo).

> **Nota:** Verificare prima se il pulsante "Vai a Schema" esiste già — in quel caso basta renderlo più prominente quando bloccata e aggiornare il messaggio.

---

### 3 — SchemaCalibrazione.logic.ts: archiviazione automatica work bloccata

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`
**Funzione:** `salvaWorkNelDb()`

**Logica attuale:** Se `work.dbId` esiste → aggiorna in-place. Se non esiste → crea nuova.

**Logica modificata:**
1. Se `work.dbId` esiste:
   a. Caricare la work corrente via `workApi.get(work.dbId)` per verificare se è bloccata.
   b. Se **bloccata**: creare una nuova work (come se `dbId` fosse null), poi chiamare `workApi.archivia(work.dbId, motivo)` con motivo = `"Sostituita da work '${nuovoNome}' — lotti aggiornati"`.
   c. Se **non bloccata**: aggiornamento in-place (comportamento attuale invariato).
2. Se `work.dbId` non esiste → crea normalmente.

**Effetto:** Solo la work bloccata coinvolta viene archiviata. Le altre work del metodo non vengono toccate.

---

## Flusso end-to-end verificato

1. CRM X dismesso → work B usa X → `bloccata=true, motivo='dismesso'`
2. WorkPage → WorkDrawer di B → banner "CRM dismesso" + pulsante "Vai allo Schema [metodo Y]"
3. Navigazione a SchemaCalibrazione → X non appare più tra i CRM disponibili (già filtrato), Z appare come nuovo lotto
4. Operatore associa Z alla colonna di B, verifica volumi
5. Operatore clicca "Crea work" → `salvaWorkNelDb()` rileva che B era bloccata → crea B' → archivia B con motivo
6. WorkPage: B sparisce (archiviata), B' appare come work attiva pronta per preparazione

---

## File critici da modificare

| File | Modifica |
|---|---|
| `src/main/ipc/work.ipc.ts` | `work:list`, `work:get`: aggiungere `n_ambigui` + `motivo_blocco` |
| `src/shared/types.ts` | Aggiungere `motivo_blocco` a interfaccia `Work` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Sostituire RicaricaDialog con banner + link "Vai allo Schema" |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `salvaWorkNelDb()`: archivia automaticamente se work bloccata |

---

## Fuori scope (feature future — new draft.md)

- Archivio versionato degli schemi calibrazione
- Tipo schema (taratura, qc, taratura+qc, IS)
- MIX con composti extra non nello schema visibili nel drawer

