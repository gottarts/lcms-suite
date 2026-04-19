# Resoconto sessione — Tracciabilità ricorsiva Work intermedie

**Data:** 2026-04-17
**Progressivo:** 03
**Piano di riferimento:** `~/.claude/plans/problema-le-work-intermedie-cheeky-fairy.md`

---

## Lavoro svolto

### 1. Creazione `src/main/services/workTree.ts`
Nuova utility con `expandWorkTree(db, workId, visited, parentIngrediente?)`:
- Espansione ricorsiva dell'albero Work, anti-ciclo con `Set<number>`
- Ritorna `ExpandedWork` con `leaves` (CRM/prep), `children_works`, `problemi`
- Propaga ricorsivamente i flag `crm_dismessi`, `crm_scaduti`, `prep_scadute`, `prep_dismesse`, `work_scadute`, `work_bloccate` (OR logico verso l'alto)
- Campi `parent_fattore_diluizione`, `parent_modo_calcolo`, `parent_conc_target_mgL`, `parent_work_conc` popolati dall'ingrediente padre

### 2. Creazione `src/renderer/lib/workCalc.ts`
- `computeCompostiFromWorkTree(tree, visited)`: calcolo concentrazioni ricorsivo lato renderer
- `calcDilFactorFromParent(child)`: calcola dilFactor da dati ingrediente padre (formula `1/dilF` per `modo='dil'`, `target` per `modo='conc'`)
- Aggrega composti per nome (somma concentrazioni)

### 3. Modifica `src/main/ipc/work.ipc.ts`
- `work:get`: sostituiti calcoli flag (`nBloccati`/`nScaduti`/`nPrepScadute`) con `expandWorkTree` — ora ricorsivi
- Nuovo handler `work:expand-tree`

### 4. Modifica `src/main/ipc/dashboard.ipc.ts`
- `dashboard:audit-crm`: ogni work include `work_tree: expandWorkTree(db, w.id)`
- Flag `bloccata`, `ha_crm_scaduti`, `ha_prep_scadute_at_data` in OR con tree problemi

### 5. Modifica `src/renderer/pages/dashboard/lib/auditModel.ts`
- Usa `computeCompostiFromWorkTree` per composti delle work con sorgenti work
- Funzione `addLeavesFromTree()` per popolare `crmUsatiInWork` ricorsivamente
- `AuditWorkRow` esteso con `children_works: AuditWorkChildRow[]`

### 6. Modifica `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx`
- `ChildWorkBadges`: mostra nome, stato, scadenza, badge ⚠ per child work
- Sezione "Work intermedie sorgenti" espandibile per ogni work row
- Link "WorkPage ↗" e "Vedi ↗" per ogni child work

### 7. Modifica `src/renderer/pages/metodi/SchemaCalibrazione.tsx`
- `blockedMap` esteso con `haWorkProblemi`
- Badge "⚠ Work sorgenti con problemi" (viola) con tooltip
- Chiama `work:expand-tree` per ogni work con dbId

### 8. Modifica `src/renderer/pages/work/WorkDrawer.tsx`
- Alert viola quando una child work ha problemi (crm dismessi, scaduti, ecc.)
- Aggiunto `destinazione_uso: null` mancante in `buildCrmItems` (fix TS)

### 9. Fix bug root cause: `source_id=0` in `work_ingredienti`
- **Causa**: `salvaWorkNelDb` usava `(src as any).dbId ?? 0` ma `SorgenteSel` non ha `dbId`; `src.id` è un id locale stringa
- **Fix codice**: aggiunto parametro `workCols?: WorkInSchema[][]` a `salvaWorkNelDb`; risolve id locale → dbId numerico cercando in `workCols`
- **Fix dati DB**: corrette righe corrotte via SQL (id 16, 30, 31, 54, 55 aggiornati a source_id corretto)

### 10. Fix TS `SchemaCalibrazione.logic.ts:432`
- Tipo esplicito `Ing[]` sul callback del `flatMap` per risolvere l'inferenza del tipo union

---

## Stato finale

**Completato:**
- Tracciabilità ricorsiva Work intermedie (main + renderer)
- Flag scadenza/blocco propagati ricorsivamente
- Dashboard Audit mostra Work intermedie con badge e link
- SchemaCalibrazione badge per sorgenti invalide
- WorkDrawer alert per problemi in child work
- Bug `source_id=0` fixato nel codice e nei dati esistenti

**Problema aperto — segnalato dall'utente:**
> "i conti sono ancora sbagliati. le work sorgente sono a 2 mg/L, li voglio a 0.01 mg/L e mi dice che devo mettere 100 di ognuno in 1 mL????"

Il calcolo del volume di prelievo nella UI (`calcolaVols` / `SchemaCalibrazione.grid.tsx`) produce risultati fisicamente insensati per work sorgenti con `modo='dil'` e `fattore_diluizione=0.01`. Nella sessione si è verificato che la formula `1/dilF = 1/0.01 = 100` è coerente con `getCompsFromWork`, ma il risultato (100 mL prelevati in volume finale 1 mL) è impossibile fisicamente — il problema è nel valore `0.01` salvato nel DB o nella semantica del campo per le work sorgenti. **Da investigare nella prossima sessione.**
