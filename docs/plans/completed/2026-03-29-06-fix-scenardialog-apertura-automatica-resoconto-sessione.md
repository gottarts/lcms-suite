# Resoconto sessione — Fix apertura automatica ScenarDialog

**Data:** 2026-03-29
**Oggetto:** Bugfix: ScenarDialog non si apre automaticamente se non ci sono ≥2 scenari CRM mix

---

## Cosa è stato fatto

Risolto un bug bloccante: quando si apre lo schema di un metodo i cui analiti non hanno CRM in miscela, il selettore scenario si apriva automaticamente e non era chiudibile (nessun bottone di chiusura, nessuno scenario da scegliere), costringendo a riavviare l'app.

---

## Bug risolti

### ScenarDialog si apre automaticamente anche senza CRM mix

**Root cause:** Il `useEffect` che carica lo schema salvato (`SchemaCalibrazione.tsx` ~riga 816) apriva il dialog in base al solo flag `scenarioScelto` (mai impostato = apri dialog), senza verificare se esistessero effettivamente scenari CRM mix tra cui scegliere.

**Fix:** Prima di chiamare `setScenarOpen(true)`, viene ora calcolato il numero di scenari disponibili usando `buildMixComposizioni` + `generaScenari` (già esistenti in `SchemaCalibrazione.scenari.ts`). Il dialog si apre solo se `scenari.length > 1`. Nei casi banali (0 o 1 scenario) viene impostato `setScenarioScelto(true)` così il dialog non si ripropone ai reload successivi.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunto import `buildMixComposizioni`, `generaScenari`; logica apertura automatica condizionata a `scenari.length > 1` |

---

## Note per sessioni future

- Il piano di questa sessione è in `docs/plans/active/2026-03-29-06-fix-scenardialog-apertura-automatica-plan.md`
- Nessun TODO rimasto aperto
