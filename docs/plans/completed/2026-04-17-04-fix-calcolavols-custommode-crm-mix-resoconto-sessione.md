# Resoconto sessione — Fix calcolo volumi "Valori per sorgente" con CRM Mix

**Data:** 2026-04-17
**Oggetto:** Bug nel calcolo volumi prelievo quando customMode=true e ci sono sorgenti eterogenee (work variabile + CRM mix omogeneo)

---

## Cosa è stato fatto

Risolto il bug aperto dalla sessione precedente: il calcolo del volume di prelievo in `calcolaVols()` produceva risultati fisicamente insensati (es. 100 mL in 1 mL volume finale) quando si usava la spunta "Valori per sorgente" con una combinazione di work sorgenti e CRM mix.

---

## Bug risolti / Feature aggiunte

### Fix: `calcolaVols()` — formula errata con customMode + CRM mix omogeneo

**Root cause:**
La funzione usava `hasVar` (flag globale: "almeno una sorgente è variabile?") per decidere se usare la formula concentrazione (`C1V1=C2V2`) o diluizione (`vol = volFin / N`). Quando c'erano sia work sorgenti (variabili, `concVariabile=true`) che un CRM mix (omogeneo, `concVariabile=false`):

- Solo work → `hasVar=true` → tutte le sorgenti usano formula diluizione ✓
- Work + CRM mix → `hasVar=true` per via della work → CRM mix usa formula diluizione anche se l'utente aveva inserito `mg/L` (concentrazione) ✗

Il problema era che in `customMode` ogni sorgente ha un campo con semantica **distinta**: `÷N` se variabile, `mg/L` se omogenea. Ma `hasVar` globale "contaminava" tutte le sorgenti con la stessa formula.

Primo tentativo di fix (`!customMode && !isVar && !hasVar`) era sbagliato: forzava sempre la formula diluizione in customMode, rompendo il caso CRM mix omogeneo (che deve usare concentrazione).

**Fix corretto:**
```typescript
// Prima:
if (!isVar && !hasVar) {

// Dopo:
const useConc = customMode ? (!isVar) : (!isVar && !hasVar)
if (useConc) {
```

In `customMode` si usa `isVar` per-sorgente: ogni sorgente sceglie la formula in base alla propria natura, indipendentemente dalle altre sorgenti.

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`, funzione `calcolaVols()` (linea ~340)

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Fix logica `calcolaVols()`: `useConc` per-sorgente in customMode |

---

## Note per sessioni future

- Il comportamento atteso in customMode: sorgente variabile → input `÷N` → formula diluizione; sorgente omogenea → input `mg/L` → formula concentrazione. Questa semantica è documentata implicitamente nel placeholder dell'input (`isVar ? '÷N' : 'mg/L'` in grid.tsx:843).
- Nessun problema aperto rimasto da questa sessione.
