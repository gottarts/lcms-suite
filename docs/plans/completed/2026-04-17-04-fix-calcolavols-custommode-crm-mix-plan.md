# Piano: Fix calcolo volumi con "Valori per sorgente" + CRM Mix

## Context

Il calcolo del volume di prelievo in `calcolaVols()` produce risultati sbagliati quando:
1. Checkbox "Valori per sorgente" è attiva (`customMode = true`)
2. Ci sono sia work sorgenti che un CRM mix come sorgenti
3. Il CRM mix è omogeneo (concentrazione fissa)

**Indizio chiave dell'utente**: funziona con sole work sorgenti, sbaglia con work + CRM mix + spunta per sorgente.

## Root cause

In `SchemaCalibrazione.logic.ts`, funzione `calcolaVols()` (circa linea 323):

```typescript
const hasVar = srcs.some(s => !getConcInfo(s, workCols).omogenea)
// ...
if (!isVar && !hasVar) {
  // Formula concentrazione: vol = (val * volFin) / cv   ← SBAGLIATA in customMode
} else {
  // Formula diluizione: vol = volFin / val               ← CORRETTA in customMode
}
```

Il problema: quando `customMode = true`, il valore inserito dall'utente è **sempre un fattore di diluizione (÷N)**, non una concentrazione. Ma il ramo `if (!isVar && !hasVar)` usa la formula C1V1=C2V2, interpretando il valore come concentrazione.

**Perché funziona solo con work sorgenti**: le work intermedie hanno `concVariabile = true`, quindi `hasVar = true`, e il codice entra sempre nel ramo diluizione corretto.

**Perché fallisce con CRM mix**: il CRM mix è omogeneo (`concVariabile = false`), quindi `hasVar = false`, e il codice entra nel ramo concentrazione sbagliato.

## File critico

- `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — funzione `calcolaVols()`

## Fix

Aggiungere `customMode` come condizione nella decisione del ramo:

```typescript
// PRIMA:
if (!isVar && !hasVar) {

// DOPO:
if (!customMode && !isVar && !hasVar) {
```

Questo garantisce che in `customMode = true` si usi **sempre** la formula diluizione `vol = volFin / val`, indipendentemente dall'omogeneità delle sorgenti.

## Verifica

1. Aprire SchemaCalibrazione con work sorgenti (2 mg/L) + CRM mix
2. Attivare "Valori per sorgente"
3. Inserire conc finale 0.01 mg/L per le work sorgenti → volume prelievo deve essere fisicamente sensato (piccolo, non 100 mL)
4. Verificare che senza la checkbox "Valori per sorgente" il calcolo rimanga invariato
5. Verificare che con sole work sorgenti (senza CRM) il risultato sia lo stesso di prima
