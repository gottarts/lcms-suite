# Resoconto sessione — Fix RicaricaDialog CRM mix + bug lotto griglia

**Data:** 2026-04-02
**Oggetto:** Due bug nel flusso di ricarica/selezione lotti CRM mix nello SchemaCalibrazione

---

## Cosa è stato fatto

Investigazione e fix di due bug distinti segnalati dall'utente:
1. Nel **RicaricaDialog**: bottone "Conferma e Ricarica" restava disabilitato anche dopo aver scelto il lotto, e il select del CRM mix si resettava visivamente al placeholder
2. Nella **griglia CRM sinistra** dello SchemaCalibrazione: cambiando il lotto di un CRM mix dal dropdown, la card appariva barrata ("cancellata") come se fosse esclusa dallo scenario

Per il bug 2 è stata necessaria un'ispezione diretta del DB (`lcms.db`) per identificare la root cause.

---

## Bug risolti

### Bug 1: RicaricaDialog — bottone disabilitato e select che si resetta per CRM mix

**Root cause:**
- `tuttiRisolti` (righe 89-94 originali) iterava su `lotStatus` (ingredienti singoli), non sui gruppi mix. Per un CRM mix ambiguo, `handleMixScelta` cercava il sostituto con `s.mix_id === value` esatto per ogni membro. Se un membro non aveva quel `mix_id` nei suoi sostituti (il backend cerca per `nome` individuale, non garantisce lo stesso `mix_id` per tutti), `scelte[member.source_id]` restava `undefined` → `tuttiRisolti = false` permanente.
- `getMixSceltaAttuale` poteva restituire un valore non presente nelle opzioni del `<select>` nativo → il browser resettava il select al placeholder visivamente.

**Fix in `RicaricaDialog.tsx`:**
- `handleMixScelta`: aggiunto fallback — se il membro non trova sostituto con `mix_id === value` esatto, prende il primo sostituto con qualsiasi `mix_id != null` (stesso batch, trovato per nome individuale dal backend)
- `getMixSceltaAttuale`: aggiunto guard — verifica che il valore restituito sia presente tra i valori validi di `getMixOpzioni`; se non lo è, restituisce `''`
- `tuttiRisolti`: spostato dopo `buildGroups` e riscritto per lavorare a livello di gruppi — per mix usa `getMixSceltaAttuale(g) !== ''`, per singoli mantiene `scelte[g.members[0].source_id] != null`

### Bug 2: Griglia CRM — cambio lotto mix "cancella" la card

**Root cause (trovata via DB):**
Il metodo `04` aveva `removedMix = ['mix_mnavze7m', 'mix_mnazie5r', 'mix_mnazpsy9', 'mix_mnbhdo2b', 'mix_mnc8dbk3']`. Il `mix_id` `mix_mnc8dbk3` è il **nuovo lotto CC22** (`nuovolottocc22`). Quando l'utente cambiava il dropdown della griglia da `mix_mn309njl_10_25DILE188A` (lotto vecchio scaduto) a `mix_mnc8dbk3` (lotto nuovo), `mixIdAttivo` diventava un id presente in `removedMix` → `isRmMx = true` → card barrata/opaca al 28%, sembrando "cancellata".

La causa profonda: lo scenario aveva escluso tutti i lotti "extra" della stessa firma mix (incluso il nuovo lotto CC22) perché quel metodo ha scenari multipli. Cambiare lotto dalla griglia non aggiornava `removedMix`.

**Fix:**
- `SchemaCalibrazione.grid.tsx`: aggiunta prop opzionale `onChangeMixLotto?(firmaId, oldMixId, newMixId)` a `GrigliaProps`; nel `onChange` del select, oltre a `setMixLottoSel`, chiama `onChangeMixLotto?.(a.mixId!, oldId, newId)`
- `SchemaCalibrazione.tsx`: aggiunto callback `handleChangeMixLotto` che:
  - Rimuove `newMixId` da `removedMix` (il nuovo lotto diventa attivo)
  - Aggiunge `oldMixId` a `removedMix` (il vecchio lotto viene escluso)
  - Se il vecchio mix era in `selSrcs`, trasferisce la selezione al nuovo `mix_id` con metadati aggiornati da `crmItems`
- Passata la prop `onChangeMixLotto={handleChangeMixLotto}` alla `GrigliaAnalitiCrm`

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/RicaricaDialog.tsx` | Fix `handleMixScelta` (fallback mix_id), `getMixSceltaAttuale` (guard valori validi), `tuttiRisolti` (logica a livello di gruppi) |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Aggiunta prop `onChangeMixLotto`, chiamata nel `onChange` del select lotti |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto `handleChangeMixLotto` (swap `removedMix` + trasferimento `selSrcs`), passata prop a `GrigliaAnalitiCrm` |

---

## Note per sessioni future

- Il DB di test aveva lotti CC22 con `scadenza_prodotto = 2026-03-22` (volutamente scaduti) e un nuovo lotto `nuovolottocc22` con scadenza `2026-04-05`. Mix id vecchio: `mix_mn309njl_10_25DILE188A`, nuovo: `mix_mnc8dbk3`.
- Il comportamento di `removedMix` swappato quando si cambia lotto è ora coerente con la logica degli scenari: ogni "firma mix" (stessi componenti) ha un solo lotto attivo per volta nello schema.
- Se in futuro si vuole supportare scenari che usano lotti diversi della stessa mix in colonne diverse, questa logica dovrà essere rivista.
- Piano della sessione: `docs/plans/active/2026-04-02-02-fix-ricarica-dialog-e-griglia-mix-lotto-plan.md`
