# Resoconto sessione — Fix persistenza SchemaCalibrazione + salvataggio works "al momento"

**Data:** 2026-03-20
**Oggetto:** Due bug nel componente SchemaCalibrazione: layout non persiste alla chiusura; works senza validità non salvate nel DB

---

## Contesto

Lo SchemaCalibrazione perdeva tutto il suo stato (colonne work configurate, CRM rimossi) alla chiusura. Inoltre, le works create senza data di validità ("al momento") non venivano mai salvate nel DB — non apparivano né in WorkPage né nel registro. Era stato anche scoperto che `registerWorkIpc` non era registrato in `index.ts`, rendendo `work:create` completamente non funzionante.

---

## Bug risolti

### Bug 1 — Schema calibrazione non persistente

**Root cause:** Lo stato del layout (`workCols`, `removedCon`, `removedMix`) viveva solo in React. Non era mai salvato nel DB e non veniva ripristinato al mount.

**Fix:** Creata tabella `schema_calibrazione` (migration 013) con `metodo_id` come PK. Creati handler IPC `schema-cal:get` e `schema-cal:save`. In `SchemaCalibrazione.tsx`: `useEffect` di caricamento al mount (dopo il caricamento dei CRM); `useEffect` di auto-save con debounce 500ms su ogni cambiamento di `workCols`, `removedCon`, `removedMix`.

**File creati/modificati:**
- `src/main/migrations/013-schema-calibrazione.sql` — nuova tabella
- `src/main/ipc/schemaCalibrazione.ipc.ts` — handler `schema-cal:get` / `schema-cal:save`
- `src/main/index.ts` — aggiunto `registerSchemaCalibrazioneIpc()`
- `src/renderer/lib/api.ts` — aggiunto `schemaCalApi`
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — load + auto-save

---

### Bug 2 — Works "al momento" non salvate nel DB

**Root cause:** `salvaWorkNelDb` in `SchemaCalibrazione.logic.ts` aveva un guard `if (!w.validitaMesi) return null` che cortocircuitava il salvataggio per qualsiasi work senza validità.

**Fix:** Rimosso il guard. Tutte le works vengono sempre salvate; quelle senza validità hanno `validita_mesi = NULL`, già gestito correttamente dalla tabella `work` e dalla WorkPage (badge "al momento").

**File modificato:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

---

### Bug 3 — `registerWorkIpc` non registrato in `index.ts`

**Root cause:** L'handler IPC `work:create` era implementato in `work.ipc.ts` ma `registerWorkIpc()` non era mai chiamato in `index.ts`. Di conseguenza, nessuna work veniva mai salvata nel DB.

**Fix:** Aggiunto `registerWorkIpc()` in `src/main/index.ts`.

**File modificato:** `src/main/index.ts`

---

## File modificati

| File | Azione |
|------|--------|
| `src/main/migrations/013-schema-calibrazione.sql` | Nuovo — tabella `schema_calibrazione` |
| `src/main/ipc/schemaCalibrazione.ipc.ts` | Nuovo — handler `schema-cal:get` / `schema-cal:save` |
| `src/main/index.ts` | Aggiunto `registerWorkIpc()` e `registerSchemaCalibrazioneIpc()` |
| `src/renderer/lib/api.ts` | Aggiunto `schemaCalApi` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Rimosso guard `validitaMesi` in `salvaWorkNelDb` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto load schema al mount + auto-save su cambiamento |

---

## Note per sessioni future

- Il `schemaLoaded` flag è necessario per impedire che l'auto-save sovrascriva il DB con lo stato iniziale vuoto prima che il caricamento sia completato.
- Il debounce da 500ms sull'auto-save evita scritture continue durante il trascinamento di colonne.
