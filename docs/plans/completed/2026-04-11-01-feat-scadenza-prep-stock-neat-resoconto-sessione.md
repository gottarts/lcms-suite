# Resoconto sessione — Scadenza prep stock NEAT nelle work e schemi

**Data:** 2026-04-11
**Oggetto:** Warning visivo (badge/banner) quando le prep stock NEAT usate in una work sono scadute

---

## Cosa è stato fatto

Implementato il rilevamento e la segnalazione visiva della scadenza delle preparazioni stock NEAT usate come ingredienti nelle work. Il sistema già gestiva la scadenza dei CRM normali (`ha_crm_scaduti`), ma ignorava completamente il campo `scadenza` delle prep NEAT (`source_type = 'prep'`). Applicato lo stesso pattern a tutti i punti di visualizzazione.

---

## Feature aggiunte

### Flag `ha_prep_scadute` nel backend

**Motivazione:** Le prep NEAT hanno `preparazioni.scadenza` ma non veniva mai verificata nelle work. Mancava sia il conteggio che il flag sul record work.

**Implementazione:**
- In `work:list`: aggiunta subquery SQL `n_prep_scadute` (JOIN `work_ingredienti` → `preparazioni`, filtra `source_type='prep'`, `data_dismissione IS NULL`, `scadenza < date('now')`) + mapping `ha_prep_scadute`.
- In `work:get`: stessa query separata + `work.ha_prep_scadute`.
- In `work:get`: aggiunta subquery `source_scadenza` nella SELECT degli ingredienti per propagare la data di scadenza al frontend.

### Warning in WorkCard (WorkPage)

Badge "Prep stock scadute" (stile giallo, stesso di "CRM scaduti") visibile nella card quando `ha_prep_scadute = true` e la work non è bloccata.

### Banner in WorkDrawer

Banner warning "Una o più prep stock NEAT usate in questa work sono scadute" analogo a quello dei CRM, mostrato nel drawer della work.

### Data scadenza accanto al testo "Neat" nel drawer

Nel dettaglio ingredienti, accanto a `prep #N da lotto X · Neat` viene mostrata la data di scadenza della prep. Se scaduta, il testo è in rosso (`#dc2626`).

### Warning in SchemaCalibrazione (card work)

- Riga "⚠ Prep stock scadute" nella card work dello schema (stesso stile di "⚠ CRM scaduti").
- Pulsante "Ricarica ↻" appare anche se `haStockScadute`, con tooltip appropriato.
- `blockedMap` estesa con campo `haStockScadute` popolato da `w.ha_prep_scadute`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | +subquery `n_prep_scadute` in `work:list` e `work:get`; +`source_scadenza` nella SELECT ingredienti; +`ha_prep_scadute` nel mapping |
| `src/shared/types.ts` | +`ha_prep_scadute?: boolean` in interfaccia `Work` |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | +`scadenza?: string \| null` in `SorgenteSel` |
| `src/renderer/pages/work/WorkDrawer.tsx` | +propagazione `scadenza` nel SorgenteSel per `source_type='prep'`; +data scadenza rossa nel testo "Neat"; +banner "Prep stock scadute" |
| `src/renderer/pages/work/WorkPage.tsx` | +badge "Prep stock scadute" in WorkCard |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | +`haStockScadute` in `blockedMap`; +riga "⚠ Prep stock scadute" nella card; +Ricarica per prep stock scadute |

---

## Note per sessioni future

- Il rilevamento usa `data_dismissione IS NULL` come proxy per "non dismessa" — coerente con `computeStatoPrep` in `PreparazioniTab.tsx` che usa lo stesso campo.
- La scadenza mostrata nel testo "Neat" usa `new Date().toISOString().slice(0,10)` come confronto inline (nessuna variabile `oggi` nel file).
- Non è stato implementato blocco alla registrazione della preparazione work se le prep sono scadute (scelta deliberata dell'utente: solo warning).
- Piano di sessione: `~/.claude/plans/shimmying-swimming-sprout.md` → copiato come `2026-04-11-01-feat-scadenza-prep-stock-neat-plan.md`.
