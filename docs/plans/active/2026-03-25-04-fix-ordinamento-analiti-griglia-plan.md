# Piano: Fix ordinamento analiti griglia SchemaCalibrazione

## Context

La griglia SchemaCalibrazione ordina gli analiti così:
`soloSng → entrambi → soloMix → senzaCrm`

Il gruppo `entrambi` (analiti con sia mix che singoli) viene messo **prima** dei `soloMix`. Questo è sbagliato: rompe la griglia perché analiti con mix diversi si ritrovano vicini forzatamente, spezzando la coerenza visiva dei blocchi CRM Mix.

**Comportamento desiderato:**
- Sopra: analiti con SOLO puri/singoli (nessun mix)
- Poi: analiti con mix (raggruppati per mix_id), con gli analiti che hanno anche singoli messi **in testa al loro blocco mix**
- In coda: analiti senza CRM

## File critici

- [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — righe 112-118 (ordinamento) e 162-186 (separatori)
- [SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx) — righe 162-186 (calcolo separatori e posizioni mix)

## Modifiche

### 1. `SchemaCalibrazione.logic.ts` — righe 112-118

**Nuovo algoritmo:**
1. `soloSng` = analiti senza mixId (solo singoli o puri) → vanno in cima
2. Tutti gli analiti con mixId → raggruppati per mixId
3. All'interno di ogni gruppo mix: prima gli `entrambi` (hanno anche sngIds), poi i `soloMix`
4. `senzaCrm` → in coda

```typescript
// Nuovo ordine: solo-singoli → [per ciascun mix: entrambi-del-mix → solo-mix] → senza CRM
const soloSng  = analitiCalc.filter(a => !a.mixId && a.sngIds.length > 0)
const conMix   = analitiCalc.filter(a =>  a.mixId)
const senzaCrm = analitiCalc.filter(a => !a.mixId && a.sngIds.length === 0)

// Raggruppa per mixId mantenendo l'ordine di prima comparsa
const mixOrder: string[] = []
for (const a of conMix) {
  if (!mixOrder.includes(a.mixId!)) mixOrder.push(a.mixId!)
}
const mixGrouped: AnalitoItem[] = []
for (const mid of mixOrder) {
  const gruppo = conMix.filter(a => a.mixId === mid)
  const conSng = gruppo.filter(a => a.sngIds.length > 0)  // entrambi: prima
  const senzSng = gruppo.filter(a => a.sngIds.length === 0) // solo-mix: dopo
  mixGrouped.push(...conSng, ...senzSng)
}

setAnaliti([...soloSng, ...mixGrouped, ...senzaCrm])
```

### 2. `SchemaCalibrazione.grid.tsx` — separatori

Eliminare il separatore tra `soloSng` e `entrambi` (non esiste più `entrambi` come gruppo separato). I separatori diventano:
- Dopo `soloSng` (se ci sono analiti con mix dopo)
- Dopo tutti gli analiti con mix (se ci sono `senzaCrm`)

```typescript
const nSoloSng  = analiti.filter(a => !a.mixId && a.sngIds.length > 0).length
const nConMix   = analiti.filter(a =>  a.mixId).length
const hasSenzaCrm = analiti.some(a => !a.mixId && a.sngIds.length === 0)
const hasConMix = nConMix > 0

// Separatori: dopo soloSng (se ci sono mix), dopo conMix (se ci sono senzaCrm)
const hasSep = (i === nSoloSng && nSoloSng > 0 && hasConMix) ||
               (i === nSoloSng + nConMix && nConMix > 0 && hasSenzaCrm)
```

Le variabili `nEntrambi` e `isSepSngEnt` vanno rimosse o aggiornate di conseguenza.

## Verifica

1. Aprire uno schema con analiti che hanno sia mix che singoli
2. Verificare che gli analiti con `entrambi` compaiano **all'interno del loro blocco mix**, non sopra di esso
3. Verificare che i blocchi mix rimangano coesi (chips mix contigue)
4. Verificare che la chip singoli sia ancora presente nella colonna corretta per gli analiti con `entrambi`
5. Verificare separatori visivi corretti tra i gruppi
