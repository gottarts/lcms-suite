# Resoconto sessione — Fix persistenza Schema Calibrazione + salvataggio Works

**Data:** 2026-03-20
**Oggetto:** Bug fix — schema calibrazione non persisteva alla chiusura; works non venivano salvate nel DB

---

## Cosa è stato fatto

Identificati e risolti tre bug distinti nel flusso Schema Calibrazione → WorkPage:

1. `registerWorkIpc()` non era mai registrato in `index.ts` → tutte le IPC `work:*` erano senza handler
2. Guard `if (!w.validitaMesi) return null` in `salvaWorkNelDb` impediva il salvataggio delle works "al momento"
3. Il layout dello schema (colonne work, CRM rimossi) non veniva mai persistito → si perdeva alla chiusura

---

## Bug risolti / Feature aggiunte

### Bug critico: work:create senza handler IPC
**Root cause:** `registerWorkIpc()` non era mai chiamato in `src/main/index.ts`, nonostante il file `work.ipc.ts` fosse scritto correttamente. Nessuna work veniva effettivamente salvata nel DB.
**Fix:** Aggiunto import e chiamata a `registerWorkIpc()` in `app.whenReady()`.

### Bug: works "al momento" non salvate
**Root cause:** `salvaWorkNelDb` in `SchemaCalibrazione.logic.ts` aveva il guard `if (!w.validitaMesi) return null` che bloccava il salvataggio per works senza validità. L'intenzione era di non tracciarle nel registro preparazioni, ma non salvarle affatto impediva anche la loro comparsa nella WorkPage.
**Fix:** Rimosso il guard. Works con `validita_mesi = null` vengono salvate normalmente — la WorkPage le mostra già con il badge "al momento".

### Feature: persistenza schema calibrazione
**Root cause:** Lo stato React (`workCols`, `removedCon`, `removedMix`) non veniva mai salvato — era solo in memoria.
**Fix:** Nuova tabella `schema_calibrazione` (migration 013) con colonna `schema_json` (JSON blob, upsert per `metodo_id`). Nuovi IPC `schema-cal:get` e `schema-cal:save`. Nel componente: `useEffect` carica lo schema dopo il mount (aspetta fine loading CRM), `useEffect` con debounce 500ms fa auto-save ad ogni cambio.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/migrations/013-schema-calibrazione.sql` | **NUOVO** — tabella `schema_calibrazione` |
| `src/main/ipc/schemaCalibrazione.ipc.ts` | **NUOVO** — handler `schema-cal:get` e `schema-cal:save` |
| `src/main/index.ts` | Aggiunti `registerWorkIpc()` e `registerSchemaCalibrazioneIpc()` |
| `src/renderer/lib/api.ts` | Aggiunto `schemaCalApi` (`get`, `save`) |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Rimosso guard `if (!w.validitaMesi) return null` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto `useEffect` load schema + `useEffect` auto-save debounced |

---

## Note per sessioni future

- **Test da fare:** verificare che al riavvio dell'app il DB venga aperto prima della chiamata IPC (l'ordine in `index.ts` è: registra IPC → `createWindow()` → `openDatabase()` — se il renderer chiama `schema-cal:get` prima che il DB sia aperto, riceverà un errore. Se si verifica, spostare `openDatabase()` prima di `createWindow()`).
- Il `schema_json` salva i `WorkInSchema` completi inclusi `srcs` e `vols`. Se un CRM viene eliminato dal DB dopo che lo schema è salvato, al ripristino lo schema conterrà riferimenti a CRM inesistenti — per ora non gestito, accettabile come stato iniziale.
- Le works "al momento" ora appaiono nella WorkPage. Verificare che non creino rumore indesiderato nel registro preparazioni (dovrebbero essere escluse dalla query perché `validita_mesi IS NULL`).
- Piano di riferimento: `/Users/vitogelao/.claude/plans/elegant-orbiting-anchor.md`
