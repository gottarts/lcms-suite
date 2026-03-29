# Resoconto sessione — Fix ordinamento analiti griglia SchemaCalibrazione

**Data:** 2026-03-25
**Oggetto:** Correzione bug ordinamento analiti nella griglia CRM Mix quando un analita ha sia mix che singoli

---

## Cosa è stato fatto

Corretto un bug nell'ordinamento degli analiti nella griglia SchemaCalibrazione che si manifestava quando uno o più analiti avevano associato sia un CRM mix che CRM singoli (caso "entrambi"). Il vecchio ordinamento metteva questi analiti **prima** del blocco mix, rompendo la coerenza visiva della griglia con chip mix di lotti diversi che si trovavano vicini per errore.

---

## Bug risolti

### Ordinamento analiti con mix + singoli rompe la griglia CRM Mix

**Root cause:** Il vecchio algoritmo di sorting in `SchemaCalibrazione.logic.ts` partizionava gli analiti in 4 gruppi linearmente: `soloSng → entrambi → soloMix → senzaCrm`. Il gruppo `entrambi` veniva estratto e messo **fuori** dai blocchi mix, prima di essi. Questo causava che analiti associati a mix diversi si ritrovassero adiacenti solo perché entrambi avevano anche CRM singoli, spezzando la struttura a blocchi della colonna CRM Mix.

**Fix:**
- Nuovo algoritmo: `soloSng → [per ciascun mix: entrambi-del-mix prima, soloMix dopo] → senzaCrm`
- Gli analiti con `mixId` vengono raggruppati per `mixId` mantenendo l'ordine di prima comparsa. All'interno di ogni gruppo, chi ha anche `sngIds` viene messo in testa.
- I chip singoli restano nella colonna corretta senza spostare l'analita fuori dal suo blocco mix.
- Separatori visivi aggiornati di conseguenza: ora separano `soloSng` dal blocco mix, e il blocco mix da `senzaCrm` (eliminato il separatore intermedio tra `soloSng` e `entrambi` che non esiste più come gruppo separato).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Righe 112-118: nuovo algoritmo di ordinamento per gruppo mix |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Righe 162-239: variabili separatori aggiornate (`nEntrambi`, `nConCrm`, `hasMixOnly` → `nConMix`, `hasConMix`); logica render separatori semplificata |

---

## Note per sessioni future

- Il piano è in `~/.claude/plans/starry-fluttering-eagle.md` (non copiato in docs — era un piano di sessione breve)
- Verifica consigliata: aprire uno schema con analiti che hanno mix diversi e almeno uno con sia mix che singoli, controllare che i blocchi mix rimangano coesi e i separatori siano corretti
- Il campo `isCon` su `AnalitoItem` (indica analita con entrambi) rimane in uso altrove — non è stato rimosso
