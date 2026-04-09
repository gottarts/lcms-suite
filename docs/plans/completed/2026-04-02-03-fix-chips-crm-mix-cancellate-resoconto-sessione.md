# Resoconto sessione — Fix chips CRM mix appaiono "cancellate"

**Data:** 2026-04-02
**Oggetto:** Bug chips CRM mix con strikethrough/opacity ridotta dopo reload o aggiunta work

---

## Cosa è stato fatto

Diagnosticato e risolto un bug per cui le chips dei CRM mix nello Schema Calibrazione apparivano visivamente "cancellate" (testo con line-through, opacity 0.28, sfondo sbiadito) anche quando dovevano essere attive. Il bug si manifestava dopo reload della pagina con un lotto non-default selezionato, e/o dopo aver aggiunto/importato una work nello schema.

Chiarito inoltre (a richiesta dell'utente) il comportamento atteso: la selezione del lotto nella griglia CRM **non influenza** la work, poiché la work salva i propri ingredienti come proprietà interne con riferimento diretto al `source_id` del CRM.

---

## Bug risolti

### Chips CRM mix appaiono "cancellate" dopo reload

**Root cause:**
`mixLottoSel` (Map che indica quale lotto è attivo per ogni firma mix) era uno `useState` locale a `GrigliaAnalitiCrm`, inizializzato sempre come `new Map()` vuoto. Non veniva mai ripristinato dal `removedMix` salvato nel DB.

Scenario tipico:
1. Mix con lotti A e B. Default: A. Utente seleziona B → `removedMix = {A}`, salvato nel DB.
2. Reload → `removedMix` ripristinato con `{A}`, ma `mixLottoSel` riparte vuoto.
3. `mixIdAttivo = mixLottoSel.get(firmaId) ?? firmaId = lotto_A` (il default).
4. `removedMix.has(lotto_A) = true` → chip appare cancellata, anche se il lotto attivo dovrebbe essere B.

**Fix:**
Rimosso lo stato locale `mixLottoSel` da `GrigliaAnalitiCrm`. Aggiunto un `useMemo` in `SchemaCalibrazione.tsx` che deriva `mixLottoSel` da `removedMix` + `analiti`: per ogni firma, il lotto attivo è il primo `mix_id` che non è in `removedMix`. La Map risultante viene passata come prop alla griglia.

Il ciclo di aggiornamento è ora: `onChange dropdown → onChangeMixLotto → setRemovedMix → useMemo ricalcola → prop aggiornata → re-render griglia`. Nessuno stato locale da sincronizzare, nessun lag visibile.

---

## Chiarimento architetturale (confermato in sessione)

**La selezione del lotto nella griglia CRM non influenza le works collegate.**

La work salva i propri ingredienti nel DB con `source_id` e `source_mix_id` come proprietà interne. Quando viene ricreata in schema via `ricostruisciWorkInSchema`, cerca il CRM per `id` diretto — non legge mai `removedMix` o `mixLottoSel`. Le chips nella griglia e le sorgenti della work sono indipendenti: la work continua a puntare al lotto con cui è stata preparata, indipendentemente da cosa mostra la griglia.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rimosso `useState` locale `mixLottoSel`; aggiunta prop `mixLottoSel?` a `GrigliaProps`; rimosso `setMixLottoSel` dall'onChange del select |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto `useMemo` che deriva `mixLottoSel` da `removedMix`; passato come prop a `GrigliaAnalitiCrm` |

---

## Note per sessioni future

- Il `useMemo` usa `analiti` (non `analitiAll`) come dipendenza — è la variabile filtrata per scenario già passata alla griglia, coerente con ciò che viene visualizzato.
- Se in futuro si aggiungono scenari con più lotti esclusi tutti insieme, la logica `find(mid => !removedMix.has(mid))` restituisce `undefined` → nessun mapping inserito → comportamento corretto (la firma rimane sul default).
- Il piano di questa sessione è in `docs/plans/active/2026-04-02-03-fix-chips-crm-mix-cancellate-plan.md`.
