# Resoconto sessione — Fix calcolo Work: diluizione per mix con concentrazioni eterogenee

**Data:** 2026-03-24
**Oggetto:** Fix del sistema di calcolo delle Work quando le mix CRM hanno composti con concentrazioni diverse internamente

---

## Cosa è stato fatto

Analizzato e corretto il sistema di calcolo delle Work in SchemaCalibrazione. Il bug riguardava le mix CRM che contengono composti a concentrazioni diverse (es. 0.99, 1.00, 1.01 mg/L): il sistema le trattava come omogenee e usava la modalità "concentrazione target" (C1V1=C2V2), quando l'unica operazione corretta è la **diluizione** (÷N), dato che una mix è un prodotto unico e i composti non si possono separare.

Bug secondario collegato: `getCompsFromWork()` mostrava le concentrazioni originali del CRM nei COMPOSTI invece di quelle diluite, a causa di un fallback a `dilFactor=1` quando `w.conc` è null.

---

## Bug risolti

### Mix eterogenee trattate come omogenee
**Root cause:** `toggleMix` (SchemaCalibrazione.tsx:660) prendeva `cv` dal primo composto trovato nella mix, senza controllare se tutti i composti avessero la stessa concentrazione. `getConcInfo` vedeva `cv > 0` e ritornava `omogenea: true`, forzando la modalità concentrazione.
**Fix:** In `toggleMix` si controlla ora l'uniformità delle concentrazioni (`new Set(comps.map(c => c.cv)).size > 1`). Se eterogenea, imposta `concVariabile: true` su `SorgenteSel`. In `getConcInfo` si rispetta il flag `concVariabile`: se true, ritorna `omogenea: false`. Questo a cascata fa sì che `calcolaVols`, `ModalCreaWork` e tutto il form si adattino automaticamente alla modalità diluizione (label "Fattore diluizione ÷N", placeholder "÷N", etc).

### Concentrazioni COMPOSTI errate in getCompsFromWork
**Root cause:** `getCompsFromWork()` usava `w.conc / src.cv` per calcolare il fattore di diluizione. Quando `w.conc` è null (customMode o concVariabile), il fattore cadeva a 1 e le concentrazioni finali risultavano uguali a quelle originali del CRM.
**Fix:** Si usano ora i dati per-ingrediente da `w.vols[i]`: se `modo='dil'` si usa `1 / ing.dilFactor`, se `modo='conc'` si usa `ing.concTarget / src.cv`, con fallback originale solo se entrambi mancano.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `toggleMix`: check uniformità concentrazioni mix, flag `concVariabile` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `getConcInfo`: rispetta `concVariabile`; `getCompsFromWork`: usa dati per-ingrediente |

---

## Note per sessioni future

- Il piano dettagliato è in `docs/plans/active/2026-03-24-fix-calcolo-work-diluizione-plan.md`
- L'interfaccia `SorgenteSel` aveva già `concVariabile?: boolean` opzionale — non è stata modificata
- Il campo `CrmItem.concVariabile` in `useSchemaData` è hardcoded a `false` (riga 66 di logic.ts). Non è stato toccato perché la logica di rilevamento eterogeneità è applicata in `toggleMix` (dove si ha il contesto del gruppo mix). Se in futuro servisse il flag anche a livello di CrmItem, va calcolato durante il caricamento raggruppando per `mix_id`.
- L'errore TypeScript pre-esistente in `salvaWorkNelDb` (flatMap type) non è stato introdotto da questa sessione
