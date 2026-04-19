# Resoconto sessione — Fix chips volumi duplicati dopo Ricarica (Schema Calibrazione)

**Data:** 2026-04-15
**Oggetto:** Bug chip prelievi ripetute N volte per ogni componente del CRM mix dopo Ricarica work

---

## Cosa è stato fatto

Identificato e risolto un bug introdotto dal commit 8917fff (stesso giorno) nella funzione
`buildSrcsAndVols()` del backend: i prelievi dei CRM mix venivano mostrati N volte nelle
chip della "tabella volumi mini" delle card work (N = numero di componenti del mix in
`work_ingredienti`). I calcoli numerici erano corretti, solo la visualizzazione era
errata.

Aggiunta anche una funzione di sanitizing retroattivo (`dedupVols`) in `schema-cal:get`
per riparare automaticamente gli schemi già danneggiati persistiti nel DB.

Completata una revisione strutturale del modulo SchemaCalibrazione (il più critico del
progetto) con mappatura dei bug latenti e fragilità architetturali.

---

## Bug risolti / Feature aggiunte

### Bug: chip volumi duplicate dopo Ricarica work

**Root cause:** In `buildSrcsAndVols()` (work.ipc.ts) il branch `crm` deduplicava
correttamente `srcs[]` per `mix_id` con `seenMix.has(id) → skip`, ma il `vols.push()`
era **fuori** dal blocco condizionale e veniva eseguito per ogni riga di `work_ingredienti`
(una riga per componente del mix). La versione renderer `ricostruisciWorkInSchema()`
(SchemaCalibrazione.logic.ts) usava invece `continue` che saltava sia srcs sia vols.
Divergenza tra le due implementazioni dello stesso algoritmo.

Il bug si propagava cross-schema: `work:ricarica` itera `params.metodi_ids` (tutti i
metodi che contenevano la old work) e aggiornava `schema_json` di ciascuno con `vols[]`
duplicati. L'utente vedeva chip duplicate anche in schemi dove non aveva toccato nulla.

**Fix:**
- Fix 1 (`work.ipc.ts`): spostato `if (seenMix.has(c.mix_id)) continue` prima del push
  di `vols`, allineando la logica al renderer.
- Fix 3 (`schemaCalibrazione.ipc.ts`): aggiunta `dedupVols()` applicata in `schema-cal:get`
  per riparare retroattivamente schemi già danneggiati senza migrazione SQL.
- Fix 4 (`SchemaCalibrazione.tsx`): key React `key={v.nome}` → `key={v.nome-idx}`
  per stabilità reconciliation con nomi duplicati.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Fix dedup vols: `continue` unificato per srcs+vols nel ramo mix di `buildSrcsAndVols` |
| `src/main/ipc/schemaCalibrazione.ipc.ts` | Aggiunta `dedupVols()` applicata in `schema-cal:get` per sanitizing retroattivo |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Key React stabile `${v.nome}-${idx}` in `w.vols.map` (riga 313) |

---

## Note per sessioni future

### Bug latenti identificati nel modulo (non fixati, da aprire come issue separate)

1. **Logica duplicata renderer/backend**: `ricostruisciWorkInSchema()` e `buildSrcsAndVols()`
   implementano due volte la stessa trasformazione `work_ingredienti → {srcs, vols}`.
   Sono già divergenti (questo bug ne è la prova). Soluzione: estrarre funzione condivisa
   in `src/shared/work-srcs-vols.ts` richiamata da entrambi i lati.

2. **Transazione `work:ricarica` non rollback-safe**: se `JSON.parse(schema_json)` fallisce
   a metà del loop `metodi_ids`, la transazione SQLite è atomica ma l'IPC handler non ha
   try/catch esterno — un schema JSON corrotto può bloccare la ricarica.

3. **`extraSrcs` cancellato dalla ricarica**: `work.ipc.ts:884` fa sempre `delete w.extraSrcs`,
   rimuovendo badge "extra" anche se la work conteneva CRM extra legittimi non in schema.

4. **`SchemaCalibrazione.tsx` 1035 righe, 7+ stati interconnessi**: candidato a refactor
   in custom hooks (`useWorkCols`, `useBlockedLots`, …). Non urgente ma rischio regressioni
   alto su ogni modifica al file.

5. **`dedupVols` basata su `nome|vol`**: se in futuro due mix diversi avessero lo stesso
   nome commerciale e stesso volume di prelievo in una work, la dedup rimuoverebbe uno.
   Caso estremamente improbabile ma da tenere in mente.

### Riferimento piano
Piano in `docs/plans/active/2026-04-15-02-fix-chips-vols-duplicate-ricarica-plan.md`
(copiato da `~/.claude/plans/distributed-leaping-graham.md`).
